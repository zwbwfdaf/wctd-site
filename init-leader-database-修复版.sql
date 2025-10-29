-- ============================================================================
-- 团长管理系统 - 数据库初始化脚本（修复版）
-- 修复了auth.users表字段引用问题
-- ============================================================================

-- 1. 创建团长信息表
CREATE TABLE IF NOT EXISTS leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  level VARCHAR(20) DEFAULT 'bronze' CHECK (level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  total_members INT DEFAULT 0,
  level1_members INT DEFAULT 0,
  level2_members INT DEFAULT 0,
  level3_members INT DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  pending_commission DECIMAL(10,2) DEFAULT 0,
  withdrawn_commission DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE leaders IS '团长信息表';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_leaders_user_id ON leaders(user_id);
CREATE INDEX IF NOT EXISTS idx_leaders_invite_code ON leaders(invite_code);
CREATE INDEX IF NOT EXISTS idx_leaders_status ON leaders(status);

-- ============================================================================

-- 2. 创建团队成员关系表
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  level INT NOT NULL CHECK (level IN (1, 2, 3)),
  parent_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  contribution DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(leader_id, member_id)
);

COMMENT ON TABLE team_members IS '团队成员关系表';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_team_members_leader_id ON team_members(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_level ON team_members(level);

-- ============================================================================

-- 3. 创建团长佣金记录表
CREATE TABLE IF NOT EXISTS leader_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('level1', 'level2', 'level3')),
  amount DECIMAL(10,2) NOT NULL,
  source_user_id UUID NOT NULL,
  source_task_id UUID,
  source_description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID
);

