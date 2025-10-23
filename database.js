// Supabase配置（直连）
const SUPABASE_URL = 'https://ybrveusbwjusnrzgfnok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicnZldXNid2p1c25yemdmbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODU1NjIsImV4cCI6MjA3MjA2MTU2Mn0.JKPSUli-q9wRuDagE6kwltLk9XgfygE8yznm-Ca82Qk';

// 动态加载Supabase客户端
let supabase;

// 初始化Supabase客户端
async function initSupabase() {
    try {
        console.log('🔗 连接到Supabase数据库...');
        
        // 等待Supabase SDK加载完成
        if (typeof window.ensureSupabaseLoaded === 'function') {
            await window.ensureSupabaseLoaded();
            console.log('✅ Supabase SDK加载完成');
        }
        
        // 检查全局supabase是否可用
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase连接成功');
        } else {
            throw new Error('Supabase SDK未正确加载');
        }
        
    } catch (error) {
        console.error('❌ Supabase连接失败:', error);
        
        // 提供更具体的错误信息
        let errorMessage = '数据库连接失败';
        if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络设置';
        } else if (error.message.includes('SDK')) {
            errorMessage = '数据库组件加载失败，请刷新页面重试';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = '数据库访问权限错误，请联系管理员';
        }
        
        // 不使用alert，而是显示在页面上
        showDatabaseError(errorMessage);
    }
}

// 显示数据库错误
function showDatabaseError(message) {
    // 尝试在页面上显示错误信息
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #fee;
        color: #c33;
        padding: 15px 20px;
        border-radius: 8px;
        border: 1px solid #fcc;
        z-index: 10000;
        max-width: 90%;
        text-align: center;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    `;
    errorDiv.innerHTML = `❌ ${message}`;
    document.body.appendChild(errorDiv);
    
    // 5秒后自动隐藏
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延迟最小化，避免切页卡顿
    setTimeout(initSupabase, 0);
});

/**
 * 用户注册
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} 用户对象
 */
async function registerUser(username, password) {
    try {
        // 检查用户名是否已存在
        const { data: existingUsers, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .eq('用户名', username)
            .limit(1)
            .single();
        
        if (fetchError && !fetchError.message.includes('Row not found')) {
            throw new Error('检查用户名失败：' + fetchError.message);
        }
        
        if (existingUsers) {
            throw new Error('用户名已存在');
        }
        
        // 插入新用户
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    用户名: username,
                    密码: password, // 实际应用中应该加密
                    积分: 0,
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();
        
        if (error) {
            throw new Error('注册失败：' + error.message);
        }
        
        return data;
    } catch (error) {
        console.error('注册错误：', error);
        throw error;
    }
}

/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<Object>} 用户对象
 */
async function loginUser(username, password) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('用户名', username)
            .eq('密码', password) // 实际应用中应该比较加密后的密码
            .single();
        
        if (error && error.message.includes('Row not found')) {
            throw new Error('用户名或密码错误');
        }
        
        if (error) {
            throw new Error('查询用户失败：' + error.message);
        }
        
        if (!data) {
            throw new Error('用户名或密码错误');
        }
        
        return data;
    } catch (error) {
        console.error('登录错误：', error);
        throw error;
    }
}

/**
 * 获取用户信息
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 用户对象
 */
async function getUserById(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error && error.message.includes('Row not found')) {
            throw new Error('用户不存在');
        }
        
        if (error) {
            throw new Error('获取用户信息失败：' + error.message);
        }
        
        return data;
    } catch (error) {
        console.error('获取用户信息错误：', error);
        throw error;
    }
}

/**
 * 更新用户积分
 * @param {string} userId - 用户ID
 * @param {number} points - 积分变化值
 * @returns {Promise<Object>} 更新后的用户对象
 */
async function updateUserPoints(userId, points) {
    try {
        const { data, error } = await supabase
            .from('users')
            .update({ 积分: points })
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            throw new Error('更新积分失败：' + error.message);
        }
        
        return data;
    } catch (error) {
        console.error('更新积分错误：', error);
        throw error;
    }
}

// 导出函数
window.registerUser = registerUser;
window.loginUser = loginUser;
window.getUserById = getUserById;
window.updateUserPoints = updateUserPoints;