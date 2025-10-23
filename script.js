// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成');
    
    // 确保弹窗初始状态为隐藏
    const modal = document.getElementById('task-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('show');
        console.log('弹窗初始化为隐藏状态');
    }
    
    // ... existing code ...
    // 分类按钮切换
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 移除所有按钮的active类
            categoryBtns.forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
            categoryBtns.forEach(b => b.classList.add('bg-white', 'text-gray-700'));

            // 为当前点击的按钮添加active类
            this.classList.add('active', 'bg-blue-600', 'text-white');
            this.classList.remove('bg-white', 'text-gray-700');

            // 模拟加载数据
            loadTasks(this.textContent.trim());
        });
    });

    // 项目推荐轮播功能
    const projectSlider = document.getElementById('project-slider');
    let currentProjectSlide = 0;
    const projectSlideCount = 2; // 直接设置轮播项数量，不再依赖指示器
    const projectSlideInterval = 4000; // 4秒切换一次
    let projectStartX, projectMoveX;
    let projectIsDragging = false;

    // 显示指定索引的项目幻灯片
    function showProjectSlide(index) {
        currentProjectSlide = index;
        projectSlider.style.transform = `translateX(-${index * 100}%)`;
        
        // 更新指示器
        document.querySelectorAll('[id^="project-indicator-"]').forEach((indicator, i) => {
            if (i === index) {
                indicator.classList.remove('bg-gray-300');
                indicator.classList.add('bg-blue-500');
            } else {
                indicator.classList.remove('bg-blue-500');
                indicator.classList.add('bg-gray-300');
            }
        });
    }

    // 左右滑动控制函数
    function moveProjectCarousel(direction) {
        clearInterval(projectTimer);
        if (direction === 'next') {
            currentProjectSlide = (currentProjectSlide + 1) % projectSlideCount;
        } else {
            currentProjectSlide = (currentProjectSlide - 1 + projectSlideCount) % projectSlideCount;
        }
        showProjectSlide(currentProjectSlide);
        
        // 重新启动自动轮播
        projectTimer = setInterval(nextProjectSlide, projectSlideInterval);
    }
    
    // 全局化函数，供按钮调用
    window.moveProjectCarousel = moveProjectCarousel;

    // 下一张项目幻灯片
    function nextProjectSlide() {
        moveProjectCarousel('next');
    }

    // 设置自动项目轮播计时器
    let projectTimer = setInterval(nextProjectSlide, projectSlideInterval);

    // 项目轮播鼠标悬停时暂停轮播
    const projectCarousel = document.getElementById('project-carousel');
    if (projectCarousel) {
        // 鼠标悬停/离开控制
        projectCarousel.addEventListener('mouseenter', () => {
            clearInterval(projectTimer);
        });

        projectCarousel.addEventListener('mouseleave', () => {
            projectTimer = setInterval(nextProjectSlide, projectSlideInterval);
        });

        // 触摸事件 - 开始
        projectCarousel.addEventListener('touchstart', (e) => {
            projectStartX = e.touches[0].clientX;
            projectIsDragging = true;
            clearInterval(projectTimer); // 触摸开始时暂停自动轮播
        });

        // 触摸事件 - 移动
        projectCarousel.addEventListener('touchmove', (e) => {
            if (!projectIsDragging) return;
            projectMoveX = e.touches[0].clientX;
        });

        // 触摸事件 - 结束
        projectCarousel.addEventListener('touchend', () => {
            if (!projectIsDragging) return;
            projectIsDragging = false;

            // 计算滑动距离，判断是左滑还是右滑
            const diff = projectStartX - projectMoveX;
            const minSwipeDistance = 50; // 最小滑动距离

            if (diff > minSwipeDistance) {
                // 左滑 - 下一张
                nextProjectSlide();
            } else if (diff < -minSwipeDistance) {
                // 右滑 - 上一张
                currentProjectSlide = (currentProjectSlide - 1 + projectSlideCount) % projectSlideCount;
                showProjectSlide(currentProjectSlide);
            }

            // 恢复自动轮播
            projectTimer = setInterval(nextProjectSlide, projectSlideInterval);
        });
    }

    // 轮播功能
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;
    const slideInterval = 3000; // 3秒切换一次
    let startX, moveX;
    let isDragging = false;

    // 显示指定索引的幻灯片
    function showSlide(index) {
        // 隐藏所有幻灯片
        slides.forEach(slide => {
            slide.style.opacity = '0';
        });
        // 显示当前幻灯片
        slides[index].style.opacity = '1';
    }

    // 下一张幻灯片
    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    // 上一张幻灯片
    function prevSlide() {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
    }

    // 设置自动轮播计时器
    let timer = setInterval(nextSlide, slideInterval);

    // 鼠标悬停时暂停轮播
    const carousel = document.getElementById('banner-carousel');
    if (carousel) {
        // 鼠标悬停/离开控制
        carousel.addEventListener('mouseenter', () => {
            clearInterval(timer);
        });

        carousel.addEventListener('mouseleave', () => {
            timer = setInterval(nextSlide, slideInterval);
        });

        // 触摸事件 - 开始
        carousel.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            clearInterval(timer); // 触摸开始时暂停自动轮播
        });

        // 触摸事件 - 移动
        carousel.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            moveX = e.touches[0].clientX;
        });

        // 触摸事件 - 结束
        carousel.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;

            // 计算滑动距离，判断是左滑还是右滑
            const diff = startX - moveX;
            const minSwipeDistance = 50; // 最小滑动距离

            if (diff > minSwipeDistance) {
                // 左滑 - 下一张
                nextSlide();
            } else if (diff < -minSwipeDistance) {
                // 右滑 - 上一张
                prevSlide();
            }

            // 恢复自动轮播
            timer = setInterval(nextSlide, slideInterval);
        });
    }

    // 模拟加载任务数据
