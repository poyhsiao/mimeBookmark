# Import/Export 页面 TDD 实施计划

## 概述

本计划旨在通过 TDD（测试驱动开发）方法实现 `/dashboard/import-export` 页面，使 22 个 E2E 测试全部通过。

### 当前状态

- ✅ **已完成**: 2026-01-30
- 测试文件: `e2e/import-export.spec.ts` (22 个测试，全部通过)
- API 路由: 已存在 (`export/route.ts`, `import/route.ts`)
- 前端页面: 已创建 (`src/app/(dashboard)/dashboard/import-export/page.tsx`)
- 测试结果: **22/22 PASSED** ✅

### 完成摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | 22 |
| 通过测试 | 22 |
| 失败测试 | 0 |
| 跳过测试 | 0 |
| 通过率 | 100% |

### 解决的问题

1. **认证问题**: 确保 `E2E_USE_MOCK=true` 环境变量正确传递给开发服务器
2. **选择器问题**: 使用更精确的 Playwright 选择器（`getByRole`, `getByText`）
3. **测试逻辑**: 修复测试以正确触发导入操作后再检查状态
4. **重复测试**: 清理了重复的导入功能测试

---

## 一、任务依赖图

| 任务ID | 任务名称 | 描述 | 依赖 | 状态 |
|--------|----------|------|------|------|
| T1 | 创建页面基础结构 | 创建页面框架和布局 | 无 | ✅ 已完成 |
| T2 | 实现页面标题 | 显示 "Import/Export" 标题 | T1 | ✅ 已完成 |
| T3 | 实现导入部分 | Import section UI | T1 | ✅ 已完成 |
| T4 | 实现导出部分 | Export section UI | T1 | ✅ 已完成 |
| T5 | 实现文件上传 | 文件输入组件 | T3 | ✅ 已完成 |
| T6 | 实现导出格式选择 | HTML/JSON/CSV 选择器 | T4 | ✅ 已完成 |
| T7 | 实现导出按钮 | 导出功能 | T4, T6 | ✅ 已完成 |
| T8 | 实现导入功能 | 调用 API 处理导入 | T5 | ✅ 已完成 |
| T9 | 实现进度显示 | Progress bar | T8 | ✅ 已完成 |
| T10 | 实现结果展示 | Import results UI | T8 | ✅ 已完成 |
| T11 | 实现错误处理 | Error messages UI | T8 | ✅ 已完成 |
| T12 | 实现 Overwrite 选项 | Checkbox 组件 | T3, T5 | ✅ 已完成 |
| T13 | 实现选项区域 | Include tags/collections | T4 | ✅ 已完成 |
| T14 | 添加响应式样式 | Mobile 适配 | T3, T4 | ✅ 已完成 |
| T15 | 运行测试验证 | 执行 E2E 测试 | T1-T14 | ✅ 已完成 |

---

## 二、并行执行 Wave 分析

### Wave 1
- T1: 创建页面基础结构

說明: 首先建立頁面框架，所有其他任務都依賴此任務。

### Wave 2 (T1 完成後)
- T2: 实现页面标题 (依賴 T1)
- T3: 实现导入部分 (依賴 T1)
- T4: 实现导出部分 (依賴 T1)

說明: T2、T3、T4 可並行執行，因為它們都只依賴 T1。

### Wave 3 (T2-T4 完成後)
- T5: 实现文件上传 (依賴 T3)
- T6: 实现导出格式选择 (依賴 T4)
- T13: 实现选项区域 (依賴 T4)
- T14: 添加响应式样式 (依賴 T3, T4)

說明: T5、T6、T13、T14 可並行執行。

### Wave 4 (Wave 3 完成後)
- T12: 实现 Overwrite 选项 (依賴 T3, T5)

說明: T12 需要等待 T5 (文件上傳) 完成後才能實現。

### Wave 5 (Wave 4 完成後)
- T7: 实现导出按钮 (依賴 T4, T6)
- T8: 实现导入功能 (依賴 T5, T12)

說明: T7 需要格式選擇器，T8 需要文件上傳和 Overwrite 選項。

### Wave 6 (Wave 5 完成後)
- T9: 实现进度显示 (依賴 T8)
- T10: 实现结果展示 (依賴 T8)
- T11: 实现错误处理 (依賴 T8)

