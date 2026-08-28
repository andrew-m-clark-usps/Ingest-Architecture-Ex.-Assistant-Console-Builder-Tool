# DEMO/REFERENCE SCAFFOLD. See Exec-Assistant.md section 9.
param([switch]$Uninstall)
if ($Uninstall) {
  Write-Host "would remove shortcuts (demo scaffold, no-op)"
} else {
  Write-Host "would write Ctrl+Alt+C / Ctrl+Alt+N shortcuts (demo scaffold, no-op)"
}
