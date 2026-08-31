# Coder Online Tools Lab

面向工程场景的浏览器工具集，提供 CAN 网络架构设计、函数曲线绘制、文言编程实验工作区和私有知识库检索问答。

> **施工中（WIP）**：功能仍在演进，测试覆盖尚不完整。请先在非生产数据上验证 DBC 交换、脚本运行和私有 API 接入结果。

- 在线体验：[GitHub Pages](https://linde-md.github.io/coder-online-tools/)
- 源码仓库：[Linde-MD/coder-online-tools](https://github.com/Linde-MD/coder-online-tools)

## 功能一览

| 工具 | 路由 | 用途与能力 |
| --- | --- | --- |
| 首页 | `#/home` | 展示全部工具入口。 |
| CAN 架构设计器 | `#/can-arch` | ECU/CAN BUS 拓扑、协议配置、DBC/JSON/SVG/PNG 导入导出、报文和 Signal 编辑。 |
| 曲线图 | `#/chart` | 曲线组、JavaScript/DSL 公式、D3 SVG 渲染和显示设置。 |
| 文言编程 | `#/wenyan` | Monaco 编辑、JS/Python 编译、程序运行和古书 SVG 渲染。 |
| 知识库问答 | `#/knowledge-chat` | 用户配置 HTTP 检索 API、Authorization、提示词和 Top K，显示回答与检索片段。 |

`#/j1939` 是兼容入口，当前会重定向至 `#/can-arch`；J1939 ID/PGN 换算作为 CAN 架构相关辅助能力提供。

## 使用教程

### CAN 架构设计器

1. 在 `#/can-arch` 通过工具栏新增 ECU 与 CAN BUS，在属性面板设置名称、颜色、波特率及协议参数。
2. 连接 ECU 与 BUS，调整连线样式、锚点和协议；支持多选、框选、拖拽、撤销/重做、缩放和全屏。
3. 双击 ECU，在各 BUS 的 RX/TX 分页中编辑报文与 Signal。相同名称或 CAN ID 的冲突报文会被标记，且不会导出。
4. 通过“文件”导入 DBC 或完整架构 JSON。DBC 必须经向导确认，可选择目标 BUS，并对同名 ECU 新建、重命名或合并。
5. 选中 ECU、BUS 或连线后导出 DBC；画布还可导出 JSON、SVG 或 PNG。架构会自动保存到浏览器本地存储。

### 曲线图

1. 在 `#/chart` 新增或选择曲线组。同组曲线共用一个图，不同组分别渲染。
2. 在函数编辑器中选择 JavaScript 箭头函数或 DSL 表达式；组内可通过 `y1`、`f1(x)` 或别名引用其他曲线。
3. 保存后重新生成曲线，并在显示设置中调整尺寸、网格、点位和颜色。

### 文言编程

1. 在 `#/wenyan` 选择示例或新建脚本，在 Monaco 编辑器中编辑文言代码。
2. 使用工具栏打开语法帮助、编译 JS/Python、运行程序或渲染古书。
3. 在右侧查看编译产物、运行输出或古书渲染；渲染预览支持分页、缩放、复制和下载 SVG。

### 知识库问答

1. 在 `#/knowledge-chat` 的“连接设置”填写检索 API URL 和 Authorization。只填写令牌时，客户端按 `Bearer <token>` 发送。
2. 可选填写检索提示词，选择是否拼接到 query，并将 Top K 设置在 1-20。
3. 输入问题后按 `Ctrl+Enter` 或发送按钮提交。连接信息仅保存在当前浏览器；请求从浏览器直接发往该 API，因此目标服务必须允许 CORS。

## 技术栈与数据边界

- **前端**：Vue 3、Vue Router、Vite、D3、Monaco Editor、Marked、Lodash。
- **样式**：Tailwind CSS 为新增样式首选；Bootstrap CSS 仅为既有界面兼容保留。
- **服务与发布**：Node.js、Koa、`koa-static`、`koa-proxies`；可用 `pkg` 打包 Windows EXE。
- **测试**：Vitest。
- **数据**：CAN 架构、曲线配置、文言脚本和知识问答连接设置默认写入浏览器 `localStorage`。应用不内置知识库服务地址或密钥，也不提供服务端代理鉴权。

## 本地开发

需要 Node.js 20 或更高版本及 npm。安装并启动：

```bash
git clone https://github.com/Linde-MD/coder-online-tools.git
cd coder-online-tools
npm install
npm run dev
```

Vite 默认服务地址为 `http://localhost:8080`。开发环境的 `/api` 代理目标为 `http://www.abc.com`，应按实际后端修改 `vite.config.js`。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器。 |
| `npm test` | 运行全部 Vitest 测试。 |
| `npm run test:watch` | 以 watch 模式运行测试。 |
| `npm run build:web` | 构建静态站点到 `dist/web/`。 |
| `npm run preview` | 本地预览构建产物。 |
| `npm run serve:koa` | 使用 Koa 托管 `dist/web/`，默认端口 `8181`。 |
| `npm run build:exe` | 构建前端并生成 `dist/coder-online-tools-lab.exe`。 |
| `npm run j1939:id-to-pgn` | 运行 J1939 ID 转 PGN 脚本。 |
| `npm run j1939:pgn-to-id` | 运行 J1939 PGN 转 ID 脚本。 |

## 构建与部署

### 静态站点与 GitHub Pages

```bash
npm run build:web
npm run preview
```

构建结果位于 `dist/web/`，不应手动修改；运行时静态资源放在 `public/`。`.github/workflows/deploy-pages.yml` 会在 `main` 分支推送时以 Node.js 20 执行 `npm ci`、构建并部署到 GitHub Pages。

手动构建 Pages 路径：

```bash
VITE_BASE_PATH=/coder-online-tools/ npm run build:web
```

PowerShell：

```powershell
$env:VITE_BASE_PATH='/coder-online-tools/'; npm run build:web
```

### Koa 与 Windows EXE

`npm run serve:koa` 托管已构建的 `dist/web/`，并将 `/api` 转发到 `API_TARGET`。默认值为 `PORT=8181`、`API_TARGET=http://www.abc.com`：

```bash
PORT=9000 API_TARGET=https://api.example.com npm run serve:koa
```

`npm run build:exe` 会生成 EXE。分发时须将 `coder-online-tools-lab.exe` 与同级 `web/` 静态目录一并提供。

## 项目结构与贡献

```text
src/app/       # 入口、页面和路由
src/features/  # 按业务能力拆分的功能模块
src/shared/    # 跨功能复用组件、配置和工具
src/styles/    # 全局样式
scripts/       # Koa 服务与独立 CLI
tests/         # Vitest 测试
references/    # 产品与实现规格
```

贡献时保持 `app / features / shared / styles / scripts / tests` 分层。页面仅负责组合；数据转换、持久化和协议逻辑应下沉到 `services`、`domain`、`infra` 或 `utils`。新增 UI 遵循 [DESIGN.md](DESIGN.md)，新增纯逻辑应补充 Vitest 测试。提交前运行：

```bash
npm test
npm run build:web
```

## 第三方组件与许可证

文言编程使用 `wenyan-lang/wenyan` 运行时，采用 MIT License。完整第三方归属与许可证信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
