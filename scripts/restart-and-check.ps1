# Restart DSH Desktop, then self-check, writing a durable report.
#
# This runs detached from the DSH Host (created through WMI so it is NOT a child
# of the Electron job object). Killing the Host therefore cannot kill this
# script mid-restart, which is what makes an agent-initiated restart survivable.
#
# Usage:
#   powershell -NoProfile -File scripts/restart-and-check.ps1
#   powershell -NoProfile -File scripts/restart-and-check.ps1 -Root C:\path\to\dsh-novel-companion
#
# Paths are discovered automatically; override them with -Exe / -LogDir if your
# DSH Desktop lives somewhere else.
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [string]$Exe,
  [string]$LogDir
)
$ErrorActionPreference = 'Continue'

$report = Join-Path $Root '.restart-report.log'

if (-not $Exe) {
  $Exe = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DSH Desktop\DSH Desktop.exe'),
    (Join-Path $env:PROGRAMFILES 'DSH Desktop\DSH Desktop.exe')
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $LogDir) { $LogDir = Join-Path $env:APPDATA 'DSH Desktop\logs' }

if (-not $Exe -or -not (Test-Path $Exe)) {
  Write-Error 'DSH Desktop executable not found; pass -Exe <path to DSH Desktop.exe>'
  exit 2
}

$today = Get-Date -Format 'yyyy-MM-dd'
# Desktop names its logs `dsh-<date>.log`, not `<date>.log`. Getting this wrong
# made the check compare against a path that never existed, so it reported
# `new main-log chars: 0` and a false "OK" regardless of what actually happened.
$mainLog = Join-Path $LogDir "dsh-$today.log"
$errLog = Join-Path $LogDir "host\dsh-$today.error.log"

function Say([string]$message) {
  $line = '{0}  {1}' -f (Get-Date -Format 'HH:mm:ss'), $message
  Add-Content -Path $report -Value $line -Encoding utf8
}

Set-Content -Path $report -Value ("DSH restart requested at " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -Encoding utf8
Say 'waiting so the in-flight agent turn can finish and persist'
Start-Sleep -Seconds 20

# Byte offsets, so only lines written from here on are judged.
$markMain = 0
$markErr = 0
$logSeen = $false
if (Test-Path $mainLog) { $markMain = (Get-Item $mainLog).Length; $logSeen = $true }
if (Test-Path $errLog) { $markErr = (Get-Item $errLog).Length; $logSeen = $true }
Say ("log offsets: main=$markMain err=$markErr (mainLog exists: " + (Test-Path $mainLog) + ", errLog exists: " + (Test-Path $errLog) + ")")
if (-not $logSeen) {
  Say 'ERROR: neither log file exists — refusing to report a health result it cannot observe'
}

function Read-From([string]$path, [long]$offset) {
  if (-not (Test-Path $path)) { return '' }
  try {
    $stream = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
    try {
      if ($offset -gt $stream.Length) { $offset = 0 }
      $null = $stream.Seek($offset, 'Begin')
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
      return $reader.ReadToEnd()
    } finally {
      $stream.Dispose()
    }
  } catch {
    return ''
  }
}

# --- close ---------------------------------------------------------------
Say 'closing DSH Desktop (graceful first)'
$main = Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1
if ($null -ne $main) {
  Say ("CloseMainWindow on pid " + $main.Id)
  $null = $main.CloseMainWindow()
} else {
  Say 'no main window found; skipping graceful close'
}
Start-Sleep -Seconds 10

$left = @(Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue)
if ($left.Count -gt 0) {
  Say ("force stopping " + $left.Count + " leftover process(es)")
  $left | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 5

$still = @(Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue)
if ($still.Count -gt 0) {
  Say ("ERROR: " + $still.Count + " process(es) survived Stop-Process; aborting before relaunch")
  exit 1
}
Say 'all DSH Desktop processes are gone'

# --- relaunch ------------------------------------------------------------
Say ("relaunching: " + $Exe)
Start-Process -FilePath $Exe
Start-Sleep -Seconds 45

$running = @(Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue)
if ($running.Count -eq 0) {
  Say 'relaunch did not leave any process running; retrying once'
  Start-Process -FilePath $Exe
  Start-Sleep -Seconds 45
  $running = @(Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue)
}
Say ("processes after relaunch: " + $running.Count)

# Give the Host utility process time to compose the profile and load modules.
Start-Sleep -Seconds 20

# --- checks --------------------------------------------------------------
$fatal = 0
$newMain = Read-From $mainLog $markMain
$newErr = Read-From $errLog $markErr

$fatalPatterns = 'fatal load failure', 'DSH Host exited', 'does not expose', 'without inject'
$fatalLines = @()
foreach ($line in ($newMain -split "`r?`n") + ($newErr -split "`r?`n")) {
  foreach ($pattern in $fatalPatterns) {
    if ($line -like "*$pattern*") { $fatalLines += $line.Trim(); break }
  }
}
$fatal = $fatalLines.Count

Say ("new main-log chars: " + $newMain.Length + " | new host-error chars: " + $newErr.Length)
if (-not $logSeen) {
  Say 'INCONCLUSIVE: could not observe the desktop logs, so health is unknown'
} elseif ($newMain.Length -eq 0 -and $newErr.Length -eq 0) {
  # A real boot always writes a banner line, so zero new bytes means the offsets
  # are wrong, not that the boot was silent. Never call that a pass.
  Say 'INCONCLUSIVE: no new log output was observed; the boot may not have been captured'
} elseif ($fatal -eq 0) {
  Say 'OK: no fatal load failure, no Host exit after the restart'
} else {
  Say ("FAIL: " + $fatal + " fatal line(s) after the restart")
  foreach ($line in ($fatalLines | Select-Object -First 10)) { Say ("  " + $line) }
}

$stillRunning = @(Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue)
Say ("DSH Desktop running now: " + ($stillRunning.Count -gt 0))
if ($stillRunning.Count -gt 0) {
  $newest = $stillRunning | Sort-Object StartTime | Select-Object -First 1
  Say ("earliest process start: " + $newest.StartTime.ToString('HH:mm:ss'))
}
Say 'DONE'
