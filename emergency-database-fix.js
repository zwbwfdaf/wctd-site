// 紧急数据库修复 - 直接内联方式
// 解决SDK加载和域名识别问题

console.log('🚨 启动紧急数据库修复...');

// Supabase 配置（直连）
const SUPABASE_URL = 'https://ybrveusbwjusnrzgfnok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicnZldXNid2p1c25yemdmbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODU1NjIsImV4cCI6MjA3MjA2MTU2Mn0.JKPSUli-q9wRuDagE6kwltLk9XgfygE8yznm-Ca82Qk';

// 全局状态
let supabaseClient = null;
let isInitialized = false;
let initializationPromise = null;
const DEFAULT_RETRY = { retries: 3, baseDelayMs: 300, jitter: 150 };
// 性能优化：启动时不做额外测试查询，避免切页抖动
const STARTUP_TEST_ENABLED = false;

/**
 * 强制加载 Supabase SDK
 */
async function forceLoadSupabaseSDK() {
    return new Promise((resolve, reject) => {
        // 检查是否已加载
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            console.log('✅ Supabase SDK 已存在');
            resolve(window.supabase);
            return;
        }

        console.log('📦 强制加载 Supabase SDK...');
        
        // 多CDN尝试
        const cdnUrls = [
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
            'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
        ];

        let currentIndex = 0;

        function tryNextCDN() {
            if (currentIndex >= cdnUrls.length) {
                reject(new Error('所有CDN都无法加载Supabase SDK'));
                return;
            }

            const url = cdnUrls[currentIndex];
            console.log(`🔗 尝试CDN #${currentIndex + 1}: ${url}`);

            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            
            script.onload = function() {
                console.log(`✅ CDN #${currentIndex + 1} 加载成功`);
                
                // 验证SDK是否正确加载
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                    console.log('✅ Supabase SDK 验证成功');
                    resolve(window.supabase);
                } else {
                    console.log(`❌ CDN #${currentIndex + 1} 加载不完整，尝试下一个`);
                    currentIndex++;
                    script.remove();
                    tryNextCDN();
                }
            };
            
            script.onerror = function() {
                console.log(`❌ CDN #${currentIndex + 1} 加载失败`);
                currentIndex++;
                script.remove();
                tryNextCDN();
            };

            // 超时处理
            setTimeout(() => {
                if (currentIndex < cdnUrls.length && !window.supabase) {
                    console.log(`⏰ CDN #${currentIndex + 1} 加载超时`);
                    currentIndex++;
                    script.remove();
                    tryNextCDN();
                }
            }, 10000);
            
            document.head.appendChild(script);
        }

        tryNextCDN();
    });
}

/**
 * 初始化数据库连接
 */
async function emergencyInitDatabase() {
    // 避免重复初始化
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log('🔗 紧急初始化数据库连接...');

            // Step 1: 强制加载SDK（增加超时与备用CDN）
            await Promise.race([
                forceLoadSupabaseSDK(),
                new Promise((_,rej)=>setTimeout(()=>rej(new Error('sdk_timeout')), 8000))
            ]);
            
            // Step 2: 创建客户端
            console.log('🔧 创建Supabase客户端...');
            // 直连
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            if (!supabaseClient) {
                throw new Error('客户端创建失败');
            }

            console.log('✅ Supabase客户端创建成功');
            if (STARTUP_TEST_ENABLED) {
                console.log('🧪 测试数据库连接...');
                const { error } = await supabaseClient
                    .from('users')
                    .select('id')
                    .limit(1);
                if (error) console.warn('⚠️ 启动测试查询返回：', error.message);
            }

            isInitialized = true;
            
            // 绑定到全局对象
            window.supabaseClient = supabaseClient;
            window.emergencyDBReady = true;
            
            // 移除错误提示
            const errorDiv = document.querySelector('.database-error');
            if (errorDiv) {
                errorDiv.remove();
                console.log('✅ 移除错误提示');
            }

            console.log('🎉 紧急数据库修复完成！');
            return supabaseClient;

        } catch (error) {
            console.error('❌ 紧急数据库修复失败:', error);
            showEmergencyError(error.message);
            throw error;
        }
    })();

    return initializationPromise;
}

/**
 * 显示紧急错误信息
 */
