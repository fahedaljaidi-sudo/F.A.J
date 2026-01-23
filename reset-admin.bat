@echo off
echo ====================================
echo تحديث كلمة مرور المدير - FAJ Security
echo ====================================
echo.

cd /d "%~dp0"

echo [1/3] التحقق من Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo خطأ: Node.js غير مثبت!
    echo الرجاء تثبيت Node.js من: https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] تثبيت المتطلبات...
cd backend
call npm install --no-save bcryptjs sql.js 2>nul

echo [3/3] تحديث كلمة مرور المدير...
node database/reset-admin-now.js

echo.
echo ====================================
echo تم الانتهاء!
echo ====================================
echo.
echo الآن ارفع قاعدة البيانات المحدثة إلى Railway:
echo 1. اذهب إلى Railway Dashboard
echo 2. Settings -^> Volumes
echo 3. ارفع ملف: backend/database/security.db
echo.
pause
