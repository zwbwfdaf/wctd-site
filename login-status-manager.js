/**
 * 登录状态管理系统
 * 负责管理登录状态、网络检测、安全验证和UI反馈
 */

class LoginStatusManager {
    constructor() {
        this.loginStates = {
            IDLE: 'idle',           // 待登录
            CONNECTING: 'connecting', // 连接中
            AUTHENTICATING: 'authenticating', // 验证中
            SUCCESS: 'success',     // 登录成功
            FAILED: 'failed',       // 登录失败
            NETWORK_ERROR: 'network_error', // 网络错误
            SERVER_ERROR: 'server_error'    // 服务器错误
        };
        
        this.currentState = this.loginStates.IDLE;
        this.supabase = null;
        this.networkStatus = navigator.onLine;
        this.securityChecks = {
            rateLimit: new Map(),
            maxAttempts: 5,
            lockoutTime: 15 * 60 * 1000 // 15分钟
        };
        
        // 内存后备存储（Safari 私密模式/受限环境）
        this._memoryStore = {};

        this.init();
    }
    
    // 初始化登录状态管理器
    init() {
        console.log('🔐 初始化登录状态管理器...');
        
        // 尝试从全局修复器获取客户端，避免空引用
        try {
            const emergencyClient = (typeof window.getEmergencyClient === 'function') ? window.getEmergencyClient() : null;
            if (emergencyClient) {
                this.supabase = emergencyClient;
                console.log('📡 已从紧急修复器获取 Supabase 客户端');
            }
        } catch (e) {}
        
        // 设置网络状态监听
        this.setupNetworkListeners();
        
        // 初始化安全检查
        this.initSecurityChecks();
        
        // 绑定UI事件
        this.bindUIEvents();
        
        console.log('✅ 登录状态管理器初始化完成');
    }

    // 监听网络状态变化
    setupNetworkListeners() {
        try {
            const update = () => {
                this.networkStatus = navigator.onLine;
                this.updateNetworkStatus(this.networkStatus);
            };
            window.addEventListener('online', update);
            window.addEventListener('offline', update);
            // 首次同步
            update();
        } catch (e) {
            console.warn('setupNetworkListeners 失败:', e);
        }
    }

    // 初始化安全校验参数
    initSecurityChecks() {
        try {
            if (!this.securityChecks || typeof this.securityChecks !== 'object') {
                this.securityChecks = { rateLimit: new Map(), maxAttempts: 5, lockoutTime: 15 * 60 * 1000 };
            }
            if (!(this.securityChecks.rateLimit instanceof Map)) {
                this.securityChecks.rateLimit = new Map();
            }
        } catch (e) {
            console.warn('initSecurityChecks 失败:', e);
        }
    }

