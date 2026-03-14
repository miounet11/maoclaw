# 猫爪 v0.1 发布 blocker 清单

Status: Draft  
Audience: Founder, engineering, product, operations  
Release target: 猫爪 v0.1 小范围试用版  
Companions: [maozhua-v0.1-trial-release-plan.md](maozhua-v0.1-trial-release-plan.md), [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md), [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md), [releasing.md](releasing.md), [dropin-certification-verdict.json](dropin-certification-verdict.json), [dropin-parity-gap-ledger.json](dropin-parity-gap-ledger.json)

> Reference note: this file is an internal release decision checklist.
> It should not be used as product-facing documentation. Use [README.md](README.md), [maozhua-v0.1-release-notes-draft.md](maozhua-v0.1-release-notes-draft.md), and [maozhua-v0.1-faq.md](maozhua-v0.1-faq.md) for external communication.

## 1. 文档目的

本文档定义猫爪 v0.1 在发布前必须处理、建议处理、可后移处理的 blocker 分级。

它不是 bug 列表，而是**发布决策列表**。

判断原则：

- 会导致试用用户无法完成核心路径的问题，属于 blocker
- 会导致产品口径失真或对外误导的问题，属于 blocker
- 会导致发布后支持成本失控的问题，属于 blocker

## 2. Blocker 分级标准

### P0 - Release Stopper

满足任意一条即视为不能发布：

- 用户无法安装或启动
- 用户无法完成首次对话
- 核心工具主路径不稳定
- 质量门禁未达标
- 发布文档和产品口径明显不一致
- 版本、产物、安装说明不一致

### P1 - Strong Pre-release Fix

原则上应在首版前解决；若延期，必须有明确风险说明：

- 高频交互路径存在明显漂移
- 常用 RPC 路径存在明显漂移
- 常见迁移路径存在明显不确定性
- 高概率引发试用负反馈的问题

### P2 - Track for v0.2

不阻塞首版，但要被明确记录并排期：

- 深层 SDK parity
- 全量扩展生态兼容
- 更深的多平台体验一致性
- OpenClaw V2 产品层交付

## 3. 当前 P0 Blockers

### P0-1 质量门禁未形成当前发布快照

现状：

- 历史文档有质量状态快照，但不是当天发布结果
- 在没有当日 gate 结果时，不能认定版本可发布

必须完成：

- 重新执行发布范围内的质量命令
- 生成当前 gate 结果
- 标明失败、通过和豁免项

验收标准：

- 有一份当天可复现的 release gate 记录

### P0-2 发布范围内存在未归因失败

现状：

- 如果测试或编译失败无法区分“当前发布阻塞”和“历史噪声”，就无法做发布决策

必须完成：

- 将失败按“阻塞发布 / 非阻塞 / 并发噪声”分类
- 为每个阻塞项给出处置路径

验收标准：

- 所有发布范围内失败都有归因和状态

### P0-3 安装主路径未完成最终 smoke 验证

现状：

- `install.sh` 是首版安装主入口
- 若没有完整 smoke test，试用发布风险很高

必须完成：

- 验证 fresh install
- 验证已有 `pi` 的迁移路径
- 验证 keep-existing 路径
- 验证版本固定安装路径

验收标准：

- 四类安装路径均有结果记录

### P0-4 首次使用链路未完成端到端验证

现状：

- 如果用户不能在短时间内完成第一次可用对话，则不能开放试用

必须完成：

- 安装
- provider 配置
- 发起首次消息
- 调用工具
- 保存并恢复会话

验收标准：

- 从零到首次可用对话的主链路可以稳定复现

### P0-5 对外口径未统一

现状：

- 目前仓库中仍存在 `猫爪`、`maoclaw`、`Pi`、`OpenClaw` 等多层命名残留
- 若不统一，对外发布会造成品牌混乱

必须完成：

- 明确首版对外品牌是“猫爪”
- 明确命令仍为 `pi`
- 明确不是 strict drop-in replacement
- 明确哪些 OpenClaw / V2 内容不属于首版承诺

验收标准：

- README、Release Notes、FAQ、支持矩阵表述一致

### P0-6 版本与 changelog 不完整

现状：

- 没有可对外解释的版本节，就不适合正式发 Release

