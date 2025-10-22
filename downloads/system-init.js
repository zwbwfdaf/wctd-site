// 管理系统初始化脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log("========== 管理系统初始化开始 ==========");
    
    // 延迟执行以确保其他脚本已加载
    setTimeout(async function() {
        try {
            // 1. 初始化Supabase连接
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                console.log("初始化Supabase客户端...");
                const SUPABASE_URL = 'https://ybrveusbwjusnrzgfnok.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicnZldXNid2p1c25yemdmbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODU1NjIsImV4cCI6MjA3MjA2MTU2Mn0.JKPSUli-q9wRuDagE6kwltLk9XgfygE8yznm-Ca82Qk';
                window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log("Supabase客户端初始化完成");
            }
            
            // 2. 测试数据库连接
            console.log("测试数据库连接...");
            const { data, error } = await window.supabase
                .from('users')
                .select('id')
                .limit(1);
                
            if (error) {
                throw new Error("数据库连接测试失败: " + error.message);
            }
            console.log("数据库连接测试成功");
            
            // 3. 初始化必要的表结构
            await initDatabase();
            
            // 4. 添加基础测试数据
            await addTestData();
            
            // 5. 初始化页面
            if (typeof initPage === 'function') {
                console.log("初始化页面...");
                await initPage();
                console.log("页面初始化完成");
            } else {
                console.log("未找到initPage函数，跳过页面初始化");
                // 手动加载数据
                if (typeof loadUserData === 'function') {
                    loadUserData();
                }
            }
            
            // 6. 确保菜单正常工作
            initMenuEvents();
            
            console.log("========== 管理系统初始化完成 ==========");
            
        } catch (error) {
            console.error("系统初始化失败:", error);
            alert("系统初始化失败: " + error.message);
        }
    }, 1000);
});

// 初始化数据库结构
async function initDatabase() {
    console.log("检查并初始化数据库表结构...");
    
    try {
        // 1. 检查users表
        const { data: userTableCheck, error: userTableError } = await window.supabase
            .from('users')
            .select('id')
            .limit(1);
        
        if (userTableError && userTableError.code === '42P01') {
            console.log("用户表不存在，通过RPC创建表...");
            // 使用RPC调用创建表
            await window.supabase.rpc('create_users_table');
        } else {
            console.log("用户表已存在");
        }
        
        // 2. 检查earnings表
        const { data: earningsTableCheck, error: earningsTableError } = await window.supabase
            .from('earnings')
            .select('id')
            .limit(1);
        
        if (earningsTableError && earningsTableError.code === '42P01') {
            console.log("收益表不存在，通过RPC创建表...");
            // 使用RPC调用创建表
            await window.supabase.rpc('create_earnings_table');
        } else {
            console.log("收益表已存在");
        }
        
        // 3. 检查withdrawals表
        const { data: withdrawalsTableCheck, error: withdrawalsTableError } = await window.supabase
            .from('withdrawals')
            .select('id')
            .limit(1);
        
        if (withdrawalsTableError && withdrawalsTableError.code === '42P01') {
            console.log("提现表不存在，通过RPC创建表...");
            // 使用RPC调用创建表
            await window.supabase.rpc('create_withdrawals_table');
        } else {
            console.log("提现表已存在");
        }
        
        console.log("数据库表结构检查完成");
        return true;
    } catch (error) {
        console.error("初始化数据库表结构失败:", error);
        // 使用SQL方式直接创建表
        console.log("尝试直接使用SQL创建表...");
        
        try {
            // 创建用户表
            await window.supabase.rpc('execute_sql', { 
                sql_query: `
                CREATE TABLE IF NOT EXISTS users (
                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT,
                  points INTEGER DEFAULT 0,
                  wallet_balance DECIMAL(10,2) DEFAULT 0.00,
                  status TEXT DEFAULT '正常',
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );`
            });
            
            // 创建收益表
            await window.supabase.rpc('execute_sql', { 
                sql_query: `
                CREATE TABLE IF NOT EXISTS earnings (
                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                  user_id UUID REFERENCES users(id),
                  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                  task_name TEXT,
                  status TEXT DEFAULT '已完成',
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );`
            });
            
            // 创建提现表
            await window.supabase.rpc('execute_sql', { 
                sql_query: `
                CREATE TABLE IF NOT EXISTS withdrawals (
                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                  user_id UUID REFERENCES users(id),
                  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                  status TEXT DEFAULT 'pending',
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );`
            });
            
            console.log("表创建成功");
            return true;
        } catch (sqlError) {
            console.error("使用SQL创建表失败:", sqlError);
            return false;
        }
    }
}

