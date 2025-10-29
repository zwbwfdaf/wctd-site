# 团长系统 API 接口文档

## 📋 文档说明

本文档详细说明了团长管理系统前后端对接所需的所有API接口。

**版本**: v1.0  
**更新日期**: 2025-10-28  
**基础URL**: `https://your-api-domain.com/api`

---

## 🔐 认证方式

所有API请求都需要在Header中携带认证token：

```http
Authorization: Bearer {token}
```

---

## 📚 接口列表

### 1. 团长个人数据

#### 1.1 获取团长仪表盘数据

**接口**: `GET /leader/dashboard`

**请求参数**:
```json
{
  "userId": "用户ID (必填)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "userInfo": {
      "userId": "uuid-123",
      "username": "zhangsan",
      "name": "张三",
      "avatar": "头像URL"
    },
    "level": {
      "current": "gold",
      "name": "黄金团长",
      "displayName": "黄金团长 LV3",
      "icon": "👑"
    },
    "progress": {
      "currentMembers": 48,
      "nextLevelMembers": 50,
      "progress": 96,
      "remaining": 2
    },
    "teamCount": {
      "total": 156,
      "level1": 48,
      "level2": 84,
      "level3": 24,
      "monthGrowth": 12,
      "todayGrowth": 3
    },
    "commission": {
      "total": 5200,
      "thisMonth": 520,
      "pending": 300,
      "withdrawn": 4900,
      "monthGrowth": 520
    },
    "inviteInfo": {
      "code": "ABC123",
      "url": "https://example.com/register?ref=ABC123",
      "qrCodeUrl": "二维码图片URL"
    },
    "recentActivities": [
      {
        "type": "member_join",
        "content": "用户A 通过您的邀请加入了团队",
        "time": "2024-10-28 14:30:00",
        "icon": "user-plus"
      },
      {
        "type": "commission",
        "content": "获得一级佣金 ¥50（用户B完成任务）",
        "time": "2024-10-28 10:15:00",
        "icon": "coins"
      }
    ]
  }
}
```

---

### 2. 团队管理

#### 2.1 获取团队成员列表

**接口**: `GET /leader/team-members`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "level": "层级 (选填, 1/2/3/all)",
  "status": "状态 (选填, active/inactive)",
  "keyword": "搜索关键词 (选填)",
  "page": "页码 (默认1)",
  "pageSize": "每页数量 (默认20)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "members": [
      {
        "id": "member-uuid-1",
        "userId": "user-uuid-1",
        "username": "userA",
        "name": "用户A",
        "avatar": "头像URL",
        "level": 1,
        "parentId": null,
        "joinDate": "2024-10-20",
        "contribution": 150,
        "subMembersCount": 5,
        "status": "active",
        "isActive": true,
        "lastActiveTime": "2024-10-28 14:30"
      }
    ],
    "statistics": {
      "total": 156,
      "level1": 48,
      "level2": 84,
      "level3": 24,
      "active": 128,
      "inactive": 28
    },
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

#### 2.2 获取团队树状结构