必须完成：

- 确认首版版本号
- 在 `CHANGELOG.md` 中新增对应版本节
- 确保 Release 说明能引用该版本节

验收标准：

- 版本号、tag、changelog、Release Notes 一致

## 4. 当前 P1 Blockers

### P1-1 Extension flag pass-through 风险

现状：

- 扩展注册的 CLI 参数透传仍是已知高优先级风险

风险：

- 影响扩展 CLI 试用体验
- 容易被高级用户快速踩中

建议：

- 首版前尽量修复
- 若不能修复，必须在已知限制中明确写出

### P1-2 JSON/RPC command semantic coverage 不完整

现状：

- 基础 RPC 可用，但不是所有命令语义都完成闭环

风险：

- 会影响 IDE / 自动化接入试用

建议：

- 至少确认首批试用要用到的命令已稳定

### P1-3 Slash command 高频路径需确认

现状：

- 高频命令外的 slash command 仍可能存在行为差异

风险：

- 影响交互式产品主观完成度

建议：

- 做高频命令白名单验证

### P1-4 迁移用户体验风险

现状：

- 从 TypeScript `pi` 迁移是高频真实场景

风险：

- 如果迁移过程混乱，用户会直接失去信任

建议：

- 首版前单独验证迁移说明、命令别名与回滚路径

### P1-5 文档冲突风险

现状：

- 功能矩阵、README、认证文档、OpenClaw 文档存在叙事层级差异

风险：

- 外部看到后会误解产品成熟度和承诺边界

建议：

- 首版只暴露整理后的产品文档

## 5. 当前 P2 跟踪项

### P2-1 SDK contract parity

保留到 v0.2+ 评估。

### P2-2 全量 JSON/RPC parity

保留到更深集成阶段。

### P2-3 全量扩展生态兼容

保留到生态化阶段。

### P2-4 OpenClaw V2 产品层默认开放

保留到未来产品线规划。

### P2-5 全面品牌与命令迁移

保留到猫爪稳定后再规划。

## 6. Blocker 处理流程

每个 blocker 必须有以下字段：

- 编号
- 级别
- 当前状态
- 风险描述
- 处理策略
- Owner
- 截止时间
- 验收方式

建议状态字段：

- `open`
- `in_progress`
- `mitigated`
- `verified`
- `deferred`

## 7. 发布前检查表

### Engineering

- [ ] 质量命令全部执行
- [ ] 发布范围内失败全部归因
- [ ] 安装器 smoke test 通过
- [ ] 首次使用链路通过
- [ ] 关键工具路径通过

### Product

- [ ] 支持范围定稿
- [ ] 已知限制定稿
- [ ] 品牌口径统一
- [ ] FAQ / Known Limitations / Quick Start 完成

### Release

- [ ] 版本号确定
- [ ] changelog 更新
- [ ] Release Notes 完成
- [ ] GitHub Release 产物准备完成
- [ ] 回滚方案明确

### Trial Ops

- [ ] 试用名单确定
- [ ] 反馈入口准备完成
- [ ] 试用说明发送模板完成
- [ ] issue 分流机制准备完成

## 8. Go / No-Go 判定

### Go 条件

满足以下条件可进入试用发布：

- 全部 P0 关闭
- P1 剩余项有明确缓解与对外说明
- 支持范围与已知限制文档已发布
- 试用入口与反馈机制已准备好

### No-Go 条件

出现以下任一情况，应延期发布：

- 仍有 P0 未关闭
- 首次使用链路不稳定
- 安装路径没有验证记录
- 文档、版本、品牌表述仍明显冲突
- 无法回答“这个版本到底支持什么、不支持什么”

## 9. 立即要做的事情

建议按以下顺序处理 blocker：

1. 跑当前 release gate
2. 生成并归因失败列表
3. 完成安装器 smoke test
4. 完成首次使用 E2E 路径验证
5. 统一 README / Release / FAQ 口径
6. 创建版本节与 Release Notes
7. 处理最关键的 P1 问题

## 10. 一句话总结

猫爪 v0.1 blocker 管理的核心原则是：

> **不要把“还没收口”的工程状态包装成已可交付产品；只有当核心路径、质量门禁和对外口径同时成立时，才允许发布。**
