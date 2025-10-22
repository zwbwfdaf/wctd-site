// 收益页面控制器
async function initializeEarningsPage() {
    // 初始化事件监听
    document.querySelectorAll('.btn-add').forEach(button => {
        button.addEventListener('click', function() {
            const pageId = this.closest('.page-content').id;
            showAddEarningModal(pageId);
        });
    });
}

// 显示添加收益弹窗
function showAddEarningModal(pageId) {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>添加收益</h3>
                <button class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="addEarningForm">
                    <div class="form-group">
                        <label for="userId">用户ID</label>
                        <input type="text" id="userId" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="amount">金额</label>
                        <input type="number" id="amount" class="form-control" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="taskType">任务类型</label>
                        <select id="taskType" class="form-control" required>
                            <option value="夸克搜索">夸克搜索</option>
                            <option value="网盘推广">网盘推广</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn-save" onclick="handleAddEarning()">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 根据页面ID预设任务类型
    const taskTypeSelect = modal.querySelector('#taskType');
    if (pageId === 'quark-earnings') {
        taskTypeSelect.value = '夸克搜索';
        taskTypeSelect.disabled = true;
    } else if (pageId === 'wukong-earnings') {
        taskTypeSelect.value = '悟空搜索';
        taskTypeSelect.disabled = true;
    }
}

// 处理添加收益
async function handleAddEarning() {
    try {
        const userId = document.getElementById('userId').value;
        const amount = document.getElementById('amount').value;
        const taskType = document.getElementById('taskType').value;

        if (!userId || !amount || !taskType) {
            alert('请填写完整信息');
            return;
        }

        // 添加收益记录
        const { data, error } = await window.supabase
            .from('earnings')
            .insert([
                {
                    user_id: userId,
                    amount: amount,
                    task_type: taskType,
                    任务类型: taskType,
                    description: `${taskType}任务收益`,
                    任务描述: `${taskType}任务收益`,
                    status: '已完成',
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            throw error;
        }

        // 更新用户钱包余额
        const { data: userData, error: userError } = await window.supabase
            .from('users')
            .select('wallet_balance, 钱包余额')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error('获取用户余额失败:', userError);
            return;
        }

        const currentBalance = parseFloat(userData.wallet_balance || userData.钱包余额 || 0);
        const newBalance = currentBalance + parseFloat(amount);

        const { error: updateError } = await window.supabase
            .from('users')
            .update({
                wallet_balance: newBalance,
                钱包余额: newBalance
            })
            .eq('id', userId);

        if (updateError) {
            console.error('更新用户余额失败:', updateError);
            return;
        }

        // 关闭模态框并刷新页面
        document.querySelector('.modal').remove();
        location.reload();

    } catch (error) {
        console.error('添加收益失败:', error);
        alert('添加收益失败: ' + error.message);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeEarningsPage);