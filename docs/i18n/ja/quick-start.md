# クイックスタート

このページは、`猫爪 / maoclaw` を最短で初回成功まで持っていくための手順です。

## 1. 対象ユーザー

次のような人に向いています。

- ローカルのコードリポジトリで AI コーディングエージェントを使いたい
- `pi` の流れを維持しながら Rust ランタイムへ移行したい
- CLI、セッション、ツール実行、基本連携をすばやく確認したい

## 2. 必要なもの

- macOS の開発マシン
- ターミナル
- 少なくとも 1 つの Provider API キー
- ローカルのプロジェクトディレクトリ

現在の推奨 Provider:

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## 3. インストール

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

確認:

```bash
pi --version
pi --help
```

## 4. Provider を設定

Anthropic:

```bash
export ANTHROPIC_API_KEY="your-key"
```

OpenAI:

```bash
export OPENAI_API_KEY="your-key"
```

Google / Gemini:

```bash
export GOOGLE_API_KEY="your-key"
```

## 5. 起動

プロジェクトディレクトリで:

```bash
pi
```

または最初の指示を付けて:

```bash
pi "このリポジトリの構成と主要モジュールを要約してください"
```

## 6. 最初に試すこと

最初の 5 つの確認:

1. リポジトリ要約を依頼する
2. TODO / FIXME / 関数を検索させる
3. エラー説明をさせる
4. 小さな修正提案を出させる
5. 前回のセッションを続ける

例:

```bash
pi @src/main.rs "このファイルの役割を説明してください"
pi "このリポジトリで最優先で直すべきリスクを 3 つ挙げてください"
pi --continue
```

## 7. 次に読むもの

- [インストールとデプロイ](installation-and-deployment.md)
- [使い方と設定](usage-and-configuration.md)
- [Provider と API キー設定](provider-and-auth.md)
- [連携と自動化](integrations.md)
