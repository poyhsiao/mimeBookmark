# 跨平台书签管理平台设计文档

**版本**: 1.0  
**创建日期**: 2026-01-16  
**项目名称**: MimeBookmark  
**状态**: 设计完成，待实现

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [监控与日志](#3-监控与日志)
4. [用户系统](#4-用户系统)
5. [数据库设计](#5-数据库设计)
6. [API 设计](#6-api-设计)
7. [付费功能与推荐系统](#7-付费功能与推荐系统)
8. [部署架构](#8-部署架构)
9. [路线图](#9-路线图)

---

## 1. 项目概述

### 1.1 产品定位

类似 Toby (https://www.gettoby.com/) 的跨平台、跨浏览器书签管理平台，提供以下核心价值：

- **统一管理**：集中管理所有平台的书签
- **智能搜索**：支持中文全文搜索和语义搜索
- **组织功能**：收藏集、标签、智能分类
- **跨平台同步**：Web + 浏览器扩展 + 移动端
- **个性化推荐**：基于用户行为的智能推荐

### 1.2 目标用户

- 个人用户（免费 + 付费）
- 团队用户（付费团队版）
- 追求高效信息管理的知识工作者

### 1.3 竞品分析

| 平台 | 定价 | 特色功能 | 目标用户 |
|------|------|----------|----------|
| Raindrop.io | 免费 + $3/月 | 视觉预览、嵌套收藏集、团队协作 | 通用用户、团队 |
| Pinboard | $11/年 | 全文搜索、自动归档、API访问 | 极简主义者、隐私导向 |
| Pocket | 免费 + $4.99/月 | 离线阅读、文字转语音、自动标签 | 阅读later用户 |
| Toby | 免费 + $8/月(团队) | 新标签页集成、拖拽组织、视觉卡片 | 频繁浏览器用户 |

### 1.4 商业模式

**免费增值模式 (Freemium)**

| 功能 | 免费用户 | 付费用户 (Pro $4.99/月) | 团队版 (Team $9.99/月) |
|------|---------|----------------------|---------------------|
| 书签数量上限 | 5,000 | 无限制 | 无限制 |
| 收藏集数量 | 20 | 100 | 100 |
| 标签数量 | 50 | 无限制 | 无限制 |
| 导入导出 | 仅 HTML | 全部格式 | 全部格式 |
| 全文搜索 | ✅ | ✅ + 语义搜索 | ✅ + 语义搜索 |
| API 访问 | ❌ | ✅ | ✅ |
| 网站推荐 | 随机展示 | 精准推荐 | 精准推荐 |
| 注释功能 | 5 个/书签 | 无限制 | 无限制 |
| 协作功能 | ❌ | ❌ | ✅ |
| 团队成员 | - | - | 10 |

### 1.5 变现策略

**网站推荐收入**

- **免费用户**：随机混合 + 低价推荐 (CPM $0.30-0.50)
- **付费用户**：精准推荐 + 高价值内容 (CPC $0.50-1.00)

**展示位置**：
- 侧边栏 ($0.50 CPM)
- 搜索结果 ($0.80 CPM)
- 新增书签页 ($1.00 CPM)
- 通知中心 ($0.30 CPM)

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Web App    │  │  Mobile Web │  │  Browser Extension  │ │
│  │  (Next.js)  │  │  (PWA)      │  │  (Chrome/Firefox)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  API Routes │  │  SSR Pages  │  │  Auth & Middleware  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Supabase    │  │  PGroonga     │  │  External     │
│   (Backend)   │  │  (Search)     │  │  Services     │
│               │  │               │  │               │
│ • Auth        │  │ • 全文搜索    │  │ • LLM (AI)    │
│ • Database    │  │ • 中文分词    │  │ • Stripe      │
│ • Storage     │  │ • 相关性排序  │  │ • Analytics   │
│ • Realtime    │  │               │  │ • Email       │
│ • Edge Func   │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

### 2.2 技术栈

| 层级 | 技术选择 | 版本 | 理由 |
|------|---------|------|------|
| **前端框架** | Next.js | 14+ (App Router) | SSR/SSG 兼顾 SEO，生态成熟 |
| **语言** | TypeScript | 5.x | 类型安全，企业级标准 |
| **UI 组件** | Shadcn/ui + Tailwind CSS | 最新 | 高度可定制，现代美观 |
| **状态管理** | Zustand + TanStack Query | 最新 | 轻量 + Server State 管理 |
| **后端即服务** | Supabase | 最新 | Auth/Database/Storage/Realtime 一体化 |
| **全文搜索** | PGroonga (Supabase 扩展) | 最新 | 原生中文支持，免费够用 |
| **支付** | Stripe | 最新 | 成熟的订阅管理 |
| **部署** | Vercel (前端) + 自托管 (监控) | - | 全球化 CDN，免费额度充足 |

### 2.3 前端架构

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证相关页面
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   ├── (dashboard)/       # 主应用页面
│   │   ├── layout.tsx
│   │   ├── page.tsx       # 仪表板
│   │   ├── bookmarks/     # 书签管理
│   │   ├── collections/   # 收藏集
│   │   ├── tags/          # 标签管理
│   │   ├── search/        # 搜索
│   │   ├── settings/      # 设置
│   │   └── pro/           # 付费功能
│   ├── api/               # API 路由
│   └── layout.tsx
├── components/            # React 组件
│   ├── ui/               # 基础 UI 组件
│   ├── bookmarks/        # 书签相关组件
│   ├── collections/      # 收藏集相关组件
│   ├── search/           # 搜索组件
│   ├── recommendations/  # 推荐组件
│   └── layout/           # 布局组件
├── hooks/                # 自定义 Hooks
│   ├── useUser.ts
│   ├── useBookmarks.ts
│   ├── useSearch.ts
│   └── usePremium.ts
├── lib/                   # 工具函数
│   ├── supabase/         # Supabase 客户端
│   ├── api/              # API 封装
│   ├── utils.ts
│   └── constants.ts
├── types/                # TypeScript 类型定义
└── styles/               # 全局样式
```

### 2.4 目录结构

```
mimeBookmark/
├── .env.example           # 环境变量示例
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── api/
│   │   └── layout.tsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
│
├── supabase/
│   ├── migrations/       # 数据库迁移
│   └── config.toml       # Supabase 配置
│
├── docs/
│   ├── plans/           # 设计文档
│   └── api/             # API 文档
│
├── scripts/             # 部署脚本
└── tests/               # 测试文件
```

---

## 3. 监控与日志

### 3.1 监控架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户层 (User Layer)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Page Views  │  │  Events      │  │  Errors & Crashes     │ │
│  │  (访问路径)   │  │  (用户行为)   │  │  (客户端异常)          │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     应用层 (Application Layer)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  API Logs    │  │  Auth Logs   │  │  Search Analytics     │ │
│  │  (请求追踪)   │  │  (登录/权限)  │  │  (搜索使用情况)        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     基础设施层 (Infrastructure Layer)            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  DB Queries  │  │  Edge Func   │  │  External APIs        │ │
│  │  (数据库慢查)  │  │  (函数性能)   │  │  (第三方调用)          │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 自托管监控栈

| 服务 | 镜像 | 端口 | 资源需求 | 用途 |
|------|------|------|---------|------|
| Glitchtip | glitchtip/glitchtip | 8000 | ~512MB RAM | 错误追踪 |
| Umami | ghcr.io/umami-software/umami | 3001 | ~256MB RAM | 行为分析 |
| Loki | grafana/loki | 3100 | ~256MB RAM | 日志收集 |
| Grafana | grafana/grafana | 3000 | ~256MB RAM | 可视化 |
| Redis | redis:7-alpine | 6379 | ~128MB RAM | 缓存/队列 |

### 3.3 数据保留策略

**所有监控数据保留 90 天**

```sql
-- PostgreSQL 定期清理
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM search_stats WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM events WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule('cleanup-old-data', '0 3 * * *', 'SELECT cleanup_old_data()');
```

### 3.4 核心监控指标

| 类型 | 指标 | 告警阈值 |
|------|------|---------|
| **错误** | 错误率 | > 5% / 5分钟 |
| **性能** | API 延迟 P95 | > 2秒 |
| **业务** | DAU/MAU | 持续下降 |
| **搜索** | 零结果率 | > 10% |

---

## 4. 用户系统

### 4.1 认证方式

| 方式 | 免费用户 | 付费用户 | 实现方案 |
|------|---------|---------|---------|
| 邮箱 + 密码 | ✅ | ✅ | Supabase Auth |
| Magic Link | ✅ | ✅ | Supabase Auth |
| Google OAuth | ✅ | ✅ | Supabase Auth |
| GitHub OAuth | ✅ | ✅ | Supabase Auth |
| Apple OAuth | ✅ | ✅ | Supabase Auth |

### 4.2 用户权限 (RBAC)

```sql
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');

CREATE TABLE public.permissions (
  permission_name TEXT UNIQUE NOT NULL,
  required_role user_role DEFAULT 'user'
);

-- 默认权限
INSERT INTO public.permissions VALUES
  ('bookmarks.create', 'user'),
  ('bookmarks.read', 'user'),
  ('bookmarks.update', 'user'),
  ('bookmarks.delete', 'user'),
  ('collections.*', 'user'),
  ('tags.*', 'user'),
  ('search.unlimited', 'pro'),
  ('export.full', 'pro'),
  ('api.access', 'pro'),
  ('team.create', 'team'),
  ('team.manage', 'team'),
  ('admin.users', 'admin'),
  ('admin.content', 'moderator');
```

### 4.3 用户层级结构

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  
  -- 订阅信息
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team')),
  subscription_status TEXT DEFAULT 'active',
  subscription_id TEXT,
  stripe_customer_id TEXT,
  
  -- 限制
  bookmarks_limit INT DEFAULT 5000,
  collections_limit INT DEFAULT 20,
  tags_limit INT DEFAULT 50,
  
  -- 使用统计
  bookmarks_count INT DEFAULT 0,
  storage_used_bytes BIGINT DEFAULT 0,
  
  -- 偏好设置
  preferences JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. 数据库设计

### 5.1 ER 图

```
┌─────────────────────────────────────────────────────────────────┐
│                       核心实体关系                               │
│                                                                 │
│  ┌─────────────┐         ┌─────────────┐         ┌───────────┐ │
│  │ collections │ 1    N  │  bookmarks  │ N    N  │    tags   │ │
│  │  (收藏集)    │◄───────►│   (书签)     │────────►│  (标签)   │ │
│  └─────────────┘         └─────────────┘         └───────────┘ │
│         │                                              │       │
│         │ 1                                          │ N     │
│         ▼                                              ▼       │
│  ┌─────────────┐                              ┌───────────┐   │
│  │collection_  │                              │tag_       │   │
│  │members      │                              │bookmarks  │   │
│  └─────────────┘                              └───────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 核心表结构

所有表都包含以下字段：
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `deleted_at TIMESTAMPTZ` (用于软删除)

#### 5.2.1 收藏集 (collections)

```sql
CREATE TABLE public.collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  is_public BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  bookmarks_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);
```

#### 5.2.2 书签 (bookmarks)

```sql
CREATE TABLE public.bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  domain TEXT NOT NULL,
  favicon_url TEXT,
  og_image TEXT,
  og_title TEXT,
  og_description TEXT,
  metadata JSONB DEFAULT '{}',
  clicks INT DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_read_later BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'web' CHECK (source IN ('web', 'extension', 'import', 'api')),
  cached_content TEXT,
  cached_at TIMESTAMPTZ,
  user_notes TEXT,
  user_rating INT CHECK (user_rating BETWEEN 1 AND 5)
);

-- PGroonga 全文搜索索引
CREATE INDEX idx_bookmarks_search ON public.bookmarks 
  USING pgroonga (title, description, url, domain)
  WHERE deleted_at IS NULL;
```

#### 5.2.3 标签 (tags)

```sql
CREATE TABLE public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#94a3b8',
  usage_count INT DEFAULT 0,
  CONSTRAINT tags_name_user_unique UNIQUE (user_id, name) WHERE deleted_at IS NULL
);
```

#### 5.2.4 注释 (annotations) - 付费功能

```sql
CREATE TABLE public.annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'note' CHECK (content_type IN ('note', 'summary', 'highlights', 'custom')),
  highlight_start INT,
  highlight_end INT,
  highlight_text TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  is_premium BOOLEAN DEFAULT FALSE
);
```

#### 5.2.5 关联表

```sql
-- 收藏集成员关系
CREATE TABLE public.collection_members (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, bookmark_id)
);

-- 书签标签关联
CREATE TABLE public.tag_bookmarks (
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tag_id, bookmark_id)
);
```

### 5.3 搜索历史 (Search History)

```sql
CREATE TABLE public.search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  filters JSONB DEFAULT '{}'
);
```

### 5.4 推荐系统

```sql
-- 推荐规则
CREATE TABLE public.recommendation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  min_tier TEXT DEFAULT 'free' CHECK (min_tier IN ('free', 'pro', 'team'))
);

-- 用户推荐记录
CREATE TABLE public.user_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.recommendation_rules(id) ON DELETE CASCADE,
  bookmark_url TEXT,
  title TEXT,
  description TEXT,
  cta_text TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);
```

### 5.5 审计日志 (Audit Logs)

```sql
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API 设计

### 6.1 API 规范

| 原则 | 说明 |
|------|------|
| 版本控制 | `/api/v1/` 前缀 |
| 认证 | Bearer Token (Supabase JWT) |
| 分页 | Cursor-based pagination |
| 错误 | 统一的错误响应格式 |

### 6.2 错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "url",
        "message": "URL must be a valid absolute URL"
      }
    ]
  }
}
```

### 6.3 核心 API 端点

#### 书签 (Bookmarks)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/bookmarks` | 获取书签列表 |
| GET | `/api/v1/bookmarks/:id` | 获取单个书签 |
| POST | `/api/v1/bookmarks` | 创建书签 |
| PUT | `/api/v1/bookmarks/:id` | 更新书签 |
| DELETE | `/api/v1/bookmarks/:id` | 软删除书签 |
| DELETE | `/api/v1/bookmarks/:id/permanent` | 永久删除 |
| POST | `/api/v1/bookmarks/batch-delete` | 批量软删除 |
| POST | `/api/v1/bookmarks/:id/restore` | 恢复软删除 |
| POST | `/api/v1/bookmarks/:id/archive` | 归档书签 |

#### 收藏集 (Collections)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/collections` | 获取收藏集列表 |
| GET | `/api/v1/collections/tree` | 获取收藏集树 |
| GET | `/api/v1/collections/:id` | 获取收藏集详情 |
| POST | `/api/v1/collections` | 创建收藏集 |
| PUT | `/api/v1/collections/:id` | 更新收藏集 |
| DELETE | `/api/v1/collections/:id` | 软删除收藏集 |
| PUT | `/api/v1/collections/reorder` | 重新排序 |

#### 标签 (Tags)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/tags` | 获取标签列表 |
| GET | `/api/v1/tags/suggestions` | 推荐标签 |
| POST | `/api/v1/tags` | 创建标签 |
| PUT | `/api/v1/tags/:id` | 更新标签 |
| DELETE | `/api/v1/tags/:id` | 软删除标签 |

#### 搜索 (Search)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/search` | 全文搜索 |
| GET | `/api/v1/search/suggestions` | 搜索建议 |
| GET | `/api/v1/search/history` | 搜索历史 |
| DELETE | `/api/v1/search/history` | 清空搜索历史 |

#### 注释 (Annotations) - 付费功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/annotations` | 获取注释列表 |
| GET | `/api/v1/annotations/bookmark/:id` | 获取书签注释 |
| POST | `/api/v1/annotations` | 创建注释 |
| PUT | `/api/v1/annotations/:id` | 更新注释 |
| DELETE | `/api/v1/annotations/:id` | 软删除注释 |

#### 推荐 (Recommendations)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/recommendations` | 获取推荐 |
| POST | `/api/v1/recommendations/:id/dismiss` | 关闭推荐 |
| POST | `/api/v1/recommendations/:id/click` | 记录点击 |

#### 导入/导出 (Import/Export)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/import` | 导入书签 |
| GET | `/api/v1/import/:job_id` | 获取导入进度 |
| POST | `/api/v1/export` | 导出书签 |
| GET | `/api/v1/export/:job_id` | 获取导出下载 |

#### 用户设置 (User Settings)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/me/settings` | 获取设置 |
| PUT | `/api/v1/me/settings` | 更新设置 |
| GET | `/api/v1/me/stats` | 用户统计 |

---

## 7. 付费功能与推荐系统

### 7.1 推荐系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     推荐系统架构                                 │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ 用户行为     │    │ 推荐规则     │    │ 推荐内容池          │ │
│  │ 收集器       │    │ 引擎         │    │                     │ │
│  │             │    │             │    │ • 合作伙伴网站      │ │
│  │ • 收藏记录   │───►│ • 相似标签   │───►│ • 相关主题网站      │ │
│  │ • 搜索历史   │    │ • 同域扩展   │    │ • 热门趋势网站      │ │
│  │ • 点击偏好   │    │ • 协同过滤   │    │ • 新发现网站        │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 定价计划

| 计划 | 月付 | 年付 | 特点 |
|------|------|------|------|
| Free | $0 | $0 | 基础功能 |
| Pro | $4.99 | $49.99 | 无限功能 |
| Team | $9.99 | $99.99 | 团队协作 |

### 7.3 推荐规则示例

```typescript
interface RecommendationRule {
  id: string;
  name: string;
  priority: number;
  minTier: 'free' | 'pro' | 'team';
  isActive: boolean;
  
  conditions: {
    triggerActions?: string[];
    contexts?: string[];
    minBookmarksCount?: number;
    requiredTags?: string[];
    excludedTags?: string[];
  };
  
  content: {
    type: 'external_link' | 'featured_collection' | 'promotion';
    url?: string;
    title: string;
    description: string;
    ctaText: string;
    impressionsPerUser: number;
  };
  
  weight: number;
}
```

### 7.4 支付集成

使用 Stripe 进行订阅管理：

```typescript
// 创建订阅
await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  payment_behavior: 'default_incomplete',
  payment_settings: { save_default_payment_method: 'on_subscription' },
});
```

### 7.5 付费功能访问控制

```typescript
function usePremiumFeature(feature: 'annotations' | 'api' | 'export_full' | 'team') {
  const { user } = useUser();
  
  const requiredTier = {
    annotations: 'pro',
    api: 'pro',
    export_full: 'pro',
    team: 'team',
  };
  
  if (!user || user.subscription_tier !== requiredTier[feature]) {
    return { hasAccess: false, paywall: <PaywallOverlay /> };
  }
  
  return { hasAccess: true, paywall: null };
}
```

---

## 8. 部署架构

### 8.1 Docker Compose 配置

```yaml
version: '3.8'

services:
  # 主应用
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # 监控栈
  glitchtip:
    image: glitchtip/glitchtip:latest
    ports:
      - "8000:8000"

  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    ports:
      - "3001:3000"

  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"

  mailhog:
    image: a轮mailhog/mailhog
    ports:
      - "8025:8025"
      - "8080:8080"

volumes:
  redis_data:
  glitchtip_uploads:
  umami_data:
  loki_data:
  grafana_data:
```

### 8.2 资源需求

| 服务 | CPU | RAM | 存储 |
|------|-----|-----|------|
| App (Next.js) | 0.5 | 512MB | - |
| Redis | 0.1 | 128MB | 100MB |
| Glitchtip | 0.3 | 512MB | 1GB+ |
| Umami | 0.2 | 256MB | 500MB+ |
| Loki | 0.2 | 256MB | 2GB+ |
| Grafana | 0.1 | 256MB | 100MB |
| Mailhog | 0.1 | 128MB | 100MB |
| **总计** | **~2.0** | **~2.5GB** | **~10GB** |

### 8.3 环境变量

```bash
# .env.example

# 应用
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=MimeBookmark

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_TEAM_MONTHLY=price_xxx
STRIPE_PRICE_TEAM_YEARLY=price_xxx

# 监控
GLITCHTIP_DSN=http://localhost:8000/glitchtip/1/xxx
LOKI_HOST=loki:3100
NEXT_PUBLIC_UMAMI_URL=http://localhost:3001

# 邮件
SMTP_HOST=mailhog
SMTP_PORT=1025
```

---

## 9. 路线图

### 阶段 1: MVP (4-6 周)

- [ ] 项目初始化 (Next.js + Supabase)
- [ ] 用户认证系统
- [ ] 基础书签 CRUD
- [ ] 收藏集管理
- [ ] 标签系统
- [ ] 中文全文搜索 (PGroonga)
- [ ] 基础 UI 组件

### 阶段 2: 核心功能 (4-6 周)

- [ ] 导入/导出功能
- [ ] 浏览器扩展 (Chrome)
- [ ] 搜索优化与建议
- [ ] 用户设置
- [ ] 移动端 PWA

### 阶段 3: 付费功能 (4-6 周)

- [ ] Stripe 订阅集成
- [ ] 付费功能访问控制
- [ ] 网站推荐系统
- [ ] 注释功能
- [ ] API 访问

### 阶段 4: 团队协作 (4-6 周)

- [ ] 团队功能
- [ ] 共享收藏集
- [ ] 团队分析
- [ ] 浏览器扩展 (Firefox)
- [ ] 移动端 App

---

## 附录

### A. 技术参考

- [Next.js 文档](https://nextjs.org/docs)
- [Supabase 文档](https://supabase.com/docs)
- [PGroonga 文档](https://pgroonga.github.io/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Stripe 文档](https://stripe.com/docs)

### B. 设计决策记录

| 决策 | 日期 | 状态 |
|------|------|------|
| 选择 Next.js 作为前端框架 | 2026-01-16 | 批准 |
| 选择 Supabase 作为后端服务 | 2026-01-16 | 批准 |
| 选择 PGroonga 作为全文搜索 | 2026-01-16 | 批准 |
| 自托管监控栈 (Glitchtip + Umami + Loki) | 2026-01-16 | 批准 |
| 免费增值商业模式 | 2026-01-16 | 批准 |

---

**文档版本**: 1.0  
**最后更新**: 2026-01-16  
**作者**: AI Assistant
