$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot '../build-android-preview.ps1')
)
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  $scriptPath,
  [ref]$tokens,
  [ref]$parseErrors
)
if ($parseErrors.Count -gt 0) {
  throw "Could not parse build script: $($parseErrors[0].Message)"
}

$environmentFunction = $ast.Find(
  {
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
      $node.Name -eq 'Import-PublicEnvironment'
  },
  $true
)
if ($null -eq $environmentFunction) {
  throw "Build helper 'Import-PublicEnvironment' was not found."
}
. ([System.Management.Automation.ScriptBlock]::Create($environmentFunction.Extent.Text))

foreach ($functionName in @(
  'Save-ProcessEnvironment'
  'Restore-ProcessEnvironment'
  'Get-PreviewArtifactName'
  'Get-PreviewFileSha256'
  'Remove-StalePreviewArtifacts'
)) {
  $functionAst = $ast.Find(
    {
      param($node)
      $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq $functionName
    },
    $true
  )
  if ($null -eq $functionAst) {
    throw "Build helper '$functionName' was not found."
  }
  . ([System.Management.Automation.ScriptBlock]::Create($functionAst.Extent.Text))
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
  'nirmaan-preview-test-' + [guid]::NewGuid().ToString('N')
)
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
$environmentFile = Join-Path $temporaryDirectory '.env.local'
$missingFile = Join-Path $temporaryDirectory 'missing.env'
$completeFile = Join-Path $temporaryDirectory 'complete.env'
$buildEnvironmentNames = @(
  'EXPO_NO_DOTENV'
  'NEXT_PUBLIC_SUPABASE_URL'
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  'ANDROID_HOME'
  'ANDROID_SDK_ROOT'
  'JAVA_HOME'
  'NODE_ENV'
  'JAVA_TOOL_OPTIONS'
)
$previousEnvironment = Save-ProcessEnvironment -Names $buildEnvironmentNames

