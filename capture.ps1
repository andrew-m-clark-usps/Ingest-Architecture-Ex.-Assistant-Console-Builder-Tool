# DEMO/REFERENCE SCAFFOLD -- Ctrl+Alt+C hotkey target.
# See Exec-Assistant.md section 9 (Windows and the VDI) for the real
# Constrained-Language-Mode fallback this stub does not implement.
param([string]$Text)
if (-not $Text) { $Text = Read-Host "capture" }
python assistant.py capture "$Text"