function loadTasks(category) {
    // 显示加载状态
    const taskGrid = document.querySelector('.grid');
    taskGrid.innerHTML = '<div class="col-span-full flex justify-center py-10"><div class="loading-spinner"></div></div>';

    // 模拟网络延迟
    setTimeout(() => {
        // 根据分类加载不同的任务数据
        let tasks = [];
        if (category === '全部任务') {
            tasks = generateAllTasks();
        } else if (category === '资源推广') {
            tasks = generateResourceTasks();
        } else if (category === '网盘推广') {
            tasks = generateDramaTasks();
        } else if (category === '小说推广') {
            tasks = generateNovelTasks();
        } else if (category === '工具推广') {
            tasks = generateToolTasks();
        } else if (category === '游戏推广') {
            tasks = generateGameTasks();
        }

        // 渲染任务卡片
        renderTasks(tasks);

        // 添加任务卡片点击事件
        addTaskCardEvents();
    }, 800);
}

    // 生成任务卡片HTML
    function renderTasks(tasks) {
        const taskGrid = document.querySelector('.grid');
        taskGrid.innerHTML = '';

        if (tasks.length === 0) {
            taskGrid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">暂无任务</div>';
            return;
        }

        tasks.forEach(task => {
            const taskCard = document.createElement('div');
            taskCard.className = 'bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-300 task-card cursor-pointer';
            taskCard.dataset.taskId = task.id || task.title.replace(/\s+/g, '-').toLowerCase();
            taskCard.innerHTML = `
                <div class="p-1">
                    <div class="flex items-center mb-0">
                        ${task.imageUrl ? `<div class="w-5 h-5 rounded-md overflow-hidden mr-1">
                            <img src="${task.imageUrl}" alt="${task.title}" class="w-full h-full object-cover" />
                        </div>` : `<div class="w-5 h-5 rounded-md ${task.iconBg} flex items-center justify-center mr-1">
                            <i class="${task.iconClass} ${task.iconColor}" style="font-size: 8px;"></i>
                        </div>`}
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-gray-800 truncate leading-none" style="font-size: 9px;">${task.title}</h3>
                            <p class="text-gray-500 truncate leading-none" style="font-size: 8px;">${task.description}</p>
                        </div>
                    </div>
                    <div class="flex items-center justify-between mt-0.5">
                        <span class="text-gray-500" style="font-size: 7px;">最高收益</span>
                        <div class="font-bold text-red-600" style="font-size: 8px;">¥${task.reward}</div>
                    </div>
                </div>
            `;
            taskGrid.appendChild(taskCard);
        });
    }

    // 添加任务卡片点击事件
    function addTaskCardEvents() {
        const taskCards = document.querySelectorAll('.task-card');
        taskCards.forEach(card => {
            card.addEventListener('click', function() {
                // 获取任务标题
                const taskTitle = card.querySelector('h3').textContent.trim();
                const taskId = card.dataset.taskId;
                
                // 检查任务类型并执行相应操作
                if (taskTitle === 'kk搜索') {
                    // 直接跳转到kk搜索任务详情页
                    window.location.href = 'quark-search-task.html';
                } else if (taskTitle === 'kk网盘') {
                    // 直接跳转到kk网盘任务详情页
                    window.location.href = 'quark-cloud-drive-task.html';
                } else {
                    // 其他任务显示提示消息
                    showToast(`已选择${taskTitle}任务，即将跳转到任务详情页`);
                }
            });
        });
    }

    // 显示任务详情弹出界面
    function showTaskDetailModal() {
        const modal = document.getElementById('task-detail-modal');
        const modalContent = modal.querySelector('.modal-content');
        
        // 显示模态框
        modal.classList.remove('hidden');
        modal.classList.add('show');
        
        // 阻止背景滚动
        document.body.style.overflow = 'hidden';
        
        // 添加关闭事件监听器
        setupModalEvents();
    }

    // 隐藏任务详情弹出界面
    function hideTaskDetailModal() {
        const modal = document.getElementById('task-detail-modal');
        const modalContent = modal.querySelector('.modal-content');
        
        // 隐藏动画
        modalContent.style.transform = 'translateY(100%)';
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('show');
            modalContent.style.transform = '';
            
            // 恢复背景滚动
            document.body.style.overflow = '';
        }, 300);
    }

    // 设置模态框事件监听器
    function setupModalEvents() {
        const modal = document.getElementById('task-detail-modal');
        const closeBtn = document.getElementById('close-modal');
        const acceptBtn = document.getElementById('accept-task');
        const dragHandle = modal.querySelector('.drag-handle');
        
        // 点击关闭按钮
        closeBtn.addEventListener('click', hideTaskDetailModal);
        
        // 点击背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideTaskDetailModal();
            }
        });
        
        // 接取任务按钮
        acceptBtn.addEventListener('click', function() {
            showToast('任务已接取，请按照步骤完成任务');
            hideTaskDetailModal();
        });
        
        // 拖拽关闭功能
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        const modalContent = modal.querySelector('.modal-content');
        
        dragHandle.addEventListener('touchstart', function(e) {
            startY = e.touches[0].clientY;
            isDragging = true;
            modalContent.style.transition = 'none';
        });
        
        dragHandle.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY - startY;
            if (currentY > 0) {
                modalContent.style.transform = `translateY(${currentY}px)`;
            }
        });
        
        dragHandle.addEventListener('touchend', function() {
            if (!isDragging) return;
            
            modalContent.style.transition = 'transform 0.3s ease';
            
            if (currentY > 100) {
                // 拖拽距离超过100px，关闭弹窗
                hideTaskDetailModal();
            } else {
                // 回弹到原位
                modalContent.style.transform = 'translateY(0)';
            }
            
            isDragging = false;
            startY = 0;
            currentY = 0;
        });
        
        // 鼠标事件（桌面端）
        let mouseStartY = 0;
        let mouseCurrentY = 0;
        let isMouseDragging = false;
        
        dragHandle.addEventListener('mousedown', function(e) {
            mouseStartY = e.clientY;
            isMouseDragging = true;
            modalContent.style.transition = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isMouseDragging) return;
            
            mouseCurrentY = e.clientY - mouseStartY;
            if (mouseCurrentY > 0) {
                modalContent.style.transform = `translateY(${mouseCurrentY}px)`;
            }
        });
        
        document.addEventListener('mouseup', function() {
            if (!isMouseDragging) return;
            
            modalContent.style.transition = 'transform 0.3s ease';
            
            if (mouseCurrentY > 100) {
                hideTaskDetailModal();
            } else {
                modalContent.style.transform = 'translateY(0)';
            }
            
            isMouseDragging = false;
            mouseStartY = 0;
            mouseCurrentY = 0;
        });
    }

    // 显示提示消息
    function showToast(message) {
        // 检查是否已存在toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 3秒后自动移除
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // 底部导航切换
    const bottomNavItems = document.querySelectorAll('footer a');
    bottomNavItems.forEach(item => {
        // 为当前活动的导航项添加active状态
        if (item.classList.contains('text-blue-600')) {
            item.classList.add('text-blue-600');
            item.classList.remove('text-gray-400');
        }

        item.addEventListener('click', function() {
            // 移除所有导航项的active状态
            bottomNavItems.forEach(i => i.classList.remove('text-blue-600'));
            bottomNavItems.forEach(i => i.classList.add('text-gray-400'));

            // 为当前点击的导航项添加active状态
            this.classList.add('text-blue-600');
            this.classList.remove('text-gray-400');

            // 显示提示消息
            const navText = this.querySelector('span').textContent;
            if (navText !== '首页') {
                showToast(`已切换到${navText}页面`);
            }
        });
    });

    // 数据生成函数
    function generateAllTasks() {
        return [
            {
                title: 'kk搜索',
                description: '拉新8元...',
                reward: '8.50',
                category: '资源推广',
                categoryBg: 'bg-blue-50',
                categoryTag: 'bg-blue-100 text-blue-800',
                rating: '4.8',
                iconBg: 'bg-blue-100',
                iconClass: 'fas fa-search',
                iconColor: 'text-blue-600',
                tagClass: 'bg-blue-100 text-blue-800',
                tagText: '收益高',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false,
                imageUrl: 'tp/微信图片_20250913162419.jpg'
            },
            {
                title: '悟空搜索',
                description: '拉新8元',
                reward: '10.00',
                category: '资源推广',
                categoryBg: 'bg-orange-50',
                categoryTag: 'bg-orange-100 text-orange-800',
                rating: '4.7',
                iconBg: 'bg-orange-100',
                iconClass: 'fas fa-search',
                iconColor: 'text-orange-500',
                tagClass: 'bg-orange-100 text-orange-800',
                tagText: '新上线',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false,
                imageUrl: 'tp/微信图片_20250913162419.jpg'
            },
            {
                title: 'kk网盘',
                description: '拉新7元',
                reward: '7.00',
                category: '网盘推广',
                categoryBg: 'bg-purple-50',
                categoryTag: 'bg-purple-100 text-purple-800',
                rating: '4.9',
                iconBg: 'bg-blue-100',
                iconClass: 'fas fa-cloud',
                iconColor: 'text-blue-500',
                tagClass: 'bg-green-100 text-green-800',
                tagText: '高转化',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false
            },
        ];
    }

    function generateResourceTasks() {
        return [
            {
                title: 'kk搜索',
                description: '拉新8元...',
                reward: '8.50',
                category: '资源推广',
                categoryBg: 'bg-blue-50',
                categoryTag: 'bg-blue-100 text-blue-800',
                rating: '4.8',
                iconBg: 'bg-blue-100',
                iconClass: 'fas fa-search',
                iconColor: 'text-blue-600',
                tagClass: 'bg-blue-100 text-blue-800',
                tagText: '收益高',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false,
                imageUrl: 'tp/微信图片_20250913162419.jpg'
            },
            {
                title: '悟空搜索',
                description: '拉新8元',
                reward: '10.00',
                category: '资源推广',
                categoryBg: 'bg-orange-50',
                categoryTag: 'bg-orange-100 text-orange-800',
                rating: '4.7',
                iconBg: 'bg-orange-100',
                iconClass: 'fas fa-search',
                iconColor: 'text-orange-500',
                tagClass: 'bg-orange-100 text-orange-800',
                tagText: '新上线',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false,
                imageUrl: 'tp/微信图片_20250913162419.jpg'
            }
        ];
    }

    function generateDramaTasks() {
        return [
            {
                title: 'kk网盘',
                description: '拉新7元',
                reward: '7.00',
                category: '网盘推广',
                categoryBg: 'bg-purple-50',
                categoryTag: 'bg-purple-100 text-purple-800',
                rating: '4.9',
                iconBg: 'bg-blue-100',
                iconClass: 'fas fa-cloud',
                iconColor: 'text-blue-500',
                tagClass: 'bg-green-100 text-green-800',
                tagText: '高转化',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false
            }
        ];
    }

    function generateNovelTasks() {
        return [];
    }

    function generateToolTasks() {
        return [
            {
                title: '悟空网盘',
                description: '拉新10元',
                reward: '10.00',
                category: '工具推广',
                categoryBg: 'bg-indigo-50',
                categoryTag: 'bg-indigo-100 text-indigo-800',
                rating: '4.9',
                iconBg: 'bg-orange-100',
                iconClass: 'fas fa-cloud-upload-alt',
                iconColor: 'text-orange-500',
                tagClass: 'bg-green-100 text-green-800',
                tagText: '高转化',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false
            },
            {
                title: '悟空搜索',
                description: '拉新8元',
                reward: '10.00',
                category: '工具推广',
                categoryBg: 'bg-orange-50',
                categoryTag: 'bg-orange-100 text-orange-800',
                rating: '4.7',
                iconBg: 'bg-orange-100',
                iconClass: 'fas fa-search',
                iconColor: 'text-orange-500',
                tagClass: 'bg-orange-100 text-orange-800',
                tagText: '新上线',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false
            }
        ];
    }

    function generateGameTasks() {
        return [
            {
                title: '手游试玩',
                description: '试玩3分钟得2元...',
                reward: '5.00',
                category: '游戏推广',
                categoryBg: 'bg-red-50',
                categoryTag: 'bg-red-100 text-red-800',
                rating: '4.8',
                iconBg: 'bg-green-100',
                iconClass: 'fas fa-gamepad',
                iconColor: 'text-green-500',
                tagClass: 'bg-yellow-100 text-yellow-800',
                tagText: '简单易做',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false
            },
            {
                title: '端游下载',
                description: '下载安装得10元...',
                reward: '10.00',
                category: '游戏推广',
                categoryBg: 'bg-red-50',
                categoryTag: 'bg-red-100 text-red-800',
                rating: '4.6',
                iconBg: 'bg-purple-100',
                iconClass: 'fas fa-download',
                iconColor: 'text-purple-500',
                tagClass: 'bg-red-100 text-red-800',
                tagText: '高收益',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
                btnIcon: 'fas fa-tasks',
                btnText: '立即接取',
                btnDisabled: false
            }
        ];
    }

    // 初始化页面
    loadTasks('全部任务');
});

