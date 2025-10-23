@echo off
echo ================================================
echo      创建最小化Cloudflare上传包
echo ================================================
echo.
echo 正在创建只包含必要文件的上传包...
echo.

:: 删除旧的上传文件夹
if exist "minimal-upload" rmdir /s /q "minimal-upload"
mkdir "minimal-upload"

:: 只复制必要的核心文件
echo 复制核心文件...
copy "index.html" "minimal-upload\"
copy "emergency-database-fix.js" "minimal-upload\"
copy "styles.css" "minimal-upload\"
copy "app-launcher.js" "minimal-upload\"
copy "realtime.js" "minimal-upload\"

:: 复制HTML页面
echo 复制页面文件...
copy "login.html" "minimal-upload\" 2>nul
copy "mobile-login.html" "minimal-upload\" 2>nul
copy "profile.html" "minimal-upload\" 2>nul
copy "my-tasks.html" "minimal-upload\" 2>nul
copy "my-wallet.html" "minimal-upload\" 2>nul
copy "admin-dashboard.html" "minimal-upload\" 2>nul
copy "ranking.html" "minimal-upload\" 2>nul
copy "my-keywords.html" "minimal-upload\" 2>nul
copy "income.html" "minimal-upload\" 2>nul
copy "withdrawal.html" "minimal-upload\" 2>nul
copy "help-feedback.html" "minimal-upload\" 2>nul
copy "security-center.html" "minimal-upload\" 2>nul
copy "account-settings.html" "minimal-upload\" 2>nul

:: 复制必要的JS文件
echo 复制JavaScript文件...
copy "script.js" "minimal-upload\" 2>nul
copy "admin-script.js" "minimal-upload\" 2>nul
copy "mobile-interactions.js" "minimal-upload\" 2>nul
copy "ranking-data.js" "minimal-upload\" 2>nul

:: 复制CSS文件  
echo 复制CSS文件...
copy "admin-styles.css" "minimal-upload\" 2>nul
copy "mobile-optimizations.css" "minimal-upload\" 2>nul

:: 复制移动应用相关文件
echo 复制移动应用文件...
copy "mobile-manifest.json" "minimal-upload\" 2>nul
copy "mobile-sw.js" "minimal-upload\" 2>nul

:: 创建部署说明
echo 创建部署说明...
echo 🚨 最小化紧急修复包 - 部署说明> "minimal-upload\部署说明.txt"
echo.>> "minimal-upload\部署说明.txt"
echo 此包只包含网站运行必需的文件>> "minimal-upload\部署说明.txt"
echo.>> "minimal-upload\部署说明.txt"
echo 部署方式：>> "minimal-upload\部署说明.txt"
echo 1. 删除Cloudflare Pages中的所有现有文件>> "minimal-upload\部署说明.txt"
echo 2. 上传此文件夹中的所有文件>> "minimal-upload\部署说明.txt"
echo 3. 确认 emergency-database-fix.js 已上传>> "minimal-upload\部署说明.txt"
echo 4. 等待2-3分钟让CDN刷新>> "minimal-upload\部署说明.txt"
echo.>> "minimal-upload\部署说明.txt"
echo 关键修复文件：>> "minimal-upload\部署说明.txt"
echo - emergency-database-fix.js (新的数据库连接器)>> "minimal-upload\部署说明.txt"
echo - index.html (已更新脚本引用)>> "minimal-upload\部署说明.txt"

:: 统计文件数量
for /f %%i in ('dir /b "minimal-upload" ^| find /c /v ""') do set filecount=%%i

echo.
echo ✅ 最小化上传包创建完成！
echo.
echo 📁 文件夹: minimal-upload
echo 📊 文件数量: %filecount% 个文件
echo.
echo ⚠️  重要说明:
echo    此包只包含网站核心功能文件
echo    上传后网站应该能正常运行
echo    如有缺失功能，可以后续补充
echo.

:: 列出所有文件
echo 📋 包含文件列表:
dir /b "minimal-upload"

echo.
echo ================================================
echo           立即部署步骤
echo ================================================
echo.
echo 1. 在Cloudflare Pages中清空所有现有文件
echo 2. 将 minimal-upload 文件夹中的所有文件上传
echo 3. 等待部署完成（2-3分钟）
echo 4. 访问 wctd.xyz 验证修复效果
echo.
pause









































































