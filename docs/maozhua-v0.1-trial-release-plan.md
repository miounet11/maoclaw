# 猫爪 v0.1 小范围试用版出品计划

Status: Draft  
Audience: Founder, product, engineering, design, operations  
Brand strategy: 外部品牌为“猫爪”，首版保留现有技术标识与命令兼容  
Release target: 小范围试用版 / Trial Beta  
Companions: [README.md](../README.md), [FEATURE_PARITY.md](../FEATURE_PARITY.md), [docs/dropin-certification-verdict.json](dropin-certification-verdict.json), [docs/dropin-parity-gap-ledger.json](dropin-parity-gap-ledger.json), [docs/releasing.md](releasing.md), [docs/openclaw-v2-technical-architecture-spec.md](openclaw-v2-technical-architecture-spec.md)

> Reference note: this is a planning document, not the canonical release-facing description.
> Start with [README.md](../README.md), [README.md](README.md), [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md), and [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md) for the current public story.

## 1. 目标

本文档定义从“了解当前项目进度”到“可以把产品直接拿给试用客户”的完整计划。

本计划不以“严格替代 Pi / OpenClaw”为目标，而以“尽快交付一个边界清晰、可安装、可试用、可演示、可回收反馈的首版产品”为目标。

首版产品定义如下：

- 对外品牌名称：**猫爪**
- 产品形态：终端优先的 AI coding agent 产品
- 首版定位：**小范围试用版**
- 命令兼容策略：继续保留 `pi` 命令
- 技术包与仓库策略：对外统一为 `maoclaw` / `猫爪`，同时保留 `pi` 命令兼容层
- 发布口径：强调“可试用”和“兼容 Pi 工作流”，不宣称 strict drop-in replacement

## 2. 当前项目状态结论

### 2.1 当前完成度判断

从 [FEATURE_PARITY.md](../FEATURE_PARITY.md) 和 [docs/parity-certification.json](parity-certification.json) 看，当前项目已经具备高完成度的产品骨架：

- 核心类型、Provider、7 个内置工具、Agent Runtime、Session、CLI、Resources、Extensions、TUI、Configuration、Authentication 均已实现
- In-scope 功能层面基本已完成
- 安装器、发布流程、质量与基准文档均已存在

从用户产品视角看，这已经不是“原型”，而是“需要收口才能出品”的阶段。

### 2.2 当前不能直接按正式版发布的原因

尽管功能面成熟，严格替代认证仍被阻断，见 [docs/dropin-certification-verdict.json](dropin-certification-verdict.json)。主要原因：

- CLI parity 未完全闭环
- JSON/RPC parity 未完全闭环
- SDK contract shape 仍存在关键缺口
- Config / env、session / error、integration I/O、differential evidence、quality gates 等硬门禁仍未全部关闭

这意味着：

- 可以做**猫爪试用版**
- 不能做“完全替代 TS Pi / OpenClaw”的正式口径发布

### 2.3 当前仓库的品牌现实

当前仓库中同时存在多层命名：

- 仓库 / package：`maoclaw`
- 用户命令：`pi`
- 历史/兼容语义：Pi / Pi Agent
- 部分未来产品线：OpenClaw / OpenClaw V2

因此首版策略必须采用**双层命名**：

- 对外产品名：猫爪
- 内部兼容命令：`pi`

不建议在 v0.1 阶段做仓库名、crate 名、二进制名的全面改名，否则会显著提高发布风险。

## 3. 猫爪 v0.1 的产品定义

### 3.1 产品一句话

> 猫爪是一款终端优先的 AI coding agent 工具，强调快、稳、低资源占用，并提供可扩展的工具、会话与自动化能力。

### 3.2 首版承诺

猫爪 v0.1 对外承诺以下能力：

- 交互式终端体验
- 单次 print 模式
- 基础 RPC 模式
- Anthropic / OpenAI / Gemini / Azure OpenAI 四类主 provider
- 7 个内置工具：`read`、`write`、`edit`、`bash`、`grep`、`find`、`ls`
- 会话保存、继续、分支、压缩
- prompt templates、skills、themes
- 基础扩展运行时
- macOS 优先的一键安装和升级体验

### 3.3 首版不承诺

猫爪 v0.1 不承诺以下能力：

- strict drop-in replacement
- TS SDK 无适配替换
- 全量 JSON/RPC 语义与事件顺序完全一致
- 全量 slash command parity
- 全量 extension lifecycle hook parity
- 全量 OpenClaw 插件兼容
- OpenClaw V2 产品能力的默认成熟交付

### 3.4 首版目标用户

- 愿意试用 AI coding agent 的早期开发者
- 愿意试用终端产品的技术客户
- 愿意提供反馈的设计伙伴客户
- 希望从 Pi 工作流迁移、但不要求严格兼容的用户

## 4. v0.1 出品成功标准

只有满足以下标准，才视为“可以出品”：

### 4.1 产品标准