COMMENT ON TABLE leader_commissions IS '团长佣金记录表';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_commissions_leader_id ON leader_commissions(leader_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON leader_commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON leader_commissions(created_at);

-- ============================================================================

-- 4. 创建等级配置表
CREATE TABLE IF NOT EXISTS leader_levels (
  level VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  icon VARCHAR(10),
  required_members INT NOT NULL,
  commission_rate_1 DECIMAL(5,2) NOT NULL,
  commission_rate_2 DECIMAL(5,2) DEFAULT 0,
  commission_rate_3 DECIMAL(5,2) DEFAULT 0,
  benefits TEXT[],
  sort_order INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE leader_levels IS '团长等级配置表';

-- 插入等级配置（使用ON CONFLICT避免重复）
INSERT INTO leader_levels (level, name, display_name, icon, required_members, commission_rate_1, commission_rate_2, commission_rate_3, benefits, sort_order)
VALUES
('bronze', '青铜团长', '青铜团长 LV1', '🥉', 0, 5.00, 0, 0, ARRAY['基础权限', '邀请成员'], 1),
('silver', '白银团长', '白银团长 LV2', '🥈', 10, 8.00, 3.00, 0, ARRAY['二级分佣', '数据统计'], 2),
('gold', '黄金团长', '黄金团长 LV3', '👑', 50, 10.00, 5.00, 0, ARRAY['二级分佣', '专属客服', '优先审核'], 3),
('platinum', '铂金团长', '铂金团长 LV4', '💎', 100, 12.00, 6.00, 2.00, ARRAY['三级分佣', '专属客服', '优先审核', '专属标识'], 4),
('diamond', '钻石团长', '钻石团长 LV5', '⭐', 200, 15.00, 8.00, 3.00, ARRAY['三级分佣', '全部特权', '专属礼包', '优先推荐'], 5)
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  required_members = EXCLUDED.required_members,
  commission_rate_1 = EXCLUDED.commission_rate_1,
  commission_rate_2 = EXCLUDED.commission_rate_2,
  commission_rate_3 = EXCLUDED.commission_rate_3,
  benefits = EXCLUDED.benefits,
  updated_at = NOW();

-- ============================================================================
-- 5. 创建辅助函数
-- ============================================================================

-- 生成唯一邀请码
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM leaders WHERE invite_code = result) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. 创建触发器 - 自动更新统计
-- ============================================================================

-- 更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为leaders表添加触发器
DROP TRIGGER IF EXISTS update_leaders_updated_at ON leaders;
CREATE TRIGGER update_leaders_updated_at
    BEFORE UPDATE ON leaders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 自动更新团长成员统计
CREATE OR REPLACE FUNCTION update_leader_member_count()
RETURNS TRIGGER AS $$
DECLARE
  v_leader_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_leader_id := OLD.leader_id;
  ELSE
    v_leader_id := NEW.leader_id;
  END IF;
  
  UPDATE leaders SET
    total_members = (
      SELECT COUNT(*) FROM team_members 
      WHERE leader_id = v_leader_id AND status = 'active'
    ),
    level1_members = (
      SELECT COUNT(*) FROM team_members 
      WHERE leader_id = v_leader_id AND level = 1 AND status = 'active'
    ),
    level2_members = (
      SELECT COUNT(*) FROM team_members 
      WHERE leader_id = v_leader_id AND level = 2 AND status = 'active'
    ),
    level3_members = (
      SELECT COUNT(*) FROM team_members 
      WHERE leader_id = v_leader_id AND level = 3 AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = v_leader_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为team_members表添加触发器
DROP TRIGGER IF EXISTS trigger_update_leader_count ON team_members;
CREATE TRIGGER trigger_update_leader_count
    AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_leader_member_count();

-- 自动更新团长佣金统计
CREATE OR REPLACE FUNCTION update_leader_commission_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leaders SET
    total_commission = (
      SELECT COALESCE(SUM(amount), 0) FROM leader_commissions 
      WHERE leader_id = NEW.leader_id
    ),
    pending_commission = (
      SELECT COALESCE(SUM(amount), 0) FROM leader_commissions 
      WHERE leader_id = NEW.leader_id AND status = 'pending'
    ),
    withdrawn_commission = (
      SELECT COALESCE(SUM(amount), 0) FROM leader_commissions 
      WHERE leader_id = NEW.leader_id AND status = 'paid'
    ),
    updated_at = NOW()
  WHERE id = NEW.leader_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 为leader_commissions表添加触发器
DROP TRIGGER IF EXISTS trigger_update_commission_stats ON leader_commissions;
CREATE TRIGGER trigger_update_commission_stats
    AFTER INSERT OR UPDATE ON leader_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_leader_commission_stats();

-- ============================================================================
-- 7. 设置行级安全策略 (RLS)
-- ============================================================================

-- 启用RLS
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_levels ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "团长可以查看自己的数据" ON leaders;
DROP POLICY IF EXISTS "团长可以更新自己的数据" ON leaders;
DROP POLICY IF EXISTS "团长可以查看自己的团队成员" ON team_members;
DROP POLICY IF EXISTS "团长可以查看自己的佣金记录" ON leader_commissions;
DROP POLICY IF EXISTS "所有人可以查看等级配置" ON leader_levels;
DROP POLICY IF EXISTS "管理员可以管理所有团长" ON leaders;
DROP POLICY IF EXISTS "管理员可以管理所有佣金" ON leader_commissions;

-- leaders表策略
CREATE POLICY "团长可以查看自己的数据"
ON leaders FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "团长可以更新自己的数据"
ON leaders FOR UPDATE
USING (user_id = auth.uid());

-- team_members表策略
CREATE POLICY "团长可以查看自己的团队成员"
ON team_members FOR SELECT
USING (
  leader_id IN (
    SELECT id FROM leaders WHERE user_id = auth.uid()
  )
);

-- leader_commissions表策略
CREATE POLICY "团长可以查看自己的佣金记录"
ON leader_commissions FOR SELECT
USING (
  leader_id IN (
    SELECT id FROM leaders WHERE user_id = auth.uid()
  )
);

-- leader_levels表策略（所有认证用户都可以查看）
CREATE POLICY "所有人可以查看等级配置"
ON leader_levels FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 8. 创建统计查询函数
-- ============================================================================

-- 获取团长佣金统计
CREATE OR REPLACE FUNCTION get_leader_commission_stats(p_leader_id UUID)
RETURNS TABLE (
  total_amount DECIMAL,
  month_amount DECIMAL,
  pending_amount DECIMAL,
  paid_amount DECIMAL,
  total_count BIGINT,
  pending_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(amount), 0)::DECIMAL as total_amount,
    COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', NOW()) THEN amount ELSE 0 END), 0)::DECIMAL as month_amount,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::DECIMAL as pending_amount,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)::DECIMAL as paid_amount,
    COUNT(*)::BIGINT as total_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::BIGINT as pending_count
  FROM leader_commissions
  WHERE leader_id = p_leader_id;
END;
$$ LANGUAGE plpgsql;

-- 计算团长等级
CREATE OR REPLACE FUNCTION calculate_leader_level(member_count INT)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF member_count >= 200 THEN
    RETURN 'diamond';
  ELSIF member_count >= 100 THEN
    RETURN 'platinum';
  ELSIF member_count >= 50 THEN
    RETURN 'gold';
  ELSIF member_count >= 10 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 团长管理系统数据库初始化完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的表：';
  RAISE NOTICE '  1. leaders - 团长信息表';
  RAISE NOTICE '  2. team_members - 团队成员表';
  RAISE NOTICE '  3. leader_commissions - 佣金记录表';
  RAISE NOTICE '  4. leader_levels - 等级配置表（已插入5个等级）';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 已启用行级安全策略 (RLS)';
  RAISE NOTICE '✅ 已创建触发器和函数';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 检查 Table Editor 中的表';
  RAISE NOTICE '2. 查看 leader_levels 表应该有5条数据';
  RAISE NOTICE '3. 添加测试团长数据';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 测试查询（执行后可以看到结果）
-- ============================================================================

-- 查看等级配置
SELECT level, name, required_members, commission_rate_1, commission_rate_2, commission_rate_3 
FROM leader_levels 
ORDER BY sort_order;

-- 查看表是否创建成功
SELECT 
  'leaders' as table_name, COUNT(*) as record_count FROM leaders
UNION ALL
SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL  
SELECT 'leader_commissions', COUNT(*) FROM leader_commissions
UNION ALL
SELECT 'leader_levels', COUNT(*) FROM leader_levels;