function showEmergencyError(message) {
    // 移除旧的错误提示
    const existingError = document.querySelector('.emergency-database-error');
    if (existingError) {
        existingError.remove();
    }

    // 创建新的错误提示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'emergency-database-error';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10001;
        max-width: 90%;
        text-align: center;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    errorDiv.innerHTML = `
        <div style="margin-bottom: 8px;">🚨 紧急修复失败</div>
        <div style="font-size: 14px; opacity: 0.9;">${message}</div>
        <div style="font-size: 12px; margin-top: 8px;">请联系技术支持</div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // 10秒后自动隐藏
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 10000);
}

/**
 * 获取数据库客户端
 */
function getEmergencyClient() {
    return supabaseClient;
}

/**
 * 检查是否就绪
 */
function isEmergencyReady() {
    return isInitialized && supabaseClient !== null;
}

/**
 * 通用查询重试封装：fn 接收 supabaseClient，返回一个 Promise({ data, error })
 */
async function dbQuery(fn, options) {
    const { retries, baseDelayMs, jitter } = Object.assign({}, DEFAULT_RETRY, options);
    if (!isEmergencyReady()) await emergencyInitDatabase();
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fn(supabaseClient);
            if (!res || res.error) throw (res ? res.error : new Error('Unknown db error'));
            return res;
        } catch (err) {
            lastErr = err;
            // 对网络/超时/临时错误重试
            const msg = String(err.message || err);
            const isTransient = /(fetch|network|timeout|ECONN|ENET|AbortError|Failed to fetch)/i.test(msg);
            if (attempt >= retries || !isTransient) break;
            const backoff = baseDelayMs * Math.pow(2, attempt) + Math.random() * jitter;
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw lastErr || new Error('DB query failed');
}

// 重新定义所有数据库函数（使用紧急客户端）
async function registerUser(username, password) {
    if (!isEmergencyReady()) {
        await emergencyInitDatabase();
    }
    
    try {
        const { data: existingUsers, error: fetchError } = await supabaseClient
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
        
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
                用户名: username,
                密码: password,
                积分: 0,
                created_at: new Date().toISOString()
            }])
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

async function loginUser(username, password) {
    if (!isEmergencyReady()) {
        await emergencyInitDatabase();
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('用户名', username)
            .eq('密码', password)
            .single();
        
        if (error && error.message.includes('Row not found')) {
            throw new Error('用户名或密码错误');
        }
        
        if (error) {
            throw new Error('查询用户失败：' + error.message);
        }
        
        return data;
    } catch (error) {
        console.error('登录错误：', error);
        throw error;
    }
}

async function getUserById(userId) {
    if (!isEmergencyReady()) {
        await emergencyInitDatabase();
    }
    
    try {
        const { data, error } = await supabaseClient
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

async function updateUserPoints(userId, points) {
    if (!isEmergencyReady()) {
        await emergencyInitDatabase();
    }
    
    try {
        const { data, error } = await supabaseClient
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

// 导出所有函数到全局
window.emergencyInitDatabase = emergencyInitDatabase;
window.getEmergencyClient = getEmergencyClient;
window.isEmergencyReady = isEmergencyReady;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.getUserById = getUserById;
window.updateUserPoints = updateUserPoints;
window.dbQuery = dbQuery;

// ===================== 全站公告弹窗 =====================
/**
 * 每日公告弹窗（含“今日不再提醒”）
 * 可通过 window.ANNOUNCEMENT_CONFIG 自定义内容：
 * { title, message, confirmText, closeText, noTodayText }
 */
const ANNOUNCEMENT_STORAGE_KEY = 'wctd_announcement_skip_date';
const ANNOUNCEMENT_SESSION_ACK_KEY = 'wctd_announcement_session_ack';

function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

function shouldShowAnnouncement() {
    try {
        const skip = localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY);
        // 若已勾选“今日不再提醒”，当天不再显示
        if (skip === getTodayStr()) return false;
        // 本次会话已确认，则不再显示（直到用户重新进入网站）
        const sessionAck = sessionStorage.getItem(ANNOUNCEMENT_SESSION_ACK_KEY);
        if (sessionAck === '1') return false;
        return true;
    } catch (_) {
        return true;
    }
}

function markDoNotDisturbToday() {
    try { localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, getTodayStr()); } catch (_) {}
}

function createAnnouncementElements(config) {
    const overlay = document.createElement('div');
    overlay.id = 'wctd-announcement-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 16px;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        width: 100%;
        max-width: 520px;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.18);
        overflow: hidden;
        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Helvetica Neue',Arial,sans-serif;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: linear-gradient(135deg,#667eea,#764ba2);
        color: #fff;
        font-weight: 700;
        font-size: 16px;
    `;
    header.innerHTML = `<span>${config.title}</span>`;

    const closeX = document.createElement('button');
    closeX.setAttribute('aria-label', '关闭');
    closeX.style.cssText = `
        background: transparent;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
    `;
    closeX.textContent = '×';
    header.appendChild(closeX);

    const body = document.createElement('div');
    body.style.cssText = `
        padding: 18px;
        color: #374151;
        line-height: 1.6;
        font-size: 14px;
        background: #fff;
    `;
    body.innerHTML = config.message;

    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 18px 18px 18px;
        background: #ffffff;
    `;

    const checkboxWrap = document.createElement('label');
    checkboxWrap.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #6b7280;
        font-size: 13px;
        user-select: none;
        cursor: pointer;
    `;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    checkboxWrap.appendChild(cb);
    const cbText = document.createElement('span');
    cbText.textContent = config.noTodayText;
    checkboxWrap.appendChild(cbText);

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex; gap:10px;';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = config.closeText;
    btnCancel.style.cssText = `
        padding: 10px 16px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        color: #374151;
        font-weight: 600;
        cursor: pointer;
    `;

    const btnOk = document.createElement('button');
    btnOk.textContent = config.confirmText;
    btnOk.style.cssText = `
        padding: 10px 16px;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg,#667eea,#764ba2);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(102,126,234,0.35);
    `;

    btnGroup.appendChild(btnCancel);
    btnGroup.appendChild(btnOk);

    footer.appendChild(checkboxWrap);
    footer.appendChild(btnGroup);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    function closeModal(applyDnd) {
        if (applyDnd && cb.checked) { markDoNotDisturbToday(); }
        try { sessionStorage.setItem(ANNOUNCEMENT_SESSION_ACK_KEY, '1'); } catch(_) {}
        overlay.style.display = 'none';
        document.removeEventListener('keydown', onEsc);
    }

    function onEsc(e) { if (e.key === 'Escape') { closeModal(true); } }

    closeX.addEventListener('click', () => closeModal(true));
    btnCancel.addEventListener('click', () => closeModal(true));
    btnOk.addEventListener('click', () => closeModal(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(true); });

    return { overlay, open: () => { overlay.style.display = 'flex'; document.addEventListener('keydown', onEsc); } };
}

