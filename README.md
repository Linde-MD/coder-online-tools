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
| 材料阅读 | `#/material-reader` | 读取用户授权的本地 bookshelf 目录，预览 learn-from-materials 生成的互动 HTML 与 Markdown。 |

`#/j1939` 是兼容入口，当前会重定向至 `#/can-arch`；J1939 ID/PGN 换算作为 CAN 架构相关辅助能力提供。

## 使用教程

### CAN 架构设计器

1. 在 `#/can-arch` 通过工具栏新增 ECU 与 CAN BUS，在属性面板设置名称、颜色、波特率及协议参数。
2. 连接 ECU 与 BUS，调整连线样式、锚点和协议；支持多选、框选、拖拽、撤销/重做、缩放和全屏。
3. 双击 ECU，在各 BUS 的 RX/TX 分页中编辑报文与 Signal。相同名称或 CAN ID 的冲突报文会被标记，且不会导出。
	Signal 属性会按所属报文的 DLC（字节数）和 Intel/Motorola 字节序实时提示起始位、长度越界；属性输入过程中保留非法值以便修正。修改 DLC 或重新选中 Message 时仍沿用现有的布局整理行为。
4. 通过“文件”导入 DBC 或完整架构 JSON。DBC 必须经向导确认，可选择目标 BUS，并对同名 ECU 新建、重命名或合并。
5. 选中 ECU、BUS 或连线后导出 DBC；画布还可导出 JSON、SVG 或 PNG。架构会自动保存到浏览器本地存储。

Signal 和 Message 属性右上角均提供表单、JSON、YAML 三个图标，可互相切换；文本模式使用 Monaco 编辑器并按当前格式提供 JSON5/YAML 语法高亮，编辑区左侧缩进栏可折叠和展开代码块，支持 `Ctrl+F` 查找和 `Ctrl+H` 查找替换。底部图标支持复制、保存及丢弃草稿后重新载入，悬浮可查看名称。文本编辑区或其工具按钮获得焦点时，`Ctrl+S`（macOS 为 `Cmd+S`）保存到浏览器 IndexedDB；校验失败时按钮禁用，快捷键也不会保存。

Signal 的 JSON 和 YAML 共用字段校验，必须包含 `name`、`startBit`、`length`、`factor`、`offset`、`signed`、`unit`、`comment`，不接受内部 `id` 或未知字段。`min`/`max` 为可选字段，省略或设为 `null` 表示不设置对应物理界限；自动生成的文本会包含这两个字段，未设置时值为 `null`。`unit`/`comment` 可为空字符串；数值、布尔值须使用所选格式对应的类型。文本最多 64 KiB，保存前同时检查 DLC、字节序和物理值上下限。

Message 的单独属性文本必须包含 `name`、`protocol`、`id`、`txMode`、`periodMs`、`byteOrder`、`dlc`、`dlcMode`、`senders`、`receiverMode`、`receivers`、`comment`；不接受内部 `idHex`、`color`、`signals` 或未知字段，保存会保留原有子 Signal 和内部唯一标识。这里的 `id` 是 CAN ID 数值，不是 Message 的内部 UUID；可用十进制整数或无引号的十六进制数，例如 `0x7FF`，不接受字符串。Message 的 JSON 输入兼容 JSON5，允许十六进制数值；自动生成的 JSON 保持标准格式，`id` 使用十进制数字，自动生成的 YAML 则将 `id` 显示为 `0x` 前缀的十六进制数值，其他数字字段仍为十进制。单个 Signal 的 JSON 模式保持严格标准 JSON。`dlc` 是 0-64 的整数字节数；事件模式的 `periodMs` 必须为 `null`，周期和混合模式为非负整数。文本保存不会自动裁剪 Signal，若新的 DLC 或字节序导致当前 Signal 越界则拒绝保存。

Message 文本中的 `senders`、`receivers` 使用当前 BUS 上 ECU 的名称，而非 UUID；保存时解析为内部节点关联。名称必须精确匹配且在当前 BUS 上唯一，找不到或重名时禁止保存，不会猜测节点。`senders` 第一项为默认发送方。每条报文必须至少有一个发送方；节点接收模式必须有接收方，广播模式使用 `receiverMode: broadcast` 和空 `receivers`。载入旧拓扑时会自动删除收发方配置不完整的报文并写回清理结果；DBC 导入遇到无法解析发送方或接收方的报文也会跳过。J1939 协议还必须包含 `j1939` 对象，字段为 `pgn`、`priority`、`sa`、`da`；Priority 可为 0-7 或 `dont_care`，PDU2 的 DA 为 `broadcast`。保存前校验字段范围、收发方地址以及非 `dont_care` 模式下的 ID 一致性。

表单的发送方／接收方选择器使用共享主题复选框及扁平取消、确认图标；悬浮可查看名称，支持键盘焦点和 Escape 取消。取消不应用临时选择，添加发送方保留当前广播接收模式。

在报文卡片上右键，选择“编辑 Message 与全部 Signal”，会在右侧打开完整报文编辑器，默认 YAML，也可切换 JSON。文档包含上述 Message 字段以及必需的 `signals` 数组，每项使用 Signal 的公开属性字段，不包含内部 UUID；沿用 JSON5 输入兼容、YAML 十六进制 CAN ID、ECU 名称关联、复制和 `Ctrl+S` 保存。顶部返回图标可回到普通属性编辑。

