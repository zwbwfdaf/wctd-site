// 移动端优化脚本
(function() {
    'use strict';
    
    console.log('📱 初始化移动端优化...');
    
    // 检测移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /iPad|Android(?=.*Tablet)|tablet/i.test(navigator.userAgent);
    const isPhone = isMobile && !isTablet;
    
    // PWA安装检测
    let deferredPrompt;
    let isInstalled = false;
    
    // 检查是否已安装
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        isInstalled = true;
        console.log('✅ PWA已安装');
    }
    
    // PWA安装提示
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('📲 PWA安装提示就绪');
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });
    
    // 安装完成事件
    window.addEventListener('appinstalled', (evt) => {
        console.log('🎉 PWA安装成功');
        isInstalled = true;
        hideInstallButton();
        showInstallSuccessMessage();
    });
    
    // 注册Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('./mobile-sw.js')
                .then(function(registration) {
                    console.log('✅ Service Worker 注册成功:', registration.scope);
                    
                    // 检查更新
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateAvailable();
                            }
                        });
                    });
                })
                .catch(function(error) {
                    console.log('❌ Service Worker 注册失败:', error);
                });
        });
    }
    
    // 移动端UI优化
    function optimizeMobileUI() {
        // 添加移动端样式类
        document.body.classList.add('mobile-optimized');
        
        if (isPhone) {
            document.body.classList.add('mobile-phone');
        } else if (isTablet) {
            document.body.classList.add('mobile-tablet');
        }
        
        // 动态添加移动端优化CSS
        const mobileStyles = `
            <style id="mobile-optimization">
                @media (max-width: 768px) {
                    .mobile-optimized {
                        overflow-x: hidden;
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    /* 触摸优化 */
                    .mobile-optimized button,
                    .mobile-optimized .btn {
                        min-height: 44px;
                        min-width: 44px;
                        padding: 12px 16px;
                    }
                    
                    /* 输入框优化 */
                    .mobile-optimized input,
                    .mobile-optimized textarea {
                        font-size: 16px !important; /* 防止iOS缩放 */
                        padding: 12px;
                    }
                    
                    /* 导航优化 */
                    .mobile-optimized .nav {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        z-index: 1000;
                        background: white;
                        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                    }
                    
                    /* 滚动优化 */
                    .mobile-optimized .scroll-container {
                        -webkit-overflow-scrolling: touch;
                        scroll-behavior: smooth;
                    }
                    
                    /* 图片优化 */
                    .mobile-optimized img {
                        max-width: 100%;
                        height: auto;
                    }
                    
                    /* 表格优化 */
                    .mobile-optimized table {
                        overflow-x: auto;
                        display: block;
                        white-space: nowrap;
                    }
                }
                
                /* 安装按钮样式 */
                .install-button {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 25px;
                    padding: 10px 20px;
                    font-size: 14px;
                    z-index: 10000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                
                /* 更新提示 */
                .update-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #ff9500;
                    color: white;
                    text-align: center;
                    padding: 10px;
                    z-index: 10001;
                    font-size: 14px;
                }
                
                /* 离线提示 */
                .offline-banner {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: #ff4444;
                    color: white;
                    text-align: center;
                    padding: 10px;
                    z-index: 10001;
                    font-size: 14px;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', mobileStyles);
    }
    
    // 显示安装按钮
    function showInstallButton() {
        if (isInstalled) return;
        
        const installBtn = document.createElement('button');
        installBtn.className = 'install-button';
        installBtn.innerHTML = '📲 安装应用';
        installBtn.id = 'pwa-install-btn';
        
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('✅ 用户接受安装');
                } else {
                    console.log('❌ 用户拒绝安装');
                }
                
                deferredPrompt = null;
                hideInstallButton();
            }
        });
        
        document.body.appendChild(installBtn);
    }
    
    // 隐藏安装按钮
    function hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.remove();
        }
    }
    
    // 显示安装成功消息
    function showInstallSuccessMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #4CAF50;
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 10002;
            text-align: center;
            font-size: 16px;
            max-width: 80%;
        `;
        message.innerHTML = `
            <div>🎉 应用安装成功！</div>
            <div style="margin-top: 10px; font-size: 14px;">现在可以从桌面直接启动应用</div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    }
    
    // 显示更新可用提示
    function showUpdateAvailable() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            🔄 新版本可用 
            <button onclick="location.reload()" style="background: white; color: #ff9500; border: none; padding: 5px 10px; border-radius: 5px; margin-left: 10px;">
                立即更新
            </button>
        `;
        
        document.body.appendChild(updateBanner);
    }
    
    // 网络状态监控
    function setupNetworkMonitoring() {
        let offlineBanner;
        
        function showOfflineBanner() {
            if (offlineBanner) return;
            
            offlineBanner = document.createElement('div');
            offlineBanner.className = 'offline-banner';
            offlineBanner.innerHTML = '📡 网络连接已断开，正在使用离线模式';
            document.body.appendChild(offlineBanner);
        }
        
        function hideOfflineBanner() {
            if (offlineBanner) {
                offlineBanner.remove();
                offlineBanner = null;
            }
        }
        
        window.addEventListener('online', () => {
            console.log('🌐 网络已连接');
            hideOfflineBanner();
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 网络已断开');
            showOfflineBanner();
        });
        
        // 初始检查
        if (!navigator.onLine) {
            showOfflineBanner();
        }
    }
    
    // 触摸手势优化
    function setupTouchOptimization() {
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function (event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 优化滚动
        document.addEventListener('touchmove', function(e) {
            if (e.target.closest('.scroll-container')) {
                return;
            }
        }, { passive: true });
    }
    
    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        if (isMobile) {
            optimizeMobileUI();
            setupNetworkMonitoring();
            setupTouchOptimization();
            
            // 延迟显示安装提示
            setTimeout(() => {
                if (!isInstalled && deferredPrompt) {
                    showInstallButton();
                }
            }, 3000);
        }
        
        console.log('✅ 移动端优化完成', {
            isMobile,
            isTablet,
            isPhone,
            isInstalled
        });
    });
    
    // 导出全局函数
    window.MobileOptimizer = {
        isMobile,
        isTablet,
        isPhone,
        isInstalled,
        showInstallButton,
        hideInstallButton
    };
    
})();


















































































