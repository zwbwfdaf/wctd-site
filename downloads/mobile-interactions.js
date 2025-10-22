/**
 * 移动端交互优化脚本
 * 提供触摸反馈、平滑过渡和性能优化
 */

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面过渡动画
    initPageTransition();
    
    // 初始化涟漪效果
    initRippleEffect();
    
    // 初始化Toast提示功能
    initToastMessage();
    
    // 优化返回按钮行为
    optimizeBackButton();
    
    // 初始化表单优化
    enhanceFormElements();
    
    // 初始化加载指示器
    initLoadingIndicator();
    
    // 初始化滚动优化
    enhanceScrolling();
    // 提供全局启用下拉刷新与懒加载工具
    try{ window.enablePullToRefresh = enablePullToRefresh; }catch(_){ }
    try{ window.lazyLoadImages = lazyLoadImages; }catch(_){ }
    
    console.log('移动端优化初始化完成');
});

/**
 * 初始化页面过渡动画
 */
function initPageTransition() {
    // 为主内容区域添加过渡动画类
    const mainContent = document.querySelector('main') || document.querySelector('.container') || document.body;
    if (mainContent) {
        mainContent.classList.add('page-transition');
    }
    
    // 优化页面链接跳转
    document.querySelectorAll('a[href]:not([target="_blank"])').forEach(link => {
        link.addEventListener('click', function(e) {
            // 仅处理同域链接
            if (this.hostname === window.location.hostname) {
                e.preventDefault();
                
                // 保存链接地址
                const href = this.getAttribute('href');
                
                // 添加页面淡出效果
                document.body.style.opacity = '0.8';
                document.body.style.transition = 'opacity 0.3s';
                
                // 延迟跳转以显示过渡动画
                setTimeout(() => {
                    window.location.href = href;
                }, 300);
            }
        });
    });
}

/**
 * 初始化涟漪效果
 */
function initRippleEffect() {
    // 为所有按钮添加涟漪效果
    const buttons = document.querySelectorAll('button, .btn, [role="button"], .menu-item, .tab, .setting-item, .option-button, .filter-button, .action-button');
    
    buttons.forEach(button => {
        button.addEventListener('touchstart', createRipple);
        button.addEventListener('mousedown', createRipple);
    });
    
    function createRipple(e) {
        // 防止事件冲突
        e.stopPropagation();
        
        // 获取按钮尺寸和位置
        const button = this;
        const rect = button.getBoundingClientRect();
        
        // 计算涟漪位置
        let x, y;
        if (e.type === 'touchstart' && e.touches[0]) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        
        // 创建涟漪元素
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        // 添加到按钮并在动画结束后移除
        button.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple && ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }
}

/**
 * 初始化Toast提示功能
 */
function initToastMessage() {
    // 检查是否已存在Toast容器
    let toastContainer = document.querySelector('.toast-container');
    
    // 如果不存在，创建一个
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        
        const toastMessage = document.createElement('div');
        toastMessage.className = 'toast-message';
        toastMessage.id = 'toastMessage';
        
        toastContainer.appendChild(toastMessage);
        document.body.appendChild(toastContainer);
    }
    
    // 添加全局Toast显示函数
    window.showToast = function(message, duration = 2000) {
        const toast = document.getElementById('toastMessage');
        if (!toast) return;
        
        // 清除之前的定时器
        if (window.toastTimer) {
            clearTimeout(window.toastTimer);
        }
        
        // 设置消息并显示
        toast.textContent = message;
        toast.classList.add('show');
        
        // 设置自动隐藏
        window.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    };
}

/**
 * 优化返回按钮行为
 */
function optimizeBackButton() {
    const backButtons = document.querySelectorAll('.nav-button, [onclick*="history.back"]');
    
    backButtons.forEach(button => {
        // 移除旧的点击事件
        const oldOnClick = button.onclick;
        button.onclick = null;
        
        // 添加新的点击事件
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 显示按钮点击效果
            this.style.transform = 'scale(0.9)';
            
            // 短暂延迟后恢复按钮样式并执行返回
            setTimeout(() => {
                this.style.transform = '';
                history.back();
            }, 150);
        });
    });
}

/**
 * 增强表单元素交互体验
 */
function enhanceFormElements() {
    // 优化输入框交互
    const inputFields = document.querySelectorAll('input, textarea, select');
    
    inputFields.forEach(input => {
        // 聚焦时添加特殊效果
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('input-focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('input-focused');
        });
        
        // 对于密码输入框，优化显示/隐藏功能
        if (input.type === 'password') {
            const toggleButtons = document.querySelectorAll('.toggle-password');
            toggleButtons.forEach(button => {
                button.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    const targetId = this.getAttribute('data-target');
                    const inputField = document.getElementById(targetId);
                    
                    if (inputField) {
                        if (inputField.type === 'password') {
                            inputField.type = 'text';
                            this.classList.remove('fa-eye-slash');
                            this.classList.add('fa-eye');
                        } else {
                            inputField.type = 'password';
                            this.classList.remove('fa-eye');
                            this.classList.add('fa-eye-slash');
                        }
                    }
                });
            });
        }
    });
}

