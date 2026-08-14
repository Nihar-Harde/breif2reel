param(
  [int]$Port = 5173
)

Set-Location "$PSScriptRoot\..\..\frontend"
npm run dev -- --port $Port