**接口**: `GET /leader/team-tree`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "maxLevel": "最大层级 (默认3)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "root": {
      "id": "leader-uuid",
      "name": "张三",
      "level": 0,
      "children": [
        {
          "id": "member-1",
          "name": "用户A",
          "level": 1,
          "joinDate": "2024-10-20",
          "contribution": 150,
          "children": [
            {
              "id": "member-1-1",
              "name": "用户A1",
              "level": 2,
              "joinDate": "2024-10-22",
              "contribution": 50,
              "children": []
            }
          ]
        }
      ]
    },
    "statistics": {
      "totalNodes": 156,
      "maxDepth": 3
    }
  }
}
```

---

### 3. 佣金管理

#### 3.1 获取佣金记录

**接口**: `GET /leader/commissions`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "type": "佣金类型 (选填, level1/level2/level3)",
  "status": "状态 (选填, pending/paid/rejected)",
  "startDate": "开始日期 (选填, YYYY-MM-DD)",
  "endDate": "结束日期 (选填, YYYY-MM-DD)",
  "page": "页码 (默认1)",
  "pageSize": "每页数量 (默认20)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "statistics": {
      "total": 5200,
      "thisMonth": 520,
      "pending": 300,
      "withdrawn": 4900,
      "count": {
        "total": 156,
        "pending": 8,
        "paid": 148
      }
    },
    "records": [
      {
        "id": "commission-uuid-1",
        "type": "level1",
        "typeName": "一级佣金",
        "amount": 50,
        "sourceUserId": "user-uuid-a",
        "sourceUsername": "userA",
        "sourceTaskId": "task-uuid-1",
        "sourceTaskName": "XX搜索任务",
        "status": "pending",
        "statusName": "待发放",
        "createdAt": "2024-10-28 14:30:00",
        "paidAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

#### 3.2 获取佣金统计（按月份）

**接口**: `GET /leader/commission-stats`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "months": "月份数量 (默认12)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "monthlyStats": [
      {
        "month": "2024-10",
        "total": 520,
        "level1": 350,
        "level2": 140,
        "level3": 30,
        "count": 18
      },
      {
        "month": "2024-09",
        "total": 480,
        "level1": 320,
        "level2": 130,
        "level3": 30,
        "count": 16
      }
    ],
    "summary": {
      "totalAmount": 5200,
      "totalCount": 156,
      "avgAmount": 33.33
    }
  }
}
```

---

### 4. 等级权益

#### 4.1 获取等级信息

**接口**: `GET /leader/level-info`

**请求参数**:
```json
{
  "userId": "用户ID (必填)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "currentLevel": {
      "level": "gold",
      "name": "黄金团长",
      "displayName": "黄金团长 LV3",
      "icon": "👑",
      "requiredMembers": 50,
      "commissionRates": {
        "level1": 10,
        "level2": 5,
        "level3": 0
      },
      "benefits": [
        "二级分佣",
        "专属客服",
        "优先审核"
      ]
    },
    "progress": {
      "currentMembers": 48,
      "nextLevelMembers": 50,
      "progress": 96,
      "remaining": 2,
      "nextLevel": "platinum",
      "nextLevelName": "铂金团长"
    },
    "allLevels": [
      {
        "level": "bronze",
        "name": "青铜团长",
        "displayName": "青铜团长 LV1",
        "icon": "🥉",
        "requiredMembers": 0,
        "commissionRates": {
          "level1": 5,
          "level2": 0,
          "level3": 0
        },
        "benefits": [
          "基础权限",
          "邀请成员"
        ],
        "status": "achieved"
      },
      {
        "level": "silver",
        "name": "白银团长",
        "displayName": "白银团长 LV2",
        "icon": "🥈",
        "requiredMembers": 10,
        "commissionRates": {
          "level1": 8,
          "level2": 3,
          "level3": 0
        },
        "benefits": [
          "二级分佣",
          "数据统计"
        ],
        "status": "achieved"
      },
      {
        "level": "gold",
        "name": "黄金团长",
        "displayName": "黄金团长 LV3",
        "icon": "👑",
        "requiredMembers": 50,
        "commissionRates": {
          "level1": 10,
          "level2": 5,
          "level3": 0
        },
        "benefits": [
          "二级分佣",
          "专属客服",
          "优先审核"
        ],
        "status": "current"
      },
      {
        "level": "platinum",
        "name": "铂金团长",
        "displayName": "铂金团长 LV4",
        "icon": "💎",
        "requiredMembers": 100,
        "commissionRates": {
          "level1": 12,
          "level2": 6,
          "level3": 2
        },
        "benefits": [
          "三级分佣",
          "专属客服",
          "优先审核",
          "专属标识"
        ],
        "status": "locked"
      },
      {
        "level": "diamond",
        "name": "钻石团长",
        "displayName": "钻石团长 LV5",
        "icon": "⭐",
        "requiredMembers": 200,
        "commissionRates": {
          "level1": 15,
          "level2": 8,
          "level3": 3
        },
        "benefits": [
          "三级分佣",
          "全部特权",
          "专属礼包",
          "优先推荐"
        ],
        "status": "locked"
      }
    ]
  }
}
```

