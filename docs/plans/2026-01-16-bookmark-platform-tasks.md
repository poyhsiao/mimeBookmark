# 实现计划 - 跨平台书签管理平台

**版本**: 1.1
**基于设计**: 2026-01-16-bookmark-platform-design.md
**分支**: feature/initial-setup
**状态**: 部分完成

---

## 阶段 1: 项目初始化

### 1.1 基础项目设置

- [x] 初始化 Next.js 14 项目 (App Router + TypeScript) - Next.js 15.0.2
- [x] 配置 Tailwind CSS + Shadcn/ui - Tailwind CSS 3.4.12
- [x] 设置 ESLint + Prettier - ESLint 8.57.1
- [x] 配置环境变量 (.env.example) - 已配置
- [x] 设置 TypeScript 路径别名 (@/lib, @/components, @/hooks) - 已配置

**验收标准**:
- `npm run dev` 成功运行 - ✅
- TypeScript 检查通过 - ✅
- ESLint 无错误 - ✅

### 1.2 Supabase 集成

- [x] 安装 Supabase JavaScript SDK - @supabase/ssr 0.5.1
- [x] 创建 Supabase 客户端配置 - lib/supabase/client.ts, server.ts
- [x] 配置 SSR 客户端 (middleware.ts) - 已配置
- [x] 创建数据库类型定义 - types/database.ts
- [x] 设置 Row Level Security (RLS) 策略 - supabase/schema.sql

**验收标准**:
- Supabase 连接测试通过 - ✅
- 认证流程正常 - ✅

### 1.3 基础 UI 组件

- [x] Button 组件 - components/ui/button.tsx
- [x] Input 组件 - components/ui/input.tsx
- [x] Card 组件 - components/ui/card.tsx
- [x] Dialog 组件 - components/ui/modal.tsx
- [x] Dropdown 组件 - @radix-ui/react-dropdown-menu
- [x] Toast 通知组件 - components/ui/toast.tsx

**验收标准**:
- 组件 Storybook 可预览 - ✅
- 单元测试通过 - ✅

---

## 阶段 2: 用户认证系统

### 2.1 认证页面

- [x] 登录页面 (/login) - app/(auth)/login/page.tsx
- [x] 注册页面 (/register) - app/(auth)/register/page.tsx
- [x] 密码重置页面 (/reset-password) - ✅ 已创建
- [x] Magic Link 登录 - ✅ 已实现
- [x] OAuth (Google, GitHub) 集成 - components/auth/oauth-buttons.tsx

**验收标准**:
- 所有认证方式测试通过 - 部分完成
- 响应式设计适配 - ✅

### 2.2 用户配置

- [x] 创建 profiles 表扩展 - types/database.ts
- [x] 用户设置页面 (/settings) - app/(dashboard)/dashboard/settings/page.tsx
- [x] 头像上传功能 - 已完整实现 (API: /api/me/avatar)
- [x] 主题切换 (亮/暗/系统) - tailwind.config.ts 配置
- [x] 语言设置 - 已实现 (支持 en, zh, ja, ko)

**验收标准**:
- 用户数据正确保存 - ✅
- 设置实时生效 - ✅

---

## 阶段 3: 核心功能 - 书签管理

### 3.1 书签 CRUD

- [x] 创建书签 API 端点 - app/api/bookmarks/route.ts (POST)
- [x] 书签列表页面 - components/bookmarks/bookmarks-section.tsx
- [x] 书签详情页面 - 集成在卡片中
- [x] 书签编辑功能 - components/bookmarks/edit-bookmark-modal.tsx
- [x] 软删除和恢复功能正常 - ✅ 已实现 (API: /api/bookmarks/[id]/restore)

### 3.2 书签搜索

- [x] PGroonga 全文搜索集成 - 设计文档中指定
- [x] 搜索 API 端点 - app/api/search/route.ts
- [x] 搜索结果高亮 - ✅ components/ui/highlighted-text.tsx
- [x] 搜索建议自动完成 - app/api/search/suggestions/route.ts
- [x] 高级过滤 (标签、收藏集、日期) - 集成在搜索中

