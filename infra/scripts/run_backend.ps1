param(
  [string]$Host = "127.0.0.1",
  [int]$Port = 8000
)

Set-Location "$PSScriptRoot\..\..\backend"
python -m uvicorn app.main:app --reload --host $Host --port $Port