// 全局函数，供HTML调用
window.showTaskDetailModal = function() {
    console.log('尝试打开任务详情弹窗');
    
    const modal = document.getElementById('task-detail-modal');
    
    if (!modal) {
        console.error('找不到模态框元素');
        return;
    }
    
    // 检查弹窗是否已经显示
    if (modal.classList.contains('show')) {
        console.log('弹窗已经打开');
        return;
    }
    
    // 防止在关闭过程中重新打开
    if (isModalClosing) {
        console.log('弹窗正在关闭中，稍后再试');
        setTimeout(() => {
            window.showTaskDetailModal();
        }, 350);
        return;
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
    modal.classList.add('show');
    
    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
    
    // 添加关闭事件监听器
    setupModalEvents();
    
    console.log('任务详情弹窗已打开');
};

// 设置模态框事件监听器的全局版本
function setupModalEvents() {
    console.log('开始设置模态框事件监听器');
    
    const modal = document.getElementById('task-detail-modal');
    const acceptBtn = document.getElementById('accept-task-btn');
    
    console.log('找到的元素:', { modal: !!modal, acceptBtn: !!acceptBtn });
    
    // 返回按钮使用 onclick 属性和全局函数，不需要额外设置
    
    // 接取任务按钮
    if (acceptBtn) {
        console.log('设置接取任务按钮事件监听器');
        
        acceptBtn.addEventListener('click', function(e) {
            console.log('接取任务按钮被点击');
            e.stopPropagation();
            e.preventDefault();
            showToast('任务已接取，请按照步骤完成任务');
            closeModal(); // 使用简单的关闭函数
        });
    }
    
    // 添加滑动优化
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.classList.add('touch-scroll');
        console.log('添加滑动优化类');
    }
    
    console.log('模态框事件监听器设置完成');
}

