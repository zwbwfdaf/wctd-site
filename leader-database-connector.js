/**
 * 团长系统数据库连接器
 * 用于连接Supabase数据库，获取真实数据
 * 
 * 使用方法：
 * 1. 在HTML中引入此文件：<script src="leader-database-connector.js"></script>
 * 2. 配置Supabase连接信息（修改下方的配置）
 * 3. 调用相应的API函数获取数据
 */

// ============================================================================
// 配置部分 - 请修改为你的Supabase信息
// ============================================================================

const LEADER_DB_CONFIG = {
    supabaseUrl: 'https://your-project.supabase.co',  // 替换为你的Supabase URL
    supabaseKey: 'your-anon-key',  // 替换为你的Supabase Anon Key
    debug: true  // 开启调试模式
};

// ============================================================================
// 初始化Supabase客户端
// ============================================================================

let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase库未加载！请在HTML中添加：');
        console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
        return false;
    }
    
    const { createClient } = supabase;
    supabaseClient = createClient(LEADER_DB_CONFIG.supabaseUrl, LEADER_DB_CONFIG.supabaseKey);
    
    if (LEADER_DB_CONFIG.debug) {
        console.log('✅ Supabase客户端初始化成功');
        console.log('URL:', LEADER_DB_CONFIG.supabaseUrl);
    }
    
    return true;
}

// ============================================================================
// 用户认证相关
// ============================================================================

/**
 * 获取当前登录用户信息
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.error('获取用户信息失败:', error);
            return null;
        }
        
        if (LEADER_DB_CONFIG.debug) {
            console.log('当前用户:', user);
        }
        
        return user;
    } catch (error) {
        console.error('获取用户失败:', error);
        return null;
    }
}

/**
 * 检查用户是否为团长
 */
async function checkIsLeader(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('leaders')
            .select('id, level, status')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();
        
        if (error) {
            if (LEADER_DB_CONFIG.debug) {
                console.log('用户不是团长或查询失败:', error);
            }
            return false;
        }
        
        if (LEADER_DB_CONFIG.debug) {
            console.log('✅ 用户是团长:', data);
        }
        
        return data;
    } catch (error) {
        console.error('检查团长身份失败:', error);
        return false;
    }
}

// ============================================================================
// 团长个人中心数据
// ============================================================================

/**
 * 获取团长仪表盘数据
 */
async function getLeaderDashboard(userId) {
    try {
        // 获取团长信息
        const { data: leader, error: leaderError } = await supabaseClient
            .from('leaders')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (leaderError) throw leaderError;
        
        // 获取团队统计
        const teamStats = await getTeamStatistics(leader.id);
        
        // 获取佣金统计
        const commissionStats = await getCommissionStatistics(leader.id);
        
        // 组装返回数据
        return {
            leader: leader,
            teamStats: teamStats,
            commissionStats: commissionStats
        };
        
    } catch (error) {
        console.error('获取仪表盘数据失败:', error);
        throw error;
    }
}

/**
 * 获取团队统计
 */
async function getTeamStatistics(leaderId) {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('level')
            .eq('leader_id', leaderId)
            .eq('status', 'active');
        
        if (error) throw error;
        
        const stats = {
            total: data.length,
            level1: data.filter(m => m.level === 1).length,
            level2: data.filter(m => m.level === 2).length,
            level3: data.filter(m => m.level === 3).length
        };
        
        return stats;
        
    } catch (error) {
        console.error('获取团队统计失败:', error);
        return { total: 0, level1: 0, level2: 0, level3: 0 };
    }
}

/**
 * 获取佣金统计
 */
async function getCommissionStatistics(leaderId) {
    try {
        const { data, error } = await supabaseClient
            .from('leader_commissions')
            .select('amount, status, created_at')
            .eq('leader_id', leaderId);
        
        if (error) throw error;
        
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const stats = {
            total: data.reduce((sum, item) => sum + parseFloat(item.amount), 0),
            thisMonth: data
                .filter(item => new Date(item.created_at) >= thisMonthStart)
                .reduce((sum, item) => sum + parseFloat(item.amount), 0),
            pending: data
                .filter(item => item.status === 'pending')
                .reduce((sum, item) => sum + parseFloat(item.amount), 0),
            paid: data
                .filter(item => item.status === 'paid')
                .reduce((sum, item) => sum + parseFloat(item.amount), 0)
        };
        
        return stats;
        
    } catch (error) {
        console.error('获取佣金统计失败:', error);
        return { total: 0, thisMonth: 0, pending: 0, paid: 0 };
    }
}

// ============================================================================
// 团队成员数据
// ============================================================================

/**
 * 获取团队成员列表
 */