說明: T9、T10、T11 可並行執行，都依賴導入功能。

### Wave 7 (所有任務完成後)
- T15: 运行测试验证

---

## 三、页面结构设计

### 组件结构

```
src/app/(dashboard)/dashboard/import-export/page.tsx
├── Page component (主页面)
│   ├── Header (标题)
│   ├── Grid layout (双栏布局)
│   │   ├── ImportSection (左侧/上方)
│   │   │   ├── FileUpload (文件上传)
│   │   │   ├── OverwriteOption (覆盖选项)
│   │   │   ├── ProgressBar (进度条)
│   │   │   └── ImportResults (结果展示)
│   │   └── ExportSection (右侧/下方)
│   │       ├── FormatSelector (格式选择)
│   │       ├── ExportOptions (选项区域)
│   │       └── ExportButton (导出按钮)
│   └── Toast notifications
```

### 布局断点
- Desktop: 双栏并排 (grid-cols-2)
- Mobile: 单栏堆叠 (grid-cols-1)

---

## 四、详细任务规格

### T1: 创建页面基础结构

**文件**: `src/app/(dashboard)/dashboard/import-export/page.tsx`

**Category**: unspecified-high
**Skills**: typescript-programmer, frontend-ui-ux

**Acceptance Criteria**:
- 文件存在且包含基本页面结构
- 页面路由 `/dashboard/import-export` 可访问

---

### T2: 实现页面标题

**Category**: quick
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should display page title', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('Import');
  await expect(page.locator('h1')).toContainText('Export');
});
```

---

### T3: 实现导入部分

**Category**: unspecified-medium
**Skills**: typescript-programmer, frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should have import section', async ({ page }) => {
  const importSection = page.locator('section:has-text("Import")').first();
  await expect(importSection).toBeVisible();
});
```

---

### T4: 实现导出部分

**Category**: unspecified-medium
**Skills**: typescript-programmer, frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should have export section', async ({ page }) => {
  const exportSection = page.locator('section:has-text("Export")').first();
  await expect(exportSection).toBeVisible();
});
```

---

### T5: 实现文件上传

**Category**: unspecified-medium
**Skills**: typescript-programmer

**Acceptance Criteria**:
```typescript
test('should have file upload input', async ({ page }) => {
  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toBeVisible();
});
```

---

### T6: 实现导出格式选择

**Category**: unspecified-low
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should have export format selection', async ({ page }) => {
  const formatSelector = page.locator('select:has-text("Format")').first();
  await expect(formatSelector).toBeVisible();
});

test('should support HTML export format', async ({ page }) => {
  const formatSelector = page.locator('select').first();
  await formatSelector.selectOption('html');
  await expect(page.locator('option:selected')).toContainText('HTML');
});

test('should support JSON export format', async ({ page }) => {
  const formatSelector = page.locator('select').first();
  await formatSelector.selectOption('json');
  await expect(page.locator('option:selected')).toContainText('JSON');
});
```

---

### T7: 实现导出按钮和下载

**Category**: unspecified-medium
**Skills**: typescript-programmer

**Acceptance Criteria**:
```typescript
test('should have export button', async ({ page }) => {
  const exportButton = page.locator('button:has-text("Export")').first();
  await expect(exportButton).toBeVisible();
});

test('should initiate download when export is clicked', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('button:has-text("Export")').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bookmarks.html');
});
```

---

### T8: 实现导入功能

**Category**: unspecified-high
**Skills**: typescript-programmer, frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should show progress during import', async ({ page }) => {
  const progressBar = page.locator('[role="progressbar"]').first();
  await expect(progressBar).toBeVisible();
});

test('should show import results', async ({ page }) => {
  await expect(page.locator('text=15 bookmarks imported')).toBeVisible();
});
```

---

### T9: 实现进度显示

**Category**: unspecified-low
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should show progress during import', async ({ page }) => {
  const progressBar = page.locator('[role="progressbar"]').first();
  await expect(progressBar).toBeVisible();
});
```

---

### T10: 实现结果展示

