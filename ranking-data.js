// 随机用户名生成
const firstNames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴'];
const lastNames = ['小', '大', '明', '华', '强', '伟', '勇', '超', '杰', '峰'];
const nicknames = ['推广达人', '营销高手', '销售精英', '业务能手', '金牌推手'];

// 生成随机ID
function generateRandomId() {
    return Math.floor(Math.random() * 900000) + 100000; // 生成6位数字ID
}

// 生成随机金额
function generateRandomAmount(min, max) {
    return (Math.random() * (max - min) + min).toFixed(2);
}

// 生成随机用户名（第一个字显示，后面用*代替）
function generateRandomName() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const nickname = nicknames[Math.floor(Math.random() * nicknames.length)];
    const fullName = `${firstName}${lastName}${nickname}`;
    return `${fullName.charAt(0)}${'*'.repeat(fullName.length - 1)}`;
}

// 生成排行榜数据
function generateRankingData(count, amountRange) {
    const data = [];
    for (let i = 0; i < count; i++) {
        data.push({
            rank: i + 1,
            name: generateRandomName(),
            id: generateRandomId(),
            amount: generateRandomAmount(amountRange.min, amountRange.max)
        });
    }
    // 按金额排序
    return data.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
}

// 生成周榜数据
function generateWeeklyData() {
    return generateRankingData(10, { min: 500, max: 2000 });
}

// 生成月榜数据
function generateMonthlyData() {
    return generateRankingData(10, { min: 2000, max: 8000 });
}

// 渲染排行榜项目
function renderRankingItem(data, index) {
    const rankNumber = index + 1; // 使用索引+1作为排名
    return `
        <div class="ranking-item">
            <div class="rank-number ${rankNumber <= 3 ? 'rank-' + rankNumber : 'rank-other'}">${rankNumber}</div>
            <img src="tp/d5b6249d7d47b37ce1a7ffc886ade151.png" alt="用户头像" class="user-avatar">
            <div class="user-info">
                <div class="user-name">${data.name}</div>
                <div class="user-id">ID: ${data.id}</div>
            </div>
            <div class="user-income">¥${parseFloat(data.amount).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
    `;
}

// 更新周榜内容
function updateWeeklyRanking() {
    const weeklyData = generateWeeklyData();
    const weekContent = document.getElementById('week-content');
    const rankingItems = weeklyData.map((data, index) => renderRankingItem(data, index)).join('');
    
    weekContent.innerHTML = `
        <div class="ranking-header">
            <h2 class="ranking-title">本周爆单达人</h2>
            <a href="#" class="view-all">查看全部</a>
        </div>
        ${rankingItems}
    `;
}

// 更新月榜内容
function updateMonthlyRanking() {
    const monthlyData = generateMonthlyData();
    const monthContent = document.getElementById('month-content');
    const rankingItems = monthlyData.map((data, index) => renderRankingItem(data, index)).join('');
    
    monthContent.innerHTML = `
        <div class="ranking-header">
            <h2 class="ranking-title">本月爆单达人</h2>
            <a href="#" class="view-all">查看全部</a>
        </div>
        ${rankingItems}
    `;
}

// 初始化榜单
document.addEventListener('DOMContentLoaded', function() {
    // 初始化周榜和月榜数据
    updateWeeklyRanking();
    updateMonthlyRanking();
    
    // 绑定切换事件
    const weekTab = document.getElementById('week-tab');
    const monthTab = document.getElementById('month-tab');
    
    weekTab.addEventListener('click', function() {
        weekTab.classList.add('active');
        monthTab.classList.remove('active');
        document.getElementById('week-content').classList.add('active');
        document.getElementById('month-content').classList.remove('active');
    });
    
    monthTab.addEventListener('click', function() {
        monthTab.classList.add('active');
        weekTab.classList.remove('active');
        document.getElementById('month-content').classList.add('active');
        document.getElementById('week-content').classList.remove('active');
    });
});