// 添加测试数据
async function addTestData() {
    console.log("检查并添加测试数据...");
    
    try {
        // 检查是否已存在用户数据
        const { data: existingUsers, error: checkError } = await window.supabase
            .from('users')
            .select('id, username')
            .limit(10);
            
        if (checkError) throw checkError;
        
        if (existingUsers && existingUsers.length > 0) {
            console.log(`已存在${existingUsers.length}条用户数据，跳过测试数据添加`);
            return;
        }
        
        console.log("添加测试用户数据...");
        // 添加测试用户
        const { data: usersData, error: usersError } = await window.supabase
            .from('users')
            .insert([
                { 
                    username: 'admin', 
                    password: 'admin123', 
                    points: 1000, 
                    wallet_balance: 500.00, 
                    status: '正常'
                },
                { 
                    username: 'test_user1', 
                    password: 'password123', 
                    points: 100, 
                    wallet_balance: 50.00, 
                    status: '正常'
                },
                { 
                    username: 'test_user2', 
                    password: 'password123', 
                    points: 200, 
                    wallet_balance: 75.50, 
                    status: '正常'
                }
            ])
            .select();
            
        if (usersError) throw usersError;
        console.log(`成功添加${usersData.length}条用户数据`);
        
        // 为用户添加收益记录
        console.log("添加测试收益数据...");
        const earningRecords = [];
        
        for (const user of usersData) {
            earningRecords.push({
                user_id: user.id,
                amount: 10.50,
                task_name: '夸克搜索任务',
                status: '已完成'
            });
            
            earningRecords.push({
                user_id: user.id,
                amount: 8.20,
                task_name: '悟空搜索任务',
                status: '已完成'
            });
        }
        
        const { data: earningsData, error: earningsError } = await window.supabase
            .from('earnings')
            .insert(earningRecords)
            .select();
            
        if (earningsError) throw earningsError;
        console.log(`成功添加${earningsData.length}条收益数据`);
        
        // 添加测试提现记录
        console.log("添加测试提现数据...");
        const withdrawalRecords = [];
        
        for (const user of usersData) {
            withdrawalRecords.push({
                user_id: user.id,
                amount: 5.00,
                status: 'pending'
            });
        }
        
        const { data: withdrawalsData, error: withdrawalsError } = await window.supabase
            .from('withdrawals')
            .insert(withdrawalRecords)
            .select();
            
        if (withdrawalsError) throw withdrawalsError;
        console.log(`成功添加${withdrawalsData.length}条提现数据`);
        
        console.log("测试数据添加完成");
        return true;
    } catch (error) {
        console.error("添加测试数据失败:", error);
        return false;
    }
}

// 初始化菜单事件
function initMenuEvents() {
    console.log("初始化菜单事件...");
    
    // 主菜单点击事件
    document.querySelectorAll('.nav-item.has-children').forEach(navItem => {
        navItem.onclick = function(e) {
            if (e.target.closest('.submenu-item')) return; // 不处理子菜单点击
            
            const submenu = this.querySelector('.submenu');
            if (!submenu) return;
            
            // 切换子菜单显示状态
            const isExpanded = this.classList.contains('expanded');
            
            // 先关闭所有其他展开的菜单
            document.querySelectorAll('.nav-item.has-children').forEach(item => {
                if (item !== this) {
                    item.classList.remove('expanded');
                    const menu = item.querySelector('.submenu');
                    if (menu) menu.style.display = 'none';
                }
            });
            
            // 切换当前菜单
            if (isExpanded) {
                this.classList.remove('expanded');
                submenu.style.display = 'none';
            } else {
                this.classList.add('expanded');
                submenu.style.display = 'block';
            }
        };
    });
    
    // 子菜单点击事件
    document.querySelectorAll('.submenu-item').forEach(item => {
        item.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const pageId = this.getAttribute('data-page');
            console.log("点击子菜单项:", this.textContent.trim(), "页面ID:", pageId);
            
            // 更新活动状态
            document.querySelectorAll('.submenu-item').forEach(menuItem => {
                menuItem.classList.remove('active');
            });
            this.classList.add('active');
            
            // 显示对应页面
            document.querySelectorAll('.page-content').forEach(page => {
                page.classList.remove('active');
                page.style.display = 'none';
            });
            
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.classList.add('active');
                targetPage.style.display = 'block';
                console.log("成功显示页面:", pageId);
                
                // 如果是特定页面，加载对应数据
                if (pageId === 'user-info' && typeof loadUserData === 'function') {
                    loadUserData();
                } else if (pageId.includes('earnings') && typeof loadEarningsData === 'function') {
                    loadEarningsData(pageId === 'all-earnings' ? 'all' : pageId);
                }
                
                // 更新页面标题
                updatePageTitle(this.textContent.trim(), pageId);
            }
        };
    });
    
    console.log("菜单事件初始化完成");
}

// 更新页面标题
function updatePageTitle(title, pageId) {
    const titleElement = document.getElementById('current-page-title');
    const descriptionElement = document.getElementById('current-page-description');
    
    if (!titleElement || !descriptionElement) return;
    
    // 更新标题
    titleElement.textContent = title;
    
    // 根据页面ID更新描述
    const descriptions = {
        'user-info': '管理系统用户信息，包括添加、编辑、删除用户等操作',
        'all-earnings': '查看所有用户的收益记录，支持按类型筛选和管理',
        'quark-earnings': '管理夸克搜索相关的收益记录',
        'wukong-earnings': '管理悟空搜索相关的收益记录',
        'all-tasks': '管理系统任务，包括任务创建、分配和状态跟踪',
        'quark-tasks': '管理夸克搜索相关任务',
        'wukong-tasks': '管理悟空搜索相关任务',
        'signin-tasks': '管理用户签到任务和奖励',
        'system-config': '系统参数配置，包括基本设置和任务配置',
        'system-logs': '查看系统运行日志，支持按级别和日期筛选',
        'system-monitor': '实时监控系统性能指标',
        'backup-restore': '数据备份和恢复管理',
        'basic-settings': '基本系统设置，包括界面和显示配置',
        'advanced-settings': '高级系统设置，包括性能和调试配置',
        'security-settings': '安全配置，包括密码策略和登录安全',
        'notification-settings': '通知配置，包括邮件和系统通知',
        'withdraw-review': '审核用户的提现申请，处理通过/拒绝等操作'
    };
    
    const description = descriptions[pageId] || '管理系统相关功能和设置';
    descriptionElement.textContent = description;
}
