-- ============================================================================
-- 团长管理系统 - 数据库初始化脚本
-- 在Supabase SQL编辑器中执行此脚本
-- ============================================================================

-- 1. 创建团长信息表
CREATE TABLE IF NOT EXISTS leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level VARCHAR(20) DEFAULT 'bronze' CHECK (level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  total_members INT DEFAULT 0 CHECK (total_members >= 0),
  level1_members INT DEFAULT 0 CHECK (level1_members >= 0),
  level2_members INT DEFAULT 0 CHECK (level2_members >= 0),
  level3_members INT DEFAULT 0 CHECK (level3_members >= 0),
  total_commission DECIMAL(10,2) DEFAULT 0 CHECK (total_commission >= 0),
  pending_commission DECIMAL(10,2) DEFAULT 0 CHECK (pending_commission >= 0),
  withdrawn_commission DECIMAL(10,2) DEFAULT 0 CHECK (withdrawn_commission >= 0),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE leaders IS '团长信息表';
COMMENT ON COLUMN leaders.level IS '团长等级: bronze/silver/gold/platinum/diamond';
COMMENT ON COLUMN leaders.invite_code IS '专属邀请码';
COMMENT ON COLUMN leaders.status IS '状态: active/inactive/suspended';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_leaders_user_id ON leaders(user_id);
CREATE INDEX IF NOT EXISTS idx_leaders_invite_code ON leaders(invite_code);
CREATE INDEX IF NOT EXISTS idx_leaders_status ON leaders(status);
CREATE INDEX IF NOT EXISTS idx_leaders_level ON leaders(level);

-- ============================================================================

-- 2. 创建团队成员关系表
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level IN (1, 2, 3)),
  parent_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  contribution DECIMAL(10,2) DEFAULT 0 CHECK (contribution >= 0),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(leader_id, member_id)
);

