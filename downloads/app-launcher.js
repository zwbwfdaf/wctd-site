// 应用启动器 - 确保在桌面环境中正确加载
(function() {
    'use strict';
    
    // 检测运行环境
    const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
    const isDesktop = isElectron || window.navigator.userAgent.includes('Electron');
    
    // 桌面环境优化
    if (isDesktop) {
        // 禁用右键菜单（可选）
        document.addEventListener('contextmenu', function(e) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
        
        // 禁用文本选择（可选）
        document.addEventListener('selectstart', function(e) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
        
        // 禁用拖拽（安全考虑）
        document.addEventListener('dragover', function(e) {
            e.preventDefault();
        });
        
        document.addEventListener('drop', function(e) {
            e.preventDefault();
        });
        
        // 键盘快捷键处理
        document.addEventListener('keydown', function(e) {
            // 禁用 F5 刷新（让 Electron 菜单处理）
            if (e.key === 'F5') {
                e.preventDefault();
            }
            
            // 禁用 Ctrl+Shift+I 开发者工具（生产环境）
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault();
            }
        });
        
        // 设置应用标题
        if (document.title === 'KK搜索任务平台 - 文创推广平台') {
            document.title = '文创邦';
        }
    }
    
    // 应用初始化
    document.addEventListener('DOMContentLoaded', function() {
        // 添加桌面样式类
        if (isDesktop) {
            document.body.classList.add('desktop-app');
        }
        
        // 优化桌面体验的 CSS
        const desktopStyles = `
            .desktop-app {
                user-select: none;
                -webkit-user-select: none;
                -webkit-app-region: no-drag;
            }
            
            .desktop-app input,
            .desktop-app textarea,
            .desktop-app [contenteditable] {
                user-select: text;
                -webkit-user-select: text;
            }
            
            .desktop-app .draggable {
                -webkit-app-region: drag;
            }
            
            /* 滚动条样式优化 */
            .desktop-app ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            
            .desktop-app ::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }
            
            .desktop-app ::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;
            }
            
            .desktop-app ::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
        `;
        
        // 插入桌面优化样式
        if (isDesktop) {
            const styleElement = document.createElement('style');
            styleElement.textContent = desktopStyles;
            document.head.appendChild(styleElement);
        }
        
        console.log('应用启动器加载完成', { isElectron, isDesktop });
    });
    
})();




