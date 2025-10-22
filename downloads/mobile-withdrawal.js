// 提现功能实现
async function processWithdrawal(amount) {
    try {
        console.log('开始处理提现请求:', amount);
        
        // 1. 获取用户信息
        const userDataStr = localStorage.getItem('currentUser');
        if (!userDataStr) {
            throw new Error('未找到用户信息');
        }

        const userData = JSON.parse(userDataStr);
        const userId = userData.id || userData.用户ID;
        
        if (!userId) {
            throw new Error('未找到用户ID');
        }

        // 2. 计算实际可提现金额
        const { data: earnings, error: earningsError } = await window.supabase
            .from('earnings')
            .select('*')
            .eq('user_id', userId)
            .or('status.eq.已完成,status.eq.completed');

        if (earningsError) {
            throw new Error('获取收益记录失败: ' + earningsError.message);
        }

        // 计算总收益
        let totalEarnings = 0;
        earnings?.forEach(earning => {
            const earningAmount = parseFloat(earning.amount || earning.金额 || 0);
            totalEarnings += earningAmount;
        });

        // 获取已提现金额
        const { data: withdrawals, error: withdrawalsError } = await window.supabase
            .from('withdrawals')
            .select('*')
            .eq('user_id', userId);

        if (withdrawalsError) {
            throw new Error('获取提现记录失败: ' + withdrawalsError.message);
        }

        // 计算已提现总额
        let totalWithdrawn = 0;
        withdrawals?.forEach(withdrawal => {
            const withdrawalAmount = parseFloat(withdrawal.amount || withdrawal.金额 || 0);
            totalWithdrawn += withdrawalAmount;
        });

        // 计算实际可提现金额
        const availableBalance = totalEarnings - totalWithdrawn;
        console.log('方法1成功: 从earnings和计算可提现金额:', availableBalance);

        // 3. 验证余额
        if (availableBalance < amount) {
            throw new Error(`余额不足，当前余额: ${availableBalance}, 提现金额: ${amount}`);
        }

        // 4. 创建提现记录（尽量包含支付信息和提现方式；若表未升级则自动降级）
        
        // 🎯 获取用户的支付宝信息和提现方式
        const alipayAccount = userData.alipay_account || userData.支付宝账号 || '';
        const realName = userData.real_name || userData.真实姓名 || '';
        const wechatQRCode = userData.wechat_qr_code || userData.微信收款码 || '';
        
        // 🔍 判断用户选择的提现方式（更强劲的检测逻辑）
        let paymentMethod = 'alipay'; // 默认支付宝
        try {
            const alipayOption = document.getElementById('alipay-option');
            const wechatOption = document.getElementById('wechat-option');
            
            console.log('🔍 检查支付方式选择状态:');
            if (alipayOption) {
                console.log('支付宝选项状态:', alipayOption.classList.contains('active') ? 'active' : 'inactive');
            }
            if (wechatOption) {
                console.log('微信选项状态:', wechatOption.classList.contains('active') ? 'active' : 'inactive');
            }
            
            // 优先检查微信，因为支付宝是默认的
            if (wechatOption && wechatOption.classList.contains('active')) {
                paymentMethod = 'wechat';
                console.log('✅ 用户选择：微信支付');
            } else if (alipayOption && alipayOption.classList.contains('active')) {
                paymentMethod = 'alipay';
                console.log('✅ 用户选择：支付宝');
            } else {
                // 如果都没有active，根据实际支付信息智能判断
                if (wechatQRCode) {
                    paymentMethod = 'wechat';
                    console.log('🎯 根据微信信息推断：微信支付');
                } else if (alipayAccount) {
                    paymentMethod = 'alipay';
                    console.log('🎯 根据支付宝信息推断：支付宝');
                } else {
                    console.log('📌 使用默认支付方式：支付宝');
                }
            }
        } catch (e) {
            console.log('⚠️ 无法从DOM获取支付方式，使用智能推断');
            // 智能推断：如果有微信信息且没有支付宝信息，则选择微信
            if (wechatQRCode && !alipayAccount) {
                paymentMethod = 'wechat';
                console.log('🎯 智能推断：微信支付');
            } else {
                paymentMethod = 'alipay';
                console.log('🎯 智能推断：支付宝');
            }
        }
        
        console.log('💳 提现方式:', paymentMethod);
        console.log('💰 支付宝账号:', alipayAccount);
        console.log('👤 真实姓名:', realName);
        console.log('📱 微信收款码:', wechatQRCode ? '已设置' : '未设置');
        
        // 🔧 避免产生400错误：根据表结构动态决定是否带支付字段
        let withdrawal;
        let supportsPaymentFields = false;
        try {
            const cache = JSON.parse(localStorage.getItem('withdrawals_fields_cache') || 'null');
            if (cache && typeof cache === 'object') supportsPaymentFields = !!cache.hasPaymentMethod;
        } catch(_) {}

        const insertBaseRecord = async () => {
            const { data, error } = await window.supabase
                .from('withdrawals')
                .insert([{ user_id: userId, amount: amount, status: 'pending', created_at: new Date().toISOString() }])
                .select();
            if (error) throw new Error('基础提现记录保存失败: ' + error.message);
            console.log('✅ 基础提现记录保存成功');
            return data;
        };

        if (supportsPaymentFields) {
            try {
                console.log('🔄 已检测支持支付字段，尝试一次性保存完整信息...');
                const { data, error } = await window.supabase
                    .from('withdrawals')
                    .insert([{
                        user_id: userId,
                        amount: amount,
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        payment_method: paymentMethod,
                        alipay_account: alipayAccount,
                        real_name: realName,
                        wechat_qr_code: wechatQRCode
                    }])
                    .select();
                if (error) throw error;
                withdrawal = data;
                console.log('✅ 完整提现记录保存成功！');
            } catch (e) {
                console.log('⚠️ 完整保存失败，降级为基础字段。');
                withdrawal = await insertBaseRecord();
            }
        } else {
            // 直接使用基础字段，避免产生400
            withdrawal = await insertBaseRecord();
        }

        // 🔧 无论数据库是否支持，都保存支付方式信息到localStorage
        const withdrawalPaymentInfo = {
            withdrawalId: withdrawal[0]?.id,
            paymentMethod: paymentMethod,
            alipayAccount: alipayAccount,
            realName: realName,
            wechatQRCode: wechatQRCode,
            timestamp: new Date().toISOString()
        };
        
        // 保存当前提现的支付信息（用于admin后台显示）
        localStorage.setItem('lastWithdrawalPaymentInfo', JSON.stringify(withdrawalPaymentInfo));
        
        // 保存到历史记录数组
        const withdrawalHistory = JSON.parse(localStorage.getItem('withdrawalPaymentHistory') || '[]');
        withdrawalHistory.push(withdrawalPaymentInfo);
        // 只保留最近50条记录
        if (withdrawalHistory.length > 50) {
            withdrawalHistory.splice(0, withdrawalHistory.length - 50);
        }
        localStorage.setItem('withdrawalPaymentHistory', JSON.stringify(withdrawalHistory));
        
        console.log('✅ 支付方式信息已保存到localStorage:', withdrawalPaymentInfo);
        
        // 若基础保存成功且拿到ID，可尝试补写payment_method
        try {
            const id = withdrawal && withdrawal[0] && withdrawal[0].id;
            if (id && paymentMethod) {
                await window.supabase
                    .from('withdrawals')
                    .update({ payment_method: paymentMethod })
                    .eq('id', id);
                console.log('✅ 已补写提现方式到记录:', id, paymentMethod);
            }
        } catch(e) { console.warn('补写提现方式失败:', e?.message || e); }

        // 5. 更新用户余额
        const newBalance = availableBalance - amount;
        
        // 更新数据库
        const { error: updateError } = await window.supabase
            .from('users')
            .update({
                wallet_balance: newBalance
            })
            .eq('id', userId);

        if (updateError) {
            console.warn('更新数据库余额失败:', updateError);
        }

        // 更新本地存储
        userData.wallet_balance = newBalance;
        userData.钱包余额 = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('wallet_balance', newBalance.toString());
        localStorage.setItem('钱包余额', newBalance.toString());

        // 6. 触发余额更新事件
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
            detail: { balance: newBalance }
        }));

        // 7. 更新页面显示
        const walletBalanceElement = document.getElementById('wallet-balance');
        if (walletBalanceElement) {
            walletBalanceElement.textContent = newBalance.toFixed(2);
        }

        const withdrawableAmountElement = document.getElementById('withdrawable-amount');
        if (withdrawableAmountElement) {
            withdrawableAmountElement.textContent = newBalance.toFixed(2);
        }

        return {
            success: true,
            message: '提现申请已提交，金额已扣除',
            withdrawal: withdrawal
        };

    } catch (error) {
        console.error('提现失败:', error);
        throw error;
    }
}

// 导出函数
window.WithdrawalModule = {
    processWithdrawal: processWithdrawal
};