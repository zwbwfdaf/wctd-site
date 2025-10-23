@echo off
chcp 65001 >nul
echo =====================================================
echo        清理项目多余文件 - 保留核心网站文件
echo =====================================================
echo.

echo 🗑️ 开始删除多余文件...
echo.

REM 删除所有.bat脚本文件（除了当前这个）
echo [1/10] 删除脚本文件...
del /q *.bat 2>nul
del /q 清理项目文件.bat 2>nul

REM 删除所有.md文档文件
echo [2/10] 删除文档文件...
del /q *.md 2>nul

REM 删除测试文件
echo [3/10] 删除测试文件...
del /q test-*.html 2>nul
del /q *test*.html 2>nul
del /q *-test.html 2>nul

REM 删除调试文件
echo [4/10] 删除调试文件...
del /q debug-*.html 2>nul
del /q *debug*.html 2>nul
del /q diagnose-*.html 2>nul

REM 删除修复文件
echo [5/10] 删除修复文件...
del /q fix-*.html 2>nul
del /q *fix*.html 2>nul
del /q final-*.html 2>nul
del /q verify-*.html 2>nul
del /q quick-*.html 2>nul
del /q urgent-*.html 2>nul

REM 删除其他临时/开发文件
echo [6/10] 删除开发文件...
del /q comprehensive-*.html 2>nul
del /q cross-browser-*.html 2>nul
del /q reliable-*.html 2>nul
del /q one-click-*.html 2>nul
del /q ultra-simple-*.html 2>nul

REM 删除各种.js修复文件
echo [7/10] 删除修复脚本...
del /q *-fix.js 2>nul
del /q *fix*.js 2>nul
del /q comprehensive-*.js 2>nul
del /q instant-*.js 2>nul
del /q network-*.js 2>nul
del /q persistent-*.js 2>nul
del /q smart-*.js 2>nul
del /q ultra-*.js 2>nul
del /q ultimate-*.js 2>nul
del /q username-*.js 2>nul
del /q enhanced-*.js 2>nul
del /q optimized-*.js 2>nul
del /q clean-*.js 2>nul
del /q component-*.js 2>nul
del /q console-*.js 2>nul
del /q data-*.js 2>nul
del /q database-*-fix.js 2>nul
del /q earnings-*.js 2>nul
del /q fast-*.js 2>nul
del /q force-*.js 2>nul
del /q keyword-*.js 2>nul
del /q login-status-*.js 2>nul
del /q offline-*.js 2>nul
del /q page-*.js 2>nul
del /q quick-*.js 2>nul
del /q real-*.js 2>nul
del /q safe-*.js 2>nul
del /q update-*.js 2>nul
del /q create-*.js 2>nul
del /q ensure-*.js 2>nul

REM 删除SQL文件
echo [8/10] 删除SQL文件...
del /q *.sql 2>nul

REM 删除多余的子文件夹
echo [9/10] 删除多余文件夹...
rd /s /q "cloudflare-upload" 2>nul
rd /s /q "clean-website" 2>nul
rd /s /q "minimal-fix" 2>nul
rd /s /q "ultra-clean" 2>nul
rd /s /q "WCTD-Mobile-Deploy" 2>nul
rd /s /q "WCTD-Desktop-Deploy" 2>nul
rd /s /q "MobileApp-Package" 2>nul
rd /s /q "Simple-Mobile-App" 2>nul
rd /s /q "手机应用" 2>nul
rd /s /q "APK下载页面" 2>nul

REM 删除其他开发相关文件
echo [10/10] 删除其他文件...
del /q electron-main.js 2>nul
del /q build-*.* 2>nul
del /q create-*.* 2>nul
del /q deploy-*.* 2>nul
del /q portable-*.* 2>nul
del /q simple-*.* 2>nul
del /q web-app-*.* 2>nul

echo.
echo ✅ 清理完成！
echo.
echo 📊 剩余文件统计：
for /f %%i in ('dir /a-d /b ^| find /c /v ""') do echo 文件数量：%%i 个

echo.
echo 📁 保留的核心文件：
echo ==========================================
echo.
echo 🌐 HTML页面：
dir /b *.html 2>nul
echo.
echo 📜 脚本文件：
dir /b *.js 2>nul
echo.
echo 🎨 样式文件：
dir /b *.css 2>nul
echo.
echo 📋 配置文件：
dir /b *.json 2>nul
echo.

echo 🎯 现在可以直接上传整个项目文件夹了！
echo.
echo 💡 上传提示：
echo   - 文件数量应该在 50 个以内
echo   - 包含修复后的 supabase-loader.js 和 database.js
echo   - 保留了所有核心功能页面
echo.
pause










































