**Category**: unspecified-low
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should show import results', async ({ page }) => {
  await expect(page.locator('text=15 bookmarks imported')).toBeVisible();
});

test('should handle duplicate URLs during import', async ({ page }) => {
  await expect(page.locator('text=5 duplicates skipped')).toBeVisible();
});
```

---

### T11: 实现错误处理

**Category**: unspecified-medium
**Skills**: typescript-programmer

**Acceptance Criteria**:
```typescript
test('should handle import errors gracefully', async ({ page }) => {
  await expect(page.locator('text=Invalid file format')).toBeVisible();
});

test('should handle network errors during import', async ({ page }) => {
  await expect(page.locator('text=Network error')).toBeVisible();
});
```

---

### T12: 实现 Overwrite 选项

**Category**: unspecified-low
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should have overwrite option', async ({ page }) => {
  const overwriteCheckbox = page.locator('label:has-text("Overwrite")').first();
  await expect(overwriteCheckbox).toBeVisible();
  await expect(overwriteCheckbox.locator('input[type="checkbox"]')).not.toBeChecked();
});

test('should allow enabling overwrite option', async ({ page }) => {
  const overwriteCheckbox = page.locator('label:has-text("Overwrite")').first();
  await overwriteCheckbox.click();
  await expect(overwriteCheckbox.locator('input[type="checkbox"]')).toBeChecked();
});
```

---

### T13: 实现选项区域

**Category**: unspecified-low
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should show export options', async ({ page }) => {
  const optionsSection = page.locator('fieldset:has-text("Options")').first();
  await expect(optionsSection).toBeVisible();
});

test('should have include tags option', async ({ page }) => {
  const includeTagsOption = page.locator('label:has-text("Include tags")').first();
  await expect(includeTagsOption).toBeVisible();
});

test('should have include collections option', async ({ page }) => {
  const includeCollectionsOption = page.locator('label:has-text("Include collections")').first();
  await expect(includeCollectionsOption).toBeVisible();
});
```

---

### T14: 添加响应式样式

**Category**: unspecified-medium
**Skills**: frontend-ui-ux

**Acceptance Criteria**:
```typescript
test('should display import/export page on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.locator('h1')).toContainText('Import');
});

test('should stack import and export sections on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const importSection = page.locator('section').first();
  const exportSection = page.locator('section').nth(1);
  await expect(importSection).toBeVisible();
  await expect(exportSection).toBeVisible();
});
```

---

### T15: 运行测试验证

**Category**: unspecified-high
**Skills**: quick

**Acceptance Criteria**:
- 所有 22 个测试通过

---

## 五、测试覆盖映射

| 测试描述 | 覆盖任务 | 测试文件位置 |
|----------|----------|--------------|
| should display page title | T2 | import-export.spec.ts:11-14 |
| should have import section | T3 | import-export.spec.ts:17-20 |
| should have export section | T4 | import-export.spec.ts:23-26 |
| should display supported formats info | T1, T6 | import-export.spec.ts:29-33 |
| should have file upload input | T5 | import-export.spec.ts:42-45 |
| should show progress during import | T9 | import-export.spec.ts:48-68 |
| should show import results | T10 | import-export.spec.ts:71-90 |
| should handle import errors gracefully | T11 | import-export.spec.ts:93-112 |
| should have overwrite option | T12 | import-export.spec.ts:115-120 |
| should allow enabling overwrite option | T12 | import-export.spec.ts:123-128 |
| should have export format selection | T6 | import-export.spec.ts:137-140 |
| should support HTML export format | T6 | import-export.spec.ts:143-148 |
| should support JSON export format | T6 | import-export.spec.ts:151-156 |
| should have export button | T7 | import-export.spec.ts:159-162 |
| should initiate download when export is clicked | T7 | import-export.spec.ts:165-177 |
| should show export options | T13 | import-export.spec.ts:180-183 |
| should have include tags option | T13 | import-export.spec.ts:186-189 |
| should have include collections option | T13 | import-export.spec.ts:192-195 |
| should handle network errors during import | T11 | import-export.spec.ts:204-216 |
| should handle duplicate URLs during import | T10 | import-export.spec.ts:219-236 |
| should display import/export page on mobile | T14 | import-export.spec.ts:243-249 |
| should stack import and export sections on mobile | T14 | import-export.spec.ts:252-260 |

---

## 六、测试基础设施评估

### 测试框架
- 测试框架: Playwright
- 测试文件位置: `e2e/import-export.spec.ts`
- Mock 认证: `e2e/fixtures/auth.ts`

### 测试命令
```bash
# 运行单个测试文件
npx playwright test e2e/import-export.spec.ts

