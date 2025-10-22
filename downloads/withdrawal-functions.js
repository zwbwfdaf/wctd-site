// 提现功能JavaScript文件
console.log('加载提现功能脚本...');

// 初始化 Supabase 客户端
const SUPABASE_URL = 'https://ybrveusbwjusnrzgfnok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicnZldXNid2p1c25yemdmbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODU1NjIsImV4cCI6MjA3MjA2MTU2Mn0.JKPSUli-q9wRuDagE6kwltLk9XgfygE8yznm-Ca82Qk';

let currentUser = null;
let availableBalance = 0;
let frozenAmount = 0;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('提现页面加载完成');
    checkUserLogin();
    loadUserBalance();
});

// 检查用户登录状态
function checkUserLogin() {
    const userDataStr = localStorage.getItem('currentUser');
    if (!userDataStr) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = JSON.parse(userDataStr);
}

// 加载用户余额
async function loadUserBalance() {
    try {
        if (!currentUser) return;
        
        const userId = currentUser.id || currentUser.用户ID;
        if (!userId) return;

        // 获取用户钱包余额
        const { data: userData, error: userError } = await window.supabase
            .from('users')
            .select('wallet_balance, 钱包余额')
            .eq('id', userId)
            .single();

        if (!userError && userData) {
            availableBalance = parseFloat(userData.wallet_balance || userData.钱包余额 || 0);
            document.getElementById('available-amount').textContent = `¥${availableBalance.toFixed(2)}`;
        }

        // 获取冻结金额（未完成的收益）
        const { data: earnings, error: earningsError } = await window.supabase
            .from('earnings')
            .select('amount, 金额, status, 状态')
            .eq('user_id', userId);

        if (!earningsError && earnings) {
            frozenAmount = earnings
                .filter(e => (e.status !== 'completed' && e.status !== '已完成'))
                .reduce((sum, e) => sum + parseFloat(e.amount || e.金额 || 0), 0);
            
            document.getElementById('frozen-amount').textContent = `¥${frozenAmount.toFixed(2)}`;
        }

    } catch (error) {
        console.error('加载用户余额失败:', error);
    }
}

// 选择提现方式
function selectPaymentMethod(method) {
    // 更新单选按钮状态
    document.getElementById('alipay').checked = method === 'alipay';
    document.getElementById('wechat').checked = method === 'wechat';
    
    // 更新表单显示
    if (method === 'alipay') {
        document.getElementById('alipay-form').style.display = 'block';
        document.getElementById('wechat-form').style.display = 'none';
    } else {
        document.getElementById('alipay-form').style.display = 'none';
        document.getElementById('wechat-form').style.display = 'block';
    }
}

// 全部提现
function withdrawAll() {
    document.getElementById('withdrawal-amount').value = availableBalance.toFixed(2);
}

// 处理收款码上传
function handleQRUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const qrPreview = document.getElementById('qr-preview');
        const uploadContent = document.getElementById('qr-upload-content');
        
        qrPreview.src = e.target.result;
        qrPreview.style.display = 'block';
        uploadContent.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// 提交提现申请
async function submitWithdrawal() {
    try {
        // 获取提现方式
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        
        // 获取提现金额
        const amount = parseFloat(document.getElementById('withdrawal-amount').value);
        if (!amount || amount < 1) {
            alert('请输入有效的提现金额（最低1元）');
            return;
        }
        
        if (amount > availableBalance) {
            alert('提现金额不能超过可用余额');
            return;
        }

        // 验证必填信息
        if (paymentMethod === 'alipay') {
            const account = document.getElementById('alipay-account').value.trim();
            const name = document.getElementById('alipay-name').value.trim();
            
            if (!account || !name) {
                alert('请填写完整的支付宝信息');
                return;
            }
        } else if (paymentMethod === 'wechat') {
            const name = document.getElementById('wechat-name').value.trim();
            const qrFile = document.getElementById('qr-file').files[0];
            
            if (!name) {
                alert('请填写真实姓名');
                return;
            }
            
            if (!qrFile) {
                alert('请上传微信收款码');
                return;
            }
        }

        // 禁用提交按钮
        const submitBtn = document.getElementById('submit-withdrawal');
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        // 准备提现数据
        const withdrawalData = {
            user_id: currentUser.id || currentUser.用户ID,
            amount: amount,
            payment_method: paymentMethod,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        if (paymentMethod === 'alipay') {
            withdrawalData.alipay_account = document.getElementById('alipay-account').value.trim();
            withdrawalData.real_name = document.getElementById('alipay-name').value.trim();
        } else if (paymentMethod === 'wechat') {
            withdrawalData.real_name = document.getElementById('wechat-name').value.trim();
            // 这里可以添加收款码图片上传逻辑
        }

        // 检查是否有未完成的提现
        const { data: existingWithdrawals, error: checkError } = await window.supabase
            .from('withdrawals')
            .select('id')
            .eq('user_id', withdrawalData.user_id)
            .eq('status', 'pending');

        if (!checkError && existingWithdrawals && existingWithdrawals.length > 0) {
            alert('您已有未完成的提现申请，请等待处理完成后再申请');
            submitBtn.disabled = false;
            submitBtn.textContent = '确认提现';
            return;
        }

        // 插入提现记录
        const { data: withdrawal, error: insertError } = await window.supabase
            .from('withdrawals')
            .insert([withdrawalData])
            .select();

        if (insertError) {
            console.error('创建提现记录失败:', insertError);
            alert('提现申请失败，请重试');
            submitBtn.disabled = false;
            submitBtn.textContent = '确认提现';
            return;
        }

        // 更新用户钱包余额
        const newBalance = availableBalance - amount;
        const { error: updateError } = await window.supabase
            .from('users')
            .update({ 
                wallet_balance: newBalance,
                钱包余额: newBalance
            })
            .eq('id', currentUser.id || currentUser.用户ID);

        if (updateError) {
            console.error('更新钱包余额失败:', updateError);
            // 即使余额更新失败，提现申请已创建，可以继续
        }

        // 显示成功消息
        alert('提现申请提交成功！我们将在3个工作日内处理您的提现请求。');
        
        // 返回钱包页面
        window.location.href = 'wallet.html';

    } catch (error) {
        console.error('提交提现申请失败:', error);
        alert('提现申请失败，请重试');
        
        const submitBtn = document.getElementById('submit-withdrawal');
        submitBtn.disabled = false;
        submitBtn.textContent = '确认提现';
    }
}

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', function() {
    // 绑定提现方式选择事件
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', function() {
            selectPaymentMethod(this.value);
        });
    });
});

console.log('提现功能脚本加载完成');


