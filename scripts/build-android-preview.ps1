param(
  [switch]$AllowMissingPublicConfig
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$localEnvironment = Join-Path $projectRoot '.env.local'
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

function Save-ProcessEnvironment {
  param([string[]]$Names)

  $processEnvironment = [Environment]::GetEnvironmentVariables('Process')
  $snapshot = @{}
  foreach ($name in $Names) {
    $snapshot[$name] = [pscustomobject]@{
      Exists = $processEnvironment.Contains($name)
      Value = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
  }
  return $snapshot
}

function Restore-ProcessEnvironment {
  param([System.Collections.IDictionary]$Snapshot)

  foreach ($name in $Snapshot.Keys) {
    $entry = $Snapshot[$name]
    if ($entry.Exists) {
      [Environment]::SetEnvironmentVariable($name, [string]$entry.Value, 'Process')
    } else {
      Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}

function Get-PreviewArtifactName {
  param([bool]$HasPublicConfig)

  if ($HasPublicConfig) { return 'nirmaan-field-preview-arm64.apk' }
  return 'nirmaan-field-preview-arm64-setup-unavailable.apk'
}

function Import-PublicEnvironment {
  param(
    [string]$Path,
    [switch]$AllowMissingPublicConfig
  )

  $env:EXPO_NO_DOTENV = '1'
  Remove-Item Env:NEXT_PUBLIC_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY -ErrorAction SilentlyContinue

  if (-not (Test-Path -LiteralPath $Path)) {
    if ($AllowMissingPublicConfig) { return $false }
    throw 'Create .env.local with the production Supabase public configuration before building a preview.'
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*)\s*$') {
      $name = $Matches[1]
      $value = $Matches[2].Trim().Trim('"').Trim("'")
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }

  $hasUrl = -not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_URL)
  $hasKey = -not [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  if (-not $hasUrl -or -not $hasKey) {
    if ($AllowMissingPublicConfig) { return $false }
    throw '.env.local must define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
  }
  return $true
}

function Assert-ApprovedDebugCertificate {
  param([string[]]$SignatureReport)

  if (-not ($SignatureReport -match 'certificate DN: CN=Android Debug')) {
    throw 'The preview APK was not signed with an Android debug certificate.'
  }

  $fingerprints = @(
    foreach ($line in $SignatureReport) {
      if ($line -match 'certificate SHA-256 digest:\s*([0-9a-fA-F]{64})\s*$') {
        $Matches[1].ToLowerInvariant()
      }
    }
  )
  $approvedFingerprint = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'
  if (
    $fingerprints.Count -ne 1 -or
    $fingerprints[0] -ne $approvedFingerprint
  ) {
    throw 'The preview APK was not signed with the approved Android debug certificate.'
  }
}

function Resolve-AndroidToolchain {
  $androidSdk = $env:ANDROID_HOME
  if ([string]::IsNullOrWhiteSpace($androidSdk)) {
    $androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  }
  if (-not (Test-Path -LiteralPath $androidSdk -PathType Container)) {
    throw 'Android SDK not found. Set ANDROID_HOME to an installed Android SDK.'
  }

  $javaHome = $env:JAVA_HOME
  if ([string]::IsNullOrWhiteSpace($javaHome)) {
    $javaHome = 'C:\Program Files\Android\Android Studio\jbr'
  }
  $javaExecutable = Join-Path $javaHome 'bin\java.exe'
  if (-not (Test-Path -LiteralPath $javaExecutable -PathType Leaf)) {
    throw 'A compatible JDK was not found. Set JAVA_HOME or install Android Studio.'
  }

  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk
  $env:JAVA_HOME = $javaHome
  $env:NODE_ENV = 'production'
  $nativeAccessOption = '--enable-native-access=ALL-UNNAMED'
  if ([string]::IsNullOrWhiteSpace($env:JAVA_TOOL_OPTIONS)) {
    $env:JAVA_TOOL_OPTIONS = $nativeAccessOption
  } elseif ($env:JAVA_TOOL_OPTIONS -notlike "*$nativeAccessOption*") {
    $env:JAVA_TOOL_OPTIONS = "$($env:JAVA_TOOL_OPTIONS) $nativeAccessOption"
  }
  return $androidSdk
}

function Invoke-Checked {
  param(
    [string]$Executable,
    [string[]]$Arguments
  )

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Executable failed with exit code $LASTEXITCODE."
  }
}

$originalEnvironment = Save-ProcessEnvironment -Names $buildEnvironmentNames
Push-Location $projectRoot
try {
  $hasPublicConfig = Import-PublicEnvironment `
    -Path $localEnvironment `
    -AllowMissingPublicConfig:$AllowMissingPublicConfig
  $androidSdk = Resolve-AndroidToolchain

  Invoke-Checked -Executable 'npx.cmd' -Arguments @(
    'expo',
    'prebuild',
    '--platform',
    'android',
    '--no-install'
  )

  $gradle = Join-Path $projectRoot 'android\gradlew.bat'
  $commonGradleArguments = @(
    '-p',
    'android',
    '-PreactNativeArchitectures=arm64-v8a',
    '--no-parallel',
    '--no-daemon'
  )

  $workletsArguments = @(
    $commonGradleArguments +
      ':react-native-worklets:configureCMakeRelWithDebInfo[arm64-v8a]'
  )
  Invoke-Checked -Executable $gradle -Arguments $workletsArguments

  $assembleArguments = @($commonGradleArguments + ':app:assembleRelease')
  Invoke-Checked -Executable $gradle -Arguments $assembleArguments

  $builtApk = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path -LiteralPath $builtApk -PathType Leaf)) {
    throw 'Gradle completed without producing the expected release APK.'
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($builtApk)
  try {
    $entries = @($archive.Entries | ForEach-Object FullName)
  } finally {
    $archive.Dispose()
  }

  $abis = @(
    $entries |
      Where-Object { $_ -match '^lib/([^/]+)/' } |
      ForEach-Object { if ($_ -match '^lib/([^/]+)/') { $Matches[1] } } |
      Sort-Object -Unique
  )
  if ($abis.Count -ne 1 -or $abis[0] -ne 'arm64-v8a') {
    throw "Expected an ARM64-only APK, found: $($abis -join ', ')."
  }
  if ($entries -notcontains 'assets/index.android.bundle') {
    throw 'The APK does not contain its JavaScript bundle.'
  }

  $buildToolsRoot = Join-Path $androidSdk 'build-tools'
  $apksigner = Get-ChildItem -LiteralPath $buildToolsRoot -Filter 'apksigner.bat' -Recurse |
    Sort-Object { [version]$_.Directory.Name } -Descending |
    Select-Object -First 1
  if ($null -eq $apksigner) {
    throw 'apksigner was not found in the Android SDK build-tools directory.'
  }
  $aapt = Join-Path $apksigner.Directory.FullName 'aapt.exe'
  if (-not (Test-Path -LiteralPath $aapt -PathType Leaf)) {
    throw 'aapt was not found beside apksigner in the Android SDK build-tools directory.'
  }
  $badging = @(& $aapt 'dump' 'badging' $builtApk)
  if ($LASTEXITCODE -ne 0) {
    throw 'aapt could not read the generated APK.'
  }
  $package = $badging | Where-Object { $_ -match '^package:' } | Select-Object -First 1
  if ($package -notmatch "name='com\.mahakagarwal\.nirmaan'") {
    throw 'The generated APK has an unexpected Android package ID.'
  }

  $signatureReport = @(
    & $apksigner.FullName 'verify' '--verbose' '--print-certs' $builtApk
  )
  if ($LASTEXITCODE -ne 0) {
    throw 'apksigner could not verify the generated APK.'
  }
  Assert-ApprovedDebugCertificate -SignatureReport $signatureReport
  $signatureReport | Write-Output

  $outputDirectory = Join-Path $projectRoot 'dist'
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  $artifactName = Get-PreviewArtifactName -HasPublicConfig $hasPublicConfig
  $outputApk = Join-Path $outputDirectory $artifactName
  Copy-Item -LiteralPath $builtApk -Destination $outputApk -Force

  $hash = (Get-FileHash -LiteralPath $outputApk -Algorithm SHA256).Hash.ToLowerInvariant()
  $size = (Get-Item -LiteralPath $outputApk).Length
  Write-Output "APK: $outputApk"
  Write-Output 'Package: com.mahakagarwal.nirmaan'
  Write-Output 'ABI: arm64-v8a'
  Write-Output "Size: $size bytes"
  Write-Output "SHA-256: $hash"
} finally {
  try {
    Restore-ProcessEnvironment -Snapshot $originalEnvironment
  } finally {
    Pop-Location
  }
}
