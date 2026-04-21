#region agent log
param(
  [string]$RunId = "initial"
)

$root = (Get-Location).Path
$logPath = Join-Path $root "debug-b2222e.log"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Write-DebugLog {
  param(
    [string]$HypothesisId,
    [string]$Location,
    [string]$Message,
    [hashtable]$Data
  )

  $entry = @{
    sessionId = "b2222e"
    runId = $RunId
    hypothesisId = $HypothesisId
    location = $Location
    message = $Message
    data = $Data
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Compress -Depth 10

  Add-Content -Path $logPath -Value $entry
}

$webTsconfigPath = Join-Path $root "apps/web/tsconfig.json"
$apiTsconfigPath = Join-Path $root "services/api/tsconfig.json"
$sharedTsconfigPath = Join-Path $root "packages/shared/tsconfig.json"
$prismaSchemaPath = Join-Path $root "services/api/prisma/schema.prisma"
$authServicePath = Join-Path $root "services/api/src/modules/auth/auth.service.ts"
$generatedClientPath = Join-Path $root "node_modules/.pnpm/@prisma+client@7.7.0_prisma_bf5f26df785329c4b0089c0b7b5cace1/node_modules/.prisma/client/index.d.ts"

$webTsconfig = Get-Content -Raw $webTsconfigPath | ConvertFrom-Json
$apiTsconfig = Get-Content -Raw $apiTsconfigPath | ConvertFrom-Json
$sharedTsconfig = Get-Content -Raw $sharedTsconfigPath | ConvertFrom-Json
$schemaText = Get-Content -Raw $prismaSchemaPath
$authServiceText = Get-Content -Raw $authServicePath
$generatedClientText = if (Test-Path $generatedClientPath) { Get-Content -Raw $generatedClientPath } else { "" }

$tsVersion = ""
try {
  $tsVersion = (& node -e "console.log(require('typescript').version)") 2>$null
} catch {
  $tsVersion = "unavailable"
}

$generatedClientDir = Split-Path -Parent $generatedClientPath
$codeSentAtTotalMatchesInDts = 0
$firstCodeSentAtFile = ""
$firstCodeSentAtSnippet = ""
if (Test-Path $generatedClientDir) {
  $dtsFiles = Get-ChildItem -Path $generatedClientDir -Recurse -Filter "*.d.ts" -ErrorAction SilentlyContinue
  foreach ($f in $dtsFiles) {
    $txt = Get-Content -Raw $f.FullName -ErrorAction SilentlyContinue
    $m = [regex]::Matches($txt, "codeSentAt")
    if ($m.Count -gt 0 -and $firstCodeSentAtFile -eq "") {
      $firstCodeSentAtFile = $f.FullName
    }
    $codeSentAtTotalMatchesInDts += $m.Count
  }
}

if ($generatedClientText -and ($generatedClientText.IndexOf("codeSentAt") -ge 0)) {
  $i = $generatedClientText.IndexOf("codeSentAt")
  $start = [Math]::Max(0, $i - 60)
  $len = [Math]::Min($generatedClientText.Length - $start, 200)
  $firstCodeSentAtSnippet = $generatedClientText.Substring($start, $len)
}

Write-DebugLog -HypothesisId "H1_ignoreDeprecations_value" -Location "debug_collect.ps1" -Message "Read ignoreDeprecations values from tsconfig" -Data @{
  web = @{
    path = $webTsconfigPath
    ignoreDeprecations = $webTsconfig.compilerOptions.ignoreDeprecations
  }
  api = @{
    path = $apiTsconfigPath
    ignoreDeprecations = $apiTsconfig.compilerOptions.ignoreDeprecations
  }
  shared = @{
    path = $sharedTsconfigPath
    ignoreDeprecations = $sharedTsconfig.compilerOptions.ignoreDeprecations
  }
}

Write-DebugLog -HypothesisId "H2_prisma_schema_has_codeSentAt" -Location "debug_collect.ps1" -Message "Check schema.prisma for codeSentAt" -Data @{
  path = $prismaSchemaPath
  schemaHasCodeSentAt = ($schemaText -match "codeSentAt\s+DateTime")
}

Write-DebugLog -HypothesisId "H3_auth_service_uses_codeSentAt" -Location "debug_collect.ps1" -Message "Check auth.service.ts for codeSentAt usage" -Data @{
  path = $authServicePath
  authServiceMentionsCodeSentAt = ($authServiceText -match "codeSentAt")
}

Write-DebugLog -HypothesisId "H4_runtime_prisma_generate_failed" -Location "debug_collect.ps1" -Message "Record prisma generate precondition expectation" -Data @{
  note = "Prisma generate requires DATABASE_URL in current setup"
}

Write-DebugLog -HypothesisId "H5_generated_client_missing_codeSentAt" -Location "debug_collect.ps1" -Message "Inspect generated Prisma client for codeSentAt" -Data @{
  path = $generatedClientPath
  generatedClientExists = (Test-Path $generatedClientPath)
  generatedClientHasCodeSentAt = ($generatedClientText -match "codeSentAt")
  generatedClientCodeSentAtCount = ([regex]::Matches($generatedClientText, "codeSentAt")).Count
  firstCodeSentAtSnippet = $firstCodeSentAtSnippet
}

Write-DebugLog -HypothesisId "H6_typescript_version" -Location "debug_collect.ps1" -Message "Capture installed TypeScript version" -Data @{
  typescriptVersion = $tsVersion
}

Write-DebugLog -HypothesisId "H7_codeSentAt_presence_in_generated_client_dts" -Location "debug_collect.ps1" -Message "Count codeSentAt across generated Prisma d.ts files" -Data @{
  generatedClientDir = $generatedClientDir
  codeSentAtTotalMatchesInDts = $codeSentAtTotalMatchesInDts
  firstCodeSentAtFile = $firstCodeSentAtFile
}
#endregion
