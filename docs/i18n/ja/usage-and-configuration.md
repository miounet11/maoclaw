# 使い方と設定

このページでは、`maoclaw` の主要コマンド、リソースパス、設定方法をまとめます。

## 1. よく使うコマンド

対話モード:

```bash
pi
```

単発実行:

```bash
pi -p "このエラーの原因を説明してください"
```

ファイル文脈付き:

```bash
pi @Cargo.toml "このプロジェクトの主要依存関係を教えてください"
```

セッション継続:

```bash
pi --continue
pi --resume
```

モデル指定:

```bash
pi --model claude-opus-4 "このモジュール設計をレビューしてください"
```

Provider / モデル一覧:

```bash
pi --list-providers
pi --list-models
```

## 2. 自動化モード

```bash
pi -p "短い要約を返してください"
pi --mode json -p "構造化された結果を返してください"
pi --mode rpc
```

## 3. 設定ファイルの場所

グローバル設定:

- `~/.pi/agent/settings.json`

プロジェクト設定:

- `.pi/settings.json`

実際の読み込み状況確認:

```bash
pi config
```

優先順位:

1. CLI フラグ
2. 環境変数
3. プロジェクト設定
4. グローバル設定
5. 組み込みデフォルト

## 4. Skills / Prompts / Themes

グローバル:

- `~/.pi/agent/skills/`

プロジェクト:

- `.pi/skills/`

参考:

- [../../skills.md](../../skills.md)
- [../../prompt-templates.md](../../prompt-templates.md)
- [../../themes.md](../../themes.md)

## 5. 推奨セットアップ

- 個人: まず 1 つの Provider と 1 つのモデル
- チーム: `.pi/settings.json` にプロジェクト既定値
- 上級者: 後から skills、prompts、themes を追加

## 6. 名前の互換性について

- 製品名: `猫爪 / maoclaw`
- 互換コマンド: `pi`

これは移行期間の意図的な設計です。