- 用户能在 macOS 上顺利完成安装、升级、启动、配置、首次问答、工具调用、会话恢复
- 交互式主链路不需要人工解释才能跑通
- 有 3 至 5 个稳定演示场景可重复展示
- 对外文档完整，且表述一致
- 品牌呈现统一为“猫爪”

### 4.2 工程标准

- `cargo check --all-targets` 通过
- `cargo fmt --check` 通过
- `cargo clippy --all-targets -- -D warnings` 通过
- `cargo test --all-targets` 达到发布要求
- 安装器回归验证通过
- 发布产物可被 checksum 验证

### 4.3 发布标准

- 新版本号确定
- `CHANGELOG.md` 有对应版本节
- GitHub Release 产物齐全
- 安装脚本与 README 的版本说明一致
- 支持矩阵、已知限制、FAQ 和升级说明齐备

## 5. 总体路线图

建议按 **4–6 周**推进，拆为四个阶段。

### Phase 0 - 冻结目标与基线（2–3 天）

目标：停止讨论边界，先把首版定义固定下来。

交付物：

- 本文档定稿
- 《猫爪 v0.1 支持范围》
- 《猫爪 v0.1 已知限制》
- 《猫爪 v0.1 发布基线》

关键动作：

- 冻结首版定位为“小范围试用版”
- 冻结品牌策略为“外部品牌猫爪 + 内部命令 `pi` 保持兼容”
- 冻结首版支持 provider / 模式 / 工具范围
- 冻结不承诺范围

### Phase 1 - 质量清零与发布门禁（第 1 周）

目标：把“能运行”提升为“可发布评估”。

交付物：

- 一份新的 release gate 检查表
- 全量/必要质量命令结果
- 当前失败列表、归因与处理状态
- 安装与启动 smoke test 记录

关键动作：

1. 跑完整质量门禁
2. 区分“当前发布阻塞”和“历史/并发开发噪声”
3. 修复 all-targets 的实际阻塞
4. 补充安装器与升级路径验证
5. 形成最终 blocker 列表

### Phase 2 - 首次体验与核心链路（第 2 周）

目标：修用户第一印象。

交付物：

- 首次安装与启动流程文档
- provider 配置说明
- 失败提示优化清单
- Demo 场景脚本
- 首次使用录屏或截图

关键动作：

1. 打磨安装器体验
2. 打磨首次 provider 配置体验
3. 打磨首次对话体验
4. 打磨工具调用体验
5. 打磨 `--continue` / `--resume` 会话恢复体验
6. 打磨分享/导出体验

### Phase 3 - 品牌层与对外文档（第 3 周）

目标：把现有工程包成“猫爪”产品。

交付物：

- 品牌化 README 首页
- 产品简介页
- 试用版安装指南
- 支持矩阵
- 已知限制
- FAQ
- 试用邀请说明
- 版本说明与 changelog

关键动作：

1. 把用户可见叙事统一到“猫爪”
2. 说明命令仍为 `pi`
3. 说明兼容 Pi 工作流，但不宣称严格替代
4. 删除或重写与首版不一致的对外措辞
5. 统一版本号、安装示例和 Release 说明

### Phase 4 - 高风险兼容点收口与 RC（第 4–6 周）

目标：让小范围试用不因高频问题翻车。

交付物：

- RC 版本
- 高优先级兼容修复
- 试用反馈回收机制
- 发布 go/no-go 判断

关键动作：

优先处理以下问题：

1. extension flag pass-through
2. JSON/RPC command semantic coverage
3. 关键 slash command surface
4. 安装 / 升级 / 回滚路径验证
5. 试用用户反馈渠道与问题追踪

## 6. 详细工作流

### Workstream A - 发布管理

目标：把工程状态转换成可出品状态。

任务：

- 确定版本号策略
- 生成 changelog
- 准备 Release checklist
- 准备 smoke test checklist
- 组织 RC 节奏

输出：

- 发布日历
- RC 说明
- 正式试用版说明

### Workstream B - 质量与稳定性

目标：消除发布阻塞。

任务：

- 全量命令验证
- 编译、lint、test 回归
- 安装器回归
- 核心链路回归
- 平台差异验证，先以 macOS 为优先

输出：

- 质量门禁报告
- blocker 清单
- 回归命令集合

### Workstream C - 产品体验

目标：减少用户首次试用摩擦。

任务：

- 首次安装成功率优化
- provider 接入流程优化
- 错误提示清晰化
- session 继续/恢复体验优化
- 演示场景打磨

输出：

- 试用体验 SOP
- Demo 脚本
- 首次失败恢复指南

### Workstream D - 品牌与文档

目标：完成从工程项目到产品的包装。

任务：

- 品牌命名说明
- README 改写
- 产品说明页
- FAQ / Known Limitations
- 版本说明与 changelog 对齐

输出：

- 品牌文案规范
- 对外试用文档包

