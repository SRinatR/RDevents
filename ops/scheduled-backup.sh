#!/usr/bin/env bash
set -euo pipefail
RELEASE_SHA="scheduled-$(date +%Y%m%d-%H%M%S)" /opt/rdevents/ops/create-predeploy-backup.sh