// 简单的全局关闭函数
window.closeModal = function() {
    console.log('全局关闭函数被调用');
    const modal = document.getElementById('task-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        console.log('弹窗已关闭');
    }
};

// 全局任务提交弹窗显示函数
window.showTaskSubmissionModal = function() {
    console.log('显示任务提交弹窗');
    
    const modal = document.getElementById('task-submission-modal');
    
    if (!modal) {
        console.error('找不到任务提交弹窗元素');
        return;
    }
    
    // 显示弹窗
    modal.classList.remove('hidden');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    console.log('任务提交弹窗已显示');
};

// 全局任务提交弹窗关闭函数
window.closeTaskSubmissionModal = function() {
    console.log('关闭任务提交弹窗');
    const modal = document.getElementById('task-submission-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        console.log('任务提交弹窗已关闭');
    }
};

// 隐藏任务详情弹出界面的全局版本
let isModalClosing = false; // 防止重复关闭

function hideTaskDetailModal(event) {
    console.log('点击返回按钮 - 开始关闭任务详情弹窗');
    
    // 处理事件传播
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // 防止重复触发
    if (isModalClosing) {
        console.log('弹窗正在关闭中，忽略重复请求');
        return;
    }
    
    const modal = document.getElementById('task-detail-modal');
    
    if (!modal) {
        console.error('找不到模态框元素');
        return;
    }
    
    // 检查弹窗是否已经隐藏
    if (modal.classList.contains('hidden')) {
        console.log('弹窗已经隐藏');
        return;
    }
    
    isModalClosing = true;
    console.log('开始关闭动画');
    
    // 淕入动画
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.95)';
    modal.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('show');
        modal.style.opacity = '';
        modal.style.transform = '';
        modal.style.transition = '';
        
        // 恢复背景滚动
        document.body.style.overflow = '';
        
        // 重置关闭状态
        isModalClosing = false;
        
        console.log('弹窗已完全关闭');
    }, 300);
}

