# Copilot Repository Instructions

适用范围：本仓库内所有前端、脚本与测试代码。

## 先读什么

- 先读 [.agents/rules/README.md](.agents/rules/README.md)，再按任务类型读取对应规则文件。
- 规则按“决策类型”拆分，不按目录拆分。

## 全局强制约束

以下要求适用于本仓库的所有代码修改；规则索引和细则文件用于补充，不替代本节。

### 架构与代码

- 必须遵守 `app / features / shared / styles / scripts / tests` 分层：页面入口保持薄编排；业务专属代码放对应 feature；跨 feature 能力放 shared。
- 业务计算、状态转换、数据适配、导入导出、请求、协议和持久化逻辑必须放在合适的 services、composables、domain、infra 或 utils 中；不得把 UI、业务与存储职责混在一起。
- 组件只负责展示和交互编排；复杂界面必须拆分容器与展示组件。多处复用的 UI 或能力必须优先抽取复用，props 和模块接口必须明确稳定。
- 单个源文件通常不得超过 500 行；接近上限时必须先拆分。不得为了局部便利随意新增顶层目录或破坏现有分层。
- 代码必须清晰、可读、可测试；函数保持单一职责、输入输出明确。优先纯函数、显式传参和组合，避免含义不清的缩写、无必要抽象及过度模式化。
- 变量、函数、文件命名使用语义明确的英文；组件使用 PascalCase，组合式函数使用 `use` 前缀，事件处理使用清晰的 `onXxx` 或 `handleXxx` 命名。
- 界面文案和必要注释使用中文。注释说明原因、边界或非显然逻辑，不重复代码；说明须简洁、直接、可执行。

### 技术栈与状态

- 必须优先沿用项目现有技术栈：Vue 3 SFC 与组合式 API、Vue Router、Vite、JavaScript；不得为局部需求引入大范围 TypeScript 重构。
- 必须先检查并复用已有依赖和抽象（如 D3、Monaco Editor、Marked）；只有现有方案无法合理满足需求时才新增依赖，并控制依赖数量。测试必须沿用 Vitest 和现有测试组织方式。
- 应用本地持久化必须优先使用 Dexie.js，并通过 `src/shared/utils/app-storage.js` 或对应 feature 的存储服务访问。Feature 和 UI 组件不得直接读写 IndexedDB 或 `localStorage`。
- `localStorage` 仅用于已有的轻量用途（如路由记忆）和旧数据迁移；新增业务数据不得默认存入其中。局部状态优先留在组件内；只有跨组件共享或持久化需要时才提升，状态逻辑放入 composables、services 或存储模块。

### UI、样式与路由

- 新增或修改 UI 必须参考 `DESIGN.md` 和当前页面风格，保持视觉一致；不得另起一套配色、排版或组件风格。
- 样式优先使用 Tailwind 和项目现有 CSS 变量/token；Bootstrap 仅为兼容既有界面保留，不得扩展新的 Bootstrap 用法。颜色、边框、背景等优先复用现有 token。
- 选中、错误、悬停等交互状态必须清晰区分，不得依赖偶然的布局差异表达状态。
- 路由必须统一在路由入口管理；路由、菜单和活动状态必须保持一致。页面级入口只负责路由壳和 feature 组合，不得使用 DOM 操作驱动页面切换。

### 错误处理、文档与测试

- 失败和空状态必须提供清晰、可见的反馈；不得静默吞错、伪装成功或留下无反馈状态。错误处理方式应遵循现有分层，避免跨层重复实现提示逻辑。
- 对外模块接口、数据边界必须明确；请求、解析、持久化、协议转换和数据适配不得散落在 UI 层。
- 关键业务逻辑、数据转换和复杂状态切换必须有针对性测试；修复 bug 时优先补充回归测试。测试应覆盖可验证核心行为，不得只堆在 UI 层。
- 变更必须保持既有行为；实现完成后运行与改动范围匹配的测试、构建或检查。用户可见行为或使用方式发生变化时，必须同步更新相关文档。
- 不得为了局部开发便利破坏现有架构，也不得把临时实现写成新的默认标准。

## 规则索引

- [.agents/rules/01-项目概述.md](.agents/rules/01-项目概述.md)
- [.agents/rules/02-编码规范.md](.agents/rules/02-编码规范.md)
- [.agents/rules/03-项目结构.md](.agents/rules/03-项目结构.md)
- [.agents/rules/04-组件规范.md](.agents/rules/04-组件规范.md)
- [.agents/rules/05-API规范.md](.agents/rules/05-API规范.md)
- [.agents/rules/06-路由规范.md](.agents/rules/06-路由规范.md)
- [.agents/rules/07-状态管理.md](.agents/rules/07-状态管理.md)
- [.agents/rules/08-通用约束.md](.agents/rules/08-通用约束.md)
- [.agents/rules/09-样式规范.md](.agents/rules/09-样式规范.md)
- [.agents/rules/10-文档规范.md](.agents/rules/10-文档规范.md)
- [.agents/rules/11-测试规范.md](.agents/rules/11-测试规范.md)