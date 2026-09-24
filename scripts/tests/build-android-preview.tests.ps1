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

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
  'nirmaan-preview-test-' + [guid]::NewGuid().ToString('N')
)
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
$environmentFile = Join-Path $temporaryDirectory '.env.local'
$missingFile = Join-Path $temporaryDirectory 'missing.env'
$previousNoDotenv = $env:EXPO_NO_DOTENV

try {
  $AllowMissingPublicConfig = $true
  $env:NEXT_PUBLIC_SUPABASE_URL = 'https://stale.example.invalid'
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'stale-public-key'
  Import-PublicEnvironment -Path $missingFile -AllowMissingPublicConfig
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
  Import-PublicEnvironment -Path $environmentFile -AllowMissingPublicConfig
  if ($env:NEXT_PUBLIC_SUPABASE_URL -ne 'https://local.example.invalid') {
    throw 'The local Supabase URL did not replace inherited configuration.'
  }
  if (-not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw 'An incomplete local config retained an inherited publishable key.'
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
  Remove-Item Env:NEXT_PUBLIC_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
  if ($null -eq $previousNoDotenv) {
    Remove-Item Env:EXPO_NO_DOTENV -ErrorAction SilentlyContinue
  } else {
    $env:EXPO_NO_DOTENV = $previousNoDotenv
  }
}

Write-Output 'Android preview build helper tests passed.'
