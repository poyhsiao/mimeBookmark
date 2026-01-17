# 代码审查问题修复摘要

## 修复日期
2026-01-17

## 已修复的问题

### 1. ✅ Settings Page - useEffect 依赖项警告
**文件**: `src/app/(dashboard)/dashboard/settings/page.tsx`
**问题**: useEffect 缺少依赖项,可能导致闭包陈旧
**修复**:
- 将 `fetchSettings` 和 `fetchStats` 包装在 `useCallback` 中
- 更新 useEffect 依赖数组为 `[fetchSettings, fetchStats]`
- 添加 `toast` 到 fetchSettings 的依赖项

### 2. ✅ Settings Page - 错误状态处理
**文件**: `src/app/(dashboard)/dashboard/settings/page.tsx`
**问题**: 加载失败时未显示错误状态,可能导致空引用
**修复**:
- 在加载检查后添加错误状态守卫
- 当 `settingsError` 存在或 `settings` 为 null 时显示错误 UI
- 添加重试按钮,允许用户重新加载设置

### 3. ✅ Collections Section - 编辑功能未实现
**文件**: `src/components/collections/collections-section.tsx`
**问题**: `handleEditCollection` 是空操作,不执行任何功能
**修复**:
- 添加 `editingCollection` 状态来跟踪选中的集合
- 实现 `handleEditCollection` 以设置选中集合并打开模态框
- 更新 `CollectionModal` 以接收 `collection` 属性用于编辑模式
- 在模态框关闭和成功时清理编辑状态

### 4. ✅ Collections Section - 树视图缺少加载和空状态
**文件**: `src/components/collections/collections-section.tsx`
**问题**: 树视图模式忽略加载状态和空状态
**修复**:
- 添加树视图模式的加载指示器
- 添加空树状态处理(带搜索和无搜索场景)
- 树为空时显示适当的消息和操作按钮

### 5. ✅ Avatar API - URL 解析可能错误处理路径
**文件**: `src/app/api/me/avatar/route.ts`
**问题**: URL 解析未验证 'avatars' 是否存在于路径中
**修复**:
- 在计算 `fileName` 前验证 `pathParts.indexOf('avatars')`
- 只在索引 >= 0 且 fileName 非空时删除存储文件
- 防止删除错误的存储键

### 6. ✅ Settings API - 首选项合并竞态条件
**文件**: `src/app/api/me/settings/route.ts`
**问题**: 读后写操作可能导致并发请求相互覆盖
**修复**:
- 创建 `merge_user_preferences` RPC 函数用于原子性 JSONB 合并
- 替换读-合并-写模式为单个原子更新
- 使用 PostgreSQL JSONB 连接操作符 (||) 进行数据库级合并
- 创建迁移文件: `20260117_add_merge_preferences_rpc.sql`

### 7. ✅ Search History API - 硬删除与软删除冲突
**文件**: `src/app/api/search/history/route.ts`
**问题**: DELETE 处理器执行硬删除,与模式的 `deleted_at` 列冲突
**修复**:
- 将 `delete()` 改为 `update({ deleted_at: new Date().toISOString() })`
- 实现软删除以与数据库模式保持一致

### 8. ✅ Avatar Storage Migration - 过度宽松的存储桶权限
**文件**: `supabase/migrations/20260117_add_avatar_storage.sql`
**问题**: 授予 authenticated 用户对 storage.buckets 的 INSERT/UPDATE/DELETE 权限
**修复**:
- 限制 `storage.buckets` 的 GRANT 为仅 SELECT
- 保持 `storage.objects` 的完整权限
- 防止用户创建/修改/删除存储桶

### 9. ✅ Search History Migration - DELETE 策略与软删除冲突
**文件**: `supabase/migrations/20260117_add_search_history.sql`
**问题**: RLS 策略允许硬 DELETE,与 `deleted_at` 列冲突
**修复**:
- 移除 "Users can delete own search history" FOR DELETE 策略
- 添加 "Users can soft-delete own search history" FOR UPDATE 策略
- 策略仅在设置 `deleted_at` 时允许更新(WITH CHECK 条件)

## 新增文件

### `supabase/migrations/20260117_add_merge_preferences_rpc.sql`
创建 `merge_user_preferences` RPC 函数用于原子性首选项合并:
- 使用 JSONB 连接操作符避免竞态条件
- 支持部分更新(仅传入的键)
- 包含 display_name 和 timezone 的可选更新
- 使用 SECURITY DEFINER 以正确的权限执行

## 测试建议

1. **Settings Page**:
   - 测试网络失败场景和重试功能
   - 验证首选项并发更新不会相互覆盖

2. **Collections**:
   - 测试编辑集合功能
   - 验证树视图加载和空状态

3. **Avatar Upload**:
   - 测试删除带有各种 URL 格式的头像

4. **Search History**:
   - 验证删除操作执行软删除
   - 确认 GET 端点过滤 deleted_at IS NULL

## 需要运行的迁移

```bash
# 应用新的 RPC 函数
supabase db push

# 或者如果使用迁移文件
supabase migration up
```

## 后续步骤

1. 运行所有数据库迁移
2. 测试所有修改的功能
3. 验证 RLS 策略按预期工作
4. 考虑为临界路径添加集成测试