---

### 5. 邀请推广

#### 5.1 获取邀请信息

**接口**: `GET /leader/invite-info`

**请求参数**:
```json
{
  "userId": "用户ID (必填)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "inviteCode": "ABC123",
    "inviteUrl": "https://example.com/register?ref=ABC123",
    "qrCodeUrl": "https://example.com/qr/ABC123.png",
    "statistics": {
      "today": 3,
      "thisMonth": 48,
      "total": 156,
      "thisWeek": 12,
      "lastMonth": 36
    },
    "recentInvites": [
      {
        "userId": "user-uuid-1",
        "username": "userA",
        "name": "用户A",
        "joinDate": "2024-10-28 14:30:00",
        "status": "active"
      }
    ]
  }
}
```

#### 5.2 生成邀请二维码

**接口**: `POST /leader/generate-qrcode`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "size": "二维码大小 (选填, 默认200)",
  "format": "格式 (选填, png/jpg, 默认png)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "qrCodeUrl": "https://example.com/qr/ABC123.png",
    "base64": "data:image/png;base64,iVBORw0KGg..."
  }
}
```

#### 5.3 获取推广素材列表

**接口**: `GET /leader/materials`

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "materials": [
      {
        "id": "material-1",
        "type": "poster",
        "name": "推广海报1",
        "description": "适合朋友圈分享",
        "previewUrl": "预览图URL",
        "downloadUrl": "下载链接",
        "size": "1080x1920",
        "format": "jpg"
      },
      {
        "id": "material-2",
        "type": "copywriting",
        "name": "文案模板",
        "description": "推广文案参考",
        "content": "文案内容...",
        "downloadUrl": "下载链接"
      }
    ]
  }
}
```

---

### 6. 数据分析

#### 6.1 获取团队增长趋势

**接口**: `GET /leader/analytics/growth-trend`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "startDate": "开始日期 (必填, YYYY-MM-DD)",
  "endDate": "结束日期 (必填, YYYY-MM-DD)",
  "granularity": "粒度 (选填, day/week/month, 默认day)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "trend": [
      {
        "date": "2024-10-01",
        "total": 144,
        "level1": 42,
        "level2": 78,
        "level3": 24,
        "newMembers": 3
      },
      {
        "date": "2024-10-02",
        "total": 147,
        "level1": 43,
        "level2": 80,
        "level3": 24,
        "newMembers": 3
      }
    ],
    "summary": {
      "totalGrowth": 12,
      "avgDailyGrowth": 0.4,
      "maxDailyGrowth": 5,
      "growthRate": 8.3
    }
  }
}
```

#### 6.2 获取佣金收入趋势

**接口**: `GET /leader/analytics/commission-trend`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "months": "月份数量 (默认12)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "trend": [
      {
        "month": "2024-10",
        "total": 520,
        "level1": 350,
        "level2": 140,
        "level3": 30
      },
      {
        "month": "2024-09",
        "total": 480,
        "level1": 320,
        "level2": 130,
        "level3": 30
      }
    ],
    "summary": {
      "totalIncome": 5200,
      "avgMonthlyIncome": 433,
      "maxMonthlyIncome": 520,
      "growthRate": 8.3
    }
  }
}
```

#### 6.3 获取成员活跃度分析

