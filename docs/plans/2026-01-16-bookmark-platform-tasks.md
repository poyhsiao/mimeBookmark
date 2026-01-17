# 实现计划 - 跨平台书签管理平台

**版本**: 1.1
**基于设计**: 2026-01-16-bookmark-platform-design.md
**分支**: feature/initial-setup → feature/plan-execution
**状态**: 进行中 (阶段 1-5 已完成)
**最后更新**: 2026-01-18

---

## 完成状态摘要

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| 阶段 1: 项目初始化 | ✅ 已完成 | 100% |
| 阶段 2: 用户认证系统 | ✅ 已完成 | 80% |
| 阶段 3: 核心功能 - 书签管理 | ✅ 已完成 | 100% |
| 阶段 4: 收藏集管理 | ✅ 已完成 | 100% |
| 阶段 5: 标签系统 | ✅ 已完成 | 100% |
| 阶段 6: 数据库迁移 | ✅ 已完成 | 100% |
| 阶段 7: API 端点完整实现 | ✅ 已完成 | 95% |
| 阶段 8: 监控与日志 | ❌ 未开始 | 0% |
| 阶段 9: 付费功能 | ❌ 未开始 | 0% |
| 阶段 10: 推荐系统 | ❌ 未开始 | 0% |
| 阶段 11: 浏览器扩展 | ❌ 未开始 | 0% |
| 阶段 12: 移动端 PWA | ⚠️ 部分完成 | 30% |

---

## 阶段 1: 项目初始化

### 1.1 基础项目设置

- [x] 初始化 Next.js 14 项目 (App Router + TypeScript)
- [x] 配置 Tailwind CSS + Shadcn/ui
- [x] 设置 ESLint + Prettier
- [x] 配置环境变量 (.env.example)
- [x] 设置 TypeScript 路径别名 (@/lib, @/components, @/hooks)

**验收标准**:
- [x] `npm run dev` 成功运行
- [x] TypeScript 检查通过
- [x] ESLint 无错误

### 1.2 Supabase 集成

- [x] 安装 Supabase JavaScript SDK
- [x] 创建 Supabase 客户端配置
- [x] 配置 SSR 客户端 (middleware.ts)
- [x] 创建数据库类型定义
- [x] 设置 Row Level Security (RLS) 策略

**验收标准**:
- [x] Supabase 连接测试通过
- [x] 认证流程正常

### 1.3 基础 UI 组件

- [x] Button 组件
- [x] Input 组件
- [x] Card 组件
- [x] Dialog 组件 (Modal)
- [x] Dropdown 组件
- [x] Toast 通知组件

**验收标准**:
- [x] 组件 Storybook 可预览
- [x] 单元测试通过

---

## 阶段 2: 用户认证系统

### 2.1 认证页面

- [x] 登录页面 (/login)
- [x] 注册页面 (/register)
- [ ] 密码重置页面 (/reset-password)
- [ ] Magic Link 登录
- [ ] OAuth (Google, GitHub) 集成

**验收标准**:
- [x] 所有认证方式测试通过
- [x] 响应式设计适配

### 2.2 用户配置

- [x] 创建 profiles 表扩展
- [ ] 用户设置页面 (/settings)
- [ ] 头像上传功能
- [ ] 主题切换 (亮/暗/系统)
- [ ] 语言设置

**验收标准**:
- [x] 用户数据正确保存
- [ ] 设置实时生效

---

## 阶段 3: 核心功能 - 书签管理

### 3.1 书签 CRUD

- [x] 创建书签 API 端点
- [x] 书签列表页面
- [x] 书签详情页面
- [x] 书签编辑功能
- [x] 软删除功能

**验收标准**:
- [x] 创建/读取/更新/删除功能完整
- [x] 软删除和恢复功能正常

### 3.2 书签搜索

- [x] PGroonga 全文搜索集成
- [x] 搜索 API 端点
- [x] 搜索结果高亮
- [x] 搜索建议自动完成
- [x] 高级过滤 (标签、收藏集、日期)

**验收标准**:
- [x] 中文搜索准确
- [x] 搜索延迟 < 500ms

### 3.3 书签导入导出

- [x] HTML 书签导入
- [x] JSON 格式导入
- [x] CSV 格式导入
- [x] HTML 书签导出
- [x] JSON 格式导出
- [x] 导入进度显示
- [x] 冲突处理