COMMENT ON TABLE team_members IS '团队成员关系表';
COMMENT ON COLUMN team_members.level IS '成员层级: 1=一级, 2=二级, 3=三级';
COMMENT ON COLUMN team_members.parent_id IS '上级成员ID';
COMMENT ON COLUMN team_members.contribution IS '该成员累计贡献的佣金';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_team_members_leader_id ON team_members(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_level ON team_members(level);
CREATE INDEX IF NOT EXISTS idx_team_members_parent_id ON team_members(parent_id);
CREATE INDEX IF NOT EXISTS idx_team_members_joined_at ON team_members(joined_at);

-- ============================================================================

-- 3. 创建团长佣金记录表
CREATE TABLE IF NOT EXISTS leader_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('level1', 'level2', 'level3')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  source_user_id UUID NOT NULL REFERENCES auth.users(id),
  source_task_id UUID,  -- 可以关联到tasks表
  source_description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE leader_commissions IS '团长佣金记录表';
COMMENT ON COLUMN leader_commissions.type IS '佣金类型: level1/level2/level3';
COMMENT ON COLUMN leader_commissions.status IS '状态: pending/paid/rejected';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_commissions_leader_id ON leader_commissions(leader_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON leader_commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON leader_commissions(created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_type ON leader_commissions(type);

-- ============================================================================

-- 4. 创建等级配置表
CREATE TABLE IF NOT EXISTS leader_levels (
  level VARCHAR(20) PRIMARY KEY CHECK (level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  icon VARCHAR(10),
  required_members INT NOT NULL CHECK (required_members >= 0),
  commission_rate_1 DECIMAL(5,2) NOT NULL CHECK (commission_rate_1 >= 0 AND commission_rate_1 <= 100),
  commission_rate_2 DECIMAL(5,2) DEFAULT 0 CHECK (commission_rate_2 >= 0 AND commission_rate_2 <= 100),
  commission_rate_3 DECIMAL(5,2) DEFAULT 0 CHECK (commission_rate_3 >= 0 AND commission_rate_3 <= 100),
  benefits TEXT[],
  sort_order INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE leader_levels IS '团长等级配置表';

-- 插入等级配置数据
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
  icon = EXCLUDED.icon,
  required_members = EXCLUDED.required_members,
  commission_rate_1 = EXCLUDED.commission_rate_1,
  commission_rate_2 = EXCLUDED.commission_rate_2,
  commission_rate_3 = EXCLUDED.commission_rate_3,
  benefits = EXCLUDED.benefits,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ============================================================================
-- 5. 创建触发器函数
-- ============================================================================

-- 更新updated_at时间戳
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

-- 为leader_levels表添加触发器
DROP TRIGGER IF EXISTS update_leader_levels_updated_at ON leader_levels;
CREATE TRIGGER update_leader_levels_updated_at
    BEFORE UPDATE ON leader_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 创建数据库函数（用于统计和计算）
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

-- 自动更新团长成员统计
CREATE OR REPLACE FUNCTION update_leader_member_count()
RETURNS TRIGGER AS $$
DECLARE
  v_leader_id UUID;
BEGIN
  -- 获取leader_id
  IF TG_OP = 'DELETE' THEN
    v_leader_id := OLD.leader_id;
  ELSE
    v_leader_id := NEW.leader_id;
  END IF;
  
  -- 更新团长的成员统计
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
CREATE OR REPLACE FUNCTION update_leader_commission_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新团长的佣金统计
  UPDATE leaders SET
    total_commission = (
      SELECT COALESCE(SUM(amount), 0) FROM leader_commissions 
      WHERE leader_id = NEW.leader_id AND status = 'paid'
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
    EXECUTE FUNCTION update_leader_commission_count();

-- ============================================================================
-- 7. 设置行级安全策略 (RLS)
-- ============================================================================

-- 启用RLS
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_levels ENABLE ROW LEVEL SECURITY;

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

-- leader_levels表策略（所有人都可以查看）
CREATE POLICY "所有人可以查看等级配置"
ON leader_levels FOR SELECT
TO authenticated
USING (true);

-- 管理员策略（假设有admin角色）
CREATE POLICY "管理员可以管理所有团长"
ON leaders FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "管理员可以管理所有佣金"
ON leader_commissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================================
-- 8. 创建视图（方便查询）
-- ============================================================================

-- 团长详细信息视图
CREATE OR REPLACE VIEW leader_details_view AS
SELECT 
  l.*,
  u.username,
  u.email,
  ll.name as level_name,
  ll.display_name as level_display_name,
  ll.icon as level_icon,
  ll.commission_rate_1,
  ll.commission_rate_2,
  ll.commission_rate_3,
  ll.benefits
FROM leaders l
LEFT JOIN auth.users u ON l.user_id = u.id
LEFT JOIN leader_levels ll ON l.level = ll.level;

-- 团队成员详细视图
CREATE OR REPLACE VIEW team_members_view AS
SELECT 
  tm.*,
  u.username as member_username,
  u.email as member_email,
  (SELECT COUNT(*) FROM team_members WHERE parent_id = tm.id) as sub_members_count
FROM team_members tm
LEFT JOIN auth.users u ON tm.member_id = u.id;

-- ============================================================================
-- 9. 插入测试数据（可选）
-- ============================================================================

-- 如果需要测试，可以插入一些示例数据
-- 注意：替换user_id为实际的用户UUID

/*
-- 示例：添加测试团长
INSERT INTO leaders (user_id, level, invite_code, level1_members, total_members)
VALUES 
  ('替换为实际的user_id', 'gold', 'TEST001', 48, 156),
  ('替换为实际的user_id', 'silver', 'TEST002', 12, 45)
ON CONFLICT (user_id) DO NOTHING;

-- 示例：添加测试团队成员
INSERT INTO team_members (leader_id, member_id, level, contribution)
SELECT 
  (SELECT id FROM leaders WHERE invite_code = 'TEST001'),
  '替换为实际的member_user_id',
  1,
  150.00
ON CONFLICT (leader_id, member_id) DO NOTHING;

-- 示例：添加测试佣金记录
INSERT INTO leader_commissions (leader_id, type, amount, source_user_id, source_description, status)
SELECT 
  (SELECT id FROM leaders WHERE invite_code = 'TEST001'),
  'level1',
  50.00,
  '替换为实际的source_user_id',
  '用户A完成任务获得佣金',
  'pending'
ON CONFLICT DO NOTHING;
*/

-- ============================================================================
-- 10. 创建辅助函数
-- ============================================================================

-- 生成唯一邀请码
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 排除容易混淆的字符
  result TEXT := '';
  i INT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- 检查是否已存在
    SELECT EXISTS(SELECT 1 FROM leaders WHERE invite_code = result) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 计算团长等级（根据成员数量）
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

-- 自动升级团长等级
CREATE OR REPLACE FUNCTION auto_upgrade_leader_level()
RETURNS TRIGGER AS $$
DECLARE
  new_level VARCHAR(20);
BEGIN
  -- 根据一级成员数量计算新等级
  new_level := calculate_leader_level(NEW.level1_members);
  
  -- 如果等级发生变化，更新
  IF new_level != NEW.level THEN
    NEW.level := new_level;
    
    -- 记录日志（可选）
    RAISE NOTICE '团长等级自动升级: % → %', NEW.level, new_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为leaders表添加自动升级触发器
DROP TRIGGER IF EXISTS trigger_auto_upgrade_level ON leaders;
CREATE TRIGGER trigger_auto_upgrade_level
    BEFORE UPDATE OF level1_members ON leaders
    FOR EACH ROW
    EXECUTE FUNCTION auto_upgrade_leader_level();

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ 团长管理系统数据库初始化完成！';
  RAISE NOTICE '📋 已创建表：';
  RAISE NOTICE '  - leaders (团长信息表)';
  RAISE NOTICE '  - team_members (团队成员关系表)';
  RAISE NOTICE '  - leader_commissions (佣金记录表)';
  RAISE NOTICE '  - leader_levels (等级配置表)';
  RAISE NOTICE '🔐 已启用行级安全策略 (RLS)';
  RAISE NOTICE '⚡ 已创建触发器和函数';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 检查表是否创建成功';
  RAISE NOTICE '2. 在前端页面中配置Supabase连接';
  RAISE NOTICE '3. 测试数据获取功能';
END $$;