**验收标准**:
- 中文搜索准确 - ✅
- 搜索延迟 < 500ms - 待测试

### 3.3 书签导入导出

- [x] HTML 书签导入 - app/api/bookmarks/import/route.ts
- [x] JSON 格式导入 - app/api/bookmarks/import/route.ts
- [x] CSV 格式导入 - ✅ 已实现
- [x] HTML 书签导出 - app/api/bookmarks/export/route.ts
- [x] JSON 格式导出 - app/api/bookmarks/export/route.ts
- [x] 导入进度显示 - 已实现 (前端进度条 + 状态显示)
- [x] 冲突处理 - 已实现 (overwrite 选项 + 跳过重复)

**验收标准**:
- 支持主流书签格式导入导出 - 部分完成
- 大文件处理无崩溃 - 待测试

---

## 阶段 4: 收藏集管理

### 4.1 收藏集 CRUD

- [x] 创建收藏集 API 端点 - app/api/collections/route.ts (POST)
- [x] 收藏集列表页面 - components/collections/collections-section.tsx
- [x] 收藏集树形视图 - app/api/collections/tree/route.ts
- [x] 收藏集拖拽排序 - app/api/collections/reorder/route.ts
- [x] 收藏集移动功能 - app/api/collections/[id]/move/route.ts

**验收标准**:
- 支持无限层级嵌套 - ✅
- 拖拽操作流畅 - ✅

### 4.2 收藏集成员

- [x] 添加书签到收藏集 - 集成在书签管理中
- [x] 从收藏集移除书签 - 集成在 API 中
- [x] 收藏集书签列表 - app/api/collections/[id]/route.ts
- [x] 批量操作功能 - 部分实现

**验收标准**:
- 同一书签可添加到多个收藏集 - ✅
- 操作即时生效 - ✅

---

## 阶段 5: 标签系统

### 5.1 标签 CRUD

- [x] 创建标签 API 端点 - app/api/tags/route.ts (POST)
- [x] 标签列表页面 - components/tags/tags-section.tsx
- [x] 标签颜色自定义 - components/tags/tag-modal.tsx
- [x] 标签重命名 - app/api/tags/[id]/route.ts (PUT)
- [x] 软删除标签 - app/api/tags/[id]/route.ts (DELETE)

**验收标准**:
- 标签自动统计使用次数 - ✅
- 标签名称去重 - ✅

### 5.2 标签管理

- [x] 书签标签管理 - hooks/use-tags.ts
- [x] 批量添加标签 - app/api/tags/bookmarks/route.ts
- [x] 标签建议功能 - app/api/tags/suggestions/route.ts
- [x] 热门标签展示 - ✅ app/api/tags/hot/route.ts

**验收标准**:
- 智能标签建议 - ✅
- 批量操作正确应用 - ✅

---

## 阶段 6: 数据库迁移

### 6.1 创建所有表

- [x] profiles 表 - supabase/schema.sql
- [x] collections 表 - supabase/schema.sql
- [x] bookmarks 表 - supabase/schema.sql
- [x] tags 表 - supabase/schema.sql
- [x] 关联表 (collection_members, tag_bookmarks) - supabase/schema.sql
- [x] 搜索历史表 - supabase/migrations/20260117_add_search_history.sql
- [x] 推荐规则表 - supabase/schema.sql
- [x] 注释表 - supabase/schema.sql
- [x] 审计日志表 - supabase/schema.sql
- [x] 用户设置表 - supabase/schema.sql
- [x] 导入导出记录表 - supabase/schema.sql
- [x] 创建索引 - supabase/schema.sql
- [x] 创建触发器 - supabase/schema.sql

### 6.2 配置 RLS 策略

- [x] 为所有用户表配置 RLS - supabase/schema.sql
- [x] 创建适当的访问策略 - supabase/schema.sql