// 显示提示消息的全局版本
function showToast(message) {
    // 检查是否已存在toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 实时数据同步功能
// 全局订阅对象
let userSubscription = null;
let rankingsSubscription = null;

// 初始化用户数据和实时监听
function initUserDataAndRealtime() {
    // 检查本地存储是否有用户信息
    const userInfoElem = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('username-display');
    const pointsDisplay = document.getElementById('points-display');
    const logoutBtn = document.getElementById('logout-btn');
    
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            console.log('用户数据已读取:', user);
            
            // 显示用户信息
            if (userInfoElem) userInfoElem.classList.remove('hidden');
            if (usernameDisplay) usernameDisplay.textContent = user.username;
            if (pointsDisplay) pointsDisplay.textContent = `积分: ${user.points || 0}`;
            
            // 设置退出按钮点击事件
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function() {
                    logoutUser();
                });
            }
            
            // 订阅用户数据更新
            if (typeof subscribeToUserData === 'function') {
                console.log('订阅用户数据更新');
                userSubscription = subscribeToUserData(user.id, handleUserDataUpdate);
            }
            
            // 订阅排行榜数据更新
            if (typeof subscribeToRankings === 'function') {
                console.log('订阅排行榜数据更新');
                rankingsSubscription = subscribeToRankings(handleRankingsUpdate);
            }
            
            return true;
        } catch (error) {
            console.error('解析用户数据失败:', error);
            localStorage.removeItem('currentUser');
        }
    }
    
    // 没有用户登录或解析失败
    if (userInfoElem) userInfoElem.classList.add('hidden');
    return false;
}