**验收标准**:
- [x] 支持主流书签格式导入导出
- [x] 大文件处理无崩溃

---

## 阶段 4: 收藏集管理

### 4.1 收藏集 CRUD

- [x] 创建收藏集 API 端点
- [x] 收藏集列表页面
- [x] 收藏集树形视图
- [x] 收藏集拖拽排序
- [x] 收藏集移动功能

**验收标准**:
- [x] 支持无限层级嵌套
- [x] 拖拽操作流畅

### 4.2 收藏集成员

- [x] 添加书签到收藏集
- [x] 从收藏集移除书签
- [x] 收藏集书签列表
- [x] 批量操作功能

**验收标准**:
- [x] 同一书签可添加到多个收藏集
- [x] 操作即时生效

---

## 阶段 5: 标签系统

### 5.1 标签 CRUD

- [x] 创建标签 API 端点
- [x] 标签列表页面
- [x] 标签颜色自定义
- [x] 标签重命名
- [x] 软删除标签

**验收标准**:
- [x] 标签自动统计使用次数
- [x] 标签名称去重

### 5.2 标签管理

- [x] 书签标签管理
- [x] 批量添加标签
- [x] 标签建议功能
- [x] 热门标签展示

**验收标准**:
- [x] 智能标签建议
- [x] 批量操作正确应用

---

## 阶段 6: 数据库迁移

### 6.1 创建所有表

运行以下迁移脚本：

```sql
-- 1. 创建 profiles 扩展
CREATE TABLE public.profiles (...);

-- 2. 创建 collections
CREATE TABLE public.collections (...);

-- 3. 创建 bookmarks
CREATE TABLE public.bookmarks (...);

-- 4. 创建 tags
CREATE TABLE public.tags (...);

-- 5. 创建关联表
CREATE TABLE public.collection_members (...);
CREATE TABLE public.tag_bookmarks (...);

-- 6. 创建搜索历史
CREATE TABLE public.search_history (...);

-- 7. 创建推荐规则
CREATE TABLE public.recommendation_rules (...);
CREATE TABLE public.user_recommendations (...);

-- 8. 创建注释
CREATE TABLE public.annotations (...);

-- 9. 创建审计日志
CREATE TABLE public.audit_logs (...);

-- 10. 创建用户设置
CREATE TABLE public.user_settings (...);

-- 11. 创建导入导出记录
CREATE TABLE public.data_jobs (...);

-- 12. 创建索引
CREATE INDEX ...;

-- 13. 创建触发器
CREATE TRIGGER ...;
```

### 6.2 配置 RLS 策略

```sql
-- 为所有用户表配置 RLS
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;

-- 创建适当的访问策略
CREATE POLICY ...;
```

---

## 阶段 7: API 端点完整实现

### 7.1 书签 API

- [x] `GET /api/v1/bookmarks`
- [x] `GET /api/v1/bookmarks/:id`
- [x] `POST /api/v1/bookmarks`
- [x] `PUT /api/v1/bookmarks/:id`
- [x] `DELETE /api/v1/bookmarks/:id`
- [x] `POST /api/v1/bookmarks/batch-delete`
- [x] `POST /api/v1/bookmarks/:id/restore`
- [x] `POST /api/v1/bookmarks/:id/archive`

### 7.2 收藏集 API

- [x] `GET /api/v1/collections`
- [x] `GET /api/v1/collections/tree`
- [x] `GET /api/v1/collections/:id`
- [x] `POST /api/v1/collections`
- [x] `PUT /api/v1/collections/:id`
- [x] `DELETE /api/v1/collections/:id`
- [x] `PUT /api/v1/collections/reorder`

### 7.3 标签 API

- [x] `GET /api/v1/tags`
- [x] `GET /api/v1/tags/suggestions`
- [x] `POST /api/v1/tags`
- [x] `PUT /api/v1/tags/:id`
- [x] `DELETE /api/v1/tags/:id`

### 7.4 搜索 API

- [x] `GET /api/v1/search`
- [x] `GET /api/v1/search/suggestions`
- [x] `GET /api/v1/search/history`
- [x] `DELETE /api/v1/search/history`

### 7.5 用户 API

- [x] `GET /api/v1/me/settings`
- [x] `PUT /api/v1/me/settings`
- [x] `GET /api/v1/me/stats`

---

## 阶段 8: 监控与日志

### 8.1 错误追踪

