# Provider と API キー設定

このページでは、`猫爪 / maoclaw` で利用するモデル Provider の設定方法を説明します。

## 1. 最速セットアップ

まず 1 つの API キーを設定してから `pi` を実行します。

```bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
export AZURE_OPENAI_API_KEY="your-key"
```

確認:

```bash
pi --list-providers
pi --list-models
```

## 2. 推奨 Provider

最初の選択肢としては次が最も簡単です。

- Anthropic
- OpenAI
- Google / Gemini
- Azure OpenAI

## 3. よくある失敗原因

- API キー未設定
- 期限切れキー
- 環境変数名の間違い
- Provider の選択ミス

確認例:

```bash
echo "$ANTHROPIC_API_KEY"
echo "$OPENAI_API_KEY"
```

## 4. 完全な Provider リファレンス

より多くの事業者、地域 Provider、OpenAI 互換ゲートウェイを使う場合は次を参照してください。

- [../../providers.md](../../providers.md)
- [../../provider-auth-troubleshooting.md](../../provider-auth-troubleshooting.md)

これらの資料には、Provider ID、別名、環境変数、エンドポイント、認証障害が整理されています。

## 5. 初心者向けの順番

1. まず 1 つの主 Provider を選ぶ
2. 1 つの API キーだけ設定する
3. `pi` を正常動作させる
4. その後で複数 Provider やゲートウェイ切替を追加する

この順番が最初の失敗率を下げます。
