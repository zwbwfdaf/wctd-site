@echo off
echo ===============================================
echo         强制清除缓存并验证部署状态
echo ===============================================
echo.

echo 正在生成缓存清除URL...

:: 生成带时间戳的测试URL
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list ^| find "="') do set datetime=%%I
set timestamp=%datetime:~0,14%

echo.
echo 请用这些URL测试（绕过缓存）：
echo.
echo 1. 主页测试:
echo    https://wctd.xyz/?v=%timestamp%^&cache=bypass
echo.
echo 2. 紧急修复文件测试:
echo    https://wctd.xyz/emergency-database-fix.js?v=%timestamp%
echo.
echo 3. 登录页面测试:
echo    https://wctd.xyz/mobile-login.html?v=%timestamp%^&cache=bypass
echo.
echo 4. 缓存绕过测试工具:
echo    https://wctd.xyz/test-cache-bypass.html?v=%timestamp%
echo.

echo ===============================================
echo            Cloudflare 缓存清除步骤
echo ===============================================
echo.
echo 如果文件已上传但仍有问题，请手动清除缓存：
echo.
echo 1. 登录 Cloudflare Dashboard
echo 2. 选择你的域名 (wctd.xyz)
echo 3. 点击左侧 "缓存" 或 "Caching"
echo 4. 点击 "清除缓存" 或 "Purge Cache"  
echo 5. 选择 "清除所有内容" 或 "Purge Everything"
echo 6. 确认清除
echo.
echo 缓存清除后等待 1-2 分钟再测试
echo.

echo ===============================================
echo              紧急手动修复方法
echo ===============================================
echo.
echo 如果上述方法都无效，可以尝试：
echo.
echo 1. 直接在浏览器地址栏输入：
echo    javascript:location.reload(true);
echo.
echo 2. 按 Ctrl+Shift+R (强制刷新)
echo.
echo 3. 清除浏览器缓存：
echo    - Chrome: Ctrl+Shift+Delete
echo    - 选择 "缓存的图片和文件"
echo    - 点击 "清除数据"
echo.

pause









































































