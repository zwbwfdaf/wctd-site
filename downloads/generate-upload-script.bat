@echo off
echo ========================================
echo     Cloudflare 紧急修复文件上传脚本
echo ========================================
echo.
echo 本脚本将准备需要上传到 Cloudflare 的修复文件
echo.

:: 创建上传文件夹
if exist "cloudflare-emergency-upload" rmdir /s /q "cloudflare-emergency-upload"
mkdir "cloudflare-emergency-upload"

:: 复制必要的修复文件
echo 正在准备文件...
copy "emergency-database-fix.js" "cloudflare-emergency-upload\"
copy "index.html" "cloudflare-emergency-upload\"

:: 创建删除文件清单
echo 创建删除文件清单...
echo 以下文件需要从 Cloudflare 删除（已被替换）：> "cloudflare-emergency-upload\需要删除的文件.txt"
echo - supabase-loader.js>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo - database.js>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo - supabase-config.js>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo - supabase-wrapper.js>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo.>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo 新增文件：>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo + emergency-database-fix.js>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo.>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo 更新文件：>> "cloudflare-emergency-upload\需要删除的文件.txt"
echo * index.html>> "cloudflare-emergency-upload\需要删除的文件.txt"

:: 创建部署说明
echo 创建部署说明...
echo 🚨 紧急数据库修复 - 部署说明> "cloudflare-emergency-upload\部署说明.md"
echo.>> "cloudflare-emergency-upload\部署说明.md"
echo ## 修复内容>> "cloudflare-emergency-upload\部署说明.md"
echo 解决了 "Supabase SDK无法识别域名" 的错误>> "cloudflare-emergency-upload\部署说明.md"
echo.>> "cloudflare-emergency-upload\部署说明.md"
echo ## 部署步骤>> "cloudflare-emergency-upload\部署说明.md"
echo 1. 上传 emergency-database-fix.js>> "cloudflare-emergency-upload\部署说明.md"
echo 2. 上传 index.html（覆盖现有文件）>> "cloudflare-emergency-upload\部署说明.md"
echo 3. 删除以下旧文件：>> "cloudflare-emergency-upload\部署说明.md"
echo    - supabase-loader.js>> "cloudflare-emergency-upload\部署说明.md"
echo    - database.js>> "cloudflare-emergency-upload\部署说明.md"
echo    - supabase-config.js>> "cloudflare-emergency-upload\部署说明.md"
echo    - supabase-wrapper.js>> "cloudflare-emergency-upload\部署说明.md"
echo.>> "cloudflare-emergency-upload\部署说明.md"
echo ## 验证>> "cloudflare-emergency-upload\部署说明.md"
echo 部署后访问 wctd.xyz 应该不再看到数据库错误提示>> "cloudflare-emergency-upload\部署说明.md"

echo.
echo ✅ 文件准备完成！
echo.
echo 📁 上传文件夹: cloudflare-emergency-upload
echo 📝 包含文件:
echo    - emergency-database-fix.js
echo    - index.html  
echo    - 需要删除的文件.txt
echo    - 部署说明.md
echo.
echo 🚀 请将 cloudflare-emergency-upload 文件夹中的文件上传到 Cloudflare Pages
echo.
pause









































































