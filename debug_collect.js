// Lightweight debug collector for DEBUG MODE.
// Writes NDJSON logs to the configured debug ingest endpoint.
import fs from "node:fs";

const SERVER_ENDPOINT =
  "http://127.0.0.1:7838/ingest/d79ed4cc-2e44-4405-92d9-2a71af5208fa";
const SESSION_ID = "b2222e";

function safeRead(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function safeReadJson(path) {
  try {
    return JSON.parse(safeRead(path));
  } catch {
    return null;
  }
}

function postLog({ hypothesisId, location, message, data }) {
  // #region agent log
  return fetch(SERVER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      location,
      message,
      data,
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => {});
  // #endregion
}

const root = process.cwd();

const webTsconfigPath = `${root}/apps/web/tsconfig.json`;
const apiTsconfigPath = `${root}/services/api/tsconfig.json`;
const prismaSchemaPath = `${root}/services/api/prisma/schema.prisma`;
const authServicePath = `${root}/services/api/src/modules/auth/auth.service.ts`;

const webTsconfig = safeReadJson(webTsconfigPath);
const apiTsconfig = safeReadJson(apiTsconfigPath);
const schemaText = safeRead(prismaSchemaPath);
const authServiceText = safeRead(authServicePath);

const webIgnore = webTsconfig?.compilerOptions?.ignoreDeprecations ?? null;
const apiIgnore = apiTsconfig?.compilerOptions?.ignoreDeprecations ?? null;

const schemaHasCodeSentAt = /codeSentAt\s+DateTime\b/.test(schemaText);
const authServiceMentionsCodeSentAt = /codeSentAt/.test(authServiceText);

await Promise.all([
  postLog({
    hypothesisId: "H1_ignoreDeprecations_value",
    location: "debug_collect.js",
    message: "Read ignoreDeprecations values from tsconfig",
    data: {
      web: { path: webTsconfigPath, ignoreDeprecations: webIgnore },
      api: { path: apiTsconfigPath, ignoreDeprecations: apiIgnore },
    },
  }),
  postLog({
    hypothesisId: "H2_prisma_schema_has_codeSentAt",
    location: "debug_collect.js",
    message: "Check schema.prisma for codeSentAt",
    data: {
      path: prismaSchemaPath,
      schemaHasCodeSentAt,
    },
  }),
  postLog({
    hypothesisId: "H3_auth_service_uses_codeSentAt",
    location: "debug_collect.js",
    message: "Check auth.service.ts for codeSentAt usage",
    data: {
      path: authServicePath,
      authServiceMentionsCodeSentAt,
    },
  }),
  // #region agent log
  fetch(SERVER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      location: "debug_collect.js",
      message: "debug_collect.js finished",
      data: { ok: true },
      timestamp: Date.now(),
      hypothesisId: "H0_lifecycle",
    }),
  }).catch(() => {}),
  // #endregion
]);