// 处理用户数据更新
function handleUserDataUpdate(payload) {
    console.log('收到用户数据更新:', payload);
    
    if (payload.new) {
        const newUserData = payload.new;
        
        // 更新本地存储的用户信息
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const currentUser = JSON.parse(savedUser);
                
                // 确保是当前用户的更新
                if (currentUser.id === newUserData.id) {
                    // 合并数据并保存
                    const updatedUser = { ...currentUser, ...newUserData };
                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                    
                    // 更新界面显示
                    const pointsDisplay = document.getElementById('points-display');
                    if (pointsDisplay) {
                        pointsDisplay.textContent = `积分: ${updatedUser.points || 0}`;
                    }
                    
                    // 如果积分变化，显示提示
                    if (currentUser.points !== updatedUser.points) {
                        const diff = (updatedUser.points || 0) - (currentUser.points || 0);
                        if (diff > 0) {
                            showToast(`恭喜您获得 ${diff} 积分！`);
                        } else if (diff < 0) {
                            showToast(`您消费了 ${Math.abs(diff)} 积分`); 
                        }
                    }
                }
            } catch (error) {
                console.error('更新用户数据失败:', error);
            }
        }
    }
}

// 处理排行榜数据更新
function handleRankingsUpdate(payload) {
    console.log('收到排行榜数据更新:', payload);
    
    // 如果当前页面是排行榜页面，自动刷新数据
    const isRankingPage = window.location.pathname.includes('ranking.html');
    if (isRankingPage && typeof updateRankings === 'function') {
        // 延迟刷新，避免多次快速更新
        clearTimeout(window.rankingUpdateTimer);
        window.rankingUpdateTimer = setTimeout(() => {
            updateRankings();
        }, 500);
    }
}

// 用户退出登录
function logoutUser() {
    // 取消所有订阅
    if (typeof unsubscribeAll === 'function') {
        unsubscribeAll();
    } else {
        if (userSubscription && typeof unsubscribe === 'function') {
            unsubscribe(userSubscription);
        }
        if (rankingsSubscription && typeof unsubscribe === 'function') {
            unsubscribe(rankingsSubscription);
        }
    }
    
    // 清除用户数据
    localStorage.removeItem('currentUser');
    
    // 隐藏用户信息
    const userInfoElem = document.getElementById('user-info');
    if (userInfoElem) userInfoElem.classList.add('hidden');
    
    // 显示提示
    showToast('您已成功退出登录');
    
    // 返回登录页
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}

// 页面加载时初始化用户数据和实时同步
document.addEventListener('DOMContentLoaded', function() {
    // 在其他初始化后调用
    setTimeout(() => {
        initUserDataAndRealtime();
    }, 100);
});