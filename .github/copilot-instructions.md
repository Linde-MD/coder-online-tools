# Copilot Repository Instructions

适用范围：本仓库内所有前端、脚本与测试代码。

## 先读什么

- 先读 [.agents/rules/README.md](.agents/rules/README.md)，再按任务类型读取对应规则文件。
- 规则按“决策类型”拆分，不按目录拆分。

## 统一硬约束

- 严格遵守现有分层：app / features / shared / styles / scripts / tests。
- 组件、页面、窗口优先拆分，不要写超大组件或 God Vue 文件。
- 业务计算、状态转换、数据适配、导入导出、持久化逻辑下沉到 services、composables、domain 或 utils。
- 新代码优先复用现有抽象，不要重复造轮子。
- 样式优先 Tailwind，已有 Bootstrap 只做兼容，不要继续扩散。
- 单个源文件通常不应超过 500 行；接近上限时先拆分。
- 适度使用 OOP、设计模式和 SOLID；同时优先纯函数、显式传参和组合优于继承。
- 新增 UI、配色、排版必须参考 DESIGN.md 和当前页面风格，保持一致。

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