**接口**: `GET /leader/analytics/activity`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "days": "天数 (默认30)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "activeMembers": 128,
    "inactiveMembers": 28,
    "activeRate": 82.05,
    "activityByLevel": {
      "level1": {
        "total": 48,
        "active": 42,
        "rate": 87.5
      },
      "level2": {
        "total": 84,
        "active": 68,
        "rate": 81.0
      },
      "level3": {
        "total": 24,
        "active": 18,
        "rate": 75.0
      }
    },
    "dailyActivity": [
      {
        "date": "2024-10-28",
        "activeCount": 45,
        "rate": 28.8
      }
    ]
  }
}
```

---

## 🔧 管理员接口（仅后台使用）

### 7.1 添加团长

**接口**: `POST /admin/leader/add`

**请求参数**:
```json
{
  "userId": "用户ID (必填)",
  "level": "初始等级 (选填, 默认bronze)",
  "note": "备注 (选填)"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "添加成功",
  "data": {
    "leaderId": "leader-uuid",
    "inviteCode": "ABC123",
    "createdAt": "2024-10-28 15:30:00"
  }
}
```

### 7.2 更新团长状态

**接口**: `PUT /admin/leader/status`

**请求参数**:
```json
{
  "leaderId": "团长ID (必填)",
  "status": "状态 (必填, active/inactive/suspended)"
}
```

### 7.3 发放佣金

**接口**: `POST /admin/commission/pay`

**请求参数**:
```json
{
  "commissionIds": ["commission-id-1", "commission-id-2"],
  "note": "备注 (选填)"
}
```

### 7.4 更新等级配置

**接口**: `PUT /admin/leader-level/config`

**请求参数**:
```json
{
  "level": "等级标识 (必填)",
  "requiredMembers": "所需成员数 (必填)",
  "commissionRates": {
    "level1": 10,
    "level2": 5,
    "level3": 2
  },
  "benefits": ["权益1", "权益2"]
}
```

---

## 📝 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权/Token失效 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

**错误响应格式**:
```json
{
  "code": 400,
  "message": "参数错误",
  "error": "userId is required"
}
```

---

## 🔄 数据库表设计参考

### leaders 表
```sql
CREATE TABLE leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  level VARCHAR(20) DEFAULT 'bronze',
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  total_members INT DEFAULT 0,
  level1_members INT DEFAULT 0,
  level2_members INT DEFAULT 0,
  level3_members INT DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  pending_commission DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### team_members 表
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES leaders(id),
  member_id UUID NOT NULL REFERENCES users(id),
  level INT NOT NULL,
  parent_id UUID REFERENCES team_members(id),
  contribution DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT NOW()
);
```

### leader_commissions 表
```sql
CREATE TABLE leader_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES leaders(id),
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  source_user_id UUID NOT NULL REFERENCES users(id),
  source_task_id UUID REFERENCES tasks(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);
```

---

## 🌐 前端调用示例

### JavaScript (Fetch API)
```javascript
// 获取团长仪表盘数据
async function getLeaderDashboard(userId) {
  try {
    const response = await fetch(`/api/leader/dashboard?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.code === 200) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    throw error;
  }
}

// 使用示例
const dashboardData = await getLeaderDashboard('user-uuid-123');
console.log(dashboardData);
```

### 使用 Supabase Client
```javascript
// 如果使用Supabase
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 获取团队成员
async function getTeamMembers(leaderId) {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      member:users(username, name, avatar)
    `)
    .eq('leader_id', leaderId)
    .order('joined_at', { ascending: false });
  
  if (error) throw error;
  return data;
}
```

---

## 📌 注意事项

1. **安全性**
   - 所有接口都需要验证用户身份
   - 团长只能访问自己的数据
   - 管理员接口需要额外的权限验证

2. **性能优化**
   - 使用分页避免一次性加载大量数据
   - 合理使用缓存机制
   - 图表数据可以考虑定时预计算

3. **数据一致性**
   - 团队人数、佣金金额等关键数据需要事务保证
   - 等级升级需要实时检查和更新
   - 佣金发放后状态不可撤销

4. **错误处理**
   - 所有接口都应返回统一的错误格式
   - 前端需要妥善处理各种错误情况
   - 提供友好的错误提示

---

**文档版本**: v1.0  
**维护者**: 开发团队  
**联系方式**: dev@example.com

