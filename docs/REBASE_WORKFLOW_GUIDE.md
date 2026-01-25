# Rebase Feature Branch - 使用說明

## 功能描述

這個自動化工作流可以幫你將 feature 分支 rebase 到 main 分支，並自動生成符合 Conventional Commits 規範的 commit message。如果已經存在對應的 Pull Request，則會更新現有的 PR；如果不存在，則會創建新的 PR。

## 觸發方式

此工作流通過 GitHub Actions 手動觸發：

1. 前往 GitHub Repository 的 **Actions** 頁籤
2. 在左側菜單中選擇 **"Rebase Feature Branch"** 工作流
3. 點擊 **"Run workflow"** 按鈕
4. 在輸入框中輸入要 rebase 的 feature 分支名稱（例如：`feature/recommendation-system`）
5. 點擊 **"Run workflow"** 開始執行

## 工作流程

1. **分支檢查**
   - 驗證指定的分支是否存在
   - 確認分支名稱以 `feature/` 開頭

2. **Rebase 操作**
   - 將 feature 分支 rebase 到 `origin/main`
   - 如果 rebase 失敗，工作流會停止並提示你

3. **生成 Commit Message**
   - 分析分支中所有相對於 origin/main 的新 commits
   - 根據 commit 類型（feat, fix, docs, refactor, chore）統計最主的類型
   - 生成符合 Conventional Commits 規範的合併 message

4. **推送更新**
   - 將 rebase 後的分支強制推送到 origin

5. **Pull Request 處理**
   - 檢查是否已經存在該分支到 main 的 PR
   - 如果存在：更新 PR 的 title 和 body
   - 如果不存在：創建新的 PR

## Commit Message 格式

生成的 commit message 遵循以下格式：

```
<type>(<scope>): <description>
```

**類型判斷邏輯：**

- 如果主要是 `feat:` commits → `feat(rebase): <feature-name> - rebase onto main`
- 如果主要是 `fix:` commits → `fix(rebase): <feature-name> - rebase bug fixes onto main`
- 如果主要是 `docs:` commits → `docs(rebase): <feature-name> - update documentation via rebase`
- 如果主要是 `refactor:` commits → `refactor(rebase): <feature-name> - rebase refactored code onto main`
- 其他情況 → `chore: <feature-name> - rebase feature branch onto main`

**示例：**

```
feat(rebase): recommendation-system - rebase onto main
fix(rebase): authentication - rebase bug fixes onto main
```

## 使用場景

### 場景 1：首次 Rebase Feature

當你完成一個 feature 開發並需要將其合併到 main 時：

1. 確保你的本地分支已經推送到 origin
2. 在 GitHub Actions 中運行 "Rebase Feature Branch" 工作流
3. 輸入分支名稱：`feature/your-feature-name`
4. 工作流會自動：
   - Rebase 到 main
   - 生成合適的 commit message
   - 推送到 origin
   - 創建新的 Pull Request

### 場景 2：Rebase 已有的 PR

如果 PR 已經存在但需要更新（例如添加了新的 commits）：

1. 運行工作流並輸入相同的分支名稱
2. 工作流會自動更新現有的 PR，而不是創建新的

## 注意事項

### ✅ 正確的使用方式

- 分支名稱必須完整輸入（例如：`feature/recommendation-system`）
- 確保分支已經推送到 origin
- Rebase 操作會強制推送（force push），確保本地沒有未提交的修改

### ⚠️ 注意事項

1. **Rebase 衝突**
   - 如果發生衝突，工作流會失敗
   - 你需要本地解決衝突後再重新執行

2. **分支命名規範**
   - 此工作流只處理以 `feature/` 開頭的分支
   - 其他分支名稱會被拒絕

3. **PR 更新**
   - 工作流會更新 PR 的 title 和 body
   - 不會關閉或合併 PR

4. **權限要求**
   - 需要在 GitHub Repository Settings 中配置 `GITHUB_TOKEN` secret
   - 該 token 需要有 `repo` 權限

## 故障排除

### 工作流執行失敗

**錯誤訊息：** "Branch 'xxx' not found"
**原因：** 指定的分支不存在於 origin
**解決方案：** 檢查分支名稱是否正確，確保分支已推送到 origin

**錯誤訊息：** "Branch 'xxx' does not start with 'feature/'"
**原因：** 分支名稱不符合命名規範
**解決方案：** 確保分支以 `feature/` 開頭

**錯誤訊息：** "Rebase failed"
**原因：** 發生 rebase 衝突或其他 git 錯誤
**解決方案：**
   1. 在本地 checkout 分支：`git checkout <your-branch>`
   2. 執行 `git pull origin main` 並解決衝突
   3. 解決所有衝突後，重新執行工作流

### PR 未更新

如果工作流顯示成功但 PR 沒有更新：

1. 檢查 PR 的 `head` 分支是否正確
2. 確認 `GITHUB_TOKEN` 是否有足夠的權限
3. 查看 Actions 的日誌輸出，尋找錯誤訊息

## 進階配置

### 自定義 Commit Message

如果需要不同的 commit message 格式，可以修改 `.github/workflows/rebase-feature.yml` 中的 "Generate conventional commit message" 步驟。

### 更改目標分支

如果需要 rebase 到其他分支（例如 `develop`），需要修改以下位置：

1. `git fetch origin main` → `git fetch origin develop`
2. `git rebase origin/main` → `git rebase origin/develop`
3. `base: 'main'` → `base: 'develop'`（在 PR 創建部分）

## 相關資源

- [Conventional Commits 規範](https://www.conventionalcommits.org/)
- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [GitHub API 文檔](https://docs.github.com/en/rest)
