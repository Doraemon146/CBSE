@echo off
cd /d "%~dp0"
echo Starting Our Little Space...
echo Open http://localhost:8000 in your browser.
py -m http.server 8000
pause
