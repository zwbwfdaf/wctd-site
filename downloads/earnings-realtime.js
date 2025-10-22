// 收益功能实时更新模块
// 依赖Supabase的实时订阅功能

/**
 * 初始化收益模块
 * @param {Object} supabase - Supabase客户端实例
 */
let earningsChannel = null;

/**
 * 初始化收益实时更新功能
 * @param {Object} supabase - Supabase客户端实例
 * @param {string} userId - 当前用户ID
 * @param {Function} onEarningsUpdate - 收益更新时的回调函数
 * @returns {Object} - 包含控制函数的对象
 */
function initEarningsRealtime(supabase, userId, onEarningsUpdate) {
    if (!supabase || !userId) {
        console.error('初始化收益实时更新失败：缺少必要参数');
        return null;
    }

    console.log('正在初始化收益实时更新...');

    // 订阅收益表的变化
    earningsChannel = supabase
        .channel('earnings-changes')
        .on(
            'postgres_changes',
            {
                event: '*', // 监听所有事件（insert, update, delete）
                schema: 'public',
                table: 'earnings',
                filter: `user_id=eq.${userId}`
            },
            (payload) => {
                console.log('收到收益更新:', payload);
                if (onEarningsUpdate && typeof onEarningsUpdate === 'function') {
                    onEarningsUpdate(payload);
                }
                
                // 刷新用户界面上的收益数据
                refreshEarningsData(supabase, userId);
                
                // 显示实时更新通知
                showSyncNotification('收益数据已更新');
            }
        )
        .subscribe();

    // 初始加载用户收益数据
    refreshEarningsData(supabase, userId);

    return {
        // 停止实时更新
        stop: () => {
            if (earningsChannel) {
                earningsChannel.unsubscribe();
                earningsChannel = null;
                console.log('已停止收益实时更新');
            }
        },
        
        // 刷新收益数据
        refresh: () => refreshEarningsData(supabase, userId)
    };
}

/**
 * 显示同步通知
 * @param {string} message - 通知消息
 */
function showSyncNotification(message) {
    try {
        // 创建通知元素
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'fixed bottom-24 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notificationDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-sync-alt fa-spin mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notificationDiv);
        
        // 2秒后自动移除
        setTimeout(() => {
            if (document.body.contains(notificationDiv)) {
                document.body.removeChild(notificationDiv);
            }
        }, 2000);
    } catch (error) {
        console.error('显示同步通知时出错:', error);
    }
}

/**
 * 刷新用户界面上的收益数据
 * @param {Object} supabase - Supabase客户端实例
 * @param {string} userId - 用户ID
 */
async function refreshEarningsData(supabase, userId) {
    try {
        console.log('刷新收益数据, 用户ID:', userId);
        
        // 获取用户总收益和今日收益
        const { data: earningsData, error: earningsError } = await supabase
            .from('user_earnings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
            
        if (earningsError) {
            console.warn('获取用户总收益失败:', earningsError);
            // 如果不存在视图，尝试手动计算
            await calculateAndUpdateEarnings(supabase, userId);
        } else if (earningsData) {
            updateEarningsUI(earningsData, []);
        } else {
            console.warn('没有找到用户收益数据，尝试手动计算');
            await calculateAndUpdateEarnings(supabase, userId);
        }
        
        // 获取收益记录
        const { data: earningsRecords, error: recordsError } = await supabase
            .from('earnings')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (recordsError) {
            console.error('获取收益记录失败:', recordsError);
        } else {
            // 更新UI中的收益记录列表
            if (typeof window.displayEarningRecords === 'function') {
                window.displayEarningRecords(earningsRecords || []);
            } else {
                updateEarningsRecordsUI(earningsRecords || []);
            }
        }
        
    } catch (error) {
        console.error('刷新收益数据失败:', error);
    }
}

/**
 * 手动计算并更新收益
 * @param {Object} supabase - Supabase客户端实例
 * @param {string} userId - 用户ID
 */
async function calculateAndUpdateEarnings(supabase, userId) {
    try {
        console.log('手动计算收益数据, 用户ID:', userId);
        
        // 获取所有收益记录
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .eq('user_id', userId);
            
        if (error) {
            console.error('获取收益记录失败:', error);
            return;
        }
        
        if (!earnings || earnings.length === 0) {
            console.log('没有找到收益记录');
            
            // 使用空数据更新UI
            updateEarningsUI({
                total_earnings: 0,
                today_earnings: 0,
                total_tasks_completed: 0
            }, []);
            
            return;
        }
        
        // 计算总收益和今日收益
        let totalEarnings = 0;
        let todayEarnings = 0;
        let completedTasks = 0;
        
        // 获取今天的日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        earnings.forEach(earning => {
            const status = earning.status || earning.状态 || '';
            
            // 只计算已完成且未提现的收益
            if ((status === 'completed' || status === '已完成') && 
                status !== 'withdrawn' && status !== '已提现') {
                
                const amount = parseFloat(earning.amount || earning.金额 || 0);
                totalEarnings += amount;
                completedTasks++;
                
                // 检查是否是今天的收益
                const createdAt = new Date(earning.created_at || earning.创建时间);
                if (createdAt >= today) {
                    todayEarnings += amount;
                }
            }
        });
        
        const earningsData = {
            total_earnings: totalEarnings,
            today_earnings: todayEarnings,
            total_tasks_completed: completedTasks
        };
        
        console.log('计算的收益数据:', earningsData);
        
        // 更新UI
        updateEarningsUI(earningsData, earnings);
        
    } catch (error) {
        console.error('计算收益数据失败:', error);
    }
}

/**
 * 更新收益相关UI元素
 * @param {Object} earningsData - 收益统计数据
 * @param {Array} earningsRecords - 收益记录列表
 */
