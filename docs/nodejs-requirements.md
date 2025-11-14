# Node.js 版本要求

## ⚠️ 重要说明

这个项目需要 **Node.js 20.x 或更高版本**。

### 为什么需要 Node.js 20+？

项目依赖的 `@wxt-dev/browser` 包要求 Node.js 版本 `>=20.19.0 || >=22.12.0`。

### 检查当前版本

```bash
node --version
```

### 升级 Node.js

#### 使用 nvm (推荐)

```bash
# 安装/使用 Node.js 20
nvm install 20
nvm use 20

# 设为默认版本
nvm alias default 20
```

#### 使用官方安装包

访问 [Node.js 官网](https://nodejs.org/) 下载最新的 LTS 版本。

#### 使用包管理器

**macOS (Homebrew):**
```bash
brew install node@20
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 本地开发

确保使用正确的 Node.js 版本后：

```bash
# 清理并重新安装依赖
yarn cache clean
rm -rf node_modules yarn.lock
yarn install

# 或使用 npm
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### CI/CD 环境

GitHub Actions 已配置使用 Node.js 20:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
```

### 故障排除

如果仍然遇到依赖问题：

1. **清理所有缓存**:
   ```bash
   yarn cache clean
   npm cache clean --force
   rm -rf node_modules
   rm -f yarn.lock package-lock.json
   ```

2. **重新安装**:
   ```bash
   yarn install
   # 或
   npm install
   ```

3. **使用备用工作流**: 
   如果 yarn 仍有问题，可以手动触发 `release-npm.yml` 工作流，它使用 npm 而不是 yarn。