function setupDailyAnnouncement() {
    if (window.__wctd_announcement_initialized) return;
    window.__wctd_announcement_initialized = true;

    // 仅在首页触发（例如 index.html、index2.html、minimal-upload/index.html 等统一入口）
    const path = (location.pathname || '').toLowerCase();
    const isHome = /\/index(\d*)?\.html$/.test(path) || path === '/' || path === '';
    if (!isHome) return;

    // 使用公告表中被标记为 popup 的公告作为弹窗（仅一个）
    (async function(){
        try{
            // 等待客户端就绪（最多重试5次，共 ~2s）
            let client=null; let tries=0;
            while(tries<5){
                client = (window.getEmergencyClient && window.getEmergencyClient()) || window.supabase || null;
                if(client && client.from) break;
                await new Promise(r=> setTimeout(r, 400));
                tries++;
            }
            const supabase = client;
            if(!supabase || !supabase.from){ return; }
            // 拉取最近若干条，筛选 meta.popup
            let { data, error } = await supabase.from('announcements').select('*').order('created_at', {ascending:false}).limit(50);
            if(error) return;
            data = Array.isArray(data)? data: [];
            const popupOne = data.find(a=>{ try{ const m=String(a.content||'').match(/<!--\s*ANN_META:\s*(\{[\s\S]*?\})\s*-->/); const meta=m? JSON.parse(m[1]):{}; return !!meta.popup; }catch(_){ return false; } });
            if(!popupOne) return;
            // 当日抑制：若今日已弹过且还是同一条弹窗，则不再弹；
            // 若更换了弹窗ID，则忽略当日抑制并弹出一次。
            const lastDate = (localStorage.getItem('ann:popup:last')||'');
            const lastId = (localStorage.getItem('ann:popup:lastId')||'');
            const today = new Date().toISOString().slice(0,10);
            const sameIdToday = (lastDate===today && lastId===String(popupOne.id||''));
            if (!sameIdToday && !shouldShowAnnouncement()) {
                // 本会话/今日抑制，但因为更换了弹窗ID，将继续显示
            }
            else if (sameIdToday) {
                return;
            }
            const cfg = { title: popupOne.title||'平台公告', message: (String(popupOne.content||'').replace(/<!--[\s\S]*?-->/,'')) };
            const { overlay, open } = createAnnouncementElements(Object.assign({ confirmText:'确定', closeText:'关闭', noTodayText:'今日不再提醒' }, cfg));
            document.body.appendChild(overlay);
            setTimeout(()=>open(), 50);
            // 记录今日与已弹ID
            try{ localStorage.setItem('ann:popup:last', today); localStorage.setItem('ann:popup:lastId', String(popupOne.id||'')); }catch(_){ }
        }catch(_){ }
    })();
}

// 立即开始初始化（如果DOM已就绪）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📄 DOM就绪，启动紧急数据库修复');
        emergencyInitDatabase().catch(error => {
            console.error('❌ 自动初始化失败:', error);
        });
    });
} else {
    console.log('📄 DOM已就绪，立即启动紧急数据库修复');
    emergencyInitDatabase().catch(error => {
        console.error('❌ 自动初始化失败:', error);
    });
}

console.log('🚨 紧急数据库修复器已加载');

// DOM就绪后自动显示每日公告（全站生效）
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){
            try { if (typeof setupDailyAnnouncement === 'function') { setupDailyAnnouncement(); } } catch(_) {}
        });
    } else {
        if (typeof setupDailyAnnouncement === 'function') { setupDailyAnnouncement(); }
    }
} catch(_) {}
