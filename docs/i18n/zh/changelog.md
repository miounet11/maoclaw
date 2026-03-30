# 版本更新日志

本页是面向中文 GitHub 访客的版本摘要。  
仓库权威版本日志仍然以 [../../CHANGELOG.md](../../CHANGELOG.md) 为准。

## Unreleased

- 在 `v0.1.13` 的公开分发基线之上，继续收敛 onboarding、agent 管理体验与后续打包细节

## 0.1.13 - 多 Agent Mesh 与发布证据加固

发布日期：2026-03-30

- 修正 kernel-boundary drift report 合同，让 release evidence 与 claim-integrity gate 使用同一套 schema 和 verdict 语义
- 把发布 gate 对齐到受支持的 official-tier conformance oracle，不再被不受支持的全语料 N/A 统计误伤
- 修复 `community/nicobailon-subagents` fixture 的写路径，使其留在 extension-root 边界内，并恢复已验证语料的 generated conformance 全通过
- 继续扩展终端 mesh 协同表面，让 maoclaw、Claude Code 与 Codex 能在同一运行时模型内协作，而不是靠分裂的手工流程

## 0.1.12 - 原生桌面安全控制面与公开分发

发布日期：2026-03-28

- 增加原生桌面安全指挥台，集中呈现 readiness、权限状态与较正动作
- 把同一套安全评估结果同步到设置较正、readiness checks 和运行时遥测区域
- 升级 GitHub Releases 与官网下载面，正式发布当前 macOS 安装包 / 压缩包和 Windows 可携式桌面压缩包
- 对齐公开文档与版本页面，避免下载物、release notes 与当前版本口径分裂

## 0.1.11 - 桌面配置与打包可靠性

发布日期：2026-03-16

- 修复桌面设置里 provider API URL override 的回显问题
- 让已保存凭据的状态更容易验证
- 强化 macOS 打包校验，避免旧桌面 bundle 被继续包装
- 改善 app bundle 刷新与重建行为

## 0.1.9 - `maoclaw` 首个官方开源发布

发布日期：2026-03-15

- 正式建立 `maoclaw` 的公开开源发布身份
- 把正式 changelog 重置到 `maoclaw` 发布线下
- 对齐 README、安装说明与发布文档
- 完成基础开源仓库对外表面整理