    // 绑定页面交互事件
    bindUIEvents() {
        try {
            const form = document.getElementById('login-form-content');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }
            // Enter 键快捷登录
            const usernameInput = document.getElementById('login-username');
            const passwordInput = document.getElementById('login-password');
            [usernameInput, passwordInput].forEach((el) => {
                if (el) {
                    el.addEventListener('keyup', (ev) => {
                        if (ev.key === 'Enter') {
                            ev.preventDefault();
                            this.handleLogin();
                        }
                    });
                }
            });
        } catch (e) {
            console.warn('bindUIEvents 失败:', e);
        }
    }
    
    // 保障 this.supabase 可用
    async ensureClient() {
        if (this.supabase) return this.supabase;
        // 尝试从全局获取
        if (typeof window.getEmergencyClient === 'function') {
            const c = window.getEmergencyClient();
            if (c) { this.supabase = c; return c; }
        }
        // 如仍不可用，尝试初始化紧急修复器
        if (typeof window.emergencyInitDatabase === 'function') {
            try {
                await window.emergencyInitDatabase();
                if (typeof window.getEmergencyClient === 'function') {
                    const c2 = window.getEmergencyClient();
                    if (c2) { this.supabase = c2; return c2; }
                }
            } catch (e) {
                console.warn('ensureClient 初始化失败:', e);
            }
        }
        throw new Error('数据库连接未初始化');
    }
    
    // 设置Supabase客户端
    setSupabaseClient(supabaseClient) {
        this.supabase = supabaseClient;
        console.log('📡 Supabase客户端已设置');
    }
    
    // 获取当前状态
    getCurrentState() {
        return this.currentState;
    }
    
    // 更新状态
    setState(newState, message = '') {
        const oldState = this.currentState;
        this.currentState = newState;
        
        console.log(`🔄 状态变更: ${oldState} → ${newState}${message ? ' (' + message + ')' : ''}`);
        
        // 更新UI
        this.updateUI(newState, message);
        
        // 触发状态变更事件
        this.dispatchStateChangeEvent(oldState, newState, message);
    }
    
    // 更新UI
    updateUI(state, message = '') {
        const loginButton = document.querySelector('#login-form-content button[type="submit"]');
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        
        if (!loginButton) return;
        
        // 重置按钮状态
        loginButton.disabled = false;
        loginButton.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>登录';
        
        switch (state) {
            case this.loginStates.IDLE:
                this.clearErrorMessages();
                break;
                
            case this.loginStates.CONNECTING:
                loginButton.disabled = true;
                loginButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>连接中...';
                this.showInfo('正在连接服务器...');
                break;
                
            case this.loginStates.AUTHENTICATING:
                loginButton.disabled = true;
                loginButton.innerHTML = '<i class="fas fa-key fa-pulse mr-2"></i>验证中...';
                this.showInfo('正在验证用户信息...');
                break;
                
            case this.loginStates.SUCCESS:
                loginButton.disabled = true;
                loginButton.innerHTML = '<i class="fas fa-check mr-2"></i>登录成功';
                loginButton.classList.add('bg-green-500');
                this.showSuccess(message || '登录成功，正在跳转...');
                break;
                
            case this.loginStates.FAILED:
                this.showError(message || '登录失败，请检查用户名和密码');
                break;
                
            case this.loginStates.NETWORK_ERROR:
                this.showError('网络连接错误，请检查网络设置');
                break;
                
            case this.loginStates.SERVER_ERROR:
                this.showError(message || '服务器错误，请稍后重试');
                break;
        }
        
        // 控制输入框状态
        if (usernameInput && passwordInput) {
            const isProcessing = [this.loginStates.CONNECTING, this.loginStates.AUTHENTICATING].includes(state);
            usernameInput.disabled = isProcessing;
            passwordInput.disabled = isProcessing;
        }
    }
    
    // 更新网络状态UI
    updateNetworkStatus(isOnline) {
        const networkIndicator = document.getElementById('network-status');
        if (networkIndicator) {
            networkIndicator.className = isOnline ? 'network-online' : 'network-offline';
            networkIndicator.textContent = isOnline ? '网络正常' : '网络断开';
        }
        
        if (!isOnline && this.currentState !== this.loginStates.IDLE) {
            this.setState(this.loginStates.NETWORK_ERROR, '网络连接已断开');
        }
    }
    
    // 处理登录
    async handleLogin() {
        const username = document.getElementById('login-username')?.value.trim();
        const password = document.getElementById('login-password')?.value;
        
        // 基础验证
        if (!this.validateInput(username, password)) {
            return;
        }
        
        // 安全检查
        if (!this.performSecurityChecks(username)) {
            return;
        }
        
        // 网络检查
        if (!this.networkStatus) {
            this.setState(this.loginStates.NETWORK_ERROR);
            return;
        }
        
        try {
            // 简化登录流程 - 直接进入验证（内置连接检查）
            this.setState(this.loginStates.AUTHENTICATING, '登录中...');
            
            // 直接验证用户（包含超时机制）
            const user = await this.authenticateUser(username, password);
            
            if (user) {
                // 登录成功
                this.setState(this.loginStates.SUCCESS, '登录成功');
                this.handleLoginSuccess(user);
            } else {
                this.setState(this.loginStates.FAILED, '用户名或密码错误');
                this.recordFailedAttempt(username);
            }
            
        } catch (error) {
            console.error('登录过程中发生错误:', error);
            
            if (error.message.includes('network') || error.message.includes('fetch')) {
                this.setState(this.loginStates.NETWORK_ERROR, '网络连接失败');
            } else if (error.message.includes('insecure') || error.message.includes('security')) {
                this.setState(this.loginStates.SERVER_ERROR, '安全验证失败，请稍后重试');
            } else {
                this.setState(this.loginStates.SERVER_ERROR, error.message);
            }
            
            this.recordFailedAttempt(username);
        }
    }
    
    // 验证输入
    validateInput(username, password) {
        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return false;
        }
        
        if (username.length < 2) {
            this.showError('用户名至少需要2个字符');
            return false;
        }
        
        if (password.length < 3) {
            this.showError('密码至少需要3个字符');
            return false;
        }
        
        // 检查特殊字符
        const usernameRegex = /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/;
        if (!usernameRegex.test(username)) {
            this.showError('用户名只能包含字母、数字、中文、下划线和连字符');
            return false;
        }
        
        return true;
    }
    
    // 执行安全检查
    performSecurityChecks(username) {
        const clientIP = this.getClientIP();
        const checkKey = `${username}_${clientIP}`;
        const now = Date.now();
        
        if (this.securityChecks.rateLimit.has(checkKey)) {
            const attemptData = this.securityChecks.rateLimit.get(checkKey);
            
            // 检查是否在锁定期内
            if (now - attemptData.firstAttempt < this.securityChecks.lockoutTime && 
                attemptData.attempts >= this.securityChecks.maxAttempts) {
                const remainingTime = Math.ceil((this.securityChecks.lockoutTime - (now - attemptData.firstAttempt)) / 60000);
                this.showError(`登录尝试过多，请等待 ${remainingTime} 分钟后重试`);
                return false;
            }
        }
        
        return true;
    }
    
    // 记录失败尝试
    recordFailedAttempt(username) {
        const clientIP = this.getClientIP();
        const checkKey = `${username}_${clientIP}`;
        const now = Date.now();
        
        if (this.securityChecks.rateLimit.has(checkKey)) {
            const attemptData = this.securityChecks.rateLimit.get(checkKey);
            attemptData.attempts++;
            attemptData.lastAttempt = now;
        } else {
            this.securityChecks.rateLimit.set(checkKey, {
                attempts: 1,
                firstAttempt: now,
                lastAttempt: now
            });
        }
    }
    
    // 获取客户端IP（简化版）
    getClientIP() {
        return 'client_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 检查数据库连接 - 优化版本（添加超时机制）
    async checkDatabaseConnection() {
        const c = await this.ensureClient();
        try {
            // 添加3秒超时机制
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('数据库连接超时')), 3000);
            });
            
            const checkPromise = c
                .from('users')
                .select('id')
                .limit(1);
            
            const { error } = await Promise.race([checkPromise, timeoutPromise]);
                
            if (error) {
                if (error.code === '42P01') {
                    throw new Error('用户表不存在，请联系管理员');
                } else if (error.code === '42501') {
                    throw new Error('数据库访问权限不足');
                } else {
                    throw new Error('数据库连接失败');
                }
            }
        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('超时')) {
                throw new Error('数据库连接超时，请检查网络');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('网络连接失败');
            } else {
                throw new Error(error.message || '数据库连接失败');
            }
        }
    }
    
    // 验证用户 - 更健壮：自动在中英列名间切换并回退
    async authenticateUser(username, password) {
        const c = await this.ensureClient();
        try {
            const timeoutPromise = new Promise((_, reject) => { setTimeout(() => reject(new Error('用户验证超时')), 8000); });
            const exec = async () => {
                const usernameCols = ['username', '用户名'];
                const passwordCols = ['password', '密码'];
                for (let uCol of usernameCols) {
                    for (let pCol of passwordCols) {
                        try {
                            const { data, error } = await c
                                .from('users')
                                .select('*')
                                .eq(uCol, username)
                                .eq(pCol, password)
                                .limit(1);
                            if (!error && data && data.length) {
                                return data[0];
                            }
                            if (error) {
                                const msg = String(error.message || '');
                                // 列不存在则尝试下一种组合
                                if (msg.includes('column') && msg.includes('does not exist')) continue;
                                if (/(fetch|network|Failed to fetch)/i.test(msg)) throw new Error('网络连接失败');
                                // 其他错误直接抛出
                                throw new Error(msg);
                            }
                        } catch (e) {
                            const msg = String(e.message || '');
                            if (msg.includes('column') && msg.includes('does not exist')) continue;
                            throw e;
                        }
                    }
                }
                // 没有命中任何组合，视为用户名或密码错误
                return null;
            };
            return await Promise.race([exec(), timeoutPromise]);
        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('超时')) {
                throw new Error('用户验证超时，请检查网络');
            } else if ((error.message||'').match(/fetch|network|Failed to fetch/i)) {
                throw new Error('网络连接失败');
            } else {
                throw new Error(error.message || '用户验证失败');
            }
        }
    }
    
    // 处理登录成功
    handleLoginSuccess(user) {
        // 清理失败记录
        const clientIP = this.getClientIP();
        const uname = user.username || user['用户名'] || '';
        const checkKey = `${uname}_${clientIP}`;
        this.securityChecks.rateLimit.delete(checkKey);
        
        // 保存用户信息
        const userInfo = {
            id: user.id,
            username: uname,
            points: user.points || user['积分'] || 0,
            loginTime: new Date().toISOString()
        };
        
        this.safeLocalSet('currentUser', JSON.stringify(userInfo));
        this.safeLocalSet('lastLoginTime', new Date().toISOString());
        
        // 延迟跳转
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }

    // 安全本地存储封装
    safeLocalSet(key, value) {
        try { localStorage.setItem(key, value); }
        catch (e) { this._memoryStore[key] = value; }
    }
    safeLocalGet(key) {
        try { const v = localStorage.getItem(key); return v !== null ? v : (this._memoryStore[key] ?? null); }
        catch (e) { return this._memoryStore[key] ?? null; }
    }
    safeLocalRemove(key) {
        try { localStorage.removeItem(key); }
        catch (e) { delete this._memoryStore[key]; }
    }
    
    // 显示错误消息
    showError(message) {
        this.showMessage('login-error', message, 'error');
    }
    
    // 显示成功消息
    showSuccess(message) {
        this.showMessage('login-success', message, 'success');
    }
    
    // 显示信息消息
    showInfo(message) {
        this.showMessage('login-info', message, 'info');
    }
    
    // 显示消息
    showMessage(elementId, message, type) {
        // 清除其他消息
        this.clearErrorMessages();
        
        let element = document.getElementById(elementId);
        
        // 如果info元素不存在，创建它
        if (elementId === 'login-info' && !element) {
            element = this.createInfoElement();
        }
        
        if (element) {
            element.innerHTML = `<i class="fas fa-${this.getIconForType(type)} mr-2"></i>${message}`;
            element.style.display = 'block';
            
            // 自动隐藏
            if (type !== 'info') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, type === 'success' ? 2000 : 5000);
            }
        }
    }
    
    // 创建信息元素
    createInfoElement() {
        const infoElement = document.createElement('div');
        infoElement.id = 'login-info';
        infoElement.className = 'info-message';
        infoElement.style.cssText = `
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 20px;
            display: none;
            animation: slideIn 0.3s ease;
            position: relative;
            overflow: hidden;
            font-size: 14px;
            line-height: 1.5;
            background: rgba(219, 234, 254, 0.8);
            border: 1px solid rgba(147, 197, 253, 0.5);
            color: #1e40af;
            backdrop-filter: blur(8px);
        `;
        
        const errorElement = document.getElementById('login-error');
        if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.insertBefore(infoElement, errorElement);
        }
        
        return infoElement;
    }
    
    // 获取类型对应的图标
    getIconForType(type) {
        const icons = {
            error: 'exclamation-triangle',
            success: 'check-circle',
            info: 'info-circle',
            warning: 'exclamation-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    // 清除错误消息
    clearErrorMessages() {
        const messageIds = ['login-error', 'login-success', 'login-info'];
        messageIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
    }
    
    // 触发状态变更事件
    dispatchStateChangeEvent(oldState, newState, message) {
        const event = new CustomEvent('loginStateChange', {
            detail: { oldState, newState, message }
        });
        window.dispatchEvent(event);
    }
    
    // 重置状态
    reset() {
        this.setState(this.loginStates.IDLE);
        this.clearErrorMessages();
        
        // 重置按钮样式
        const loginButton = document.querySelector('#login-form-content button[type="submit"]');
        if (loginButton) {
            loginButton.classList.remove('bg-green-500');
        }
    }
    
    // 获取安全统计
    getSecurityStats() {
        return {
            totalAttempts: Array.from(this.securityChecks.rateLimit.values())
                .reduce((sum, data) => sum + data.attempts, 0),
            blockedIPs: Array.from(this.securityChecks.rateLimit.values())
                .filter(data => data.attempts >= this.securityChecks.maxAttempts).length,
            networkStatus: this.networkStatus
        };
    }
}

// 创建全局实例
window.LoginStatusManager = new LoginStatusManager();

// 导出为模块（如果支持）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginStatusManager;
}