function updateEarningsUI(earningsData, earningsRecords) {
    // 更新总收益
    const totalEarningsElements = document.querySelectorAll('#total-income, .total-earnings');
    totalEarningsElements.forEach(el => {
        if (el) el.textContent = `${earningsData.total_earnings?.toFixed(2) || '0.00'}`;
    });
    
    // 更新今日收益
    const todayEarningsElements = document.querySelectorAll('#today-income, .today-earnings');
    todayEarningsElements.forEach(el => {
        if (el) el.textContent = `${earningsData.today_earnings?.toFixed(2) || '0.00'}`;
    });
    
    // 更新可提现收益（与总收益相同）
    const withdrawableElements = document.querySelectorAll('#withdrawable-amount, .withdrawable-earnings');
    withdrawableElements.forEach(el => {
        if (el) el.textContent = `${earningsData.total_earnings?.toFixed(2) || '0.00'}`;
    });
    
    // 更新完成任务数
    const completedTasksElements = document.querySelectorAll('.completed-tasks-count');
    completedTasksElements.forEach(el => {
        if (el) el.textContent = earningsData.total_tasks_completed || '0';
    });
    
    // 如果有收益记录且没有使用displayEarningRecords函数，则更新收益记录列表
    if (earningsRecords && earningsRecords.length > 0) {
        updateEarningsRecordsUI(earningsRecords);
    }
}

/**
 * 更新收益记录UI
 * @param {Array} earningsRecords - 收益记录列表
 */
function updateEarningsRecordsUI(earningsRecords) {
    // 更新收益记录列表
    const earningsContainer = document.getElementById('earnings-container');
    if (!earningsContainer) return;
    
    // 如果没有收益数据，显示提示信息
    if (!earningsRecords || earningsRecords.length === 0) {
        earningsContainer.innerHTML = '<div class="flex items-center justify-center py-4 text-gray-500">暂无收益记录</div>';
        return;
    }
    
    // 清空现有内容
    earningsContainer.innerHTML = '';
    
    // 添加收益记录
    earningsRecords.forEach((earning, index) => {
        // 处理可能的中文字段名
        const taskName = earning.task_name || earning.任务名称 || '未知任务';
        const amount = parseFloat(earning.amount || earning.金额 || 0).toFixed(2);
        const createdAt = earning.created_at || earning.创建时间 || new Date().toISOString();
        const status = earning.status || earning.状态 || '已完成';
        
        const earningDiv = document.createElement('div');
        earningDiv.className = 'flex items-center justify-between py-2 border-b border-gray-100';
        
        // 如果是最后一个记录，移除底部边框
        if (index === earningsRecords.length - 1) {
            earningDiv.classList.remove('border-b', 'border-gray-100');
        }
        
        // 设置收益记录的HTML内容
        earningDiv.innerHTML = `
            <div>
                <p class="font-medium text-gray-800 text-sm">${taskName}</p>
                <p class="text-gray-500 text-xs">${new Date(createdAt).toLocaleString()}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-green-600">+¥${amount}</p>
                <p class="text-gray-500 text-xs">${status}</p>
            </div>
        `;
        
        // 添加到容器
        earningsContainer.appendChild(earningDiv);
    });
}

/**
 * 添加新的收益记录
 * @param {Object} supabase - Supabase客户端实例
 * @param {string} userId - 用户ID
 * @param {string} taskName - 任务名称
 * @param {number} amount - 收益金额
 * @param {string} [description] - 可选描述
 * @param {string} [taskId] - 可选关联任务ID
 * @returns {Promise<Object>} - 添加结果
 */
async function addEarningRecord(supabase, userId, taskName, amount, description = '', taskId = null) {
    try {
        // 确保必要的参数存在
        if (!supabase || !userId || !taskName || !amount) {
            throw new Error('缺少必要参数');
        }
        
        // 准备数据
        const earningData = {
            user_id: userId,
            task_name: taskName,
            amount: parseFloat(amount),
            description: description,
            task_id: taskId,
            status: 'completed', // 默认状态为已完成
            created_at: new Date().toISOString() // 添加创建时间
        };
        
        console.log('准备添加收益记录:', earningData);
        
        // 插入数据到Supabase
        const { data, error } = await supabase
            .from('earnings')
            .insert([earningData])
            .select();
            
        if (error) throw error;
        
        console.log('成功添加收益记录:', data);
        return { success: true, data };
        
    } catch (error) {
        console.error('添加收益记录失败:', error);
        return { success: false, error };
    }
}

/**
 * 更新用户总积分
 * @param {Object} supabase - Supabase客户端实例
 * @param {string} userId - 用户ID
 * @param {number} amount - 要增加的金额
 * @returns {Promise<Object>} - 更新结果
 */
async function updateUserPoints(supabase, userId, amount) {
    try {
        // 获取当前积分
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('points, username')
            .eq('id', userId)
            .single();
            
        if (fetchError) throw fetchError;
        
        // 计算新积分
        const currentPoints = userData.points || 0;
        const newPoints = currentPoints + amount;
        
        // 更新积分
        const { data, error: updateError } = await supabase
            .from('users')
            .update({ points: newPoints })
            .eq('id', userId)
            .select();
            
        if (updateError) throw updateError;
        
        console.log(`成功更新用户 ${userData.username} 的积分: ${currentPoints} -> ${newPoints}`);
        return { success: true, data };
        
    } catch (error) {
        console.error('更新用户积分失败:', error);
        return { success: false, error };
    }
}

// 导出模块函数
window.EarningsModule = {
    initEarningsRealtime,
    addEarningRecord,
    updateUserPoints,
    refreshEarningsData,
    showSyncNotification
};