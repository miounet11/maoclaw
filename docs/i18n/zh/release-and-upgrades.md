# 发布与升级说明

这一页用于区分正式发布、当前构建升级，以及文档 / 网站同步更新，不把这些信息混在一起。

## 1. 先看对的日志

- `CHANGELOG.md`：正式公开发布记录
- `UPGRADE_LOG.md`：更宽的升级流，包括当前工作构建中的升级项
- `xinxiang.xin/trial/changelog`：网站公开版本摘要
- `xinxiang.xin/trial/upgrade-log`：网站公开升级流

## 2. 当前正式公开发布线

### 2026 年 3 月 30 日：`v0.1.13`

这是当前仓库 `CHANGELOG.md` 里的最新正式发布。

主要内容：

- 共享运行时上的多 Agent terminal mesh 协同
- 更坚实的 release evidence 与 claim-integrity 合同
- 对齐到受支持 official-tier conformance oracle 的发布 gate
- 面向已验证语料稳定性的 extension conformance fixture 加固

### 2026 年 3 月 28 日：`v0.1.12`

这是当前仓库 `CHANGELOG.md` 里的上一正式发布。

主要内容：

- 原生桌面安全指挥台与 readiness 评分
- 在设置、readiness checks 与遥测里统一呈现安全状态
- GitHub Releases 与 `xinxiang.xin` 上的真实桌面分发
- 对齐 release docs、下载路径与当前版本口径

### 2026 年 3 月 16 日：`v0.1.11`

这是当前仓库 `CHANGELOG.md` 里的最新正式发布。

主要内容：

- 桌面配置可靠性
- 已保存凭据的可见性更清楚
- macOS 打包校验更严格
- app bundle 刷新行为更安全

### 2026 年 3 月 15 日：`v0.1.9`

这是 `maoclaw` 的首个官方开源发布线。

主要内容：

- 公开仓库身份统一
- 安装器与发布文档整理
- `maoclaw` 名义下的正式 changelog 起点
- 开源项目对外表面完成基础整理

## 3. 当前工作构建升级线

下面这些内容可能已经出现在当前构建里，但还没有切到下一个 tag。

当前活跃升级方向：

- 继续打磨 onboarding 与 zero-config 自动化路径
- 继续升级 agent 管理、runtime 治理与 mesh orchestration 表面
- 在当前 Windows 可携式桌面包之外，继续完善更完整的分发体验

这些应被视为“当前构建升级”，除非后续明确进入正式 tag。

## 4. 用户应该先看什么

如果用户想看：

- 第一次安装路径：先看 [快速开始](quick-start.md)
- 应该用哪个表面：先看 [使用与配置](usage-and-configuration.md)
- IDE / 客户端接入：先看 [集成与自动化](integrations.md)
- 最近改了什么：先看 `CHANGELOG.md`，再看 `UPGRADE_LOG.md`

## 5. 发布沟通规则

- 不要把工作构建升级说成已经正式发布
- 不要在发布文档没明确写出的情况下，宣称广泛平台认证已经完成
- 网站文案、README、changelog、安装说明必须保持同一版本线
- 如果网站和仓库说法不一致，以仓库里的发布文件为准
