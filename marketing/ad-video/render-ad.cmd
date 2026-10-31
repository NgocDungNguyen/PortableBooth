@echo off
rem PortableBooth ad: one-click local render on Windows.
rem Usage:  render-ad.cmd                          (voice-over already at public\audio\vo.mp3)
rem         render-ad.cmd C:\Downloads\vo.mp3      (copy the voice-over in first)
rem         render-ad.cmd --no-capture             (re-render only: reuse the last app recordings)
cd /d "%~dp0"
set FIRST=%~1
if "%FIRST%"=="" goto plain
if "%FIRST:~0,2%"=="--" goto plain
node tools\setup.mjs --vo="%~1" %2 %3
goto end
:plain
node tools\setup.mjs %*
:end
pause
