# Deploy rerun release-registry regression drill

This drill proves that rerunning the same release after a late deploy failure does not corrupt `/opt/rdevents/runtime/releases.json`.

## Scenario

1. Start from release `A`.
2. Deploy release `B`.
3. Simulate a failure after `api`, `web`, `report-worker`, and `email-broadcast-worker` have been recreated, but before deploy success is finalized.
4. Rerun deploy `B`.
5. Verify that release `A` still points to release `A` Docker image IDs.

The incident this guards against: a first deploy attempt can switch running containers to `B`, fail later at `host-install`, then a rerun can accidentally treat those already-running `B` containers as the previous release images for `A`.

## Precondition

Record the release registry before the drill:

```bash
cat /opt/rdevents/runtime/releases.json | jq
```

Set:

```bash
export RELEASE_A=<current_release_sha>
export RELEASE_B=<new_release_sha>
export API_IMAGE_A=<current_api_image_id>
export WEB_IMAGE_A=<current_web_image_id>
```

Capture current image IDs:

```bash
docker inspect $(docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps -q api) --format '{{.Image}}'
docker inspect $(docker compose --env-file /opt/rdevents/.env -f /opt/rdevents/app/docker-compose.prod.yml ps -q web) --format '{{.Image}}'
```

## Failure simulation

Use staging only.

One practical simulation is to temporarily make the host-install phase fail after services are recreated, for example by moving `rsync` out of PATH on staging or running with a deliberately missing privileged host-install dependency. The first deploy attempt should reach service recreation and health verification, then fail before final success.

After the failed attempt, verify the partial-deploy state:

```bash
cat /opt/rdevents/runtime/deploy-state.json | jq
curl -fsS https://api.rdevents.uz/version
curl -fsS https://rdevents.uz/version.txt
```

Expected:

- `deploy-state.json` has `status = failed`;
- release endpoints already return `RELEASE_B`;
- `/opt/rdevents/runtime/releases.json` still has `current = RELEASE_A`.

Find the first failed deploy manifest:

```bash
find /opt/rdevents/backups/releases/$RELEASE_B -name deploy-manifest.json | sort | head -1
```

Verify it contains the original previous image IDs:

```bash
cat /opt/rdevents/backups/releases/$RELEASE_B/<timestamp>/deploy-manifest.json | jq '{
  previousReleaseSha,
  apiImageIdBefore,
  webImageIdBefore,
  reportWorkerImageIdBefore,
  emailBroadcastWorkerImageIdBefore
}'
```

## Rerun deploy

Fix the simulated host-install failure, then rerun deploy for the same `RELEASE_B`.

The deploy log must include one of these safe messages:

- `Detected rerun after containers already switched to target release.`
- `Recovered previous image IDs from earliest manifest:`
- `Preserving previous release registry entry.`
- `Not overwriting previous release registry entry.`

It must not overwrite release `A` with release `B` image IDs.

## Verification

Check the final registry:

```bash
cat /opt/rdevents/runtime/releases.json | jq \
  --arg releaseA "$RELEASE_A" \
  --arg releaseB "$RELEASE_B" \
  '{
    current,
    previous,
    releaseA: .releases[$releaseA],
    releaseB: .releases[$releaseB]
  }'
```

Expected:

- `current = RELEASE_B`;
- `previous = RELEASE_A`;
- `releases[RELEASE_A].apiImageId = API_IMAGE_A`;
- `releases[RELEASE_A].webImageId = WEB_IMAGE_A`;
- `releases[RELEASE_B].apiImageId` is the new API image ID;
- `releases[RELEASE_B].webImageId` is the new Web image ID.

Verify rollback would target actual release `A` images:

```bash
cat /opt/rdevents/runtime/releases.json | jq \
  --arg releaseA "$RELEASE_A" \
  '.releases[$releaseA] | {apiImageId, webImageId, reportWorkerImageId, emailBroadcastWorkerImageId}'

docker image inspect "$API_IMAGE_A" >/dev/null
docker image inspect "$WEB_IMAGE_A" >/dev/null
```

Acceptance:

- rerun does not corrupt previous release mapping;
- previous release mapping remains stable;
- current release mapping is correct;
- deploy log clearly says whether previous images were captured, preserved, or recovered;
- code rollback to `RELEASE_A` would use actual `A` images.
