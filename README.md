# coder-online-tools

仓库地址：https://github.com/Linde-MD/coder-online-tools
Pages 访问：https://linde-md.github.io/coder-online-tools/

## 1. 项目定位
这是一个前后端分离的工具型项目：

- 前端：Vue 3 + Tailwind CSS + Vite + Bootstrap + D3
- 本地服务：Node.js + Koa（静态资源托管 + /api 代理）
- 发布形态：Windows EXE（通过 pkg 打包 Koa 服务）

## 2. 目录规范

- `src/`: 前端源码（业务逻辑、样式、配置）
- `public/`: 原样拷贝到构建产物的静态资源（图片、字体、静态 JSON 等）
- `dist/web/`: 前端构建产物目录（由 `npm run build:web` 生成）
- `scripts/server/`: Koa 服务与发布脚本入口
- `dist/`: 发布目录（包含前端构建产物与 EXE）

约定：

1. 页面功能代码只放在 `src/`。
2. 不直接手改 `dist/web/` 下文件。
3. 新增运行时静态资源优先放 `public/`。

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

## 5. 脚本说明

- `dev`: 启动 Vite 开发服务器
- `build:web`: 生成 `dist/web/`
- `preview`: 预览 `dist/web/`
- `serve:koa`: 用 Node 启动 Koa 服务
- `build:exe`: 前端构建 + EXE 打包

## 6. 团队协作建议

1. 提交前至少执行一次 `npm run build:web`。
2. 发布前执行 `npm run build:exe` 并验证 EXE 可启动。
3. 结构调整时只需要保证 `dist/web/` 输出可用，`pkg.assets` 固定保持 `dist/web/**/*`。

## 7. 第三方许可证说明

本项目集成了 `wenyan-lang/wenyan` 的运行时文件（用于文言编程功能）。

- 项目地址：`https://github.com/wenyan-lang/wenyan`
- 开源协议：MIT License
- 许可证全文与归属声明见：`THIRD_PARTY_NOTICES.md`