async function getTeamMembers(userId, level = 'all', page = 1, pageSize = 20) {
    try {
        // 先获取团长ID
        const { data: leader } = await supabaseClient
            .from('leaders')
            .select('id')
            .eq('user_id', userId)
            .single();
        
        if (!leader) throw new Error('团长信息不存在');
        
        // 构建查询
        let query = supabaseClient
            .from('team_members')
            .select(`
                *,
                member:users!member_id(id, username, name, avatar)
            `, { count: 'exact' })
            .eq('leader_id', leader.id)
            .eq('status', 'active');
        
        // 应用层级筛选
        if (level !== 'all') {
            query = query.eq('level', parseInt(level));
        }
        
        // 应用分页
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        query = query.range(start, end);
        
        // 排序
        query = query.order('joined_at', { ascending: false });
        
        // 执行查询
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        return {
            members: data,
            total: count,
            page: page,
            pageSize: pageSize,
            totalPages: Math.ceil(count / pageSize)
        };
        
    } catch (error) {
        console.error('获取团队成员失败:', error);
        throw error;
    }
}

// ============================================================================
// 佣金数据
// ============================================================================

/**
 * 获取佣金记录列表
 */
async function getCommissionRecords(userId, filters = {}) {
    try {
        const { data: leader } = await supabaseClient
            .from('leaders')
            .select('id')
            .eq('user_id', userId)
            .single();
        
        if (!leader) throw new Error('团长信息不存在');
        
        let query = supabaseClient
            .from('leader_commissions')
            .select(`
                *,
                source_user:users!source_user_id(username, name)
            `, { count: 'exact' })
            .eq('leader_id', leader.id);
        
        // 应用筛选
        if (filters.type) {
            query = query.eq('type', filters.type);
        }
        
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        
        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate);
        }
        
        // 分页
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;
        query = query.range(start, end);
        
        // 排序
        query = query.order('created_at', { ascending: false });
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        return {
            records: data,
            total: count,
            page: page,
            pageSize: pageSize
        };
        
    } catch (error) {
        console.error('获取佣金记录失败:', error);
        throw error;
    }
}

// ============================================================================
// 等级权益数据
// ============================================================================

/**
 * 获取等级信息和进度
 */
async function getLevelInfo(userId) {
    try {
        // 获取团长信息
        const { data: leader, error: leaderError } = await supabaseClient
            .from('leaders')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (leaderError) throw leaderError;
        
        // 获取所有等级配置
        const { data: allLevels, error: levelsError } = await supabaseClient
            .from('leader_levels')
            .select('*')
            .order('required_members', { ascending: true });
        
        if (levelsError) throw levelsError;
        
        // 计算升级进度
        const currentLevel = allLevels.find(l => l.level === leader.level);
        const currentIndex = allLevels.findIndex(l => l.level === leader.level);
        const nextLevel = allLevels[currentIndex + 1];
        
        const progress = nextLevel ? {
            currentMembers: leader.level1_members,
            nextLevelMembers: nextLevel.required_members,
            progress: Math.round((leader.level1_members / nextLevel.required_members) * 100),
            remaining: nextLevel.required_members - leader.level1_members,
            nextLevel: nextLevel
        } : null;
        
        return {
            currentLevel: currentLevel,
            allLevels: allLevels,
            progress: progress,
            leaderData: leader
        };
        
    } catch (error) {
        console.error('获取等级信息失败:', error);
        throw error;
    }
}

// ============================================================================
// 邀请推广数据
// ============================================================================

/**
 * 获取邀请信息
 */
