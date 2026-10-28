$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$zipPath = Join-Path (Split-Path $root -Parent) "VELORI_V33_1_3_VERIFIED_SOURCE.zip"
$excludedDirectories = @(
  ".git",
  "node_modules",
  "dist",
  "test-results",
  "coverage",
  "playwright-report",
  ".openai",
  ".cache",
  ".vite",
  "_verified_source_stage"
)
$excludedExtensions = @(".pem", ".key", ".crt", ".p12", ".pfx", ".sqlite", ".db", ".log", ".jsonl", ".har")
$excludedNames = @("local.env", ".DS_Store", "Thumbs.db")

function Get-SourceFiles([string]$directory) {
  foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      continue
    }
    if ($item.PSIsContainer) {
      if (
        $item.Name -in $excludedDirectories -or
        $item.Name -match '^PHASE[0-9]+_SCREENSHOTS$'
      ) {
        continue
      }
      Get-SourceFiles $item.FullName
      continue
    }
    $name = $item.Name
    if (
      $name -in $excludedNames -or
      $name -like ".env*" -or
      [System.IO.Path]::GetExtension($name) -in $excludedExtensions
    ) {
      continue
    }
    $item
  }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new(
  $stream,
  [System.IO.Compression.ZipArchiveMode]::Create
)
$count = 0
try {
  foreach ($file in Get-SourceFiles $root) {
    $relative = $file.FullName.Substring($root.Length).TrimStart([char]92, [char]47)
    $parts = $relative -split '[\\/]'
    if ($parts | Where-Object {
        $_ -in $excludedDirectories -or $_ -match '^PHASE[0-9]+_SCREENSHOTS$'
      }) {
      continue
    }

    $name = $parts[-1]
    if (
      $name -in $excludedNames -or
      $name -like ".env*" -or
      [System.IO.Path]::GetExtension($name) -in $excludedExtensions
    ) {
      continue
    }

    $entry = $archive.CreateEntry(
      $relative.Replace([char]92, [char]47),
      [System.IO.Compression.CompressionLevel]::Optimal
    )
    $input = [System.IO.File]::OpenRead($file.FullName)
    $output = $entry.Open()
    try {
      $input.CopyTo($output)
      $count++
    } finally {
      $output.Dispose()
      $input.Dispose()
    }
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}

$check = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  foreach ($entry in $check.Entries) {
    $parts = $entry.FullName -split '/'
    if (
      $parts | Where-Object {
        $_ -in $excludedDirectories -or $_ -match '^PHASE[0-9]+_SCREENSHOTS$'
      }
    ) {
      throw "Excluded directory found in archive: $($entry.FullName)"
    }
    $name = $parts[-1]
    if (
      $name -in $excludedNames -or
      ($name -like ".env*" -and $name -ne ".env.example") -or
      [System.IO.Path]::GetExtension($name) -in $excludedExtensions
    ) {
      throw "Excluded file found in archive: $($entry.FullName)"
    }
  }
  if ($check.Entries.Count -ne $count) {
    throw "Archive entry count did not match the files added."
  }
} finally {
  $check.Dispose()
}

$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
$size = (Get-Item -LiteralPath $zipPath).Length
Write-Output "ZIP_PATH=$zipPath"
Write-Output "SHA256=$hash"
Write-Output "ZIP_SIZE_BYTES=$size"
Write-Output "ARCHIVE_ENTRIES=$count"
