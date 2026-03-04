@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo   Đẩy code lên GitHub
echo ==========================================
echo.

REM Kiểm tra git đã init chưa
if not exist ".git" (
    echo [1/5] Khởi tạo Git repository...
    git init
    git remote add origin https://github.com/Minads-sys/quan-ly-ban-tru.git
) else (
    echo [1/5] Git repository đã tồn tại.
)

REM Kiểm tra remote
git remote -v | findstr "origin" >nul 2>&1
if errorlevel 1 (
    git remote add origin https://github.com/Minads-sys/quan-ly-ban-tru.git
)

echo [2/5] Thêm tất cả thay đổi...
git add .

echo [3/5] Tạo commit...
set /p msg="Nhập nội dung commit (Enter = auto): "
if "%msg%"=="" set msg=Update %date% %time%
git commit -m "%msg%"

echo [4/5] Đẩy lên GitHub (branch main)...
git push -u origin main

if errorlevel 1 (
    echo.
    echo [!] Push thất bại. Thử push branch master...
    git push -u origin master
)

echo.
echo [5/5] ✅ Hoàn thành!
echo ==========================================
pause