try {
  $hashFile = Join-Path $temporaryDirectory 'sha256-test.bin'
  [System.IO.File]::WriteAllBytes($hashFile, [System.Text.Encoding]::UTF8.GetBytes('abc'))
  if (
    (Get-PreviewFileSha256 -Path $hashFile) -ne
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  ) {
    throw 'The preview file SHA-256 helper returned an incorrect hash.'
  }

  $env:NEXT_PUBLIC_SUPABASE_URL = 'https://stale.example.invalid'
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'stale-public-key'
  $rejectedMissingConfig = $false
  try {
    Import-PublicEnvironment -Path $missingFile
  } catch {
    $rejectedMissingConfig = $true
  }
  if (-not $rejectedMissingConfig) {
    throw 'The default build mode accepted a missing public configuration.'
  }
  $hasMissingConfig = Import-PublicEnvironment -Path $missingFile -AllowMissingPublicConfig
  if ($hasMissingConfig) {
    throw 'A missing configuration was reported as a configured acceptance build.'
  }
  if (
    (Get-PreviewArtifactName -HasPublicConfig $hasMissingConfig) -ne
      'nirmaan-field-preview-arm64-setup-unavailable.apk'
  ) {
    throw 'A missing-config preview selected the acceptance artifact filename.'
  }
  if ($env:EXPO_NO_DOTENV -ne '1') {
    throw 'Expo dotenv loading was not disabled for the preview build.'
  }
  if (
    -not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_URL) -or
    -not [string]::IsNullOrWhiteSpace(
      $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
  ) {
    throw 'Missing-config preview retained inherited Supabase values.'
  }

  Set-Content -LiteralPath $environmentFile -Value @(
    'NEXT_PUBLIC_SUPABASE_URL=https://local.example.invalid'
  )
  $env:NEXT_PUBLIC_SUPABASE_URL = 'https://stale.example.invalid'
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'stale-public-key'
  $rejectedIncompleteConfig = $false
  try {
    Import-PublicEnvironment -Path $environmentFile
  } catch {
    $rejectedIncompleteConfig = $true
  }
  if (-not $rejectedIncompleteConfig) {
    throw 'The default build mode accepted an incomplete public configuration.'
  }
  $hasIncompleteConfig = Import-PublicEnvironment -Path $environmentFile -AllowMissingPublicConfig
  if ($hasIncompleteConfig) {
    throw 'An incomplete configuration was reported as a configured acceptance build.'
  }
  if ($env:NEXT_PUBLIC_SUPABASE_URL -ne 'https://local.example.invalid') {
    throw 'The local Supabase URL did not replace inherited configuration.'
  }
  if (-not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw 'An incomplete local config retained an inherited publishable key.'
  }

  Set-Content -LiteralPath $completeFile -Value @(
    'NEXT_PUBLIC_SUPABASE_URL=https://configured.example.invalid'
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=configured-public-key'
  )
  if (-not (Import-PublicEnvironment -Path $completeFile -AllowMissingPublicConfig)) {
    throw 'A complete local configuration was not reported as configured.'
  }
  if (
    (Get-PreviewArtifactName -HasPublicConfig $true) -ne
      'nirmaan-field-preview-arm64.apk'
  ) {
    throw 'A configured preview did not select the acceptance artifact filename.'
  }

  $artifactDirectory = Join-Path $temporaryDirectory 'dist'
  New-Item -ItemType Directory -Path $artifactDirectory | Out-Null
  foreach ($artifactName in @(
    'nirmaan-field-preview-arm64.apk'
    'nirmaan-field-preview-arm64-setup-unavailable.apk'
  )) {
    Set-Content -LiteralPath (Join-Path $artifactDirectory $artifactName) -Value 'stale'
  }
  Remove-StalePreviewArtifacts -OutputDirectory $artifactDirectory
  foreach ($artifactName in @(
    'nirmaan-field-preview-arm64.apk'
    'nirmaan-field-preview-arm64-setup-unavailable.apk'
  )) {
    if (Test-Path -LiteralPath (Join-Path $artifactDirectory $artifactName)) {
      throw "Stale preview artifact '$artifactName' was not removed."
    }
  }

  $environmentSnapshot = Save-ProcessEnvironment -Names $buildEnvironmentNames
  foreach ($name in $buildEnvironmentNames) {
    [Environment]::SetEnvironmentVariable($name, "changed-$name", 'Process')
  }
  Restore-ProcessEnvironment -Snapshot $environmentSnapshot
  $restoredVariables = [Environment]::GetEnvironmentVariables('Process')
  foreach ($name in $buildEnvironmentNames) {
    $expected = $environmentSnapshot[$name]
    $exists = $restoredVariables.Contains($name)
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ($exists -ne $expected.Exists -or $value -ne $expected.Value) {
      throw "The build helper did not restore process environment variable '$name'."
    }
  }

  $certificateFunction = $ast.Find(
    {
      param($node)
      $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq 'Assert-ApprovedDebugCertificate'
    },
    $true
  )
  if ($null -eq $certificateFunction) {
    throw "Build helper 'Assert-ApprovedDebugCertificate' was not found."
  }
  . ([System.Management.Automation.ScriptBlock]::Create($certificateFunction.Extent.Text))

  $approvedFingerprint =
    'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'
  $approvedReport = @(
    'Signer #1 certificate DN: CN=Android Debug, O=Android, C=US'
    "Signer #1 certificate SHA-256 digest: $approvedFingerprint"
  )
  Assert-ApprovedDebugCertificate -SignatureReport $approvedReport

  $wrongReport = @(
    'Signer #1 certificate DN: CN=Android Debug, O=Android, C=US'
    ('Signer #1 certificate SHA-256 digest: ' + ('0' * 64))
  )
  $rejectedWrongCertificate = $false
  try {
    Assert-ApprovedDebugCertificate -SignatureReport $wrongReport
  } catch {
    $rejectedWrongCertificate = $true
  }
  if (-not $rejectedWrongCertificate) {
    throw 'A different Android debug certificate was accepted.'
  }
} finally {
  Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  Restore-ProcessEnvironment -Snapshot $previousEnvironment
}

Write-Output 'Android preview build helper tests passed.'