async function getInviteInfo(userId) {
    try {
        const { data: leader } = await supabaseClient
            .from('leaders')
            .select('id, invite_code')
            .eq('user_id', userId)
            .single();
        
        if (!leader) throw new Error('团长信息不存在');
        
        // 生成邀请链接
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/register.html?ref=${leader.invite_code}`;
        
        // 获取邀请统计
        const { data: members } = await supabaseClient
            .from('team_members')
            .select('joined_at')
            .eq('leader_id', leader.id);
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const stats = {
            today: members.filter(m => new Date(m.joined_at) >= today).length,
            thisMonth: members.filter(m => new Date(m.joined_at) >= thisMonth).length,
            total: members.length
        };
        
        return {
            inviteCode: leader.invite_code,
            inviteUrl: inviteUrl,
            qrCodeUrl: `/api/qrcode/generate?code=${leader.invite_code}`,  // 需要后端支持
            statistics: stats
        };
        
    } catch (error) {
        console.error('获取邀请信息失败:', error);
        throw error;
    }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化日期
 */
function formatDate(dateString, format = 'YYYY-MM-DD') {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    switch(format) {
        case 'YYYY-MM-DD':
            return `${year}-${month}-${day}`;
        case 'YYYY-MM-DD HH:mm':
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        case 'MM-DD':
            return `${month}-${day}`;
        default:
            return `${year}-${month}-${day}`;
    }
}

/**
 * 格式化金额
 */
function formatMoney(amount) {
    return parseFloat(amount || 0).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * 获取等级显示信息
 */
function getLevelDisplay(level) {
    const levelMap = {
        'bronze': { name: '青铜团长', icon: '🥉', color: '#cd7f32' },
        'silver': { name: '白银团长', icon: '🥈', color: '#c0c0c0' },
        'gold': { name: '黄金团长', icon: '👑', color: '#ffd700' },
        'platinum': { name: '铂金团长', icon: '💎', color: '#e5e4e2' },
        'diamond': { name: '钻石团长', icon: '⭐', color: '#b9f2ff' }
    };
    
    return levelMap[level] || levelMap['bronze'];
}

// ============================================================================
// 实时订阅
// ============================================================================

/**
 * 订阅团队成员变化
 */
function subscribeTeamChanges(leaderId, callback) {
    const channel = supabaseClient
        .channel('team_changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'team_members',
            filter: `leader_id=eq.${leaderId}`
        }, (payload) => {
            if (LEADER_DB_CONFIG.debug) {
                console.log('团队成员变化:', payload);
            }
            callback(payload);
        })
        .subscribe();
    
    return channel;
}

/**
 * 订阅佣金变化
 */
function subscribeCommissionChanges(leaderId, callback) {
    const channel = supabaseClient
        .channel('commission_changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'leader_commissions',
            filter: `leader_id=eq.${leaderId}`
        }, (payload) => {
            if (LEADER_DB_CONFIG.debug) {
                console.log('佣金记录变化:', payload);
            }
            callback(payload);
        })
        .subscribe();
    
    return channel;
}

// ============================================================================
// 错误处理
// ============================================================================

/**
 * 统一错误处理
 */
function handleError(error, message = '操作失败') {
    console.error(message + ':', error);
    
    // 显示用户友好的错误信息
    let userMessage = message;
    
    if (error.message) {
        if (error.message.includes('JWT')) {
            userMessage = '登录已过期，请重新登录';
            // 可以跳转到登录页面
            // window.location.href = 'login.html';
        } else if (error.message.includes('permission')) {
            userMessage = '没有权限访问此数据';
        }
    }
    
    alert(userMessage);
}

// ============================================================================
// 页面加载时自动初始化
// ============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        const success = initSupabase();
        if (!success) {
            console.error('❌ 数据库连接器初始化失败');
        }
    });
} else {
    initSupabase();
}

// ============================================================================
// 导出API供全局使用
// ============================================================================

window.LeaderDB = {
    // 基础函数
    init: initSupabase,
    getCurrentUser: getCurrentUser,
    checkIsLeader: checkIsLeader,
    
    // 数据获取
    getDashboard: getLeaderDashboard,
    getTeamMembers: getTeamMembers,
    getTeamStats: getTeamStatistics,
    getCommissions: getCommissionRecords,
    getCommissionStats: getCommissionStatistics,
    getLevelInfo: getLevelInfo,
    getInviteInfo: getInviteInfo,
    
    // 实时订阅
    subscribeTeam: subscribeTeamChanges,
    subscribeCommission: subscribeCommissionChanges,
    
    // 工具函数
    formatDate: formatDate,
    formatMoney: formatMoney,
    getLevelDisplay: getLevelDisplay,
    
    // 错误处理
    handleError: handleError
};

// ============================================================================
// 使用示例
// ============================================================================

/*

// 在任何页面中使用：

// 1. 引入脚本
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="leader-database-connector.js"></script>

// 2. 使用API获取数据
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 获取当前用户
        const user = await LeaderDB.getCurrentUser();
        if (!user) {
            alert('请先登录');
            return;
        }
        
        // 检查是否为团长
        const isLeader = await LeaderDB.checkIsLeader(user.id);
        if (!isLeader) {
            alert('您不是团长');
            return;
        }
        
        // 获取仪表盘数据
        const dashboard = await LeaderDB.getDashboard(user.id);
        console.log('仪表盘数据:', dashboard);
        
        // 更新页面显示
        document.getElementById('totalMembers').textContent = dashboard.teamStats.total;
        document.getElementById('totalCommission').textContent = LeaderDB.formatMoney(dashboard.commissionStats.total);
        
    } catch (error) {
        LeaderDB.handleError(error, '加载数据失败');
    }
});

*/

console.log('✅ 团长数据库连接器已加载');
console.log('📚 使用 window.LeaderDB 访问所有API');
console.log('📖 查看文件末尾的使用示例');

