@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Dang cai dat thu vien...
call npm install
if errorlevel 1 goto :error

echo [2/2] Dang tao file .env an toan...
call npm run setup:env
if errorlevel 1 goto :error

echo.
echo Cai dat ma nguon da hoan tat.
echo Tiep theo chay:
echo   docker compose up -d
echo   npx prisma migrate deploy
echo   npm run seed:admin
echo   npm run dev
echo.
pause
exit /b 0

:error
echo.
echo Cai dat that bai. Vui long xem thong bao loi phia tren.
pause
exit /b 1
