/**
 * 实时数据同步模块
 * 基于Supabase实时订阅功能，用于监听数据变化并更新UI
 */

// 存储所有频道订阅
let activeChannels = [];

/**
 * 订阅用户数据变化
 * @param {string} userId - 用户ID
 * @param {Function} callback - 数据变化时的回调函数
 * @returns {Object} 订阅对象
 */
function subscribeToUserData(userId, callback) {
    if (!supabase) {
        console.error('Supabase客户端未初始化');
        return null;
    }
    
    try {
        console.log(`订阅用户数据变化: ${userId}`);
        
        // 创建新的实时频道
        const channel = supabase
            .channel(`user-updates-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // 监听所有事件类型 (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${userId}`
                },
                (payload) => {
                    console.log('用户数据变化:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log(`用户数据订阅状态: ${status}`);
            });
        
        // 存储频道引用
        activeChannels.push(channel);
        
        return channel;
    } catch (error) {
        console.error('订阅用户数据变化失败:', error);
        return null;
    }
}

/**
 * 订阅用户任务数据变化
 * @param {string} userId - 用户ID
 * @param {Function} callback - 数据变化时的回调函数
 * @returns {Object} 订阅对象
 */
function subscribeToUserTasks(userId, callback) {
    if (!supabase) {
        console.error('Supabase客户端未初始化');
        return null;
    }
    
    try {
        console.log(`订阅用户任务数据变化: ${userId}`);
        
        // 创建新的实时频道
        const channel = supabase
            .channel(`user-tasks-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // 监听所有事件类型
                    schema: 'public',
                    table: 'user_tasks',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('用户任务数据变化:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log(`用户任务数据订阅状态: ${status}`);
            });
        
        // 存储频道引用
        activeChannels.push(channel);
        
        return channel;
    } catch (error) {
        console.error('订阅用户任务数据变化失败:', error);
        return null;
    }
}

/**
 * 订阅排行榜数据变化
 * @param {Function} callback - 数据变化时的回调函数
 * @returns {Object} 订阅对象
 */
function subscribeToRankings(callback) {
    if (!supabase) {
        console.error('Supabase客户端未初始化');
        return null;
    }
    
    try {
        console.log('订阅排行榜数据变化');
        
        // 创建新的实时频道
        const channel = supabase
            .channel('rankings')
            .on(
                'postgres_changes',
                {
                    event: '*', // 监听所有事件类型
                    schema: 'public',
                    table: 'users',
                    // 不设置过滤器，监听所有用户数据变化
                },
                (payload) => {
                    console.log('排行榜数据变化:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log(`排行榜数据订阅状态: ${status}`);
            });
        
        // 存储频道引用
        activeChannels.push(channel);
        
        return channel;
    } catch (error) {
        console.error('订阅排行榜数据变化失败:', error);
        return null;
    }
}

/**
 * 取消所有订阅
 */
function unsubscribeAll() {
    console.log(`取消${activeChannels.length}个频道订阅`);
    
    activeChannels.forEach((channel) => {
        supabase.removeChannel(channel);
    });
    
    activeChannels = [];
}

/**
 * 取消特定订阅
 * @param {Object} channel - 订阅频道对象
 */
function unsubscribe(channel) {
    if (!channel) return;
    
    console.log('取消频道订阅');
    
    // 从活动频道列表中移除
    const index = activeChannels.indexOf(channel);
    if (index !== -1) {
        activeChannels.splice(index, 1);
    }
    
    // 取消订阅
    supabase.removeChannel(channel);
}

/**
 * 获取并监听用户积分变化
 * @param {string} userId - 用户ID
 * @param {Function} callback - 数据变化时的回调函数，接收最新积分值
 */
function watchUserPoints(userId, callback) {
    // 首先获取初始积分
    getUserById(userId)
        .then(user => {
            // 提供初始值
            callback(user.points || 0);
            
            // 然后监听变化
            subscribeToUserData(userId, (payload) => {
                if (payload.new && payload.new.points !== undefined) {
                    callback(payload.new.points);
                }
            });
        })
        .catch(error => {
            console.error('获取用户积分失败:', error);
        });
}

// 导出函数
window.subscribeToUserData = subscribeToUserData;
window.subscribeToUserTasks = subscribeToUserTasks;
window.subscribeToRankings = subscribeToRankings;
window.unsubscribe = unsubscribe;
window.unsubscribeAll = unsubscribeAll;
window.watchUserPoints = watchUserPoints;