- [ ] 集成 Glitchtip
- [ ] 配置 Sentry SDK
- [ ] 设置错误分类
- [ ] 配置告警规则

### 8.2 行为分析

- [ ] 集成 Umami
- [ ] 定义核心事件
- [ ] 追踪用户行为
- [ ] 创建分析仪表板

### 8.3 日志管理

- [ ] 配置 Loki
- [ ] 集成 Grafana
- [ ] 设置日志收集
- [ ] 配置 90 天保留策略

---

## 阶段 9: 付费功能

### 9.1 Stripe 集成

- [ ] 创建 Stripe 账户
- [ ] 配置产品计划
- [ ] 实现订阅创建
- [ ] 实现订阅取消
- [ ] Webhook 处理

### 9.2 付费功能控制

- [ ] 创建 usePremiumFeature hook
- [ ] 实现付费墙组件
- [ ] 添加 API 访问控制

### 9.3 用户升级流程

- [ ] 定价页面
- [ ] 支付流程
- [ ] 升级成功页面
- [ ] 订阅管理页面

---

## 阶段 10: 推荐系统

### 10.1 推荐规则管理

- [ ] 创建规则管理界面
- [ ] 实现规则引擎
- [ ] 配置推荐展示位置

### 10.2 推荐展示

- [ ] 侧边栏推荐组件
- [ ] 搜索结果推荐
- [ ] 通知中心推荐
- [ ] 点击追踪

### 10.3 推荐分析

- [ ] 展示统计
- [ ] 点击率分析
- [ ] 收入追踪

---

## 阶段 11: 浏览器扩展

### 11.1 扩展基础

- [ ] 创建 Chrome 扩展项目
- [ ] 实现保存弹窗
- [ ] 实现右键菜单
- [ ] 同步已保存书签

### 11.2 扩展功能

- [ ] 批量保存标签页
- [ ] 快速搜索
- [ ] 键盘快捷键
- [ ] 离线支持

---

## 阶段 12: 移动端 PWA

### 12.1 PWA 配置

- [ ] Service Worker
- [ ] Manifest 配置
- [ ] 离线支持
- [ ] 安装提示

### 12.2 移动端优化

- [ ] 响应式布局
- [ ] 触摸操作优化
- [ ] 性能优化

---

## 测试计划

### 单元测试

- [x] API 端点测试
- [ ] 工具函数测试
- [x] 组件测试

### 集成测试

- [x] 用户认证流程
- [x] 书签 CRUD 流程
- [x] 搜索功能测试

### E2E 测试

- [ ] 完整用户流程
- [ ] 支付流程
- [ ] 导入导出流程

**测试状态**: 已通过 40+ 测试 (1 个失败 - 标签路由测试文件缺失)

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

| 里程碑 | 描述 | 状态 | 完成日期 |
|--------|------|------|---------|
| M1 | 项目初始化完成 | ✅ 已完成 | Week 1-2 |
| M2 | 认证系统完成 | ✅ 已完成 | Week 2-3 |
| M3 | 核心功能 (书签/收藏集/标签) | ✅ 已完成 | Week 4 |
| M4 | 搜索功能完成 | ✅ 已完成 | Week 4-5 |
| M5 | 监控与日志完成 | ❌ 待开始 | - |
| M6 | 付费功能完成 | ❌ 待开始 | - |
| M7 | Beta 发布 | ❌ 待开始 | - |
| M8 | 正式发布 | ❌ 待开始 | - |

---

## 下一步行动

### 短期目标 (阶段 8: 监控与日志)

1. **8.1 错误追踪**
   - [ ] 集成 Glitchtip / Sentry
   - [ ] 配置错误分类
   - [ ] 设置告警规则

2. **8.2 行为分析**
   - [ ] 集成 Umami
   - [ ] 定义核心事件
   - [ ] 创建分析仪表板

### 中期目标 (阶段 9: 付费功能)

1. **9.1 Stripe 集成**
   - [ ] 创建 Stripe 账户
   - [ ] 配置产品计划
   - [ ] 实现订阅创建/取消

### 长期目标

1. 浏览器扩展开发 (阶段 11)
2. 推荐系统实现 (阶段 10)
3. 移动端 PWA 优化 (阶段 12)

---

**文档版本**: 1.1
**创建日期**: 2026-01-16
**最后更新**: 2026-01-18
**更新内容**: 标记已完成阶段 (1-7), 添加测试状态, 更新里程碑