RX、TX 报文区域可分别切换“卡片视图”、JSON 或 YAML 文本编辑。文本视图编辑当前 BUS 分栏中的完整报文列表，不受卡片筛选影响；根对象为 `{ "messages": [...] }`，字段及 Signal 校验沿用完整报文规则。保存会整体更新该分栏，匹配的报文及 Signal 保留内部标识，校验或持久化失败不会丢失原列表。

完整编辑器使用紧凑单行工具栏，文本区填满剩余高度，底部保存／复制栏始终可见；错误列表局部滚动，不挤占整块编辑区。校验错误出现时，可拖动编辑区与错误列表之间的分割线调整高度，也可聚焦分割线后用方向键调整。拖拽顶部报文名称栏可从右侧分离为页面内的独立浮动窗口，也可点击右上角“独立窗口”图标。浮动后继续拖标题栏移动，拖右下角手柄调整宽高；拖到工作区右侧边缘出现停靠预览后松手，可恢复右侧停靠，也可点击“停靠到右侧”图标。

窗口移动和缩放受当前视口约束，支持窄屏及应用全屏切换。标题栏聚焦时可用方向键移动，右下角手柄聚焦时可用方向键缩放，按住 Shift 加大步长。停靠／浮动切换不会重新创建文本输入框，保留未保存草稿、光标选区、焦点和内部滚动位置；保存与校验规则不变。关闭完整编辑器时释放拖拽、缩放和视口观察监听。

`signals` 是保存后的完整列表，而非增量补丁：移除条目即删除该 Signal，空数组表示删除全部 Signal，数组顺序就是保存顺序。与原列表中唯一同名 Signal 匹配的条目保留内部 ID；新增或重命名条目分配新 ID，Message 的内部 ID 不变。最多 512 项，整份文本仍限制 64 KiB。所有字段、重复名称、位重叠和范围检查均通过后，Message 与 Signal 才一次保存；容量、字节序和 Signal 位置可以在同一次编辑中一起调整，按最终草稿校验。存储失败会回滚原属性及原 Signal 数组，草稿保留以便重试。

完整编辑与单独属性编辑分别缓存草稿，不会互相覆盖；如果草稿期间原报文或任一 Signal 被其他操作修改，会阻止旧草稿保存，需明确重新载入后再编辑。

YAML 支持 `#` 注释和 `|` 多行字符串，仅接受单个 YAML 1.2 对象，拒绝重复键、显式标签、锚点和别名。`#` 注释不属于 Signal/Message 属性，需要持久保留的说明应填写在 `comment` 字段中。底层存储结构和架构 JSON 导出格式保持不变。

JSON、YAML 分别保留草稿，切换格式不会隐式保存或把未保存内容转换到另一格式；同一 ECU 编辑器会话内切换 Signal、Message 或表单模式也会保留草稿。保存后，其他格式未改动的内容会刷新；已有草稿则保留并检查冲突，避免覆盖新值。关闭编辑器或刷新页面后未保存草稿不保留。复制操作只写入本机剪贴板，不会自动向第三方 AI 发送数据。

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

### 材料阅读

1. 使用 learn-from-materials 生成学习成果后，将每份材料的 HTML/Markdown 交付文件分别放入一个成果文件夹。
2. 打开 `#/material-reader`，首次点击“选择成果文件夹”，选择 `bookshelf` 并授权读取。浏览器会保存目录句柄；后续访问会尝试自动扫描，权限失效时按提示重新授权。
3. 从列表选择材料和 HTML 或 Markdown 文件进行预览。可选择浏览器全屏，或放大到应用导航栏下方阅读。该功能只读取和渲染已生成的成果，不处理原材料，也不运行 Copilot CLI；HTML 在受限 iframe 中显示，可能无法使用依赖浏览器本地存储的功能。

## 技术栈与数据边界

- **前端**：Vue 3、Vue Router、Vite、D3、Monaco Editor、Marked、Lodash、Dexie.js。
- **样式**：Tailwind CSS 为新增样式首选；Bootstrap CSS 仅为既有界面兼容保留。
- **服务与发布**：Node.js、Koa、`koa-static`、`koa-proxies`；可用 `pkg` 打包 Windows EXE。
- **测试**：Vitest。
- **数据**：CAN 架构与吸顶偏好、内嵌 J1939 换算设置、曲线配置与公式、文言脚本、知识问答连接设置通过 Dexie.js 写入浏览器 IndexedDB（数据库 `coderOnlineTools`，表 `settings`）。首次读取时自动迁移当前站点的旧 `localStorage` 数据，写入成功后删除对应旧键；迁移失败保留旧数据。全局路由记忆仍使用 `localStorage`。
- **安全边界**：IndexedDB 仍是浏览器本地存储，并非加密保险箱；知识库 Authorization 不会因迁移自动加密。应用不内置知识库服务地址或密钥，也不提供服务端代理鉴权。知识库会话仍仅保存在内存中。

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
