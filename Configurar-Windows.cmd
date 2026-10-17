@echo off
setlocal
cd /d "%~dp0"
echo Laura Workspace - configuracao inicial
where node >nul 2>nul
if errorlevel 1 (
  echo A instalar o componente local necessario pelo gestor do Windows...
  winget install --id OpenJS.NodeJS.LTS --exact --silent --disable-interactivity
  if errorlevel 1 (
    echo Instale o Node.js LTS em https://nodejs.org e execute este arquivo novamente.
    pause
    exit /b 1
  )
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13)||a>=27){console.error('Instale Node.js LTS 24 em https://nodejs.org');process.exit(1)}"
if errorlevel 1 goto fail
call npm ci --no-fund
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
call npm run assistant:connect -- --allow-local-write
if errorlevel 1 goto fail
node scripts\launch.cjs
if errorlevel 1 goto fail
exit /b 0
:fail
echo Nao foi possivel iniciar. Guarde a mensagem acima e consulte SETUP_WITH_CHATGPT.md.
pause
exit /b 1