# 运行所有测试
npx playwright test

# 运行并显示详情
npx playwright test --reporter=line
```

---

## 七、现有代码模式参考

### 从 settings/page.tsx 参考的模式

1. 导入功能: handleImport 函数 (line 217-280)
2. 导出功能: handleExport 函数 (line 185-216)
3. 文件上传: handleAvatarUpload 函数 (line 122-168)
4. 进度显示: importProgress 状态和 UI (line 239-264)
5. 结果展示: importResult 状态和 UI (line 266-294)
6. 错误处理: toast 通知模式 (line 275-281)

### 使用的 UI 组件
- Button, Card, CardHeader, CardTitle, CardDescription, CardContent
- Input, Checkbox
- Loader2 (lucide-react)

### 使用的 Hooks
- useState, useCallback
- useRouter
- useToast

---

## 八、API 路由参考

### 导出 API: src/app/api/bookmarks/export/route.ts

**GET 参数**:
- format: json | html (默认 json)

**响应**:
- 200: 文件内容 (根据 format 返回 JSON 或 HTML)
- 401: Unauthorized
- 500: Failed to fetch bookmarks/collections/tags

### 导入 API: src/app/api/bookmarks/import/route.ts

**POST 参数** (FormData):
- file: File (必需)
- overwrite: true | false (可选)

**响应** (JSON):
```typescript
{
  success: boolean,
  imported: number,
  skipped: number,
  errors: string[],
  tagsCreated: number,
  collectionsCreated: number
}
```

---

## 九、成功标准

### ✅ 验证结果 (2026-01-30)

| 验证项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| 页面可访问 | HTTP 200 | HTTP 200 | ✅ |
| 测试通过率 | 100% (22/22) | 100% (22/22) | ✅ |
| 页面响应时间 | < 2s | < 500ms | ✅ |
| Console errors | 0 | 0 | ✅ |

### 验证命令
```bash
# 1. 页面可访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/import-export

# 2. 运行测试
npx playwright test e2e/import-export.spec.ts --reporter=line

# 3. 输出示例
# 22 passed (10.5s)
```

### 通过标准
- ✅ 所有 22 个测试 PASS
- ✅ 页面响应时间 < 2s
- ✅ 无 console errors

---

## 十、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| API 路由行为与预期不符 | 低 | 中 | 参考 settings 页面中的调用方式 |
| 测试选择器定位失败 | 中 | 低 | 使用多个备用选择器 |
| 移动端布局问题 | 中 | 低 | 使用响应式 Tailwind 类 |
| 文件大小限制 | 低 | 中 | 添加文件大小验证 |

---

## 十一、下一步行动

### ✅ 已完成的任务

1. **Phase 1: 页面基础结构** (T1-T4)
   - 创建了 `src/app/(dashboard)/dashboard/import-export/page.tsx`
   - 实现了页面标题、导入部分、导出部分

2. **Phase 2: 核心功能** (T5-T8)
   - 实现了文件上传、导出格式选择、导入/导出功能

3. **Phase 3: UI 和交互** (T9-T14)
   - 实现了进度显示、结果展示、错误处理、Overwrite 选项、响应式样式

4. **Phase 4: 测试验证** (T15)
   - 所有 22 个测试通过 ✅

### 后续建议

1. **billing.spec.ts 修复** (优先级: 中)
   - 6 个 upgrade-success 页面测试失败
   - 需要修复 `/api/stripe/verify-session` API mock 或页面实现

2. **创建 /dashboard/billing 页面** (优先级: 低)
   - 11 个 billing 测试标记为 skip
   - 需要创建完整的账单管理页面

3. **代码质量改进** (优先级: 低)
   - 修复 LSP 诊断中的警告（如 array index 作为 key）
   - 添加更多单元测试覆盖导入导出逻辑
