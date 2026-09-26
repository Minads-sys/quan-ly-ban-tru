@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo   🚀 Push GitHub + Deploy VPS (ban-tru)
echo ==========================================
echo.

REM ===== BƯỚC 1: PUSH LÊN GITHUB =====
echo [1/3] Đẩy code lên GitHub...
echo.

git add .

set /p msg="Nhập nội dung commit (Enter = auto): "
if "%msg%"=="" set msg=Update %date% %time%
git commit -m "%msg%"

git push origin main
if errorlevel 1 (
    echo.
    echo ❌ Push GitHub thất bại!
    pause
    exit /b 1
)

echo.
echo ✅ Push GitHub thành công!
echo.

REM ===== BƯỚC 2: DEPLOY LÊN VPS =====
echo [2/3] Deploy lên VPS...
echo.
echo 🔑 Sẽ yêu cầu mật khẩu VPS (hoặc tự động nếu đã cài SSH key)
echo.

ssh root@103.200.22.218 "cd /var/www/ban-tru && git pull origin main && npm ci --production=false && npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && cp .env.production .next/standalone/.env.production && pm2 restart ban-tru && echo '✅ Deploy VPS hoàn tất!'"

if errorlevel 1 (
    echo.
    echo ❌ Deploy VPS thất bại! Kiểm tra kết nối SSH.
    pause
    exit /b 1
)

REM ===== BƯỚC 3: KIỂM TRA =====
echo.
echo [3/3] Kiểm tra...
echo.
echo ✅ Hoàn tất! Truy cập: https://bantrutd.mindigi.vn
echo.
echo ==========================================
pause