/**
 * 空的加载指示器函数（已禁用）
 */
function initLoadingIndicator() {
    // 空函数，不创建加载指示器
    
    // 添加空的全局显示/隐藏加载的函数
    window.showLoading = function() {
        // 什么也不做
    };
    
    window.hideLoading = function() {
        // 什么也不做
    };
}

/**
 * 增强滚动体验
 */
function enhanceScrolling() {
    // 将滚动容器添加平滑滚动属性
    const scrollContainers = document.querySelectorAll('.modal-body, .scroll-container, .overflow-auto, .overflow-y-auto');
    
    scrollContainers.forEach(container => {
        if (container) {
            container.classList.add('scroll-container');
            container.style.webkitOverflowScrolling = 'touch';
        }
    });
    
    // 防止过度滚动回弹
    document.body.style.overscrollBehavior = 'none';
}

/**
 * 启用原生下拉刷新（不阻塞页面滚动）
 * @param {Object} opt { onRefresh: Function, threshold?: number, maxPull?: number }
 */
function enablePullToRefresh(opt){
    try{
        const options = Object.assign({ threshold: 70, maxPull: 120 }, opt||{});
        let startY=0, pulling=false, locked=false, last=0;
        let indicator=document.getElementById('__ptr');
        if(!indicator){
            indicator=document.createElement('div');
            indicator.id='__ptr';
            indicator.className='ptr-indicator';
            indicator.innerHTML='<div class="ptr-spinner"></div><span>下拉刷新</span>';
            document.body.appendChild(indicator);
        }
        function setIndicator(show, text){
            if(!indicator) return; indicator.classList.toggle('show', !!show); if(text){ indicator.querySelector('span').textContent=text; }
        }
        window.addEventListener('touchstart', e=>{
            if(window.scrollY>0 || locked) return; pulling=true; startY=e.touches[0].clientY; last=startY; setIndicator(false);
        }, {passive:true});
        window.addEventListener('touchmove', e=>{
            if(!pulling || locked) return; const y=e.touches[0].clientY; const dy=y-startY; last=y;
            if(dy>0 && window.scrollY<=0){ e.preventDefault?.(); const pull=Math.min(dy, options.maxPull); document.body.style.transform=`translateY(${pull}px)`; setIndicator(true, pull>options.threshold? '松开刷新' : '下拉刷新'); }
        }, {passive:false});
        async function finish(){ try{ document.body.style.transition='transform .2s ease'; document.body.style.transform='translateY(0)'; setTimeout(()=>{ document.body.style.transition=''; setIndicator(false); locked=false; }, 200);}catch(_){ locked=false; } }
        window.addEventListener('touchend', async()=>{
            if(!pulling || locked) return; pulling=false; const dy=last-startY; if(dy>options.threshold && typeof options.onRefresh==='function'){ locked=true; setIndicator(true, '刷新中...'); try{ await options.onRefresh(); }catch(_){ } finally{ finish(); } } else { finish(); }
        });
    }catch(e){ console.warn('enablePullToRefresh error', e); }
}

/**
 * 懒加载页面图片：<img data-src="...">
 */
function lazyLoadImages(){
    try{
        const imgs=[...document.querySelectorAll('img[data-src]')];
        if('IntersectionObserver' in window){
            const ob=new IntersectionObserver(entries=>{
                entries.forEach(en=>{
                    if(en.isIntersecting){ const el=en.target; el.src=el.getAttribute('data-src'); el.removeAttribute('data-src'); ob.unobserve(el); }
                });
            },{ rootMargin: '100px' });
            imgs.forEach(img=> ob.observe(img));
        }else{
            // 兜底：首屏与滚动时尝试加载
            const loadVisible=()=>{
                imgs.forEach(img=>{ if(img.getBoundingClientRect().top < window.innerHeight + 100){ img.src=img.getAttribute('data-src'); img.removeAttribute('data-src'); } });
            };
            loadVisible(); window.addEventListener('scroll', loadVisible, {passive:true});
        }
    }catch(e){ console.warn('lazyLoadImages error', e); }
}

/**
 * 初始化标签切换功能
 * @param {string} tabContainerSelector 标签容器选择器
 * @param {string} contentContainerSelector 内容容器选择器
 */
function initTabSwitching(tabContainerSelector, contentContainerSelector) {
    const tabContainer = document.querySelector(tabContainerSelector);
    if (!tabContainer) return;
    
    const tabs = tabContainer.querySelectorAll('[role="tab"]');
    const contentContainer = document.querySelector(contentContainerSelector);
    
    if (!contentContainer) return;
    
    const contents = contentContainer.querySelectorAll('[role="tabpanel"]');
    
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', function() {
            // 移除所有标签的活动状态
            tabs.forEach(t => t.classList.remove('tab-active'));
            
            // 添加当前标签的活动状态
            this.classList.add('tab-active');
            
            // 隐藏所有内容
            contents.forEach(c => c.classList.add('hidden'));
            
            // 显示对应的内容
            if (contents[index]) {
                contents[index].classList.remove('hidden');
                contents[index].classList.add('page-transition');
            }
        });
    });
}