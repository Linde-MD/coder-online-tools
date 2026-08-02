# coder-online-tools

> ⚠ **施工中（Work In Progress）**：功能尚未完整，且未经充分测试，请勿用于生产环境。

仓库地址：https://github.com/Linde-MD/coder-online-tools
Pages 访问：https://linde-md.github.io/coder-online-tools/

## 1. 项目定位

一个在线工具集，目前包含以下功能模块：

| 模块 | 路由 | 说明 |
|------|------|------|
| **CAN 架构设计器** | `/can-arch` | ECU 拓扑建模、CAN Bus 连线、协议配置、DBC 导入导出、报文编辑器 |
| **曲线图表工具** | `/chart` | 曲线组绘制、公式 DSL、D3 渲染 |
| **J1939 工具** | `/j1939` | J1939 协议相关工具 |
| **文言编程** | `/wenyan` | 文言编程运行环境 |

- 前端：Vue 3 + Vite + Bootstrap + D3
- 本地服务：Node.js + Koa（静态资源托管 + /api 代理）
- 发布形态：Windows EXE（通过 pkg 打包 Koa 服务）

## 2. CAN 架构设计器（can-arch）

### 2.1 拓扑画布
- 拖拽布局 ECU 节点和 CAN Bus
- 连线创建与编辑（折线/曲线/圆角折线/直角折线）
- 多种协议支持：J1939、CANopen、Generic(Std/Ext)
- 撤销/重做、全屏查看、磁吸头部
- 画布导出 SVG / PNG
- 架构配置 JSON 导入/导出

### 2.2 报文编辑器（双击 ECU 进入）
- 按 CAN Bus 分页，每个 Bus 分接收区（RX）和发送区（TX）
- 报文卡片瀑布流布局，按协议颜色区分
- Signal 信号编辑（位域、因子、偏移量、物理范围等）
- 多选复制粘贴（Ctrl+C / Ctrl+V），支持跨 ECU 粘贴并自动适配发送/接收方
- 同名/同 ID 报文冲突检测（红色错误样式 + 悬浮提示）
- 导出 DBC 时自动排除有冲突的报文
- 排序索引：按协议、对端 ECU、ID、报文名拖拽调整排序优先级
- 协议/对端筛选面板

## 3. 开发规范流程

### 3.1 安装依赖

```bash
npm install
```

### 3.2 启动前端开发环境

```bash
npm run dev
```

默认端口：`8181`。

### 3.3 本地 Koa 静态服务（可选）

```bash
npm run serve:koa
```

适用于验证与发布一致的静态托管行为。

## 4. 构建与发布规范

### 4.1 前端构建

```bash
npm run build:web
```

输出目录：`dist/web/`。

### 4.2 本地预览构建产物

```bash
npm run preview
```

用于发布前冒烟验证（预览 `dist/web/`）。

### 4.3 打包 EXE（标准发布命令）

```bash
npm run build:exe
```

该命令会先构建前端，再将 Koa 服务打包为：

- `dist/web/*`
- `dist/coder-online-tools-lab.exe`

## 5. 目录规范

- `src/`: 前端源码（业务逻辑、样式、配置）
- `public/`: 原样拷贝到构建产物的静态资源（图片、字体、静态 JSON 等）
- `dist/web/`: 前端构建产物目录（由 `npm run build:web` 生成）
- `scripts/server/`: Koa 服务与发布脚本入口
- `dist/`: 发布目录（包含前端构建产物与 EXE）

约定：

1. 页面功能代码只放在 `src/`。
2. 不直接手改 `dist/web/` 下文件。
3. 新增运行时静态资源优先放 `public/`。

## 6. 脚本说明

- `dev`: 启动 Vite 开发服务器
- `build:web`: 生成 `dist/web/`
- `preview`: 预览 `dist/web/`
- `serve:koa`: 用 Node 启动 Koa 服务
- `build:exe`: 前端构建 + EXE 打包

## 7. 团队协作建议

1. 提交前至少执行一次 `npm run build:web`。
2. 发布前执行 `npm run build:exe` 并验证 EXE 可启动。
3. 结构调整时只需要保证 `dist/web/` 输出可用，`pkg.assets` 固定保持 `dist/web/**/*`。

## 8. 第三方许可证说明

本项目集成了 `wenyan-lang/wenyan` 的运行时文件（用于文言编程功能）。

- 项目地址：`https://github.com/wenyan-lang/wenyan`
- 开源协议：MIT License
- 许可证全文与归属声明见：`THIRD_PARTY_NOTICES.md`