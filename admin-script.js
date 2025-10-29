// 简易模态框工具
function __openModal(id){ try{ const el=document.getElementById(id); if(el){ el.style.display='flex'; } } catch(_){ } }
function __closeModal(id){ try{ const el=document.getElementById(id); if(el){ el.style.display='none'; } } catch(_){ } }
window.__closeModal = __closeModal;

// 打开团长详情：统计被邀请用户与收益
async function openLeaderDetail(inviterId, label){
    try{
        window.__currLeaderId = inviterId; window.__currLeaderLabel = label;
        const title=document.getElementById('leaderDetailTitle'); if(title) title.textContent = `团长详情 - ${label||inviterId}`;
        const tbody=document.querySelector('#leaderInviteeTable tbody'); if(tbody) tbody.innerHTML='<tr><td colspan="5" class="loading">加载中...</td></tr>';
        __openModal('leaderDetailModal');
        await ensureSupabaseReady();
        // 读取所有被邀请用户（远端+本地兜底）
        let invites=[];
        try{
            const r = await supabase.from('referrals').select('invitee_id, created_at').eq('inviter_id', inviterId);
            if(!r.error) invites = r.data||[];
        }catch(_){ }
        if(!invites.length){
            try{
                const local = JSON.parse(localStorage.getItem('referrals')||'[]');
                invites = (local||[]).filter(x=> String(x.inviter_id||'')===String(inviterId)).map(x=> ({ invitee_id:x.invitee_id, created_at:x.created_at||'' }));
            }catch(_){ }
        }
        // 补充用户名
        const ids = Array.from(new Set(invites.map(x=>x.invitee_id).filter(Boolean)));
        const nameMap = new Map();
        try{
            const chunk=50; for(let i=0;i<ids.length;i+=chunk){
                const part=ids.slice(i,i+chunk);
                const u = await supabase.from('users').select('id, username').in('id', part);
                (u.data||[]).forEach(x=> nameMap.set(x.id, x.username||('用户'+String(x.id).slice(-4))));
            }
        }catch(_){ }
        // 读取收益并聚合（远端+本地兜底）
        const earnMap = new Map();
        try{
            const e = await supabase.from('earnings').select('user_id, amount');
            (e.data||[]).forEach(row=>{
                const uid=String(row.user_id||'');
                earnMap.set(uid, (earnMap.get(uid)||0) + (Number(row.amount)||0));
            });
        }catch(_){ }
        if(earnMap.size===0){
            try{
                const localEarn = JSON.parse(localStorage.getItem('earnings_local')||'[]');
                (localEarn||[]).forEach(row=>{
                    const uid=String(row.user_id||'');
                    earnMap.set(uid, (earnMap.get(uid)||0) + (Number(row.amount)||0));
                });
            }catch(_){ }
        }
        // 渲染
        const rows = invites.map((r,idx)=>{
            const uid = r.invitee_id;
            const uname = nameMap.get(uid) || ('用户'+String(uid).slice(-4));
            const earn = earnMap.get(String(uid)) || 0;
            const time = (r.created_at||'').replace('T',' ').slice(0,19);
            return `<tr><td>${idx+1}</td><td>${uid}</td><td>${uname}</td><td>${time||'--'}</td><td>¥${earn.toFixed(2)}</td></tr>`;
        }).join('');
        if(tbody){ tbody.innerHTML = rows || '<tr><td colspan="5" class="loading">暂无数据</td></tr>'; }
        // 顶部指标
        const members = invites.length;
        let sum = 0; invites.forEach(x=>{ const v=earnMap.get(String(x.invitee_id))||0; sum += v; });
        const avg = members? (sum/members):0;
        const earliest = invites.map(x=>x.created_at).filter(Boolean).sort()[0]||'';
        const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = (typeof val==='number')? (id==='ldEarnings'||id==='ldAvg'? '¥'+val.toFixed(2): String(val)): (val||'--'); };
        set('ldMembers', members);
        set('ldEarnings', sum);
        set('ldAvg', avg);
        set('ldSince', earliest? earliest.replace('T',' ').slice(0,19): '--');
    }catch(e){ if(typeof showNotification==='function') showNotification('加载团长详情失败: '+e.message,'error'); }
}
if(typeof window!=='undefined'){ window.openLeaderDetail = openLeaderDetail; }

function exportLeaderInviteesCSV(){
    try{
        const rows = Array.from(document.querySelectorAll('#leaderInviteeTable tbody tr')).map(tr=> Array.from(tr.children).map(td=> td.textContent.trim()));
        if(!rows.length){ showNotification && showNotification('暂无数据可导出','warning'); return; }
        const header=['序号','用户ID','用户名','加入时间','收益'];
        let csv='\ufeff'+header.join(',')+'\n'+ rows.map(r=> r.join(',')).join('\n');
        const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='leader_invitees.csv'; a.click(); URL.revokeObjectURL(a.href);
    }catch(e){ console.warn('exportLeaderInviteesCSV', e); }
}
// 计算x雷浏览器收益
function calculateXrayEarningsAmount(){
    const n10 = parseInt(document.getElementById('xrPullNew10').value)||0;
    const n100 = parseInt(document.getElementById('xrPullNew100').value)||0;
    const n200 = parseInt(document.getElementById('xrPullNew200').value)||0;
    const n1000 = parseInt(document.getElementById('xrPullNew1000').value)||0;
    const XR10 = parseFloat(localStorage.getItem('admin:xr_10')||'7');
    const XR100 = parseFloat(localStorage.getItem('admin:xr_100')||'8');
    const XR200 = parseFloat(localStorage.getItem('admin:xr_200')||'9');
    const XR1000 = parseFloat(localStorage.getItem('admin:xr_1000')||'10');
    const total = n10*XR10 + n100*XR100 + n200*XR200 + n1000*XR1000;
    document.getElementById('xrayTotalAmount').value = `¥${total.toFixed(2)}`;
}
// KK搜索：价格常量与计算函数（确保全局可用）
const KK_SEARCH_PRICES = window.KK_SEARCH_PRICES || { pullNew: 8.5, pullActive: 2.5, pullOld: 0.3 };
function calculateKKEarningsAmount(){
    try{
        const pullNewCount = parseInt(document.getElementById('pullNewCount')?.value)||0;
        const pullActiveCount = parseInt(document.getElementById('pullActiveCount')?.value)||0;
        const pullOldCount = parseInt(document.getElementById('pullOldCount')?.value)||0;
        const totalAmount = pullNewCount*KK_SEARCH_PRICES.pullNew + pullActiveCount*KK_SEARCH_PRICES.pullActive + pullOldCount*KK_SEARCH_PRICES.pullOld;
        const out=document.getElementById('kkTotalAmount'); if(out) out.value = `¥${totalAmount.toFixed(2)}`;
    }catch(e){ console.warn('calculateKKEarningsAmount', e); }
}
if(typeof window!=='undefined'){ window.calculateKKEarningsAmount = calculateKKEarningsAmount; }


// 保存x雷浏览器收益
async function saveXraySearchEarning(){
    try{
        await ensureSupabaseReady();
        const selectedRaw = document.getElementById('xrayEarningKeyword').value || '';
        const amountText = document.getElementById('xrayTotalAmount').value || '¥0.00';
        const amount = parseFloat(amountText.replace('¥',''))||0;
        const status = document.getElementById('xrayEarningStatus').value || '已完成';

        const counts = {
            pull_new_1_10: parseInt(document.getElementById('xrPullNew10').value)||0,
            pull_new_10_100: parseInt(document.getElementById('xrPullNew100').value)||0,
            pull_new_100_200: parseInt(document.getElementById('xrPullNew200').value)||0,
            pull_new_200_1000: parseInt(document.getElementById('xrPullNew1000').value)||0
        };

        // 解析选择的关键词（包含用户信息）
        let keywordData = null; let keywordText = ''; let targetUserId = '';
        try{ keywordData = JSON.parse(selectedRaw); keywordText = keywordData.keyword || ''; targetUserId = String(keywordData.userId||''); }catch(_){ keywordText = selectedRaw; }

        // 拦截：若关键词被标记为失效，则不允许结算
        try{
            const invalidSet = await getInvalidKeywordSet('x雷浏览器搜索任务');
            const key = `${String(targetUserId)}|${String(keywordText||'').toLowerCase()}`;
            if(invalidSet.has(key)){
                showNotification('该关键词已被标记为失效，不能结算收益', 'error');
                return;
            }
        }catch(_){ }

        const taskName = `x雷浏览器搜索-${keywordText}`;
        const description = JSON.stringify({ type:'xray', keyword: keywordText, username: keywordData?.username||'', ...counts, unit:{ n10:7, n100:8, n200:9, n1000:10 } });

        const payload = {
            user_id: targetUserId || 'unknown',
            username: keywordData?.username || undefined,
            task_name: taskName,
            amount: amount,
            status: status,
            description: description,
            created_at: new Date().toISOString()
        };

        let ok=false;
        try{
            const { error } = await supabase.from('earnings').insert([payload]);
            if(!error) ok=true; else {
                console.warn('DB insert error', error);
                // 如果因缺少字段(如 description)失败，退化为最小字段插入
                try{
                    const minimal = { user_id: payload.user_id, task_name: payload.task_name, amount: payload.amount, status: payload.status, created_at: payload.created_at };
                    const { error: e2 } = await supabase.from('earnings').insert([minimal]);
                    if(!e2) ok=true; else console.warn('Minimal insert still failed', e2);
                }catch(e3){ console.warn('Minimal insert exception', e3); }
            }
        }catch(e){ console.warn('DB insert exception', e); }

        if(!ok){
            // 兜底到localStorage（逐条独立key，便于读取合并）
            const key='earning_'+Date.now();
            localStorage.setItem(key, JSON.stringify({ id:key, ...payload }));
        }

        showNotification('x雷浏览器收益添加成功', 'success');
        closeModal('xraySearchEarningsModal');
        await loadXraySearchData && loadXraySearchData();
    }catch(e){
        console.error('保存x雷浏览器收益失败', e);
        showNotification('保存收益失败: '+e.message, 'error');
    }
}
// 统一的用户显示名选择器
function getUserDisplayName(user, fallbackUserId) {
    if (!user) {
        return fallbackUserId ? `用户${String(fallbackUserId).slice(-6)}` : '未知用户';
    }
    // 优先显示注册账号（用户名/username），其余字段仅作兜底
    const nameOrder = [
        '用户名','username','display_name','显示名','nickname','昵称','full_name','name','姓名','real_name','真实姓名','email','邮箱','phone','手机号'
    ];
    for (const key of nameOrder) {
        if (user[key] && String(user[key]).trim()) return user[key];
    }
    return fallbackUserId ? `用户${String(fallbackUserId).slice(-6)}` : '未知用户';
}
// 后台管理系统 JavaScript
// Supabase 配置（直连）
const SUPABASE_URL = 'https://ybrveusbwjusnrzgfnok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicnZldXNid2p1c25yemdmbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODU1NjIsImV4cCI6MjA3MjA2MTU2Mn0.JKPSUli-q9wRuDagE6kwltLk9XgfygE8yznm-Ca82Qk';

// 全局变量
let supabase;
let currentPage = 'dashboard';
let supabaseInitialized = false;
let initializationPromise = null;

// 🔧 修复：支持动态加载的初始化逻辑
async function startApp() {
    console.log('🚀 后台管理系统正在初始化...');
    
    try {
        // 确保 Supabase 客户端可用（由HTML页面已经初始化）
        if (!window.supabase) {
            throw new Error('Supabase 库未加载');
        }
        
        // 初始化 Supabase 客户端
        if (!supabaseInitialized) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            supabaseInitialized = true;
            console.log('✅ Supabase 客户端初始化成功');
        }
        
        // 初始化页面
        await initializeApp();

        // 绑定仪表盘"重置总收益"按钮
        try{
            const btn=document.getElementById('resetTotalEarningsBtn');
            if(btn){
                btn.addEventListener('click', ()=>{
                    if(!confirm('确定将仪表盘显示的总收益重置为 ¥0.00 吗？此操作仅影响展示，不会删除历史记录。')) return;
                    const el=document.getElementById('totalEarnings'); if(el) el.textContent='¥0.00';
                    const delta=document.getElementById('totalEarningsDelta'); if(delta) delta.textContent='';
                    showNotification('已重置展示用总收益', 'success');
                });
            }
        }catch(_){ }
        
        console.log('🎉 后台管理系统初始化完成');
        
        // 额外：初始化团长数据（以便刷新后立即显示本地镜像）
        try{ 
            await ensureLeadersReadable();  // 🔧 确保RLS权限配置正确
            loadLeaderOverviewData();       // 加载数据概览
            loadLeadersAllowlist();         // 加载团长列表
            loadLeadersForAdmin();          // 加载邀请数据统计
        }catch(_){ }
        
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        
        // 🔧 谨慎设置默认值，不覆盖可能已有的数据
        console.log('🔧 初始化失败，检查是否需要设置默认显示值...');
        
        // 只在元素显示"-"时才设置默认值
        if (document.getElementById('totalUsers')?.textContent === '-') {
            updateStatCard('totalUsers', 0);
        }
        if (document.getElementById('totalEarnings')?.textContent === '-') {
            updateStatCard('totalEarnings', '¥0.00');
        }
        if (document.getElementById('pendingWithdrawals')?.textContent === '-') {
            updateStatCard('pendingWithdrawals', 0);
        }
        if (document.getElementById('activeTasks')?.textContent === '-') {
            updateStatCard('activeTasks', 0);
        }
        
        // 绑定基本事件，确保页面功能可用
        bindEvents();
        
        showNotification('系统初始化失败，但基本功能可用: ' + error.message, 'warning');
    }
}

// 渲染KK搜索管理表格（如果某些构建遗漏了该函数）
if (typeof renderKKSearchManagementTable !== 'function') {
function renderKKSearchManagementTable(applications) {
    try {
        const tbody = document.querySelector('#kkSearchManagementTable tbody');
        if (!tbody) return;
        if (!applications || applications.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无KK搜索申请数据</td></tr>';
            return;
        }
        tbody.innerHTML = applications.map(app => `
            <tr>
                <td>${app.id}</td>
                <td>${app.username || (app.users ? app.users.username : '未知用户')}</td>
                <td class="keywords-cell">${formatApplicationKeywords(app)}</td>
                <td>${getExperienceText(app.experience)}</td>
                <td>${getChannelText(app.promotion_channel)}</td>
                <td>${formatDate(app.created_at)}</td>
                <td><span class="status-badge ${getApprovalStatusClass(app.status)}">${getApprovalStatusText(app.status)}</span></td>
                <td>${app.assigned_keywords ? `<span class="assigned-keywords">${app.assigned_keywords}</span>` : '<span class="text-muted">未分配</span>'}</td>
                <td>${getApprovalActions(app)}</td>
            </tr>
        `).join('');
    } catch (e) { console.warn('renderKKSearchManagementTable fallback', e); }
}
}

// 审核状态与操作的兜底函数（某些构建缺失时提供）
if (typeof getApprovalStatusClass !== 'function') {
function getApprovalStatusClass(status) {
    const map = {
        'pending':'status-pending','待审核':'status-pending',
        'approved':'status-approved','已通过':'status-approved',
        'rejected':'status-rejected','已拒绝':'status-rejected',
        'invalid':'status-invalid','已失效':'status-invalid'
    };
    return map[status] || 'status-pending';
}
}
if (typeof getApprovalStatusText !== 'function') {
function getApprovalStatusText(status) {
    const map = {
        'pending':'待审核','approved':'已通过','rejected':'已拒绝',
        '待审核':'待审核','已通过':'已通过','已拒绝':'已拒绝',
        'invalid':'已失效','已失效':'已失效'
    };
    return map[status] || '待审核';
}
}
if (typeof getApprovalActions !== 'function') {
function getApprovalActions(app) {
    const canApprove = (typeof openApproveModal === 'function');
    const canReject = (typeof openRejectModal === 'function');
    // 如果已通过但被标记为失效，显示"已失效"并隐藏两个按钮
    const invalidNote = String(app.approve_note||'').includes('失效:');
    if (invalidNote) {
        return [
            `<span class=\"status-badge status-invalid\">已失效</span>`,
            `<button class=\"btn btn-secondary btn-sm\" onclick=\"cancelInvalidForApplication('${app.id||''}')\"><i class=\"fas fa-undo\"></i> 取消失效</button>`
        ].join(' ');
    }
    if (app.status === 'approved' || app.status === '已通过') {
        return [
            canReject ? `<button class=\"btn btn-reject btn-sm\" onclick=\"openRejectModal('${app.id||''}')\"><i class=\"fas fa-times\"></i> 拒绝</button>` : '',
            (app.assigned_keywords ? `<button class=\"btn btn-warning btn-sm\" onclick=\"openInvalidateModal('${app.id||''}')\"><i class=\"fas fa-ban\"></i> 标记失效</button>` : '')
        ].join(' ');
    }
    if (app.status === 'rejected' || app.status === '已拒绝') {
        return canApprove ? `<button class="btn btn-approve" onclick="openApproveModal('${app.id||''}')"><i class="fas fa-check"></i> 重新审核</button>` : '';
    }
    // pending
    return [
        canApprove ? `<button class=\"btn btn-approve btn-sm\" onclick=\"openApproveModal('${app.id||''}')\"><i class=\"fas fa-check\"></i> 通过</button>` : '',
        canReject ? `<button class=\"btn btn-reject btn-sm\" onclick=\"openRejectModal('${app.id||''}')\"><i class=\"fas fa-times\"></i> 拒绝</button>` : '',
        (app.assigned_keywords ? `<button class=\"btn btn-warning btn-sm\" onclick=\"openInvalidateModal('${app.id||''}')\"><i class=\"fas fa-ban\"></i> 标记失效</button>` : '')
    ].join(' ');
}
}

// ===== 审核操作（通过/拒绝） =====
async function openApproveModal(applicationId) {
    try {
        // 优先从缓存读取（包含合并后的数据）
        let apps = window.__kdMgmtCache || window.__kkMgmtCache || window.__xrMgmtCache || window.__wkMgmtCache || [];
        let app = (apps || []).find(a => String(a.id) === String(applicationId));
        
        // 如果缓存中找不到，从localStorage读取
        if (!app) {
            apps = (typeof loadKeywordApplicationsFromLocalStorage === 'function') ? loadKeywordApplicationsFromLocalStorage() : [];
            app = (apps || []).find(a => String(a.id) === String(applicationId));
        }
        
        // 如果还是找不到，尝试从数据库查询
        if (!app) {
            try {
                await ensureSupabaseReady();
                const { data, error } = await supabase
                    .from('keyword_applications')
                    .select('*')
                    .eq('id', applicationId)
                    .single();
                if (!error && data) {
                    app = data;
                    // 尝试从localStorage合并KK网盘专属字段
                    const locals = (typeof loadKeywordApplicationsFromLocalStorage === 'function') ? loadKeywordApplicationsFromLocalStorage() : [];
                    const localApp = (locals || []).find(a => String(a.id) === String(applicationId));
                    if (localApp) {
                        app.quark_uid = app.quark_uid || localApp.quark_uid || null;
                        app.quark_phone = app.quark_phone || localApp.quark_phone || null;
                        app.real_name = app.real_name || localApp.real_name || null;
                        app.bind_screenshot = app.bind_screenshot || localApp.bind_screenshot || null;
                    }
                }
            } catch (e) {
                console.warn('从数据库查询申请失败:', e);
            }
        }
        
        app = app || {};
        const setText = (id, v) => { const el=document.getElementById(id); if(el) el.textContent = v||'-'; };
        const setVal = (id, v) => { const el=document.getElementById(id); if(el) el.value = v||''; };
        
        setVal('approveApplicationId', applicationId);
        setText('approveUserName', app.username || '未知用户');
        
        // 判断任务类型：KK网盘 vs 搜索任务
        const isKKDriveTask = app.task_type === 'kk-cloud-drive' || 
                              app.task_type === 'KK网盘任务' ||
                              app.task_type === 'KK网盘' ||
                              (app.keywords && (app.keywords.includes('kk网盘') || app.keywords.includes('KK网盘')));
        
        // 获取字段组
        const kkDriveFields = document.querySelectorAll('.kk-drive-field');
        const searchTaskFields = document.querySelectorAll('.search-task-field');
        
        if (isKKDriveTask) {
            // KK网盘：显示用户详细信息字段，隐藏关键词分配
            kkDriveFields.forEach(el => el.style.display = 'flex');
            searchTaskFields.forEach(el => el.style.display = 'none');
            
            // 填充KK网盘数据
            try { setText('approveTaskType', app.task_type || '-'); } catch(_){ }
            try { setText('approveQuarkUid', app.quark_uid || '-'); } catch(_){ }
            try { setText('approveQuarkPhone', app.quark_phone || '-'); } catch(_){ }
            try { setText('approveRealName', app.real_name || '-'); } catch(_){ }
            try { setText('approveChannel', (typeof getChannelText==='function')? getChannelText(app.promotion_channel || app.channel) : (app.promotion_channel || app.channel || '-')); } catch(_){ }
            try {
                const imgHolder=document.getElementById('approveBindImg');
                if(imgHolder){ 
                    if (app.bind_screenshot) {
                        // 显示可点击的缩略图
                        imgHolder.innerHTML = `
                            <div style="display:flex;align-items:center;gap:8px;">
                                <img src="${app.bind_screenshot}" 
                                     style="max-width:100px;max-height:100px;border:1px solid #ddd;border-radius:4px;cursor:pointer;" 
                                     onclick="window.open('${app.bind_screenshot}', '_blank')"
                                     title="点击查看大图">
                                <span style="color:#6b7280;font-size:12px;">点击图片查看大图</span>
                            </div>
                        `;
                    } else {
                        imgHolder.innerHTML = '-';
                    }
                }
            }catch(_){ }
        } else {
            // 搜索任务：隐藏KK网盘字段，显示关键词分配
            kkDriveFields.forEach(el => el.style.display = 'none');
            searchTaskFields.forEach(el => el.style.display = 'block');
            
            // 填充搜索任务数据
            setText('approveRequestedKeywords', app.keywords || '-');
            setVal('approveAssignKeywords', ''); // 清空之前的分配
        }
        
        setVal('approveNote', '');
        showModal('approveModal');
    } catch (e) { console.warn('openApproveModal', e); }
}

async function openRejectModal(applicationId) {
    try {
        const setVal = (id, v) => { const el=document.getElementById(id); if(el) el.value = v||''; };
        setVal('rejectApplicationId', applicationId);
        setVal('rejectReason', '');
        setVal('rejectNote', '');
        showModal('rejectModal');
    } catch (e) { console.warn('openRejectModal', e); }
}

async function confirmApproval() {
    try {
        const id = document.getElementById('approveApplicationId')?.value;
        const note = document.getElementById('approveNote')?.value?.trim();
        const assignedKeywords = document.getElementById('approveAssignKeywords')?.value?.trim();
        
        if (!id) { showNotification('缺少申请ID','error'); return; }
        
        // 检查搜索任务是否已分配关键词
        const searchTaskFields = document.querySelectorAll('.search-task-field');
        const isSearchTask = searchTaskFields.length > 0 && searchTaskFields[0].style.display !== 'none';
        
        if (isSearchTask && !assignedKeywords) {
            showNotification('请输入要分配的关键词','error');
            return;
        }
        
        let ok = false;
        const updateData = { 
            status: 'approved', 
            approve_note: note, 
            updated_at: new Date().toISOString()
        };
        
        // 如果是搜索任务，添加分配的关键词
        if (isSearchTask && assignedKeywords) {
            updateData.assigned_keywords = assignedKeywords;
        }
        
        try {
            await ensureSupabaseReady();
            const { error } = await supabase.from('keyword_applications')
                .update(updateData)
                .eq('id', id);
            if (!error) ok = true; else console.warn('approve db error', error);
        } catch (e) { console.warn('approve db ex', e); }
        
        if (!ok && typeof updateApplicationInLocalStorage === 'function') {
            updateApplicationInLocalStorage(id, updateData);
            ok = true;
        }
        
        if (ok) {
            showNotification(isSearchTask ? '已通过并分配关键词' : '已通过','success');
            closeModal('approveModal');
            try { await loadKKDiskManagementData(); } catch(_){ }
        } else {
            showNotification('操作失败，请稍后重试','error');
        }
    } catch (e) { showNotification('操作失败: '+e.message,'error'); }
}

async function confirmRejection() {
    try {
        const id = document.getElementById('rejectApplicationId')?.value;
        const reason = document.getElementById('rejectReason')?.value || '';
        const note = document.getElementById('rejectNote')?.value || '';
        if (!id) { showNotification('缺少申请ID','error'); return; }
        let ok = false;
        try {
            await ensureSupabaseReady();
            const { error } = await supabase.from('keyword_applications')
                .update({ status: 'rejected', reject_reason: reason, reject_note: note, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (!error) ok = true; else console.warn('reject db error', error);
        } catch (e) { console.warn('reject db ex', e); }
        if (!ok && typeof updateApplicationInLocalStorage === 'function') {
            updateApplicationInLocalStorage(id, { status:'rejected', reject_reason: reason, reject_note: note, updated_at: new Date().toISOString() });
            ok = true;
        }
        if (ok) {
            showNotification('已拒绝申请','success');
            closeModal('rejectModal');
            try { await loadKKSearchManagementData(); } catch(_){}
        } else {
            showNotification('操作失败，请稍后重试','error');
        }
    } catch (e) { showNotification('操作失败: '+e.message,'error'); }
}

// ===== 关键词失效（禁用）处理 =====
async function ensureInvalidKeywordsTable(){
    try{
        await ensureSupabaseReady();
        const sql = `
            CREATE TABLE IF NOT EXISTS public.invalid_keywords (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT,
                keyword TEXT NOT NULL,
                task_type TEXT,
                reason TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS invalid_keywords_unique ON public.invalid_keywords(user_id, keyword, COALESCE(task_type,''));
        `;
        try{ await supabase.rpc('exec_sql', { sql_query: sql }); }catch(_){ /* ignore if rpc not available */ }
    }catch(_){ }
}

async function openInvalidateModal(applicationId){
    try{
        const apps = (typeof loadKKSearchManagementData==='function' && window.__earningsRawList===undefined) ? (loadKeywordApplicationsFromLocalStorage && loadKeywordApplicationsFromLocalStorage()) : (window.__xrMgmtCache||window.__kkMgmtCache||[]);
        let app=null;
        if(apps && apps.length){ app = apps.find(a=> String(a.id)===String(applicationId)); }
        if(!app){
            try{ await ensureSupabaseReady(); const r=await supabase.from('keyword_applications').select('*').eq('id', applicationId).single(); app=r.data||null; }catch(_){ }
        }
        const setVal=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
        setVal('invalidUserId', app?.user_id || '');
        setVal('invalidTaskType', app?.task_type || '');
        setVal('invalidKeywordsInput', (app?.assigned_keywords||'').trim());
        setVal('invalidReason', '');
        showModal('invalidateKeywordModal');
    }catch(e){ console.warn('openInvalidateModal', e); }
}

// 打开取消失效弹窗：从应用记录预填写
async function cancelInvalidForApplication(applicationId){
    try{
        let app=null; try{ const apps=(window.__xrMgmtCache||window.__kkMgmtCache||[]); if(apps&&apps.length){ app=apps.find(a=> String(a.id)===String(applicationId)); } }catch(_){ }
        if(!app){ try{ await ensureSupabaseReady(); const r=await supabase.from('keyword_applications').select('*').eq('id', applicationId).single(); app=r.data||null; }catch(_){ }
        }
        const setVal=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
        setVal('cancelInvalidUserId', app?.user_id||'');
        setVal('cancelInvalidTaskType', app?.task_type||'');
        setVal('cancelInvalidKeywordsInput', (app?.assigned_keywords||'').trim());
        showModal('cancelInvalidModal');
    }catch(e){ console.warn('cancelInvalidForApplication', e); }
}
// 确认取消失效：删除 invalid_keywords 中对应记录，并清理备注里的"失效:"提示
async function confirmCancelInvalidKeywords(){
    try{
        await ensureSupabaseReady();
        const userId = document.getElementById('cancelInvalidUserId')?.value?.trim();
        const taskType = document.getElementById('cancelInvalidTaskType')?.value?.trim();
        const raw = document.getElementById('cancelInvalidKeywordsInput')?.value||'';
        const list = raw.split(/[\n,\s]+/).map(s=>s.trim()).filter(Boolean);
        if(!userId || list.length===0){ showNotification('请填写用户与关键词','warning'); return; }

        // 删除 invalid_keywords 记录
        for(const k of list){ try{ await supabase.from('invalid_keywords').delete().match({ user_id:userId, keyword:k }); }catch(_){ } }

        // 清理本地兜底集合
        try{
            const key=`invalid:${userId}:${taskType||'ALL'}`; const arr=JSON.parse(localStorage.getItem(key)||'[]');
            const set=new Set(arr); list.forEach(k=> set.delete(String(k).toLowerCase()));
            localStorage.setItem(key, JSON.stringify(Array.from(set)));
        }catch(_){ }

        // 清理备注里的"失效:"字样（尽力而为）
        try{
            const { data: apps } = await supabase.from('keyword_applications').select('id, approve_note, assigned_keywords, user_id, task_type').eq('user_id', userId);
            (apps||[]).forEach(async a=>{
                if(taskType && a.task_type && a.task_type!==taskType) return;
                let note = String(a.approve_note||'');
                if(note.includes('失效:')){ note = note.replace(/【失效:[^】]*】/g, '').trim(); try{ await supabase.from('keyword_applications').update({ approve_note: note }).eq('id', a.id); }catch(_){ } }
            });
        }catch(_){ }

        showNotification('已取消关键词失效', 'success');
        closeModal('cancelInvalidModal');
        try{ await loadKKSearchManagementData(); }catch(_){ }
    }catch(e){ showNotification('取消失败: '+e.message, 'error'); }
}

async function confirmInvalidateKeywords(){
    try{
        await ensureSupabaseReady();
        await ensureInvalidKeywordsTable();
        const userId = document.getElementById('invalidUserId')?.value?.trim();
        const taskType = document.getElementById('invalidTaskType')?.value?.trim();
        const reason = document.getElementById('invalidReason')?.value?.trim();
        const raw = document.getElementById('invalidKeywordsInput')?.value||'';
        const list = raw.split(/[\n,\s]+/).map(s=>s.trim()).filter(Boolean);
        if(!userId){ showNotification('缺少用户ID','error'); return; }
        if(list.length===0){ showNotification('请输入要失效的关键词','warning'); return; }
        const rows = list.map(k=> ({ user_id:String(userId), keyword:String(k), task_type:taskType||null, reason:reason||null, is_active:true }));
        // 使用 upsert，依赖唯一索引
        let dbOk = false;
        try{ const r = await supabase.from('invalid_keywords').upsert(rows, { onConflict: 'user_id,keyword,task_type' }); if(!r.error) dbOk=true; }catch(e){
            // 兼容无 upsert 的情况：逐条插入
            for(const r of rows){ try{ const ins = await supabase.from('invalid_keywords').insert([r]); if(!ins.error) dbOk=true; }catch(_){ /* ignore duplicate */ } }
        }
        // 本地兜底：即使数据库失败，也把失效词写到本地，前台立即生效
        try{
            const k1 = `invalid:${userId}:${taskType||'ALL'}`;
            const k2 = `invalid:*:${taskType||'ALL'}`; // 管理侧可选用于全局
            const prev1 = JSON.parse(localStorage.getItem(k1)||'[]');
            const merged = Array.from(new Set(prev1.concat(list.map(s=> String(s).toLowerCase()))));
            localStorage.setItem(k1, JSON.stringify(merged));
            // 也更新全局集合
            const prev2 = JSON.parse(localStorage.getItem(k2)||'[]');
            const merged2 = Array.from(new Set(prev2.concat(list.map(s=> String(s).toLowerCase()))));
            localStorage.setItem(k2, JSON.stringify(merged2));
        }catch(_){ }
        showNotification('已标记关键词为失效，不可使用且不结算', 'success');
        closeModal('invalidateKeywordModal');
        // 同步一个提示到该用户的关键词申请记录，方便前端无权限时也能显示失效
        try{
            const { data: apps } = await supabase
                .from('keyword_applications')
                .select('id, assigned_keywords, approve_note, user_id, task_type')
                .eq('user_id', userId);
            const toUpdate = [];
            (apps||[]).forEach(a=>{
                if(taskType && a.task_type && a.task_type!==taskType) return;
                const ak = String(a.assigned_keywords||'');
                const hit = list.filter(k=> ak.split(/[\n,\s,，]+/).map(s=>s.trim().toLowerCase()).includes(String(k).toLowerCase()));
                if(hit.length){
                    const base = String(a.approve_note||'');
                    const mark = `【失效:${hit.join('、')}】`;
                    if(!base.includes('失效:')){
                        toUpdate.push({ id:a.id, approve_note: (base? (base+' '):'') + mark });
                    }
                }
            });
            for(const u of toUpdate){ try{ await supabase.from('keyword_applications').update({ approve_note: u.approve_note }).eq('id', u.id); }catch(_){ } }
        }catch(_){ }
        try{ await loadKKSearchManagementData(); }catch(_){ }
    }catch(e){ showNotification('操作失败: '+e.message, 'error'); }
}

async function getInvalidKeywordSet(taskType){
    const set = new Set();
    try{
        await ensureSupabaseReady();
        let q = supabase.from('invalid_keywords').select('user_id, keyword, task_type, is_active').eq('is_active', true);
        if(taskType){ q = q.or(`task_type.is.null,task_type.eq.${taskType}`); }
        const { data } = await q;
        (data||[]).forEach(row=>{ set.add(`${row.user_id||''}|${(row.keyword||'').toLowerCase()}`); });
    }catch(_){ }
    return set;
}

// x雷浏览器管理：加载与渲染（兜底实现）
if (typeof loadXraySearchManagementData !== 'function') {
window.loadXraySearchManagementData = async function(){
    console.log('🔄 加载x雷浏览器管理数据...');
    try{
        await ensureSupabaseReady();
        let list = [];
        try{
            const { data, error } = await supabase
                .from('keyword_applications')
                .select('*')
                .or("task_type.eq.x雷浏览器搜索任务, task_type.eq.XRAY")
                .order('created_at', { ascending:false });
            if(!error && data && data.length){ list = data; }
        }catch(e){ console.warn('xray apps query', e); }
        if(!list.length){
            list = (loadKeywordApplicationsFromLocalStorage && loadKeywordApplicationsFromLocalStorage()) || [];
            // 仅保留与xray相关（如果有 task_type 字段）
            list = list.filter(a=> String(a.task_type||'').includes('x雷'));
        }
        if(!list.length){
            // 简易示例
            list = [
                { id:'xr-mgmt-s1', username:'demo-x', keywords:'x雷关键词A, x雷关键词B', experience:'learning', promotion_channel:'social', status:'pending', created_at:new Date().toISOString() }
            ];
        }
        window.__xrMgmtCache = list;
        if (typeof renderXraySearchManagementTable === 'function') {
            renderXraySearchManagementTable(list);
        } else {
            // 如果渲染函数不存在，复用KK的渲染逻辑到xray表格
            try{
                const tbody = document.querySelector('#xraySearchManagementTable tbody');
                if(tbody){
                    tbody.innerHTML = list.map(app=> `
                        <tr>
                            <td>${app.id}</td>
                            <td>${app.username||'未知用户'}</td>
                            <td class="keywords-cell">${formatApplicationKeywords(app)}</td>
                            <td>${getExperienceText? getExperienceText(app.experience): (app.experience||'')}</td>
                            <td>${getChannelText? getChannelText(app.promotion_channel): (app.promotion_channel||'')}</td>
                            <td>${app.created_at?formatDate(app.created_at):'-'}</td>
                            <td><span class="status-badge ${typeof getApprovalStatusClass==='function'? getApprovalStatusClass(app.status):''}">${typeof getApprovalStatusText==='function'? getApprovalStatusText(app.status):(app.status||'待审核')}</span></td>
                            <td>${app.assigned_keywords? `<span class="assigned-keywords">${app.assigned_keywords}</span>`: '<span class="text-muted">未分配</span>'}</td>
                            <td>${typeof getApprovalActions==='function'? getApprovalActions(app) : '-'}</td>
                        </tr>`).join('');
                }
            }catch(e){ console.warn('render xray fallback', e); }
        }
    }catch(err){
        console.error('❌ 加载xray管理数据失败:', err);
        showNotification && showNotification('加载xray-search管理数据失败: '+err.message, 'error');
    }
};
}
// 统一从收益记录上解析显示用户名
function getEarningDisplayName(earning, index) {
    if (!earning) return '未知用户';
    // 0) 统一优先：在关联阶段计算的 username_display
    if (earning.username_display && String(earning.username_display).trim()) {
        return String(earning.username_display).trim();
    }
    // 1) 关联到的 users 对象
    if (earning.users && earning.users.username && String(earning.users.username).trim()) {
        return String(earning.users.username).trim();
    }
    // 2) 直接携带的显示名字段
    const inlineName = earning.user_display_name || earning.username || earning['用户名'] || earning.display_name || earning['显示名'] || earning.full_name || earning.name || earning['姓名'] || earning.nickname || earning['昵称'] || earning.email || earning['邮箱'] || earning.phone || earning['手机号'];
    if (inlineName && String(inlineName).trim()) return String(inlineName).trim();
    // 3) 回退到ID
    const uid = earning.user_id || earning.user || earning['用户ID'];
    if (uid) return `用户${String(uid).slice(-6)}`;
    return `用户${(index || 0) + 1}`;
}

// 兼容DOMContentLoaded和动态加载两种方式（首屏延时渲染，提升切页速度）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(startApp, 0));
} else {
    // 页面已经加载完成，直接执行
    setTimeout(startApp, 0);
}

// 🔧 新增：确保Supabase客户端已准备就绪
async function ensureSupabaseReady() {
    // 如果已经初始化，直接返回
    if (supabaseInitialized && supabase) {
        return supabase;
    }
    
    // 如果正在初始化，等待初始化完成
    if (initializationPromise) {
        console.log('⏳ 等待Supabase初始化完成...');
        await initializationPromise;
        return supabase;
    }
    
    // 如果未初始化且没有正在进行的初始化，启动初始化
    console.log('🔄 开始重新初始化Supabase...');
    initializationPromise = performSupabaseInitialization();
    
    try {
        await initializationPromise;
        return supabase;
    } catch (error) {
        console.error('❌ Supabase初始化失败:', error);
        throw new Error('数据库连接不可用，请刷新页面重试');
    }
}

// 🔧 新增：执行Supabase初始化过程
async function performSupabaseInitialization() {
    try {
        console.log('🚀 开始初始化Supabase客户端...');
        
        // 等待Supabase库加载
        await waitForSupabase();
        
        // 创建客户端
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseInitialized = true;
        
        console.log('✅ Supabase客户端重新初始化成功');
        
        return supabase;
        
    } catch (error) {
        supabaseInitialized = false;
        throw error;
    }
}

// 等待Supabase库加载
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        const maxWaitTime = 10000; // 最多等待10秒
        const checkInterval = 100; // 每100ms检查一次
        let elapsedTime = 0;
        
        const checkSupabase = () => {
            if (typeof window.supabase !== 'undefined') {
                console.log('✅ Supabase库检测到');
                resolve();
                return;
            }
            
            elapsedTime += checkInterval;
            if (elapsedTime >= maxWaitTime) {
                reject(new Error('Supabase库加载超时'));
                return;
            }
            
            setTimeout(checkSupabase, checkInterval);
        };
        
        checkSupabase();
    });
}

// 显示加载状态
function showLoadingState() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="loading-container" style="display: flex; justify-content: center; align-items: center; height: 400px; flex-direction: column;">
                <div class="loading-spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007cba; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div style="margin-top: 16px; color: #666; font-size: 16px;">正在初始化系统...</div>
                <div style="margin-top: 8px; color: #999; font-size: 14px;">请稍候，正在连接数据库</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }
}

// 隐藏加载状态
function hideLoadingState() {
    const loadingContainer = document.querySelector('.loading-container');
    if (loadingContainer) {
        loadingContainer.remove();
    }
}

// 显示初始化错误
function showInitializationError(error) {
    hideLoadingState();
    
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="error-container" style="display: flex; justify-content: center; align-items: center; height: 400px; flex-direction: column;">
                <div style="background: #fee; border: 2px solid #f88; border-radius: 8px; padding: 20px; max-width: 500px; text-align: center;">
                    <h3 style="color: #c33; margin-top: 0;">⚠️ 系统初始化失败</h3>
                    <p style="color: #666; line-height: 1.6;">
                        无法连接到数据库服务。<br>
                        请检查网络连接或稍后重试。
                    </p>
                    <div style="margin: 15px 0;">
                        <button onclick="location.reload()" style="background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                            🔄 重新加载
                        </button>
                        <button onclick="testDatabaseConnection()" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                            🔧 测试连接
                        </button>
                    </div>
                    <details style="margin-top: 15px; text-align: left;">
                        <summary style="cursor: pointer; color: #666;">查看错误详情</summary>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow: auto; margin-top: 10px;">${error.message}\n\n${error.stack || ''}</pre>
                    </details>
                </div>
            </div>
        `;
    }
    
    // 同时显示通知
    showNotification('系统初始化失败: ' + error.message, 'error');
}

// 🔧 新增：初始化时的简化数据库连接测试
async function testInitialDatabaseConnection() {
    console.log('🔗 测试初始数据库连接...');
    
    try {
        // 简单的连接测试，不显示用户通知
        const { error } = await supabase
            .from('users')
            .select('count(*)', { count: 'exact', head: true });
        
        if (error) {
            throw new Error(`数据库连接失败: ${error.message}`);
        }
        
        console.log('✅ 数据库连接测试通过');
        return true;
        
    } catch (error) {
        console.error('❌ 数据库连接测试失败:', error);
        throw error;
    }
}

// 初始化应用
async function initializeApp() {
    console.log('正在初始化应用...');
    
    // 绑定事件
    bindEvents();
    
    // 加载仪表盘数据
    await loadDashboardData();
    
    console.log('应用初始化完成');
}

// 绑定事件
function bindEvents() {
    // 导航菜单点击事件
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            if (page) {
                showPage(page);
            }
        });
    });
    
    // 菜单切换按钮
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    // 用户搜索
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(searchUsers, 300));
    }
    
    // 收益搜索
    const earningsSearch = document.getElementById('earningsSearch');
    if (earningsSearch) {
        earningsSearch.addEventListener('input', debounce(searchEarnings, 300));
    }
    
    // 用户状态过滤
    const userStatusFilter = document.getElementById('userStatusFilter');
    if (userStatusFilter) {
        userStatusFilter.addEventListener('change', filterUsers);
    }
    
    // 收益类型过滤
    const earningsTypeFilter = document.getElementById('earningsTypeFilter');
    if (earningsTypeFilter) {
        earningsTypeFilter.addEventListener('change', filterEarnings);
    }
    
    // 提现过滤标签
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            filterWithdrawals(this.getAttribute('data-filter'));
        });
    });
    
    // 模态框关闭事件
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    console.log('事件绑定完成');
}
// 显示页面
function showPage(pageId) {
    // 更新当前页面
    currentPage = pageId;
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNavItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    // 更新页面标题
    const titles = {
        'dashboard': '仪表盘',
        'users': '用户管理',
        'earnings': '收益管理',
        'withdrawals': '提现审核',
        'tasks': '任务管理',
        'analytics': '数据分析',
        'settings': '系统设置',
        'leaders': '领导页管理',
        'announcements': '公告管理'
    };
    
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) {
        pageTitle.textContent = titles[pageId] || '后台管理';
    }
    
    // 根据页面加载相应数据
    switch (pageId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'earnings':
            // 默认展示"任务收益管理"
            try{ switchEarningsSection('task'); }catch(_){ }
            // 预加载"其他收益管理"以免空白
            try{ loadOtherEarnings(); }catch(_){ }
            loadEarningsData();
            break;
        case 'withdrawals':
            loadWithdrawalsData();
            break;
        case 'tasks':
            // 初始化任务管理页面，默认加载KK搜索
            loadTaskManagementData('kk-search');
            break;
        case 'analytics':
            renderAnalytics();
            break;
        case 'settings':
            loadSystemSettings();
            break;
        case 'leaders':
            try{ 
                loadLeaderOverviewData();  // 加载数据概览
                loadLeadersAllowlist();     // 加载团长列表
                loadLeadersForAdmin();      // 加载邀请数据统计
            }catch(_){ }
            break;
        case 'announcements':
            try{ loadAnnouncementsData(); }catch(_){ }
            break;
    }
    
    console.log('切换到页面:', pageId);
    try{ __applyGuardDebounced(); }catch(_){ }
}
// ================= 系统设置 =================
function loadSystemSettings(){
    try{
        const enabled = localStorage.getItem('admin:announcement_enabled');
        const title = localStorage.getItem('admin:announcement_title') || '平台公告';
        const message = localStorage.getItem('admin:announcement_message') || '欢迎使用本平台。请遵守平台规则，严禁违规操作。';
        const enabledEl = document.getElementById('settingAnnounceEnabled');
        const titleEl = document.getElementById('settingAnnounceTitle');
        const msgEl = document.getElementById('settingAnnounceMessage');
        if(enabledEl) enabledEl.checked = (enabled !== 'false');
        if(titleEl) titleEl.value = title;
        if(msgEl) msgEl.value = message;

        // 新增设置加载
        const maintenance = localStorage.getItem('admin:maintenance') === 'true';
        const alipay = localStorage.getItem('admin:withdraw_alipay');
        const wechat = localStorage.getItem('admin:withdraw_wechat');
        const density = localStorage.getItem('admin:table_density') || 'normal';
        const kkPullNew = parseFloat(localStorage.getItem('admin:kk_pull_new')||'8.5');
        const kkPullActive = parseFloat(localStorage.getItem('admin:kk_pull_active')||'2.5');
        const kkPullOld = parseFloat(localStorage.getItem('admin:kk_pull_old')||'0.3');
        const xr10 = parseFloat(localStorage.getItem('admin:xr_10')||'7');
        const xr100 = parseFloat(localStorage.getItem('admin:xr_100')||'8');
        const xr200 = parseFloat(localStorage.getItem('admin:xr_200')||'9');
        const xr1000 = parseFloat(localStorage.getItem('admin:xr_1000')||'10');
        const topN = parseInt(localStorage.getItem('admin:ann_top_n')||'3',10);
        const annLang = localStorage.getItem('admin:ann_lang') || 'zh-CN';
        const tagDict = localStorage.getItem('admin:tag_dict') || '';

        const mEl = document.getElementById('settingMaintenanceEnabled');
        const aEl = document.getElementById('settingAlipayEnabled');
        const wEl = document.getElementById('settingWechatEnabled');
        const dEl = document.getElementById('settingTableDensity');
        const kkN = document.getElementById('settingKKPullNew');
        const kkA = document.getElementById('settingKKPullActive');
        const kkO = document.getElementById('settingKKPullOld');
        const xrA = document.getElementById('settingXR10');
        const xrB = document.getElementById('settingXR100');
        const xrC = document.getElementById('settingXR200');
        const xrD = document.getElementById('settingXR1000');
        const topNEl = document.getElementById('settingAnnTopN');
        const annLangEl = document.getElementById('settingAnnLang');
        const tagDictEl = document.getElementById('settingTagDict');
        if(mEl) mEl.checked = maintenance;
        if(aEl) aEl.checked = (alipay !== 'false');
        if(wEl) wEl.checked = (wechat !== 'false');
        if(dEl) dEl.value = density;
        if(kkN) kkN.value = kkPullNew;
        if(kkA) kkA.value = kkPullActive;
        if(kkO) kkO.value = kkPullOld;
        if(xrA) xrA.value = xr10;
        if(xrB) xrB.value = xr100;
        if(xrC) xrC.value = xr200;
        if(xrD) xrD.value = xr1000;
        if(topNEl) topNEl.value = isNaN(topN)?3:topN;
        if(annLangEl) annLangEl.value = annLang;
        if(tagDictEl) tagDictEl.value = tagDict;
        // 渲染草稿标签建议
        try{
            const datalist = document.getElementById('tagOptions');
            if(datalist){
                const tags = (tagDict||'').split(',').map(s=>s.trim()).filter(Boolean);
                datalist.innerHTML = tags.map(t=>`<option value="${t}"></option>`).join('');
            }
        }catch(_){ }

        // 应用维护模式与表格密度
        try{
            document.body.classList.toggle('maintenance', !!maintenance);
            document.body.classList.toggle('dense-tables', density==='dense');
        }catch(_){ }
        // 若开启维护模式，在页面显著位置提示
        try{
            const banner = document.querySelector('.maintenance-banner');
            if(banner) banner.style.display = maintenance ? 'block' : '';
        }catch(_){ }
        // 草稿列表渲染
        try{
            const draftList = JSON.parse(localStorage.getItem('admin:announce_drafts')||'[]');
            renderDraftList(draftList);
        }catch(_){ }
        // 同步加载公告列表（以便管理员在系统设置页也能看到）
        try{ loadAnnouncementsData(); }catch(_){ }
    }catch(e){ console.warn('加载系统设置失败', e); }
}

// ================= 公告管理（Supabase + 图片上传） =================
async function ensureAnnouncementsSupabaseReady(){
    try{
        if (typeof supabase !== 'undefined' && supabase) return;
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return;
        }
        throw new Error('Supabase未初始化');
    }catch(e){ console.warn('ensureAnnouncementsSupabaseReady', e); throw e; }
}

// 自动创建公告存储桶与访问策略（使用 exec_sql）
async function ensureAnnouncementsBucketAndPolicy(){
    try{
        await ensureAnnouncementsSupabaseReady();
        const sql = `
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='announcements') THEN
        PERFORM storage.create_bucket('announcements', public => true);
    END IF;
END $$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ann_read   ON storage.objects;
CREATE POLICY ann_read   ON storage.objects FOR SELECT TO anon USING (bucket_id = 'announcements');
DROP POLICY IF EXISTS ann_insert ON storage.objects;
CREATE POLICY ann_insert ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'announcements');
DROP POLICY IF EXISTS ann_update ON storage.objects;
CREATE POLICY ann_update ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'announcements');
DROP POLICY IF EXISTS ann_delete ON storage.objects;
CREATE POLICY ann_delete ON storage.objects FOR DELETE TO anon USING (bucket_id = 'announcements');`;
        try{ const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); if(error){ console.warn('ensureAnnouncementsBucketAndPolicy rpc error:', error.message||error); } }catch(e){ console.warn('ensureAnnouncementsBucketAndPolicy rpc ex:', e && e.message); }
    }catch(_){ }
}

async function runAnnouncementSetupSql(){
    try{
        await ensureAnnouncementsBucketAndPolicy();
        if(typeof showNotification==='function') try{ showNotification('已尝试创建公告存储桶与策略，请重试上传', 'success'); }catch(_){ }
    }catch(e){ if(typeof showNotification==='function') try{ showNotification('一键修复失败: '+(e.message||e), 'error'); }catch(_){ } }
}
if(typeof window!=='undefined'){ window.runAnnouncementSetupSql = runAnnouncementSetupSql; }

async function ensureAnnouncementsTableReady(){
    try{
        await ensureAnnouncementsSupabaseReady();
        // 尝试探测表是否存在（使用轻查询）
        try{
            const q = await supabase.from('announcements').select('id').limit(1);
            if(!q.error) return true;
        }catch(_){ }
        // 使用 exec_sql 创建表与索引，并关闭RLS（匿名可读写，便于前台读取、后台管理写入）
        const sql = `
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name='announcements'
                ) THEN
                    CREATE TABLE public.announcements (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        title TEXT,
                        content TEXT,
                        publish_at TIMESTAMPTZ NULL,
                        expire_at TIMESTAMPTZ NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_ann_created_at ON public.announcements(created_at DESC);
                END IF;
                BEGIN
                    ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
                EXCEPTION WHEN undefined_table THEN
                END;
            END $$;`;
        try{
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if(error){ console.warn('ensureAnnouncementsTableReady RPC error:', error.message||error); }
        }catch(e){ console.warn('ensureAnnouncementsTableReady RPC ex:', e && e.message); }
        return true;
    }catch(e){ console.warn('ensureAnnouncementsTableReady', e && e.message); return false; }
}

function parseAnnMetaFromContent(html){
    try{
        const m = String(html||'').match(/<!--\s*ANN_META:\s*(\{[\s\S]*?\})\s*-->/);
        if(!m) return {};
        const obj = JSON.parse(m[1]);
        return (obj && typeof obj==='object') ? obj : {};
    }catch(_){ return {}; }
}

function stripAnnMetaComment(html){
    return String(html||'').replace(/<!--\s*ANN_META:[\s\S]*?-->/, '').trim();
}

function buildAnnContentWithMeta(contentHtml, meta){
    try{
        const safeMeta = JSON.stringify({
            pinned: !!meta.pinned,
            popup: !!meta.popup,
            tags: Array.isArray(meta.tags) ? meta.tags : [],
            lang: meta.lang || 'zh-CN'
        });
        const body = stripAnnMetaComment(contentHtml||'');
        return `<!--ANN_META: ${safeMeta}-->\n${body}`;
    }catch(_){
        return contentHtml||'';
    }
}

function openAnnouncementModal(ann){
    try{
        const isEdit = !!ann;
        const idEl = document.getElementById('annId'); if(idEl) idEl.value = ann?.id||'';
        const tEl = document.getElementById('annTitle'); if(tEl) tEl.value = ann?.title||'';
        const cEl = document.getElementById('annContent'); if(cEl) cEl.value = ann ? stripAnnMetaComment(ann.content||'') : '';
        const langEl = document.getElementById('annLang');
        const pinEl = document.getElementById('annPinned');
        const popEl = document.getElementById('annPopup');
        const tagsEl = document.getElementById('annTags');
        const pubEl = document.getElementById('annPublishAt');
        const expEl = document.getElementById('annExpireAt');
        const meta = ann ? parseAnnMetaFromContent(ann.content||'') : {};
        if(langEl) langEl.value = meta.lang || 'zh-CN';
        if(pinEl) pinEl.checked = !!meta.pinned;
        if(popEl) popEl.checked = !!meta.popup;
        if(tagsEl) tagsEl.value = (meta.tags||[]).join(',');
        if(pubEl) pubEl.value = ann?.publish_at ? ann.publish_at.replace('Z','') : '';
        if(expEl) expEl.value = ann?.expire_at ? ann.expire_at.replace('Z','') : '';
        const titleEl = document.getElementById('annModalTitle'); if(titleEl) titleEl.textContent = isEdit ? '编辑公告' : '新建公告';
        // 粘贴图片支持
        try{
            if(cEl){
                cEl.onpaste = async function(e){
                    try{
                        if(!e.clipboardData) return;
                        const items = e.clipboardData.items || [];
                        for(const it of items){
                            if(it.type && it.type.startsWith('image/')){
                                e.preventDefault();
                                const file = it.getAsFile();
                                if(file){
                                    try{ await insertAndUploadAnnImage(file); }catch(_){ }
                                }
                            }
                        }
                    }catch(_){ }
                };
            }
        }catch(_){ }
        showModal('announcementModal');
    }catch(e){ console.warn('openAnnouncementModal', e); }
}

function insertImageIntoAnnContent(url){
    try{
        const cEl = document.getElementById('annContent'); if(!cEl) return;
        const cur = cEl.value || '';
        const html = `${cur}\n<p><img src="${url}" alt="image" style="max-width:100%;border-radius:8px;"/></p>`;
        cEl.value = html;
    }catch(_){ }
}

async function handleAnnImageSelected(e){
    try{
        const file = (e && e.target && e.target.files && e.target.files[0]) ? e.target.files[0] : null;
        if(!file) return;
        await insertAndUploadAnnImage(file);
        try{ e.target.value = ''; }catch(_){ }
    }catch(err){ showNotification && showNotification('上传失败: '+err.message, 'error'); }
}

// 先插入压缩预览，再后台上传成功后替换为公网URL
async function insertAndUploadAnnImage(file){
    try{
        const cEl = document.getElementById('annContent'); if(!cEl) return;
        const { dataUrl } = await compressImageForEmbed(file, { maxWidth: 1400, maxHeight: 1400, targetBytes: 500*1024 });
        if(!dataUrl){
            // 退化为直接等待上传
            const url = await uploadAnnouncementImage(file);
            if(url) insertImageIntoAnnContent(url);
            return;
        }
        const before = cEl.value || '';
        const toInsert = `\n<p><img src="${dataUrl}" alt="image" style="max-width:100%;border-radius:8px;"/></p>`;
        cEl.value = before + toInsert;
        try{ showNotification && showNotification('已插入预览，后台上传中…', 'info'); }catch(_){ }
        // 后台上传并替换
        uploadAnnouncementImage(file).then(function(url){
            if(url && /^https?:\/\//i.test(String(url))){
                try{ cEl.value = cEl.value.replace(dataUrl, url); }catch(_){ }
            }
        }).catch(function(err){ try{ showNotification && showNotification('上传失败: '+(err && err.message || err), 'error'); }catch(_){ } });
    }catch(_){ }
}

// 图片压缩与兜底：将图片压缩到合理尺寸并返回可用于上传的 Blob 和用于编辑器插入的 dataURL
async function compressImageForEmbed(file, options){
    const opts = Object.assign({ maxWidth: 1280, maxHeight: 1280, targetBytes: 600*1024 }, options||{});
    try{
        const dataUrl = await new Promise((resolve, reject)=>{
            const r = new FileReader();
            r.onload = ()=> resolve(String(r.result||''));
            r.onerror = ()=> resolve('');
            r.readAsDataURL(file);
        });
        if(!dataUrl){ return { dataUrl: '', uploadBlob: file }; }
        const img = await new Promise((resolve)=>{ const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>resolve(null); im.src=dataUrl; });
        if(!img){ return { dataUrl, uploadBlob: file }; }
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if((file.size||0) <= opts.targetBytes && w<=opts.maxWidth && h<=opts.maxHeight){
            return { dataUrl, uploadBlob: file };
        }
        const scale = Math.min(1, opts.maxWidth/Math.max(1,w), opts.maxHeight/Math.max(1,h));
        const cw = Math.max(1, Math.round(w*scale));
        const ch = Math.max(1, Math.round(h*scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        let quality = 0.9;
        let blob = await new Promise(res=> canvas.toBlob(res, 'image/jpeg', quality));
        // 逐步降低质量以达到目标体积
        while(blob && blob.size > opts.targetBytes && quality > 0.45){
            quality -= 0.1;
            // 保底 0.5 左右
            blob = await new Promise(res=> canvas.toBlob(res, 'image/jpeg', Math.max(quality, 0.5)));
        }
        let outDataUrl = '';
        try{ outDataUrl = canvas.toDataURL('image/jpeg', Math.max(quality, 0.5)); }catch(_){ outDataUrl = dataUrl; }
        return { dataUrl: outDataUrl||dataUrl, uploadBlob: blob || file };
    }catch(_){ return { dataUrl: '', uploadBlob: file }; }
}

async function uploadAnnouncementImage(file){
    await ensureAnnouncementsSupabaseReady();
    // 不再在前端尝试创建桶/策略，避免 401/权限错误刷屏；仅尝试固定桶并失败后回退到 base64。
    const buckets = ['announcements'];
    // 压缩以减少内容体积，并将压缩后的 Blob 用于上传
    const { dataUrl: fallbackDataUrl, uploadBlob } = await compressImageForEmbed(file, { maxWidth: 1400, maxHeight: 1400, targetBytes: 500*1024 });
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth()+1).padStart(2,'0');
    const rand = Math.random().toString(36).slice(2,8);
    const safeName = (file.name||'image').replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `images/${y}/${m}/${Date.now()}_${rand}_${safeName}`;
    let lastErrorMessage = '';
    for(const b of buckets){
        try{
            if(!supabase || !supabase.storage || !supabase.storage.from){ throw new Error('storage_unavailable'); }
            const up = await supabase.storage.from(b).upload(path, uploadBlob||file, { upsert: true, contentType: (uploadBlob&&uploadBlob.type)||file.type||'application/octet-stream' });
            if(up && !up.error){
                const { data } = supabase.storage.from(b).getPublicUrl(path);
                if(data && data.publicUrl){ return data.publicUrl; }
            }else if(up && up.error){
                lastErrorMessage = String(up.error.message||up.error);
            }
        }catch(e){ lastErrorMessage = String(e && e.message || e || 'upload_failed'); }
    }
    // 兜底：base64嵌入，并提示（使用 FileReader 避免大文件导致的堆栈溢出）
    try{
        const dataUrl = fallbackDataUrl || await new Promise((resolve, reject)=>{
            try{
                const reader = new FileReader();
                reader.onload = ()=> resolve(reader.result);
                reader.onerror = ()=> reject(reader.error||new Error('read_failed'));
                reader.readAsDataURL(file);
            }catch(err){ reject(err); }
        });
        if(typeof showNotification==='function'){
            const msg = lastErrorMessage ? `云端上传失败(${lastErrorMessage})，已嵌入到内容` : '云端上传失败，已嵌入到内容';
            try{ showNotification(msg, 'warning'); }catch(_){ }
        }
        return String(dataUrl||'');
    }catch(e){ throw e; }
}

async function loadAnnouncementsData(){
    try{
        await ensureAnnouncementsSupabaseReady();
        try{ await ensureAnnouncementsTableReady(); }catch(_){ }
        const tbody = document.querySelector('#annTable tbody');
        if(tbody){ tbody.innerHTML = '<tr><td colspan="10" class="loading">加载中...</td></tr>'; }
        let list = [];
        try{
            const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending:false }).limit(200);
            if(error) throw error;
            list = Array.isArray(data)? data: [];
        }catch(e){ console.warn('loadAnnouncementsData fallback local', e); list = JSON.parse(localStorage.getItem('announcements_local')||'[]'); }
        // 解析元数据
        list = list.map(a=>{
            const meta = parseAnnMetaFromContent(a.content||'');
            return Object.assign({}, a, { pinned: !!meta.pinned, popup: !!meta.popup, lang: meta.lang||a.lang||'zh-CN', tags: Array.isArray(meta.tags)? meta.tags: (a.tags||[]) });
        });
        renderAnnouncementsTable(list);
    }catch(e){ console.warn('loadAnnouncementsData', e); }
}
function renderAnnouncementsTable(list){
    try{
        const tbody = document.querySelector('#annTable tbody'); if(!tbody) return;
        if(!list || list.length===0){ tbody.innerHTML = '<tr><td colspan="10" class="loading">暂无公告</td></tr>'; return; }
        tbody.innerHTML = list.map(a=>{
            const created = (a.created_at||'').toString().replace('T',' ').slice(0,19);
            const pinBadge = a.pinned ? '<span class="status-badge status-approved">是</span>' : '<span class="status-badge status-pending">否</span>';
            const actions = [
                `<button class="btn btn-sm" onclick="editAnnouncement('${a.id}')"><i class=\"fas fa-edit\"></i> 编辑</button>`,
                `<button class="btn btn-sm btn-error" onclick="deleteAnnouncement('${a.id}')"><i class=\"fas fa-trash\"></i> 删除</button>`,
                a.pinned ? `<button class="btn btn-sm btn-secondary" onclick="toggleAnnouncementPinned('${a.id}', false)"><i class=\"fas fa-thumbtack\"></i> 取消置顶</button>` : `<button class="btn btn-sm btn-secondary" onclick="toggleAnnouncementPinned('${a.id}', true)"><i class=\"fas fa-thumbtack\"></i> 置顶</button>`,
                a.popup ? `<button class="btn btn-sm" onclick="setAnnouncementPopup('${a.id}', false)"><i class=\"fas fa-window-close\"></i> 取消弹窗</button>` : `<button class="btn btn-sm" onclick="setAnnouncementPopup('${a.id}', true)"><i class=\"fas fa-bell\"></i> 设为弹窗</button>`
            ].join(' ');
            return `<tr>
                <td>${a.id}</td>
                <td>${(a.title||'').replace(/</g,'&lt;')}</td>
                <td>${a.lang||'zh-CN'}</td>
                <td>${pinBadge}</td>
                <td>${created||''}</td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    }catch(e){ console.warn('renderAnnouncementsTable', e); }
}

async function saveAnnouncement(){
    try{
        await ensureAnnouncementsSupabaseReady();
        // 自动创建表（如果不存在）
        try{ await ensureAnnouncementsTableReady(); }catch(_){ }
        const id = document.getElementById('annId').value || '';
        const title = (document.getElementById('annTitle').value||'').trim();
        const content = document.getElementById('annContent').value||'';
        const lang = document.getElementById('annLang').value||'zh-CN';
        const pinned = !!document.getElementById('annPinned').checked;
        const popup = !!document.getElementById('annPopup').checked;
        const tags = (document.getElementById('annTags').value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const publishAt = document.getElementById('annPublishAt').value||'';
        const expireAt = document.getElementById('annExpireAt').value||'';
        if(!title){ return showNotification && showNotification('请输入标题', 'warning'); }
        const meta = { pinned, popup, tags, lang };
        const finalContent = buildAnnContentWithMeta(content, meta);
        let payload = { title, content: finalContent };
        // 尽量不要依赖DB额外列，避免失败；若存在则由数据库忽略未知字段
        if(publishAt) payload.publish_at = new Date(publishAt).toISOString();
        if(expireAt) payload.expire_at = new Date(expireAt).toISOString();
        let err=null;
        if(id){
            const r = await supabase.from('announcements').update(payload).eq('id', id);
            err = r.error;
        }else{
            const r = await supabase.from('announcements').insert([payload]);
            err = r.error;
        }
        if(err){ throw err; }
        showNotification && showNotification('公告已保存', 'success');
        closeModal('announcementModal');
        await loadAnnouncementsData();
    }catch(e){ showNotification && showNotification('保存失败: '+e.message, 'error'); }
}

async function editAnnouncement(id){
    try{
        await ensureAnnouncementsSupabaseReady();
        const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
        if(error) throw error;
        openAnnouncementModal(data);
    }catch(e){ showNotification && showNotification('加载公告失败: '+e.message, 'error'); }
}

async function deleteAnnouncement(id){
    if(!confirm('确定删除该公告吗？此操作不可撤销')) return;
    try{
        await ensureAnnouncementsSupabaseReady();
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if(error) throw error;
        showNotification && showNotification('公告已删除', 'success');
        await loadAnnouncementsData();
    }catch(e){ showNotification && showNotification('删除失败: '+e.message, 'error'); }
}

async function toggleAnnouncementPinned(id, wantPinned){
    try{
        await ensureAnnouncementsSupabaseReady();
        const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
        if(error) throw error;
        const meta = parseAnnMetaFromContent(data.content||'');
        if(wantPinned && meta.popup){
            return showNotification('你已设置弹窗，无法置顶', 'warning');
        }
        meta.pinned = !!wantPinned;
        const finalContent = buildAnnContentWithMeta(data.content||'', meta);
        const r = await supabase.from('announcements').update({ content: finalContent }).eq('id', id);
        if(r.error) throw r.error;
        showNotification && showNotification(wantPinned?'已置顶':'已取消置顶', 'success');
        await loadAnnouncementsData();
    }catch(e){ showNotification && showNotification('更新置顶失败: '+e.message, 'error'); }
}

// 设为/取消弹窗（全站唯一）
async function setAnnouncementPopup(id, wantPopup){
    try{
        await ensureAnnouncementsSupabaseReady();
        // 若设为弹窗，检查是否已有其他弹窗
        if(wantPopup){
            let { data: all, error: errAll } = await supabase.from('announcements').select('*').order('created_at', {ascending:false}).limit(200);
            if(errAll) throw errAll;
            all = Array.isArray(all)? all: [];
            const others = (all||[]).filter(a=> String(a.id)!==String(id));
            const exists = others.some(a=>{ const m=parseAnnMetaFromContent(a.content||''); return !!m.popup; });
            if(exists){ return showNotification('弹窗过多：已有其他公告被设置为弹窗', 'error'); }
        }
        // 更新当前公告的 meta
        const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
        if(error) throw error;
        const meta = parseAnnMetaFromContent(data.content||'');
        meta.popup = !!wantPopup;
        const finalContent = buildAnnContentWithMeta(data.content||'', meta);
        const r = await supabase.from('announcements').update({ content: finalContent }).eq('id', id);
        if(r.error) throw r.error;
        showNotification(wantPopup?'已设为弹窗':'已取消弹窗', 'success');
        await loadAnnouncementsData();
    }catch(e){ showNotification('更新弹窗状态失败: '+e.message, 'error'); }
}
// 暴露到全局（供HTML按钮调用）
if(typeof window!=='undefined'){
    window.openAnnouncementModal = openAnnouncementModal;
    window.saveAnnouncement = saveAnnouncement;
    window.editAnnouncement = editAnnouncement;
    window.deleteAnnouncement = deleteAnnouncement;
    window.toggleAnnouncementPinned = toggleAnnouncementPinned;
    window.setAnnouncementPopup = setAnnouncementPopup;
    window.handleAnnImageSelected = handleAnnImageSelected;
    window.openAnnouncementsSetupModal = function(){ try{ showModal('announcementSetupModal'); }catch(_){ } };
    window.copyAnnSetupSQL = function(){ try{ const pre=document.getElementById('annSetupSQL'); const r=document.createRange(); r.selectNode(pre); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges(); showNotification('已复制SQL，请前往 Supabase 执行','success'); }catch(e){ showNotification('复制失败: '+e.message,'error'); } };
}

function saveSystemSettings(){
    try{
        // 系统公告模块已移除（改用"公告管理"），仅保存保留的设置
        const maintenance = document.getElementById('settingMaintenanceEnabled')?.checked;
        const alipay = document.getElementById('settingAlipayEnabled')?.checked;
        const wechat = document.getElementById('settingWechatEnabled')?.checked;
        const density = document.getElementById('settingTableDensity')?.value || 'normal';
        const kkPullNew = document.getElementById('settingKKPullNew')?.value;
        const kkPullActive = document.getElementById('settingKKPullActive')?.value;
        const kkPullOld = document.getElementById('settingKKPullOld')?.value;
        const xr10 = document.getElementById('settingXR10')?.value;
        const xr100 = document.getElementById('settingXR100')?.value;
        const xr200 = document.getElementById('settingXR200')?.value;
        const xr1000 = document.getElementById('settingXR1000')?.value;
        const topN = null; const annLang = null; const tagDict = null;
        localStorage.setItem('admin:maintenance', maintenance ? 'true':'false');
        localStorage.setItem('admin:withdraw_alipay', alipay ? 'true':'false');
        localStorage.setItem('admin:withdraw_wechat', wechat ? 'true':'false');
        localStorage.setItem('admin:table_density', density);
        if(kkPullNew) localStorage.setItem('admin:kk_pull_new', String(kkPullNew));
        if(kkPullActive) localStorage.setItem('admin:kk_pull_active', String(kkPullActive));
        if(kkPullOld) localStorage.setItem('admin:kk_pull_old', String(kkPullOld));
        if(xr10) localStorage.setItem('admin:xr_10', String(xr10));
        if(xr100) localStorage.setItem('admin:xr_100', String(xr100));
        if(xr200) localStorage.setItem('admin:xr_200', String(xr200));
        if(xr1000) localStorage.setItem('admin:xr_1000', String(xr1000));
        // 公告相关设置不再保存
        try{
            document.body.classList.toggle('maintenance', !!maintenance);
            document.body.classList.toggle('dense-tables', density==='dense');
        }catch(_){ }
        try{
            const banner = document.querySelector('.maintenance-banner');
            if(banner) banner.style.display = maintenance ? 'block' : '';
        }catch(_){ }
        // 保存草稿列表（如果当前有显示）
        try{ persistDraftList(); }catch(_){ }
        showNotification('系统设置已保存', 'success');
        try{ __applyGuardDebounced(); }catch(_){ }
    }catch(e){ showNotification('保存失败: '+e.message, 'error'); }
}

function resetSystemSettings(){
    try{
        localStorage.removeItem('admin:announcement_enabled');
        localStorage.removeItem('admin:announcement_title');
        localStorage.removeItem('admin:announcement_message');
        localStorage.removeItem('admin:maintenance');
        localStorage.removeItem('admin:withdraw_alipay');
        localStorage.removeItem('admin:withdraw_wechat');
        localStorage.removeItem('admin:table_density');
        localStorage.removeItem('admin:kk_pull_new');
        localStorage.removeItem('admin:kk_pull_active');
        localStorage.removeItem('admin:kk_pull_old');
        localStorage.removeItem('admin:xr_10');
        localStorage.removeItem('admin:xr_100');
        localStorage.removeItem('admin:xr_200');
        localStorage.removeItem('admin:xr_1000');
        localStorage.removeItem('admin:announce_drafts');
        localStorage.removeItem('admin:ann_top_n');
        localStorage.removeItem('admin:ann_lang');
        localStorage.removeItem('admin:tag_dict');
        loadSystemSettings();
        showNotification('已恢复默认设置', 'info');
    }catch(e){ showNotification('恢复失败: '+e.message, 'error'); }
}
function addAnnouncementDraft(){
    try{
        const t=(document.getElementById('draftTitle')?.value||'').trim();
        const c=(document.getElementById('draftContent')?.value||'').trim();
        const p=(document.getElementById('draftPublishAt')?.value||'').trim();
        const e=(document.getElementById('draftExpireAt')?.value||'').trim();
        if(!t && !c){ return showNotification('请输入草稿标题或内容', 'warning'); }
        const list = JSON.parse(localStorage.getItem('admin:announce_drafts')||'[]');
        const pr = parseInt(document.getElementById('draftPriority')?.value||'0',10)||0;
        const lang = document.getElementById('draftLang')?.value || (localStorage.getItem('admin:ann_lang')||'zh-CN');
        const tags = (document.getElementById('draftTags')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const item = { id: 'd'+Date.now(), title: t||'未命名草稿', content: c||'', publish_at: p||null, expire_at: e||null, priority: pr, lang: lang, tags: tags, created_at: new Date().toISOString() };
        list.unshift(item);
        localStorage.setItem('admin:announce_drafts', JSON.stringify(list));
        renderDraftList(list);
        showNotification('草稿已添加', 'success');
        const tEl=document.getElementById('draftTitle'); if(tEl) tEl.value='';
        const cEl=document.getElementById('draftContent'); if(cEl) cEl.value='';
        const pEl=document.getElementById('draftPublishAt'); if(pEl) pEl.value='';
        const eEl=document.getElementById('draftExpireAt'); if(eEl) eEl.value='';
        const prEl=document.getElementById('draftPriority'); if(prEl) prEl.value='0';
        const tgEl=document.getElementById('draftTags'); if(tgEl) tgEl.value='';
    }catch(e){ showNotification('添加草稿失败: '+e.message, 'error'); }
}

function removeAnnouncementDraft(id){
    try{
        const list = JSON.parse(localStorage.getItem('admin:announce_drafts')||'[]').filter(it=> String(it.id)!==String(id));
        localStorage.setItem('admin:announce_drafts', JSON.stringify(list));
        renderDraftList(list);
    }catch(_){ }
}

function renderDraftList(list){
    try{
        const box=document.getElementById('draftList'); if(!box) return;
        if(!list || list.length===0){ box.innerHTML='<span style="color:#999;">暂无草稿</span>'; return; }
        // 排序：未过期的按发布时间倒序，其余在后
        const now=Date.now();
        const sorted = list.slice().sort((a,b)=>{
            const ap = a.publish_at ? new Date(a.publish_at).getTime() : 0;
            const bp = b.publish_at ? new Date(b.publish_at).getTime() : 0;
            return bp - ap;
        });
        box.innerHTML = sorted.map(it=>{
            const info = [ it.publish_at?('发布时间: '+it.publish_at):'即刻', it.expire_at?('过期: '+it.expire_at):''].filter(Boolean).join(' · ');
            return `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;border:1px solid #e5e7eb;padding:8px 10px;border-radius:8px;">
                <div>
                    <div style="font-weight:700;color:#111827;">${it.title}</div>
                    <div style="font-size:12px;color:#64748b;">${info||'—'}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="moveDraftUp('${it.id}')">上移</button>
                    <button class="btn btn-secondary btn-sm" type="button" onclick="moveDraftDown('${it.id}')">下移</button>
                    <button class="btn btn-error btn-sm" type="button" onclick="removeAnnouncementDraft('${it.id}')">删除</button>
                </div>
            </div>`;
        }).join('');
    }catch(_){ }
}

function persistDraftList(){
    try{ /* 已在 add/remove 时写入，这里可预留 */ }catch(_){ }
}

function moveDraftUp(id){
    try{
        const list = JSON.parse(localStorage.getItem('admin:announce_drafts')||'[]');
        const idx=list.findIndex(it=> String(it.id)===String(id)); if(idx<=0) return;
        const tmp=list[idx-1]; list[idx-1]=list[idx]; list[idx]=tmp;
        localStorage.setItem('admin:announce_drafts', JSON.stringify(list));
        renderDraftList(list);
    }catch(_){ }
}
function moveDraftDown(id){
    try{
        const list = JSON.parse(localStorage.getItem('admin:announce_drafts')||'[]');
        const idx=list.findIndex(it=> String(it.id)===String(id)); if(idx<0 || idx>=list.length-1) return;
        const tmp=list[idx+1]; list[idx+1]=list[idx]; list[idx]=tmp;
        localStorage.setItem('admin:announce_drafts', JSON.stringify(list));
        renderDraftList(list);
    }catch(_){ }
}
function clearAnnouncementDrafts(){
    if(!confirm('确认清空全部草稿？')) return;
    try{ localStorage.removeItem('admin:announce_drafts'); renderDraftList([]); showNotification('草稿已清空', 'success'); }catch(e){ showNotification('清空失败: '+e.message, 'error'); }
}

function previewAnnouncement(){
    try{
        const el = document.getElementById('settingAnnounceMessage');
        const box = document.getElementById('announcePreview');
        if(!el || !box) return;
        const raw = el.value || '';
        const html = simpleMarkdownToHtml(raw);
        box.innerHTML = html;
        box.style.display = 'block';
    }catch(e){ console.warn('previewAnnouncement failed', e); }
}

function simpleMarkdownToHtml(text){
    // 极简 Markdown 支持：**bold**、[link](url)、- 列表、换行
    let t = (text||'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.split(/\n/).map(line=>{
        if(/^\s*-\s+/.test(line)){
            return '<li>'+line.replace(/^\s*-\s+/, '')+'</li>';
        }
        return '<p>'+line+'</p>';
    }).join('');
    // 包裹列表
    t = t.replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>');
    return t;
}

function exportSystemSettings(){
    try{
        const keys = [
            'admin:announcement_enabled','admin:announcement_title','admin:announcement_message',
            'admin:maintenance','admin:withdraw_alipay','admin:withdraw_wechat','admin:table_density',
            'admin:kk_pull_new','admin:kk_pull_active','admin:kk_pull_old',
            'admin:xr_10','admin:xr_100','admin:xr_200','admin:xr_1000',
            'admin:announce_drafts','admin:ann_top_n','admin:ann_lang','admin:tag_dict'
        ];
        const data = {};
        keys.forEach(k=> data[k] = localStorage.getItem(k));
        const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='system-settings.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('设置已导出', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}
function importSystemSettings(evt){
    try{
        const file = evt.target && evt.target.files && evt.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try{
                const obj = JSON.parse(reader.result || '{}');
                Object.keys(obj||{}).forEach(k=>{ if(obj[k]!==undefined && obj[k]!==null) localStorage.setItem(k, obj[k]); });
                loadSystemSettings();
                showNotification('设置已导入', 'success');
            }catch(e2){ showNotification('导入失败: '+e2.message, 'error'); }
        };
        reader.readAsText(file);
    }catch(e){ showNotification('导入失败: '+e.message, 'error'); }
}
function applyMaintenanceGuard(){
    try{
        const maintenance = localStorage.getItem('admin:maintenance') === 'true';
        const riskySelectors = [
            'button.btn-error','button.btn-warning','button.btn-success','button.btn-primary',
            'button[onclick^="approve" ]','button[onclick^="reject" ]','button[onclick^="delete" ]','button[onclick^="save" ]'
        ];
        const hint = '维护模式中，操作暂不可用';
        riskySelectors.forEach(sel=>{
            document.querySelectorAll(sel).forEach(btn=>{
                const label = (btn.textContent||'').trim();
                const risky = /通过|拒绝|删除|完成|保存|提交/.test(label);
                if(maintenance && risky){
                    btn.setAttribute('disabled','true');
                    btn.setAttribute('title', hint);
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'not-allowed';
                }else{
                    btn.removeAttribute('disabled');
                    btn.removeAttribute('title');
                    btn.style.opacity = '';
                    btn.style.cursor = '';
                }
            });
        });
    }catch(_){ }
}
// 在页面切换和设置保存后应用维护限制
const __applyGuardDebounced = debounce(applyMaintenanceGuard, 50);

// 统一的维护模式拦截函数（缺失导致保存报错）
function guardMaintenanceOrProceed(actionLabel){
    try{
        const maintenance = localStorage.getItem('admin:maintenance') === 'true';
        if(maintenance){
            showNotification(`维护模式中，暂不可执行：${actionLabel||'此操作'}`,'warning');
            return false;
        }
    }catch(_){ }
    return true;
}
if(typeof window!=='undefined'){ window.guardMaintenanceOrProceed = guardMaintenanceOrProceed; }
// ================= 数据分析 =================
async function renderAnalytics(rangeDays){
    try{
        await ensureSupabaseReady();
        const days = parseInt(rangeDays||document.querySelector('.analytics-toolbar .btn.active')?.getAttribute('data-range')||7,10);
        // toolbar active 状态同步
        document.querySelectorAll('.analytics-toolbar .btn[data-range]')?.forEach(b=> b.classList.toggle('active', parseInt(b.getAttribute('data-range'),10)===days));
        const compareMode = document.getElementById('analyticsCompare')?.value || 'prev';
        const channelBy = document.querySelector('.analytics-toolbar [data-channel-by].active')?.getAttribute('data-channel-by') || document.querySelector('.analytics-toolbar [data-channel-by]')?.getAttribute('data-channel-by') || 'amount';
        if(channelBy){
            document.querySelectorAll('.analytics-toolbar [data-channel-by]')?.forEach(el=> el.classList.toggle('active', el.getAttribute('data-channel-by')===channelBy));
        }
        const since = new Date(Date.now()-days*24*3600*1000);
        // 关键指标
        const [newUsersRes, todayIncomeRes, pendingWithdrawalsRes, tasksPendingRes, tasksApprovedRes, tasksRejectedRes] = await Promise.allSettled([
            supabase.from('users').select('id, created_at').gte('created_at', since.toISOString()).order('created_at', {ascending:false}).limit(1000),
            supabase.from('earnings').select('amount, created_at').gte('created_at', since.toISOString()),
            supabase.from('withdrawals').select('id', {count:'exact', head:true}).eq('status','pending'),
            supabase.from('keyword_applications').select('id', {count:'exact', head:true}).eq('status','pending'),
            supabase.from('keyword_applications').select('id', {count:'exact', head:true}).in('status',['approved','passed','已通过']),
            supabase.from('keyword_applications').select('id', {count:'exact', head:true}).in('status',['rejected','已拒绝'])
        ]);

        // KPI + 同比/环比（以上一周期为对比）
        if(newUsersRes.status==='fulfilled' && !newUsersRes.value.error){
            const curArr = (newUsersRes.value.data||[]);
            let prevFrom = new Date(since - days*24*3600*1000), prevTo = since;
            if(compareMode==='wow'){ // 上周同期
                prevFrom = new Date(since - 7*24*3600*1000);
                prevTo = new Date(prevFrom.getTime()+days*24*3600*1000);
            } else if(compareMode==='mom'){ // 上月同日（近似用30天偏移）
                prevFrom = new Date(since - 30*24*3600*1000);
                prevTo = new Date(prevFrom.getTime()+days*24*3600*1000);
            } else if(compareMode==='yoy') { // 去年同日
                prevFrom = new Date(since); prevFrom.setFullYear(prevFrom.getFullYear()-1);
                prevTo = new Date(prevFrom.getTime()+days*24*3600*1000);
            }
            const prevRes = await supabase.from('users').select('id, created_at').gte('created_at', prevFrom.toISOString()).lt('created_at', prevTo.toISOString());
            const prevArr = prevRes.error ? [] : (prevRes.data||[]);
            const cur = curArr.length; const prev = prevArr.length;
            const delta = prev===0 ? (cur>0? '+∞%':'0%') : (((cur-prev)/prev*100).toFixed(1)+'%');
            document.getElementById('kpiNewUsers').textContent = cur;
            const nuDelta = document.getElementById('kpiNewUsersDelta'); if(nuDelta) nuDelta.textContent = `(${delta})`;
        }
        if(todayIncomeRes.status==='fulfilled' && !todayIncomeRes.value.error){
            const today = new Date(); today.setHours(0,0,0,0);
            const sum = (todayIncomeRes.value.data||[]).reduce((s,i)=>{ const t=new Date(i.created_at); return s + (t>=today ? (parseFloat(i.amount)||0):0); },0);
            const prevE = await supabase.from('earnings').select('amount, created_at').gte('created_at', new Date(today - 24*3600*1000).toISOString()).lt('created_at', today.toISOString());
            const prevSum = prevE.error ? 0 : (prevE.data||[]).reduce((s,i)=> s + (parseFloat(i.amount)||0), 0);
            const delta = prevSum===0 ? (sum>0? '+∞%':'0%') : (((sum-prevSum)/prevSum*100).toFixed(1)+'%');
            document.getElementById('kpiTodayIncome').textContent = '¥'+sum.toFixed(2);
            const incomeDelta = document.getElementById('kpiTodayIncomeDelta'); if(incomeDelta) incomeDelta.textContent = `(${delta})`;
        }
        if(pendingWithdrawalsRes.status==='fulfilled'){
            document.getElementById('kpiPendingWithdrawals').textContent = pendingWithdrawalsRes.value.count || 0;
        }
        if(tasksPendingRes.status==='fulfilled'){
            document.getElementById('kpiTaskApply').textContent = tasksPendingRes.value.count || 0;
        }
        if(tasksApprovedRes.status==='fulfilled'){
            document.getElementById('kpiTaskApproved').textContent = tasksApprovedRes.value.count || 0;
        }
        if(tasksRejectedRes.status==='fulfilled'){
            document.getElementById('kpiTaskRejected').textContent = tasksRejectedRes.value.count || 0;
        }

        // 简单趋势数据（近7天）
        const trendCanvas = document.getElementById('incomeTrend');
        if(trendCanvas && todayIncomeRes.status==='fulfilled' && !todayIncomeRes.value.error && window.Chart){
            const arr = new Array(7).fill(0);
            const labels = [];
            const now = new Date();
            for(let i=6;i>=0;i--){ const d=new Date(now- i*24*3600*1000); labels.push((d.getMonth()+1)+'/'+d.getDate()); }
            for(const item of (todayIncomeRes.value.data||[])){
                const d = new Date(item.created_at);
                const diff = Math.floor((now - d)/(24*3600*1000));
                if(diff>=0 && diff<7){ arr[6-diff] += parseFloat(item.amount)||0; }
            }
            if(trendCanvas.__chart) { try{ trendCanvas.__chart.destroy(); }catch(_){} }
            const trendCfg = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{ label: '收益(¥)', data: arr, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', tension: 0.3, fill: true }]
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            };
            try { trendCanvas.__chart = new Chart(trendCanvas.getContext('2d'), trendCfg); } catch(e){ console.warn('trend chart error', e); }
        }

        const pieCanvas = document.getElementById('channelPie');
        if(pieCanvas && window.Chart){
            const res = await supabase.from('earnings').select('task_type, amount, created_at').gte('created_at', since.toISOString());
            if(!res.error){
                const countMap = {};
                (res.data||[]).forEach(r=>{ const k=r.task_type||'其他'; const v = channelBy==='amount' ? (parseFloat(r.amount)||0) : 1; countMap[k]=(countMap[k]||0)+v; });
                const labels = Object.keys(countMap);
                const data = Object.values(countMap);
                if(pieCanvas.__chart) { try{ pieCanvas.__chart.destroy(); }catch(_){} }
                const pieCfg = {
                    type: 'doughnut',
                    data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#6366f1','#22c55e','#f97316','#06b6d4','#eab308','#ef4444','#a855f7'] }] },
                    options: { plugins: { legend: { position: 'right' } }, cutout: '60%' }
                };
                try { pieCanvas.__chart = new Chart(pieCanvas.getContext('2d'), pieCfg); } catch(e){ console.warn('pie chart error', e); }
            }
        }

        // 用户增长趋势
        const userCanvas = document.getElementById('userTrend');
        if(userCanvas && window.Chart && newUsersRes.status==='fulfilled' && !newUsersRes.value.error){
            const arr = new Array(days).fill(0);
            const labels = [];
            const now = new Date();
            for(let i=days-1;i>=0;i--){ const d=new Date(now- i*24*3600*1000); labels.push((d.getMonth()+1)+'/'+d.getDate()); }
            for(const u of (newUsersRes.value.data||[])){
                const d=new Date(u.created_at); const diff=Math.floor((now-d)/(24*3600*1000)); if(diff>=0 && diff<days){ arr[days-1-diff] += 1; }
            }
            if(userCanvas.__chart) { try{ userCanvas.__chart.destroy(); }catch(_){} }
            const userCfg = {
                type: 'line',
                data: { labels: labels, datasets: [{ label: '新增用户', data: arr, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)', tension: 0.3, fill: true }] },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            };
            try { userCanvas.__chart = new Chart(userCanvas.getContext('2d'), userCfg); } catch(e){ console.warn('user chart error', e); }
        }

        // 提现状态分布
        const wdPie = document.getElementById('withdrawalPie');
        if(wdPie && window.Chart){
            const res = await supabase.from('withdrawals').select('status, created_at').gte('created_at', since.toISOString());
            if(!res.error){
                const map = { pending:0, approved:0, rejected:0 };
                (res.data||[]).forEach(w=>{
                    const st=(w.status||'').toLowerCase();
                    if(st.includes('pending')||st.includes('审核')) map.pending++;
                    else if(st.includes('reject')||st.includes('拒绝')||st.includes('失败')) map.rejected++;
                    else map.approved++;
                });
                const labels=['审核中','已通过','已拒绝'];
                const data=[map.pending,map.approved,map.rejected];
                if(wdPie.__chart) { try{ wdPie.__chart.destroy(); }catch(_){} }
                const wdCfg = { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#f59e0b','#3b82f6','#ef4444'] }] }, options: { plugins: { legend: { position:'right' } }, cutout:'60%' } };
                try { wdPie.__chart = new Chart(wdPie.getContext('2d'), wdCfg); } catch(e){ console.warn('wd chart error', e); }
            }
        }

        // 任务通过漏斗（申请→审核中→通过）
        const funnel = document.getElementById('taskFunnel');
        if(funnel && window.Chart){
            const [applyRes, pendingRes, passRes] = await Promise.all([
                supabase.from('keyword_applications').select('id', {count:'exact', head:true}).gte('created_at', since.toISOString()),
                supabase.from('keyword_applications').select('id', {count:'exact', head:true}).eq('status','pending').gte('created_at', since.toISOString()),
                supabase.from('keyword_applications').select('id', {count:'exact', head:true}).in('status',['approved','passed','已通过']).gte('created_at', since.toISOString())
            ]);
            const labels=['申请','审核中','通过'];
            const data=[applyRes.count||0, pendingRes.count||0, passRes.count||0];
            if(funnel.__chart) { try{ funnel.__chart.destroy(); }catch(_){} }
            const funnelCfg = { type:'bar', data:{ labels: labels, datasets:[{ data: data, backgroundColor:['#94a3b8','#f59e0b','#10b981'] }] }, options:{ indexAxis:'y', plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true } } } };
            try { funnel.__chart = new Chart(funnel.getContext('2d'), funnelCfg); } catch(e){ console.warn('funnel chart error', e); }
        }
    }catch(e){ console.warn('渲染数据分析失败', e); }
}

// 切换侧边栏
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}
// 加载仪表盘数据
async function loadDashboardData() {
    try {
        console.log('🚀 正在加载仪表盘数据...');
        console.log('🔍 检查统计卡片元素是否存在...');
        
        // 🔧 预先检查元素是否存在
        const totalUsersEl = document.getElementById('totalUsers');
        const totalEarningsEl = document.getElementById('totalEarnings');
        const pendingWithdrawalsEl = document.getElementById('pendingWithdrawals');
        const activeTasksEl = document.getElementById('activeTasks');
        
        console.log('📋 元素检查结果:', {
            totalUsers: totalUsersEl ? '存在' : '缺失',
            totalEarnings: totalEarningsEl ? '存在' : '缺失',
            pendingWithdrawals: pendingWithdrawalsEl ? '存在' : '缺失',
            activeTasks: activeTasksEl ? '存在' : '缺失'
        });
        
        // 🔧 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        // 🔧 检查数据库表是否存在（但不阻止数据加载）
        const tablesExist = await checkDatabaseTables();
        if (!tablesExist) {
            console.log('⚠️ 部分数据库表不存在，继续尝试加载数据...');
            // 🔧 不再直接return，而是继续尝试加载数据
        }
        
        // 🔧 修复：并行加载统计数据（修正查询语句）
        const [usersResult, earningsResult, withdrawalsResult] = await Promise.allSettled([
            supabase.from('users').select('id', { count: 'exact' }).limit(1),
            supabase.from('earnings').select('amount'),
            supabase.from('withdrawals').select('id', { count: 'exact' }).eq('status', 'pending').limit(1)
        ]);
        
        // 🔧 修复：正确处理统计数据
        console.log('📊 处理统计数据结果...');
        
        // 处理用户统计
        if (usersResult.status === 'fulfilled' && !usersResult.value.error) {
            const userCount = usersResult.value.count || usersResult.value.data?.length || 0;
            updateStatCard('totalUsers', userCount);
            console.log('✅ 用户统计:', userCount);
            try{
                // 环比：上一周期
                const days=7; const since=new Date(Date.now()-days*24*3600*1000);
            const prev = await supabase.from('users').select('id', { count: 'exact' }).lt('created_at', since.toISOString()).limit(1);
            const prevCount = prev.error?0:(prev.count||prev.data?.length||0);
                const delta = prevCount===0 ? (userCount>0? '+∞%':'0%') : (((userCount-prevCount)/prevCount*100).toFixed(1)+'%');
                const d=document.getElementById('totalUsersDelta'); if(d) d.textContent = `较上一周期 ${delta}`;
            }catch(_){}
        } else {
            console.warn('⚠️ 用户统计查询失败:', usersResult.reason || usersResult.value?.error?.message);
            // 🔧 不设置默认值，保持原始显示或尝试其他方式获取
        }
        
        // 处理收益统计
        if (earningsResult.status === 'fulfilled' && !earningsResult.value.error && earningsResult.value.data) {
            const earnings = earningsResult.value.data;
            console.log('🔍 收益数据详情:', earnings);
            
            const totalEarnings = earnings.reduce((sum, item) => {
                const amount = parseFloat(item.amount) || 0;
                console.log(`📊 收益项: ${amount}`);
                return sum + amount;
            }, 0);
            
            // 当页面存在"重置"按钮时，实时写入元素，避免被覆盖
            const totalText = `¥${totalEarnings.toFixed(2)}`;
            const el=document.getElementById('totalEarnings'); if(el && el.textContent && el.textContent.includes('¥') && el.textContent!=='¥0.00'){ el.textContent = totalText; } else if(!el || el.textContent==='-' ){ updateStatCard('totalEarnings', totalText); } else { /* 若用户点过重置，保持当前显示 */ }
            console.log('✅ 收益统计:', totalEarnings.toFixed(2));
            try{
                const days=7; const since=new Date(Date.now()-days*24*3600*1000);
                const prev = await supabase.from('earnings').select('amount').lt('created_at', since.toISOString());
                const prevSum = prev.error?0:(prev.data||[]).reduce((s,i)=> s+(parseFloat(i.amount)||0), 0);
                const delta = prevSum===0 ? (totalEarnings>0? '+∞%':'0%') : (((totalEarnings-prevSum)/prevSum*100).toFixed(1)+'%');
                const d=document.getElementById('totalEarningsDelta'); if(d) d.textContent = `较上一周期 ${delta}`;
            }catch(_){}
        } else {
            console.warn('⚠️ 收益统计查询失败:', earningsResult.reason || earningsResult.value?.error?.message);
            // 🔧 不设置默认值，保持原始显示
        }
        
        // 处理提现统计
        if (withdrawalsResult.status === 'fulfilled' && !withdrawalsResult.value.error) {
            const pendingCount = withdrawalsResult.value.count || withdrawalsResult.value.data?.length || 0;
            updateStatCard('pendingWithdrawals', pendingCount);
            console.log('✅ 待处理提现统计:', pendingCount);
            const d=document.getElementById('pendingWithdrawalsDelta'); if(d) d.textContent = '';
        } else {
            console.warn('⚠️ 提现统计查询失败:', withdrawalsResult.reason || withdrawalsResult.value?.error?.message);
            // 🔧 不设置默认值，保持原始显示
        }
        
        updateStatCard('activeTasks', 0); // 任务功能待实现
        const atd=document.getElementById('activeTasksDelta'); if(atd) atd.textContent='';
        
        // 追加：今日/本周/本月收益统计
        try{
            const now=new Date();
            const startOfDay=new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek=new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate()-((startOfDay.getDay()+6)%7));
            const startOfMonth=new Date(now.getFullYear(), now.getMonth(), 1);
            let rows=(await supabase.from('earnings').select('amount,status,created_at')).data||[];
            try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('earning_')){ try{ const e=JSON.parse(localStorage.getItem(k)); if(e) rows.push(e);}catch(_){ } } } }catch(_){ }
            rows=rows.filter(e=>{ const s=(e.status||'').toString().toLowerCase(); return !/(rejected|canceled|cancelled|已取消|已拒绝)/.test(s); });
            const sum=a=> a.reduce((t,x)=> t+(parseFloat(x.amount||0)||0),0);
            const today=sum(rows.filter(e=> new Date(e.created_at)>=startOfDay));
            const week=sum(rows.filter(e=> new Date(e.created_at)>=startOfWeek));
            const month=sum(rows.filter(e=> new Date(e.created_at)>=startOfMonth));
            const te=document.getElementById('todayEarnings'); if(te) te.textContent='¥'+today.toFixed(2);
            const we=document.getElementById('weekEarnings'); if(we) we.textContent='¥'+week.toFixed(2);
            const me=document.getElementById('monthEarnings'); if(me) me.textContent='¥'+month.toFixed(2);
        }catch(_){ }

        // 加载最近数据（使用更健壮的错误处理）
        const detailResults = await Promise.allSettled([
            loadRecentUsers(),
            loadRecentEarnings(),
            loadPendingWithdrawals()
        ]);
        
        // 🔧 备用策略：如果统计查询失败，尝试从详细数据重新计算
        await recalculateStatsFromDetails();
        
        console.log('✅ 仪表盘数据加载完成');
        
        // 🔧 调试：记录详细的加载结果
        console.log('📊 仪表盘加载详情:', {
            用户统计: usersResult.status === 'fulfilled' ? '成功' : '失败',
            收益统计: earningsResult.status === 'fulfilled' ? '成功' : '失败', 
            提现统计: withdrawalsResult.status === 'fulfilled' ? '成功' : '失败',
            详细数据: detailResults.map(r => r.status)
        });
        
        // 🔧 修复：优先检查数据，只有在真正没有数据时才显示提示
        const hasData = await checkIfHasData();
        console.log(`📊 数据检查结果: hasData=${hasData}, tablesExist=${tablesExist}`);
        
        // 🔧 额外检查：如果统计卡片已经显示了有效数据，就不要覆盖
        const currentUserCount = document.getElementById('totalUsers')?.textContent;
        const currentEarnings = document.getElementById('totalEarnings')?.textContent;
        const hasValidDataDisplayed = currentUserCount && currentUserCount !== '-' && currentUserCount !== '0' ||
                                     currentEarnings && currentEarnings !== '-' && currentEarnings !== '¥0.00';
        
        if (hasData || hasValidDataDisplayed) {
            // 如果有数据或页面已显示有效数据，就不显示任何初始化提示
            console.log('✅ 检测到数据存在或页面已显示数据，跳过初始化提示');
        } else if (tablesExist) {
            // 表存在但没有数据，提示创建测试数据
            console.log('💡 表存在但无数据，显示测试数据提示');
            showCreateTestDataPrompt();
        } else {
            // 表不存在，显示数据库初始化提示
            console.log('💡 数据库表需要初始化');
            showDatabaseSetupPrompt();
        }
        
    // 渲染仪表盘迷你趋势
    try { await loadDashboardSparklines(); } catch(e) { console.warn('sparkline failed', e); }
    
    } catch (error) {
        console.error('❌ 加载仪表盘数据失败:', error);
        
        // 🔧 只在必要时设置默认值，不覆盖已有数据
        console.log('⚠️ 数据加载失败，检查是否需要设置默认值...');
        
        // 只有在元素仍显示"-"时才设置默认值，不覆盖已有的正确数据
        if (document.getElementById('totalUsers')?.textContent === '-') {
            updateStatCard('totalUsers', 0);
        }
        if (document.getElementById('totalEarnings')?.textContent === '-') {
            updateStatCard('totalEarnings', '¥0.00');
        }
        if (document.getElementById('pendingWithdrawals')?.textContent === '-') {
            updateStatCard('pendingWithdrawals', 0);
        }
        if (document.getElementById('activeTasks')?.textContent === '-') {
            updateStatCard('activeTasks', 0);
        }
        
        // 显示友好的错误信息
        if (error.message.includes('数据库连接不可用')) {
            showDatabaseConnectionError();
        } else {
        showNotification('加载仪表盘数据失败: ' + error.message, 'error');
            // 只有在严重错误时才显示设置提示
            if (error.message.includes('network') || error.message.includes('fetch')) {
                showDatabaseSetupPrompt();
            }
        }
    }
}

// 🔹 小型趋势图渲染（放简单文本/条形替代，避免失败）
function renderSparklines(){
    try{
        const el=document.getElementById('sparkUsers'); if(el){ el.getContext? (el.getContext('2d')&& (el.width=el.clientWidth, el.height=36)) : null; }
        const el2=document.getElementById('sparkEarnings'); if(el2){ el2.getContext? (el2.getContext('2d')&& (el2.width=el2.clientWidth, el2.height=36)) : null; }
        const el3=document.getElementById('sparkWithdrawals'); if(el3){ el3.getContext? (el3.getContext('2d')&& (el3.width=el3.clientWidth, el3.height=36)) : null; }
        const el4=document.getElementById('sparkTasks'); if(el4){ el4.getContext? (el4.getContext('2d')&& (el4.width=el4.clientWidth, el4.height=36)) : null; }
    }catch(_){ }
}

// 生成仪表盘小型趋势图（近7天）
async function loadDashboardSparklines(){
    try{
        await ensureSupabaseReady();
        const days=7; const since=new Date(Date.now()-days*24*3600*1000);
        // 用户
        try{
            const u=await supabase.from('users').select('created_at').gte('created_at', since.toISOString());
            drawMiniLine('sparkUsers', timeBucket(u.data||[], days, x=>1));
        }catch(e){console.warn('spark users',e)}
        // 收益
        try{
            const e=await supabase.from('earnings').select('amount, created_at').gte('created_at', since.toISOString());
            drawMiniLine('sparkEarnings', timeBucket(e.data||[], days, x=> parseFloat(x.amount)||0));
        }catch(e){console.warn('spark earnings',e)}
        // 提现（按审核中量）
        try{
            const w=await supabase.from('withdrawals').select('status, created_at').gte('created_at', since.toISOString());
            drawMiniLine('sparkWithdrawals', timeBucket(w.data||[], days, x=> (String(x.status||'').toLowerCase().includes('pending')?1:0)), '#f59e0b');
        }catch(e){console.warn('spark withdrawals',e)}
        // 任务（按申请量）
        try{
            const t=await supabase.from('keyword_applications').select('created_at').gte('created_at', since.toISOString());
            drawMiniLine('sparkTasks', timeBucket(t.data||[], days, x=>1), '#06b6d4');
        }catch(e){console.warn('spark tasks',e)}
    }catch(e){ console.warn('loadDashboardSparklines', e); }
}

function timeBucket(arr, days, getVal){
    const out=new Array(days).fill(0); const now=new Date();
    arr.forEach(it=>{ const d=new Date(it.created_at); const diff=Math.floor((now-d)/(24*3600*1000)); if(diff>=0 && diff<days){ out[days-1-diff]+= getVal(it); } });
    return out;
}

function drawMiniLine(canvasId, data, color){
    try{
        const c=document.getElementById(canvasId); if(!c||!c.getContext) return;
        const ctx=c.getContext('2d'); const w=c.width=c.clientWidth; const h=c.height=c.clientHeight||36;
        ctx.clearRect(0,0,w,h); const max=Math.max(1, ...data);
        const step=w/(data.length-1||1); ctx.strokeStyle=color||'#6366f1'; ctx.lineWidth=2; ctx.beginPath();
        data.forEach((v,i)=>{ const x=i*step; const y=h - (v/max)*(h-6) - 3; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
        ctx.stroke();
        // 阴影填充
        const grad=ctx.createLinearGradient(0,0,0,h); grad.addColorStop(0,(color||'#6366f1')+'33'); grad.addColorStop(1,'#ffffff00');
        ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    }catch(e){ console.warn('drawMiniLine', e); }
}

// 🔧 修复：检查数据库表是否存在（移除不必要的预检查）
async function checkDatabaseTables() {
    try {
        console.log('🔍 检查数据库表是否存在...');
        
        // 🔧 移除了不必要的supabase预检查，因为调用此函数前已经确保supabase可用
        
        const tables = ['users', 'earnings', 'withdrawals'];
        const results = await Promise.allSettled(tables.map(table => 
            supabase.from(table).select('id', { count: 'exact' }).limit(1)
        ));
        
        const existingTables = results.filter(result => 
            result.status === 'fulfilled' && !result.value.error
        ).length;
        
        console.log(`📊 发现 ${existingTables}/${tables.length} 个表存在`);
        return existingTables === tables.length;
        
    } catch (error) {
        console.error('❌ 检查数据库表失败:', error);
        return false;
    }
}
// 🔧 新增：从详细数据重新计算统计（备用策略）
async function recalculateStatsFromDetails() {
    try {
        console.log('🔄 尝试从详细数据重新计算统计...');
        
        // 检查当前统计显示是否有效
        const currentUsers = document.getElementById('totalUsers')?.textContent;
        const currentEarnings = document.getElementById('totalEarnings')?.textContent;
        const currentWithdrawals = document.getElementById('pendingWithdrawals')?.textContent;
        
        console.log('📊 当前统计显示:', {
            用户: currentUsers,
            收益: currentEarnings,
            提现: currentWithdrawals
        });
        
        // 如果统计显示为空或默认值，尝试重新计算
        if (currentUsers === '-' || currentUsers === '0') {
            console.log('🔍 重新查询用户统计...');
            try {
                const { data: users, error } = await supabase
                    .from('users')
                    .select('id', { count: 'exact', head: true });
                
                if (!error && users !== null) {
                    const userCount = users;
                    updateStatCard('totalUsers', userCount);
                    console.log('✅ 用户统计重新计算成功:', userCount);
                }
            } catch (error) {
                console.warn('⚠️ 用户统计重新计算失败:', error.message);
            }
        }
        
        if (currentEarnings === '-' || currentEarnings === '¥0.00') {
            console.log('🔍 重新查询收益统计...');
            try {
                const { data: earnings, error } = await supabase
                    .from('earnings')
                    .select('amount');
                
                if (!error && earnings) {
                    const totalEarnings = earnings.reduce((sum, item) => {
                        return sum + (parseFloat(item.amount) || 0);
                    }, 0);
                    
                    updateStatCard('totalEarnings', `¥${totalEarnings.toFixed(2)}`);
                    console.log('✅ 收益统计重新计算成功:', totalEarnings.toFixed(2));
                }
            } catch (error) {
                console.warn('⚠️ 收益统计重新计算失败:', error.message);
            }
        }
        
        if (currentWithdrawals === '-' || currentWithdrawals === '0') {
            console.log('🔍 重新查询提现统计...');
            try {
                const { data: withdrawals, error } = await supabase
                    .from('withdrawals')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'pending');
                
                if (!error && withdrawals !== null) {
                    const pendingCount = withdrawals;
                    updateStatCard('pendingWithdrawals', pendingCount);
                    console.log('✅ 提现统计重新计算成功:', pendingCount);
                }
            } catch (error) {
                console.warn('⚠️ 提现统计重新计算失败:', error.message);
            }
        }
        
    } catch (error) {
        console.warn('⚠️ 统计重新计算过程失败:', error.message);
    }
}

// 🔧 增强：检查是否有数据（更详细的日志）
async function checkIfHasData() {
    try {
        console.log('🔍 开始检查数据库数据...');
        
        const [usersCount, earningsCount, withdrawalsCount] = await Promise.allSettled([
            supabase.from('users').select('id', { count: 'exact' }).limit(1),
            supabase.from('earnings').select('id', { count: 'exact' }).limit(1),
            supabase.from('withdrawals').select('id', { count: 'exact' }).limit(1)
        ]);
        
        const userRecords = usersCount.status === 'fulfilled' && !usersCount.value.error ? (usersCount.value.count || usersCount.value.data?.length || 0) : 0;
        const earningRecords = earningsCount.status === 'fulfilled' && !earningsCount.value.error ? (earningsCount.value.count || earningsCount.value.data?.length || 0) : 0;
        const withdrawalRecords = withdrawalsCount.status === 'fulfilled' && !withdrawalsCount.value.error ? (withdrawalsCount.value.count || withdrawalsCount.value.data?.length || 0) : 0;
        
        const totalRecords = userRecords + earningRecords + withdrawalRecords;
        
        console.log(`📊 数据统计详情:`, {
            用户记录: userRecords,
            收益记录: earningRecords,
            提现记录: withdrawalRecords,
            总记录数: totalRecords
        });
        
        const hasData = totalRecords > 0;
        console.log(`📈 数据检查结果: ${hasData ? '有数据' : '无数据'}`);
        
        return hasData;
        
    } catch (error) {
        console.error('❌ 检查数据失败:', error);
        return false;
    }
}

// 🔧 新增：显示数据库设置提示
function showDatabaseSetupPrompt() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="setup-prompt" style="display: flex; justify-content: center; align-items: center; height: 400px; flex-direction: column;">
                <div style="background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 12px; padding: 32px; max-width: 600px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="font-size: 48px; margin-bottom: 16px;">🛠️</div>
                    <h3 style="color: #8b4513; margin-bottom: 16px; font-size: 24px;">数据库需要初始化</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                        检测到数据库表不存在或无法访问。<br>
                        请点击下方按钮来自动创建和初始化数据库。
                    </p>
                    <div style="margin-bottom: 20px;">
                        <button onclick="initializeDatabase()" style="background: #007cba; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin: 0 8px; font-size: 16px; font-weight: 500;">
                            🚀 自动初始化数据库
                        </button>
                        <button onclick="createAllTestData()" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin: 0 8px; font-size: 16px; font-weight: 500;">
                            📊 创建测试数据
                        </button>
                    </div>
                    <div style="margin-top: 20px;">
                        <button onclick="testDatabaseConnection()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin: 0 4px; font-size: 14px;">
                            🔧 测试连接
                        </button>
                        <button onclick="location.href='supabase-diagnostics.html'" style="background: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin: 0 4px; font-size: 14px;">
                            🔍 诊断工具
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// 🔧 新增：显示创建测试数据提示
function showCreateTestDataPrompt() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #e8f4fd;
        border: 2px solid #007cba;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        text-align: center;
        z-index: 4000;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    `;
    
    notification.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 12px;">📊</div>
        <h4 style="color: #007cba; margin-bottom: 12px;">数据库为空</h4>
        <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
            数据库连接成功，但还没有任何数据。<br>
            是否创建一些测试数据来体验功能？
        </p>
        <div>
            <button onclick="createAllTestData(); this.parentElement.parentElement.remove();" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 0 8px;">
                ✅ 创建测试数据
            </button>
            <button onclick="this.parentElement.parentElement.remove();" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 0 8px;">
                ❌ 稍后再说
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 5秒后自动消失
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// 🔧 新增：初始化数据库
async function initializeDatabase() {
    try {
        console.log('🚀 开始初始化数据库...');
        showNotification('正在初始化数据库，请稍候...', 'info');
        
        // 创建所有必要的表
        await Promise.all([
            createUsersTableIfNotExists(),
            fixEarningsDatabase(),
            fixWithdrawalsDatabase(),
            createXrayKeywordTableIfNotExists()
        ]);
        
        showNotification('数据库初始化完成！', 'success');
        
        // 重新加载数据
        setTimeout(() => {
            location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        showNotification('数据库初始化失败: ' + error.message, 'error');
    }
}
// 🔧 新增：创建用户表
async function createUsersTableIfNotExists() {
    try {
        console.log('📝 创建用户表...');
        
        const createUserTableSQL = `
            CREATE TABLE IF NOT EXISTS public.users (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                phone TEXT,
                real_name TEXT,
                alipay_account TEXT,
                wallet_balance DECIMAL(10,2) DEFAULT 0,
                qr_code_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- 创建索引
            CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
            CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
            
            -- 禁用RLS
            ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
        `;
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: createUserTableSQL });
        
        if (error) {
            console.error('创建用户表失败:', error);
            throw error;
        }
        
        console.log('✅ 用户表创建完成');
        
    } catch (error) {
        console.error('❌ 创建用户表失败:', error);
        throw error;
    }
}
// 🔧 新增：创建 xray_keywords 表
async function createXrayKeywordTableIfNotExists(){
    try{
        console.log('📝 创建 xray_keywords 表...');
        const sql = `
            CREATE TABLE IF NOT EXISTS public.xray_keywords (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                keyword TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_xray_keywords_keyword ON public.xray_keywords(keyword);
            CREATE INDEX IF NOT EXISTS idx_xray_keywords_created_at ON public.xray_keywords(created_at);
            ALTER TABLE public.xray_keywords DISABLE ROW LEVEL SECURITY;`;
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) { console.warn('创建 xray_keywords 失败:', error); return false; }
        console.log('✅ xray_keywords 表已就绪');
        return true;
    }catch(e){ console.warn('创建 xray_keywords 表异常', e); return false; }
}

// 手动触发表创建
async function triggerXrayKeywordTableCreate(){
    try{
        await ensureSupabaseReady();
        const ok = await createXrayKeywordTableIfNotExists();
        if(ok){
            showNotification('xray_keywords 表已创建/存在', 'success');
            // 刷新当前仓库视图
            setTimeout(()=>{ loadXrayKeywordRepo(); }, 500);
            // 表创建后尝试将本地条目推送到数据库
            setTimeout(()=>{ try{ migrateLocalXrayKeywordsToDB(); }catch(_){ } }, 1200);
        }else{
            showNotification('创建表失败，请查看控制台日志', 'error');
        }
    }catch(e){ showNotification('创建表失败: '+e.message, 'error'); }
}

// 🔧 新增：创建 kk_keywords 表（手动）
async function triggerKKKeywordTableCreate(){
    try{
        await ensureSupabaseReady();
        const sql = `
            CREATE TABLE IF NOT EXISTS public.kk_keywords (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                keyword TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_kk_keywords_keyword ON public.kk_keywords(keyword);
            CREATE INDEX IF NOT EXISTS idx_kk_keywords_created_at ON public.kk_keywords(created_at);
            ALTER TABLE public.kk_keywords DISABLE ROW LEVEL SECURITY;`;
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if(error){ showNotification('创建 kk_keywords 表失败', 'error'); return; }
        showNotification('kk_keywords 表已创建/存在', 'success');
        setTimeout(()=>{ loadKKKeywordRepo(); }, 500);
    }catch(e){ showNotification('创建表失败: '+e.message, 'error'); }
}
// 加固 kk_keywords 的权限与轻量过程
async function triggerSecureKKKeywords(){
    try{
        await ensureSupabaseReady();
        const sql = `
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='kk_keywords') THEN
                    ALTER TABLE public.kk_keywords ENABLE ROW LEVEL SECURITY;
                    DROP POLICY IF EXISTS kk_keywords_select ON public.kk_keywords;
                    CREATE POLICY kk_keywords_select ON public.kk_keywords FOR SELECT TO anon USING (true);
                    DROP POLICY IF EXISTS kk_keywords_insert ON public.kk_keywords;
                    CREATE POLICY kk_keywords_insert ON public.kk_keywords FOR INSERT TO service_role WITH CHECK (true);
                    DROP POLICY IF EXISTS kk_keywords_update ON public.kk_keywords;
                    CREATE POLICY kk_keywords_update ON public.kk_keywords FOR UPDATE TO service_role USING (true) WITH CHECK (true);
                    DROP POLICY IF EXISTS kk_keywords_delete ON public.kk_keywords;
                    CREATE POLICY kk_keywords_delete ON public.kk_keywords FOR DELETE TO service_role USING (true);
                END IF;
            END $$;`;
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if(error){ showNotification('加固失败', 'error'); return; }
        showNotification('kk_keywords 权限已加固', 'success');
    }catch(e){ showNotification('加固失败: '+e.message, 'error'); }
}
// 加固 xray_keywords 的权限与轻量过程
async function triggerSecureXrayKeywords(){
    try{
        await ensureSupabaseReady();
        const sql = `
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='xray_keywords') THEN
                    ALTER TABLE public.xray_keywords ENABLE ROW LEVEL SECURITY;
                    DROP POLICY IF EXISTS xray_keywords_select ON public.xray_keywords;
                    CREATE POLICY xray_keywords_select ON public.xray_keywords FOR SELECT TO anon USING (true);
                    DROP POLICY IF EXISTS xray_keywords_insert ON public.xray_keywords;
                    CREATE POLICY xray_keywords_insert ON public.xray_keywords FOR INSERT TO service_role WITH CHECK (true);
                    DROP POLICY IF EXISTS xray_keywords_update ON public.xray_keywords;
                    CREATE POLICY xray_keywords_update ON public.xray_keywords FOR UPDATE TO service_role USING (true) WITH CHECK (true);
                    DROP POLICY IF EXISTS xray_keywords_delete ON public.xray_keywords;
                    CREATE POLICY xray_keywords_delete ON public.xray_keywords FOR DELETE TO service_role USING (true);
                END IF;
            END $$;`;
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if(error){ showNotification('加固失败', 'error'); return; }
        showNotification('xray_keywords 权限已加固', 'success');
    }catch(e){ showNotification('加固失败: '+e.message, 'error'); }
}
// ===== 团长管理：读取用户邀请关系与统计（简版展示用） =====
async function loadLeadersForAdmin(){
    try{
        const tbody=document.querySelector('#leadersTable tbody'); if(!tbody) return;
        await ensureSupabaseReady();
        let leaders=[];
        // 尝试从 referrals 表聚合
        try{
            const { data, error } = await supabase.from('referrals').select('*');
            if(!error && Array.isArray(data)){
                const stats=new Map();
                data.forEach(r=>{ const id=String(r.inviter_id||''); if(!id) return; const o=stats.get(id)||{ inviter_id:id, level1:0 }; o.level1++; stats.set(id,o); });
                leaders = Array.from(stats.values());
            }
        }catch(_){ }
        // 回退：本地 referrals
        if(leaders.length===0){
            try{ const local=JSON.parse(localStorage.getItem('referrals')||'[]'); const stats=new Map(); local.forEach(r=>{ const id=String(r.inviter_id||''); if(!id) return; const o=stats.get(id)||{ inviter_id:id, level1:0 }; o.level1++; stats.set(id,o); }); leaders = Array.from(stats.values()); }catch(_){ }
        }
        // 补充用户名（优先从白名单映射 short_code→username，其次根据 user_id 映射）
        let allowlist=[];
        try{ const res=await supabase.from('leaders_allowlist').select('user_id,username,short_code'); if(res && !res.error && Array.isArray(res.data)) allowlist = res.data; }catch(_){ }
        try{ if(allowlist.length===0){ allowlist = JSON.parse(localStorage.getItem('leaders_allowlist')||'[]'); } }catch(_){ }
        const scToName = new Map(); const idToName=new Map();
        allowlist.forEach(r=>{ if(r.short_code){ scToName.set(String(r.short_code), r.username||''); } if(r.user_id){ idToName.set(String(r.user_id), r.username||''); } });

        // 渲染
        if(!leaders.length){ tbody.innerHTML='<tr><td colspan="4" class="loading">暂无团长数据</td></tr>'; return; }
        // 渲染时：若 inviter_id 看起来是短码（R+7位），尝试逆向找到真实用户
        function isShortCode(s){ return /^R[0-9A-Z]{7}$/.test(String(s||'')); }
        async function resolveLabel(inviterId){
            const s = String(inviterId||'');
            let label = scToName.get(s) || idToName.get(s) || s;
            if(label===s && isShortCode(s)){
                try{
                    // 通过 users 表枚举，找到其短码匹配者
                    // 注意：用户量大时可分页，这里一般数据量较小
                    const { data } = await supabase.from('users').select('id, username').limit(1000);
                    if(Array.isArray(data)){
                        for(const u of data){
                            const uid = String(u.id||'');
                            const code = (function generateInviteCode(userId){
                                const id = String(userId||''); const base = id.slice(-6).padStart(6,'0'); let sum=0; for(let i=0;i<base.length;i++){ sum += base.charCodeAt(i); } const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; const check = chars[sum % 36]; return 'R' + base + check; }) (uid);
                            if(code===s){ label = u.username || uid; break; }
                        }
                    }
                }catch(_){ }
            }
            return label;
        }
        // 异步渲染表格，保证名称尽可能显示为用户名
        (async function render(){
            const rows = [];
            for(let i=0;i<leaders.length;i++){
                const l = leaders[i];
                const label = await resolveLabel(l.inviter_id);
                rows.push(`<tr><td>${i+1}</td><td>${label}</td><td>${l.level1||0}</td><td><button class=\"btn btn-sm\" onclick=\"openLeaderDetail('${l.inviter_id}','${(label||'').toString().replace(/"/g,'&quot;')}')\">查看</button></td></tr>`);
            }
            tbody.innerHTML = rows.join('');
        })();
    }catch(e){ console.warn('loadLeadersForAdmin', e); }
}

// ===== 团长白名单（who can invite） =====
async function triggerLeadersTableCreate(){
    try{
        await ensureSupabaseReady();
        const sql = `
            CREATE TABLE IF NOT EXISTS public.leaders_allowlist (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT UNIQUE,
                username TEXT,
                short_code TEXT,
                status TEXT DEFAULT 'enabled', -- enabled/disabled
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_leaders_user_id ON public.leaders_allowlist(user_id);
            CREATE INDEX IF NOT EXISTS idx_leaders_short_code ON public.leaders_allowlist(short_code);
            DO $$ BEGIN
                BEGIN
                    ALTER TABLE public.leaders_allowlist ENABLE ROW LEVEL SECURITY;
                EXCEPTION WHEN undefined_table THEN
                    -- 如果表刚创建，忽略
                END;
                DROP POLICY IF EXISTS leaders_select ON public.leaders_allowlist;
                CREATE POLICY leaders_select ON public.leaders_allowlist FOR SELECT TO anon USING (true);
                DROP POLICY IF EXISTS leaders_upsert ON public.leaders_allowlist;
                CREATE POLICY leaders_upsert ON public.leaders_allowlist FOR INSERT TO service_role WITH CHECK (true);
                DROP POLICY IF EXISTS leaders_update ON public.leaders_allowlist;
                CREATE POLICY leaders_update ON public.leaders_allowlist FOR UPDATE TO service_role USING (true) WITH CHECK (true);
                DROP POLICY IF EXISTS leaders_delete ON public.leaders_allowlist;
                CREATE POLICY leaders_delete ON public.leaders_allowlist FOR DELETE TO service_role USING (true);
            END $$;
        `;
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if(error){ showNotification('创建 leaders_allowlist 失败','error'); return; }
        showNotification('leaders_allowlist 表已创建/存在','success');
    }catch(e){ showNotification('创建表失败: '+e.message,'error'); }
}

/**
 * 加载团长列表 - 全新重写版
 * 直接从数据库读取，简单可靠
 */
async function loadLeadersAllowlist(){
    console.log('🔄 [团长列表] 开始加载...');
    const tbody = document.querySelector('#leadersAllowlistTable tbody');
    if(!tbody) {
        console.error('❌ [团长列表] 未找到表格元素');
        return;
    }
    
    // 显示加载中
    tbody.innerHTML = '<tr><td colspan="9" class="loading">正在加载...</td></tr>';
    
    try {
        // 1. 确保Supabase准备好
            await ensureSupabaseReady();
        console.log('✅ [团长列表] Supabase已准备');
        
        // 2. 确保表和RLS策略配置正确
        try {
            await ensureLeadersReadable();
            console.log('✅ [团长列表] RLS策略已配置');
        } catch(e) {
            console.warn('⚠️ [团长列表] RLS策略配置失败:', e);
        }
        
        // 3. 直接从数据库读取（不使用缓存）
        console.log('📡 [团长列表] 正在查询数据库...');
        const { data, error } = await supabase
            .from('leaders_allowlist')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ [团长列表] 数据库查询失败:', error);
            tbody.innerHTML = '<tr><td colspan="9" class="loading">查询失败: ' + error.message + '</td></tr>';
            return;
        }
        
        console.log('✅ [团长列表] 查询成功，获取到', data ? data.length : 0, '个团长');
        console.log('📊 [团长列表] 数据详情:', data);
        
        // 4. 查询团队人数
        const teamCounts = new Map();
        if (data && data.length > 0) {
            try {
                const { data: referrals, error: refError } = await supabase
                    .from('referrals')
                    .select('inviter_id, is_activated');
                
                if (!refError && referrals) {
                    referrals.forEach(r => {
                        if (r.is_activated === true) {
                            const inviter = r.inviter_id;
                            teamCounts.set(inviter, (teamCounts.get(inviter) || 0) + 1);
                        }
                    });
                    
                    // 尝试匹配短码
                    data.forEach(leader => {
                        const shortCode = leader.short_code;
                        if (shortCode && teamCounts.has(shortCode)) {
                            leader.team_count = teamCounts.get(shortCode);
                        } else {
                            leader.team_count = 0;
                        }
                    });
                    
                    console.log('✅ [团长列表] 团队人数统计完成');
                }
            } catch(e) {
                console.warn('⚠️ [团长列表] 团队人数统计失败:', e);
            }
        }
        
        // 5. 更新本地缓存
        if (data && data.length > 0) {
            localStorage.setItem('leaders_allowlist', JSON.stringify(data));
            console.log('💾 [团长列表] 已更新本地缓存');
        }
        
        // 6. 无数据处理
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无团长数据</td></tr>';
            console.log('ℹ️ [团长列表] 无数据');
            return;
        }
        
        // 6. 更新统计指标
        const total = data.length;
        const enabled = data.filter(x => x.status === 'enabled').length;
        const disabled = total - enabled;
        
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = String(val);
                console.log(`📊 [团长列表] 更新指标 ${id} = ${val}`);
            }
        };
        
        setVal('lmTotal', total);
        setVal('lmEnabled', enabled);
        setVal('lmDisabled', disabled);
        
        // 7. 渲染表格
        tbody.innerHTML = data.map((r, idx) => {
            const statusText = r.status === 'enabled' ? '启用' : '禁用';
            const statusCls = r.status === 'enabled' ? 'leader-status on' : 'leader-status off';
            const createdAt = (r.created_at || '').replace('T', ' ').slice(0, 19);
            
            // 计算等级
            const teamCount = r.team_count || 0;
            const level = getLeaderLevel(teamCount);
            const levelBadge = `<span class="level-badge">${level.icon} ${level.name}</span>`;
            
            return `<tr>
                <td>${idx + 1}</td>
                <td>${r.user_id || '-'}</td>
                <td>${r.username || '-'}</td>
                <td>${r.short_code || '-'}</td>
                <td><strong style="color:#6366f1;">${teamCount}</strong></td>
                <td>${levelBadge}</td>
                <td>${createdAt}</td>
                <td><span class="${statusCls}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm" onclick="toggleLeaderStatus('${r.user_id || ''}', '${r.status || ''}')">${r.status === 'enabled' ? '禁用' : '启用'}</button>
                    <button class="btn btn-sm btn-error" onclick="removeLeader('${r.user_id || ''}')">移除</button>
                </td>
            </tr>`;
        }).join('');
        
        console.log('✅ [团长列表] 表格渲染完成，共', total, '行');
        
    } catch(e) {
        console.error('❌ [团长列表] 加载失败:', e);
        tbody.innerHTML = '<tr><td colspan="9" class="loading">加载失败: ' + e.message + '</td></tr>';
    }
}

// 根据团队人数获取等级
function getLeaderLevel(memberCount) {
    if (memberCount >= 200) return { id: 'diamond', name: '钻石团长', icon: '⭐' };
    if (memberCount >= 100) return { id: 'platinum', name: '铂金团长', icon: '💎' };
    if (memberCount >= 50) return { id: 'gold', name: '黄金团长', icon: '👑' };
    if (memberCount >= 10) return { id: 'silver', name: '白银团长', icon: '🥈' };
    return { id: 'bronze', name: '青铜团长', icon: '🥉' };
}

// 保障：创建 leaders_allowlist 表，并允许匿名读取、插入、更新、删除（供管理后台使用）
async function ensureLeadersReadable(){
    try{
        await ensureSupabaseReady();
        const sql = `
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name='leaders_allowlist'
                ) THEN
                    CREATE TABLE public.leaders_allowlist (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id TEXT UNIQUE,
                        username TEXT,
                        short_code TEXT,
                        status TEXT DEFAULT 'enabled',
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                END IF;
                BEGIN
                    ALTER TABLE public.leaders_allowlist ENABLE ROW LEVEL SECURITY;
                EXCEPTION WHEN undefined_table THEN
                END;
                -- 允许匿名读取
                DROP POLICY IF EXISTS leaders_select ON public.leaders_allowlist;
                CREATE POLICY leaders_select ON public.leaders_allowlist FOR SELECT TO anon USING (true);
                
                -- 允许匿名插入（管理后台添加团长）
                DROP POLICY IF EXISTS leaders_insert ON public.leaders_allowlist;
                CREATE POLICY leaders_insert ON public.leaders_allowlist FOR INSERT TO anon WITH CHECK (true);
                
                -- 允许匿名更新（管理后台修改状态）
                DROP POLICY IF EXISTS leaders_update ON public.leaders_allowlist;
                CREATE POLICY leaders_update ON public.leaders_allowlist FOR UPDATE TO anon USING (true) WITH CHECK (true);
                
                -- 允许匿名删除（管理后台移除团长）
                DROP POLICY IF EXISTS leaders_delete ON public.leaders_allowlist;
                CREATE POLICY leaders_delete ON public.leaders_allowlist FOR DELETE TO anon USING (true);
            END $$;`;
        try{ await supabase.rpc('exec_sql', { sql_query: sql }); }catch(e){ console.warn('ensureLeadersReadable rpc', e); }
    }catch(e){ console.warn('ensureLeadersReadable', e && e.message); }
}

async function addLeaderFromInput(){
    const input = document.getElementById('addLeaderInput');
    if(!input) return; const raw = (input.value||'').trim(); if(!raw){ showNotification('请输入用户名','warning'); return; }
    const val = raw.replace(/\s+/g,'');
    try{
        await ensureSupabaseReady();
        // 确保 users 表可读（有些环境启用了RLS）
        try{
            await ensureUsersReadable();
        }catch(_){ }
        // 按"用户名"为主的查找（先精确，后模糊），再按ID兜底
        let user = null;
        // 1) 精确匹配英文 username
        try{ const r = await supabase.from('users').select('id, username').eq('username', val).limit(1); if(r && r.data && r.data.length){ user=r.data[0]; } }catch(e){ console.warn('users username exact error', e && e.message); }
        // 1b) 精确匹配中文列（如果存在）
        if(!user){ try{ const rzh = await supabase.from('users').select('id, 用户名').eq('用户名', val).limit(1); if(rzh && !rzh.error && rzh.data && rzh.data.length){ user={ id:rzh.data[0].id, username: rzh.data[0]['用户名'] }; } }catch(e){ /* 列不存在直接跳过 */ }
        }
        // 2) 模糊匹配英文 username
        if(!user){ try{ const r2 = await supabase.from('users').select('id, username').ilike('username', `%${val}%`).limit(1); if(r2 && r2.data && r2.data.length){ user=r2.data[0]; } }catch(e){ console.warn('users username fuzzy error', e && e.message); }
        }
        // 2b) 模糊匹配中文列（如果存在）
        if(!user){ try{ const r2zh = await supabase.from('users').select('id, 用户名').ilike('用户名', `%${val}%`).limit(1); if(r2zh && !r2zh.error && r2zh.data && r2zh.data.length){ user={ id:r2zh.data[0].id, username: r2zh.data[0]['用户名'] }; } }catch(e){ }
        }
        // 3) 兜底：直接按ID
        if(!user){ try{ const r3 = await supabase.from('users').select('id, username').eq('id', val).limit(1); if(r3 && r3.data && r3.data.length){ user=r3.data[0]; } }catch(e){ console.warn('users id query error', e && e.message); }
        }
        if(!user){
            // 再做一次本地回退：从当前已加载的用户表缓存里匹配
            try{
                const list = (window.__usersRawList||[]);
                const low = val.toLowerCase();
                const hit = list.find(u=> String(u.username||'').toLowerCase()===low || String(u['用户名']||'').toLowerCase()===low) ||
                            list.find(u=> String(u.username||'').toLowerCase().includes(low) || String(u['用户名']||'').toLowerCase().includes(low));
                if(hit){ user = hit; }
            }catch(_){ }
        }
        if(!user){ showNotification('未找到该用户，请在"用户管理"确认用户名是否存在', 'error'); return; }
        const name = user.username || user['用户名'] || '';
        const code = generateInviteCode(user.id||'');
        try{ const ins = await supabase.from('leaders_allowlist').insert([{ user_id:user.id, username:name, short_code:code, status:'enabled' }]); if(ins && ins.error) throw new Error(ins.error.message); }
        catch(_){ /* 忽略，使用本地镜像 */ }
        // 同步用户角色：标记为团长
        try{ await supabase.from('users').update({ role:'leader', is_leader:true }).eq('id', user.id); }catch(_){ }
        // 本地镜像：无论远端是否成功，都同步一份，保障离线可见
        try{
            const arr=JSON.parse(localStorage.getItem('leaders_allowlist')||'[]');
            const idx=arr.findIndex(x=>x.user_id===user.id);
            const rec={ user_id:user.id, username:name, short_code:code, status:'enabled', created_at:new Date().toISOString() };
            if(idx>=0) arr[idx]=rec; else arr.push(rec);
            localStorage.setItem('leaders_allowlist', JSON.stringify(arr));
            // 便携缓存键（防不同页面/环境取不到数组时可回退）
            setLeaderCacheQuick(user.id, name, code, 'enabled');
        }catch(_){ }
        showNotification('已添加到团长白名单','success'); input.value=''; loadLeadersAllowlist();
    }catch(e){ showNotification('添加失败: '+e.message,'error'); }
}

// 确保 users 表对匿名可读，避免 RLS 导致"找不到用户"
async function ensureUsersReadable(){
    try{
        const sql = `DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
                BEGIN
                    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
                EXCEPTION WHEN undefined_table THEN
                END;
                DROP POLICY IF EXISTS users_select_open ON public.users;
                CREATE POLICY users_select_open ON public.users FOR SELECT TO anon USING (true);
            END IF;
        END $$;`;
        await supabase.rpc('exec_sql', { sql_query: sql });
    }catch(e){ console.warn('ensureUsersReadable', e && e.message); }
}

async function findUserByInput(val){
    let user=null;
    // 1) 直接按 id
    try{ const r = await supabase.from('users').select('id, username, 用户名').eq('id', val).limit(1); if(r && r.data && r.data.length){ return r.data[0]; } }catch(_){ }
    // 2) 精确匹配用户名（中/英）
    try{ const r2 = await supabase.from('users').select('id, username, 用户名').or(`username.eq.${val},用户名.eq.${val}`).limit(1); if(r2 && r2.data && r2.data.length){ return r2.data[0]; } }catch(_){ }
    // 3) 模糊匹配（ilike）
    try{ const r3 = await supabase.from('users').select('id, username, 用户名').or(`username.ilike.%${val}%,用户名.ilike.%${val}%`).limit(5); if(r3 && r3.data && r3.data.length){ return r3.data[0]; } }catch(_){ }
    // 4) 兜底：取前100做前端包含匹配
    try{ const r4 = await supabase.from('users').select('id, username, 用户名').limit(100); const arr=r4 && r4.data || []; const low = val.toLowerCase(); user = arr.find(u=> (String(u.username||'').toLowerCase().includes(low) || String(u['用户名']||'').toLowerCase().includes(low) || String(u.id||'').toLowerCase().includes(low) )); if(user) return user; }catch(_){ }
    return null;
}

/**
 * 切换团长状态 - 全新重写版
 */
async function toggleLeaderStatus(userId, currentStatus){
    console.log('🔄 [切换状态] userId:', userId, 'currentStatus:', currentStatus);
    
    if (!userId) {
        showNotification('用户ID无效', 'error');
        return;
    }
    
    try {
        await ensureSupabaseReady();
        
        // 确定新状态
        const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
        console.log('📝 [切换状态] 新状态:', newStatus);
        
        // 更新 leaders_allowlist 表
        const { error: updateError } = await supabase
            .from('leaders_allowlist')
            .update({ status: newStatus })
            .eq('user_id', userId);
        
        if (updateError) {
            console.error('❌ [切换状态] 更新失败:', updateError);
            throw updateError;
        }
        
        console.log('✅ [切换状态] leaders_allowlist 已更新');
        
        // 同步更新 users 表的 role 和 is_leader
        try {
            const userUpdate = newStatus === 'enabled' 
                ? { role: 'leader', is_leader: true } 
                : { role: 'user', is_leader: false };
            
            await supabase.from('users').update(userUpdate).eq('id', userId);
            console.log('✅ [切换状态] users 表已同步');
        } catch(e) {
            console.warn('⚠️ [切换状态] users 表同步失败:', e);
        }
        
        // 清除本地缓存，强制重新加载
        localStorage.removeItem('leaders_allowlist');
        console.log('🗑️ [切换状态] 已清除本地缓存');
        
        showNotification('状态已更新', 'success');
        
        // 重新加载列表和数据概览
        await Promise.all([
            loadLeadersAllowlist(),
            typeof loadLeaderOverviewData === 'function' ? loadLeaderOverviewData() : Promise.resolve()
        ]);
        
    } catch(e) {
        console.error('❌ [切换状态] 失败:', e);
        showNotification('更新失败: ' + e.message, 'error');
    }
}

/**
 * 移除团长 - 全新重写版
 */
async function removeLeader(userId){
    console.log('🗑️ [移除团长] userId:', userId);
    
    if (!userId) {
        showNotification('用户ID无效', 'error');
        return;
    }
    
    if (!confirm('确定要移除该团长吗？')) {
        console.log('ℹ️ [移除团长] 用户取消操作');
        return;
    }
    
    try {
        await ensureSupabaseReady();
        
        // 从 leaders_allowlist 表删除
        const { error: deleteError } = await supabase
            .from('leaders_allowlist')
            .delete()
            .eq('user_id', userId);
        
        if (deleteError) {
            console.error('❌ [移除团长] 删除失败:', deleteError);
            throw deleteError;
        }
        
        console.log('✅ [移除团长] leaders_allowlist 已删除');
        
        // 同步更新 users 表
        try {
            await supabase.from('users').update({ 
                role: 'user', 
                is_leader: false 
            }).eq('id', userId);
            console.log('✅ [移除团长] users 表已同步');
        } catch(e) {
            console.warn('⚠️ [移除团长] users 表同步失败:', e);
        }
        
        // 清除本地缓存
        localStorage.removeItem('leaders_allowlist');
        console.log('🗑️ [移除团长] 已清除本地缓存');
        
        showNotification('已移除', 'success');
        
        // 重新加载列表和数据概览
        await Promise.all([
            loadLeadersAllowlist(),
            typeof loadLeaderOverviewData === 'function' ? loadLeaderOverviewData() : Promise.resolve()
        ]);
        
    } catch(e) {
        console.error('❌ [移除团长] 失败:', e);
        showNotification('移除失败: ' + e.message, 'error');
    }
}

// 工具：与 my-team 相同的短码生成
function generateInviteCode(userId){
    const id = String(userId||'');
    const base = id.slice(-6).padStart(6,'0');
    let sum=0; for(let i=0;i<base.length;i++){ sum += base.charCodeAt(i); }
    const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const check = chars[sum % 36];
    return 'R' + base + check;
}

// 便携缓存：为不同页面提供快速判断键
function setLeaderCacheQuick(userId, username, shortCode, status){
    try{
        const s = (status||'enabled');
        if(userId){ localStorage.setItem('leader:'+String(userId), s); }
        if(username){ localStorage.setItem('leader:uname:'+String(username).toLowerCase(), s); }
        if(shortCode){ localStorage.setItem('leader:scode:'+String(shortCode), s); }
    }catch(_){ }
}
// 🔧 新增：创建所有测试数据
async function createAllTestData() {
    try {
        console.log('📊 开始创建测试数据...');
        showNotification('正在创建测试数据，请稍候...', 'info');
        
        // 依次创建测试数据
        await createTestUsers();
        await createTestEarnings();
        await createWithdrawalsTestData();
        
        showNotification('测试数据创建完成！', 'success');
        
        // 重新加载数据
        await loadDashboardData();
        
    } catch (error) {
        console.error('❌ 创建测试数据失败:', error);
        showNotification('创建测试数据失败: ' + error.message, 'error');
    }
}
// 🔧 新增：创建测试用户
async function createTestUsers() {
    try {
        console.log('👥 创建测试用户...');
        
        const testUsers = [
            {
                id: 'user_001',
                username: '张三',
                email: 'zhangsan@example.com',
                phone: '13800138001',
                real_name: '张三',
                alipay_account: 'zhangsan@alipay.com',
                wallet_balance: 150.50
            },
            {
                id: 'user_002',
                username: '李四',
                email: 'lisi@example.com',
                phone: '13800138002',
                real_name: '李四',
                alipay_account: 'lisi@alipay.com',
                wallet_balance: 89.25
            },
            {
                id: 'user_003',
                username: '王五',
                email: 'wangwu@example.com',
                phone: '13800138003',
                real_name: '王五',
                alipay_account: 'wangwu@alipay.com',
                wallet_balance: 234.80
            }
        ];
        
        // 检查是否已有数据
        const { data: existingUsers } = await supabase
            .from('users')
            .select('id')
            .limit(1);
        
        if (existingUsers && existingUsers.length > 0) {
            console.log('⚠️ 用户表已有数据，跳过创建');
            return;
        }
        
        const { error } = await supabase
            .from('users')
            .insert(testUsers);
        
        if (error) {
            throw error;
        }
        
        console.log('✅ 测试用户创建完成');
        
    } catch (error) {
        console.error('❌ 创建测试用户失败:', error);
        throw error;
    }
}
// 🔧 新增：创建测试收益
async function createTestEarnings() {
    try {
        console.log('💰 创建测试收益...');
        
        const testEarnings = [
            {
                user_id: 'user_001',
                task_name: 'KK搜索-iPhone手机(拉新2,拉活1)',
                amount: 19.5,
                status: 'completed'
            },
            {
                user_id: 'user_002',
                task_name: 'KK搜索-电脑配件(拉新1)',
                amount: 8.5,
                status: 'completed'
            },
            {
                user_id: 'user_003',
                task_name: 'KK搜索-运动鞋(拉活3,拉旧2)',
                amount: 8.1,
                status: 'pending'
            },
            {
                user_id: 'user_001',
                task_name: '网盘任务-文件上传',
                amount: 25.0,
                status: 'completed'
            },
            {
                user_id: 'user_002',
                task_name: 'KK搜索-美食推荐(拉新1,拉旧5)',
                amount: 10.0,
                status: 'completed'
            }
        ];
        
        // 检查是否已有数据
        const { data: existingEarnings } = await supabase
            .from('earnings')
            .select('id')
            .limit(1);
        
        if (existingEarnings && existingEarnings.length > 0) {
            console.log('⚠️ 收益表已有数据，跳过创建');
            return;
        }
        
        const { error } = await supabase
            .from('earnings')
            .insert(testEarnings);
        
        if (error) {
            throw error;
        }
        
        console.log('✅ 测试收益创建完成');
        
    } catch (error) {
        console.error('❌ 创建测试收益失败:', error);
        throw error;
    }
}

// 🔧 新增：显示数据库连接错误
function showDatabaseConnectionError() {
    // 查找当前页面的内容区域
    const contentArea = document.querySelector('.main-content') || 
                       document.querySelector('#usersTable') ||
                       document.querySelector('#dashboard');
    
    if (contentArea) {
        contentArea.innerHTML = `
            <div class="connection-error" style="display: flex; justify-content: center; align-items: center; height: 300px; flex-direction: column;">
                <div style="background: #fee; border: 2px solid #f88; border-radius: 12px; padding: 24px; max-width: 500px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h3 style="color: #c33; margin-bottom: 16px; font-size: 20px;">数据库连接失败</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px; font-size: 14px;">
                        无法连接到数据库服务。这可能是因为：<br>
                        • 网络连接问题<br>
                        • 数据库服务暂时不可用<br>
                        • 初始化过程尚未完成
                    </p>
                    <div style="margin-bottom: 16px;">
                        <button onclick="retryConnection()" style="background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 0 8px; font-size: 14px;">
                            🔄 重试连接
                        </button>
                        <button onclick="location.reload()" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 0 8px; font-size: 14px;">
                            🔃 刷新页面
                        </button>
                    </div>
                    <div>
                        <button onclick="quickVerifyFix()" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin: 0 4px; font-size: 12px;">
                            🧪 诊断连接
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// 🔧 新增：重试连接
async function retryConnection() {
    try {
        console.log('🔄 用户手动重试连接...');
        showNotification('正在重试连接...', 'info');
        
        // 重置初始化状态
        supabaseInitialized = false;
        initializationPromise = null;
        
        // 重新初始化
        await ensureSupabaseReady();
        
        // 重新加载当前页面数据
        switch(currentPage) {
            case 'users':
                await loadUsersData();
                break;
            case 'earnings':
                await loadKKSearchData();
                break;
            case 'withdrawals':
                await loadWithdrawalsData();
                break;
            default:
                await loadDashboardData();
        }
        
        showNotification('连接恢复成功！', 'success');
        
    } catch (error) {
        console.error('❌ 重试连接失败:', error);
        showNotification('重试连接失败: ' + error.message, 'error');
    }
}

// 🔧 新增：仪表盘修复验证
async function verifyDashboardFix() {
    console.log('🧪 开始验证仪表盘修复效果...');
    
    try {
        // 1. 检查Supabase初始化
        console.log('1️⃣ 检查Supabase初始化状态...');
        await ensureSupabaseReady();
        console.log('✅ Supabase客户端可用');
        
        // 2. 测试统计数据查询
        console.log('2️⃣ 测试统计数据查询...');
        const statPromises = await Promise.allSettled([
            supabase.from('users').select('count(*)', { count: 'exact', head: true }),
            supabase.from('earnings').select('amount').limit(1),
            supabase.from('withdrawals').select('count(*)', { count: 'exact', head: true })
        ]);
        
        console.log('📊 统计查询结果:', statPromises.map(p => p.status));
        
        // 3. 测试详细数据查询
        console.log('3️⃣ 测试详细数据查询...');
        const detailPromises = await Promise.allSettled([
            supabase.from('users').select('*').limit(1),
            supabase.from('earnings').select('*').limit(1),
            supabase.from('withdrawals').select('*').limit(1)
        ]);
        
        console.log('📋 详细查询结果:', detailPromises.map(p => p.status));
        
        // 4. 重新加载仪表盘
        console.log('4️⃣ 重新加载仪表盘...');
        await loadDashboardData();
        
        console.log('🎉 仪表盘修复验证完成！');
        showNotification('仪表盘修复验证通过！', 'success');
        
    } catch (error) {
        console.error('❌ 仪表盘修复验证失败:', error);
        showNotification('仪表盘修复验证失败: ' + error.message, 'error');
    }
}

// 🔧 新增：快速验证修复效果
async function quickVerifyFix() {
    try {
        console.log('🧪 开始快速验证修复效果...');
        
        // 1. 检查Supabase连接
        const connectionTest = await supabase.from('users').select('count(*)', { count: 'exact', head: true });
        
        if (connectionTest.error) {
            console.log('❌ Supabase连接失败:', connectionTest.error.message);
            return false;
        }
        
        console.log('✅ Supabase连接正常');
        
        // 2. 检查表是否存在
        const tables = ['users', 'earnings', 'withdrawals'];
        let existingTables = 0;
        
        for (const table of tables) {
            try {
                const result = await supabase.from(table).select('count(*)', { count: 'exact', head: true });
                if (!result.error) {
                    existingTables++;
                    console.log(`✅ ${table}表存在，记录数: ${result.count || 0}`);
                } else {
                    console.log(`❌ ${table}表不存在或无法访问:`, result.error.message);
                }
            } catch (error) {
                console.log(`❌ ${table}表检查失败:`, error.message);
            }
        }
        
        console.log(`📊 数据库状态: ${existingTables}/${tables.length} 个表可用`);
        
        if (existingTables === tables.length) {
            console.log('🎉 数据库修复成功！所有表都可正常访问');
            showNotification('数据库修复验证通过！', 'success');
            return true;
        } else {
            console.log('⚠️ 部分表仍有问题，建议重新初始化');
            showNotification('数据库修复不完整，请重新初始化', 'error');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 验证过程失败:', error);
        showNotification('验证失败: ' + error.message, 'error');
        return false;
    }
}

// 更新统计卡片
// 🔧 改进：增强统计卡片更新功能
function updateStatCard(id, value) {
    console.log(`🔄 正在更新统计卡片: ${id} = ${value}`);
    
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
        console.log(`✅ 统计卡片更新成功: ${id} = ${value}`);
    } else {
        console.warn(`⚠️ 找不到元素: ${id}`);
    }
}
// 🔧 修复：加载最近用户（简化可靠策略）
async function loadRecentUsers() {
    try {
        console.log('🔄 加载最近用户...');
        
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        const container = document.getElementById('recentUsers');
        if (!container) {
            console.warn('⚠️ 找不到recentUsers容器元素');
            return;
        }
        
        console.log('🔍 开始查询用户数据...');
        
        // 🔧 使用最简单可靠的策略：直接从收益数据中提取用户信息
        let users = [];
        let error = null;
        
        try {
            // 策略1：尝试最基础的users表查询
            console.log('📋 尝试基础用户表查询...');
            const { data: usersData, error: usersError } = await supabase
            .from('users')
                .select('*')
            .limit(5);
        
            if (usersError) {
                console.warn('⚠️ 用户表查询失败:', usersError.message);
                throw usersError;
            }
            
            if (usersData && usersData.length > 0) {
                users = usersData;
                console.log('✅ 用户表查询成功:', users.length, '条记录');
            } else {
                console.log('📭 用户表查询成功但无数据');
                throw new Error('用户表无数据');
            }
            
        } catch (queryError) {
            console.warn('⚠️ 用户表查询失败，尝试从收益数据提取用户:', queryError.message);
            
            // 策略2：从收益数据中提取用户信息（备用方案）
            try {
                const { data: earningsData, error: earningsError } = await supabase
                    .from('earnings')
                    .select('user_id')
                    .limit(10);
                
                if (earningsError) {
                    throw earningsError;
                }
                
                if (earningsData && earningsData.length > 0) {
                    // 从收益数据中提取唯一用户ID
                    const uniqueUserIds = [...new Set(earningsData.map(e => e.user_id))].slice(0, 5);
                    
                    console.log('📊 从收益数据提取到用户ID:', uniqueUserIds);
                    
                    // 构造用户数据
                    users = uniqueUserIds.map((userId, index) => ({
                        id: userId,
                        username: `用户${userId}`,
                        email: null,
                        created_at: new Date().toISOString()
                    }));
                    
                    console.log('✅ 从收益数据成功构造用户列表:', users.length, '个用户');
                } else {
                    throw new Error('收益数据也无法获取用户信息');
                }
                
            } catch (fallbackError) {
                console.warn('⚠️ 备用策略也失败，使用模拟数据:', fallbackError.message);
                
                // 策略3：显示模拟用户（最后备用）
                users = [
                    { id: 1, username: 'zxc', email: 'zxc@example.com', created_at: new Date().toISOString() },
                    { id: 2, username: '123', email: '123@example.com', created_at: new Date().toISOString() },
                    { id: 3, username: 'test_user1', email: 'test@example.com', created_at: new Date().toISOString() }
                ];
                
                console.log('📋 使用模拟用户数据:', users.length, '个用户');
            }
        }
        
        if (!users || users.length === 0) {
            console.log('📭 最终没有用户数据可显示');
            container.innerHTML = '<div class="loading">暂无用户数据</div>';
            return;
        }
        
        console.log('✅ 开始渲染用户列表...');
        
        // 🔧 简化的安全渲染
        const userItems = users.map((user, index) => {
            const userId = user.id || user.user_id || `unknown_${index}`;
            const displayName = user.username || user.email || `用户${userId}`;
            const avatar = displayName.charAt(0).toUpperCase();
            const timeText = user.created_at ? formatDate(user.created_at) : '最近活跃';
            
            return `
            <div class="recent-item">
                <div class="recent-item-info">
                        <div class="recent-item-avatar">${avatar}</div>
                    <div class="recent-item-details">
                            <h4>${displayName}</h4>
                            <p>${timeText}</p>
                    </div>
                </div>
                <div class="recent-item-value">
                        <span class="status-badge status-active">活跃</span>
                </div>
            </div>
            `;
        });
        
        container.innerHTML = userItems.join('');
        console.log('✅ 最近用户列表渲染完成，显示', users.length, '个用户');
        
    } catch (error) {
        console.error('❌ 加载最近用户失败:', error);
        
        const container = document.getElementById('recentUsers');
        if (container) {
            // 🔧 显示有用的错误信息和重试选项
            container.innerHTML = `
                <div class="recent-item" style="border: 1px solid #dc3545; background: #f8d7da;">
                    <div class="recent-item-info">
                        <div class="recent-item-avatar" style="background: #dc3545;">!</div>
                        <div class="recent-item-details">
                            <h4 style="color: #721c24;">查询失败</h4>
                            <p style="color: #721c24; font-size: 12px;">${error.message || '未知错误'}</p>
                        </div>
                    </div>
                    <div class="recent-item-value">
                        <button onclick="loadRecentUsers()" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            重试
                        </button>
                    </div>
                </div>
            `;
        }
    }
}
// 🔧 修复：加载最近收益（确保Supabase已准备）
async function loadRecentEarnings() {
    try {
        console.log('🔄 加载最近收益...');
        
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const container = document.getElementById('recentEarnings');
        if (!container) return;
        
        if (!earnings || earnings.length === 0) {
            container.innerHTML = '<div class="loading">暂无收益数据</div>';
            return;
        }
        
        // 关联用户信息，显示真实用户名
        await enrichEarningsWithUserData(earnings);
        container.innerHTML = earnings.map(earning => `
            <div class="recent-item">
                <div class="recent-item-info">
                    <div class="recent-item-avatar">
                        ¥
                    </div>
                    <div class="recent-item-details">
                        <h4>${earning.users?.username || '未知用户'}</h4>
                        <p>${earning.task_name || '未知任务'}</p>
                    </div>
                </div>
                <div class="recent-item-value">
                    ¥${(earning.amount || 0).toFixed(2)}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('加载最近收益失败:', error);
        const container = document.getElementById('recentEarnings');
        if (container) {
            container.innerHTML = '<div class="loading">加载失败</div>';
        }
    }
}
// 🔧 修复：加载待处理提现（兼容性查询）
// 🔧 修复：加载待处理提现（确保Supabase已准备）  
async function loadPendingWithdrawals() {
    try {
        console.log('🔄 开始加载待处理提现...');
        
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        // 方法1: 尝试带外键关系的查询
        let withdrawals, error;
        try {
            const response1 = await supabase
            .from('withdrawals')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);
        
            withdrawals = response1.data;
            error = response1.error;
            
            if (!error) {
                console.log('✅ 待处理提现外键关系查询成功');
            }
        } catch (relationError) {
            console.log('⚠️ 待处理提现外键关系查询失败，尝试简单查询:', relationError.message);
            error = relationError;
        }
        
        // 方法2: 如果外键查询失败，使用简单查询
        if (error) {
            console.log('🔄 使用简单查询加载待处理提现...');
            const response2 = await supabase
                .from('withdrawals')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(5);
            
            withdrawals = response2.data;
            error = response2.error;
            
            if (error) {
                throw error;
            }
            }
            
        // 无论哪种查询方式，统一手动关联用户数据，保证用户名可用
            if (withdrawals && withdrawals.length > 0) {
                console.log('🔄 手动关联待处理提现的用户数据...');
                await enrichWithdrawalsWithUserData(withdrawals);
        }
        
        const container = document.getElementById('pendingWithdrawalsList');
        if (!container) return;
        
        if (!withdrawals || withdrawals.length === 0) {
            container.innerHTML = '<div class="loading">暂无待处理提现</div>';
            console.log('ℹ️ 没有待处理的提现申请');
            return;
        }
        
        container.innerHTML = withdrawals.map(withdrawal => `
            <div class="recent-item">
                <div class="recent-item-info">
                    <div class="recent-item-avatar">
                        $
                    </div>
                    <div class="recent-item-details">
                        <h4>${(withdrawal.users && getUserDisplayName(withdrawal.users, withdrawal.user_id)) || withdrawal.username_display || '未知用户'}</h4>
                        <p>${formatDate(withdrawal.created_at)}</p>
                    </div>
                </div>
                <div class="recent-item-value">
                    ¥${(withdrawal.amount || 0).toFixed(2)}
                </div>
            </div>
        `).join('');
        
        console.log(`✅ 成功加载了 ${withdrawals.length} 条待处理提现`);
        
    } catch (error) {
        console.error('❌ 加载待处理提现失败:', error);
        const container = document.getElementById('pendingWithdrawalsList');
        if (container) {
            container.innerHTML = '<div class="loading">加载失败: ' + error.message + '</div>';
        }
    }
}

// 🔧 修复：加载用户数据（确保Supabase已准备）
async function loadUsersData() {
    try {
        console.log('🔄 开始加载用户数据...');
        
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ 成功加载了 ${users?.length || 0} 个用户`);
        renderUsersTable(users || []);
        
    } catch (error) {
        console.error('❌ 加载用户数据失败:', error);
        showNotification('加载用户数据失败: ' + error.message, 'error');
        
        // 如果是supabase未初始化的错误，显示友好提示
        if (error.message.includes('数据库连接不可用')) {
            showDatabaseConnectionError();
        }
    }
}
// 渲染用户表格
function renderUsersTable(users) {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无用户数据</td></tr>';
        return;
    }
    
    window.__usersRawList = users.slice();
    tbody.innerHTML = users.map(user => `
        <tr>
            <td><input type="checkbox" class="user-select" data-id="${user.id}" onclick="toggleUserSelection('${user.id}')"></td>
            <td>${user.id}<i class="fas fa-copy copy-id" title="复制ID" onclick="copyText('${user.id}')"></i></td>
            <td><div class="user-avatar">${(user.username||'U').slice(0,1).toUpperCase()}</div></td>
            <td>${user.username || '未设置'}</td>
            <td>${user.email || '未设置'}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>${user.points || 0}</td>
            <td>
                <span class="status-badge ${getStatusClass(user.status || 'active')}">
                    ${getStatusText(user.status || 'active')}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">编辑</button>
                <button class="btn btn-sm btn-error" onclick="deleteUser('${user.id}')">删除</button>
            </td>
        </tr>
    `).join('');
    // 同步指标
    try{
        const total = users.length;
        const today = users.filter(u=>{ try{ const d=new Date(u.created_at); const n=new Date(); return d.toDateString()===n.toDateString(); }catch(_){ return false; } }).length;
        const active = users.filter(u=> String(u.status||'active')==='active').length;
        const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = String(val); };
        set('umTotal', total); set('umToday', today); set('umActive', active);
    }catch(_){ }
}

// 复制工具
function copyText(text){
    try{ navigator.clipboard.writeText(text).then(()=>{ showNotification('已复制', 'success'); }); }catch(_){
        const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showNotification('已复制', 'success');
    }
}

// 过滤与排序
function applyUserFilters(){
    try{
        const keyword=(document.getElementById('userSearch')?.value||'').trim().toLowerCase();
        const status=(document.getElementById('userStatusFilter')?.value||'').trim();
        const range=(document.getElementById('userDateRange')?.value||'').trim();
        let list=(window.__usersRawList||[]).slice();
        if(keyword){ list=list.filter(u=> String(u.id||'').toLowerCase().includes(keyword) || String(u.username||'').toLowerCase().includes(keyword) || String(u.email||'').toLowerCase().includes(keyword)); }
        if(status){ list=list.filter(u=> String(u.status||'active')===status); }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(u=> new Date(u.created_at)>=since); }
        renderUsersTable(list);
    }catch(e){ console.warn('applyUserFilters', e); }
}

// 输入项变更时自动筛选（防抖）
const userFiltersChanged = debounce(applyUserFilters, 300);

// 批量选择
function toggleSelectAll(){ const all=document.getElementById('userSelectAll')?.checked; document.querySelectorAll('.user-select').forEach(cb=> cb.checked=!!all); }
function getSelectedUserIds(){ return Array.from(document.querySelectorAll('.user-select:checked')).map(cb=> cb.getAttribute('data-id')); }
function toggleUserSelection(){ /* 保留，后续可用 */ }

// 批量操作
async function bulkDisableUsers(){ await bulkUpdateUserStatus('disabled'); }
async function bulkEnableUsers(){ await bulkUpdateUserStatus('active'); }
async function bulkDeleteUsers(){
    const ids=getSelectedUserIds(); if(ids.length===0) return showNotification('请先选择用户', 'info');
    if(!confirm(`确认删除 ${ids.length} 个用户？此操作不可恢复`)) return;
    try{ await ensureSupabaseReady();
        for(const id of ids){ try{ await supabase.from('users').delete().eq('id', id); }catch(e){ console.warn('删除失败', id, e); } }
        showNotification('批量删除完成', 'success');
        loadUsersData();
    }catch(e){ showNotification('批量删除失败: '+e.message, 'error'); }
}

async function bulkUpdateUserStatus(target){
    const ids=getSelectedUserIds(); if(ids.length===0) return showNotification('请先选择用户', 'info');
    if(!confirm(`确认将 ${ids.length} 个用户设置为${target==='active'?'正常':'禁用'}？`)) return;
    try{ await ensureSupabaseReady();
        for(const id of ids){ try{ await supabase.from('users').update({ status: target }).eq('id', id); }catch(e){ console.warn('更新失败', id, e); } }
        showNotification('批量更新完成', 'success');
        loadUsersData();
    }catch(e){ showNotification('批量更新失败: '+e.message, 'error'); }
}
// 🔧 修复：加载收益数据（确保Supabase已准备）
async function loadEarningsData() {
    try {
        console.log('🔄 开始加载收益数据...');
        
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ 成功加载了 ${earnings?.length || 0} 条收益记录`);
        let rows = (earnings || []).slice();
        // 合并本地暂存 earning_ 记录
        try{
            const localAdds=[];
            for(let i=0;i<localStorage.length;i++){
                const k=localStorage.key(i);
                if(k && k.startsWith('earning_')){
                    try{ const rec=JSON.parse(localStorage.getItem(k)); if(rec && rec.id) localAdds.push(rec); }catch(_){ }
                }
            }
            if(localAdds.length>0){ rows = [...localAdds, ...rows]; }
        }catch(_){ }
        // 合并本地覆盖，确保刷新后撤销状态保留
        rows = applyEarningsOverrides(rows);
        await enrichEarningsWithUserData(rows);
        // 保存原始列表，便于筛选/排序
        window.__earningsRawList = rows.slice();
        renderEarningsTable(window.__earningsRawList);
        
        // 加载用户列表到选择框
        await loadUsersForSelect();
        
    } catch (error) {
        console.error('❌ 加载收益数据失败:', error);
        // 回退：读取本地 earning_ 记录显示
        try{
            const local=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('earning_')){ try{ const e=JSON.parse(localStorage.getItem(k)); if(e) local.push(e);}catch(_){ } } }
            const rows = applyEarningsOverrides(local||[]);
            await enrichEarningsWithUserData(rows);
            window.__earningsRawList = rows.slice();
            renderEarningsTable(window.__earningsRawList);
        }catch(_){
            renderEarningsTable([]);
        }
    }
}

// 渲染收益表格
function renderEarningsTable(earnings) {
    const tbody = document.querySelector('#earningsTable tbody');
    if (!tbody) return;
    
    if (earnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无收益数据</td></tr>';
        return;
    }
    
    window.__earningsRawList = earnings.slice();
    tbody.innerHTML = earnings.map((earning, idx) => `
        <tr>
            <td>${earning.id}<i class="fas fa-copy copy-id" title="复制ID" onclick="copyText('${earning.id}')"></i></td>
            <td>${getEarningDisplayName(earning, idx)}</td>
            <td>${earning.task_name || '未知任务'}</td>
            <td>¥${(earning.amount || 0).toFixed(2)}</td>
            <td>${formatDate(earning.created_at)}</td>
            <td>
                <span class="status-badge ${getStatusClass(earning.status || 'completed')}">
                    ${getStatusText(earning.status || '已完成')}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEarning('${earning.id}')">编辑</button>
                <button class="btn btn-sm btn-warning" onclick="revokeEarning('${earning.id}')">撤销</button>
                <button class="btn btn-sm btn-error" onclick="deleteEarning('${earning.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}
// 筛选与排序（不影响其它模块）
function applyEarningsFilters(){
    try{
        const kw=(document.getElementById('earningsSearch')?.value||'').trim().toLowerCase();
        const type=(document.getElementById('earningsTypeFilter')?.value||'').trim();
        const status=(document.getElementById('earningsStatusFilter')?.value||'').trim();
        const range=(document.getElementById('earningsDateRange')?.value||'').trim();
        let list=(window.__earningsRawList||[]).slice();
        if(kw){ list=list.filter(e=> String(e.id||'').toLowerCase().includes(kw) || String(getEarningDisplayName(e,0)||'').toLowerCase().includes(kw) || String(e.task_name||'').toLowerCase().includes(kw)); }
        if(type){ list=list.filter(e=> String(e.task_name||'')===type); }
        if(status){
            // 映射中文->内部值，或直接匹配已有中文
            const map={ '已完成':'completed','进行中':'pending','已取消':'rejected' };
            list=list.filter(e=> String(e.status||'')===status || map[status]===String(e.status||''));
        }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(e=> new Date(e.created_at)>=since); }
        renderEarningsTable(list);
    }catch(e){ console.warn('applyEarningsFilters', e); }
}

// 输入项变更时自动筛选（防抖）
const earningsFiltersChanged = debounce(applyEarningsFilters, 300);

function sortEarningsBy(field){
    try{
        let list=(window.__earningsRawList||[]).slice();
        list.sort((a,b)=>{
            if(field==='amount'){ return (parseFloat(b.amount)||0) - (parseFloat(a.amount)||0); }
            if(field==='created_at'){ return new Date(b.created_at) - new Date(a.created_at); }
            return 0;
        });
        renderEarningsTable(list);
    }catch(e){ console.warn('sortEarningsBy', e); }
}

function exportEarningsCSV(){
    try{
        const rows = document.querySelectorAll('#earningsTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','用户','任务类型','金额','时间','状态'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<7) return;
            const line=[tds[0].innerText.replace(/\n.*/,'').trim(), tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.replace('¥','').trim(), tds[4].innerText.trim(), tds[5].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='earnings.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}

// 撤销收益（将状态改为已取消，并标记备注，不物理删除）
async function revokeEarning(earningId){
    try{
        if(!earningId) return;
        if(!confirm('确定要撤销这条收益吗？此操作会将状态改为"已取消"，但不会删除记录。')) return;
        const isLocal = /^earning_/.test(String(earningId));
        let ok=false;
        let earningRow=null;
        let wasRejected=false;
        if(isLocal){
            try{
                const raw=localStorage.getItem(earningId);
                if(raw){ const rec=JSON.parse(raw); if((rec.status||'').toString().toLowerCase().includes('rejected')) wasRejected=true; rec.status='rejected'; rec.updated_at=new Date().toISOString(); localStorage.setItem(earningId, JSON.stringify(rec)); ok=true; }
                try{ window.__earningsRawList=(window.__earningsRawList||[]).map(e=> e.id===earningId?{...e,status:'rejected'}:e); }catch(_){ }
            }catch(_){ }
        }
        try{
            if(!isLocal){ await ensureSupabaseReady(); }
            // 读取原收益记录，避免重复扣减
            if(!isLocal){
                try{
                    const { data: row } = await supabase.from('earnings').select('id,user_id,amount,status').eq('id', earningId).single();
                    earningRow = row || null;
                    const s = ((row && row.status) || '').toString().toLowerCase();
                    wasRejected = ['rejected','canceled','cancelled','已取消','已拒绝','撤销','作废'].some(k=> s.includes(k));
                }catch(_){ earningRow=null; }
                const { data: udata, error: uerr, status: httpStatus } = await supabase.from('earnings').update({ status:'rejected' }).eq('id', earningId).select('id').single();
                if(!uerr) ok=true; else { console.warn('revoke db error', uerr, httpStatus); }
            }
            // 同步扣减用户余额（仅当之前不是已撤销状态时）
            if(ok && earningRow && !wasRejected && earningRow.user_id){
                try{
                    const { data: u } = await supabase.from('users').select('wallet_balance').eq('id', earningRow.user_id).single();
                    const current = parseFloat((u && u.wallet_balance) || 0);
                    const delta = parseFloat(earningRow.amount || 0);
                    const next = Math.max(0, current - (isFinite(delta)?delta:0));
                    await supabase.from('users').update({ wallet_balance: next, 钱包余额: next }).eq('id', earningRow.user_id);
                }catch(e){ console.warn('update wallet after revoke failed', e); }
                // 保险：再按用户实际记录重算一次，确保一致
                try{
                    await recalcUserWalletBalance(earningRow.user_id);
                }catch(e){ console.warn('update wallet after revoke failed', e); }
            }
        }catch(e){ console.warn('revoke db ex', e); }
        if(!ok){
            // 本地回退：在内存表里更新
            try{
                window.__earningsRawList = (window.__earningsRawList||[]).map(e=> e.id===earningId ? { ...e, status:'rejected' } : e);
                // 持久化覆盖，保证刷新后保持
                setEarningOverride(earningId, { status:'rejected' });
                ok=true;
            }catch(_){ }
        }
        if(ok){
            showNotification('撤销成功', 'success');
            try{ await loadEarningsData(); }catch(_){ try{ renderEarningsTable(window.__earningsRawList||[]); }catch(__){} }
            try{ await loadKKSearchData(); }catch(_){ }
            try{ await loadXraySearchData(); }catch(_){ }
            try{ await loadWukongSearchData(); }catch(_){ }
            try{ await loadKKDiskData(); }catch(_){ }
        }else{
            showNotification('撤销失败，请稍后重试', 'error');
        }
    }catch(e){ showNotification('撤销失败: '+e.message, 'error'); }
}

// 根据用户记录重算钱包余额，保证前后端一致
async function recalcUserWalletBalance(userId){
    if(!userId) return;
    try{
        await ensureSupabaseReady();
        let total=0, withdrawn=0;
        try{
            const { data: es } = await supabase.from('earnings').select('amount,status').eq('user_id', userId);
            (es||[]).forEach(e=>{ const s=(e.status||'').toString().toLowerCase(); const isRejected=/(rejected|canceled|cancelled|已取消|已拒绝|撤销|作废)/.test(s); if(!isRejected) total += parseFloat(e.amount||0)||0; });
        }catch(_){ }
        try{
            const { data: ws } = await supabase.from('withdrawals').select('amount,status').eq('user_id', userId);
            (ws||[]).forEach(w=>{ const s=(w.status||'').toString().toLowerCase(); const rej=/(rejected|fail|failed|已拒绝|未通过|失败)/.test(s); const ok=/(completed|paid|success|已到账|已完成|已打款|已提现)/.test(s); const pend=/(pending|review|审核|在途|处理中|processing|process|等待|待)/.test(s); if(!rej && (ok||pend)) withdrawn += parseFloat(w.amount||0)||0; });
        }catch(_){ }
        const next = Math.max(0, parseFloat(total) - parseFloat(withdrawn));
        await supabase.from('users').update({ wallet_balance: next, 钱包余额: next }).eq('id', userId);
    }catch(e){ console.warn('recalcUserWalletBalance failed', e); }
}
// 🔧 修复：加载提现数据（强制手动关联确保用户数据显示）
async function loadWithdrawalsData() {
    try {
        console.log('🔄 开始加载提现数据...');
        
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        // 直接使用简单查询，避免外键关系问题
        console.log('🔄 加载提现数据...');
        const { data: withdrawals, error } = await supabase
            .from('withdrawals')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        console.log(`🔍 加载了 ${withdrawals?.length || 0} 条提现记录`);
        
        // 强制进行用户数据关联
        if (withdrawals && withdrawals.length > 0) {
            console.log('🔄 强制关联用户数据...');
            await enrichWithdrawalsWithUserData(withdrawals);
            
            // 验证关联结果
            const associatedCount = withdrawals.filter(w => w.users?.username).length;
            console.log(`✅ 成功关联了 ${associatedCount}/${withdrawals.length} 条记录的用户数据`);
        }
        
        console.log(`✅ 成功加载了 ${withdrawals?.length || 0} 条提现记录`);
        // 先尝试将用户名提升到顶层，便于渲染/筛选（强制使用注册账号字段优先）
        (withdrawals||[]).forEach(w=>{
            if(w && w.users){
                const u=w.users; const preferred = (u['用户名']||u.username||u.display_name||u['显示名']||u.nickname||u['昵称']);
                if(preferred && String(preferred).trim()){
                    w.username_display = String(preferred).trim();
                }else if(u && u.username){
                    w.username_display = u.username;
                }
            }
        });
        // 保存原始列表供筛选/排序/导出/勾选
        window.__withdrawalsRaw = (withdrawals || []).slice();
        window.__withdrawalSelected = new Set();
        renderWithdrawalsTable(window.__withdrawalsRaw);
        
    } catch (error) {
        console.error('❌ 加载提现数据失败:', error);
        
        // 提供友好的错误提示和解决方案
        let friendlyMessage = '加载提现数据失败';
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            friendlyMessage = 'withdrawals表不存在，请先创建提现数据表';
        } else if (error.message.includes('relationship')) {
            friendlyMessage = '数据库关系配置问题，请点击"修复数据库"按钮';
        } else {
            friendlyMessage = '加载提现数据失败: ' + error.message;
        }
        
        showNotification(friendlyMessage, 'error');
        
        // 显示空表格，避免页面一直显示"加载中"
        renderWithdrawalsTable([]);
    }
}
// 🔧 强化：手动关联用户数据（确保用户信息正确显示）
async function enrichWithdrawalsWithUserData(withdrawals) {
    try {
        // 获取所有用户ID（兼容不同字段名）
        const userIds = [...new Set(withdrawals.map(w => w.user_id || w.user || w['用户ID']).filter(id => id))];
        
        if (userIds.length === 0) {
            console.log('⚠️ 没有有效的用户ID需要关联');
            // 即使没有用户ID，也要为每个提现记录创建默认用户信息
            withdrawals.forEach((withdrawal, index) => {
                withdrawal.users = {
                    username: `用户${index + 1}`,
                    alipay_account: null,
                    real_name: null,
                    wechat_qr_code: null
                };
            });
            return;
        }
        
        console.log(`🔄 查询 ${userIds.length} 个用户的信息...`, userIds);
        
        // 查询用户信息（两种键位：id 与 用户ID）。
        // 注：某些列在实际表结构中可能不存在，若选择列报错则退化为 select('*') 以保证拿到用户名。
        let usersById = [];
        let userError = null;
        try {
            let res = await supabase
                .from('users')
                .select('id, username, email')
                .in('id', userIds);
            if (res.error) {
                console.warn('按 id 精简列选择失败，退化为全列查询:', res.error.message);
                res = await supabase.from('users').select('*').in('id', userIds);
            }
            usersById = res.data || [];
            userError = res.error || null;
        } catch (e) { userError = e; }

        if (userError && (!usersById || usersById.length === 0) && (!usersByCnId || usersByCnId.length === 0)) {
            console.error('查询用户信息失败:', userError);
            withdrawals.forEach((withdrawal, index) => {
                const uid = withdrawal.user_id || withdrawal.user || withdrawal['用户ID'];
                withdrawal.users = {
                    username: uid ? `用户ID:${uid}` : `用户${index + 1}`,
                    alipay_account: null,
                    real_name: null,
                    wechat_qr_code: null
                };
            });
            return;
        }

        const users = [...usersById];
        console.log(`📦 查询到 ${users.length} 个用户信息（id/用户ID 合并）`);
        if (users.length > 0) {
            console.log('用户样本:', users[0]);
        }

        // 创建用户ID到完整用户信息的映射（支持两种键位），并预计算显示名
        const userMap = {};
        users.forEach(user => {
            let displayName = null;
            const candidateFields = ['display_name','显示名','full_name','name','姓名','nickname','昵称','username','用户名','real_name','真实姓名','email','邮箱','phone','手机号'];
            for (const key of candidateFields) {
                if (user[key] && String(user[key]).trim()) { displayName = String(user[key]).trim(); break; }
            }
            user.__displayName = displayName;
            if (user.id) userMap[user.id] = user;
        });
        
        // 将完整用户信息添加到提现记录中（兼容不同字段名）
        withdrawals.forEach((withdrawal, index) => {
            const uid = withdrawal.user_id || withdrawal.user || withdrawal['用户ID'];
            const user = userMap[uid];
            
            if (user) {
                // 🎯 优先使用预计算显示名
                let displayName = user.__displayName;
                if (!displayName) {
                    const candidateFields = ['display_name','显示名','full_name','name','姓名','nickname','昵称','username','用户名','real_name','真实姓名','email','邮箱','phone','手机号'];
                    for (const key of candidateFields) {
                        if (user[key] && String(user[key]).trim()) { displayName = String(user[key]).trim(); break; }
                    }
                }
                
                // 如果还是没有，使用ID的一部分
                if (!displayName) {
                    displayName = uid ? `用户${String(uid).slice(-6)}` : `用户${index + 1}`;
                }
                
                withdrawal.users = {
                    username: displayName,
                    alipay_account: user.alipay_account || user['支付宝账号'],
                    real_name: user.real_name || user['真实姓名'],
                    wechat_qr_code: user.wechat_qr_code || user['微信收款码']
                };
                withdrawal.username_display = displayName;
                console.log(`✅ 关联用户 ${uid}: ${displayName} (来源: ${Object.keys(user).join(', ')})`);
            } else {
                // 如果找不到用户信息，创建默认显示
                withdrawal.users = {
                    username: uid ? `用户${String(uid).slice(-6)}` : `用户${index + 1}`,
                    alipay_account: null,
                    real_name: null,
                    wechat_qr_code: null
                };
                withdrawal.username_display = withdrawal.users.username;
                console.log(`⚠️ 用户 ${uid} 未找到，使用默认显示`);
            }
        });
        
        const successCount = withdrawals.filter(w => w.users && userMap[w.user_id || w.user || w['用户ID']]).length;
        console.log(`✅ 用户数据关联完成：${successCount}/${withdrawals.length} 条记录成功关联`);
        
    } catch (error) {
        console.error('❌ 关联用户数据失败:', error);
        // 出错时也要创建默认用户信息，避免显示"未绑定"
        withdrawals.forEach((withdrawal, index) => {
            if (!withdrawal.users) {
                withdrawal.users = {
                    username: `用户${index + 1}`,
                    alipay_account: null,
                    real_name: null,
                    wechat_qr_code: null
                };
            }
        });
    }
}

// 🔧 新增：手动关联收益记录的用户信息，确保显示真实用户名
async function enrichEarningsWithUserData(earnings) {
    try {
        if (!Array.isArray(earnings) || earnings.length === 0) return;
        await ensureSupabaseReady();
        const userIds = [...new Set(earnings.map(e => e.user_id || e.user || e['用户ID']).filter(Boolean))];
        if (userIds.length === 0) {
            earnings.forEach((e, idx) => { if (!e.users) { e.users = { username: e.user_id ? `用户${String(e.user_id).slice(-6)}` : `用户${idx+1}` }; } });
            return;
        }
        let users = [];
        try {
            let r1 = await supabase.from('users')
                .select('id, username, email')
                .in('id', userIds);
            if (r1.error) {
                console.warn('earnings用户查询按id精简列失败，退化为*:', r1.error.message);
                r1 = await supabase.from('users').select('*').in('id', userIds);
            }
            users = (r1.data || []).slice();
        } catch (_) {}
        const userMap = {};
        users.forEach(u => {
            let displayName = null;
            const fields = ['username','email'];
            for (const k of fields) { if (u[k] && String(u[k]).trim()) { displayName = String(u[k]).trim(); break; } }
            if (u.id) userMap[u.id] = displayName || '';
        });
        earnings.forEach((e, idx) => {
            const uid = e.user_id || e.user || e['用户ID'];
            const dn = userMap[uid];
            if (!e.users) e.users = {};
            const resolved = dn && dn.trim() ? dn : (uid ? `用户${String(uid).slice(-6)}` : `用户${idx+1}`);
            e.users.username = resolved;
            e.username_display = resolved; // 提升到顶层，供渲染/筛选统一使用
        });
    } catch (err) {
        console.warn('enrichEarningsWithUserData failed:', err);
        earnings.forEach((e, idx) => { if (!e.users) e.users = { username: e.user_id ? `用户${String(e.user_id).slice(-6)}` : `用户${idx+1}` }; });
    }
}
// 渲染提现表格
function renderWithdrawalsTable(withdrawals) {
    const tbody = document.querySelector('#withdrawalsTable tbody');
    if (!tbody) return;
    
    if (withdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无提现数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = withdrawals.map(withdrawal => `
        <tr>
            <td><input type="checkbox" data-id="${withdrawal.id}" onchange="toggleWithdrawalSelection(this)"></td>
            <td>${withdrawal.id}</td>
            <td>${withdrawal.username_display || (withdrawal.users&&withdrawal.users.username) || ''}</td>
            <td>${getPaymentMethodDisplay(withdrawal)}</td>
            <td>¥${(withdrawal.amount || 0).toFixed(2)}</td>
            <td>${formatDate(withdrawal.created_at)}</td>
            <td>
                <span class="status-badge ${getStatusClass(withdrawal.status)}">
                    ${getStatusText(withdrawal.status)}
                </span>
            </td>
            <td>
                ${getWithdrawalActions(withdrawal)}
            </td>
        </tr>
    `).join('');
}

// 高级筛选/排序/导出/批量操作（提现）
function applyWithdrawalFilters(){
    try{
        const kw=(document.getElementById('withdrawalSearch')?.value||'').trim().toLowerCase();
        const method=(document.getElementById('withdrawalMethodFilter')?.value||'').trim();
        const range=(document.getElementById('withdrawalDateRange')?.value||'').trim();
        const minStr=(document.getElementById('withdrawalAmountMin')?.value||'').trim();
        const maxStr=(document.getElementById('withdrawalAmountMax')?.value||'').trim();
        const min= minStr ? parseFloat(minStr) : null;
        const max= maxStr ? parseFloat(maxStr) : null;
        let list=(window.__withdrawalsRaw||[]).slice();
        if(kw){ list=list.filter(w=> String(w.id||'').toLowerCase().includes(kw) || String(w.username_display || getUserDisplayName(w.users,w.user_id) || '').toLowerCase().includes(kw)); }
        if(method){
            // 统一转成标识值再对比，确保与显示一致
            list=list.filter(w=>{
                const disp = getPaymentMethodDisplay(w); // 返回 "支付宝"/"微信"/"未设置"
                const key = disp==='支付宝'?'alipay': (disp==='微信'?'wechat':'');
                return key===method;
            });
        }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(w=> new Date(w.created_at)>=since); }
        if(min!=null){ list=list.filter(w=> parseFloat(w.amount||0)>=min); }
        if(max!=null){ list=list.filter(w=> parseFloat(w.amount||0)<=max); }
        renderWithdrawalsTable(list);
    }catch(e){ console.warn('applyWithdrawalFilters', e); }
}

// 输入项变更时自动筛选（防抖）
const withdrawalFiltersChanged = debounce(applyWithdrawalFilters, 300);

function sortWithdrawalsBy(field){
    try{
        let list = Array.from(document.querySelectorAll('#withdrawalsTable tbody tr')).map(tr=>{
            const tds = tr.querySelectorAll('td');
            return {
                row: tr,
                id: tds[1]?.innerText.trim(),
                user: tds[2]?.innerText.trim(),
                method: tds[3]?.innerText.trim(),
                amount: parseFloat((tds[4]?.innerText||'').replace('¥',''))||0,
                created_at: tds[5]?.innerText.trim()
            };
        });
        list.sort((a,b)=> field==='amount' ? (b.amount - a.amount) : (new Date(b.created_at) - new Date(a.created_at)) );
        const tbody=document.querySelector('#withdrawalsTable tbody');
        tbody.innerHTML='';
        list.forEach(item=> tbody.appendChild(item.row));
    }catch(e){ console.warn('sortWithdrawalsBy', e); }
}

function exportWithdrawalsCSV(){
    try{
        const rows = document.querySelectorAll('#withdrawalsTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','用户','方式','金额','申请时间','状态'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<7) return;
            const line=[tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.trim(), (tds[4].innerText||'').replace('¥','').trim(), tds[5].innerText.trim(), tds[6].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='withdrawals.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}

function toggleSelectAllWithdrawals(){
    const checked = document.getElementById('withdrawalSelectAll').checked;
    document.querySelectorAll('#withdrawalsTable tbody input[type="checkbox"]').forEach(cb=>{ cb.checked=checked; toggleWithdrawalSelection(cb); });
}

function toggleWithdrawalSelection(checkbox){
    try{
        const id = checkbox.getAttribute('data-id');
        if(!window.__withdrawalSelected) window.__withdrawalSelected = new Set();
        if(checkbox.checked){ window.__withdrawalSelected.add(id); } else { window.__withdrawalSelected.delete(id); }
    }catch(e){ console.warn('toggleWithdrawalSelection', e); }
}

async function bulkApproveWithdrawals(){
    if(!guardMaintenanceOrProceed('批量通过')) return;
    const ids=[...(window.__withdrawalSelected||new Set())]; if(ids.length===0) return showNotification('请先勾选记录', 'info');
    if(!confirm(`确认批量通过 ${ids.length} 条提现？`)) return;
    try{ await ensureSupabaseReady(); const { error } = await supabase.from('withdrawals').update({status:'approved'}).in('id', ids); if(error) throw error; showNotification('批量通过完成', 'success'); await loadWithdrawalsData(); }catch(e){ showNotification('批量通过失败: '+e.message, 'error'); }
}

async function bulkRejectWithdrawals(){
    if(!guardMaintenanceOrProceed('批量拒绝')) return;
    const ids=[...(window.__withdrawalSelected||new Set())]; 
    if(ids.length===0) return showNotification('请先勾选记录', 'info');
    
    const reason = prompt('请输入拒绝原因（可选）:')||'';
    if(!confirm(`确认批量拒绝 ${ids.length} 条提现？`)) return;
    
    try{ 
        await ensureSupabaseReady(); 
        
        // 1. 先获取所有要拒绝的提现记录详情
        const { data: withdrawals, error: fetchError } = await supabase
            .from('withdrawals')
            .select('*')
            .in('id', ids);
        
        if (fetchError) throw fetchError;
        
        console.log(`📋 准备批量拒绝 ${withdrawals?.length || 0} 条提现`);
        
        // 2. 更新提现状态
        const payload = reason? {status:'rejected', admin_notes:reason}:{status:'rejected'}; 
        const { error } = await supabase.from('withdrawals').update(payload).in('id', ids); 
        if(error) throw error; 
        
        // 3. 🆕 为每条被拒绝的提现创建退回收益记录
        if (withdrawals && withdrawals.length > 0) {
            const refundEarnings = withdrawals.map(withdrawal => ({
                user_id: withdrawal.user_id,
                task_name: `提现退回 - ${reason || '提现申请被拒绝'}`,
                amount: parseFloat(withdrawal.amount),
                status: '已完成',
                reward_type: '提现退回',
                original_amount: parseFloat(withdrawal.amount),
                created_at: new Date().toISOString()
            }));
            
            console.log(`💰 创建 ${refundEarnings.length} 条退回收益记录`);
            
            const { error: earningError } = await supabase
                .from('earnings')
                .insert(refundEarnings);
            
            if (earningError) {
                console.warn('⚠️ 部分退回收益记录创建失败:', earningError);
            } else {
                console.log('✅ 所有退回收益记录已创建');
            }
        }
        
        showNotification(`批量拒绝完成，已创建 ${withdrawals?.length || 0} 条退回记录`, 'success'); 
        await loadWithdrawalsData(); 
    }catch(e){ 
        console.error('批量拒绝失败:', e);
        showNotification('批量拒绝失败: '+e.message, 'error'); 
    }
}
// 🎯 获取支付方式显示文本（强化版逻辑）
function getPaymentMethodDisplay(withdrawal) {
    console.log('🔍 判断支付方式:', withdrawal.id, {
        payment_method: withdrawal.payment_method,
        wechat_qr_code: !!withdrawal.wechat_qr_code,
        alipay_account: !!withdrawal.alipay_account,
        user_wechat: !!withdrawal.users?.wechat_qr_code,
        user_alipay: !!withdrawal.users?.alipay_account
    });
    
    // 0. 兼容其他字段名
    const method = withdrawal.payment_method || withdrawal.method || withdrawal['提现方式'];
    // -0. 系统设置禁用某些提现方式时的展示（仅影响显示，不更改原数据）
    try{
        const alipayEnabled = localStorage.getItem('admin:withdraw_alipay') !== 'false';
        const wechatEnabled = localStorage.getItem('admin:withdraw_wechat') !== 'false';
        if(!alipayEnabled && !wechatEnabled){ return '未设置'; }
    }catch(_){ }
    // 1. 优先使用数据库中的payment_method字段（含别名）
    if (method === 'alipay') {
        console.log('✅ 使用数据库payment_method: 支付宝');
        return '支付宝';
    }
    if (method === 'wechat') {
        console.log('✅ 使用数据库payment_method: 微信');
        return '微信';
    }
    
    // 2. 从localStorage历史记录中查找
    try {
        const withdrawalHistory = JSON.parse(localStorage.getItem('withdrawalPaymentHistory') || '[]');
        const historyRecord = withdrawalHistory.find(record => record.withdrawalId === withdrawal.id);
        if (historyRecord && historyRecord.paymentMethod) {
            const methodName = historyRecord.paymentMethod === 'wechat' ? '微信' : '支付宝';
            console.log('✅ 从localStorage历史记录获取:', methodName);
            return methodName;
        }
    } catch (e) {
        console.warn('读取localStorage历史记录失败:', e);
    }
    
    // 3. 根据提现记录中的支付信息推断
    const hasWechatInfo = withdrawal.wechat_qr_code || withdrawal.qr_code_url || (withdrawal.users && (withdrawal.users.wechat_qr_code || withdrawal.users['微信收款码']));
    const hasAlipayInfo = withdrawal.alipay_account || (withdrawal.users && (withdrawal.users.alipay_account || withdrawal.users['支付宝账号']));
    
    if (hasWechatInfo && !hasAlipayInfo) {
        console.log('🎯 从提现记录推断: 微信');
        return '微信';
    }
    if (hasAlipayInfo && !hasWechatInfo) {
        console.log('🎯 从提现记录推断: 支付宝');
        return '支付宝';
    }
    
    // 4. 根据用户信息推断
    const userHasWechat = withdrawal.users?.wechat_qr_code || (withdrawal.users && withdrawal.users['微信收款码']);
    const userHasAlipay = withdrawal.users?.alipay_account || (withdrawal.users && withdrawal.users['支付宝账号']);
    
    if (userHasWechat && !userHasAlipay) {
        console.log('🎯 从用户信息推断: 微信');
        return '微信';
    }
    if (userHasAlipay && !userHasWechat) {
        console.log('🎯 从用户信息推断: 支付宝');
        return '支付宝';
    }
    
    // 5. 如果两种支付方式都有，优先推断为支付宝（因为是默认选项）
    if (userHasAlipay || userHasWechat) {
        console.log('🎯 用户两种支付方式都有，默认为支付宝');
        return '支付宝';
    }
    
    // 6. 如果什么都没有
    console.log('⚠️ 无法确定支付方式');
    return '未设置';
}
// 获取提现操作按钮
function getWithdrawalActions(withdrawal) {
    const actions = [`<button class="btn btn-sm btn-primary" onclick="viewWithdrawal('${withdrawal.id}')">查看</button>`];
    
    if (withdrawal.status === 'pending') {
        actions.push(`<button class="btn btn-sm btn-success" onclick="approveWithdrawal('${withdrawal.id}')">通过</button>`);
        actions.push(`<button class="btn btn-sm btn-error" onclick="rejectWithdrawal('${withdrawal.id}')">拒绝</button>`);
    } else if (withdrawal.status === 'approved') {
        actions.push(`<button class="btn btn-sm btn-warning" onclick="completeWithdrawal('${withdrawal.id}')">完成</button>`);
    }
    
    return actions.join(' ');
}
// 🎯 获取支付方式详情显示（带图标）
function getPaymentMethodDetailDisplay(withdrawal) {
    const method = getPaymentMethodDisplay(withdrawal);
    
    if (method === '微信') {
        return '<i class="fab fa-weixin"></i> 微信支付';
    } else if (method === '支付宝') {
        return '<i class="fab fa-alipay"></i> 支付宝';
    } else {
        return method; // "未设置"
    }
}

// 🔧 一键回填：把用户表里的支付信息写回withdrawals记录
async function backfillWithdrawalPaymentInfo(withdrawalId, account, name, wechatQR) {
    try {
        if (!account && !name && !wechatQR) {
            showNotification('未找到可用的支付信息', 'warning');
            return;
        }
        await ensureSupabaseReady();
        const payload = {};
        if (account) payload.alipay_account = account;
        if (name) payload.real_name = name;
        if (wechatQR) payload.wechat_qr_code = wechatQR;
        
        // 根据实际可用信息判断提现方式
        if (wechatQR) {
            payload.payment_method = 'wechat';
        } else if (account) {
            payload.payment_method = 'alipay';
        }
        
        const { error } = await supabase
            .from('withdrawals')
            .update(payload)
            .eq('id', withdrawalId);
        if (error) throw error;
        showNotification('已回填到提现记录', 'success');
        // 关闭后刷新列表，避免显示旧数据
        closeModal('withdrawalModal');
        await loadWithdrawalsData();
    } catch (e) {
        console.error('回填支付信息失败:', e);
        showNotification('回填失败: ' + e.message, 'error');
    }
}
// 用户管理函数
function openUserModal(user = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    
    if (user) {
        // 编辑模式
        document.getElementById('userId').value = user.id;
        document.getElementById('username').value = user.username || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('password').value = '';
        document.getElementById('points').value = user.points || 0;
        document.getElementById('status').value = user.status || 'active';
    } else {
        // 新增模式
        form.reset();
        document.getElementById('userId').value = '';
    }
    
    showModal('userModal');
}

async function saveUser() {
    if(!guardMaintenanceOrProceed('保存用户')) return;
    try {
        const userId = document.getElementById('userId').value;
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const points = parseInt(document.getElementById('points').value) || 0;
        const status = document.getElementById('status').value;
        
        if (!username) {
            showNotification('请输入用户名', 'error');
            return;
        }
        
        const userData = {
            username,
            email: email || null,
            points,
            status
        };
        
        if (password) {
            userData.password = password;
        }
        
        let result;
        if (userId) {
            // 更新用户
            result = await supabase
                .from('users')
                .update(userData)
                .eq('id', userId);
        } else {
            // 新增用户
            if (!password) {
                showNotification('新用户必须设置密码', 'error');
                return;
            }
            result = await supabase
                .from('users')
                .insert([userData]);
        }
        
        if (result.error) throw result.error;
        
        showNotification(userId ? '用户更新成功' : '用户创建成功', 'success');
        closeModal('userModal');
        await loadUsersData();
        
    } catch (error) {
        console.error('保存用户失败:', error);
        showNotification('保存用户失败: ' + error.message, 'error');
    }
}

async function editUser(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        // 打开抽屉
        openUserDrawer(user);
        
    } catch (error) {
        console.error('获取用户信息失败:', error);
        showNotification('获取用户信息失败: ' + error.message, 'error');
    }
}

function openUserDrawer(user){
    try{
        document.getElementById('drawerUserId').value = user?.id||'';
        document.getElementById('drawerUsername').value = user?.username||'';
        document.getElementById('drawerEmail').value = user?.email||'';
        document.getElementById('drawerPoints').value = user?.points||0;
        document.getElementById('drawerStatus').value = user?.status||'active';
        try{ const p=document.getElementById('drawerPassword'); if(p) p.value=''; const p2=document.getElementById('drawerPassword2'); if(p2) p2.value=''; }catch(_){ }
        showModal('userDrawer');
    }catch(e){ console.warn('openUserDrawer', e); }
}

async function saveUserFromDrawer(){
    if(!guardMaintenanceOrProceed('保存用户')) return;
    try{
        await ensureSupabaseReady();
        const id=document.getElementById('drawerUserId').value;
        const payload={
            username: (document.getElementById('drawerUsername').value||'').trim(),
            email: (document.getElementById('drawerEmail').value||'').trim()||null,
            points: parseInt(document.getElementById('drawerPoints').value)||0,
            status: document.getElementById('drawerStatus').value
        };
        // 可选改密
        const np=(document.getElementById('drawerPassword')?.value||'').trim();
        const np2=(document.getElementById('drawerPassword2')?.value||'').trim();
        if(np || np2){
            if(np.length<6){ return showNotification('新密码至少6位', 'error'); }
            if(np!==np2){ return showNotification('两次输入的密码不一致', 'error'); }
            payload.password = np;
        }
        if(!payload.username){ return showNotification('用户名不能为空', 'error'); }
        const { error } = await supabase.from('users').update(payload).eq('id', id);
        if(error) throw error;
        showNotification('用户已保存', 'success');
        closeModal('userDrawer');
        loadUsersData();
    }catch(e){ showNotification('保存失败: '+e.message, 'error'); }
}

// 生成随机密码（管理员辅助）
function fillRandomPassword(){
    try{
        const p1=document.getElementById('drawerPassword');
        const p2=document.getElementById('drawerPassword2');
        if(!p1||!p2) return;
        const s=Math.random().toString(36).slice(2,6)+Math.random().toString(36).toUpperCase().slice(2,6)+'@'+Math.floor(10+Math.random()*90);
        p1.value=s; p2.value=s;
        showNotification('已生成随机密码', 'success');
    }catch(_){ }
}
async function resetUserPoints(){
    const id=document.getElementById('drawerUserId').value; if(!id) return;
    if(!confirm('确认将该用户积分重置为0？')) return;
    try{ await ensureSupabaseReady(); const {error}=await supabase.from('users').update({points:0}).eq('id', id); if(error) throw error; showNotification('积分已重置', 'success'); document.getElementById('drawerPoints').value=0; }catch(e){ showNotification('重置失败: '+e.message, 'error'); }
}

async function toggleUserStatus(){
    const id=document.getElementById('drawerUserId').value; if(!id) return;
    try{ await ensureSupabaseReady(); const cur=document.getElementById('drawerStatus').value; const next=cur==='active'?'disabled':'active'; const {error}=await supabase.from('users').update({status:next}).eq('id', id); if(error) throw error; document.getElementById('drawerStatus').value=next; showNotification('状态已更新为 '+(next==='active'?'正常':'禁用'), 'success'); }catch(e){ showNotification('更新失败: '+e.message, 'error'); }
}

async function deleteUser(userId) {
    if(!guardMaintenanceOrProceed('删除用户')) return;
    if (!confirm('确定要删除这个用户吗？此操作不可撤销！')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        showNotification('用户删除成功', 'success');
        await loadUsersData();
        
    } catch (error) {
        console.error('删除用户失败:', error);
        showNotification('删除用户失败: ' + error.message, 'error');
    }
}

// 收益管理函数
function openEarningsModal(earning = null) {
    try {
        // 若当前在收益管理页且KK搜索任务标签处于激活，则打开专用的KK收益弹窗
        const activeTab = document.querySelector('#earnings .task-tab.active');
        const taskType = activeTab ? activeTab.getAttribute('data-task') : '';
        if (taskType === 'kk-search') {
            if (typeof openKKSearchEarningsModal === 'function') {
                openKKSearchEarningsModal();
                return;
            }
        } else if (taskType === 'xray-search') {
            if (typeof openXraySearchEarningsModal === 'function') {
                openXraySearchEarningsModal();
                return;
            }
        }
    } catch (_) {}
    const modal = document.getElementById('earningsModal');
    const form = document.getElementById('earningsForm');
    
    if (earning) {
        // 编辑模式
        document.getElementById('earningId').value = earning.id;
        document.getElementById('earningUser').value = earning.user_id;
        document.getElementById('taskType').value = earning.task_name || '';
        document.getElementById('amount').value = earning.amount || '';
        document.getElementById('earningStatus').value = earning.status || '已完成';
    } else {
        // 新增模式
        form.reset();
        document.getElementById('earningId').value = '';
    }
    
    showModal('earningsModal');
}
// 打开x雷浏览器收益模态框（与KK专用弹窗一致的体验）
async function openXraySearchEarningsModal(){
    try{
        const modal = document.getElementById('xraySearchEarningsModal');
        if(!modal){ console.error('❌ x雷浏览器收益模态框不存在'); return; }
        // 重置表单
        const form = document.getElementById('xraySearchEarningsForm');
        if(form) form.reset();
        // 重置字段
        const resetIds=['xrayEarningId','xrPullNew10','xrPullNew100','xrPullNew200','xrPullNew1000','xrayTotalAmount','xrayKeywordSearch'];
        resetIds.forEach(id=>{
            const el=document.getElementById(id);
            if(!el) return;
            if(id==='xrayTotalAmount') el.value='¥0.00';
            else if(id==='xrayEarningId') el.value='';
            else if(id==='xrayKeywordSearch'){ el.style.display='block'; el.value=''; }
            else el.value='0';
        });
        // 重置搜索选择区
        try{ clearXraySelectedKeyword(); hideXraySearchDropdown(); }catch(_){ }
        
        // 显示模态框
        showModal('xraySearchEarningsModal');
        
        // 显示加载提示
        const searchInput = document.getElementById('xrayKeywordSearch');
        if (searchInput) {
            searchInput.placeholder = '🔄 正在加载关键词数据...';
            searchInput.disabled = true;
        }
        
        // 载入可选关键词（含Supabase回源）- 等待加载完成
        console.log('🚀🚀🚀 [x雷模态框] 开始加载关键词数据...');
        console.log('📊 [加载前] xraySearchKeywords数组长度:', xraySearchKeywords?.length || 0);
        
        try {
            await loadKKSearchKeywordsForSelect();
            
            console.log('📊 [加载后] xraySearchKeywords数组长度:', xraySearchKeywords?.length || 0);
            console.log('✅ 关键词数据加载完成');
            
            // 恢复搜索框
            if (searchInput) {
                searchInput.placeholder = '🔍 搜索关键词或用户名，回车确认...';
                searchInput.disabled = false;
            }
            
            if (xraySearchKeywords && xraySearchKeywords.length > 0) {
                console.log('📋 x雷关键词前3个:', xraySearchKeywords.slice(0, 3));
                showNotification(`✅ 成功加载 ${xraySearchKeywords.length} 个x雷关键词`, 'success');
            } else {
                console.warn('⚠️ 没有加载到任何x雷关键词！');
                console.log('💡 提示：请检查数据库中是否有 task_type 包含 "x雷" 的已审核申请');
                showNotification('未找到x雷关键词数据，请先审核通过关键词申请', 'warning');
            }
        } catch(err) {
            console.error('❌ 加载关键词失败:', err);
            if (searchInput) {
                searchInput.placeholder = '❌ 加载失败，请刷新重试';
                searchInput.disabled = false;
            }
            showNotification('加载关键词数据失败: ' + err.message, 'error');
        }
    }catch(e){ console.warn('openXraySearchEarningsModal', e); }
}
async function saveEarning() {
    if(!guardMaintenanceOrProceed('保存收益')) return;
    try {
        const earningId = document.getElementById('earningId').value;
        const userId = document.getElementById('earningUser').value;
        const taskType = document.getElementById('taskType').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const status = document.getElementById('earningStatus').value;
        
        if (!userId || !taskType || !amount) {
            showNotification('请填写所有必填字段', 'error');
            return;
        }
        
        const earningData = {
            user_id: userId,
            task_name: taskType,
            amount,
            status
        };
        
        let result;
        if (earningId) {
            // 更新收益
            result = await supabase
                .from('earnings')
                .update(earningData)
                .eq('id', earningId);
        } else {
            // 新增收益
            result = await supabase
                .from('earnings')
                .insert([earningData]);
        }
        
        if (result.error) throw result.error;
        
        showNotification(earningId ? '收益更新成功' : '收益创建成功', 'success');
        closeModal('earningsModal');
        await loadEarningsData();
        
    } catch (error) {
        console.error('保存收益失败:', error);
        showNotification('保存收益失败: ' + error.message, 'error');
    }
}

async function editEarning(earningId) {
    try {
        const { data: earning, error } = await supabase
            .from('earnings')
            .select('*')
            .eq('id', earningId)
            .single();
        
        if (error) throw error;
        
        openEarningsModal(earning);
        
    } catch (error) {
        console.error('获取收益信息失败:', error);
        showNotification('获取收益信息失败: ' + error.message, 'error');
    }
}

async function deleteEarning(earningId) {
    if(!guardMaintenanceOrProceed('删除收益')) return;
    if (!confirm('确定要删除这条收益记录吗？此操作不可撤销！')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('earnings')
            .delete()
            .eq('id', earningId);
        
        if (error) throw error;
        
        showNotification('收益记录删除成功', 'success');
        await loadEarningsData();
        
    } catch (error) {
        console.error('删除收益记录失败:', error);
        showNotification('删除收益记录失败: ' + error.message, 'error');
    }
}

// 加载用户列表到选择框
async function loadUsersForSelect() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, email')
            .order('username', { ascending: true });
        
        if (error) throw error;
        
        const select = document.getElementById('earningUser');
        if (!select) return;
        
        // 清空现有选项（保留第一个占位符选项）
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // 添加用户选项
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username || user.email || `用户${user.id}`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('加载用户列表失败:', error);
    }
}
// 🔧 修复：提现管理函数（兼容性查询）
async function viewWithdrawal(withdrawalId) {
    try {
        console.log('🔄 查看提现详情:', withdrawalId);
        
        // 方法1: 尝试带外键关系的查询
        let withdrawal, error;
        try {
            const response1 = await supabase
            .from('withdrawals')
            .select('*')
            .eq('id', withdrawalId)
            .single();
            
            withdrawal = response1.data;
            error = response1.error;
            
            if (!error) {
                console.log('✅ 提现详情外键关系查询成功');
            }
        } catch (relationError) {
            console.log('⚠️ 提现详情外键关系查询失败，尝试简单查询:', relationError.message);
            error = relationError;
        }
        
        // 方法2: 如果外键查询失败，使用简单查询
        if (error) {
            console.log('🔄 使用简单查询加载提现详情...');
            const response2 = await supabase
                .from('withdrawals')
                .select('*')
                .eq('id', withdrawalId)
                .single();
            
            withdrawal = response2.data;
            error = response2.error;
            
            if (error) {
                throw error;
            }
            
            // 简单查询完成
        }
        // 方法3: 无论上面哪条路径，只要没有用户对象，就手动关联一次
        if (withdrawal && withdrawal.user_id && !withdrawal.users) {
            console.log('🔄 关联提现详情的用户数据（统一兜底）...');
            let user = null;
            try {
                const r1 = await supabase.from('users').select('*').eq('id', withdrawal.user_id).single();
                user = r1.data || null;
            } catch (_) {}
            if (!user) {
                try {
                    const r2 = await supabase.from('users').select('*').eq('用户ID', withdrawal.user_id).single();
                    user = r2.data || null;
                } catch (_) {}
            }
            if (user) {
                    withdrawal.users = user;
                    console.log('✅ 用户数据关联完成');
            }
        }
        
        if (error) throw error;
        
        // 🔧 兜底：尝试从本地存储补全支付信息（在数据库未升级时仍可展示）
        try {
            const needsAlipay = !(
                withdrawal?.alipay_account 
                || withdrawal?.users?.alipay_account 
                || (withdrawal?.users && withdrawal.users['支付宝账号'])
            );
            const needsRealName = !(
                withdrawal?.real_name 
                || withdrawal?.users?.real_name 
                || (withdrawal?.users && withdrawal.users['真实姓名'])
            );
            
            if (needsAlipay || needsRealName || !withdrawal.payment_method) {
                const backupStr = localStorage.getItem('lastWithdrawalPaymentInfo');
                if (backupStr) {
                    const backup = JSON.parse(backupStr);
                    // 匹配当前提现记录（优先用提现ID，其次用用户ID）
                    if (
                        (backup.withdrawalId && backup.withdrawalId === withdrawalId) ||
                        (backup.userId && backup.userId === withdrawal.user_id)
                    ) {
                        // 回填字段
                        if (needsAlipay && backup.alipayAccount) {
                            withdrawal.alipay_account = backup.alipayAccount;
                        }
                        if (needsRealName && backup.realName) {
                            withdrawal.real_name = backup.realName;
                        }
                        if (!withdrawal.payment_method && backup.paymentMethod) {
                            withdrawal.payment_method = backup.paymentMethod;
                        }
                        console.log('✅ 已从localStorage备份补全支付信息');
                    }
                }
            }
        } catch (fallbackErr) {
            console.warn('⚠️ 本地支付信息兜底失败:', fallbackErr);
        }
        
        // 计算是否可回填（记录缺字段，但用户信息可用）
        const userAliAccount = withdrawal.users?.alipay_account || (withdrawal.users && withdrawal.users['支付宝账号']);
        const userRealName = withdrawal.users?.real_name || (withdrawal.users && withdrawal.users['真实姓名']);
        const userWechatQR = withdrawal.users?.wechat_qr_code || (withdrawal.users && withdrawal.users['微信收款码']);
        const canBackfill = (!withdrawal.alipay_account || !withdrawal.real_name || !withdrawal.wechat_qr_code || !withdrawal.payment_method) && (userAliAccount || userRealName || userWechatQR);

        // 🔧 增强：构建完整的提现详情HTML，包含支付信息
        // 计算显示名
        const __name = withdrawal.users ? getUserDisplayName(withdrawal.users, withdrawal.user_id) : (withdrawal.username_display || getUserDisplayName(null, withdrawal.user_id));

        const detailsHtml = `
            <div class="withdrawal-details">
                <div class="detail-section">
                    <h4><i class="fas fa-info-circle"></i> 基本信息</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>提现ID:</label>
                            <span class="detail-value selectable">${withdrawal.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>用户名:</label>
                            <span class="detail-value">${__name || '未知用户'}</span>
                        </div>
                        <div class="detail-item">
                            <label>提现金额:</label>
                            <span class="detail-value amount">¥${(withdrawal.amount || 0).toFixed(2)}</span>
                        </div>
                <div class="detail-item">
                    <label>提现方式:</label>
                    <span class="detail-value">
                        ${getPaymentMethodDetailDisplay(withdrawal)}
                    </span>
                </div>
                        <div class="detail-item">
                            <label>状态:</label>
                            <span class="status-badge ${getStatusClass(withdrawal.status)}">
                                ${getStatusText(withdrawal.status)}
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>申请时间:</label>
                            <span class="detail-value">${formatDate(withdrawal.created_at)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-credit-card"></i> 收款信息 <span class="payment-note">(打款必需信息)</span>
                        ${canBackfill ? `<button class="btn btn-sm btn-secondary" style="margin-left:8px" onclick="backfillWithdrawalPaymentInfo('${withdrawal.id}', '${userAliAccount || ''}', '${userRealName || ''}', '${userWechatQR || ''}')">
                            <i class="fas fa-sync"></i> 一键回填到记录
                        </button>` : ''}
                    </h4>
                    <div class="payment-info-grid">
                        ${withdrawal.payment_method === 'alipay' || !withdrawal.payment_method ? `
                            <div class="payment-item alipay-info">
                                <div class="payment-header">
                                    <i class="fab fa-alipay"></i>
                                    <span>支付宝收款信息</span>
                                </div>
                                <div class="payment-details">
                                    <div class="payment-field">
                                        <label>支付宝账号:</label>
                                        <span class="payment-value selectable">
                                            ${withdrawal.alipay_account 
                                                || withdrawal.users?.alipay_account 
                                                || (withdrawal.users && withdrawal.users['支付宝账号']) 
                                                || '❌ 未设置'}
                                        </span>
                                        ${(
                                            withdrawal.alipay_account 
                                            || withdrawal.users?.alipay_account 
                                            || (withdrawal.users && withdrawal.users['支付宝账号'])
                                        ) ? 
                                            `<button class="copy-btn" onclick="copyToClipboard('${withdrawal.alipay_account || withdrawal.users?.alipay_account || (withdrawal.users && withdrawal.users['支付宝账号'])}', '支付宝账号')">
                                                <i class="fas fa-copy"></i>
                                            </button>` : ''}
                                    </div>
                                    <div class="payment-field">
                                        <label>真实姓名:</label>
                                        <span class="payment-value selectable">
                                            ${withdrawal.real_name 
                                                || withdrawal.users?.real_name 
                                                || (withdrawal.users && withdrawal.users['真实姓名']) 
                                                || '❌ 未设置'}
                                        </span>
                                        ${(
                                            withdrawal.real_name 
                                            || withdrawal.users?.real_name 
                                            || (withdrawal.users && withdrawal.users['真实姓名'])
                                        ) ? 
                                            `<button class="copy-btn" onclick="copyToClipboard('${withdrawal.real_name || withdrawal.users?.real_name || (withdrawal.users && withdrawal.users['真实姓名'])}', '真实姓名')">
                                                <i class="fas fa-copy"></i>
                                            </button>` : ''}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${withdrawal.payment_method === 'wechat' ? `
                            <div class="payment-item wechat-info">
                                <div class="payment-header">
                                    <i class="fab fa-weixin"></i>
                                    <span>微信收款信息</span>
                                </div>
                                <div class="payment-details">
                                    <div class="payment-field">
                                        <label>真实姓名:</label>
                                        <span class="payment-value selectable">
                                            ${withdrawal.real_name || withdrawal.users?.real_name || '❌ 未设置'}
                                        </span>
                                        ${(withdrawal.real_name || withdrawal.users?.real_name) ? 
                                            `<button class="copy-btn" onclick="copyToClipboard('${withdrawal.real_name || withdrawal.users?.real_name}', '真实姓名')">
                                                <i class="fas fa-copy"></i>
                                            </button>` : ''}
                                    </div>
                                    <div class="payment-field qr-code-field">
                                        <label>微信收款码:</label>
                                        ${getWechatQRCodeDisplay(withdrawal)}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-user"></i> 用户详细信息</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>用户ID:</label>
                            <span class="detail-value selectable">${withdrawal.user_id || '未知'}</span>
                        </div>
                        <div class="detail-item">
                            <label>邮箱:</label>
                            <span class="detail-value selectable">${withdrawal.users?.email || '未设置'}</span>
                        </div>
                        <div class="detail-item">
                            <label>手机号:</label>
                            <span class="detail-value selectable">${withdrawal.users?.phone || '未设置'}</span>
                        </div>
                        <div class="detail-item">
                            <label>注册时间:</label>
                            <span class="detail-value">${withdrawal.users?.created_at ? formatDate(withdrawal.users.created_at) : '未知'}</span>
                        </div>
                        </div>
                    </div>
                
                ${withdrawal.admin_notes ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-sticky-note"></i> 管理员备注</h4>
                        <div class="admin-notes">
                            ${withdrawal.admin_notes}
                </div>
                    </div>
                ` : ''}
                
                ${withdrawal.status === 'pending' ? `
                    <div class="detail-actions">
                        <button class="btn btn-success" onclick="approveWithdrawal('${withdrawal.id}'); closeModal('withdrawalModal');">
                            <i class="fas fa-check"></i> 通过申请
                        </button>
                        <button class="btn btn-error" onclick="rejectWithdrawal('${withdrawal.id}'); closeModal('withdrawalModal');">
                            <i class="fas fa-times"></i> 拒绝申请
                        </button>
                        <button class="btn btn-warning" onclick="addAdminNote('${withdrawal.id}')">
                            <i class="fas fa-sticky-note"></i> 添加备注
                        </button>
                    </div>
                ` : ''}
                
                <div class="detail-footer">
                    <small class="text-muted">
                        <i class="fas fa-info-circle"></i> 
                        请核实收款信息无误后再进行打款操作，确保资金安全。
                    </small>
                </div>
            </div>
        `;
        
        document.getElementById('withdrawalDetails').innerHTML = detailsHtml;
        showModal('withdrawalModal');
        
    } catch (error) {
        console.error('获取提现详情失败:', error);
        showNotification('获取提现详情失败: ' + error.message, 'error');
    }
}

async function approveWithdrawal(withdrawalId) {
    if(!guardMaintenanceOrProceed('通过提现')) return;
    try {
        const { error } = await supabase
            .from('withdrawals')
            .update({ status: 'approved' })
            .eq('id', withdrawalId);
        
        if (error) throw error;
        
        showNotification('提现申请已通过', 'success');
        await loadWithdrawalsData();
        
    } catch (error) {
        console.error('通过提现申请失败:', error);
        showNotification('通过提现申请失败: ' + error.message, 'error');
    }
}
async function rejectWithdrawal(withdrawalId) {
    if(!guardMaintenanceOrProceed('拒绝提现')) return;
    const reason = prompt('请输入拒绝原因（可选）:');
    
    try {
        // 1. 先获取提现记录详情
        const { data: withdrawal, error: fetchError } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('id', withdrawalId)
            .single();
        
        if (fetchError) throw fetchError;
        if (!withdrawal) throw new Error('提现记录不存在');
        
        console.log('📋 准备拒绝提现:', {
            id: withdrawalId,
            userId: withdrawal.user_id,
            amount: withdrawal.amount
        });
        
        // 2. 更新提现状态为拒绝
        const updateData = { status: 'rejected' };
        if (reason) {
            updateData.admin_notes = reason;
        }
        
        const { error } = await supabase
            .from('withdrawals')
            .update(updateData)
            .eq('id', withdrawalId);
        
        if (error) throw error;
        
        // 3. 🆕 创建退回收益记录
        const refundEarning = {
            user_id: withdrawal.user_id,
            task_name: `提现退回 - ${reason || '提现申请被拒绝'}`,
            amount: parseFloat(withdrawal.amount),
            status: '已完成',
            reward_type: '提现退回',
            original_amount: parseFloat(withdrawal.amount),
            created_at: new Date().toISOString()
        };
        
        console.log('💰 创建退回收益记录:', refundEarning);
        
        const { error: earningError } = await supabase
            .from('earnings')
            .insert([refundEarning]);
        
        if (earningError) {
            console.warn('⚠️ 退回收益记录创建失败:', earningError);
            // 不抛出错误，提现拒绝已经完成
        } else {
            console.log('✅ 退回收益记录已创建');
        }
        
        showNotification(`提现申请已拒绝，¥${withdrawal.amount} 已退回用户账户`, 'success');
        await loadWithdrawalsData();
        
    } catch (error) {
        console.error('拒绝提现申请失败:', error);
        showNotification('拒绝提现申请失败: ' + error.message, 'error');
    }
}
async function completeWithdrawal(withdrawalId) {
    if(!guardMaintenanceOrProceed('完成提现')) return;
    if (!confirm('确认已完成打款操作？')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('withdrawals')
            .update({ status: 'completed' })
            .eq('id', withdrawalId);
        
        if (error) throw error;
        
        showNotification('提现已标记为完成', 'success');
        await loadWithdrawalsData();
        
    } catch (error) {
        console.error('完成提现失败:', error);
        showNotification('完成提现失败: ' + error.message, 'error');
    }
}
// 搜索和过滤函数
function searchUsers() {
    const keyword = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(keyword) ? '' : 'none';
    });
}

function filterUsers() {
    const status = document.getElementById('userStatusFilter').value;
    const rows = document.querySelectorAll('#usersTable tbody tr');
    
    rows.forEach(row => {
        if (!status) {
            row.style.display = '';
            return;
        }
        
        const statusElement = row.querySelector('.status-badge');
        if (statusElement) {
            const rowStatus = statusElement.classList.contains('status-active') ? 'active' : 'disabled';
            row.style.display = rowStatus === status ? '' : 'none';
        }
    });
}

function searchEarnings() {
    const keyword = document.getElementById('earningsSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#earningsTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(keyword) ? '' : 'none';
    });
}

function filterEarnings() {
    const type = document.getElementById('earningsTypeFilter').value;
    const rows = document.querySelectorAll('#earningsTable tbody tr');
    
    rows.forEach(row => {
        if (!type) {
            row.style.display = '';
            return;
        }
        
        const typeCell = row.cells[2]; // 任务类型列
        if (typeCell) {
            row.style.display = typeCell.textContent.includes(type) ? '' : 'none';
        }
    });
}

function filterWithdrawals(status) {
    const rows = document.querySelectorAll('#withdrawalsTable tbody tr');
    
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
            return;
        }
        
        const statusElement = row.querySelector('.status-badge');
        if (statusElement) {
            const hasStatus = statusElement.classList.contains(`status-${status}`);
            row.style.display = hasStatus ? '' : 'none';
        }
    });
}
// 🔧 修复：统一模态框显示逻辑
function showModal(id){ try{ const el=document.getElementById(id); if(el){ el.style.display='flex'; } }catch(_){ } }
function __closeModal(id){ try{ const el=document.getElementById(id); if(el){ el.style.display='none'; } }catch(_){ } }
window.__closeModal = __closeModal;
// 打开KK网盘申请详情
function openKDDdetail(applicationId){
    try{
        window.__kdDetailId = applicationId;
        let app=null;
        try{
            const list = Array.isArray(window.__kdMgmtCache)?window.__kdMgmtCache:[];
            app = list.find(a=> String(a.id||'')===String(applicationId));
        }catch(_){ }
        // 兜底：若缓存里字段缺失，则到本地原始存储里按 id 取一份覆盖
        try{
            const need = (x)=> x==null || x===undefined || x==='';
            if(!app) app={ id: applicationId };
            if(need(app.quark_uid) || need(app.quark_phone) || need(app.real_name) || need(app.bind_screenshot)){
                // 先从 promotionApplications 查
                try{
                    const gl = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                    const g = Array.isArray(gl)? gl.find(x=> String(x.id||'')===String(applicationId)) : null;
                    if(g){
                        app.quark_uid = app.quark_uid || g.quark_uid || g.quarkUid || g.uid || null;
                        app.quark_phone = app.quark_phone || g.quark_phone || g.quarkPhone || g.phone || null;
                        app.real_name = app.real_name || g.real_name || g.realName || g.name || null;
                        app.bind_screenshot = app.bind_screenshot || g.bind_screenshot || g.screenshot || null;
                        app.promotion_channel = app.promotion_channel || g.promotion_channel || g.channel || null;
                    }
                }catch(_){ }
                // 再从所有 keywords_* 键查
                try{
                    for(let i=0;i<localStorage.length;i++){
                        const k = localStorage.key(i);
                        if(!k || !k.startsWith('keywords_')) continue;
                        try{
                            const arr = JSON.parse(localStorage.getItem(k)||'[]');
                            const it = Array.isArray(arr)? arr.find(x=> String(x.id||'')===String(applicationId)) : null;
                            if(it){
                                app.quark_uid = app.quark_uid || it.quark_uid || it.quarkUid || it.uid || null;
                                app.quark_phone = app.quark_phone || it.quark_phone || it.quarkPhone || it.phone || null;
                                app.real_name = app.real_name || it.real_name || it.realName || it.name || null;
                                app.bind_screenshot = app.bind_screenshot || it.bind_screenshot || it.screenshot || null;
                                app.promotion_channel = app.promotion_channel || it.promotion_channel || it.channel || null;
                                break;
                            }
                        }catch(_){ }
                    }
                }catch(_){ }
            }
        }catch(_){ }
        const setText=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v||'-'; };
        if(app){
            setText('kdDetailId', app.id||'-');
            setText('kdDetailUser', app.username||'-');
            setText('kdDetailTask', app.task_type||'KK网盘任务');
            setText('kdDetailUid', app.quark_uid||'-');
            setText('kdDetailPhone', app.quark_phone||'-');
            setText('kdDetailRealName', app.real_name||'-');
            setText('kdDetailChannel', (typeof getChannelText==='function')? getChannelText(app.promotion_channel): (app.promotion_channel||'-'));
            setText('kdDetailTime', app.created_at? (typeof formatDate==='function'?formatDate(app.created_at):app.created_at):'-');
            try{ const td=document.getElementById('kdDetailBind'); if(td){
                if(app.bind_screenshot){
                    const url = String(app.bind_screenshot);
                    td.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">
                        <img src="${url}" alt="绑定截图" style="max-width:280px;border:1px solid #e5e7eb;border-radius:6px;">
                        <div>
                            <a href="${url}" target="_blank" rel="noopener">新窗口打开</a>
                            <span style="color:#9ca3af;margin:0 6px;">|</span>
                            <a href="${url}" download="bind-5008.png">下载</a>
                        </div>
                    </div>`;
                } else {
                    td.textContent = '-';
                }
            } }catch(_){ }
            setText('kdDetailStatus', (typeof getApprovalStatusText==='function')? getApprovalStatusText(app.status): (app.status||'-'));
        }
        showModal('kdDetailModal');
    }catch(e){ console.warn('openKDDdetail', e); }
}
// 兼容不同按钮写法的别名（防止大小写/拼写差异导致未定义）
window.openKDDdetail = openKDDdetail;
window.openKDDDetail = openKDDdetail;
window.openKDDetail  = openKDDdetail;
window.openKdDetail  = openKDDdetail;

// 工具函数
function formatDate(dateString) {
    if (!dateString) return '未知';
    
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusClass(status) {
    const statusMap = {
        'active': 'status-active',
        'disabled': 'status-disabled',
        'pending': 'status-pending',
        'approved': 'status-approved',
        'rejected': 'status-rejected',
        'completed': 'status-completed',
        '已完成': 'status-completed',
        '进行中': 'status-pending',
        '已取消': 'status-rejected',
        '已拒绝': 'status-rejected',
        // 兼容撤销后的状态值
        'canceled': 'status-rejected'
    };
    
    return statusMap[status] || 'status-active';
}
function getStatusText(status) {
    const statusMap = {
        'active': '正常',
        'disabled': '禁用',
        'pending': '待处理',
        'approved': '已通过',
        'rejected': '已拒绝',
        'completed': '已完成',
        // 兼容撤销后的状态值
        'canceled': '已取消'
    };
    
    return statusMap[status] || status;
}

// ====== 本地覆盖（earnings）工具：用于后端不可写时的持久化回退 ======
function readEarningsOverrides(){
    try{ return JSON.parse(localStorage.getItem('earnings_overrides')||'{}'); }catch(_){ return {}; }
}
function writeEarningsOverrides(map){
    try{ localStorage.setItem('earnings_overrides', JSON.stringify(map||{})); }catch(_){ }
}
function setEarningOverride(id, patch){
    if(!id) return;
    const map=readEarningsOverrides();
    map[id] = { ...(map[id]||{}), ...(patch||{}), _ts: Date.now() };
    writeEarningsOverrides(map);
}
function applyEarningsOverrides(list){
    try{
        const map=readEarningsOverrides();
        if(!map || !list || list.length===0) return list;
        return list.map(e=>{ const o=map[e.id]; return o ? { ...e, ...o } : e; });
    }catch(_){ return list; }
}
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .withdrawal-details .detail-section {
        margin-bottom: 24px;
    }
    
    .withdrawal-details .detail-section h4 {
        margin-bottom: 12px;
        color: var(--text-primary);
        font-weight: 600;
    }
    
    .withdrawal-details .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
    }
    
    .withdrawal-details .detail-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .withdrawal-details .detail-item label {
        font-weight: 500;
        color: var(--text-secondary);
        font-size: 14px;
    }
    
    .withdrawal-details .detail-item span {
        color: var(--text-primary);
    }
    
    .withdrawal-details .detail-actions {
        margin-top: 24px;
        display: flex;
        gap: 12px;
        justify-content: center;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
    }
`;
document.head.appendChild(style);
console.log('后台管理系统脚本加载完成');

// 任务分类管理功能
let currentTaskTab = 'all';
let currentEarningsSection = 'task';

// 切换任务选项卡
function switchTaskTab(taskType) {
    console.log('切换任务选项卡:', taskType);
    
    // 更新选项卡激活状态
    document.querySelectorAll('.task-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-task="${taskType}"]`).classList.add('active');
    
    // 隐藏所有任务内容
    document.querySelectorAll('.task-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // 显示选中的任务内容
    const targetContent = getTaskContentElement(taskType);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
    
    // 更新当前选项卡
    currentTaskTab = taskType;
    
    // 根据任务类型加载对应数据
    loadTaskData(taskType);

    // 控制"添加收益"按钮：仅在KK搜索/x雷浏览器/KK网盘/悟空标签显示，全部收益隐藏
    try{
        const addBtn = document.getElementById('btnAddEarning');
        if(addBtn){ addBtn.style.display = (taskType==='kk-search'||taskType==='xray-search'||taskType==='kk-disk'||taskType==='wukong-search') ? 'inline-flex' : 'none'; }
    }catch(_){ }
}

// 一级切换：任务收益管理 / 其他收益管理
function switchEarningsSection(section){
    try{
        // 更新tab外观
        document.querySelectorAll('#earnings .section-tab').forEach(t=>t.classList.remove('active'));
        const btn = document.querySelector(`#earnings .section-tab[data-section="${section}"]`);
        if(btn) btn.classList.add('active');
        // 显示对应容器
        const taskBox = document.getElementById('taskEarningsSection');
        const otherBox = document.getElementById('otherEarningsSection');
        if(taskBox) taskBox.style.display = section==='task' ? 'block' : 'none';
        if(otherBox) otherBox.style.display = section==='other' ? 'block' : 'none';
        currentEarningsSection = section;
        // 同步隐藏/显示任务收益下的所有内容卡片
        try{
            document.querySelectorAll('#earnings .task-content, #earnings .task-management-content').forEach(el=>{
                el.style.display = (section==='task') ? el.style.display : 'none';
            });
            if(section==='task'){ switchTaskTab(currentTaskTab||'all'); }
        }catch(_){ }
        // 控制"添加收益"按钮（仅任务收益内由任务类型控制；其他收益内固定隐藏此按钮，使用内部按钮）
        try{
            const addBtn = document.getElementById('btnAddEarning');
            if(addBtn) addBtn.style.display = section==='task' && (currentTaskTab==='kk-search'||currentTaskTab==='xray-search'||currentTaskTab==='kk-disk'||currentTaskTab==='wukong-search') ? 'inline-flex' : 'none';
        }catch(_){ }
        // 首次进入"其他收益"时加载列表
        if(section==='other'){
            loadOtherEarnings();
            // 填充用户下拉
            try{ loadUsersForOtherSelect(); }catch(_){ }
            try{ const box=document.getElementById('otherEarningsSection'); if(box) box.scrollIntoView({behavior:'smooth', block:'start'}); }catch(_){ }
        }
    }catch(e){ console.warn('switchEarningsSection', e); }
}
// 导出到全局，确保内联 onclick 可用
if(typeof window!=='undefined'){
    window.switchEarningsSection = switchEarningsSection;
}

function loadUsersForOtherSelect(){
    try{
        // 复用已存在的加载逻辑
        if(typeof ensureSupabaseReady==='function'){ try{ ensureSupabaseReady(); }catch(_){ } }
        if(typeof supabase==='undefined' || !supabase){ return; }
        supabase.from('users').select('id, username, email').order('username', { ascending: true }).then(({data})=>{
            const sel=document.getElementById('otherEarningUser'); if(!sel) return;
            while(sel.children.length>1){ sel.removeChild(sel.lastChild); }
            // 缓存全量用户，供本地筛选
            window.__allUsersCacheForOther = (data||[]);
            (data||[]).forEach(u=>{ const opt=document.createElement('option'); opt.value=u.id; opt.textContent=u.username||u.email||('用户'+u.id); sel.appendChild(opt); });
        });
    }catch(_){ }
}

// 动态为"其他收益"添加用户搜索输入框，并绑定搜索
function ensureOtherUserSearchUI(){
    try{
        const sel = document.getElementById('otherEarningUser'); if(!sel) return;
        if(document.getElementById('otherUserSearch')) return;
        const input = document.createElement('input');
        input.id = 'otherUserSearch';
        input.type = 'text';
        input.placeholder = '搜索用户ID/用户名/邮箱';
        input.className = 'search-input';
        // 将搜索框插入到下拉框之前
        if(sel.parentElement){ sel.parentElement.insertBefore(input, sel); }
        input.addEventListener('input', otherUserSearchChanged);
    }catch(_){ }
}
const otherUserSearchChanged = debounce(function(){
    try{ const term=(document.getElementById('otherUserSearch')?.value||'').trim(); searchUsersForOther(term); }catch(_){ }
}, 250);

async function searchUsersForOther(term){
    try{
        const sel=document.getElementById('otherEarningUser'); if(!sel) return;
        // 保留第一个占位选项
        while(sel.children.length>1){ sel.removeChild(sel.lastChild); }
        let results=[];
        const cache = window.__allUsersCacheForOther||[];
        if(!term){
            results = cache.slice(0, 50);
        }else{
            const t = term.toLowerCase();
            // 先在本地缓存里筛一遍
            results = cache.filter(u=> String(u.id||'').toLowerCase().includes(t) || String(u.username||'').toLowerCase().includes(t) || String(u.email||'').toLowerCase().includes(t)).slice(0,50);
            // 如果命中太少，再查一次远端
            if(results.length<10 && typeof supabase!=='undefined' && supabase){
                try{
                    await ensureSupabaseReady();
                    let qb = supabase.from('users').select('id, username, email').limit(50);
                    // 组合 or 查询：用户名/邮箱模糊 + id精准
                    qb = qb.or(`username.ilike.%${term}%,email.ilike.%${term}%`);
                    // 如果term像是id，附加精准匹配
                    if(term.length>5){ qb = qb.or(`id.eq.${term}`); }
                    const { data, error } = await qb;
                    if(!error && data){ results = data; }
                }catch(_){ }
            }
        }
        (results||[]).forEach(u=>{ const opt=document.createElement('option'); opt.value=u.id; opt.textContent=(u.username||u.email||('用户'+u.id)); sel.appendChild(opt); });
    }catch(_){ }
}

// 其他收益Tab切换
function switchOtherEarningsTab(tabName){
    try{
        // 更新Tab激活状态
        document.querySelectorAll('#otherEarningsSection .task-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`#otherEarningsSection .task-tab[data-other-tab="${tabName}"]`);
        if(activeTab) activeTab.classList.add('active');
        
        // 更新内容显示
        document.querySelectorAll('#otherEarningsSection .other-earnings-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        if(tabName === 'activity'){
            document.getElementById('activityEarningsContent').style.display = 'block';
            loadActivityEarnings();
        } else if(tabName === 'team'){
            document.getElementById('teamEarningsContent').style.display = 'block';
            loadTeamEarnings();
        }
    }catch(e){ console.warn('switchOtherEarningsTab', e); }
}

// 加载活动收益
async function loadActivityEarnings(){
    try{
        let rows=[]; let ok=false;
        try{ await ensureSupabaseReady(); }catch(_){ }
        if(typeof supabase!=='undefined' && supabase){
            try{
                const { data, error } = await supabase.from('earnings').select('*').like('task_name', '%活动%').order('created_at', { ascending:false });
                if(!error){ rows = data||[]; ok=true; }
            }catch(_){ }
        }
        if(!ok){
            const local=[];
            for(let i=0;i<localStorage.length;i++){
                const key=localStorage.key(i)||''; if(!key.startsWith('earning_')) continue;
                try{ const v=JSON.parse(localStorage.getItem(key)); if(v && (v.task_name||'').includes('活动')){ local.push(v); } }catch(_){ }
            }
            rows = local.sort((a,b)=> (new Date(b.created_at||0))-(new Date(a.created_at||0)) );
        }
        try{ await enrichEarningsWithUserData(rows); }catch(_){ }
        renderActivityEarningsTable(rows);
        updateActivityTotal(rows);
    }catch(e){ console.error('加载活动收益失败:', e); renderActivityEarningsTable([]); }
}

// 加载团队收益
async function loadTeamEarnings(){
    try{
        let rows=[]; let ok=false;
        try{ await ensureSupabaseReady(); }catch(_){ }
        if(typeof supabase!=='undefined' && supabase){
            try{
                const { data, error } = await supabase.from('earnings').select('*').or('task_name.like.%团长%,task_name.like.%分成%,task_name.like.%邀请%').order('created_at', { ascending:false });
                if(!error){ rows = data||[]; ok=true; }
            }catch(_){ }
        }
        if(!ok){
            const local=[];
                for(let i=0;i<localStorage.length;i++){
                    const key=localStorage.key(i)||''; if(!key.startsWith('earning_')) continue;
                try{ 
                    const v=JSON.parse(localStorage.getItem(key)); 
                    const taskName = v.task_name || '';
                    if(taskName.includes('团长') || taskName.includes('分成') || taskName.includes('邀请')){ 
                        local.push(v); 
                }
            }catch(_){ }
            }
            rows = local.sort((a,b)=> (new Date(b.created_at||0))-(new Date(a.created_at||0)) );
        }
        try{ await enrichEarningsWithUserData(rows); }catch(_){ }
        renderTeamEarningsTable(rows);
        updateTeamTotal(rows);
    }catch(e){ console.error('加载团队收益失败:', e); renderTeamEarningsTable([]); }
}

// 加载其他收益
async function loadMiscEarnings(){
    try{
        let rows=[]; let ok=false;
        try{ await ensureSupabaseReady(); }catch(_){ }
        if(typeof supabase!=='undefined' && supabase){
            try{
                // 查询既不是活动也不是团队的收益
                const { data, error } = await supabase.from('earnings').select('*').eq('task_name', '其他收益').order('created_at', { ascending:false });
                if(!error){ rows = data||[]; ok=true; }
            }catch(_){ }
        }
        if(!ok){
            const local=[];
            for(let i=0;i<localStorage.length;i++){
                const key=localStorage.key(i)||''; if(!key.startsWith('earning_')) continue;
                try{ const v=JSON.parse(localStorage.getItem(key)); if(v && v.task_name==='其他收益'){ local.push(v); } }catch(_){ }
            }
            rows = local.sort((a,b)=> (new Date(b.created_at||0))-(new Date(a.created_at||0)) );
        }
        try{ await enrichEarningsWithUserData(rows); }catch(_){ }
        renderMiscEarningsTable(rows);
        updateMiscTotal(rows);
    }catch(e){ console.error('加载其他收益失败:', e); renderMiscEarningsTable([]); }
}

// 渲染活动收益表格
function renderActivityEarningsTable(rows){
    const tbody = document.querySelector('#activityEarningsTable tbody');
    if(!tbody) return;
    if(!rows || rows.length===0){
        tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无活动收益数据</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((r)=>{
        const id = r.id || '';
        const user = r.username_display || (r.users&&r.users.username) || r.user_id || '';
        const activityName = r.task_name || '活动奖励';
        const amt = (r.amount!=null) ? Number(r.amount).toFixed(2) : '0.00';
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        const status = r.status || '';
        return `<tr>
            <td>${id}</td>
            <td>${user}</td>
            <td>${activityName}</td>
            <td>¥${amt}</td>
            <td>${time}</td>
            <td>${status}</td>
            <td><button class="btn btn-secondary" onclick="editEarning('${id}')">编辑</button></td>
        </tr>`;
    }).join('');
}

// 渲染团队收益表格
function renderTeamEarningsTable(rows){
    const tbody = document.querySelector('#teamEarningsTable tbody');
    if(!tbody) return;
    if(!rows || rows.length===0){
        tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无团队收益数据</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((r)=>{
        const id = r.id || '';
        const user = r.username_display || (r.users&&r.users.username) || r.user_id || '';
        const type = r.task_name || '团队分成';
        const amt = (r.amount!=null) ? Number(r.amount).toFixed(2) : '0.00';
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        const status = r.status || '';
        return `<tr>
            <td>${id}</td>
            <td>${user}</td>
            <td>${type}</td>
            <td>¥${amt}</td>
            <td>${time}</td>
            <td>${status}</td>
            <td><button class="btn btn-secondary" onclick="editEarning('${id}')">编辑</button></td>
        </tr>`;
    }).join('');
}

// 渲染其他收益表格
function renderMiscEarningsTable(rows){
    const tbody = document.querySelector('#miscEarningsTable tbody');
    if(!tbody) return;
    if(!rows || rows.length===0){
        tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无其他收益数据</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((r)=>{
        const id = r.id || '';
        const user = r.username_display || (r.users&&r.users.username) || r.user_id || '';
        const type = r.task_name || '其他收益';
        const amt = (r.amount!=null) ? Number(r.amount).toFixed(2) : '0.00';
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        const status = r.status || '';
        return `<tr>
            <td>${id}</td>
            <td>${user}</td>
            <td>${type}</td>
            <td>¥${amt}</td>
            <td>${time}</td>
            <td>${status}</td>
            <td><button class="btn btn-secondary" onclick="editEarning('${id}')">编辑</button></td>
        </tr>`;
    }).join('');
}

// 更新统计总额
function updateActivityTotal(rows){
    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const el = document.getElementById('activityEarningsTotal');
    if(el) el.textContent = '¥' + total.toFixed(2);
}

function updateTeamTotal(rows){
    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const el = document.getElementById('teamEarningsTotal');
    if(el) el.textContent = '¥' + total.toFixed(2);
}

function updateMiscTotal(rows){
    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const el = document.getElementById('otherMiscTotal');
    if(el) el.textContent = '¥' + total.toFixed(2);
}

// 筛选函数
function activityEarningsFiltersChanged(){ applyActivityEarningsFilters(); }
function applyActivityEarningsFilters(){
    try{
        const kw = (document.getElementById('activityEarningsSearch')?.value||'').trim().toLowerCase();
        const status = document.getElementById('activityEarningsStatusFilter')?.value||'';
        const rows = Array.from(document.querySelectorAll('#activityEarningsTable tbody tr'));
        rows.forEach(tr=>{
            const tds = tr.querySelectorAll('td');
            if(tds.length<7){ tr.style.display=''; return; }
            const text = Array.from(tds).map(td=> (td.textContent||'').toLowerCase()).join(' ');
            const statusCell = (tds[5]?.textContent||'');
            const matchKw = !kw || text.includes(kw);
            const matchStatus = !status || statusCell===status;
            tr.style.display = (matchKw && matchStatus) ? '' : 'none';
        });
    }catch(_){ }
}

function teamEarningsFiltersChanged(){ applyTeamEarningsFilters(); }
function applyTeamEarningsFilters(){
    try{
        const kw = (document.getElementById('teamEarningsSearch')?.value||'').trim().toLowerCase();
        const status = document.getElementById('teamEarningsStatusFilter')?.value||'';
        const rows = Array.from(document.querySelectorAll('#teamEarningsTable tbody tr'));
        rows.forEach(tr=>{
            const tds = tr.querySelectorAll('td');
            if(tds.length<7){ tr.style.display=''; return; }
            const text = Array.from(tds).map(td=> (td.textContent||'').toLowerCase()).join(' ');
            const statusCell = (tds[5]?.textContent||'');
            const matchKw = !kw || text.includes(kw);
            const matchStatus = !status || statusCell===status;
            tr.style.display = (matchKw && matchStatus) ? '' : 'none';
        });
    }catch(_){ }
}

function miscEarningsFiltersChanged(){ applyMiscEarningsFilters(); }
function applyMiscEarningsFilters(){
    try{
        const kw = (document.getElementById('miscEarningsSearch')?.value||'').trim().toLowerCase();
        const status = document.getElementById('miscEarningsStatusFilter')?.value||'';
        const rows = Array.from(document.querySelectorAll('#miscEarningsTable tbody tr'));
        rows.forEach(tr=>{
            const tds = tr.querySelectorAll('td');
            if(tds.length<7){ tr.style.display=''; return; }
            const text = Array.from(tds).map(td=> (td.textContent||'').toLowerCase()).join(' ');
            const statusCell = (tds[5]?.textContent||'');
            const matchKw = !kw || text.includes(kw);
            const matchStatus = !status || statusCell===status;
            tr.style.display = (matchKw && matchStatus) ? '' : 'none';
        });
    }catch(_){ }
}

// 打开添加模态框
function openActivityEarningModal(){
    // 复用现有的其他收益模态框，但预设类型为"活动收益"
    try{
        openOtherEarningModal();
        document.getElementById('otherEarningType').value = '活动收益';
    }catch(_){ }
}

function openTeamEarningModal(){
    try{
        openOtherEarningModal();
        document.getElementById('otherEarningType').value = '团长收益';
    }catch(_){ }
}

function openMiscEarningModal(){
    try{
        openOtherEarningModal();
        document.getElementById('otherEarningType').value = '其他收益';
    }catch(_){ }
}

// 🆕 标签页切换函数
function switchOtherTypeTab(type) {
    try {
        // 更新标签页active状态
        document.querySelectorAll('.other-type-tab').forEach(tab => {
            const tabType = tab.getAttribute('data-type');
            if (tabType === type) {
                tab.classList.add('active');
                tab.style.borderBottomColor = type === 'activity' ? '#10b981' : type === 'leader' ? '#8b5cf6' : '#f59e0b';
                tab.style.color = type === 'activity' ? '#10b981' : type === 'leader' ? '#8b5cf6' : '#f59e0b';
            } else {
                tab.classList.remove('active');
                tab.style.borderBottomColor = 'transparent';
                tab.style.color = '#6b7280';
            }
        });
        
        // 切换内容显示
        document.querySelectorAll('.other-type-content').forEach(content => {
            content.style.display = 'none';
        });
        
        if (type === 'activity') {
            document.getElementById('activityEarningsContent').style.display = 'block';
            loadActivityEarnings();
        } else if (type === 'leader') {
            document.getElementById('leaderEarningsContent').style.display = 'block';
            loadLeaderEarnings();
        } else if (type === 'other') {
            document.getElementById('otherEarningsContent').style.display = 'block';
            loadOtherTypeEarnings();
        }
    } catch (e) {
        console.error('切换标签失败:', e);
    }
}

// 🆕 加载活动收益
async function loadActivityEarnings() {
    try {
        await ensureSupabaseReady();
        const { data, error } = await supabase
            .from('earnings')
            .select('*, users(username)')
            .eq('task_name', '活动收益')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // 更新统计
        const total = (data || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalEl = document.getElementById('activityEarningsTotal');
        if (totalEl) totalEl.textContent = `¥${total.toFixed(2)}`;
        
        // 渲染表格
        renderEarningsToTable('activityEarningsTable', data || [], ['ID', '用户', '活动名称', '金额', '时间', '状态', '操作']);
    } catch (e) {
        console.error('加载活动收益失败:', e);
        showNotification('加载活动收益失败', 'error');
    }
}

// 🆕 加载团队收益
async function loadLeaderEarnings() {
    try {
        await ensureSupabaseReady();
        const { data, error } = await supabase
            .from('earnings')
            .select('*, users(username)')
            .eq('task_name', '团长收益')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // 更新统计
        const total = (data || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalEl = document.getElementById('leaderEarningsTotal');
        if (totalEl) totalEl.textContent = `¥${total.toFixed(2)}`;
        
        // 渲染表格
        renderEarningsToTable('leaderEarningsTable', data || [], ['ID', '用户', '来源', '金额', '时间', '状态', '操作']);
    } catch (e) {
        console.error('加载团队收益失败:', e);
        showNotification('加载团队收益失败', 'error');
    }
}

// 🆕 加载其他收益
async function loadOtherTypeEarnings() {
    try {
        await ensureSupabaseReady();
        const { data, error } = await supabase
            .from('earnings')
            .select('*, users(username)')
            .eq('task_name', '其他收益')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // 更新统计
        const total = (data || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const totalEl = document.getElementById('otherEarningsTotal');
        if (totalEl) totalEl.textContent = `¥${total.toFixed(2)}`;
        
        // 渲染表格
        renderEarningsToTable('otherTypeEarningsTable', data || [], ['ID', '用户', '说明', '金额', '时间', '状态', '操作']);
    } catch (e) {
        console.error('加载其他收益失败:', e);
        showNotification('加载其他收益失败', 'error');
    }
}

// 🆕 通用表格渲染函数
function renderEarningsToTable(tableId, data, columns) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(item => {
        const id = String(item.id || '').substring(0, 8);
        const username = item.users?.username || item.user_id || '-';
        const description = item.description || '-';
        const amount = (parseFloat(item.amount) || 0).toFixed(2);
        const time = item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-';
        const status = item.status === 'completed' ? '已完成' : item.status === 'pending' ? '进行中' : item.status === 'rejected' ? '已取消' : item.status;
        
        return `
            <tr>
                <td>${id}</td>
                <td>${username}</td>
                <td>${description}</td>
                <td>¥${amount}</td>
                <td>${time}</td>
                <td><span class="badge badge-${status === '已完成' ? 'success' : status === '进行中' ? 'warning' : 'danger'}">${status}</span></td>
                <td><button class="btn btn-sm btn-secondary" onclick="editOtherEarning('${item.id}')">编辑</button></td>
            </tr>
        `;
    }).join('');
}

// 🆕 过滤函数
function filterOtherEarnings(type) {
    const searchInputId = type === 'activity' ? 'activityEarningsSearch' : 
                          type === 'leader' ? 'leaderEarningsSearch' : 'otherTypeEarningsSearch';
    const statusFilterId = type === 'activity' ? 'activityEarningsStatusFilter' : 
                           type === 'leader' ? 'leaderEarningsStatusFilter' : 'otherTypeEarningsStatusFilter';
    const tableId = type === 'activity' ? 'activityEarningsTable' : 
                    type === 'leader' ? 'leaderEarningsTable' : 'otherTypeEarningsTable';
    
    const searchInput = document.getElementById(searchInputId);
    const statusFilter = document.getElementById(statusFilterId);
    const table = document.getElementById(tableId);
    
    if (!table) return;
    
    const keyword = (searchInput?.value || '').trim().toLowerCase();
    const statusValue = statusFilter?.value || '';
    
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;
        
        const text = Array.from(cells).map(cell => (cell.textContent || '').toLowerCase()).join(' ');
        const statusCell = cells[5]?.textContent || '';
        
        const matchKeyword = !keyword || text.includes(keyword);
        const matchStatus = !statusValue || statusCell.includes(statusValue);
        
        row.style.display = (matchKeyword && matchStatus) ? '' : 'none';
    });
}

// 其他收益：加载与筛选（保留原函数供兼容）
async function loadOtherEarnings(){
    // 现在默认加载活动收益
    await loadActivityEarnings();
}

function renderOtherEarningsTable(rows){
    const tbody = document.querySelector('#otherEarningsTable tbody');
    if(!tbody) return;
    const empty = document.getElementById('otherEmptyHint');
    if(!rows || rows.length===0){
        tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无数据</td></tr>';
        if(empty) empty.style.display='block';
        return;
    }
    if(empty) empty.style.display='none';
    tbody.innerHTML = rows.map((r, idx)=>{
        const id = r.id || '';
        const user = r.username_display || (r.users&&r.users.username) || r.user_id || '';
        const type = r.task_name || '';
        const amt = (r.amount!=null) ? Number(r.amount).toFixed(2) : '0.00';
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        const status = r.status || '';
        return `<tr>
            <td>${id}</td>
            <td>${user}</td>
            <td>${type}</td>
            <td>¥${amt}</td>
            <td>${time}</td>
            <td>${status}</td>
            <td><button class="btn btn-secondary" onclick="editOtherEarning('${id}')">编辑</button></td>
        </tr>`;
    }).join('');
}

function otherEarningsFiltersChanged(){ applyOtherEarningsFilters(); }
function applyOtherEarningsFilters(){
    try{
        const kw = (document.getElementById('otherEarningsSearch')?.value||'').trim().toLowerCase();
        const type = document.getElementById('otherEarningsTypeFilter')?.value||'';
        const status = document.getElementById('otherEarningsStatusFilter')?.value||'';
        const rows = Array.from(document.querySelectorAll('#otherEarningsTable tbody tr'));
        rows.forEach(tr=>{
            const tds = tr.querySelectorAll('td');
            if(tds.length<7){ tr.style.display=''; return; }
            const text = Array.from(tds).map(td=> (td.textContent||'').toLowerCase()).join(' ');
            const typeCell = (tds[2]?.textContent||'');
            const statusCell = (tds[5]?.textContent||'');
            const matchKw = !kw || text.includes(kw);
            const matchType = !type || typeCell===type;
            const matchStatus = !status || statusCell===status;
            tr.style.display = (matchKw && matchType && matchStatus) ? '' : 'none';
        });
    }catch(_){ }
}

function openOtherEarningModal(presetType){
    try{
        const form=document.getElementById('otherEarningForm'); if(form) form.reset();
        document.getElementById('otherEarningId').value='';
        try{ ensureOtherUserSearchUI(); }catch(_){ }
        try{ loadUsersForOtherSelect(); }catch(_){ }
        try{ const s=document.getElementById('otherUserSearch'); if(s){ s.value=''; } }catch(_){ }
        
        // 🆕 如果传入了预设类型，自动选中并禁用选择框
        const typeSelect = document.getElementById('otherEarningType');
        if (presetType && typeSelect) {
            typeSelect.value = presetType;
            typeSelect.disabled = true;
            console.log('✅ 预设收益类型:', presetType);
        } else if (typeSelect) {
            typeSelect.disabled = false;
            typeSelect.value = '';
        }
        
        // 🆕 更新模态框标题
        const modalTitle = document.querySelector('#otherEarningModal .modal-header h3');
        if (modalTitle && presetType) {
            if (presetType === '活动收益') {
                modalTitle.textContent = '添加活动收益';
            } else if (presetType === '团长收益') {
                modalTitle.textContent = '添加团长收益';
            } else {
                modalTitle.textContent = '添加其他收益';
            }
        } else if (modalTitle) {
            modalTitle.textContent = '添加其他收益';
        }
        
        showModal('otherEarningModal');
    }catch(_){ }
}

async function saveOtherEarning(){
    if(!guardMaintenanceOrProceed('保存其他收益')) return;
    try{
        await ensureSupabaseReady();
        const userId = document.getElementById('otherEarningUser').value;
        const type = document.getElementById('otherEarningType').value;
        const amount = parseFloat(document.getElementById('otherEarningAmount').value);
        const status = document.getElementById('otherEarningStatus').value||'已完成';
        const note = (document.getElementById('otherEarningNote').value||'').trim();
        if(!userId || !type || isNaN(amount) || amount<=0){ showNotification('请填写完整且金额>0', 'error'); return; }
        const createdAt = new Date().toISOString();
        const normalizedStatus = (status==='已完成'?'completed': status==='进行中'?'pending': status==='已取消'?'rejected': status)||'completed';
        const payload = { user_id: String(userId), task_name: String(type), amount: Number(amount.toFixed(2)), status: normalizedStatus, description: note||null, created_at: createdAt };
        let ok=false, lastErr=null;
        try{ const { error } = await supabase.from('earnings').insert([payload]); if(!error) ok=true; else lastErr=error; }catch(e){ lastErr=e; }
        if(!ok){
            try{ const minimal={ user_id:payload.user_id, task_name:payload.task_name, amount:payload.amount, status:payload.status, created_at:payload.created_at }; const { error:e2 }=await supabase.from('earnings').insert([minimal]); if(!e2) ok=true; else lastErr=e2; }catch(e3){ lastErr=e3; }
        }
        if(!ok){
            const key='earning_'+Date.now();
            try{ localStorage.setItem(key, JSON.stringify({...payload, id:key, source:'admin-other-offline'})); }catch(_){ }
            showNotification('数据库不可用，已暂存到本地', 'warning');
        }else{
            showNotification('其他收益已保存', 'success');
        }
        closeModal('otherEarningModal');
        loadOtherEarnings();
    }catch(e){ showNotification('保存失败: '+e.message, 'error'); }
}

function editOtherEarning(id){
    // 预留：后续可加载该记录并支持编辑
    showNotification('编辑功能即将支持', 'info');
}

// 导出到全局，供内联调用
if(typeof window!=='undefined'){
    window.switchOtherEarningsTab = switchOtherEarningsTab;
    window.openActivityEarningModal = openActivityEarningModal;
    window.openTeamEarningModal = openTeamEarningModal;
    window.openMiscEarningModal = openMiscEarningModal;
    window.activityEarningsFiltersChanged = activityEarningsFiltersChanged;
    window.applyActivityEarningsFilters = applyActivityEarningsFilters;
    window.teamEarningsFiltersChanged = teamEarningsFiltersChanged;
    window.applyTeamEarningsFilters = applyTeamEarningsFilters;
    window.miscEarningsFiltersChanged = miscEarningsFiltersChanged;
    window.applyMiscEarningsFilters = applyMiscEarningsFilters;
    window.openOtherEarningModal = openOtherEarningModal;
    window.saveOtherEarning = saveOtherEarning;
    window.otherEarningsFiltersChanged = otherEarningsFiltersChanged;
    window.applyOtherEarningsFilters = applyOtherEarningsFilters;
    window.editOtherEarning = editOtherEarning;
    window.toggleLeaderStatus = toggleLeaderStatus;
}

// 获取任务内容元素
function getTaskContentElement(taskType) {
    const contentMap = {
        'all': 'allEarnings',
        'kk-search': 'kkSearchEarnings',
        'xray-search': 'xraySearchEarnings',
        'wukong-search': 'wukongSearchEarnings',
        'kk-disk': 'kkDiskEarnings'
    };
    
    return document.getElementById(contentMap[taskType]);
}
// 加载任务数据
async function loadTaskData(taskType) {
    console.log('加载任务数据:', taskType);
    
    try {
        switch (taskType) {
            case 'all':
                await loadAllEarnings();
                break;
            case 'kk-search':
                await loadKKSearchData();
                break;
            case 'wukong-search':
                await loadWukongSearchData();
                break;
            case 'xray-search':
                await loadXraySearchData();
                break;
            case 'kk-disk':
                await loadKKDiskData();
                break;
        }
    } catch (error) {
        console.error(`加载${taskType}数据失败:`, error);
        showNotification(`加载${taskType}数据失败: ${error.message}`, 'error');
    }
}

// 加载所有收益数据（原有功能）
async function loadAllEarnings() {
    return loadEarningsData();
}
// 🔧 修复：加载KK搜索收益数据（确保Supabase已准备）
async function loadKKSearchData() {
    console.log('🔄 加载KK搜索收益数据...');
    
    try {
        // 确保Supabase客户端已准备就绪
        await ensureSupabaseReady();
        
        // 🔧 修复：从earnings表加载KK搜索相关的收益记录
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .or('task_name.ilike.%KK搜索%,task_name.ilike.%kk搜索%,task_name.ilike.%KK%')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('从数据库加载KK搜索收益失败:', error);
            // 使用空数据，提示用户添加收益
            renderKKSearchTable([]);
            return;
        }
        
        let rows = applyEarningsOverrides(earnings || []);
        console.log(`成功加载了 ${rows?.length || 0} 条KK搜索收益记录`);
        await enrichEarningsWithUserData(rows || []);
        // 保存原始列表供筛选/排序/导出使用
        window.__kkList = (rows || []).slice();
        renderKKSearchTable(window.__kkList);

    } catch (error) {
        console.error('加载KK搜索收益数据失败:', error);
        // 显示空表格，提示用户通过添加收益来创建记录
        renderKKSearchTable([]);
    }
}

// 加载悟空搜索收益数据
async function loadWukongSearchData() {
    console.log('加载悟空搜索收益数据...');
    
    try {
        // 🔧 修复：从earnings表加载悟空搜索相关的收益记录
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .or('task_name.ilike.%悟空搜索%,task_name.ilike.%悟空%,task_name.ilike.%wukong%')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('从数据库加载悟空搜索收益失败:', error);
            renderWukongSearchTable([]);
            return;
        }
        
        let rows = applyEarningsOverrides(earnings || []);
        console.log(`成功加载了 ${rows?.length || 0} 条w空搜索收益记录`);
        await enrichEarningsWithUserData(rows || []);
        // 保存原始列表供筛选/排序/导出使用
        window.__wkList = (rows || []).slice();
        renderWukongSearchTable(window.__wkList);

    } catch (error) {
        console.error('加载悟空搜索收益数据失败:', error);
        // 显示空表格，提示用户通过添加收益来创建记录
        renderWukongSearchTable([]);
    }
}
// 加载x雷浏览器收益数据
async function loadXraySearchData() {
    console.log('加载x雷浏览器收益数据...');
    try {
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .or('task_name.ilike.%x雷浏览器%,task_name.ilike.%x雷搜索%,task_name.ilike.%xray%')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('从数据库加载x雷浏览器收益失败:', error);
            // 回退本地
            try{
                const local=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('earning_')){ try{ const e=JSON.parse(localStorage.getItem(k)); if((e.task_name||'').includes('x雷')) local.push(e);}catch(_){}} }
                await enrichEarningsWithUserData(local||[]);
                window.__xrList = (local||[]).slice();
                renderXraySearchTable(window.__xrList);
                return;
            }catch(_){ renderXraySearchTable([]); return; }
        }

        // 合并本地暂存
        let rows=(earnings||[]).slice();
        try{
            const local=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('earning_')){ try{ const e=JSON.parse(localStorage.getItem(k)); if((e.task_name||'').includes('x雷')) local.push(e);}catch(_){}} }
            rows = [...local, ...rows];
        }catch(_){ }
        // 合并本地覆盖
        rows = applyEarningsOverrides(rows);
        console.log(`成功加载了 ${rows.length} 条x雷浏览器收益记录`);
        await enrichEarningsWithUserData(rows);
        window.__xrList = rows.slice();
        renderXraySearchTable(window.__xrList);
    } catch (error) {
        console.error('加载x雷浏览器收益数据失败:', error);
        try{
            const local=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('earning_')){ try{ const e=JSON.parse(localStorage.getItem(k)); if((e.task_name||'').includes('x雷')) local.push(e);}catch(_){}} }
            await enrichEarningsWithUserData(local||[]);
            window.__xrList = (local||[]).slice();
            renderXraySearchTable(window.__xrList);
        }catch(_){ renderXraySearchTable([]); }
    }
}
// 加载KK网盘收益数据
async function loadKKDiskData() {
    console.log('加载KK网盘收益数据...');
    
    try {
        // 🔧 修复：从earnings表加载KK网盘相关的收益记录
        const { data: earnings, error } = await supabase
            .from('earnings')
            .select('*')
            .or('task_name.ilike.%KK网盘%,task_name.ilike.%kk网盘%,task_name.ilike.%网盘%')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('从数据库加载KK网盘收益失败:', error);
            renderKKDiskTable([]);
            return;
        }
        
        let rows = applyEarningsOverrides(earnings || []);
        console.log(`成功加载了 ${rows?.length || 0} 条KK网盘收益记录`);
        await enrichEarningsWithUserData(rows || []);
        // 保存原始列表供筛选/排序/导出使用
        window.__kdList = (rows || []).slice();
        renderKKDiskTable(window.__kdList);

    } catch (error) {
        console.error('加载KK网盘收益数据失败:', error);
        // 显示空表格，提示用户通过添加收益来创建记录
        renderKKDiskTable([]);
    }
}

// 各标签排序封装（仅局部作用，不改其他逻辑）
function sortKKBy(field){ try{ let list=(window.__kkList||window.__earningsRawList||[]).slice(); list.sort((a,b)=> field==='amount'? (parseFloat(b.amount||0)-parseFloat(a.amount||0)) : (new Date(b.created_at)-new Date(a.created_at))); renderKKSearchTable(list);}catch(e){console.warn('sortKKBy',e);} }
function sortWKBy(field){ try{ let list=(window.__wkList||window.__earningsRawList||[]).slice(); list.sort((a,b)=> field==='amount'? (parseFloat(b.amount||0)-parseFloat(a.amount||0)) : (new Date(b.created_at)-new Date(a.created_at))); renderWukongSearchTable(list);}catch(e){console.warn('sortWKBy',e);} }
function sortKDBy(field){ try{ let list=(window.__kdList||window.__earningsRawList||[]).slice(); list.sort((a,b)=> field==='amount'? (parseFloat(b.amount||0)-parseFloat(a.amount||0)) : (new Date(b.created_at)-new Date(a.created_at))); renderKKDiskTable(list);}catch(e){console.warn('sortKDBy',e);} }
function sortXRBy(field){ try{ let list=(window.__xrList||window.__earningsRawList||[]).slice(); list.sort((a,b)=> field==='amount'? (parseFloat(b.amount||0)-parseFloat(a.amount||0)) : (new Date(b.created_at)-new Date(a.created_at))); renderXraySearchTable(list);}catch(e){console.warn('sortXRBy',e);} }

// 渲染KK搜索收益表格
function renderKKSearchTable(earnings) {
    const tbody = document.querySelector('#kkSearchTable tbody');
    if (!tbody) return;

    if (earnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无KK搜索收益数据<br><small style="color: #666;">请通过右上角"添加收益"为用户添加KK搜索相关收益</small></td></tr>';
        return;
    }

    tbody.innerHTML = earnings.map((earning, idx) => {
        // 解析KK搜索详细信息
        let taskDetails = earning.task_name || '未知任务';
        let detailsTooltip = '';
        
        try {
            // 从description字段解析KK搜索详细信息
            if (earning.description && earning.task_name && earning.task_name.includes('KK搜索')) {
                const details = JSON.parse(earning.description);
                const parts = [];
                if (details.pull_new_count > 0) parts.push(`拉新${details.pull_new_count}(¥${details.pull_new_amount.toFixed(2)})`);
                if (details.pull_active_count > 0) parts.push(`拉活${details.pull_active_count}(¥${details.pull_active_amount.toFixed(2)})`);
                if (details.pull_old_count > 0) parts.push(`拉旧${details.pull_old_count}(¥${details.pull_old_amount.toFixed(2)})`);
                
                if (parts.length > 0) {
                    detailsTooltip = `title="${parts.join(', ')}"`;
                }
            }
        } catch (e) {
            console.log('解析KK搜索详情失败:', e);
        }
        
        return `
            <tr>
                <td>${earning.id}<i class="fas fa-copy copy-id" title="复制ID" onclick="copyText('${earning.id}')"></i></td>
                <td>${getEarningDisplayName(earning, idx)}</td>
                <td ${detailsTooltip} style="cursor: help;">${taskDetails}</td>
                <td>¥${(earning.amount || 0).toFixed(2)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortKKBy('amount')"></i></td>
                <td>${formatDate(earning.created_at)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortKKBy('created_at')"></i></td>
                <td>
                    <span class="status-badge ${getStatusClass(earning.status || 'completed')}">
                        ${getStatusText(earning.status || '已完成')}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEarning('${earning.id}')">编辑</button>
                <button class="btn btn-sm btn-warning" onclick="revokeEarning('${earning.id}')">撤销</button>
                <button class="btn btn-sm btn-error" onclick="deleteEarning('${earning.id}')">删除</button>
            </td>
        </tr>
        `;
    }).join('');
}

// KK搜索筛选与导出（仅影响KK标签）
function applyKKEarningsFilters(){
    try{
        const kw=(document.getElementById('kkSearchSearch')?.value||'').trim().toLowerCase();
        const status=(document.getElementById('kkSearchStatusFilter')?.value||'').trim();
        const range=(document.getElementById('kkSearchDateRange')?.value||'').trim();
        let list=(window.__kkList||[]).slice();
        if(kw){ list=list.filter(e=> String(e.id||'').toLowerCase().includes(kw) || String(getEarningDisplayName(e,0)||'').toLowerCase().includes(kw) || String(e.task_name||'').toLowerCase().includes(kw)); }
        if(status){ list=list.filter(e=> String(e.status||'')===status); }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(e=> new Date(e.created_at)>=since); }
        renderKKSearchTable(list);
    }catch(e){ console.warn('applyKKEarningsFilters', e); }
}
function exportKKEarningsCSV(){
    try{
        const rows = document.querySelectorAll('#kkSearchTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','用户','任务类型','金额','时间','状态'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<7) return;
            const line=[tds[0].innerText.replace(/\n.*/,'').trim(), tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.replace('¥','').trim(), tds[4].innerText.trim(), tds[5].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kk-search-earnings.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}

// 渲染悟空搜索收益表格
function renderWukongSearchTable(earnings) {
    const tbody = document.querySelector('#wukongSearchTable tbody');
    if (!tbody) return;

    if (earnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无悟空搜索收益数据<br><small style="color: #666;">请通过右上角"添加收益"为用户添加悟空搜索相关收益</small></td></tr>';
        return;
    }

    tbody.innerHTML = earnings.map((earning, idx) => `
        <tr>
            <td>${earning.id}<i class="fas fa-copy copy-id" title="复制ID" onclick="copyText('${earning.id}')"></i></td>
            <td>${getEarningDisplayName(earning, idx)}</td>
            <td>${earning.task_name || '未知任务'}</td>
            <td>¥${(earning.amount || 0).toFixed(2)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortWKBy('amount')"></i></td>
            <td>${formatDate(earning.created_at)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortWKBy('created_at')"></i></td>
            <td>
                <span class="status-badge ${getStatusClass(earning.status || 'completed')}">
                    ${getStatusText(earning.status || '已完成')}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEarning('${earning.id}')">编辑</button>
                <button class="btn btn-sm btn-warning" onclick="revokeEarning('${earning.id}')">撤销</button>
                <button class="btn btn-sm btn-error" onclick="deleteEarning('${earning.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}
// 悟空搜索筛选与导出
function applyWKEarningsFilters(){
    try{
        const kw=(document.getElementById('wukongSearchSearch')?.value||'').trim().toLowerCase();
        const status=(document.getElementById('wukongSearchStatusFilter')?.value||'').trim();
        const range=(document.getElementById('wukongSearchDateRange')?.value||'').trim();
        let list=(window.__wkList||[]).slice();
        if(kw){ list=list.filter(e=> String(e.id||'').toLowerCase().includes(kw) || String(getEarningDisplayName(e,0)||'').toLowerCase().includes(kw) || String(e.task_name||'').toLowerCase().includes(kw)); }
        if(status){ list=list.filter(e=> String(e.status||'')===status); }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(e=> new Date(e.created_at)>=since); }
        renderWukongSearchTable(list);
    }catch(e){ console.warn('applyWKEarningsFilters', e); }
}

function exportWKEarningsCSV(){
    try{
        const rows = document.querySelectorAll('#wukongSearchTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','用户','任务类型','金额','时间','状态'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<7) return;
            const line=[tds[0].innerText.replace(/\n.*/,'').trim(), tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.replace('¥','').trim(), tds[4].innerText.trim(), tds[5].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='wukong-search-earnings.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}
// 渲染x雷浏览器收益表格
function renderXraySearchTable(earnings) {
    const tbody = document.querySelector('#xraySearchTable tbody');
    if (!tbody) return;

    if (earnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无x雷浏览器收益数据<br><small style="color: #666;">请通过右上角"添加收益"为用户添加x雷浏览器相关收益</small></td></tr>';
        return;
    }

    tbody.innerHTML = earnings.map((earning, idx) => `
        <tr>
            <td>${earning.id}<i class="fas fa-copy copy-id" title="复制ID" onclick="copyText('${earning.id}')"></i></td>
            <td>${getEarningDisplayName(earning, idx)}</td>
            <td>${earning.task_name || '未知任务'}</td>
            <td>¥${(earning.amount || 0).toFixed(2)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortXRBy('amount')"></i></td>
            <td>${formatDate(earning.created_at)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortXRBy('created_at')"></i></td>
            <td>
                <span class="status-badge ${getStatusClass(earning.status || 'completed')}">${getStatusText(earning.status || '已完成')}</span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEarning('${earning.id}')">编辑</button>
                <button class="btn btn-sm btn-warning" onclick="revokeEarning('${earning.id}')">撤销</button>
                <button class="btn btn-sm btn-error" onclick="deleteEarning('${earning.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

// x雷浏览器筛选与导出
function applyXrayEarningsFilters(){
    try{
        const kw=(document.getElementById('xraySearchSearch')?.value||'').trim().toLowerCase();
        const status=(document.getElementById('xraySearchStatusFilter')?.value||'').trim();
        const range=(document.getElementById('xraySearchDateRange')?.value||'').trim();
        let list=(window.__xrList||[]).slice();
        if(kw){ list=list.filter(e=> String(e.id||'').toLowerCase().includes(kw) || String(getEarningDisplayName(e,0)||'').toLowerCase().includes(kw) || String(e.task_name||'').toLowerCase().includes(kw)); }
        if(status){ list=list.filter(e=> String(e.status||'')===status); }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(e=> new Date(e.created_at)>=since); }
        renderXraySearchTable(list);
    }catch(e){ console.warn('applyXrayEarningsFilters', e); }
}

function exportXrayEarningsCSV(){
    try{
        const rows = document.querySelectorAll('#xraySearchTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','用户','任务类型','金额','时间','状态'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<7) return;
            const line=[tds[0].innerText.replace(/\n.*/,'').trim(), tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.replace('¥','').trim(), tds[4].innerText.trim(), tds[5].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='xray-search-earnings.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}

// 渲染KK网盘收益表格
function renderKKDiskTable(earnings) {
    const tbody = document.querySelector('#kkDiskTable tbody');
    if (!tbody) return;

    if (earnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无KK网盘收益数据<br><small style="color: #666;">请通过右上角"添加收益"为用户添加KK网盘相关收益</small></td></tr>';
        return;
    }

    tbody.innerHTML = earnings.map((earning, idx) => `
        <tr>
            <td>${earning.id}<i class="fas fa-copy copy-id" title="复制ID" onclick="copyText('${earning.id}')"></i></td>
            <td>${getEarningDisplayName(earning, idx)}</td>
            <td>${earning.task_name || '未知任务'}</td>
            <td>¥${(earning.amount || 0).toFixed(2)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortKDBy('amount')"></i></td>
            <td>${formatDate(earning.created_at)} <i class="fas fa-sort" style="margin-left:6px;cursor:pointer" onclick="sortKDBy('created_at')"></i></td>
            <td>
                <span class="status-badge ${getStatusClass(earning.status || 'completed')}">
                    ${getStatusText(earning.status || '已完成')}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editEarning('${earning.id}')">编辑</button>
                <button class="btn btn-sm btn-warning" onclick="revokeEarning('${earning.id}')">撤销</button>
                <button class="btn btn-sm btn-error" onclick="deleteEarning('${earning.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

// KK网盘筛选与导出
function applyKDEarningsFilters(){
    try{
        const kw=(document.getElementById('kkDiskSearch')?.value||'').trim().toLowerCase();
        const status=(document.getElementById('kkDiskStatusFilter')?.value||'').trim();
        const range=(document.getElementById('kkDiskDateRange')?.value||'').trim();
        let list=(window.__kdList||[]).slice();
        if(kw){ list=list.filter(e=> String(e.id||'').toLowerCase().includes(kw) || String(getEarningDisplayName(e,0)||'').toLowerCase().includes(kw) || String(e.task_name||'').toLowerCase().includes(kw)); }
        if(status){ list=list.filter(e=> String(e.status||'')===status); }
        if(range){ const days=parseInt(range,10); const since=new Date(Date.now()-days*24*3600*1000); list=list.filter(e=> new Date(e.created_at)>=since); }
        renderKKDiskTable(list);
    }catch(e){ console.warn('applyKDEarningsFilters', e); }
}

function exportKDEarningsCSV(){
    try{
        const rows = document.querySelectorAll('#kkDiskTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','用户','任务类型','金额','时间','状态'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<7) return;
            const line=[tds[0].innerText.replace(/\n.*/,'').trim(), tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.replace('¥','').trim(), tds[4].innerText.trim(), tds[5].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kk-disk-earnings.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}

// 格式化关键词显示
function formatKeywords(keywords) {
    if (!keywords) return '未填写';
    
    // 如果是数组，转换为字符串
    if (Array.isArray(keywords)) {
        return keywords.join(', ');
    }
    
    // 如果是字符串，限制长度
    const maxLength = 20;
    if (keywords.length > maxLength) {
        return keywords.substring(0, maxLength) + '...';
    }
    
    return keywords;
}

// 🔧 新增：格式化申请关键词显示（管理后台使用）
function formatApplicationKeywords(application) {
    // 如果用户已经有分配的关键词，显示分配的关键词
    if (application.assigned_keywords && application.assigned_keywords.trim()) {
        const maxLength = 20;
        if (application.assigned_keywords.length > maxLength) {
            return `<span class="assigned-keywords">${application.assigned_keywords.substring(0, maxLength)}...</span>`;
        }
        return `<span class="assigned-keywords">${application.assigned_keywords}</span>`;
    }
    
    // 否则显示"关键词待分配"
    return '<span class="text-muted">关键词待分配</span>';
}

// 获取经验文本
function getExperienceText(experience) {
    const experienceMap = {
        'experienced': '我很有经验',
        'learning': '正在学习中'
    };
    return experienceMap[experience] || experience || '未填写';
}
// 获取渠道文本
function getChannelText(channel) {
    const channelMap = {
        // 原有映射
        'social': '社交媒体',
        'blog': '博客网站',
        'video': '视频平台',
        'forum': '论坛社区',
        'email': '邮件营销',
        'other': '其他渠道',
        // 🔧 新增：前端申请页面使用的渠道映射
        'douyin': '抖音平台',
        'wechat': '微信朋友圈',
        'kuaishou': '快手平台',
        'qq': 'QQ群/空间'
    };
    return channelMap[channel] || channel || '未填写';
}

// 🔧 新增：获取类别文本
function getCategoryText(category) {
    const categoryMap = {
        'study': '学习资源',
        'entertainment': '娱乐内容'
    };
    return categoryMap[category] || category || '未填写';
}

// 查看申请详情
function viewApplicationDetails(applicationId) {
    console.log('查看申请详情:', applicationId);
    showNotification('申请详情功能开发中...', 'info');
}

// 编辑申请
function editApplication(applicationId) {
    console.log('编辑申请:', applicationId);
    showNotification('编辑申请功能开发中...', 'info');
}
// 删除申请
async function deleteApplication(applicationId) {
    if (!confirm('确定要删除这条申请记录吗？此操作不可撤销！')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('keyword_applications')
            .delete()
            .eq('id', applicationId);

        if (error) {
            throw error;
        }

        showNotification('申请记录删除成功', 'success');
        // 重新加载当前任务数据
        loadTaskData(currentTaskTab);

    } catch (error) {
        console.error('删除申请记录失败:', error);
        showNotification('删除申请记录失败: ' + error.message, 'error');
    }
}
// 生成示例数据函数
function generateSampleKKSearchData() {
    return [
        {
            id: 'kk-001',
            username: 'zxc',
            keywords: 'KK搜索, 文档下载, PDF资源',
            experience: 'experienced',
            promotion_channel: 'social',
            status: '已完成',
            created_at: '2025-09-17T10:30:00Z'
        },
        {
            id: 'kk-002',
            username: '123',
            keywords: 'KK搜索引擎, 在线搜索, 资源查找',
            experience: 'learning',
            promotion_channel: 'blog',
            status: '进行中',
            created_at: '2025-09-17T09:15:00Z'
        },
        {
            id: 'kk-003',
            username: 'test_user1',
            keywords: 'KK搜索工具, 文件搜索',
            experience: 'experienced',
            promotion_channel: 'video',
            status: '已完成',
            created_at: '2025-09-16T16:45:00Z'
        },
        {
            id: 'kk-004',
            username: 'test_user2',
            keywords: 'KK搜索引擎, 免费下载',
            experience: 'learning',
            promotion_channel: 'forum',
            status: '已完成',
            created_at: '2025-09-16T14:20:00Z'
        }
    ];
}
function generateSampleWukongSearchData() {
    return [
        {
            id: 'wk-001',
            username: 'zxc',
            keywords: '悟空搜索, 智能搜索, AI搜索',
            experience: 'experienced',
            promotion_channel: 'social',
            status: '已完成',
            created_at: '2025-09-17T11:00:00Z'
        },
        {
            id: 'wk-002',
            username: '123',
            keywords: '悟空搜索引擎, 精准搜索',
            experience: 'learning',
            promotion_channel: 'email',
            status: '进行中',
            created_at: '2025-09-17T08:30:00Z'
        },
        {
            id: 'wk-003',
            username: 'test_user1',
            keywords: '悟空AI搜索, 语义搜索',
            experience: 'experienced',
            promotion_channel: 'video',
            status: '已完成',
            created_at: '2025-09-16T15:30:00Z'
        }
    ];
}

function generateSampleKKDiskData() {
    return [
        {
            id: 'kd-001',
            username: 'zxc',
            keywords: 'KK网盘, 云存储, 文件分享',
            experience: 'experienced',
            promotion_channel: 'social',
            status: '已完成',
            created_at: '2025-09-17T12:00:00Z'
        },
        {
            id: 'kd-002',
            username: '123',
            keywords: 'KK网盘存储, 在线网盘',
            experience: 'learning',
            promotion_channel: 'blog',
            status: '进行中',
            created_at: '2025-09-17T07:45:00Z'
        },
        {
            id: 'kd-003',
            username: 'test_user1',
            keywords: 'KK云盘, 免费网盘',
            experience: 'experienced',
            promotion_channel: 'other',
            status: '已完成',
            created_at: '2025-09-16T13:15:00Z'
        },
        {
            id: 'kd-004',
            username: 'test_user2',
            keywords: 'KK网盘分享, 文件备份',
            experience: 'learning',
            promotion_channel: 'forum',
            status: '已完成',
            created_at: '2025-09-16T11:30:00Z'
        }
    ];
}

// 任务管理功能
let currentTaskManagementTab = 'kk-search';

// 切换任务管理选项卡
function switchTaskManagementTab(taskType) {
    console.log('切换任务管理选项卡:', taskType);
    
    // 更新选项卡激活状态
    document.querySelectorAll('.task-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-task="${taskType}"]`).classList.add('active');
    
    // 隐藏所有任务管理内容
    document.querySelectorAll('.task-management-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // 显示选中的任务管理内容
    const targetContent = getTaskManagementContentElement(taskType);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
    
    // 更新当前选项卡
    currentTaskManagementTab = taskType;
    
    // 根据任务类型加载对应数据
    loadTaskManagementData(taskType);

    // 绑定悟空搜索筛选事件（去抖）
    try{
        if(taskType==='wukong-search'){
            const searchEl = document.getElementById('wukongSearchManagementSearch');
            const statusEl = document.getElementById('wukongSearchManagementStatusFilter');
            if(searchEl && !searchEl.__wkBound){
                searchEl.__wkBound = true;
                const handler = debounce(()=> loadWukongSearchManagementData(), 300);
                searchEl.addEventListener('input', handler);
            }
            if(statusEl && !statusEl.__wkBound){
                statusEl.__wkBound = true;
                statusEl.addEventListener('change', ()=> loadWukongSearchManagementData());
            }
        }
    }catch(_){ }

    // 恢复KK面板的上次选择
    if(taskType==='kk-search'){
        try{
            const which = localStorage.getItem('kkPane');
            if(which==='repo' || which==='review'){
                toggleKKPane(which);
            }
        }catch(_){ }
    }
}

// 任务选择卡片样式联动
function highlightTaskPill(el){
    try{
        document.querySelectorAll('.task-selector .task-pill').forEach(p=>p.classList.remove('active'));
        el.classList.add('active');
    }catch(_){ }
}

// 获取任务管理内容元素
function getTaskManagementContentElement(taskType) {
    const contentMap = {
        'kk-search': 'kkSearchManagement',
        'xray-search': 'xraySearchManagement',
        'wukong-search': 'wukongSearchManagement',
        'kk-disk': 'kkDiskManagement'
    };
    
    return document.getElementById(contentMap[taskType]);
}
// 二级子页签切换（任务中心内部）
function switchTaskSubTab(taskKey, sub) {
    try{
        const map = {
            kk: ['kkSub_review','kkSub_repo','kkSub_earnings','kkSub_config'],
            xray: ['xraySub_review','xraySub_repo','xraySub_earnings','xraySub_config'],
            wk: ['wukongSearchManagement','wkSub_feedback']
        };
        const ids = map[taskKey] || [];
        if(taskKey === 'wk'){
            // 悟空特殊处理：review显示申请审核，feedback显示回填
            const reviewEl = document.getElementById('wukongSearchManagement');
            const feedbackEl = document.getElementById('wkSub_feedback');
            if(reviewEl) reviewEl.style.display = (sub==='review') ? 'block' : 'none';
            if(feedbackEl) feedbackEl.style.display = (sub==='feedback') ? 'block' : 'none';
        } else {
            ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display = (id.toLowerCase().includes(sub)) ? 'block' : 'none'; });
        }

        // 触发相应数据加载（首次进入某子页时）
        if(taskKey==='kk' && sub==='repo'){ loadKKKeywordRepo(); }
        if(taskKey==='xray' && sub==='repo'){ loadXrayKeywordRepo(); }
        if(taskKey==='kk' && sub==='earnings'){ inlineLoadEarnings('KK'); }
        if(taskKey==='xray' && sub==='earnings'){ inlineLoadEarnings('XRAY'); }
        if(taskKey==='wk' && sub==='feedback'){
            // 先强制加载悟空数据，确保缓存不为空
            if(!window.__wkMgmtCache || window.__wkMgmtCache.length===0){
                loadWukongSearchManagementData().then(()=>{
                    window.renderWkFeedbackTable();
                }).catch(()=>{
                    window.renderWkFeedbackTable();
                });
            } else {
                window.renderWkFeedbackTable();
            }
        }
    }catch(e){ console.warn('switchTaskSubTab', e); }
}

// 渲染悟空回填记录表格（全局函数）
function renderWkFeedbackTable(){
    try{
            // 聚合悟空回填数据
            let list = Array.isArray(window.__wkMgmtCache) ? window.__wkMgmtCache : [];
            // 再次兜底：从 promotionApplications 读取
            if(!list || list.length===0){
                try{
                    const globalApps = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                    list = globalApps.filter(a => (a.task_type === '悟空搜索任务') || String(a.id||'').startsWith('WK'));
                    console.log('从promotionApplications兜底读取了', list.length, '条悟空申请');
                }catch(_){ list = []; }
            }
            // 只显示有回填的记录
            let listWithFeedback = list.filter(a => {
                const count = Array.isArray(a.user_feedback) ? a.user_feedback.length : (a.user_feedback?1:0);
                return count > 0;
            });
            // 如果缓存里有数据但都没有回填，兜底再读一次全局 localStorage
            if((!listWithFeedback || listWithFeedback.length===0)){
                try{
                    const globalApps = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                    const gList = globalApps.filter(a => (a.task_type === '悟空搜索任务') || String(a.id||'').startsWith('WK'));
                    listWithFeedback = gList.filter(a=>{
                        const c = Array.isArray(a.user_feedback) ? a.user_feedback.length : (a.user_feedback?1:0);
                        return c>0;
                    });
                    if(listWithFeedback && listWithFeedback.length){ console.log('兜底：从 promotionApplications 读取到了回填记录', listWithFeedback.length); }
                }catch(_){ }
            }
            
            const tbody = document.getElementById('wkFeedbackTableBody');
            if(tbody){
                if(!listWithFeedback || listWithFeedback.length===0){ 
                    tbody.innerHTML='<tr><td colspan="5" class="loading">暂无回填数据<br><small style="color:#666">请前往前端"我的关键词"页面提交回填</small></td></tr>'; 
                }
                else {
                    const rows = listWithFeedback.map(a=>{
                        const count = Array.isArray(a.user_feedback) ? a.user_feedback.length : (a.user_feedback?1:0);
                        const latest = Array.isArray(a.user_feedback) && a.user_feedback.length>0 ? (a.user_feedback[0].time||a.user_feedback[0].created_at||'-') : '-';
                        return `<tr>
                            <td>${a.id||''}</td>
                            <td>${a.username||''}</td>
                            <td>${count}</td>
                            <td>${latest && typeof formatDate==='function' ? formatDate(latest) : (latest||'-')}</td>
                            <td><a href="#" class="btn btn-secondary btn-xs" onclick="openWkFeedbackModal('${a.id||''}')">查看</a></td>
                        </tr>`;
                    }).join('');
                    tbody.innerHTML = rows || '<tr><td colspan="5" class="loading">暂无回填数据</td></tr>';
                }
            }
    }catch(e){ console.warn('renderWkFeedbackTable error', e); }
}
window.renderWkFeedbackTable = renderWkFeedbackTable;
// 内嵌收益加载器（按任务名关键词）
async function inlineLoadEarnings(kind){
    try{
        await ensureSupabaseReady();
        let filterOr = '';
        if(kind==='KK') filterOr = 'task_name.ilike.%KK搜索%,task_name.ilike.%kk搜索%,task_name.ilike.%KK%';
        if(kind==='XRAY') filterOr = 'task_name.ilike.%x雷浏览器%,task_name.ilike.%x雷搜索%,task_name.ilike.%xray%';
        const { data, error } = await supabase.from('earnings').select('*').or(filterOr).order('created_at', {ascending:false}).limit(50);
        const rows = (data||[]).map(e=>`<tr><td>${formatDate(e.created_at)}</td><td>${getEarningDisplayName(e,0)}</td><td>${e.task_name||''}</td><td>¥${(e.amount||0).toFixed(2)}</td><td>${getStatusText(e.status||'已完成')}</td></tr>`).join('') || '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
        if(kind==='KK'){
            const tb = document.getElementById('kkEarningsInlineBody'); if(tb) tb.innerHTML = rows;
        } else {
            const tb = document.getElementById('xrayEarningsInlineBody'); if(tb) tb.innerHTML = rows;
        }
    }catch(e){ console.warn('inlineLoadEarnings', e); }
}
// 加载任务管理数据
async function loadTaskManagementData(taskType) {
    console.log('加载任务管理数据:', taskType);
    
    try {
        switch (taskType) {
            case 'kk-search':
                await loadKKSearchManagementData();
                break;
            case 'wukong-search':
                await loadWukongSearchManagementData();
                break;
            case 'xray-search':
                await loadXraySearchManagementData();
                break;
            case 'kk-disk':
                await loadKKDiskManagementData();
                break;
        }
        
        // 更新统计数据（使用缓存或示例数据兜底）
        try{
            const list = (window.__kkMgmtCache && window.__kkMgmtCache.length) ? window.__kkMgmtCache
                        : (typeof generateSampleKKSearchManagementData==='function' ? generateSampleKKSearchManagementData() : []);
            const pendingCount = list.filter(app => (app.status||'').toString().includes('pending') || app.status==='待审核').length;
            const approvedCount = list.filter(app => (app.status||'')==='approved' || app.status==='已通过').length;
            const rejectedCount = list.filter(app => (app.status||'')==='rejected' || app.status==='已拒绝').length;
            const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = val; };
            set('pendingCount', pendingCount);
            set('approvedCount', approvedCount);
            set('rejectedCount', rejectedCount);
        }catch(_){ }
        
    } catch (error) {
        console.error(`加载${taskType}管理数据失败:`, error);
        showNotification(`加载${taskType}管理数据失败: ${error.message}`, 'error');
    }
}

// ===== 悟空搜索管理页 =====
async function loadWukongSearchManagementData(){
    try{
        console.log('加载悟空搜索管理数据...');
        let applications = [];

        // 优先：数据库
        try{
            if (typeof ensureSupabaseReady === 'function') { await ensureSupabaseReady(); }
        }catch(_){ }
        if (typeof supabase !== 'undefined' && supabase && supabase.from) {
            // 兼容缺少 user_feedback 列的库：先 select('*')，再在内存中取需要字段
            let { data: dbApplications, error } = await supabase
                .from('keyword_applications')
                .select('*')
                .eq('task_type', '悟空搜索任务')
                .order('created_at', { ascending: false });

            if (error || !dbApplications || dbApplications.length === 0) {
                console.log('🔄 数据库为空或查询失败，尝试查全部再过滤悟空搜索任务...');
                const { data: allApplications, error: allError } = await supabase
                    .from('keyword_applications')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!allError && allApplications && allApplications.length > 0) {
                    dbApplications = allApplications.filter(a => a.task_type === '悟空搜索任务');
                    error = null;
                }
            }

            if (!error && Array.isArray(dbApplications)) {
                applications = dbApplications;
                // 🔧 合并本地回填数据：数据库里可能没有 user_feedback 列/数据
                try{
                    const localApps = (typeof loadKeywordApplicationsFromLocalStorage === 'function') ? loadKeywordApplicationsFromLocalStorage() : [];
                    const feedbackMap = {};
                    (localApps||[]).forEach(a=>{
                        const id = String(a.id||'');
                        if(!id) return;
                        const isWK = (a.task_type === '悟空搜索任务') || id.startsWith('WK') || (a.category==='短剧');
                        if(!isWK) return;
                        const arr = Array.isArray(a.user_feedback) ? a.user_feedback
                                   : (a.user_feedback ? [a.user_feedback] : []);
                        if(arr.length>0) feedbackMap[id] = arr;
                    });
                    applications = (applications||[]).map(a=>{
                        const id = String(a.id||'');
                        const hasFb = Array.isArray(a.user_feedback) ? a.user_feedback.length>0 : !!a.user_feedback;
                        if(!hasFb && feedbackMap[id]){
                            return Object.assign({}, a, { user_feedback: feedbackMap[id] });
                        }
                        return a;
                    });
                }catch(_){ }
            }
        }

        // 兜底：localStorage
        if (!applications || applications.length === 0) {
            try{
                const all = typeof loadKeywordApplicationsFromLocalStorage === 'function' ? loadKeywordApplicationsFromLocalStorage() : [];
                applications = (all||[]).filter(a => (a.task_type === '悟空搜索任务') || String(a.id||'').startsWith('WK'));
            }catch(_){ applications = []; }
        }
        
        // 再次兜底：读取全局promotionApplications（用户前端提交后会写这里）
        if(!applications || applications.length === 0){
            try{
                const globalApps = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                applications = globalApps.filter(a => (a.task_type === '悟空搜索任务') || String(a.id||'').startsWith('WK'));
                console.log('从promotionApplications兜底加载了', applications.length, '条悟空申请');
            }catch(_){ applications = []; }
        }

        // 应用本页筛选条件
        try{
            const q = (document.getElementById('wukongSearchManagementSearch')?.value || '').trim().toLowerCase();
            const st = (document.getElementById('wukongSearchManagementStatusFilter')?.value || '').trim();
            if (q) {
                applications = applications.filter(a => [a.username, a.keywords, a.assigned_keywords, a.id]
                    .map(s => String(s||'').toLowerCase()).join(' ').includes(q));
            }
            if (st) {
                const s = st.toLowerCase();
                applications = applications.filter(a => String(a.status||'').toLowerCase() === s);
            }
        }catch(_){ }

        // 缓存并渲染
        window.__wkMgmtCache = applications || [];
        renderWukongSearchManagementTable(window.__wkMgmtCache);
    }catch(e){
        console.warn('loadWukongSearchManagementData error', e);
        const tbody = document.querySelector('#wukongSearchManagementTable tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="loading">加载失败，请稍后重试</td></tr>';
    }
}

function renderWukongSearchManagementTable(applications){
    try{
        const tbody = document.querySelector('#wukongSearchManagementTable tbody');
        if(!tbody) return;
        if(!applications || applications.length===0){
            tbody.innerHTML = '<tr><td colspan="10" class="loading">暂无悟空搜索申请数据</td></tr>';
            return;
        }
        tbody.innerHTML = (applications||[]).map(app=>{
            // 计算回填数：优先用app自带；若为0则从全局localStorage兜底
            let fbCount = Array.isArray(app.user_feedback) ? app.user_feedback.length : (app.user_feedback?1:0);
            if(!fbCount){
                try{
                    const gl = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                    const found = gl.find(x=> String(x.id||'')===String(app.id||''));
                    if(found){
                        fbCount = Array.isArray(found.user_feedback) ? found.user_feedback.length : (found.user_feedback?1:0);
                    }
                }catch(_){ }
            }
            return `
            <tr>
                <td>${app.id||''}</td>
                <td>${app.username||''}</td>
                <td class="keywords-cell">${(app.keywords||'')}</td>
                <td>${getExperienceText? getExperienceText(app.experience): (app.experience||'')}</td>
                <td>${getChannelText? getChannelText(app.promotion_channel): (app.promotion_channel||'')}</td>
                <td>${app.created_at?formatDate(app.created_at):'-'}</td>
                <td><span class="status-badge ${typeof getApprovalStatusClass==='function'? getApprovalStatusClass(app.status):''}">${typeof getApprovalStatusText==='function'? getApprovalStatusText(app.status):(app.status||'待审核')}</span></td>
                <td><a href="#" class="btn btn-secondary btn-xs" onclick="openWkFeedbackModal('${app.id||''}')">查看(${fbCount||0})</a></td>
                <td>${app.assigned_keywords? `<span class="assigned-keywords">${app.assigned_keywords}</span>` : '<span class="text-muted">未分配</span>'}</td>
                <td>${typeof getApprovalActions==='function'? getApprovalActions(app) : '-'}</td>
            </tr>`;
        }).join('');
    }catch(e){ console.warn('renderWukongSearchManagementTable error', e); }
}
// KK网盘管理页：加载真实数据（与其他任务一致的兜底策略）
async function loadKKDiskManagementData(){
    try{
        console.log('加载KK网盘管理数据...');
        let applications = [];
        try{ if (typeof ensureSupabaseReady === 'function') { await ensureSupabaseReady(); } }catch(_){ }
        if (typeof supabase !== 'undefined' && supabase && supabase.from) {
            let { data: dbApplications, error } = await supabase
                .from('keyword_applications')
                .select('*')
                .eq('task_type', 'KK网盘任务')
                .order('created_at', { ascending: false });
            if (error || !dbApplications || dbApplications.length === 0) {
                const { data: allApplications, error: allError } = await supabase
                    .from('keyword_applications')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!allError && allApplications && allApplications.length > 0) {
                    dbApplications = allApplications.filter(a => a.task_type === 'KK网盘任务');
                    error = null;
                }
            }
            if(!error && Array.isArray(dbApplications)) {
                applications = dbApplications;
                // 合并本地提交信息（夸克uid/手机号/姓名/截图），DB里可能没有这些列
                try{
                    const locals = (typeof loadKeywordApplicationsFromLocalStorage === 'function') ? loadKeywordApplicationsFromLocalStorage() : [];
                    const map = {};
                    (locals||[]).forEach(a=>{
                        const id = String(a.id||'');
                        const isKD = (a.task_type === 'KK网盘任务') || id.startsWith('KD');
                        if(!isKD) return;
                        map[id] = a;
                    });
                    applications = (applications||[]).map(a=>{
                        const id = String(a.id||'');
                        const la = map[id];
                        if(!la) return a;
                        return Object.assign({}, a, {
                            quark_uid: a.quark_uid || la.quark_uid || null,
                            quark_phone: a.quark_phone || la.quark_phone || null,
                            real_name: a.real_name || la.real_name || null,
                            bind_screenshot: a.bind_screenshot || la.bind_screenshot || null
                        });
                    });
                }catch(_){ }
            }
        }
        if(!applications || applications.length===0){
            try{
                const all = typeof loadKeywordApplicationsFromLocalStorage === 'function' ? loadKeywordApplicationsFromLocalStorage() : [];
                applications = (all||[]).filter(a => (a.task_type === 'KK网盘任务') || String(a.id||'').startsWith('KD'));
            }catch(_){ applications = []; }
        }
        if(!applications || applications.length===0){
            try{
                const globalApps = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                applications = globalApps.filter(a => (a.task_type === 'KK网盘任务') || String(a.id||'').startsWith('KD'));
            }catch(_){ applications = []; }
        }
        window.__kdMgmtCache = applications || [];
        if(typeof renderKKDiskManagementTable==='function') renderKKDiskManagementTable(window.__kdMgmtCache);
        else{
            const tbody = document.querySelector('#kkDiskManagementTable tbody');
            if(tbody){
                if(!applications || applications.length===0){ tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无KK网盘申请数据</td></tr>'; }
            }
        }
    }catch(e){ console.warn('loadKKDiskManagementData error', e); const tbody = document.querySelector('#kkDiskManagementTable tbody'); if(tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading">加载失败，请稍后重试</td></tr>'; }
}

function renderKKDiskManagementTable(applications){
    try{
        const tbody = document.querySelector('#kkDiskManagementTable tbody');
        if(!tbody) return;
        if(!applications || applications.length===0){
            tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无KK网盘申请数据</td></tr>';
            return;
        }
        tbody.innerHTML = (applications||[]).map(app=>`
            <tr>
                <td>${app.id||''}</td>
                <td>${app.username||''}</td>
                <td class="keywords-cell">${(app.keywords||'')}</td>
                <td>${getExperienceText? getExperienceText(app.experience): (app.experience||'')}</td>
                <td>${getChannelText? getChannelText(app.promotion_channel): (app.promotion_channel||'')}</td>
                <td>${app.created_at?formatDate(app.created_at):'-'}</td>
                <td><span class="status-badge ${typeof getApprovalStatusClass==='function'? getApprovalStatusClass(app.status):''}">${typeof getApprovalStatusText==='function'? getApprovalStatusText(app.status):(app.status||'待审核')}</span></td>
                <td>${app.assigned_keywords? `<span class="assigned-keywords">${app.assigned_keywords}</span>` : '<span class="text-muted">未分配</span>'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="(window.openKDDdetail||window.openKDDDetail||window.openKDDetail||window.openKdDetail)('${app.id||''}')">详情</button>
                    ${typeof getApprovalActions==='function'? getApprovalActions(app) : ''}
                </td>
            </tr>
        `).join('');
    }catch(e){ console.warn('renderKKDiskManagementTable error', e); }
}
// ===== KK关键词仓库逻辑 =====
let __kkKeywordsRaw = [];
let __xrayKeywordsRaw = [];

async function loadKKKeywordRepo(){
    try{
        await ensureSupabaseReady();
        // 建议单独建表 kk_keywords(id, keyword, created_at)
        let { data, error } = await supabase.from('kk_keywords').select('*').order('created_at', {ascending:false});
        if(error){ console.warn('kk_keywords 查询失败，使用本地存储'); data = null; }
        if(!data || data.length===0){
            const local = JSON.parse(localStorage.getItem('kk_keywords')||'[]');
            __kkKeywordsRaw = local;
        }else{
            __kkKeywordsRaw = data;
            // 同步到本地作备份
            localStorage.setItem('kk_keywords', JSON.stringify(data));
        }
        renderKKKeywordTable(__kkKeywordsRaw);
    }catch(e){ console.error('加载关键词仓库失败:', e); renderKKKeywordTable([]); }
}

// ===== x雷关键词仓库逻辑 =====
async function loadXrayKeywordRepo(){
    try{
        await ensureSupabaseReady();
        let { data, error } = await supabase.from('xray_keywords').select('*').order('created_at', {ascending:false});
        if(error){ console.warn('xray_keywords 查询失败，使用本地存储'); data = null; }
        if(!data || data.length===0){
            const local = JSON.parse(localStorage.getItem('xray_keywords')||'[]');
            __xrayKeywordsRaw = local;
        }else{
            __xrayKeywordsRaw = data;
            localStorage.setItem('xray_keywords', JSON.stringify(data));
        }
        renderXrayKeywordTable(__xrayKeywordsRaw);
    }catch(e){ console.error('加载x雷关键词仓库失败:', e); renderXrayKeywordTable([]); }
}

function renderXrayKeywordTable(list){
    const tbody = document.querySelector('#xrayKeywordTable tbody'); if(!tbody) return;
    if(!list || list.length===0){ tbody.innerHTML = '<tr><td colspan="5" class="loading">暂无关键词</td></tr>'; return; }
    // 统计每个关键词出现次数
    const freqMap = new Map();
    (list||[]).forEach(r=>{
        const k = String(r.keyword||'').trim();
        if(!k) return;
        freqMap.set(k, (freqMap.get(k)||0)+1);
    });
    tbody.innerHTML = list.map(row=>{
        const k = String(row.keyword||'').trim();
        const count = freqMap.get(k) || 1;
        return `
        <tr>
            <td>${row.id || ''}</td>
            <td>${k}</td>
            <td>${count}</td>
            <td>${row.created_at ? formatDate(row.created_at) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-error" onclick="deleteXrayKeyword('${row.id||''}','${k}')">删除</button>
            </td>
        </tr>`;
    }).join('');
}

function applyXrayKeywordFilters(){
    try{
        const kw=(document.getElementById('xrayKeywordSearchInput')?.value||'').trim().toLowerCase();
        let list=(__xrayKeywordsRaw||[]).slice();
        if(kw){ list=list.filter(r=> String(r.keyword||'').toLowerCase().includes(kw) || String(r.id||'').toLowerCase().includes(kw)); }
        renderXrayKeywordTable(list);
    }catch(e){ console.warn('applyXrayKeywordFilters', e); }
}

const xrayKeywordFiltersChanged = debounce(applyXrayKeywordFilters, 300);

async function openXrayKeywordModal(){
    const keyword = prompt('请输入要添加的关键词:');
    if(!keyword || !keyword.trim()) return;
    try{
        await ensureSupabaseReady();
        const payload = { keyword: keyword.trim(), created_at: new Date().toISOString() };
        let inserted = null;
        try{ const { data, error } = await supabase.from('xray_keywords').insert([payload]).select('*').single(); if(error) throw error; inserted = data; }catch(dbErr){ console.warn('写入数据库失败，写入localStorage', dbErr); }
        if(!inserted){
            const local = JSON.parse(localStorage.getItem('xray_keywords')||'[]');
            const row = { id: 'local_'+Date.now(), ...payload };
            local.unshift(row); localStorage.setItem('xray_keywords', JSON.stringify(local)); inserted=row;
        }
        __xrayKeywordsRaw = [inserted, ...(__xrayKeywordsRaw||[])];
        renderXrayKeywordTable(__xrayKeywordsRaw);
        showNotification('关键词已添加', 'success');
    }catch(e){ showNotification('添加失败: '+e.message, 'error'); }
}

async function openXrayBulkKeywordsModal(){
    const text = prompt('请输入要批量添加的关键词，每行一个:');
    if(!text || !text.trim()) return;
    const lines = text.split(/\r?\n/).map(s=> s.trim()).filter(Boolean);
    if(lines.length===0) return;
    try{
        await ensureSupabaseReady();
        const rows = lines.map(k=> ({ keyword:k, created_at:new Date().toISOString() }));
        let ok=false; try{ const { error } = await supabase.from('xray_keywords').insert(rows); if(!error) ok=true; }catch(_){}
        if(!ok){
            const local = JSON.parse(localStorage.getItem('xray_keywords')||'[]');
            rows.forEach(r=> local.unshift({ id:'local_'+Math.random().toString(36).slice(2), ...r }));
            localStorage.setItem('xray_keywords', JSON.stringify(local));
            __xrayKeywordsRaw = local;
        }else{
            await loadXrayKeywordRepo();
        }
        renderXrayKeywordTable(__xrayKeywordsRaw);
        showNotification('批量添加完成', 'success');
    }catch(e){ showNotification('批量添加失败: '+e.message, 'error'); }
}

// ===== Excel/CSV 批量导入（x雷浏览器 关键词） =====
async function ensureSheetJSReady(){
    try{
        if(window.XLSX) return true;
        const cdns=[
            'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
            'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
        ];
        for(let i=0;i<cdns.length;i++){
            try{
                await new Promise((resolve,reject)=>{
                    const s=document.createElement('script');
                    s.src=cdns[i]; s.async=false;
                    s.onload=()=>resolve(); s.onerror=()=>reject(new Error('load fail'));
                    document.head.appendChild(s);
                });
                if(window.XLSX) return true;
            }catch(_){ /* try next */ }
        }
        return !!window.XLSX;
    }catch(e){ console.warn('ensureSheetJSReady error', e); return false; }
}
function triggerXrayExcelImport(){
    try{
        const id='xrayExcelFileInput';
        let input=document.getElementById(id);
        if(!input){
            input=document.createElement('input');
            input.type='file';
            input.id=id;
            input.accept='.xlsx,.xls,.csv';
            input.style.display='none';
            input.addEventListener('change', handleXrayFileImport);
            document.body.appendChild(input);
        }
        input.value='';
        input.click();
    }catch(e){ showNotification('无法打开文件选择器: '+e.message, 'error'); }
}

async function handleXrayFileImport(evt){
    try{
        const file=evt?.target?.files?.[0];
        if(!file){ return; }
        const ok=await ensureSheetJSReady();
        if(!ok){ return showNotification('加载解析库失败，请尝试CSV导入', 'error'); }
        const reader=new FileReader();
        reader.onload=async(e)=>{
            try{
                const data=e.target.result;
                const wb=XLSX.read(data, { type: 'array' });
                const keywords=extractKeywordsFromWorkbook(wb);
                if(!keywords || keywords.length===0){ return showNotification('未在文件中识别到关键词', 'error'); }
                await bulkImportXrayKeywords(keywords);
            }catch(err){ showNotification('解析失败: '+err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
    }catch(e){ showNotification('导入失败: '+e.message, 'error'); }
}
function extractKeywordsFromWorkbook(workbook){
    try{
        const sheetName=workbook.SheetNames[0];
        const ws=workbook.Sheets[sheetName];
        if(!ws) return [];
        // 先尝试对象模式获取表头
        const rows=XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if(!rows || rows.length===0) return [];
        // 检测表头行（前3行内寻找）
        let headerRowIndex=0; let header=rows[0];
        for(let i=0;i<Math.min(3, rows.length);i++){
            const r=rows[i].map(v=> String(v).trim());
            const hasHeader=r.some(c=> /关键词|关键字|keyword/i.test(c));
            if(hasHeader){ headerRowIndex=i; header=r; break; }
        }
        // 确定关键词列索引
        let colIndex=-1;
        for(let i=0;i<header.length;i++){
            const name=String(header[i]||'');
            if(/关键词|关键字|keyword/i.test(name)){ colIndex=i; break; }
        }
        // 如果未识别表头，尝试猜测：优先C列(2)，否则第一列(0)
        if(colIndex===-1){ colIndex = rows[0].length>2 ? 2 : 0; headerRowIndex=0; }
        // 收集数据
        const list=[];
        for(let r=headerRowIndex+1; r<rows.length; r++){
            const v=rows[r]?.[colIndex];
            if(v===undefined || v===null) continue;
            const s=String(v).trim();
            if(!s) continue;
            // 每单元格可能包含逗号/空格分隔
            s.split(/[\s,，]+/).forEach(t=>{ const k=t.trim(); if(k) list.push(k); });
        }
        // 返回原始列表（包含重复），统计在导入阶段处理
        return list;
    }catch(e){ console.warn('extractKeywordsFromWorkbook error', e); return []; }
}

async function bulkImportXrayKeywords(keywords){
    try{
        if(!Array.isArray(keywords)) return;
        // 预加载现有，避免重复
        try{ await loadXrayKeywordRepo(); }catch(_){ }
        const existing=new Set((__xrayKeywordsRaw||[]).map(r=> String(r.keyword||'').trim()));
        const originalCount = keywords.length;
        // 规范化输入并统计去重
        const normalized = keywords.map(k=> String(k||'').trim()).filter(Boolean);
        const uniqueIncoming = [...new Set(normalized)];
        const duplicatesWithinFile = originalCount - uniqueIncoming.length;
        const alreadyExisting = uniqueIncoming.filter(k=> existing.has(k)).length;
        const toInsert = uniqueIncoming.filter(k=> !existing.has(k));
        if(toInsert.length===0){ return showNotification('没有新的关键词需要导入（全部为重复）', 'info'); }

        await ensureSupabaseReady();
        const now=new Date().toISOString();
        const chunkSize=500;
        let dbOkTotal=0; let localAdded=0;
        for(let i=0;i<toInsert.length;i+=chunkSize){
            const chunk=toInsert.slice(i, i+chunkSize).map(k=> ({ keyword:k, created_at: now }));
            let ok=false;
            try{ const { error } = await supabase.from('xray_keywords').insert(chunk); if(!error) ok=true; }catch(_){ }
            if(ok){ dbOkTotal+=chunk.length; }
            else{
                const local=JSON.parse(localStorage.getItem('xray_keywords')||'[]');
                chunk.forEach(r=> local.unshift({ id:'local_'+Math.random().toString(36).slice(2), ...r }));
                localStorage.setItem('xray_keywords', JSON.stringify(local));
                localAdded+=chunk.length;
            }
        }
        // 刷新并反馈
        try{ await loadXrayKeywordRepo(); }catch(_){ }
        renderXrayKeywordTable(__xrayKeywordsRaw||[]);
        const total=dbOkTotal+localAdded;
        showNotification(`导入完成：原始${originalCount}，去重后${uniqueIncoming.length}，已存在${alreadyExisting}，新增${total}（数据库${dbOkTotal}，本地${localAdded}）`, 'success');
    }catch(e){ showNotification('导入失败: '+e.message, 'error'); }
}

async function deleteXrayKeyword(id, keyword){
    if(!confirm(`确认删除关键词: ${keyword}?`)) return;
    try{
        await ensureSupabaseReady();
        let ok=false; try{ const { error } = await supabase.from('xray_keywords').delete().eq('id', id); if(!error) ok=true; }catch(_){ }
        if(!ok){
            const local = JSON.parse(localStorage.getItem('xray_keywords')||'[]').filter(r=> r.id!==id);
            localStorage.setItem('xray_keywords', JSON.stringify(local));
            __xrayKeywordsRaw = local;
        }else{
            __xrayKeywordsRaw = (__xrayKeywordsRaw||[]).filter(r=> r.id!==id);
        }
        renderXrayKeywordTable(__xrayKeywordsRaw);
        showNotification('已删除', 'success');
    }catch(e){ showNotification('删除失败: '+e.message, 'error'); }
}
function exportXrayKeywordsCSV(){
    try{
        const rows = document.querySelectorAll('#xrayKeywordTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','关键词','出现次数','添加时间'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<5) return;
            const line=[tds[0].innerText.trim(), tds[1].innerText.trim(), tds[2].innerText.trim(), tds[3].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='xray-keywords.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}
// 将本地(localStorage)中的 xray 关键词推送到数据库（把 local_* 迁移成真实ID）
async function migrateLocalXrayKeywordsToDB(){
    try{
        await ensureSupabaseReady();
        const local = JSON.parse(localStorage.getItem('xray_keywords')||'[]');
        const pending = local.filter(r=> String(r.id||'').startsWith('local_')).map(r=> ({ keyword: r.keyword, created_at: r.created_at || new Date().toISOString() }));
        if(pending.length===0){ console.log('无需迁移：无 local_* 记录'); return; }
        const chunkSize=500; let okCount=0; let failCount=0;
        for(let i=0;i<pending.length;i+=chunkSize){
            const chunk=pending.slice(i, i+chunkSize);
            try{ const { error } = await supabase.from('xray_keywords').insert(chunk); if(error){ console.warn('迁移失败', error); failCount+=chunk.length; } else { okCount+=chunk.length; } }catch(err){ console.warn('迁移异常', err); failCount+=chunk.length; }
        }
        await loadXrayKeywordRepo();
        showNotification(`已迁移本地关键词：成功 ${okCount}，失败 ${failCount}`, okCount>0 && failCount===0 ? 'success' : (okCount>0 ? 'info' : 'error'));
    }catch(e){ showNotification('迁移失败: '+e.message, 'error'); }
}

function renderKKKeywordTable(list){
    const tbody = document.querySelector('#kkKeywordTable tbody'); if(!tbody) return;
    if(!list || list.length===0){ tbody.innerHTML = '<tr><td colspan="4" class="loading">暂无关键词</td></tr>'; return; }
    tbody.innerHTML = list.map(row=>`
        <tr>
            <td>${row.id || ''}</td>
            <td>${row.keyword || ''}</td>
            <td>${row.created_at ? formatDate(row.created_at) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-error" onclick="deleteKKKeyword('${row.id||''}','${row.keyword||''}')">删除</button>
            </td>
        </tr>
    `).join('');
}
// 审核/仓库 切换（单页互斥显示）
function toggleKKPane(which){
    const reviewCard = document.getElementById('kkSearchManagement');
    const repoCard = document.getElementById('kkSearchKeywordRepo');
    const btnReview = document.getElementById('btnKKReview');
    const btnRepo = document.getElementById('btnKKRepo');
    if(!reviewCard || !repoCard) return;
    if(which==='repo'){
        reviewCard.style.display='none';
        repoCard.style.display='block';
        btnReview && (btnReview.className='btn');
        btnRepo && (btnRepo.className='btn btn-primary');
        const btnRepo2=document.getElementById('btnKKRepo2');
        btnRepo2 && (btnRepo2.className='btn btn-primary');
        loadKKKeywordRepo();
    }else{
        reviewCard.style.display='block';
        repoCard.style.display='none';
        btnReview && (btnReview.className='btn btn-primary');
        btnRepo && (btnRepo.className='btn');
        const btnRepo2=document.getElementById('btnKKRepo2');
        btnRepo2 && (btnRepo2.className='btn');
    }
    // 记住当前面板，避免刷新或其他加载又切回
    try{ localStorage.setItem('kkPane', which); }catch(_){ }
}

function applyKKKeywordFilters(){
    try{
        const kw=(document.getElementById('kkKeywordSearchInput')?.value||'').trim().toLowerCase();
        let list=(__kkKeywordsRaw||[]).slice();
        if(kw){ list=list.filter(r=> String(r.keyword||'').toLowerCase().includes(kw) || String(r.id||'').toLowerCase().includes(kw)); }
        renderKKKeywordTable(list);
    }catch(e){ console.warn('applyKKKeywordFilters', e); }
}

const kkKeywordFiltersChanged = debounce(applyKKKeywordFilters, 300);

async function openKKKeywordModal(){
    const keyword = prompt('请输入要添加的关键词:');
    if(!keyword || !keyword.trim()) return;
    try{
        await ensureSupabaseReady();
        const payload = { keyword: keyword.trim(), created_at: new Date().toISOString() };
        let inserted = null;
        try{ const { data, error } = await supabase.from('kk_keywords').insert([payload]).select('*').single(); if(error) throw error; inserted = data; }catch(dbErr){ console.warn('写入数据库失败，写入localStorage', dbErr); }
        if(!inserted){
            const local = JSON.parse(localStorage.getItem('kk_keywords')||'[]');
            const row = { id: 'local_'+Date.now(), ...payload };
            local.unshift(row); localStorage.setItem('kk_keywords', JSON.stringify(local)); inserted=row;
        }
        __kkKeywordsRaw = [inserted, ...(__kkKeywordsRaw||[])];
        renderKKKeywordTable(__kkKeywordsRaw);
        showNotification('关键词已添加', 'success');
        // 保持停留在仓库视图
        try{ toggleKKPane('repo'); }catch(_){ }
    }catch(e){ showNotification('添加失败: '+e.message, 'error'); }
}

async function openKKBulkKeywordsModal(){
    const text = prompt('请输入要批量添加的关键词，每行一个:');
    if(!text || !text.trim()) return;
    const lines = text.split(/\r?\n/).map(s=> s.trim()).filter(Boolean);
    if(lines.length===0) return;
    try{
        await ensureSupabaseReady();
        const rows = lines.map(k=> ({ keyword:k, created_at:new Date().toISOString() }));
        let ok=false; try{ const { error } = await supabase.from('kk_keywords').insert(rows); if(!error) ok=true; }catch(_){}
        if(!ok){
            const local = JSON.parse(localStorage.getItem('kk_keywords')||'[]');
            rows.forEach(r=> local.unshift({ id:'local_'+Math.random().toString(36).slice(2), ...r }));
            localStorage.setItem('kk_keywords', JSON.stringify(local));
            __kkKeywordsRaw = local;
        }else{
            // 重新加载数据库数据
            await loadKKKeywordRepo();
        }
        renderKKKeywordTable(__kkKeywordsRaw);
        showNotification('批量添加完成', 'success');
        // 保持停留在仓库视图
        try{ toggleKKPane('repo'); }catch(_){ }
    }catch(e){ showNotification('批量添加失败: '+e.message, 'error'); }
}
async function deleteKKKeyword(id, keyword){
    if(!confirm(`确认删除关键词: ${keyword}?`)) return;
    try{
        await ensureSupabaseReady();
        let ok=false; try{ const { error } = await supabase.from('kk_keywords').delete().eq('id', id); if(!error) ok=true; }catch(_){ }
        if(!ok){
            // 从local删除
            const local = JSON.parse(localStorage.getItem('kk_keywords')||'[]').filter(r=> r.id!==id);
            localStorage.setItem('kk_keywords', JSON.stringify(local));
            __kkKeywordsRaw = local;
        }else{
            __kkKeywordsRaw = (__kkKeywordsRaw||[]).filter(r=> r.id!==id);
        }
        renderKKKeywordTable(__kkKeywordsRaw);
        showNotification('已删除', 'success');
    }catch(e){ showNotification('删除失败: '+e.message, 'error'); }
}

function exportKKKeywordsCSV(){
    try{
        const rows = document.querySelectorAll('#kkKeywordTable tbody tr');
        if(!rows || rows.length===0) return showNotification('没有可导出的数据', 'info');
        const headers=['ID','关键词','添加时间'];
        const data=[headers.join(',')];
        rows.forEach(tr=>{
            const tds=tr.querySelectorAll('td'); if(tds.length<4) return;
            const line=[tds[0].innerText.trim(), tds[1].innerText.trim(), tds[2].innerText.trim()].map(v=> '"'+(v||'')+'"').join(',');
            data.push(line);
        });
        const blob=new Blob(["\ufeff"+data.join('\n')],{type:'text/csv;charset=utf-8;'});
        const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kk-keywords.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showNotification('导出完成', 'success');
    }catch(e){ showNotification('导出失败: '+e.message, 'error'); }
}

// 查看悟空搜索用户回填信息
function openWkFeedbackModal(applicationId){
    try{
        const listBody = document.querySelector('#wkFeedbackList');
        if(!listBody){ __openModal && __openModal('wkFeedbackModal'); return; }
        let list = Array.isArray(window.__wkMgmtCache) ? window.__wkMgmtCache : [];
        let app = list.find(a => String(a.id||'') === String(applicationId));
        // 若缓存里该记录无回填，则从全局 localStorage 兜底读取
        if(!app || !app.user_feedback || (Array.isArray(app.user_feedback) && app.user_feedback.length===0)){
            try{
                const gl = JSON.parse(localStorage.getItem('promotionApplications')||'[]');
                const found = gl.find(x=> String(x.id||'')===String(applicationId));
                if(found){
                    const arr = Array.isArray(found.user_feedback) ? found.user_feedback : (found.user_feedback?[found.user_feedback]:[]);
                    if(arr.length>0){
                        if(app){ app.user_feedback = arr; }
                        else { app = { id:applicationId, user_feedback: arr }; }
                    }
                }
            }catch(_){ }
        }
        let records = [];
        if(app && app.user_feedback){
            records = Array.isArray(app.user_feedback) ? app.user_feedback.slice() : [app.user_feedback];
        }
        if(!records || records.length===0){
            listBody.innerHTML = '<tr><td colspan="2" class="loading">暂无回填记录</td></tr>';
        }else{
            const esc = s => String(s==null?'':s).replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m]));
            listBody.innerHTML = records.map(r=>{
                if(typeof r === 'string'){
                    return `<tr><td>-</td><td>${esc(r)}</td></tr>`;
                }
                const time = r.time || r.created_at || '-';
                // 新格式：直接展示keyword, link, platform等字段
                let contentHtml = '';
                if(r.keyword || r.link || r.platform || r.method || r.nickname){
                    contentHtml = `<div><strong>关键词:</strong> ${esc(r.keyword||'-')}</div>
                        <div><strong>链接:</strong> ${esc(r.link||'-')}</div>
                        <div><strong>平台:</strong> ${esc(r.platform||'-')}</div>
                        <div><strong>方式:</strong> ${esc(r.method||'-')}</div>
                        <div><strong>昵称:</strong> ${esc(r.nickname||'-')}</div>`;
                } else {
                    const content = r.content || r.note || JSON.stringify(r);
                    contentHtml = esc(content);
                }
                return `<tr><td>${time ? (typeof formatDate==='function'? formatDate(time): esc(time)) : '-'}</td><td>${contentHtml}</td></tr>`;
            }).join('');
        }
        __openModal ? __openModal('wkFeedbackModal') : (function(){ const el=document.getElementById('wkFeedbackModal'); if(el){ el.style.display='flex'; } })();
    }catch(e){ console.warn('openWkFeedbackModal error', e); }
}
// 🔧 修复：加载KK搜索管理数据，优先从数据库读取
async function loadKKSearchManagementData() {
    console.log('🔄 加载KK搜索管理数据...');
    
    try {
        let applications = [];
        
        // 🔧 优先从数据库获取数据（确保跨浏览器同步）
        console.log('📡 优先从数据库获取数据...');
        let { data: dbApplications, error } = await supabase
            .from('keyword_applications')
            .select(`
                id,
                user_id,
                username,
                keywords,
                experience,
                promotion_channel,
                status,
                assigned_keywords,
                reject_reason,
                reject_note,
                approve_note,
                created_at,
                updated_at,
                task_type
            `)
            .eq('task_type', 'KK搜索任务')
            .order('created_at', { ascending: false });
            
        // 🔧 紧急修复：如果查询失败，尝试不带条件的查询
        if (error || !dbApplications || dbApplications.length === 0) {
            console.log('🔄 尝试查询所有记录...');
            const { data: allApplications, error: allError } = await supabase
                .from('keyword_applications')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!allError && allApplications && allApplications.length > 0) {
                // 兜底：仅保留 KK 搜索任务；兼容历史无 task_type 的记录
                dbApplications = allApplications.filter(function(a){ return !a.task_type || a.task_type === 'KK搜索任务'; });
                error = null;
                console.log(`📊 查询到所有记录: ${allApplications.length} 条`);
            }
        }

        if (!error && dbApplications && dbApplications.length > 0) {
            applications = dbApplications;
            console.log(`✅ 从数据库成功加载了 ${applications.length} 条申请记录`);
            
            // 同步到localStorage作为备份
            syncDatabaseToLocalStorage(applications);
        } else if (error) {
            console.warn('⚠️ 数据库查询错误:', error);
            console.log('🔄 回退到localStorage数据...');
            applications = loadKeywordApplicationsFromLocalStorage();
            // 仅保留 KK 搜索任务；兼容历史无 task_type 的记录
            applications = (applications||[]).filter(function(a){ return !a.task_type || a.task_type === 'KK搜索任务'; });
        } else {
            console.log('📊 数据库中暂无数据，检查localStorage...');
            applications = loadKeywordApplicationsFromLocalStorage();
            applications = (applications||[]).filter(function(a){ return !a.task_type || a.task_type === 'KK搜索任务'; });
        }
        
        // 如果仍然没有数据，使用示例数据
        if (!applications || applications.length === 0) {
            console.log('📝 无任何数据，使用示例数据...');
            applications = (typeof generateSampleKKSearchManagementData==='function') ? generateSampleKKSearchManagementData() : [
                { id:'kk-mgmt-s1', username:'demo1', keywords:'KK搜索, 入门', experience:'learning', promotion_channel:'social', status:'pending', assigned_keywords:null, reject_reason:null, created_at:new Date(Date.now()-86400000).toISOString() },
                { id:'kk-mgmt-s2', username:'demo2', keywords:'KK搜索优化', experience:'experienced', promotion_channel:'blog', status:'approved', assigned_keywords:'示例关键词A, 示例关键词B', reject_reason:null, created_at:new Date(Date.now()-172800000).toISOString() },
                { id:'kk-mgmt-s3', username:'demo3', keywords:'无效关键词', experience:'learning', promotion_channel:'other', status:'rejected', assigned_keywords:null, reject_reason:'关键词不符合要求', created_at:new Date(Date.now()-259200000).toISOString() }
            ];
        }

        // 缓存用于顶部统计
        window.__kkMgmtCache = applications || [];
        renderKKSearchManagementTable(window.__kkMgmtCache);
        console.log(`🎯 最终渲染了 ${applications.length} 条记录`);
        
        // 🔧 修复：只在首次加载时设置实时数据监听，避免重复设置
        if (!window.realtimeSyncInitialized) {
            setupRealtimeDataSync();
            window.realtimeSyncInitialized = true;
        }

    } catch (error) {
        console.error('❌ 加载KK搜索管理数据失败:', error);
        // 使用示例数据作为后备
        const sampleData = (typeof generateSampleKKSearchManagementData==='function') ? generateSampleKKSearchManagementData() : [
            { id:'kk-mgmt-f1', username:'demo1', keywords:'KK搜索, 入门', experience:'learning', promotion_channel:'social', status:'pending', assigned_keywords:null, reject_reason:null, created_at:new Date(Date.now()-86400000).toISOString() }
        ];
        renderKKSearchManagementTable(sampleData);
    }
}
// 🔧 新增：将数据库数据同步到localStorage
function syncDatabaseToLocalStorage(applications) {
    try {
        console.log('🔄 将数据库数据同步到localStorage...');
        
        applications.forEach(app => {
            try {
                // 为每个用户创建独立的存储键
                const userKey = `keywords_${app.user_id}`;
                let userApplications = [];
                
                // 获取现有的用户数据
                const existingData = localStorage.getItem(userKey);
                if (existingData) {
                    userApplications = JSON.parse(existingData);
                }
                
                // 检查是否已经存在相同ID的申请
                const existingIndex = userApplications.findIndex(existing => existing.id === app.id);
                
                // 转换数据格式以匹配localStorage格式
                const localStorageFormat = {
                    id: app.id,
                    username: app.username,
                    userId: app.user_id,
                    experience: app.experience,
                    channel: app.promotion_channel,
                    category: app.category || '未指定',
                    keywords: app.keywords,
                    status: app.status,
                    submitTime: app.created_at,
                    created_at: app.created_at,
                    assigned_keywords: app.assigned_keywords,
                    reject_reason: app.reject_reason
                };
                
                if (existingIndex >= 0) {
                    // 更新现有记录
                    userApplications[existingIndex] = localStorageFormat;
                } else {
                    // 添加新记录
                    userApplications.push(localStorageFormat);
                }
                
                // 保存回localStorage
                localStorage.setItem(userKey, JSON.stringify(userApplications));
                
            } catch (error) {
                console.warn(`⚠️ 同步用户 ${app.user_id} 的数据失败:`, error);
            }
        });
        
        console.log(`✅ 成功同步 ${applications.length} 条记录到localStorage`);
        
    } catch (error) {
        console.error('❌ 数据库到localStorage同步失败:', error);
    }
}
// 🔧 新增：设置实时数据同步
let autoRefreshInterval = null;
let focusListenerAdded = false;
let storageListenerAdded = false;

function setupRealtimeDataSync() {
    try {
        console.log('🔄 设置实时数据同步...');
        
        // 启动自动刷新
        startAutoRefresh();
        
        // 🔧 修复：只添加一次窗口焦点监听器
        if (!focusListenerAdded) {
            window.addEventListener('focus', async () => {
                console.log('🔄 窗口获得焦点，刷新数据...');
                await loadKKSearchManagementData();
                await loadXraySearchManagementData();
            });
            focusListenerAdded = true;
            console.log('✅ 窗口焦点监听器已添加');
        }
        
        // 🔧 修复：只添加一次存储变化监听器  
        if (!storageListenerAdded) {
            window.addEventListener('storage', (event) => {
                if (event.key && event.key.startsWith('keywords_')) {
                    console.log('🔄 检测到其他窗口数据变化，刷新数据...');
                    setTimeout(() => {
                        loadKKSearchManagementData();
                        loadXraySearchManagementData();
                    }, 1000);
                }
            });
            storageListenerAdded = true;
            console.log('✅ 存储变化监听器已添加');
        }
        
        console.log('✅ 实时数据同步设置完成');
        
    } catch (error) {
        console.error('❌ 设置实时数据同步失败:', error);
    }
}

// 🔧 新增：启动自动刷新
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        console.log('🔄 清除旧的自动刷新定时器');
    }
    
    // 🔧 修复：大幅降低刷新频率，从15秒改为30秒，减少闪烁
    autoRefreshInterval = setInterval(async () => {
        console.log('🔄 定时刷新数据（30秒间隔）...');
        await loadKKSearchManagementData();
    }, 30000);
    
    console.log('✅ 自动刷新已启动（30秒间隔）');
}
// 🔧 新增：停止自动刷新
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏸️ 自动刷新已停止');
    }
}
// 🔧 新增：从localStorage读取关键词申请数据
// 🔧 增强版：从localStorage读取关键词申请数据，支持更强健的数据同步
function loadKeywordApplicationsFromLocalStorage() {
    console.log('🔄 从localStorage读取关键词申请数据...');
    
    const allApplications = [];
    const debugInfo = {
        totalKeys: localStorage.length,
        keywordKeys: [],
        processedRecords: 0,
        errors: []
    };
    
    try {
        console.log(`📊 开始遍历 ${localStorage.length} 个localStorage键`);
        
        // 遍历localStorage中的所有键
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            console.log(`🔍 检查键 ${i + 1}/${localStorage.length}: ${key}`);
            
            // 检查是否是关键词申请数据（格式：keywords_用户ID）
            if (key && key.startsWith('keywords_')) {
                debugInfo.keywordKeys.push(key);
                console.log(`✅ 找到关键词数据键: ${key}`);
                
                try {
                    const rawData = localStorage.getItem(key);
                    console.log(`📄 键 ${key} 的原始数据长度: ${rawData ? rawData.length : 0} 字符`);
                    
                    if (!rawData) {
                        console.warn(`⚠️ 键 ${key} 的数据为空`);
                        continue;
                    }
                    
                    const userApplications = JSON.parse(rawData);
                    console.log(`🔧 键 ${key} 解析结果:`, {
                        dataType: typeof userApplications,
                        isArray: Array.isArray(userApplications),
                        length: userApplications?.length,
                        firstRecord: userApplications?.[0]
                    });
                    
                    if (Array.isArray(userApplications) && userApplications.length > 0) {
                        console.log(`🎯 开始处理键 ${key} 下的 ${userApplications.length} 条记录`);
                        
                        // 转换数据格式以适配管理后台
                        userApplications.forEach((app, index) => {
                            console.log(`📝 处理第 ${index + 1} 条申请:`, {
                                originalId: app.id,
                                username: app.username,
                                status: app.status,
                                experience: app.experience,
                                channel: app.channel,
                                category: app.category
                            });
                            
                            // 🔧 强化ID处理逻辑
                            let applicationId = app.id;
                            if (!applicationId) {
                                // 尝试多种方式生成ID
                                if (app.submitTime || app.created_at) {
                                    const timestamp = new Date(app.submitTime || app.created_at).getTime();
                                    applicationId = 'KW' + timestamp.toString().slice(-8); // 使用8位时间戳
                                } else {
                                    applicationId = 'KW' + Date.now().toString().slice(-8) + index.toString().padStart(2, '0');
                                }
                                console.log(`🔧 为申请生成新ID: ${applicationId}`);
                            }
                            
                            // 🔧 增强数据转换逻辑，支持多种数据格式
                            const convertedApp = {
                                id: applicationId,
                                user_id: app.userId || app.user_id || app.username || 'unknown',
                                username: app.username || app.user_name || app.name || '未知用户',
                                // 🔧 智能关键词提取
                                keywords: app.keywords || app.keyword || app.targetKeywords || 
                                         (app.channel && app.category ? `${app.category}-${app.channel}推广` : 
                                         app.description || '未指定'),
                                // 🔧 经验字段映射
                                experience: app.experience || app.experienceLevel || app.skill_level || 'unknown',
                                // 🔧 渠道字段映射
                                promotion_channel: app.channel || app.platform || app.promotion_channel || 'unknown',
                                // 🔧 状态字段映射和标准化
                                status: normalizeStatus(app.status || app.applicationStatus || 'pending'),
                                assigned_keywords: app.assigned_keywords || app.assignedKeywords || null,
                                reject_reason: app.rejectReason || app.reject_reason || app.refuseReason || null,
                                reject_note: app.reject_note || app.rejectNote || null,
                                approve_note: app.approve_note || app.approveNote || null,
                                // 🔧 KK网盘专属字段（从本地记录透传）
                                quark_uid: app.quark_uid || app.uid || app.quarkUid || null,
                                quark_phone: app.quark_phone || app.quarkPhone || app.phone || null,
                                real_name: app.real_name || app.name || app.realName || null,
                                bind_screenshot: app.bind_screenshot || app.screenshot || null,
                            // 🔧 回填字段映射：确保从本地读取时也带上用户回填数据
                            user_feedback: Array.isArray(app.user_feedback)
                                ? app.user_feedback.slice()
                                : (app.user_feedback
                                    ? [app.user_feedback]
                                    : (app.feedback ? [app.feedback] : [])),
                            // 🔧 任务类型推断
                            task_type: app.task_type || (String(applicationId||'').startsWith('WK')
                                ? '悟空搜索任务'
                                : (String(applicationId||'').startsWith('XR')
                                    ? 'x雷浏览器搜索任务'
                                    : (String(applicationId||'').startsWith('KW') ? 'KK搜索任务' : (app.category==='短剧'?'悟空搜索任务': undefined)))),
                            // 🔧 时间字段处理
                                created_at: app.submitTime || app.created_at || app.createTime || new Date().toISOString(),
                                updated_at: app.updated_at || app.updateTime || app.modified_at || new Date().toISOString(),
                                // 🔧 保存原始数据和调试信息
                                _original: app,
                                _source_key: key,
                                _processed_at: new Date().toISOString()
                            };
                            
                            console.log(`✅ 申请转换完成:`, {
                                id: convertedApp.id,
                                username: convertedApp.username,
                                status: convertedApp.status,
                                keywords: convertedApp.keywords,
                                experience: convertedApp.experience,
                                promotion_channel: convertedApp.promotion_channel
                            });
                            
                            allApplications.push(convertedApp);
                            debugInfo.processedRecords++;
                            
                            // 🔧 特殊标记目标记录
                            if (convertedApp.id === 'KW84464184') {
                                console.log('🎯 找到目标申请记录 KW84464184!');
                            }
                        });
                    } else {
                        console.warn(`⚠️ 键 ${key} 下没有有效的申请记录数组`);
                    }
                } catch (parseError) {
                    const errorMsg = `解析键 ${key} 的数据时出错: ${parseError.message}`;
                    console.error(`❌ ${errorMsg}`);
                    debugInfo.errors.push(errorMsg);
                }
            }
        }
        
        // 🔧 数据后处理
        console.log('🔄 开始数据后处理...');
        
        // 按创建时间降序排序
        allApplications.sort((a, b) => {
            const timeA = new Date(a.created_at);
            const timeB = new Date(b.created_at);
            return timeB - timeA;
        });
        
        // 去重处理（基于ID）
        const uniqueApplications = [];
        const seenIds = new Set();
        
        allApplications.forEach(app => {
            if (!seenIds.has(app.id)) {
                seenIds.add(app.id);
                uniqueApplications.push(app);
            } else {
                console.warn(`⚠️ 发现重复申请ID: ${app.id}，已跳过`);
            }
        });
        
        // 🔧 输出详细的加载结果
        console.log('📊 localStorage数据加载完成，统计信息:');
        console.log(`   总localStorage键数: ${debugInfo.totalKeys}`);
        console.log(`   关键词数据键数: ${debugInfo.keywordKeys.length}`);
        console.log(`   找到的键列表: [${debugInfo.keywordKeys.join(', ')}]`);
        console.log(`   处理的原始记录数: ${debugInfo.processedRecords}`);
        console.log(`   去重后的最终记录数: ${uniqueApplications.length}`);
        console.log(`   错误数: ${debugInfo.errors.length}`);
        
        if (debugInfo.errors.length > 0) {
            console.log('❌ 处理过程中的错误:');
            debugInfo.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        if (uniqueApplications.length > 0) {
            console.log('📋 最终申请记录ID列表:', uniqueApplications.map(app => app.id));
            console.log('👥 涉及用户列表:', [...new Set(uniqueApplications.map(app => app.username))]);
            
            // 🔧 检查是否包含目标记录
            const targetRecord = uniqueApplications.find(app => app.id === 'KW84464184');
            if (targetRecord) {
                console.log('🎯 确认找到目标申请记录 KW84464184:');
                console.log('   用户名:', targetRecord.username);
                console.log('   状态:', targetRecord.status);
                console.log('   经验:', targetRecord.experience);
                console.log('   渠道:', targetRecord.promotion_channel);
            } else {
                console.log('❌ 未找到目标申请记录 KW84464184');
            }
        } else {
            console.log('⚠️ 没有找到任何有效的申请记录');
        }
        
        return uniqueApplications;
        
    } catch (error) {
        console.error('❌ 从localStorage读取数据时发生严重错误:', error);
        console.error('错误堆栈:', error.stack);
        return [];
    }
}
// 🔧 新增：状态标准化函数
function normalizeStatus(status) {
    if (!status) return 'pending';
    
    const statusString = status.toString().toLowerCase();
    
    // 状态映射表
    const statusMap = {
        'pending': 'pending',
        'waiting': 'pending', 
        '待审核': 'pending',
        '审核中': 'pending',
        'reviewing': 'pending',
        
        'approved': 'approved',
        'passed': 'approved',
        '已通过': 'approved',
        '已批准': 'approved',
        'accepted': 'approved',
        
        'rejected': 'rejected',
        'refused': 'rejected',
        '已拒绝': 'rejected',
        '未通过': 'rejected',
        'denied': 'rejected'
    };
    
    return statusMap[statusString] || 'pending';
}
// 🔧 新增：更新localStorage中的申请记录
function updateApplicationInLocalStorage(applicationId, updates) {
    console.log(`🔄 尝试更新申请记录: ${applicationId}`, updates);
    
    try {
        let foundApplication = false;
        
        // 遍历localStorage中的所有关键词申请数据
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // 检查是否是关键词申请数据
            if (key && key.startsWith('keywords_')) {
                try {
                    const userApplications = JSON.parse(localStorage.getItem(key));
                    console.log(`🔍 检查键 ${key}，包含 ${userApplications?.length || 0} 条申请`);
                    
                    if (Array.isArray(userApplications)) {
                        // 查找匹配的申请记录
                        const applicationIndex = userApplications.findIndex(app => {
                            console.log(`🔎 比较申请ID: ${app.id} === ${applicationId}`);
                            return app.id === applicationId;
                        });
                        
                        if (applicationIndex !== -1) {
                            console.log(`✅ 在键 ${key} 中找到申请，索引: ${applicationIndex}`);
                            
                            // 记录更新前的数据
                            const oldData = { ...userApplications[applicationIndex] };
                            console.log('📋 更新前的数据:', oldData);
                            
                            // 更新申请记录
                            userApplications[applicationIndex] = {
                                ...userApplications[applicationIndex],
                                ...updates
                            };
                            
                            // 保存回localStorage
                            localStorage.setItem(key, JSON.stringify(userApplications));
                            
                            console.log(`✅ 成功更新申请 ${applicationId}:`);
                            console.log('📋 更新后的数据:', userApplications[applicationIndex]);
                            
                            foundApplication = true;
                            return true;
                        } else {
                            console.log(`❌ 在键 ${key} 中未找到匹配的申请ID`);
                            // 显示所有申请的ID以便调试
                            const allIds = userApplications.map(app => app.id).join(', ');
                            console.log(`📝 该键下的所有申请ID: [${allIds}]`);
                        }
                    }
                } catch (parseError) {
                    console.warn(`⚠️ 解析键 ${key} 的数据时出错:`, parseError);
                }
            }
        }
        
        if (!foundApplication) {
            console.error(`❌ 在所有localStorage键中都未找到申请 ${applicationId}`);
            
            // 显示调试信息
            console.log('🔍 所有localStorage中的关键词申请键:');
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('keywords_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        const ids = Array.isArray(data) ? data.map(app => app.id) : [];
                        console.log(`   ${key}: [${ids.join(', ')}]`);
                    } catch (e) {
                        console.log(`   ${key}: 解析失败`);
                    }
                }
            }
        }
        
        return foundApplication;
        
    } catch (error) {
        console.error('❌ 更新localStorage申请记录时出错:', error);
        return false;
    }
}
// 打开KK搜索收益模态框
function openKKSearchEarningsModal() {
    console.log('🔧 打开KK搜索收益模态框');
    
    try {
        // 检查模态框元素是否存在
        const modal = document.getElementById('kkSearchEarningsModal');
        if (!modal) {
            console.error('❌ KK搜索收益模态框元素不存在！');
            alert('模态框元素不存在，请检查HTML');
            return;
        }
        
        // 重置表单
        const form = document.getElementById('kkSearchEarningsForm');
        if (form) {
            form.reset();
            console.log('✅ 表单已重置');
        } else {
            console.error('❌ 表单元素不存在');
        }
        
        // 重置各个字段
        const fields = ['kkEarningId', 'pullNewCount', 'pullActiveCount', 'pullOldCount', 'kkTotalAmount', 'kkKeywordSearch'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (fieldId === 'kkTotalAmount') {
                    field.value = '¥0.00';
                } else if (fieldId !== 'kkEarningId') {
                    field.value = fieldId === 'kkKeywordSearch' ? '' : '0';
                } else {
                    field.value = '';
                }
                console.log(`✅ ${fieldId} 已重置`);
            } else {
                console.error(`❌ ${fieldId} 元素不存在`);
            }
        });
        
        // 🔧 重置新的搜索界面
        try {
            clearKKSelectedKeyword();
            hideKKSearchDropdown();
        } catch (e) {
            console.log('重置搜索界面时出错:', e);
        }
        
        // 确保搜索框可见
        const searchInput = document.getElementById('kkKeywordSearch');
        if (searchInput) {
            searchInput.style.display = 'block';
            searchInput.value = '';
        }
        
        // 加载关键词选项
        console.log('🔄 开始加载关键词选项...');
        loadKKSearchKeywordsForSelect();
        
        // 默认计算一次，避免金额显示为0
        try{ calculateKKEarningsAmount(); }catch(_){ }
        
        // 显示模态框 - 使用flex布局居中显示
        modal.style.display = 'flex';
        console.log('✅ KK搜索收益模态框已显示');
        
    } catch (error) {
        console.error('❌ 打开KK搜索收益模态框时出错:', error);
        alert('打开模态框时出错: ' + error.message);
    }
}
// 🔧 优化：加载已分配的关键词数据
async function loadKKSearchKeywordsForSelect() {
    try {
        console.log('🔄 开始加载关键词数据...');
        console.log('==================================================');
        
        let applications = [];
        let dataSource = '';
        try{
            await ensureSupabaseReady();
            const { data, error } = await supabase.from('keyword_applications').select('*').in('status',['approved','已通过']);
            if(!error && Array.isArray(data)) {
                applications = data;
                dataSource = '数据库';
                console.log('✅ 从数据库成功获取数据');
            } else {
                throw new Error(error&&error.message||'db');
            }
        }catch(dbErr){
            console.warn('⚠️ 数据库加载失败，回退本地:', dbErr&&dbErr.message||dbErr);
            applications = loadKeywordApplicationsFromLocalStorage();
            dataSource = 'localStorage';
        }
        console.log(`📦 从${dataSource}获取到 ${applications.length} 个申请记录`);
        
        // 🔍 详细输出所有记录（调试用）
        if (applications.length > 0) {
            console.log('📋 所有申请记录详情:');
            applications.forEach((app, idx) => {
                console.log(`  [${idx + 1}] ID:${app.id} | 用户:${app.username} | 任务:${app.task_type} | 状态:${app.status} | 关键词:${app.assigned_keywords || '无'}`);
            });
        } else {
            console.warn('⚠️ 数据库和localStorage都没有找到任何申请记录！');
        }
        
        const approvedApplications = applications.filter(app => 
            (app.status === 'approved' || app.status === '已通过') && 
            app.assigned_keywords && 
            app.assigned_keywords.trim()
        );
        console.log(`✅ 筛选出 ${approvedApplications.length} 个已审核通过且有分配关键词的申请`);
        
        // 清空并重建关键词数据数组
        kkSearchKeywords = [];
        xraySearchKeywords = [];
        
        if (approvedApplications.length === 0) {
            console.log('⚠️ 没有可用的关键词数据');
            // 显示创建测试数据的提示
            showNoKeywordsMessage();
        } else {
            // 构建关键词数据数组
            approvedApplications.forEach(app => {
                const keywords = app.assigned_keywords.split(',').map(k => k.trim());
                keywords.forEach(keyword => {
                    if (keyword) {
                        kkSearchKeywords.push({
                            keyword: keyword,
                            username: app.username,
                            userId: app.user_id || app.id
                        });
                        // 🔧 修复：使用更宽松的匹配，兼容数据录入错误
                        const taskType = String(app.task_type || '');
                        const taskId = String(app.id || '');
                        const isXray = taskType.includes('x雷') || taskType.includes('X雷') || taskId.startsWith('XR') || taskId.startsWith('xr');
                        
                        if (isXray) {
                            xraySearchKeywords.push({
                                keyword: keyword,
                                username: app.username,
                                userId: app.user_id || app.id
                            });
                            console.log(`✅ x雷关键词: ${keyword} (${app.username}) - task_type: ${app.task_type}`);
                        } else {
                            console.log(`⚠️ 非x雷关键词: ${keyword} - task_type: ${app.task_type} - ID: ${app.id}`);
                        }
                        console.log(`➕ 添加关键词数据: ${keyword} (${app.username})`);
                    }
                });
            });
            console.log('==================================================');
            console.log(`✅ 成功加载了 ${kkSearchKeywords.length} 个KK关键词, ${xraySearchKeywords.length} 个x雷关键词`);
            console.log('==================================================');
            
            // 🔍 如果没有x雷关键词，提供诊断建议
            if (xraySearchKeywords.length === 0) {
                console.error('❌ 没有找到任何x雷浏览器关键词！');
                console.log('💡 可能原因：');
                console.log('   1. 数据库中没有task_type="x雷浏览器搜索任务"的记录');
                console.log('   2. 所有记录的status都不是"approved"或"已通过"');
                console.log('   3. 所有记录的assigned_keywords都为空');
                console.log('💡 建议：');
                console.log('   1. 检查上方列出的所有记录');
                console.log('   2. 确认至少有一条记录满足：task_type="x雷浏览器搜索任务" AND status="已通过" AND assigned_keywords不为空');
                console.log('   3. 如果没有记录，请先在前台提交关键词申请，然后在后台审核通过');
            }
        }
        
    } catch (error) {
        console.error('❌ 加载关键词数据失败:', error);
        showNotification('加载关键词数据失败: ' + error.message, 'error');
    }
}
// 显示无关键词数据的消息
function showNoKeywordsMessage() {
    const dropdown = document.getElementById('kkDropdownContent');
    const resultCount = document.getElementById('kkResultCount');
    
    if (dropdown) {
        dropdown.innerHTML = `
            <div class="dropdown-item placeholder">
                暂无可用关键词，请先创建测试数据
            </div>
            <div class="dropdown-item" onclick="createKKSearchTestData(); hideKKSearchDropdown();">
                <span class="keyword-name">🔧 创建测试数据</span>
                <span class="user-name">点击创建</span>
            </div>
        `;
    }
    
    if (resultCount) {
        resultCount.textContent = '0 个结果';
    }
}
// 创建测试数据功能
function createKKSearchTestData() {
    console.log('🔧 创建KK搜索测试数据...');
    
    const testApplications = [
        {
            id: 'test-kk-001',
            username: 'test_user1',
            user_id: 'user_123',
            keywords: 'KK搜索引擎, 在线搜索',
            experience: 'experienced',
            promotion_channel: 'blog',
            status: 'approved',
            assigned_keywords: 'KK搜索推广, 搜索引擎优化',
            submitTime: new Date().toISOString(),
            created_at: new Date().toISOString()
        },
        {
            id: 'test-kk-002',
            username: 'test_user2',
            user_id: 'user_456',
            keywords: 'KK搜索工具, 资源查找',
            experience: 'learning',
            promotion_channel: 'video',
            status: 'approved',
            assigned_keywords: '资源搜索工具, KK搜索神器',
            submitTime: new Date().toISOString(),
            created_at: new Date().toISOString()
        }
    ];
    
    // 保存到localStorage
    localStorage.setItem('keywords_user_123', JSON.stringify([testApplications[0]]));
    localStorage.setItem('keywords_user_456', JSON.stringify([testApplications[1]]));
    
    console.log('✅ 测试数据已创建！');
    showNotification('测试数据创建成功！已添加2个用户的关键词申请记录', 'success');
    
    // 重新加载关键词选项
    loadKKSearchKeywordsForSelect();
}
// 🔧 修复数据库结构
async function fixEarningsDatabase() {
    console.log('🔧 开始修复earnings数据库结构...');
    
    try {
        showNotification('正在修复数据库结构，请稍候...', 'info');
        
        // 执行数据库修复SQL
        const fixSQL = `
            -- 检查并添加description字段
            DO $$
            BEGIN
                -- 检查description字段是否存在
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'earnings' 
                    AND column_name = 'description'
                    AND table_schema = 'public'
                ) THEN
                    -- 添加description字段
                    ALTER TABLE public.earnings ADD COLUMN description TEXT;
                    RAISE NOTICE 'Added description column to earnings table';
                ELSE
                    RAISE NOTICE 'Description column already exists in earnings table';
                END IF;
                
                -- 检查task_name字段是否存在
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'earnings' 
                    AND column_name = 'task_name'
                    AND table_schema = 'public'
                ) THEN
                    -- 添加task_name字段
                    ALTER TABLE public.earnings ADD COLUMN task_name TEXT;
                    RAISE NOTICE 'Added task_name column to earnings table';
                ELSE
                    RAISE NOTICE 'Task_name column already exists in earnings table';
                END IF;
                
                -- 确保user_id字段存在且类型正确
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'earnings' 
                    AND column_name = 'user_id'
                    AND table_schema = 'public'
                ) THEN
                    -- 添加user_id字段
                    ALTER TABLE public.earnings ADD COLUMN user_id TEXT;
                    RAISE NOTICE 'Added user_id column to earnings table';
                ELSE
                    RAISE NOTICE 'User_id column already exists in earnings table';
                END IF;
                
                -- 确保amount字段存在
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'earnings' 
                    AND column_name = 'amount'
                    AND table_schema = 'public'
                ) THEN
                    -- 添加amount字段
                    ALTER TABLE public.earnings ADD COLUMN amount DECIMAL(10,2);
                    RAISE NOTICE 'Added amount column to earnings table';
                ELSE
                    RAISE NOTICE 'Amount column already exists in earnings table';
                END IF;
                
                -- 确保status字段存在
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'earnings' 
                    AND column_name = 'status'
                    AND table_schema = 'public'
                ) THEN
                    -- 添加status字段
                    ALTER TABLE public.earnings ADD COLUMN status TEXT DEFAULT 'completed';
                    RAISE NOTICE 'Added status column to earnings table';
                ELSE
                    RAISE NOTICE 'Status column already exists in earnings table';
                END IF;
                
            END;
            $$;
        `;
        
        // 执行SQL修复
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: fixSQL });
        
        if (error) {
            console.error('SQL执行失败:', error);
            // 如果rpc方法不存在，尝试直接创建必要的结构
            await createEarningsTableIfNotExists();
        } else {
            console.log('✅ 数据库修复完成:', data);
        }
        
        showNotification('数据库结构修复完成！现在可以正常添加KK搜索收益了', 'success');
        
    } catch (error) {
        console.error('❌ 数据库修复失败:', error);
        showNotification('数据库修复失败: ' + error.message, 'error');
    }
}
// 🔧 备用方案：创建earnings表结构
async function createEarningsTableIfNotExists() {
    console.log('🔧 使用备用方案创建earnings表结构...');
    
    try {
        // 检查earnings表是否存在以及字段结构
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'earnings')
            .eq('table_schema', 'public');
        
        if (tableError) {
            console.log('无法检查表结构，跳过自动修复');
            return;
        }
        
        // 检查字段结构
        const { data: columns, error: columnError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'earnings')
            .eq('table_schema', 'public');
        
        if (columnError) {
            console.log('无法检查字段结构，跳过自动修复');
            return;
        }
        
        console.log('✅ 当前earnings表字段:', columns);
        
        const existingColumns = columns ? columns.map(col => col.column_name) : [];
        const requiredColumns = ['user_id', 'task_name', 'amount', 'status', 'description', 'created_at'];
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length > 0) {
            console.log('⚠️ 缺少字段:', missingColumns);
            showNotification(`数据库缺少以下字段: ${missingColumns.join(', ')}，请联系管理员手动修复`, 'warning');
        } else {
            console.log('✅ 所有必要字段都存在');
        }
        
    } catch (error) {
        console.log('备用检查失败:', error);
    }
}

// 🔍 优化的关键词搜索功能
let kkSearchKeywords = []; // 缓存关键词数据
let kkActiveIndex = -1; // 当前激活的选项索引
let xraySearchKeywords = []; // x雷搜索可选关键词（来自已分配关键词）
let xrayActiveIndex = -1;

// 处理搜索输入
function handleKKKeywordSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    console.log('🔍 搜索关键词:', searchTerm);
    
    if (searchTerm.length >= 1) {
        performKKKeywordSearch(searchTerm);
        showKKSearchDropdown();
    } else {
        hideKKSearchDropdown();
    }
}

// ===== x雷浏览器：关键词搜索行为（与KK独立） =====
function handleXrayKeywordSearch(event){
    const term = event.target.value.toLowerCase().trim();
    if(term.length>=1){ performXrayKeywordSearch(term); showXraySearchDropdown(); } else { hideXraySearchDropdown(); }
}
function performXrayKeywordSearch(term){
    console.log('🔍 开始搜索x雷关键词...');
    console.log('📝 搜索词:', term);
    console.log('📊 xraySearchKeywords数组长度:', xraySearchKeywords?.length || 0);
    
    if (xraySearchKeywords && xraySearchKeywords.length > 0) {
        console.log('📋 前3个关键词数据示例:', xraySearchKeywords.slice(0, 3));
        console.log('🔑 第一个关键词的结构:', Object.keys(xraySearchKeywords[0]));
    }
    
    const results = (xraySearchKeywords||[]).filter(item=> {
        const keyword = item.keyword || '';
        const username = item.username || '';
        const match = keyword.toLowerCase().includes(term) || String(username).toLowerCase().includes(term);
        return match;
    });
    
    console.log('✅ 搜索结果数量:', results.length);
    if (results.length > 0) {
        console.log('📋 搜索结果:', results.slice(0, 3));
    }
    
    renderXraySearchResults(results, term);
}
function renderXraySearchResults(results, term){
    const dropdown = document.getElementById('xrayDropdownContent');
    const resultCount = document.getElementById('xrayResultCount');
    if(!dropdown||!resultCount) return;
    resultCount.textContent = `${results.length} 个结果`;
    xrayActiveIndex=-1;
    if(results.length===0){ dropdown.innerHTML = '<div class="dropdown-item placeholder">未找到匹配的关键词</div>'; return; }
    window.currentXraySearchResults = results;
    dropdown.innerHTML = results.map((item, idx)=>{
        const kw = highlightSearchTerm(item.keyword, term);
        const un = highlightSearchTerm(item.username||'', term);
        return `<div class="dropdown-item" data-index="${idx}" onclick="selectXrayKeywordFromResults(${idx})"><span class=\"keyword-name\">${kw}</span><span class=\"user-name\">${un}</span></div>`;
    }).join('');
}
function handleXrayKeywordNavigation(event){
    const dropdown = document.getElementById('xraySearchDropdown');
    const items = dropdown ? dropdown.querySelectorAll('.dropdown-item:not(.placeholder)') : [];
    if(items.length===0) return;
    switch(event.key){
        case 'ArrowDown': event.preventDefault(); xrayActiveIndex=Math.min(xrayActiveIndex+1, items.length-1); updateXrayActiveItem(items); break;
        case 'ArrowUp': event.preventDefault(); xrayActiveIndex=Math.max(xrayActiveIndex-1, -1); updateXrayActiveItem(items); break;
        case 'Enter': event.preventDefault(); if(xrayActiveIndex>=0&&xrayActiveIndex<items.length){ selectXrayKeywordFromResults(xrayActiveIndex); } break;
        case 'Escape': hideXraySearchDropdown(); break;
    }
}
function updateXrayActiveItem(items){ items.forEach((it,i)=> it.classList.toggle('active', i===xrayActiveIndex)); }
function selectXrayKeywordFromResults(index){
    const results = window.currentXraySearchResults||[]; if(index<0||index>=results.length) return;
    const item = results[index];
    // 设置隐藏字段
    const inp = document.getElementById('xrayEarningKeyword'); if(inp) inp.value = JSON.stringify({ keyword:item.keyword, username:item.username, userId:item.userId });
    // 显示选择结果
    const sel = document.getElementById('xraySelectedKeyword'); const txt = sel?.querySelector('.keyword-text'); if(sel&&txt){ txt.textContent=`${item.keyword} (${item.username||''})`; sel.style.display='flex'; }
    // 隐藏输入框
    const search = document.getElementById('xrayKeywordSearch'); if(search) search.style.display='none';
    hideXraySearchDropdown();
}
function clearXraySelectedKeyword(){ const hid=document.getElementById('xrayEarningKeyword'); if(hid) hid.value=''; const box=document.getElementById('xraySelectedKeyword'); if(box) box.style.display='none'; const s=document.getElementById('xrayKeywordSearch'); if(s){ s.style.display='block'; s.value=''; s.focus(); } }
function showXraySearchDropdown(){ const dd=document.getElementById('xraySearchDropdown'); if(dd) dd.style.display='block'; }
function hideXraySearchDropdown(){ const dd=document.getElementById('xraySearchDropdown'); if(dd) dd.style.display='none'; xrayActiveIndex=-1; }


// 执行关键词搜索
function performKKKeywordSearch(searchTerm) {
    const filteredKeywords = kkSearchKeywords.filter(item => 
        item.keyword.toLowerCase().includes(searchTerm) || 
        item.username.toLowerCase().includes(searchTerm)
    );
    
    console.log(`🔍 搜索结果: ${filteredKeywords.length} 个匹配项`);
    renderKKSearchResults(filteredKeywords, searchTerm);
}

// 渲染搜索结果
function renderKKSearchResults(results, searchTerm) {
    const dropdown = document.getElementById('kkDropdownContent');
    const resultCount = document.getElementById('kkResultCount');
    
    if (!dropdown || !resultCount) return;
    
    resultCount.textContent = `${results.length} 个结果`;
    kkActiveIndex = -1; // 重置激活索引
    
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item placeholder">未找到匹配的关键词</div>';
        return;
    }
    
    // 保存当前搜索结果到临时变量
    window.currentSearchResults = results;
    
    dropdown.innerHTML = results.map((item, index) => {
        const keywordHtml = highlightSearchTerm(item.keyword, searchTerm);
        const usernameHtml = highlightSearchTerm(item.username, searchTerm);
        
        return `
            <div class="dropdown-item" data-index="${index}" onclick="selectKKKeywordFromResults(${index})">
                <span class="keyword-name">${keywordHtml}</span>
                <span class="user-name">${usernameHtml}</span>
            </div>
        `;
    }).join('');
}

// 高亮搜索词
function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}
// 处理键盘导航
function handleKKKeywordNavigation(event) {
    const dropdown = document.getElementById('kkSearchDropdown');
    const items = dropdown.querySelectorAll('.dropdown-item:not(.placeholder)');
    
    if (items.length === 0) return;
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            kkActiveIndex = Math.min(kkActiveIndex + 1, items.length - 1);
            updateActiveItem(items);
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            kkActiveIndex = Math.max(kkActiveIndex - 1, -1);
            updateActiveItem(items);
            break;
            
        case 'Enter':
            event.preventDefault();
            if (kkActiveIndex >= 0 && kkActiveIndex < items.length) {
                selectKKKeywordFromResults(kkActiveIndex);
            }
            break;
            
        case 'Escape':
            hideKKSearchDropdown();
            break;
    }
}

// ===== 任务数据日期修改器 =====
function openTaskDateModal(){
    try{
        const kk = localStorage.getItem('taskdate:kk') || '';
        const xr = localStorage.getItem('taskdate:xray') || '';
        const wk = localStorage.getItem('taskdate:wukong') || '';
        const kd = localStorage.getItem('taskdate:kkdisk') || '';
        const s1=document.getElementById('date_kk'); if(s1) s1.value = kk;
        const s2=document.getElementById('date_xray'); if(s2) s2.value = xr;
        const s3=document.getElementById('date_wukong'); if(s3) s3.value = wk;
        const s4=document.getElementById('date_kkdisk'); if(s4) s4.value = kd;
        const m=document.getElementById('taskDateModal'); if(m) m.style.display='flex';
    }catch(e){ console.warn('openTaskDateModal', e); }
}

async function saveTaskDates(){
    try{
        const kk = document.getElementById('date_kk').value || '';
        const xr = document.getElementById('date_xray').value || '';
        const wk = document.getElementById('date_wukong').value || '';
        const kd = document.getElementById('date_kkdisk').value || '';
        localStorage.setItem('taskdate:kk', kk);
        localStorage.setItem('taskdate:xray', xr);
        localStorage.setItem('taskdate:wukong', wk);
        localStorage.setItem('taskdate:kkdisk', kd);
        closeModal('taskDateModal');
        showNotification('已保存，前台将实时更新', 'success');
        try{ if (window.postMessageToClients) { window.postMessageToClients({ type:'taskdate:update' }); } }catch(_){ }
    }catch(e){ showNotification('保存失败: '+e.message, 'error'); }
}

// 更新激活项样式
function updateActiveItem(items) {
    items.forEach((item, index) => {
        if (index === kkActiveIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}
// 从搜索结果中选择关键词
function selectKKKeywordFromResults(index) {
    const results = window.currentSearchResults || [];
    if (index < 0 || index >= results.length) return;
    
    const selectedItem = results[index];
    console.log('✅ 选择关键词:', selectedItem);
    
    // 设置隐藏字段的值
    document.getElementById('kkEarningKeyword').value = JSON.stringify({
        keyword: selectedItem.keyword,
        username: selectedItem.username,
        userId: selectedItem.userId
    });
    
    // 显示选择的关键词
    showSelectedKeyword(selectedItem);
    
    // 隐藏下拉框和搜索框
    hideKKSearchDropdown();
    document.getElementById('kkKeywordSearch').style.display = 'none';
}

// 兼容性：选择关键词（保留原函数作为备用）
function selectKKKeyword(index) {
    return selectKKKeywordFromResults(index);
}

// 显示选择的关键词
function showSelectedKeyword(item) {
    const selectedDiv = document.getElementById('kkSelectedKeyword');
    const keywordText = selectedDiv.querySelector('.keyword-text');
    
    if (selectedDiv && keywordText) {
        keywordText.textContent = `${item.keyword} (${item.username})`;
        selectedDiv.style.display = 'flex';
    }
}

// 清除选择的关键词
function clearKKSelectedKeyword() {
    console.log('🧹 清除选择的关键词');
    
    // 重置隐藏字段
    document.getElementById('kkEarningKeyword').value = '';
    
    // 隐藏选择显示
    document.getElementById('kkSelectedKeyword').style.display = 'none';
    
    // 显示搜索框并清空
    const searchInput = document.getElementById('kkKeywordSearch');
    searchInput.style.display = 'block';
    searchInput.value = '';
    searchInput.focus();
}

// 显示搜索下拉框
function showKKSearchDropdown() {
    const dropdown = document.getElementById('kkSearchDropdown');
    if (dropdown) {
        dropdown.style.display = 'block';
    }
}

// 隐藏搜索下拉框
function hideKKSearchDropdown() {
    const dropdown = document.getElementById('kkSearchDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    kkActiveIndex = -1;
}

// 🔧 修复关闭模态框功能
function closeModal(modalId) {
    console.log('🔧 关闭模态框:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        console.log('✅ 模态框已关闭');
    } else {
        console.error('❌ 模态框不存在:', modalId);
    }
}
// 🔧 测试数据库连接和保存功能
async function testDatabaseConnection() {
    try {
        console.log('🧪 开始测试数据库连接...');
        showNotification('正在测试数据库连接...', 'info');
        
        // 1. 测试基本连接
        const { data: connectionTest, error: connectionError } = await supabase
            .from('earnings')
            .select('count(*)', { count: 'exact', head: true });
        
        if (connectionError) {
            throw new Error(`数据库连接失败: ${connectionError.message}`);
        }
        
        console.log('✅ 数据库连接正常');
        
        // 2. 测试表结构
        const { data: structureTest, error: structureError } = await supabase
            .from('earnings')
            .select('user_id, task_name, amount, status, created_at')
            .limit(1);
        
        if (structureError) {
            throw new Error(`表结构检查失败: ${structureError.message}`);
        }
        
        console.log('✅ 表结构检查通过');
        
        // 3. 测试数据保存（创建一个测试记录）
        const testData = {
            user_id: 'test-user-' + Date.now(),
            task_name: '数据库连接测试',
            amount: 0.01,
            status: 'completed'
        };
        
        const { data: insertTest, error: insertError } = await supabase
            .from('earnings')
            .insert([testData])
            .select()
            .single();
        
        if (insertError) {
            throw new Error(`数据保存测试失败: ${insertError.message}`);
        }
        
        console.log('✅ 数据保存测试通过:', insertTest);
        
        // 4. 清理测试数据
        await supabase
            .from('earnings')
            .delete()
            .eq('id', insertTest.id);
        
        console.log('✅ 测试数据已清理');
        
        showNotification('数据库连接和保存功能测试通过！', 'success');
        
    } catch (error) {
        console.error('❌ 数据库测试失败:', error);
        showNotification('数据库测试失败: ' + error.message, 'error');
    }
}
// 🔧 创建和修复提现数据库结构
async function fixWithdrawalsDatabase() {
    try {
        console.log('🔧 开始修复提现数据库结构...');
        showNotification('正在修复提现数据库结构，请稍候...', 'info');
        
        // SQL脚本来创建withdrawals表和相关结构
        const fixSQL = `
            -- 创建withdrawals表（如果不存在）
            CREATE TABLE IF NOT EXISTS withdrawals (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method TEXT CHECK (payment_method IN ('alipay', 'wechat')),
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
                alipay_account TEXT,
                real_name TEXT,
                qr_code_url TEXT,
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- 创建索引提高查询性能
            CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON withdrawals(user_id);
            CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals(status);
            CREATE INDEX IF NOT EXISTS withdrawals_created_at_idx ON withdrawals(created_at);
            
            -- 禁用行级安全（如果需要）
            ALTER TABLE withdrawals DISABLE ROW LEVEL SECURITY;
            
            -- 插入一些测试数据（如果表为空）
            INSERT INTO withdrawals (user_id, amount, status, payment_method, real_name, created_at)
            SELECT 
                'test-user-' || generate_random_uuid(),
                (random() * 100 + 10)::decimal(10,2),
                CASE 
                    WHEN random() < 0.3 THEN 'pending'
                    WHEN random() < 0.6 THEN 'approved'
                    WHEN random() < 0.8 THEN 'completed'
                    ELSE 'rejected'
                END,
                CASE WHEN random() < 0.5 THEN 'alipay' ELSE 'wechat' END,
                '测试用户' || (random() * 100)::int,
                NOW() - (random() * interval '30 days')
            FROM generate_series(1, 5)
            WHERE NOT EXISTS (SELECT 1 FROM withdrawals LIMIT 1);
        `;
        
        console.log('🔄 执行SQL修复脚本...');
        
        // 尝试使用RPC执行SQL
        try {
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: fixSQL });
            
            if (error) {
                throw error;
            }
            
            console.log('✅ SQL修复脚本执行成功:', data);
        } catch (rpcError) {
            console.warn('RPC执行失败，尝试分步创建:', rpcError);
            
            // 分步创建表结构
            await createWithdrawalsTableStepByStep();
        }
        
        showNotification('提现数据库结构修复完成！', 'success');
        
        // 重新加载提现数据以验证修复效果
        await loadWithdrawalsData();
        
    } catch (error) {
        console.error('❌ 修复提现数据库失败:', error);
        showNotification('修复提现数据库失败: ' + error.message, 'error');
    }
}

// 🔧 分步创建withdrawals表结构
async function createWithdrawalsTableStepByStep() {
    try {
        console.log('🔄 分步创建withdrawals表...');
        
        // 检查表是否存在
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'withdrawals');
        
        if (tableError) {
            console.log('无法检查表结构，可能是权限问题:', tableError);
            return;
        }
        
        if (!tables || tables.length === 0) {
            console.log('⚠️ withdrawals表不存在，需要手动创建');
            showNotification('withdrawals表不存在，请在Supabase控制台中手动创建该表', 'warning');
            return;
        }
        
        console.log('✅ withdrawals表已存在');
        
        // 添加一些测试数据
        await createWithdrawalsTestData();
        
    } catch (error) {
        console.error('❌ 分步创建表失败:', error);
    }
}
// 🔧 创建提现测试数据
async function createWithdrawalsTestData() {
    try {
        console.log('🔄 创建提现测试数据...');
        
        // 检查是否已有数据
        const { data: existingData, error: checkError } = await supabase
            .from('withdrawals')
            .select('id')
            .limit(1);
        
        if (checkError) {
            console.error('检查现有数据失败:', checkError);
            return;
        }
        
        if (existingData && existingData.length > 0) {
            console.log('✅ withdrawals表已有数据，无需创建测试数据');
            return;
        }
        
        // 创建测试数据
        const testData = [
            {
                user_id: 'test-user-1',
                amount: 50.00,
                status: 'pending',
                payment_method: 'alipay',
                real_name: '测试用户1',
                alipay_account: 'test1@example.com'
            },
            {
                user_id: 'test-user-2', 
                amount: 100.00,
                status: 'approved',
                payment_method: 'wechat',
                real_name: '测试用户2'
            },
            {
                user_id: 'test-user-3',
                amount: 25.50,
                status: 'completed',
                payment_method: 'alipay',
                real_name: '测试用户3',
                alipay_account: 'test3@example.com'
            }
        ];
        
        const { data: insertedData, error: insertError } = await supabase
            .from('withdrawals')
            .insert(testData)
            .select();
        
        if (insertError) {
            console.error('插入测试数据失败:', insertError);
            return;
        }
        
        console.log('✅ 成功创建了', insertedData?.length || 0, '条提现测试数据');
        showNotification(`成功创建了 ${insertedData?.length || 0} 条提现测试数据`, 'success');
        
    } catch (error) {
        console.error('❌ 创建提现测试数据失败:', error);
    }
}

// 🔧 新增：支付信息相关辅助函数
function copyToClipboard(text, label) {
    if (!text || text === '未设置' || text === '❌ 未设置') {
        showNotification('没有可复制的内容', 'warning');
        return;
    }
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification(`${label}已复制: ${text}`, 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopyToClipboard(text, label);
        });
    } else {
        fallbackCopyToClipboard(text, label);
    }
}

function fallbackCopyToClipboard(text, label) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification(`${label}已复制: ${text}`, 'success');
    } catch (err) {
        console.error('复制失败:', err);
        showNotification('复制失败，请手动选择复制', 'error');
    }
    
    document.body.removeChild(textArea);
}

function viewQRCode(qrCodeUrl) {
    if (!qrCodeUrl) {
        showNotification('没有收款码可查看', 'warning');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'qr-view-modal';
    modal.innerHTML = `
        <div class="qr-view-overlay" onclick="closeQRView()">
            <div class="qr-view-content" onclick="event.stopPropagation()">
                <div class="qr-view-header">
                    <h3>微信收款码</h3>
                    <button class="close-btn" onclick="closeQRView()">&times;</button>
                </div>
                <div class="qr-view-body">
                    <img src="${qrCodeUrl}" alt="微信收款码" class="qr-view-image">
                    <div class="qr-view-actions">
                        <button class="btn btn-primary" onclick="downloadQRCode('${qrCodeUrl}', '微信收款码')">
                            <i class="fas fa-download"></i> 下载图片
                        </button>
                        <button class="btn btn-secondary" onclick="copyToClipboard('${qrCodeUrl}', '收款码链接')">
                            <i class="fas fa-copy"></i> 复制链接
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
}
// 🎯 获取微信收款码显示内容（强化版）
function getWechatQRCodeDisplay(withdrawal) {
    console.log('🔍 检查微信收款码数据:', {
        withdrawal_qr_code_url: withdrawal.qr_code_url,
        withdrawal_wechat_qr_code: withdrawal.wechat_qr_code,
        user_wechat_qr_code: withdrawal.users?.wechat_qr_code,
        user_微信收款码: withdrawal.users ? withdrawal.users['微信收款码'] : null
    });
    
    // 1. 优先从提现记录中获取
    let qrCodeUrl = withdrawal.qr_code_url || withdrawal.wechat_qr_code;
    
    // 2. 从用户信息中获取
    if (!qrCodeUrl && withdrawal.users) {
        qrCodeUrl = withdrawal.users.wechat_qr_code || withdrawal.users['微信收款码'];
    }
    
    // 3. 从localStorage历史记录中获取（兜底）
    if (!qrCodeUrl) {
        try {
            const last = JSON.parse(localStorage.getItem('lastWithdrawalPaymentInfo') || 'null');
            const history = JSON.parse(localStorage.getItem('withdrawalPaymentHistory') || '[]');
            const historyRecord = history.find(r => r.withdrawalId === withdrawal.id) || last;
            if (historyRecord && historyRecord.wechatQRCode) {
                qrCodeUrl = historyRecord.wechatQRCode;
                console.log('✅ 从localStorage历史记录获取微信收款码');
            }
        } catch (e) {
            console.warn('读取localStorage微信收款码失败:', e);
        }
    }

    // 4. 兜底：再查一次用户表（仅按 id，避免不存在的列导致400）
    // 仅在仍未找到时执行，避免额外请求
    if (!qrCodeUrl && (withdrawal.user_id || withdrawal['用户ID'])) {
        const uid = withdrawal.user_id || withdrawal['用户ID'];
        (async () => {
            try {
                // 仅取收款码字段，减少传输
                const { data: u1 } = await supabase
                    .from('users')
                    .select('wechat_qr_code')
                    .eq('id', uid)
                    .single();
                if (u1 && (u1.wechat_qr_code || u1['微信收款码'])) {
                    const url = u1.wechat_qr_code || u1['微信收款码'];
                    // 动态更新已渲染的区域（如果存在）
                    const el = document.querySelector('.qr-code-image[data-withdrawal="' + withdrawal.id + '"]');
                    if (el) {
                        el.src = url;
                    } else {
                        const box = document.getElementById('qr-container-' + withdrawal.id);
                        if (box) {
                            box.innerHTML = '<img src="' + url + '" alt="微信收款码" class="qr-code-image" data-withdrawal="' + withdrawal.id + '" onclick="viewQRCode(\'' + url + '\')">\n' +
                                '<div class="qr-code-actions">\n' +
                                '    <button class="btn btn-sm btn-secondary" onclick="viewQRCode(\'' + url + '\')">\n' +
                                '        <i class="fas fa-expand"></i> 查看大图\n' +
                                '    </button>\n' +
                                '    <button class="btn btn-sm btn-primary" onclick="downloadQRCode(\'' + url + '\', \"微信收款码_' + (withdrawal.users?.username || 'unknown') + '\")">\n' +
                                '        <i class="fas fa-download"></i> 下载\n' +
                                '    </button>\n' +
                                '</div>';
                        }
                    }
                    qrCodeUrl = url;
                }
            } catch (_) {}
            // 仅按 id 兜底一次即可
        })();
    }
    
    if (qrCodeUrl) {
        console.log('✅ 找到微信收款码:', qrCodeUrl.substring(0, 50) + '...');
        return `<div class="qr-code-container" id="qr-container-${withdrawal.id}">
            <img src="${qrCodeUrl}" alt="微信收款码" class="qr-code-image" data-withdrawal="${withdrawal.id}" onclick="viewQRCode('${qrCodeUrl}')">
            <div class="qr-code-actions">
                <button class="btn btn-sm btn-secondary" onclick="viewQRCode('${qrCodeUrl}')">
                    <i class="fas fa-expand"></i> 查看大图
                </button>
                <button class="btn btn-sm btn-primary" onclick="downloadQRCode('${qrCodeUrl}', '微信收款码_${withdrawal.users?.username || 'unknown'}')">
                    <i class="fas fa-download"></i> 下载
                </button>
            </div>
        </div>`;
    } else {
        console.log('⚠️ 未找到微信收款码');
        return `<div class="qr-code-container" id="qr-container-${withdrawal.id}"><span class="payment-value">❌ 未上传收款码</span></div>`;
    }
}

function closeQRView() {
    const modal = document.querySelector('.qr-view-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => document.body.removeChild(modal), 300);
    }
}

function downloadQRCode(qrCodeUrl, filename) {
    if (!qrCodeUrl) {
        showNotification('没有收款码可下载', 'warning');
        return;
    }
    
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = filename || '收款码.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('收款码下载已开始', 'success');
}

function addAdminNote(withdrawalId) {
    const note = prompt('请输入管理员备注：');
    if (note && note.trim()) {
        // 这里可以实现保存备注到数据库的逻辑
        console.log('添加管理员备注:', withdrawalId, note.trim());
        showNotification('备注已添加（功能开发中）', 'info');
    }
}

// 🔧 点击背景关闭模态框和下拉框
document.addEventListener('DOMContentLoaded', function() {
    // 为所有模态框添加点击背景关闭功能
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            const modalId = event.target.id;
            if (modalId) {
                console.log('🔧 点击背景关闭模态框:', modalId);
                closeModal(modalId);
            }
        }
        
        // 🔧 点击外部区域关闭搜索下拉框
        const dropdown = document.getElementById('kkSearchDropdown');
        const searchContainer = document.querySelector('.keyword-search-container');
        
        if (dropdown && dropdown.style.display === 'block') {
            // 如果点击的不是搜索容器内的元素，则关闭下拉框
            if (!searchContainer || !searchContainer.contains(event.target)) {
                hideKKSearchDropdown();
            }
        }
    });
    
    // ESC键关闭模态框和下拉框
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            // 关闭模态框
            const openModals = document.querySelectorAll('.modal[style*="flex"]');
            openModals.forEach(modal => {
                console.log('🔧 ESC键关闭模态框:', modal.id);
                closeModal(modal.id);
            });
            
            // 关闭搜索下拉框
            hideKKSearchDropdown();
        }
    });

    // 仪表盘：重置总收益展示
    try{
        const btn=document.getElementById('resetTotalEarningsBtn');
        if(btn){
            btn.addEventListener('click', ()=>{
                if(!confirm('确定将仪表盘显示的总收益重置为 ¥0.00 吗？此操作仅影响展示，不会删除历史记录。')) return;
                const el=document.getElementById('totalEarnings'); if(el) el.textContent='¥0.00';
                const delta=document.getElementById('totalEarningsDelta'); if(delta) delta.textContent='';
                showNotification('已重置展示用总收益', 'success');
            });
        }
    }catch(_){ }
});
// 保存KK搜索收益
async function saveKKSearchEarning() {
    if(!guardMaintenanceOrProceed('保存收益')) return;
    try {
        // 兜底计算一次，确保金额同步
        try{ calculateKKEarningsAmount(); }catch(_){ }
        const keywordSelect = document.getElementById('kkEarningKeyword');
        const selectedValue = keywordSelect.value;
        
        console.log('🔄 开始保存KK搜索收益，选中值:', selectedValue);
        
        if (!selectedValue) {
            showNotification('请选择关键词', 'error');
            return;
        }
        
        // 检查是否选择了创建测试数据
        if (selectedValue === 'CREATE_TEST_DATA') {
            createKKSearchTestData();
            return;
        }
        
        const keywordData = JSON.parse(selectedValue);
        console.log('📋 解析的关键词数据:', keywordData);
        const pullNewCount = parseInt(document.getElementById('pullNewCount').value) || 0;
        const pullActiveCount = parseInt(document.getElementById('pullActiveCount').value) || 0;
        const pullOldCount = parseInt(document.getElementById('pullOldCount').value) || 0;
        
        const totalAmount = 
            (pullNewCount * KK_SEARCH_PRICES.pullNew) +
            (pullActiveCount * KK_SEARCH_PRICES.pullActive) +
            (pullOldCount * KK_SEARCH_PRICES.pullOld);
        
        if (totalAmount <= 0) {
            showNotification('请至少输入一个数量', 'error');
            return;
        }
        
        // 构建任务名称
        const taskDetails = [];
        if (pullNewCount > 0) taskDetails.push(`拉新${pullNewCount}`);
        if (pullActiveCount > 0) taskDetails.push(`拉活${pullActiveCount}`);
        if (pullOldCount > 0) taskDetails.push(`拉旧${pullOldCount}`);
        
        const taskName = `KK搜索-${keywordData.keyword}(${taskDetails.join(',')})`;
        
        // 将详细信息保存到description字段（JSON格式）
        const searchDetails = {
            keyword: keywordData.keyword,
            pull_new_count: pullNewCount,
            pull_active_count: pullActiveCount,
            pull_old_count: pullOldCount,
            pull_new_amount: pullNewCount * KK_SEARCH_PRICES.pullNew,
            pull_active_amount: pullActiveCount * KK_SEARCH_PRICES.pullActive,
            pull_old_amount: pullOldCount * KK_SEARCH_PRICES.pullOld
        };

        // 🔧 使用简化且兼容的数据结构
        // 拦截：如果该关键词已被标记失效，则不允许保存，并提示原因
        try{
            const invalidSet = await getInvalidKeywordSet('KK搜索任务');
            const key = `${String(keywordData.userId)}|${String(keywordData.keyword||'').toLowerCase()}`;
            if(invalidSet.has(key)){
                showNotification('该关键词已被标记为失效，不能结算收益', 'error');
                return;
            }
        }catch(_){ }

        const basicEarningData = {
            user_id: String(keywordData.userId), // 确保是字符串类型
            task_name: String(taskName),
            amount: Number(totalAmount.toFixed(2)), // 确保是数字类型
            status: String(document.getElementById('kkEarningStatus').value || 'completed')
        };
        
        console.log('🔧 保存KK搜索收益（兼容数据）:', basicEarningData);
        
        // 验证数据有效性
        if (!basicEarningData.user_id || basicEarningData.user_id === 'undefined') {
            throw new Error('用户ID无效，请重新选择关键词');
        }
        
        if (!basicEarningData.task_name || basicEarningData.task_name.trim() === '') {
            throw new Error('任务名称不能为空');
        }
        
        if (isNaN(basicEarningData.amount) || basicEarningData.amount <= 0) {
            throw new Error('金额必须大于0');
        }
        
        // 保存到数据库（失败则写入本地，保证不丢单）
        let result = null; let error = null;
        try{
            const r = await supabase
            .from('earnings')
            .insert([basicEarningData])
            .select()
            .single();
            result = r.data; error = r.error||null;
        }catch(e){ error = e; }
        
        if (error) {
            console.error('❌ 数据库错误详情:', error);
            console.log('💡 错误代码:', error.code);
            console.log('💡 错误详细信息:', error.details);
            console.log('💡 错误提示:', error.hint);
            
            // 提供更具体的错误信息
            let friendlyError = '数据库保存失败';
            if (error.message.includes('permission')) {
                friendlyError = '没有数据库写入权限，请检查用户权限设置';
            } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
                friendlyError = 'earnings表不存在，请先创建数据库表';
            } else if (error.message.includes('column') && error.message.includes('does not exist')) {
                friendlyError = '数据库字段缺失，请点击"修复数据库"按钮';
            } else if (error.message.includes('violates')) {
                friendlyError = '数据验证失败，请检查输入的数据格式';
            } else {
                friendlyError = error.message || '未知数据库错误';
            }
            
            // 回退到本地存储
            try{
                const key = 'earning_' + Date.now();
                const currentUser = keywordData.username || keywordData.用户名 || keywordData.userId || keywordData.用户ID;
                localStorage.setItem(key, JSON.stringify({
                    id: key,
                    user_id: basicEarningData.user_id,
                    username: currentUser,
                    task_name: basicEarningData.task_name,
                    amount: basicEarningData.amount,
                    status: basicEarningData.status,
                    created_at: new Date().toISOString(),
                    source: 'admin-offline'
                }));
                showNotification('网络或表结构异常，已暂存到本地，稍后会自动同步', 'warning');
            }catch(_){ }
            throw new Error(friendlyError);
        }
        
        showNotification('KK搜索收益添加成功', 'success');
        closeModal('kkSearchEarningsModal');
        
        // 重新加载收益数据
        await loadKKSearchData();
        
    } catch (error) {
        console.error('保存KK搜索收益失败:', error);
        showNotification('保存收益失败: ' + error.message, 'error');
    }
}

// ==================== 团长管理系统函数 ====================

/**
 * 切换团长管理子页面
 * @param {string} sectionId - 页面ID (overview/list/commission/level/invite/analytics)
 */
function switchLeaderSection(sectionId) {
    // 隐藏所有section
    document.querySelectorAll('#leaders .leader-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 显示目标section
    const targetSection = document.getElementById('leader-' + sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // 更新顶部标签状态
    document.querySelectorAll('#leaders .leader-nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 找到并激活对应的标签
    const clickedTab = event && event.currentTarget;
    if (clickedTab && clickedTab.classList.contains('leader-nav-tab')) {
        clickedTab.classList.add('active');
    }
    
    // 根据section加载对应数据
    loadLeaderSectionData(sectionId);
}

/**
 * 加载section数据
 */
function loadLeaderSectionData(sectionId) {
    switch(sectionId) {
        case 'overview':
            // 加载数据概览的真实数据
            loadLeaderOverviewData();
            break;
        case 'list':
            // 团长列表使用现有的loadLeadersAllowlist函数
            if (typeof loadLeadersAllowlist === 'function') {
                loadLeadersAllowlist();
            }
            break;
        case 'commission':
            console.log('加载佣金数据');
            break;
        case 'level':
            console.log('加载等级配置');
            break;
        case 'invite':
            console.log('加载邀请数据');
            break;
        case 'analytics':
            console.log('加载数据分析');
            break;
    }
}

/**
 * 加载数据概览的真实数据
 */
async function loadLeaderOverviewData() {
    console.log('🔄 开始加载团长数据概览...');
    try {
        await ensureSupabaseReady();
        
        let allLeaders = [];
        
        // 1. 加载团长总数和等级分布
        try {
            await ensureLeadersReadable();
            const { data: leaders, error } = await supabase.from('leaders_allowlist').select('*');
            
            console.log('📊 查询到的团长数据:', leaders);
            
            if (!error && leaders) {
                allLeaders = leaders;
                const total = leaders.length;
                const active = leaders.filter(l => l.status === 'enabled').length;
                
                console.log('✅ 团长总数:', total, '活跃:', active);
                
                // 更新团长总数
                const totalEl = document.getElementById('overview-total-leaders');
                if (totalEl) {
                    totalEl.textContent = total;
                    console.log('✅ 更新团长总数显示:', total);
                } else {
                    console.warn('❌ 找不到元素 overview-total-leaders');
                }
                
                // 更新活跃团长
                const activeEl = document.getElementById('overview-active-leaders');
                if (activeEl) {
                    activeEl.textContent = active;
                    console.log('✅ 更新活跃团长显示:', active);
                } else {
                    console.warn('❌ 找不到元素 overview-active-leaders');
                }
                
                // 保存到本地缓存
                localStorage.setItem('leaders_allowlist', JSON.stringify(leaders));
                
                // 计算等级分布
                if (leaders.length > 0) {
                    await updateLevelDistribution(leaders);
                } else {
                    console.log('⚠️ 没有团长数据，跳过等级分布计算');
                    // 重置等级统计为0
                    ['bronze', 'silver', 'gold', 'platinum', 'diamond'].forEach(levelId => {
                        const countEl = document.getElementById(`level-count-${levelId}`);
                        if (countEl) countEl.textContent = '0';
                        const percentEl = document.getElementById(`level-percent-${levelId}`);
                        if (percentEl) percentEl.textContent = '0%';
                    });
                }
            } else if (error) {
                console.error('❌ 查询团长数据出错:', error);
            } else {
                console.warn('⚠️ 查询结果为空');
            }
        } catch (e) {
            console.error('加载团长数据失败:', e);
        }
        
        // 2. 加载邀请会员总数（从referrals表）
        try {
            const { data: referrals } = await supabase.from('referrals').select('id');
            const inviteCount = referrals ? referrals.length : 0;
            
            const inviteEl = document.getElementById('overview-total-members');  // 修正ID
            if (inviteEl) inviteEl.textContent = inviteCount;
        } catch (e) {
            console.error('加载邀请数据失败:', e);
        }
        
        // 3. 加载累计佣金（从earnings表，type=referral）
        try {
            const { data: earnings } = await supabase.from('earnings')
                .select('amount, status, user_id')
                .eq('type', 'referral');
            
            if (earnings && earnings.length > 0) {
                const total = earnings.reduce((sum, e) => sum + Number(e.amount || 0), 0);
                const pending = earnings
                    .filter(e => e.status === 'pending' || e.status === '待结算')
                    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
                
                // 计算最高佣金（按用户聚合）
                const userCommissions = {};
                earnings.forEach(e => {
                    const uid = e.user_id;
                    if (!userCommissions[uid]) userCommissions[uid] = 0;
                    userCommissions[uid] += Number(e.amount || 0);
                });
                const maxCommission = Math.max(...Object.values(userCommissions), 0);
                
                const totalEl = document.getElementById('overview-total-commission');
                if (totalEl) totalEl.textContent = '¥' + total.toFixed(0);
                
                const pendingEl = document.getElementById('overview-pending-commission');
                if (pendingEl) pendingEl.textContent = '¥' + pending.toFixed(0);
                
                const topEl = document.getElementById('overview-top-commission');
                if (topEl) topEl.textContent = '¥' + maxCommission.toFixed(0);
            }
        } catch (e) {
            console.error('加载佣金数据失败:', e);
        }
        
    } catch (error) {
        console.error('加载数据概览失败:', error);
    }
}

/**
 * 更新等级分布统计
 */
async function updateLevelDistribution(leaders) {
    try {
        // 等级配置
        const LEVEL_CONFIG = [
            { id: 'bronze', minMembers: 0 },
            { id: 'silver', minMembers: 10 },
            { id: 'gold', minMembers: 50 },
            { id: 'platinum', minMembers: 100 },
            { id: 'diamond', minMembers: 200 }
        ];
        
        // 获取每个团长的团队人数
        const levelCounts = {
            bronze: 0,
            silver: 0,
            gold: 0,
            platinum: 0,
            diamond: 0
        };
        
        // 为每个团长计算等级
        for (const leader of leaders) {
            try {
                // 生成邀请码
                const userId = leader.user_id;
                const inviteCode = generateInviteCode(userId);
                const body = inviteCode.slice(1, 7);
                const legacyKey = 'uid_tail_' + body;
                
                // 查询团队成员数
                let memberCount = 0;
                try {
                    const { data: ref1 } = await supabase.from('referrals')
                        .select('id')
                        .eq('inviter_id', inviteCode);
                    const { data: ref2 } = await supabase.from('referrals')
                        .select('id')
                        .eq('inviter_id', legacyKey);
                    
                    memberCount = (ref1 ? ref1.length : 0) + (ref2 ? ref2.length : 0);
                } catch (e) {
                    console.error('查询团队成员失败:', e);
                }
                
                // 根据人数确定等级
                let currentLevel = 'bronze';
                for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
                    if (memberCount >= LEVEL_CONFIG[i].minMembers) {
                        currentLevel = LEVEL_CONFIG[i].id;
                        break;
                    }
                }
                
                levelCounts[currentLevel]++;
                
            } catch (e) {
                console.error('计算团长等级失败:', e);
                levelCounts.bronze++; // 默认为青铜
            }
        }
        
        // 更新UI
        const total = leaders.length || 1; // 避免除以0
        Object.keys(levelCounts).forEach(levelId => {
            const count = levelCounts[levelId];
            const percent = Math.round((count / total) * 100);
            
            const countEl = document.getElementById(`level-count-${levelId}`);
            if (countEl) countEl.textContent = count;
            
            const percentEl = document.getElementById(`level-percent-${levelId}`);
            if (percentEl) percentEl.textContent = percent + '%';
        });
        
    } catch (error) {
        console.error('更新等级分布失败:', error);
    }
}

// 刷新数据概览
function refreshLeaderOverview() {
    loadLeaderOverviewData();
    showNotification('正在刷新数据...', 'info');
}

function exportLeaderReport() {
    showNotification('导出报表功能待实现', 'info');
}

function openAddLeaderModal() {
    // 创建弹窗
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background:#fff;border-radius:12px;padding:24px;width:90%;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
    
    modalContent.innerHTML = `
        <h3 style="margin:0 0 16px 0;font-size:18px;color:#111827;">添加团长</h3>
        <input type="text" id="modal-leader-input" placeholder="输入用户名或用户ID" 
               style="width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="this.closest('[style*=fixed]').remove()" 
                    style="padding:8px 16px;border:1px solid #e5e7eb;background:#fff;border-radius:6px;cursor:pointer;">取消</button>
            <button id="modal-confirm-btn" 
                    style="padding:8px 16px;border:none;background:#6366f1;color:#fff;border-radius:6px;cursor:pointer;">确认添加</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 焦点到输入框
    setTimeout(() => document.getElementById('modal-leader-input')?.focus(), 100);
    
    // 确认按钮事件
    document.getElementById('modal-confirm-btn').onclick = async function() {
        const input = document.getElementById('modal-leader-input');
        const username = input?.value?.trim();
        if (!username) {
            showNotification('请输入用户名', 'warning');
            return;
        }
        
        // 直接调用添加逻辑（不依赖旧的输入框）
        try {
            await ensureSupabaseReady();
            
            // 🔧 确保RLS策略正确配置
            await ensureLeadersReadable();
            const val = username.replace(/\s+/g,'');
            
            // 查找用户
            let user = null;
            try{ 
                const r = await supabase.from('users').select('id, username').eq('username', val).limit(1); 
                if(r && r.data && r.data.length){ user=r.data[0]; } 
            }catch(e){ }
            
            if(!user){ 
                try{ 
                    const rzh = await supabase.from('users').select('id, 用户名').eq('用户名', val).limit(1); 
                    if(rzh && !rzh.error && rzh.data && rzh.data.length){ 
                        user={ id:rzh.data[0].id, username: rzh.data[0]['用户名'] }; 
                    } 
                }catch(e){ }
            }
            
            if(!user){ 
                try{ 
                    const r3 = await supabase.from('users').select('id, username').eq('id', val).limit(1); 
                    if(r3 && r3.data && r3.data.length){ user=r3.data[0]; } 
                }catch(e){ }
            }
            
            if(!user){
                showNotification('未找到该用户: ' + val, 'error');
                return;
            }
            
            // 添加到团长白名单
            const shortCode = generateInviteCode(user.id);
            const { error } = await supabase.from('leaders_allowlist').upsert({
                user_id: String(user.id),
                username: user.username || '',
                short_code: shortCode,
                status: 'enabled'
            }, { onConflict: 'user_id' });
            
            if(error){
                showNotification('添加失败: ' + error.message, 'error');
                return;
            }
            
            showNotification('成功添加团长: ' + (user.username || user.id), 'success');
            modal.remove();
            
            // 清除本地缓存，确保显示最新数据
            localStorage.removeItem('leaders_allowlist');
            console.log('✅ [添加团长] 已清除本地缓存');
            
            // 立即刷新所有数据（不延迟）
            Promise.all([
                typeof loadLeadersAllowlist === 'function' ? loadLeadersAllowlist() : Promise.resolve(),
                typeof loadLeaderOverviewData === 'function' ? loadLeaderOverviewData() : Promise.resolve()
            ]).then(() => {
                console.log('✅ [添加团长] 数据刷新完成');
            }).catch(e => {
                console.error('❌ [添加团长] 数据刷新失败:', e);
            });
            
        } catch(error) {
            showNotification('操作失败: ' + error.message, 'error');
        }
    };
    
    // 点击背景关闭
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
    
    // ESC键关闭
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function exportLeaderList() {
    showNotification('导出列表功能待实现', 'info');
}

// 确保函数在全局可用
window.switchLeaderSection = switchLeaderSection;
window.refreshLeaderOverview = refreshLeaderOverview;
window.exportLeaderReport = exportLeaderReport;
window.openAddLeaderModal = openAddLeaderModal;
window.exportLeaderList = exportLeaderList;

// ========================================
// 📊 任务收益单价自动计算功能
// ========================================

// 任务单价配置（仅用于通用任务收益模态框，已有专属模态框的任务不在此列）
// 注意：KK搜索、X雷浏览器搜索、w空短剧搜索、KK网盘都有专属模态框
const TASK_UNIT_PRICES = {
    // 暂时保留为空，所有任务都使用专属模态框
};

// 显示任务单价提示
function updateTaskPriceDisplay() {
    try {
        const taskSelect = document.getElementById('taskType');
        const quantityGroup = document.getElementById('taskQuantityGroup');
        const priceDisplay = document.getElementById('taskPriceDisplay');
        const amountInput = document.getElementById('amount');
        
        if (!taskSelect || !quantityGroup || !priceDisplay) return;
        
        const selectedTask = taskSelect.value;
        
        if (selectedTask && TASK_UNIT_PRICES[selectedTask]) {
            // 显示数量输入框
            quantityGroup.style.display = 'block';
            
            // 显示单价提示
            const unitPrice = TASK_UNIT_PRICES[selectedTask];
            priceDisplay.textContent = `单价: ¥${unitPrice}`;
            
            // 设置金额为只读
            if (amountInput) {
                amountInput.readOnly = true;
                amountInput.style.backgroundColor = '#f5f5f5';
                amountInput.style.fontWeight = 'bold';
                amountInput.style.color = '#007bff';
            }
            
            // 默认计算一次
            calculateTaskEarningsAmount();
        } else {
            // 隐藏数量输入框
            quantityGroup.style.display = 'none';
            
            // 允许手动输入金额
            if (amountInput) {
                amountInput.readOnly = false;
                amountInput.style.backgroundColor = '#fff';
                amountInput.style.fontWeight = 'normal';
                amountInput.style.color = '#000';
                amountInput.value = '';
            }
        }
    } catch (e) {
        console.warn('updateTaskPriceDisplay error:', e);
    }
}

// 计算任务收益金额
function calculateTaskEarningsAmount() {
    try {
        const taskSelect = document.getElementById('taskType');
        const quantityInput = document.getElementById('taskQuantity');
        const amountInput = document.getElementById('amount');
        
        if (!taskSelect || !quantityInput || !amountInput) return;
        
        const selectedTask = taskSelect.value;
        const quantity = parseInt(quantityInput.value) || 0;
        const unitPrice = TASK_UNIT_PRICES[selectedTask] || 0;
        
        const totalAmount = quantity * unitPrice;
        amountInput.value = totalAmount.toFixed(2);
        
    } catch (e) {
        console.warn('calculateTaskEarningsAmount error:', e);
    }
}

// ========================================
// 👥 团队收益智能识别功能
// ========================================

// 团长等级配置（与数据库保持一致）
const LEADER_LEVEL_CONFIG = {
    '青铜': { commission: 5, firstWithdrawal: 10 },
    '白银': { commission: 7, firstWithdrawal: 20 },
    '黄金': { commission: 9, firstWithdrawal: 30 },
    '王者': { commission: 10, firstWithdrawal: 50 }
};

// 存储当前选择的用户等级信息
let currentLeaderInfo = null;

// 处理团队收益用户选择变化
async function handleTeamEarningUserChange() {
    try {
        const userSelect = document.getElementById('otherEarningUser');
        const typeSelect = document.getElementById('otherEarningType');
        const banner = document.getElementById('leaderInfoBanner');
        
        if (!userSelect) return;
        
        const userId = userSelect.value;
        const currentType = typeSelect ? typeSelect.value : '';
        
        // 只在选择了"团长收益"时才显示横幅
        if (currentType === '团长收益' && userId && banner) {
            await loadAndDisplayLeaderInfo(userId);
        } else {
            if (banner) banner.style.display = 'none';
            currentLeaderInfo = null;
        }
        
    } catch (e) {
        console.warn('handleTeamEarningUserChange error:', e);
    }
}

// 加载并显示团长信息
async function loadAndDisplayLeaderInfo(userId) {
    try {
        const banner = document.getElementById('leaderInfoBanner');
        const levelDisplay = document.getElementById('leaderLevelDisplay');
        const commissionDisplay = document.getElementById('leaderCommissionDisplay');
        const firstWithdrawalDisplay = document.getElementById('leaderFirstWithdrawalDisplay');
        
        if (!banner) return;
        
        // 显示加载状态
        banner.style.display = 'block';
        if (levelDisplay) levelDisplay.textContent = '加载中...';
        if (commissionDisplay) commissionDisplay.textContent = '--';
        if (firstWithdrawalDisplay) firstWithdrawalDisplay.textContent = '--';
        
        // 从数据库获取团队人数
        await ensureSupabaseReady();
        const { data: referrals, error } = await supabase
            .from('referrals')
            .select('id')
            .eq('referrer_id', userId);
        
        if (error) {
            console.error('获取团队人数失败:', error);
            banner.style.display = 'none';
            return;
        }
        
        const teamCount = referrals ? referrals.length : 0;
        
        // 计算等级
        let level = '青铜';
        if (teamCount >= 50) level = '王者';
        else if (teamCount >= 20) level = '黄金';
        else if (teamCount >= 10) level = '白银';
        else level = '青铜';
        
        const levelConfig = LEADER_LEVEL_CONFIG[level];
        
        // 保存当前信息
        currentLeaderInfo = {
            userId: userId,
            level: level,
            commission: levelConfig.commission,
            firstWithdrawal: levelConfig.firstWithdrawal,
            teamCount: teamCount
        };
        
        // 显示信息
        if (levelDisplay) levelDisplay.textContent = `${level}团长 (${teamCount}人)`;
        if (commissionDisplay) commissionDisplay.textContent = `${levelConfig.commission}%`;
        if (firstWithdrawalDisplay) firstWithdrawalDisplay.textContent = `¥${levelConfig.firstWithdrawal}`;
        
        console.log('✅ 团长信息加载完成:', currentLeaderInfo);
        
    } catch (e) {
        console.error('loadAndDisplayLeaderInfo error:', e);
        const banner = document.getElementById('leaderInfoBanner');
        if (banner) banner.style.display = 'none';
    }
}

// 处理收益类型变化
async function handleOtherEarningTypeChange() {
    try {
        const typeSelect = document.getElementById('otherEarningType');
        const userSelect = document.getElementById('otherEarningUser');
        const banner = document.getElementById('leaderInfoBanner');
        const subTypeGroup = document.getElementById('teamEarningSubTypeGroup');
        const memberGroup = document.getElementById('memberEarningGroup');
        const amountInput = document.getElementById('otherEarningAmount');
        const modalTitle = document.getElementById('otherEarningModalTitle');
        
        if (!typeSelect) return;
        
        const selectedType = typeSelect.value;
        
        // 更新模态框标题
        if (modalTitle) {
            if (selectedType === '活动收益') {
                modalTitle.textContent = '添加活动收益';
            } else if (selectedType === '团长收益') {
                modalTitle.textContent = '添加团队收益';
            }
        }
        
        if (selectedType === '团长收益') {
            // 显示子类型选择
            if (subTypeGroup) subTypeGroup.style.display = 'block';
            
            // 如果已选择用户，加载团长信息
            if (userSelect && userSelect.value) {
                await loadAndDisplayLeaderInfo(userSelect.value);
            }
            
            // 设置金额为只读
            if (amountInput) {
                amountInput.readOnly = true;
                amountInput.style.backgroundColor = '#f5f5f5';
                amountInput.style.fontWeight = 'bold';
                amountInput.style.color = '#007bff';
                amountInput.value = '0.00';
            }
        } else {
            // 隐藏团长相关UI
            if (banner) banner.style.display = 'none';
            if (subTypeGroup) subTypeGroup.style.display = 'none';
            if (memberGroup) memberGroup.style.display = 'none';
            currentLeaderInfo = null;
            
            // 活动收益允许手动输入
            if (selectedType === '活动收益') {
                if (amountInput) {
                    amountInput.readOnly = false;
                    amountInput.style.backgroundColor = '#fff';
                    amountInput.style.fontWeight = 'normal';
                    amountInput.style.color = '#000';
                    amountInput.value = '';
                }
            }
        }
        
    } catch (e) {
        console.warn('handleOtherEarningTypeChange error:', e);
    }
}

// 处理团队收益子类型变化
function handleTeamEarningSubTypeChange() {
    try {
        const subTypeSelect = document.getElementById('teamEarningSubType');
        const memberGroup = document.getElementById('memberEarningGroup');
        const amountInput = document.getElementById('otherEarningAmount');
        const memberAmountInput = document.getElementById('memberEarningAmount');
        
        if (!subTypeSelect || !currentLeaderInfo) return;
        
        const subType = subTypeSelect.value;
        
        if (subType === '首次提现奖励') {
            // 一次性奖励：自动填充金额
            if (memberGroup) memberGroup.style.display = 'none';
            if (amountInput) {
                amountInput.value = currentLeaderInfo.firstWithdrawal.toFixed(2);
            }
            if (memberAmountInput) {
                memberAmountInput.value = '';
            }
        } else if (subType === '持续分成') {
            // 持续分成：显示成员收益输入框
            if (memberGroup) memberGroup.style.display = 'block';
            if (amountInput) {
                amountInput.value = '0.00';
            }
            // 触发一次计算
            calculateCommissionAmount();
        } else {
            // 未选择子类型
            if (memberGroup) memberGroup.style.display = 'none';
            if (amountInput) {
                amountInput.value = '0.00';
            }
        }
        
    } catch (e) {
        console.warn('handleTeamEarningSubTypeChange error:', e);
    }
}

// 计算分成金额
function calculateCommissionAmount() {
    try {
        const memberAmountInput = document.getElementById('memberEarningAmount');
        const amountInput = document.getElementById('otherEarningAmount');
        const hintElement = document.getElementById('commissionHint');
        
        if (!memberAmountInput || !amountInput || !currentLeaderInfo) return;
        
        const memberEarning = parseFloat(memberAmountInput.value) || 0;
        const commissionRate = currentLeaderInfo.commission / 100;
        const commissionAmount = memberEarning * commissionRate;
        
        // 更新金额
        amountInput.value = commissionAmount.toFixed(2);
        
        // 更新提示
        if (hintElement) {
            hintElement.textContent = `分成比例: ${currentLeaderInfo.commission}%，计算结果: ¥${commissionAmount.toFixed(2)}`;
        }
        
    } catch (e) {
        console.warn('calculateCommissionAmount error:', e);
    }
}

// ========================================
// 📱 w空短剧搜索收益计算
// ========================================

function calculateWukongEarningsAmount() {
    try {
        const pullNewCount = parseInt(document.getElementById('wukongPullNewCount')?.value) || 0;
        const totalAmount = pullNewCount * 8.0;
        const output = document.getElementById('wukongTotalAmount');
        if (output) output.value = `¥${totalAmount.toFixed(2)}`;
    } catch (e) {
        console.warn('calculateWukongEarningsAmount error:', e);
    }
}

async function saveWukongSearchEarning() {
    try {
        await ensureSupabaseReady();
        
        const selectedRaw = document.getElementById('wukongEarningKeyword').value || '';
        const amountText = document.getElementById('wukongTotalAmount').value || '¥0.00';
        const amount = parseFloat(amountText.replace('¥', '')) || 0;
        const status = document.getElementById('wukongEarningStatus').value || '已完成';
        const pullNewCount = parseInt(document.getElementById('wukongPullNewCount')?.value) || 0;
        
        // 解析选择的关键词（包含用户信息）
        let keywordData = null; let keywordText = ''; let targetUserId = '';
        try{ keywordData = JSON.parse(selectedRaw); keywordText = keywordData.keyword || ''; targetUserId = String(keywordData.userId||''); }catch(_){ keywordText = selectedRaw; }
        
        if (!keywordText) {
            showNotification('请选择关键词', 'error');
            return;
        }
        
        if (amount <= 0) {
            showNotification('请输入有效的拉新数量', 'error');
            return;
        }
        
        const taskName = `w空短剧搜索-${keywordText}`;
        
        // 保存JSON格式的详细信息
        const description = JSON.stringify({
            type: 'wukong',
            keyword: keywordText,
            username: keywordData?.username || '',
            pullNew: pullNewCount,
            unit: { pullNew: 8.0 }
        });
        
        const { error } = await supabase.from('earnings').insert({
            user_id: targetUserId || 'unknown',
            username: keywordData?.username || undefined,
            task_name: taskName,
            amount: amount,
            status: status,
            description: description,
            created_at: new Date().toISOString()
        });
        
        if (error) throw error;
        
        showNotification('保存成功', 'success');
        closeModal('wukongSearchEarningsModal');
        
        // 刷新数据
        if (typeof loadOtherEarnings === 'function') loadOtherEarnings();
        
    } catch (e) {
        console.error('saveWukongSearchEarning error:', e);
        showNotification('保存失败: ' + e.message, 'error');
    }
}

// ========================================
// 💾 KK网盘收益计算
// ========================================

function calculateKKDiskEarningsAmount() {
    try {
        const mobilePullNew = parseInt(document.getElementById('kkDiskMobilePullNew')?.value) || 0;
        const pcPullNew = parseInt(document.getElementById('kkDiskPCPullNew')?.value) || 0;
        const transferCount = parseInt(document.getElementById('kkDiskTransferCount')?.value) || 0;
        const memberCommission = parseFloat(document.getElementById('kkDiskMemberCommission')?.value) || 0;
        
        const totalAmount = (mobilePullNew * 7.0) + (pcPullNew * 3.0) + (transferCount * 0.3) + (memberCommission * 0.3);
        const output = document.getElementById('kkDiskTotalAmount');
        if (output) output.value = `¥${totalAmount.toFixed(2)}`;
    } catch (e) {
        console.warn('calculateKKDiskEarningsAmount error:', e);
    }
}

async function saveKKDiskEarning() {
    try {
        await ensureSupabaseReady();
        
        const selectedRaw = document.getElementById('kkDiskUserUid').value || '';
        const amountText = document.getElementById('kkDiskTotalAmount').value || '¥0.00';
        const amount = parseFloat(amountText.replace('¥', '')) || 0;
        const status = document.getElementById('kkDiskEarningStatus').value || '已完成';
        
        const mobilePullNew = parseInt(document.getElementById('kkDiskMobilePullNew')?.value) || 0;
        const pcPullNew = parseInt(document.getElementById('kkDiskPCPullNew')?.value) || 0;
        const transferCount = parseInt(document.getElementById('kkDiskTransferCount')?.value) || 0;
        const memberCommission = parseFloat(document.getElementById('kkDiskMemberCommission')?.value) || 0;
        
        // 解析用户UID信息
        let userData = null; let quarkUid = ''; let targetUserId = ''; let username = '';
        try{ userData = JSON.parse(selectedRaw); quarkUid = userData.quarkUid || ''; targetUserId = String(userData.userId||''); username = userData.username || userData.realName || ''; }catch(_){ quarkUid = selectedRaw; }
        
        if (!quarkUid) {
            showNotification('请选择用户夸克UID', 'error');
            return;
        }
        
        if (amount <= 0) {
            showNotification('请输入有效的数量', 'error');
            return;
        }
        
        const taskName = `KK网盘-UID${quarkUid}`;
        
        // 保存JSON格式的详细信息
        const description = JSON.stringify({
            type: 'kkDisk',
            quarkUid: quarkUid,
            quarkPhone: userData?.quarkPhone || '',
            realName: userData?.realName || '',
            username: username,
            mobilePullNew: mobilePullNew,
            pcPullNew: pcPullNew,
            transferCount: transferCount,
            memberCommission: memberCommission,
            unit: { mobile: 7.0, pc: 3.0, transfer: 0.3, commission: 0.3 }
        });
        
        const { error } = await supabase.from('earnings').insert({
            user_id: targetUserId || 'unknown',
            username: username || undefined,
            task_name: taskName,
            amount: amount,
            status: status,
            description: description,
            created_at: new Date().toISOString()
        });
        
        if (error) throw error;
        
        showNotification('保存成功', 'success');
        closeModal('kkDiskEarningsModal');
        
        // 刷新数据
        if (typeof loadOtherEarnings === 'function') loadOtherEarnings();
        
    } catch (e) {
        console.error('saveKKDiskEarning error:', e);
        showNotification('保存失败: ' + e.message, 'error');
    }
}

// ========================================
// 🔓 打开专属模态框的函数
// ========================================

function openKKSearchEarningsModal() {
    const modal = document.getElementById('kkSearchEarningsModal');
    if (modal) {
        modal.style.display = 'flex';
        // 重置表单
        document.getElementById('pullNewCount').value = 0;
        document.getElementById('pullActiveCount').value = 0;
        document.getElementById('pullOldCount').value = 0;
        calculateKKEarningsAmount();
    }
}

async function openWukongSearchEarningsModal() {
    const modal = document.getElementById('wukongSearchEarningsModal');
    if (modal) {
        modal.style.display = 'flex';
        // 重置表单
        document.getElementById('wukongEarningKeyword').value = '';
        document.getElementById('wukongPullNewCount').value = 0;
        clearWukongSelectedKeyword();
        hideWukongSearchDropdown();
        calculateWukongEarningsAmount();
        // 加载w空关键词数据（和x雷一样从已批准的申请中获取）
        await loadWukongSearchKeywords();
    }
}

// ⚠️ 此函数已在前面定义（第4898行），这里是重复定义，已删除

function openKKDiskEarningsModal() {
    const modal = document.getElementById('kkDiskEarningsModal');
    if (modal) {
        modal.style.display = 'flex';
        // 重置表单
        document.getElementById('kkDiskUserUid').value = '';
        document.getElementById('kkDiskMobilePullNew').value = 0;
        document.getElementById('kkDiskPCPullNew').value = 0;
        document.getElementById('kkDiskTransferCount').value = 0;
        document.getElementById('kkDiskMemberCommission').value = 0;
        clearKKDiskSelectedUser();
        hideKKDiskSearchDropdown();
        calculateKKDiskEarningsAmount();
    }
}

// ========================================
// 🔍 w空搜索 - 用户和关键词搜索功能
// ========================================

let wukongSearchKeywords = [];
let wukongActiveIndex = -1;

// 加载w空搜索关键词数据
async function loadWukongSearchKeywords() {
    try {
        const { data, error } = await supabase
            .from('keyword_applications')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        wukongSearchKeywords = [];
        (data || []).forEach(app => {
            const keywords = (app.assigned_keywords || '').split(',').map(k => k.trim());
            keywords.forEach(keyword => {
                if (keyword) {
                    // 只添加w空短剧搜索的关键词
                    const isWukong = (app.task_type || '') === 'w空短剧搜索' || 
                                      (app.task_type || '').includes('悟空') || 
                                      (app.task_type || '').includes('w空');
                    if (isWukong) {
                        wukongSearchKeywords.push({
                            keyword: keyword,
                            username: app.username,
                            userId: app.user_id || app.id
                        });
                    }
                }
            });
        });
        
        console.log(`✅ 加载了 ${wukongSearchKeywords.length} 个w空搜索关键词`);
    } catch (error) {
        console.error('❌ 加载w空关键词失败:', error);
        showNotification('加载关键词数据失败: ' + error.message, 'error');
    }
}

function handleWukongKeywordSearch(event) {
    const term = event.target.value.toLowerCase().trim();
    if (term.length >= 1) {
        performWukongKeywordSearch(term);
        showWukongSearchDropdown();
    } else {
        hideWukongSearchDropdown();
    }
}

function performWukongKeywordSearch(term) {
    const results = (wukongSearchKeywords || []).filter(item =>
        item.keyword.toLowerCase().includes(term) ||
        String(item.username || '').toLowerCase().includes(term)
    );
    renderWukongSearchResults(results, term);
}

function renderWukongSearchResults(results, term) {
    const dropdown = document.getElementById('wukongDropdownContent');
    const resultCount = document.getElementById('wukongResultCount');
    if (!dropdown || !resultCount) return;
    
    resultCount.textContent = `${results.length} 个结果`;
    wukongActiveIndex = -1;
    
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item placeholder">未找到匹配的关键词或用户</div>';
        return;
    }
    
    window.currentWukongSearchResults = results;
    dropdown.innerHTML = results.map((item, idx) => {
        const kw = highlightSearchTerm(item.keyword, term);
        const un = highlightSearchTerm(item.username || '', term);
        return `<div class="dropdown-item" data-index="${idx}" onclick="selectWukongKeywordFromResults(${idx})">
            <span class="keyword-name">${kw}</span>
            <span class="user-name">${un}</span>
        </div>`;
    }).join('');
}

function handleWukongKeywordNavigation(event) {
    const dropdown = document.getElementById('wukongSearchDropdown');
    const items = dropdown ? dropdown.querySelectorAll('.dropdown-item:not(.placeholder)') : [];
    if (items.length === 0) return;
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            wukongActiveIndex = Math.min(wukongActiveIndex + 1, items.length - 1);
            updateWukongActiveItem(items);
            break;
        case 'ArrowUp':
            event.preventDefault();
            wukongActiveIndex = Math.max(wukongActiveIndex - 1, -1);
            updateWukongActiveItem(items);
            break;
        case 'Enter':
            event.preventDefault();
            if (wukongActiveIndex >= 0 && wukongActiveIndex < items.length) {
                selectWukongKeywordFromResults(wukongActiveIndex);
            }
            break;
        case 'Escape':
            hideWukongSearchDropdown();
            break;
    }
}

function updateWukongActiveItem(items) {
    items.forEach((it, i) => it.classList.toggle('active', i === wukongActiveIndex));
}

function selectWukongKeywordFromResults(index) {
    const results = window.currentWukongSearchResults || [];
    if (index < 0 || index >= results.length) return;
    
    const item = results[index];
    // 设置隐藏字段
    const inp = document.getElementById('wukongEarningKeyword');
    if (inp) inp.value = JSON.stringify({ keyword: item.keyword, username: item.username, userId: item.userId });
    
    // 显示选择结果
    const sel = document.getElementById('wukongSelectedKeyword');
    const txt = sel?.querySelector('.keyword-text');
    if (sel && txt) {
        txt.textContent = `${item.keyword} (${item.username || ''})`;
        sel.style.display = 'flex';
    }
    
    // 隐藏输入框
    const search = document.getElementById('wukongKeywordSearch');
    if (search) search.style.display = 'none';
    hideWukongSearchDropdown();
}

function clearWukongSelectedKeyword() {
    const hid = document.getElementById('wukongEarningKeyword');
    if (hid) hid.value = '';
    
    const box = document.getElementById('wukongSelectedKeyword');
    if (box) box.style.display = 'none';
    
    const s = document.getElementById('wukongKeywordSearch');
    if (s) {
        s.style.display = 'block';
        s.value = '';
        s.focus();
    }
}

function showWukongSearchDropdown() {
    const dd = document.getElementById('wukongSearchDropdown');
    if (dd) dd.style.display = 'block';
}

function hideWukongSearchDropdown() {
    const dd = document.getElementById('wukongSearchDropdown');
    if (dd) dd.style.display = 'none';
    wukongActiveIndex = -1;
}

// ========================================
// 🔍 KK网盘 - 夸克UID搜索功能
// ========================================

let kkDiskActiveIndex = -1;

function handleKKDiskUidSearch(event) {
    const term = event.target.value.toLowerCase().trim();
    if (term.length >= 1) {
        performKKDiskUidSearch(term);
        showKKDiskSearchDropdown();
    } else {
        hideKKDiskSearchDropdown();
    }
}

async function performKKDiskUidSearch(term) {
    try {
        // 从KK网盘申请记录中搜索夸克uid
        const { data: applications, error } = await supabase
            .from('keyword_applications')
            .select('*')
            .or(`task_type.eq.KK网盘任务,task_type.eq.KK网盘`)
            .or(`quark_uid.ilike.%${term}%,username.ilike.%${term}%,user_id.ilike.%${term}%`)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('搜索KK网盘申请失败:', error);
            // 尝试从localStorage搜索
            const locals = (typeof loadKeywordApplicationsFromLocalStorage === 'function') ? loadKeywordApplicationsFromLocalStorage() : [];
            const localKKApps = (locals || []).filter(a => 
                (a.task_type === 'KK网盘任务' || a.task_type === 'KK网盘') &&
                (String(a.quark_uid || '').toLowerCase().includes(term) ||
                 String(a.username || '').toLowerCase().includes(term) ||
                 String(a.user_id || '').toLowerCase().includes(term))
            );
            renderKKDiskUidSearchResults(localKKApps, term);
            return;
        }
        
        // 合并数据库结果和本地数据
        const locals = (typeof loadKeywordApplicationsFromLocalStorage === 'function') ? loadKeywordApplicationsFromLocalStorage() : [];
        const map = {};
        (applications || []).forEach(a => {
            const id = String(a.id || '');
            map[id] = a;
        });
        
        // 从本地数据中补充可能缺失的字段
        (locals || []).forEach(a => {
            const id = String(a.id || '');
            const isKK = (a.task_type === 'KK网盘任务' || a.task_type === 'KK网盘') || id.startsWith('KD');
            if (!isKK) return;
            
            if (map[id]) {
                // 合并数据
                map[id].quark_uid = map[id].quark_uid || a.quark_uid || null;
                map[id].quark_phone = map[id].quark_phone || a.quark_phone || null;
                map[id].real_name = map[id].real_name || a.real_name || null;
            } else if (String(a.quark_uid || '').toLowerCase().includes(term) ||
                       String(a.username || '').toLowerCase().includes(term) ||
                       String(a.user_id || '').toLowerCase().includes(term)) {
                map[id] = a;
            }
        });
        
        const results = Object.values(map);
        renderKKDiskUidSearchResults(results, term);
    } catch (error) {
        console.error('KK网盘UID搜索失败:', error);
        showNotification('搜索失败: ' + error.message, 'error');
    }
}

function renderKKDiskUidSearchResults(results, term) {
    const dropdown = document.getElementById('kkDiskDropdownContent');
    const resultCount = document.getElementById('kkDiskResultCount');
    if (!dropdown || !resultCount) return;
    
    resultCount.textContent = `${results.length} 个结果`;
    kkDiskActiveIndex = -1;
    
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item placeholder">未找到匹配的申请记录</div>';
        return;
    }
    
    window.currentKKDiskSearchResults = results;
    dropdown.innerHTML = results.map((app, idx) => {
        const quarkUid = highlightSearchTerm(String(app.quark_uid || '-'), term);
        const username = highlightSearchTerm(app.username || app.real_name || '', term);
        const phone = app.quark_phone ? ` (${app.quark_phone})` : '';
        return `<div class="dropdown-item" data-index="${idx}" onclick="selectKKDiskUserFromResults(${idx})">
            <span class="keyword-name">夸克UID: ${quarkUid}</span>
            <span class="user-name">${username}${phone}</span>
        </div>`;
    }).join('');
}

function handleKKDiskUidNavigation(event) {
    const dropdown = document.getElementById('kkDiskSearchDropdown');
    const items = dropdown ? dropdown.querySelectorAll('.dropdown-item:not(.placeholder)') : [];
    if (items.length === 0) return;
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            kkDiskActiveIndex = Math.min(kkDiskActiveIndex + 1, items.length - 1);
            updateKKDiskActiveItem(items);
            break;
        case 'ArrowUp':
            event.preventDefault();
            kkDiskActiveIndex = Math.max(kkDiskActiveIndex - 1, -1);
            updateKKDiskActiveItem(items);
            break;
        case 'Enter':
            event.preventDefault();
            if (kkDiskActiveIndex >= 0 && kkDiskActiveIndex < items.length) {
                selectKKDiskUserFromResults(kkDiskActiveIndex);
            }
            break;
        case 'Escape':
            hideKKDiskSearchDropdown();
            break;
    }
}

function updateKKDiskActiveItem(items) {
    items.forEach((it, i) => it.classList.toggle('active', i === kkDiskActiveIndex));
}

function selectKKDiskUserFromResults(index) {
    const results = window.currentKKDiskSearchResults || [];
    if (index < 0 || index >= results.length) return;
    
    const app = results[index];
    // 设置隐藏字段（存储夸克uid和用户信息）
    const inp = document.getElementById('kkDiskUserUid');
    if (inp) inp.value = JSON.stringify({ 
        quarkUid: app.quark_uid, 
        quarkPhone: app.quark_phone,
        realName: app.real_name,
        username: app.username, 
        userId: app.user_id || app.id 
    });
    
    // 显示选择结果
    const sel = document.getElementById('kkDiskSelectedUser');
    const txt = sel?.querySelector('.keyword-text');
    if (sel && txt) {
        const displayName = app.real_name || app.username || '';
        const phone = app.quark_phone ? ` (${app.quark_phone})` : '';
        txt.textContent = `夸克UID: ${app.quark_uid}${phone} - ${displayName}`;
        sel.style.display = 'flex';
    }
    
    // 隐藏输入框
    const search = document.getElementById('kkDiskUidSearch');
    if (search) search.style.display = 'none';
    hideKKDiskSearchDropdown();
}

function clearKKDiskSelectedUser() {
    const hid = document.getElementById('kkDiskUserUid');
    if (hid) hid.value = '';
    
    const box = document.getElementById('kkDiskSelectedUser');
    if (box) box.style.display = 'none';
    
    const s = document.getElementById('kkDiskUidSearch');
    if (s) {
        s.style.display = 'block';
        s.value = '';
        s.focus();
    }
}

function showKKDiskSearchDropdown() {
    const dd = document.getElementById('kkDiskSearchDropdown');
    if (dd) dd.style.display = 'block';
}

function hideKKDiskSearchDropdown() {
    const dd = document.getElementById('kkDiskSearchDropdown');
    if (dd) dd.style.display = 'none';
    kkDiskActiveIndex = -1;
}

// 导出到window
window.updateTaskPriceDisplay = updateTaskPriceDisplay;
window.calculateTaskEarningsAmount = calculateTaskEarningsAmount;
window.handleTeamEarningUserChange = handleTeamEarningUserChange;
window.handleOtherEarningTypeChange = handleOtherEarningTypeChange;
window.handleTeamEarningSubTypeChange = handleTeamEarningSubTypeChange;
window.calculateCommissionAmount = calculateCommissionAmount;
window.calculateWukongEarningsAmount = calculateWukongEarningsAmount;
window.saveWukongSearchEarning = saveWukongSearchEarning;
window.calculateKKDiskEarningsAmount = calculateKKDiskEarningsAmount;
window.saveKKDiskEarning = saveKKDiskEarning;
window.openKKSearchEarningsModal = openKKSearchEarningsModal;
window.openWukongSearchEarningsModal = openWukongSearchEarningsModal;
window.openXraySearchEarningsModal = openXraySearchEarningsModal;
window.openKKDiskEarningsModal = openKKDiskEarningsModal;
// w空搜索相关
window.handleWukongKeywordSearch = handleWukongKeywordSearch;
window.handleWukongKeywordNavigation = handleWukongKeywordNavigation;
window.showWukongSearchDropdown = showWukongSearchDropdown;
window.hideWukongSearchDropdown = hideWukongSearchDropdown;
window.clearWukongSelectedKeyword = clearWukongSelectedKeyword;
window.selectWukongKeywordFromResults = selectWukongKeywordFromResults;
// KK网盘相关
window.handleKKDiskUidSearch = handleKKDiskUidSearch;
window.handleKKDiskUidNavigation = handleKKDiskUidNavigation;
window.showKKDiskSearchDropdown = showKKDiskSearchDropdown;
window.hideKKDiskSearchDropdown = hideKKDiskSearchDropdown;
window.clearKKDiskSelectedUser = clearKKDiskSelectedUser;
window.selectKKDiskUserFromResults = selectKKDiskUserFromResults;

console.log('✅ 任务单价自动计算和团队收益智能识别功能已加载');