-- ============================================================================
-- 团长管理系统 - 数据库初始化（超简化版）
-- 只创建核心表，避免复杂引用
-- ============================================================================

-- 1. 团长信息表
CREATE TABLE leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  level VARCHAR(20) DEFAULT 'bronze',
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  total_members INT DEFAULT 0,
  level1_members INT DEFAULT 0,
  level2_members INT DEFAULT 0,
  level3_members INT DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  pending_commission DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 团队成员表
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL,
  member_id UUID NOT NULL,
  level INT NOT NULL,
  contribution DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT NOW()
);

-- 3. 佣金记录表
CREATE TABLE leader_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  source_user_id UUID NOT NULL,
  source_description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 等级配置表
CREATE TABLE leader_levels (
  level VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  required_members INT NOT NULL,
  commission_rate_1 DECIMAL(5,2) NOT NULL,
  commission_rate_2 DECIMAL(5,2) DEFAULT 0,
  commission_rate_3 DECIMAL(5,2) DEFAULT 0
);

-- 插入等级数据
INSERT INTO leader_levels VALUES
('bronze', '青铜团长', 0, 5.00, 0, 0),
('silver', '白银团长', 10, 8.00, 3.00, 0),
('gold', '黄金团长', 50, 10.00, 5.00, 0),
('platinum', '铂金团长', 100, 12.00, 6.00, 2.00),
('diamond', '钻石团长', 200, 15.00, 8.00, 3.00);

-- 创建索引
CREATE INDEX idx_leaders_user_id ON leaders(user_id);
CREATE INDEX idx_team_members_leader ON team_members(leader_id);
CREATE INDEX idx_commissions_leader ON leader_commissions(leader_id);

-- 完成提示
SELECT '✅ 数据库表创建成功！' as message;
SELECT '📋 共创建4个表：leaders, team_members, leader_commissions, leader_levels' as info;
SELECT '🎯 下一步：添加测试数据或配置前端连接' as next_step;

