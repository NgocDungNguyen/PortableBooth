@echo off
rem PortableBooth ad: one-click local render on Windows.
rem Usage:  render-ad.cmd                       (voice-over already at public\audio\vo.mp3)
rem         render-ad.cmd C:\Downloads\vo.mp3   (copy the voice-over in first)
cd /d "%~dp0"
if "%~1"=="" (
  node tools\setup.mjs
) else (
  node tools\setup.mjs --vo="%~1" %2 %3
)
pause
