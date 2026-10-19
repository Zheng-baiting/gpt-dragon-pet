@echo off
cd /d "%~dp0"
node src/run.mjs --preview
if errorlevel 1 pause
