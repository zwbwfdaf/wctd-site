@echo off
echo ===============================================
echo          紧急更新 - 只上传修复文件
echo ===============================================
echo.

:: 创建紧急更新文件夹
if exist "emergency-update" rmdir /s /q "emergency-update"
mkdir "emergency-update"

echo 准备关键修复文件...

:: 复制关键修复文件
copy "minimal-upload\login.html" "emergency-update\"
copy "minimal-upload\mobile-login.html" "emergency-update\"
copy "minimal-upload\emergency-database-fix.js" "emergency-update\"
copy "minimal-upload\index.html" "emergency-update\"

echo.
echo ✅ 紧急更新包创建完成！
echo.
echo 📁 emergency-update 文件夹包含:
echo    - login.html (已修复)
echo    - mobile-login.html (新创建)
echo    - emergency-database-fix.js (数据库修复器)
echo    - index.html (主页)
echo.
echo ===============================================
echo            快速修复部署步骤
echo ===============================================
echo.
echo 🚨 方案1: 只更新修复文件 (推荐)
echo 1. 在Cloudflare Pages中找到这些文件:
echo    - login.html
echo    - emergency-database-fix.js
echo 2. 用 emergency-update 文件夹中的新文件替换
echo 3. 上传新的 mobile-login.html 文件
echo.
echo 🔄 方案2: 如果方案1不行，完全重新部署
echo 1. 删除Cloudflare中的所有文件
echo 2. 上传 minimal-upload 文件夹中的所有27个文件
echo.
echo ===============================================
echo               验证步骤
echo ===============================================
echo.
echo 上传完成后，访问:
echo https://wctd.xyz/mobile-login.html
echo.
echo 应该看到:
echo ✅ 不再有红色错误提示
echo ✅ 页面正常加载
echo ✅ 控制台显示数据库连接成功
echo.

:: 创建部署验证清单
echo 创建部署验证清单...
echo 🚨 紧急修复部署验证清单> "emergency-update\验证清单.txt"
echo.>> "emergency-update\验证清单.txt"
echo 修复内容：>> "emergency-update\验证清单.txt"
echo ✅ login.html 现在引用 emergency-database-fix.js>> "emergency-update\验证清单.txt"
echo ✅ mobile-login.html 已创建（与login.html相同）>> "emergency-update\验证清单.txt"
echo ✅ emergency-database-fix.js 包含多CDN自动切换>> "emergency-update\验证清单.txt"
echo.>> "emergency-update\验证清单.txt"
echo 验证步骤：>> "emergency-update\验证清单.txt"
echo 1. 访问 https://wctd.xyz/mobile-login.html>> "emergency-update\验证清单.txt"
echo 2. 检查是否还有"数据库组件加载失败"错误>> "emergency-update\验证清单.txt"
echo 3. 按F12查看控制台，应该看到：>> "emergency-update\验证清单.txt"
echo    "✅ Supabase SDK加载成功">> "emergency-update\验证清单.txt"
echo    "✅ 紧急数据库修复完成">> "emergency-update\验证清单.txt"
echo.>> "emergency-update\验证清单.txt"
echo 如果仍有问题：>> "emergency-update\验证清单.txt"
echo 1. 清除Cloudflare缓存>> "emergency-update\验证清单.txt"
echo 2. 在浏览器中按 Ctrl+Shift+R 强制刷新>> "emergency-update\验证清单.txt"
echo 3. 确认所有4个文件都已正确上传>> "emergency-update\验证清单.txt"

echo.
echo 🚀 请立即上传 emergency-update 文件夹中的4个文件！
echo.
pause









































































