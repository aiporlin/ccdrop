# Cloudflare 部署指南

本指南将帮助您将CCDrop项目部署到Cloudflare平台。项目包含两个主要部分：前端（Next.js应用）和后端（Socket.io信令服务器）。

## 1. 前端部署（Cloudflare Pages）

### 前置条件
- Cloudflare账号
- GitHub/GitLab/Bitbucket账号（用于代码托管）
- 确保本地可以成功构建项目：
  ```bash
  npm install
  npm run build
  ```

### 步骤

#### 1.1 准备代码

确保您的代码已经提交到代码仓库，并包含以下配置：

- `next.config.ts` 已配置为导出静态页面
- `.env.example` 文件包含必要的环境变量说明

### 步骤

#### 1.2 部署到Cloudflare Pages

1. 登录到 [Cloudflare Pages 仪表板](https://dash.cloudflare.com/?to=/:account/pages)
2. 点击左侧菜单的 "Pages" 选项
3. 点击 "Create a project" 按钮
4. 选择您的代码仓库（GitHub/GitLab/Bitbucket）
5. 按照提示授权Cloudflare访问您的仓库
6. 配置构建设置：
   - Framework preset: `Next.js`
   - Build command: `npm run build && npm run export`
   - Build output directory: `out`
   - Environment variables:
     - 添加 `NEXT_PUBLIC_SOCKET_SERVER_URL` 指向您的信令服务器地址 (格式: https://your-worker.your-account.workers.dev)
7. 点击 "Save and Deploy" 按钮

Cloudflare Pages将自动构建并部署您的应用。部署完成后，您将获得一个 `.pages.dev` 域名。

**注意**：前端项目在构建时会将环境变量嵌入到代码中，因此每次修改环境变量后需要重新部署项目以使其生效。

### 服务器端预渲染注意事项

1. **免费计划可用性**：Cloudflare提供免费的Pages和Workers计划，通常足够个人项目和小型应用使用。

2. **部署前构建验证**：在部署到Cloudflare Pages之前，**必须**在本地成功运行`npm run build`命令，确保没有编译错误。

3. **WebSocket连接限制**：免费计划中的WebSocket连接数量有一定限制。

4. **服务器端预渲染注意事项**：
   - WebSocket连接和相关状态必须在客户端环境初始化
   - 使用typeof window !== 'undefined'和window.WebSocket检查确保只在浏览器环境执行
   - 将所有WebSocket相关的函数、状态变量和连接初始化代码放在React组件内部
   - 使用useRef管理WebSocket连接实例和消息处理器，避免全局变量
   - 避免在模块级别定义可能导致浏览器API访问的代码
   - 组件卸载时正确清理WebSocket连接和定时器
   - 所有依赖客户端API的操作都应封装在客户端环境检查中

### 故障排除

如果遇到部署问题：

1. **构建错误**：检查是否有TypeScript编译错误或缺失的模块。

2. **连接问题**：验证`NEXT_PUBLIC_SOCKET_SERVER_URL`环境变量是否正确设置，确保Worker URL可访问。

3. **查看构建日志**：Cloudflare Pages提供详细的构建日志，检查日志以获取具体的错误信息。

## 2. 后端部署（Cloudflare Workers）

我们提供了一个基于Cloudflare Workers的后端实现，无需Durable Objects，更加简单易用。

### 前置条件
- Cloudflare账号（免费计划即可）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) 已安装

### 部署步骤

#### 2.1 部署Worker

1. 在本地项目目录中，确保已安装Wrangler CLI：

```bash
npm install -g wrangler
```

2. 登录到Cloudflare：

```bash
wrangler login
```

3. 更新 `wrangler.toml` 文件中的配置：
   - 修改 `name` 为您的Worker名称
   - 更新 `pattern` 和 `zone_name` 为您的域名配置（可选）

4. 部署Worker：

```bash
wrangler deploy
```

5. 部署完成后，记录Worker的URL（例如：`https://ccdrop-signaling-server.your-username.workers.dev`）

### 2.2 配置环境变量

在Cloudflare Pages项目设置中，更新 `NEXT_PUBLIC_SOCKET_SERVER_URL` 环境变量，指向您部署的Worker URL。

```
NEXT_PUBLIC_SOCKET_SERVER_URL=https://ccdrop-signaling-server.your-username.workers.dev
```

### 2.3 测试连接

部署完成后，您可以通过以下方式测试连接：

1. 访问您的Cloudflare Pages网站
2. 打开浏览器开发者工具的控制台
3. 检查是否成功连接到WebSocket服务器
4. 测试两个设备之间的连接功能

### 注意事项

- 此实现使用普通的Cloudflare Workers，无需Durable Objects（付费功能）
- 注意：在生产环境中，由于Cloudflare Workers可能会启动多个实例，不同实例之间不会共享连接信息
- 对于小型应用或测试环境，这个实现已经足够使用
- 对于高流量应用，可能需要调整Worker的资源限制
- 如果遇到连接问题，请检查Cloudflare Workers的日志获取详细错误信息

## 3. 配置环境变量

### 环境变量配置

### 重要说明

前端需要正确配置 WebSocket 信令服务器地址。由于安全限制，在 Cloudflare Pages 生产环境中，必须通过 HTTPS/WSS 协议连接，且地址格式必须正确。

### 环境变量配置详情

#### 前端环境变量（NEXT_PUBLIC_前缀）
- `NEXT_PUBLIC_SOCKET_SERVER_URL`: WebSocket信令服务器地址
  - **本地开发**：`http://localhost:3003`（或您的本地服务器端口）
  - **生产环境**：`https://your-worker.your-account.workers.dev`（Cloudflare Worker URL）
  
#### 环境变量配置要求
- **格式要求**：必须以 `https://` 开头（生产环境），前端会自动转换为 `wss://`
- **安全要求**：生产环境必须使用 HTTPS/WSS，HTTP/WSS 会被浏览器安全策略阻止
- **访问权限**：确保 Worker 已正确配置 CORS，允许前端域名访问

## 4. 测试部署

部署完成后，按照以下步骤测试应用功能：

1. 访问您的Cloudflare Pages网站（例如 `your-project.pages.dev`）
2. 检查应用是否正常加载
3. **WebSocket 连接检查**：
   - 打开浏览器开发者工具（F12）→「网络」标签→筛选「WS」
   - 刷新页面，检查是否成功建立 WebSocket 连接
   - 查看连接状态和错误信息
4. 测试两个不同设备之间的连接和文件传输功能

### 常见问题排查

#### WebSocket 连接错误

如果遇到 WebSocket 连接错误，请检查以下几点：

1. 确认 Cloudflare Worker 服务正在运行
2. **环境变量检查**：验证 `NEXT_PUBLIC_SOCKET_SERVER_URL` 环境变量是否正确设置
   - 确保格式为 `https://your-worker.your-account.workers.dev`
   - 确认变量名称完全一致，区分大小写
   - 验证 Worker URL 是否可访问
3. **CORS 问题**：检查 Worker 是否已正确配置 CORS，允许前端域名访问
4. **浏览器安全策略**：确保在 HTTPS 页面上使用 WSS（加密 WebSocket）连接
5. 查看浏览器控制台和 Cloudflare Worker 日志获取详细错误信息

## 5. 注意事项

- P2P连接可能受到防火墙和网络配置的限制
- 在某些网络环境下，可能需要配置TURN服务器来中继连接
- 确保信令服务器有足够的资源处理并发连接
- 定期监控和更新依赖，确保安全性

## 6. 自定义域名

如果您有自己的域名，可以在Cloudflare Pages设置中配置自定义域名。

1. 在Cloudflare Pages项目设置中，点击 "Custom domains"
2. 点击 "Setup a custom domain"
3. 按照提示配置您的域名DNS记录

部署完成！您的CCDrop应用现在应该可以通过Cloudflare访问了。