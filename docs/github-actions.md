# GitHub Actions 自动化发布

这个项目配置了 GitHub Actions 来自动化构建和发布流程。

## 🚀 自动发布流程

### 1. 创建新版本

有两种方式创建新版本：

#### 方式 1: 使用发布脚本（推荐）

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
./scripts/release.sh patch

# 次要版本 (1.0.0 -> 1.1.0)  
./scripts/release.sh minor

# 主要版本 (1.0.0 -> 2.0.0)
./scripts/release.sh major
```

#### 方式 2: 手动创建标签

```bash
# 更新 package.json 版本号
npm version patch  # 或 minor, major

# 更新 wxt.config.ts 中的版本号
# 手动编辑文件中的 version 字段

# 提交更改
git add package.json wxt.config.ts
git commit -m "chore: bump version to v1.0.3"

# 创建标签
git tag v1.0.3

# 推送标签触发发布
git push origin main
git push origin v1.0.3
```

### 2. 自动构建和发布

当推送带有 `v*` 格式的标签时，GitHub Actions 会：

1. ✅ 安装依赖
2. 🔨 构建 Chrome 版本扩展
3. 🦊 构建 Firefox 版本扩展  
4. 📦 创建 ZIP 打包文件
5. 🚀 创建 GitHub Release
6. ⬆️ 上传构建产物到 Release

## 📋 工作流说明

### Release 工作流 (`.github/workflows/release.yml`)

- **触发条件**: 推送 `v*` 标签或手动触发
- **输出**: GitHub Release 包含两个 ZIP 文件
  - `bili-up-extension-vX.X.X-chrome.zip` - Chrome 版本
  - `bili-up-extension-vX.X.X-firefox.zip` - Firefox 版本

### CI 工作流 (`.github/workflows/ci.yml`)

- **触发条件**: 推送到 `main/develop` 分支或 Pull Request
- **功能**: 
  - 类型检查
  - 构建测试
  - 打包测试
  - 上传构建产物 (仅限推送)

## 📦 手动触发发布

如果需要重新发布现有标签：

1. 进入 GitHub 仓库的 Actions 页面
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow"
4. 选择要发布的分支/标签
5. 点击 "Run workflow" 按钮

## 🔍 查看构建状态

- **Actions 页面**: `https://github.com/你的用户名/bili-up-extension/actions`
- **Releases 页面**: `https://github.com/你的用户名/bili-up-extension/releases`

## ⚙️ 配置说明

### 权限要求

工作流需要以下权限（已配置）：
- `contents: write` - 用于创建 Release 和上传文件

### 环境变量

- `GITHUB_TOKEN` - 自动提供，无需配置

### 自定义配置

如需修改构建配置，编辑以下文件：
- `.github/workflows/release.yml` - 发布工作流
- `.github/workflows/ci.yml` - CI 工作流
- `scripts/release.sh` - 发布脚本

## 🐛 故障排除

### 常见问题

1. **权限错误**: 确保仓库 Settings > Actions > General 中启用了 "Read and write permissions"

2. **文件路径错误**: 检查 `.output/` 目录中的实际文件名是否与工作流中的路径匹配

3. **标签格式**: 确保标签以 `v` 开头，如 `v1.0.0`

### 调试技巧

1. 查看 Actions 日志了解具体错误
2. 本地运行构建命令测试：
   ```bash
   yarn build
   yarn build:firefox  
   yarn zip
   yarn zip:firefox
   ls -la .output/
   ```

## 📝 版本号规范

遵循语义化版本控制 (SemVer)：
- **MAJOR.MINOR.PATCH** (例如: 1.2.3)
- **PATCH**: 向后兼容的问题修正
- **MINOR**: 向后兼容的功能新增  
- **MAJOR**: 不向后兼容的 API 修改