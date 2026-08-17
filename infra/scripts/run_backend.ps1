param(
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 8000
)

$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location "$repoRoot\backend"

$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
  & $venvPython -m uvicorn app.main:app --reload --host $BindHost --port $Port
} else {
  python -m uvicorn app.main:app --reload --host $BindHost --port $Port
}