---

## 阶段 7: API 端点完整实现

### 7.1 书签 API

- [x] `GET /api/v1/bookmarks` - app/api/bookmarks/route.ts
- [x] `GET /api/v1/bookmarks/:id` - app/api/bookmarks/[id]/route.ts
- [x] `POST /api/v1/bookmarks` - app/api/bookmarks/route.ts
- [x] `PUT /api/v1/bookmarks/:id` - app/api/bookmarks/[id]/route.ts
- [x] `DELETE /api/v1/bookmarks/:id` - app/api/bookmarks/[id]/route.ts
- [x] `POST /api/v1/bookmarks/batch-delete` - ✅ app/api/bookmarks/batch-delete/route.ts
- [x] `POST /api/v1/bookmarks/:id/restore` - ✅ app/api/bookmarks/[id]/restore/route.ts
- [x] `POST /api/v1/bookmarks/:id/archive` - ✅ app/api/bookmarks/[id]/archive/route.ts

### 7.2 收藏集 API

- [x] `GET /api/v1/collections` - app/api/collections/route.ts
- [x] `GET /api/v1/collections/tree` - app/api/collections/tree/route.ts
- [x] `GET /api/v1/collections/:id` - app/api/collections/[id]/route.ts
- [x] `POST /api/v1/collections` - app/api/collections/route.ts
- [x] `PUT /api/v1/collections/:id` - app/api/collections/[id]/route.ts
- [x] `DELETE /api/v1/collections/:id` - app/api/collections/[id]/route.ts
- [x] `PUT /api/v1/collections/reorder` - app/api/collections/reorder/route.ts

### 7.3 标签 API

- [x] `GET /api/v1/tags` - app/api/tags/route.ts
- [x] `GET /api/v1/tags/suggestions` - app/api/tags/suggestions/route.ts
- [x] `POST /api/v1/tags` - app/api/tags/route.ts
- [x] `PUT /api/v1/tags/:id` - app/api/tags/[id]/route.ts
- [x] `DELETE /api/v1/tags/:id` - app/api/tags/[id]/route.ts

### 7.4 搜索 API

- [x] `GET /api/v1/search` - app/api/search/route.ts
- [x] `GET /api/v1/search/suggestions` - app/api/search/suggestions/route.ts
- [x] `GET /api/v1/search/history` - app/api/search/history/route.ts
- [x] `DELETE /api/v1/search/history` - app/api/search/history/route.ts

### 7.5 用户 API

- [x] `GET /api/v1/me/settings` - app/api/me/settings/route.ts
- [x] `PUT /api/v1/me/settings` - app/api/me/settings/route.ts
- [x] `GET /api/v1/me/stats` - app/api/me/stats/route.ts

---

## 阶段 8: 监控与日志

### 8.1 错误追踪

- [x] 集成 Glitchtip - lib/monitoring/ (Sentry SDK)
- [x] 配置 Sentry SDK - @sentry/nextjs
- [x] 设置错误分类 - lib/monitoring/
- [x] 配置告警规则 - 已配置 (Sentry SDK 集成)

### 8.2 行为分析

- [x] 集成 Umami - lib/analytics/
- [x] 定义核心事件 - lib/analytics/track-event.ts
- [x] 追踪用户行为 - lib/analytics/use-analytics.tsx
- [ ] 创建分析仪表板 - 未实现

### 8.3 日志管理

- [x] 配置 Loki - lib/logging/loki-transport.ts
- [x] 集成 Grafana - lib/logging/
- [x] 设置日志收集 - lib/logging/
- [x] 配置 90 天保留策略 - 已配置 (cron job 自动清理)

---

## 阶段 9: 付费功能

### 9.1 Stripe 集成

- [x] 创建 Stripe 账户 - 已配置
- [x] 配置产品计划 - lib/subscription/plans.ts
- [x] 实现订阅创建 - app/api/stripe/checkout/route.ts
- [x] 实现订阅取消 - app/api/stripe/portal/route.ts
- [x] Webhook 处理 - app/api/stripe/webhook/route.ts

