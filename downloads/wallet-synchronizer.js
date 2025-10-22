// 全局钱包余额同步器
// 此脚本用于确保钱包余额在所有页面间保持一致

// 立即执行的匿名函数，防止全局变量污染
(function() {
    // 初始化
    console.log('全局钱包余额同步器已加载');
    
    // 当DOM加载完成后执行
    document.addEventListener('DOMContentLoaded', function() {
        initWalletSynchronizer();
    });
    
    // 初始化钱包同步器
    function initWalletSynchronizer() {
        console.log('初始化钱包同步器...');
        
        // 1. 从localStorage获取用户数据
        const userDataStr = localStorage.getItem('currentUser');
        if (!userDataStr) {
            console.log('未找到用户数据，可能未登录');
            return;
        }
        
        // 2. 解析用户数据
        try {
            const userData = JSON.parse(userDataStr);
            
            // 3. 查找钱包余额并更新所有显示位置
            updateAllWalletDisplays(userData);
            
            // 4. 设置定期检查和同步
            setupPeriodicSync();
            
            // 5. 设置页面间通信
            setupCrossPagesSync();
            
            // 6. 立即从服务器获取最新数据
            fetchLatestWalletData(userData);
            
        } catch (error) {
            console.error('初始化钱包同步器出错:', error);
        }
    }
    
    // 更新所有钱包余额显示
    function updateAllWalletDisplays(userData) {
        console.log('更新所有钱包余额显示...');
        
        // 查找可能的钱包字段
        const possibleFields = ['wallet_balance', '钱包余额', 'balance', '余额', 'wallet'];
        let balance = 0;
        let foundField = null;
        
        // 尝试找到钱包余额字段
        for (const field of possibleFields) {
            if (field in userData && userData[field] !== null) {
                balance = parseFloat(userData[field]);
                foundField = field;
                console.log(`找到钱包字段: ${field}, 值: ${balance}`);
                break;
            }
        }
        
        // 如果没有找到钱包字段，使用默认字段并设置为0
        if (foundField === null) {
            console.log('未找到钱包字段，使用默认字段wallet_balance并设置为0');
            userData.wallet_balance = 0;
            balance = 0;
            foundField = 'wallet_balance';
            
            // 更新本地存储
            localStorage.setItem('currentUser', JSON.stringify(userData));
        }
        
        // 更新所有可能显示钱包余额的元素
        
        // 1. 在首页和个人中心页的钱包余额显示
        const walletBalanceElements = document.querySelectorAll('#wallet-balance, #wallet-amount');
        walletBalanceElements.forEach(element => {
            if (element) {
                element.textContent = balance.toFixed(2);
                console.log(`更新钱包余额显示元素: ${element.id} -> ${balance.toFixed(2)}`);
            }
        });
        
        // 2. 钱包页面的总资产显示
        const totalAssetElements = document.querySelectorAll('h1, h2, h3').forEach(element => {
            if (element.textContent.includes('¥') && 
                (element.textContent.includes('0.00') || 
                 element.textContent.includes('总资产'))) {
                element.textContent = `¥${balance.toFixed(2)}`;
                console.log(`更新总资产显示 -> ${balance.toFixed(2)}`);
            }
        });
        
        // 3. 其他可能的显示位置
        document.querySelectorAll('.balance, .amount, .wallet-balance').forEach(element => {
            if (element.textContent.includes('¥') || 
                element.textContent.includes('￥')) {
                element.textContent = `¥${balance.toFixed(2)}`;
                console.log(`更新其他余额显示 -> ${balance.toFixed(2)}`);
            }
        });
    }
    
    // 设置定期检查和同步
    function setupPeriodicSync() {
        // 每30秒检查一次
        setInterval(function() {
            console.log('执行定期钱包同步...');
            
            const userDataStr = localStorage.getItem('currentUser');
            if (!userDataStr) return;
            
            const userData = JSON.parse(userDataStr);
            fetchLatestWalletData(userData);
        }, 30000);
    }
    
    // 设置页面间通信
    function setupCrossPagesSync() {
        // 使用localStorage变更事件进行页面间通信
        window.addEventListener('storage', function(e) {
            if (e.key === 'currentUser') {
                console.log('检测到用户数据变更，更新钱包显示');
                
                if (e.newValue) {
                    try {
                        const userData = JSON.parse(e.newValue);
                        updateAllWalletDisplays(userData);
                    } catch (error) {
                        console.error('解析用户数据出错:', error);
                    }
                }
            }
        });
    }
    
    // 从服务器获取最新钱包数据
    async function fetchLatestWalletData(userData) {
        console.log('从服务器获取最新钱包数据...');
        
        try {
            // 确保Supabase客户端已初始化
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                console.log('Supabase客户端未初始化或from方法不可用，尝试重新初始化...');
                const SUPABASE_URL = 'https://ybrveusbwjusnrzgfnok.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicnZldXNid2p1c25yemdmbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODU1NjIsImV4cCI6MjA3MjA2MTU2Mn0.JKPSUli-q9wRuDagE6kwltLk9XgfygE8yznm-Ca82Qk';
                
                try {
                    // 尝试从不同来源获取createClient方法
                    if (window.supabase && typeof window.supabase.createClient === 'function') {
                        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                        console.log('使用window.supabase.createClient重新初始化成功');
                    } else if (window.supabaseJs && typeof window.supabaseJs.createClient === 'function') {
                        window.supabase = window.supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                        console.log('使用window.supabaseJs.createClient重新初始化成功');
                    } else {
                        // 尝试加载Supabase脚本
                        console.log('无法获取Supabase客户端，将使用本地数据');
                        // 仅使用本地数据更新显示
                        updateAllWalletDisplays(userData);
                        return;
                    }
                } catch (initError) {
                    console.error('初始化Supabase客户端失败:', initError);
                    // 仅使用本地数据更新显示
                    updateAllWalletDisplays(userData);
                    return;
                }
            }
            
            // 从用户数据中获取用户ID
            const userId = userData.id || userData.用户ID;
            if (!userId) {
                console.error('无法获取用户ID');
                return;
            }
            
            console.log('查询用户ID:', userId, '的最新数据');
            
            try {
                // 先尝试使用id字段查询
                let { data, error } = await window.supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();
                    
                // 如果使用id字段查询失败，尝试使用用户ID字段查询
                if (error) {
                    console.warn('使用id字段查询失败，尝试使用用户ID字段...');
                    
                    ({ data, error } = await window.supabase
                        .from('users')
                        .select('*')
                        .eq('用户ID', userId)
                        .single());
                }
                
                // 如果获取到数据
                if (!error && data) {
                    console.log('获取到最新用户数据:', data);
                    
                    // 查找钱包余额字段
                    const possibleFields = ['wallet_balance', '钱包余额', 'balance', '余额', 'wallet'];
                    let serverBalance = null;
                    let serverField = null;
                    
                    for (const field of possibleFields) {
                        if (field in data && data[field] !== null) {
                            serverBalance = parseFloat(data[field]);
                            serverField = field;
                            console.log(`服务器数据中找到钱包字段: ${field}, 值: ${serverBalance}`);
                            break;
                        }
                    }
                    
                    // 如果服务器上有钱包余额
                    if (serverBalance !== null) {
                        // 更新本地存储中的用户数据
                        const localUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
                        
                        // 检查余额是否不同
                        const localBalance = parseFloat(
                            localUserData.wallet_balance || 
                            localUserData.钱包余额 || 
                            localUserData.balance || 
                            localUserData.余额 || 
                            localUserData.wallet || 
                            0
                        );
                        
                        if (localBalance !== serverBalance) {
                            console.log(`钱包余额不同 - 本地: ${localBalance}, 服务器: ${serverBalance}, 更新本地数据`);
                            
                            // 更新所有可能的钱包字段
                            for (const field of possibleFields) {
                                if (field in data) {
                                    localUserData[field] = data[field];
                                }
                            }
                            
                            // 保存回本地存储
                            localStorage.setItem('currentUser', JSON.stringify(localUserData));
                            
                            // 更新显示
                            updateAllWalletDisplays(localUserData);
                        } else {
                            console.log('本地钱包余额与服务器一致，无需更新');
                        }
                    } else {
                        console.warn('服务器数据中未找到钱包余额字段');
                    }
                } else {
                    console.error('获取最新用户数据失败:', error);
                }
            } catch (queryError) {
                console.error('查询用户数据失败:', queryError);
                // 仅使用本地数据更新显示
                updateAllWalletDisplays(userData);
            }
        } catch (error) {
            console.error('获取最新钱包数据出错:', error);
            // 仅使用本地数据更新显示
            updateAllWalletDisplays(userData);
        }
    }
    
    // 暴露全局方法以便其他脚本调用
    window.walletSynchronizer = {
        updateAllDisplays: updateAllWalletDisplays,
        fetchLatestData: fetchLatestWalletData
    };
})();