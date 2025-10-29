-- ========================================
-- 团长等级奖励系统 - 数据库迁移脚本
-- ========================================

-- 1. 等级奖励配置表
CREATE TABLE IF NOT EXISTS level_rewards_config (
    id SERIAL PRIMARY KEY,
    level_id TEXT NOT NULL UNIQUE, -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    level_name TEXT NOT NULL, -- '青铜团长', '白银团长', '黄金团长', '铂金团长', '钻石团长'
    min_members INT NOT NULL, -- 最低人数要求 (0, 10, 50, 100, 200)
    max_members INT, -- 最高人数要求（可选）
    withdrawal_reward DECIMAL(10,2) NOT NULL DEFAULT 0, -- 首次提现奖励金额
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0, -- 分成比例（如 5.00 表示 5%）
    status TEXT DEFAULT 'enabled', -- 'enabled' / 'disabled'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO level_rewards_config (level_id, level_name, min_members, max_members, withdrawal_reward, commission_rate) VALUES
('bronze', '青铜团长', 0, 9, 10.00, 5.00),
('silver', '白银团长', 10, 49, 20.00, 7.00),
('gold', '黄金团长', 50, 99, 30.00, 9.00),
('platinum', '铂金团长', 100, 199, 40.00, 9.50),
('diamond', '钻石团长', 200, NULL, 50.00, 10.00)
ON CONFLICT (level_id) DO NOTHING;

-- 2. 扩展 referrals 表 - 添加激活状态
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS leader_level_at_activation TEXT;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_referrals_activated ON referrals(is_activated);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter_activated ON referrals(inviter_id, is_activated);

-- 3. 用户提现状态表
CREATE TABLE IF NOT EXISTS user_withdrawal_status (
    user_id TEXT PRIMARY KEY,
    first_withdrawal_at TIMESTAMP, -- 首次提现时间
    total_withdrawals INT DEFAULT 0, -- 提现次数
    total_withdrawal_amount DECIMAL(10,2) DEFAULT 0, -- 累计提现金额
    is_first_withdrawal_rewarded BOOLEAN DEFAULT FALSE, -- 是否已发放首次提现奖励给团长
    last_withdrawal_at TIMESTAMP, -- 最后一次提现时间
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_status_first ON user_withdrawal_status(first_withdrawal_at);

-- 4. 扩展 earnings 表 - 区分奖励类型
-- 如果 earnings 表还没有这些字段，添加它们
ALTER TABLE earnings 
ADD COLUMN IF NOT EXISTS reward_type TEXT, -- 'withdrawal_bonus' / 'commission' / 'task' / 'referral'
ADD COLUMN IF NOT EXISTS source_user_id TEXT, -- 来源用户ID（被邀请人）
ADD COLUMN IF NOT EXISTS leader_level TEXT, -- 团长等级（记录发放时的等级）
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2), -- 分成比例（仅用于 commission 类型）
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2); -- 原始金额（用户提现金额，仅用于 commission）

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_earnings_reward_type ON earnings(reward_type);
CREATE INDEX IF NOT EXISTS idx_earnings_source_user ON earnings(source_user_id);

-- 5. 创建视图 - 方便查询团长的有效团队成员数
CREATE OR REPLACE VIEW leader_active_team_stats AS
SELECT 
    inviter_id,
    COUNT(*) FILTER (WHERE is_activated = true) as active_members,
    COUNT(*) FILTER (WHERE is_activated = false) as pending_members,
    COUNT(*) as total_invited,
    ROUND(COUNT(*) FILTER (WHERE is_activated = true) * 100.0 / NULLIF(COUNT(*), 0), 2) as activation_rate
FROM referrals
GROUP BY inviter_id;

-- 6. 创建函数 - 获取团长当前等级
CREATE OR REPLACE FUNCTION get_leader_level(active_member_count INT)
RETURNS TABLE(level_id TEXT, level_name TEXT, withdrawal_reward DECIMAL, commission_rate DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lrc.level_id,
        lrc.level_name,
        lrc.withdrawal_reward,
        lrc.commission_rate
    FROM level_rewards_config lrc
    WHERE lrc.status = 'enabled'
      AND active_member_count >= lrc.min_members
      AND (lrc.max_members IS NULL OR active_member_count <= lrc.max_members)
    ORDER BY lrc.min_members DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建触发器 - 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为相关表添加触发器
DROP TRIGGER IF EXISTS update_level_rewards_config_updated_at ON level_rewards_config;
CREATE TRIGGER update_level_rewards_config_updated_at
    BEFORE UPDATE ON level_rewards_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_withdrawal_status_updated_at ON user_withdrawal_status;
CREATE TRIGGER update_user_withdrawal_status_updated_at
    BEFORE UPDATE ON user_withdrawal_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. 注释说明
COMMENT ON TABLE level_rewards_config IS '团长等级奖励配置表';
COMMENT ON TABLE user_withdrawal_status IS '用户提现状态记录表';
COMMENT ON COLUMN referrals.is_activated IS '用户是否已激活（完成首次提现）';
COMMENT ON COLUMN referrals.activated_at IS '用户激活时间';
COMMENT ON COLUMN referrals.leader_level_at_activation IS '用户激活时团长的等级';
COMMENT ON COLUMN earnings.reward_type IS '奖励类型：withdrawal_bonus=提现奖励, commission=分成奖励';
COMMENT ON COLUMN earnings.source_user_id IS '奖励来源用户ID（被邀请人）';
COMMENT ON COLUMN earnings.leader_level IS '发放奖励时团长的等级';

-- ========================================
-- 数据迁移完成
-- ========================================