### Workstream E - 高风险兼容项

目标：优先收掉最影响试用的风险。

优先级：

1. CLI / extension flag 兼容
2. JSON/RPC 常用命令语义
3. slash commands 高频路径
4. 安装迁移路径

输出：

- 风险项 closure 表
- 修复前后行为说明

## 7. 关键 blocker 列表

以下事项没有收口前，不建议对外开放试用：

### P0 - 必须解决

- 当前发布范围内的编译/测试/回归阻塞
- 安装器主路径不稳定
- 首次配置 provider 路径不清晰
- 首次对话或工具调用存在高概率失败
- README / Release / 安装说明的版本与口径不一致

### P1 - 强烈建议解决

- extension flag pass-through
- 高频 slash command 行为不一致
- JSON/RPC 关键命令的行为漂移
- 已知限制文档不完整

### P2 - 可留到 v0.2

- SDK contract parity
- 全量 hook lifecycle parity
- 深度 OpenClaw 生态兼容
- V2 产品层默认开放

## 8. 文档与品牌改造清单

### 8.1 必改文档

- [README.md](../README.md)
- [CHANGELOG.md](../CHANGELOG.md)
- [docs/releasing.md](releasing.md)
- 安装说明相关章节
- FAQ / Known Limitations / 支持矩阵

### 8.2 需要统一的说法

必须统一以下口径：

- 猫爪是对外产品名
- 命令仍为 `pi`
- 当前仓库对外统一为 `maoclaw`
- 当前是 Trial Beta，不是 strict drop-in release
- OpenClaw V2 相关文档属于未来产品层参考，不是猫爪 v0.1 的默认能力承诺

### 8.3 品牌规范建议

建议采用如下文案结构：

- 产品名：猫爪
- 技术基座：built on top of the current Rust Pi runtime
- 命令名：`pi`
- 仓库名：`maoclaw`

## 9. 对外试用包组成

猫爪 v0.1 不应只发一个二进制，而应包含以下完整包：

1. 产品介绍页
2. Quick Start
3. macOS 安装说明
4. 试用版支持矩阵
5. 已知限制
6. FAQ
7. Demo 场景
8. 版本说明
9. 安全与数据说明
10. 反馈通道说明

## 10. 推荐时间表

### 第 1 周

- 冻结目标、范围、品牌策略
- 跑质量门禁
- 生成 blocker 列表
- 做安装器与主链路 smoke test

### 第 2 周

- 修复 P0 blocker
- 打磨首次安装与首次对话
- 确认 Demo 场景
- 完成试用体验文档草稿

### 第 3 周

- 品牌化 README 与产品说明
- 完成 changelog 与版本节
- 完成 FAQ / Known Limitations
- 完成发布草案与 RC 计划

### 第 4 周

- 修复 P1 高频风险项
- 生成 RC
- 邀请第一批试用用户
- 收集第一轮反馈

### 第 5–6 周（可选）

- 根据试用反馈修复
- 决定继续 Trial 还是推进 Beta
- 形成 v0.2 规划

## 11. 角色建议

建议至少按以下角色分工推进：

- Product / Founder：首版范围、品牌口径、试用客户选择
- Engineering：质量门禁、兼容性修复、安装器与发布
- Design / UX：首次使用路径、演示材料、对外页面语言
- Operations / GTM：试用邀请、反馈管理、节奏控制

## 12. 里程碑验收表

### Milestone A - Ready for RC

- 质量门禁达标
- 文档口径统一
- 安装器稳定
- Demo 场景跑通
- 已知限制明确

### Milestone B - Ready for Trial

- RC 经内部验证稳定
- 试用入口文档完成
- 反馈与问题跟踪机制到位
- 对外品牌已统一为猫爪

### Milestone C - Ready for Beta Planning

- 第一轮试用反馈闭环
- 高频问题收敛
- 明确 v0.2 范围
- 明确是否推进更深兼容层

## 13. 立即行动清单

创建本文档后，建议下一步立即做以下 10 件事：

1. 创建《猫爪 v0.1 支持范围》
2. 创建《猫爪 v0.1 已知限制》
3. 创建《猫爪 v0.1 发布 blocker 清单》
4. 创建《猫爪品牌命名规范》
5. 跑一轮完整质量门禁
6. 整理安装器 smoke test 结果
7. 修 README 首页与安装示例版本号
8. 增加 changelog 版本节
9. 固定 3–5 个 Demo 场景
10. 准备 RC 发布说明模板

## 14. 最终结论

猫爪 v0.1 的正确路径不是等待“所有兼容问题都解决”，而是：

- 先承认当前项目已经足够接近产品
- 再把不该承诺的部分明确排除
- 优先修复试用用户最容易遇到的问题
- 用 4–6 周做出一个边界清晰、能拿给客户体验的试用版本

本计划的核心原则是：

> **先把猫爪做成一个值得试用的产品，再逐步逼近严格兼容。**
