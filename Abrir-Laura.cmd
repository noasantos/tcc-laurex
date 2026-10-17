@echo off
cd /d "%~dp0"
node scripts\launch.cjs
if errorlevel 1 pause
