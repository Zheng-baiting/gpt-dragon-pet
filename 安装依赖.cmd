@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24 或更新版本，然后重新运行。
  pause
  exit /b 1
)
node scripts\build.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo 准备完成。没有额外 npm 依赖。请双击“启动龙娘.vbs”。
pause
