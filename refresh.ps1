# DOD daily refresh — scrape every source, rebuild web/public/jobs.json, redeploy to Vercel.
# Run by Task Scheduler daily, or manually:  powershell -ExecutionPolicy Bypass -File D:\dod\refresh.ps1
# Uses the local Vercel CLI login (no token needed). Output is logged to refresh-last.log.

$ErrorActionPreference = 'SilentlyContinue'
$log = 'D:\dod\refresh-last.log'
$py  = 'D:\dod\.venv\Scripts\python.exe'

"=== DOD refresh started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Encoding utf8
$env:PYTHONPATH = 'D:\dod'

& $py D:\dod\poll.py --seed *>> $log
& $py D:\dod\export.py      *>> $log

Set-Location 'D:\dod\web'
& npx --yes vercel@latest --prod --yes *>> $log
Set-Location 'D:\dod'

"=== DOD refresh finished $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Append -Encoding utf8