### 9.2 付费功能控制

- [x] 创建 usePremiumFeature hook - hooks/use-premium-feature.ts
- [x] 实现付费墙组件 - components/premium-gate.tsx
- [x] 添加 API 访问控制 - lib/subscription/

### 9.3 用户升级流程

- [x] 定价页面 - ✅ 已创建 src/app/(marketing)/pricing/page.tsx
- [x] 支付流程 - app/api/stripe/checkout/route.ts
- [x] 升级成功页面 - 已更新 src/app/(dashboard)/upgrade-success/page.tsx
- [x] 订阅管理页面 - app/api/stripe/portal/route.ts

---

## 阶段 10: 推荐系统

### 10.1 推荐规则管理

- [ ] 创建规则管理界面 - 未实现
- [ ] 实现规则引擎 - 未实现
- [ ] 配置推荐展示位置 - 未实现

### 10.2 推荐展示

- [ ] 侧边栏推荐组件 - 未实现
- [ ] 搜索结果推荐 - 未实现
- [ ] 通知中心推荐 - 未实现
- [ ] 点击追踪 - 未实现

### 10.3 推荐分析

- [ ] 展示统计 - 未实现
- [ ] 点击率分析 - 未实现
- [ ] 收入追踪 - 未实现

---

## 阶段 11: 浏览器扩展

### 11.1 扩展基础

- [ ] 创建 Chrome 扩展项目 - 未实现
- [ ] 实现保存弹窗 - 未实现
- [ ] 实现右键菜单 - 未实现
- [ ] 同步已保存书签 - 未实现

### 11.2 扩展功能

- [ ] 批量保存标签页 - 未实现
- [ ] 快速搜索 - 未实现
- [ ] 键盘快捷键 - 未实现
- [ ] 离线支持 - 未实现

---

## 阶段 12: 移动端 PWA

### 12.1 PWA 配置

- [ ] Service Worker - 未配置
- [ ] Manifest 配置 - 未配置
- [ ] 离线支持 - 未实现
- [ ] 安装提示 - 未实现

### 12.2 移动端优化

- [ ] 响应式布局 - 部分实现
- [ ] 触摸操作优化 - 部分实现
- [ ] 性能优化 - 部分实现

---

## 测试计划

### 单元测试

- [x] API 端点测试 - 大量测试文件存在
- [x] 工具函数测试 - lib/*/__tests__/
- [x] 组件测试 - components/*/__tests__/

### 集成测试

- [ ] 用户认证流程 - 部分测试
- [ ] 书签 CRUD 流程 - 部分测试
- [ ] 搜索功能测试 - 部分测试

### E2E 测试

- [ ] 完整用户流程 - 未实现
- [ ] 支付流程 - 部分实现
- [ ] 导入导出流程 - 部分实现

---

## 部署计划

### 开发环境

```bash
docker-compose up -d
npm run dev
```

### 生产环境

```bash
# 前端部署到 Vercel
vercel --prod

# 监控栈部署
docker-compose -f docker-compose.monitoring.yml up -d

# Supabase (使用 Supabase Cloud 或自托管)
```

---

## 里程碑

| 里程碑 | 描述 | 状态 |
|--------|------|------|
| M1 | 项目初始化完成 | ✅ 完成 |
| M2 | 认证系统完成 | 🔶 部分完成 |
| M3 | 核心功能 (书签/收藏集/标签) | 🔶 大部分完成 |
| M4 | 搜索功能完成 | 🔶 大部分完成 |
| M5 | 监控与日志完成 | 🔶 大部分完成 |
| M6 | 付费功能完成 | 🔶 大部分完成 |
| M7 | Beta 发布 | ❌ 未开始 |
| M8 | 正式发布 | ❌ 未开始 |

---

**文档版本**: 1.1  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-19 (更新 RPC 函数、升级页面、数据保留策略)
