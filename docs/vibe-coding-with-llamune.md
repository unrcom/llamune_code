# 安全な Vibe Coding with Llamune

複数のローカル LLM でコードを生成・比較し、より安全で品質の高いコーディングを実現

> **注**: この機能は Phase 2（ハイブリッド版）以降で実装予定です。Phase 1（CLI 版 MVP）では基本的な複数 LLM 比較機能のみ提供します。

---

## 目次

1. [Vibe Coding とは](#vibe-codingとは)
2. [現状の課題](#現状の課題)
3. [Llamune での解決策](#llamuneでの解決策)
4. [具体的な使用例](#具体的な使用例)
5. [機能詳細](#機能詳細)
6. [UI/UX 設計](#uiux設計)
7. [ベストプラクティス](#ベストプラクティス)
8. [技術実装](#技術実装)

---

## Vibe Coding とは

**Vibe Coding（バイブコーディング）** = 「雰囲気でコーディング」

LLM に自然言語で要件を伝えるだけで、コードを生成してもらう新しいコーディングスタイル。

### 従来のコーディング vs Vibe Coding

```
【従来】
要件定義 → 設計 → 実装 → テスト → デバッグ
(数時間〜数日)

【Vibe Coding】
「こういう機能作って」 → LLM生成 → 動作確認
(数分〜数十分)
```

### メリット

- ⚡ 圧倒的なスピード
- 🎯 プロトタイプの高速作成
- 📚 ボイラープレートの自動生成
- 🧠 アイデアの即座な検証

### しかし...

**品質とセキュリティの懸念** が常につきまとう

---

## 現状の課題

### 1. 単一 LLM への依存リスク

```typescript
// 開発者の期待
「ユーザー認証機能を作って」
    ↓
// LLMの生成結果
async function login(email, password) {
  const user = await db.query(
    `SELECT * FROM users WHERE email = '${email}'`
  );
  if (user && user.password === password) {
    return { token: generateToken(user.id) };
  }
}

// 見た目: ✅ 動く！
// 実態: ❌❌❌
//   - SQLインジェクション脆弱性
//   - 平文パスワード比較
//   - エラーハンドリングなし
```

**問題点:**

- 生成されたコードが「動く」と信じてしまう
- セキュリティホールに気づかない
- ベストプラクティスから外れている
- モデル固有の癖や偏りがある

### 2. レビューの困難さ

```
開発者「このコード、大丈夫かな...？」
    ↓
選択肢:
1. 自分で全行レビュー → 時間がかかる、見落とす
2. 同僚にレビュー依頼 → 負担をかける
3. そのまま使う → リスク高い
```

### 3. 学習コストの不透明性

```
❓ なぜこう実装した？
❓ 他の方法はないの？
❓ トレードオフは？

→ LLMは説明してくれるが、
  その説明が正しいかわからない
```

---

## Llamune での解決策

### コンセプト: 複数 LLM によるクロスチェック

```
┌─────────────────────────────────────────┐
│  開発者                                 │
│  「ユーザー認証機能を作って」          │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐
│LLM A   │ │LLM B   │ │LLM C     │
│(汎用)  │ │(汎用)  │ │(Reasoning)│
└───┬────┘ └───┬────┘ └────┬─────┘
    │          │           │
    │          │           ├─ 思考プロセス
    │          │           │  「まず要件を...」
    ▼          ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐
│実装A   │ │実装B   │ │実装C     │
└───┬────┘ └───┬────┘ └────┬─────┘
    │          │           │
    └──────────┴───────────┘
               │
               ▼
    ┌──────────────────────┐
    │  自動比較・分析       │
    │  - 共通点             │
    │  - 相違点             │
    │  - セキュリティ       │
    │  - ベストプラクティス │
    └──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  開発者へ提示         │
    │  「3つの実装を比較」  │
    │  「推奨: 実装Bベース」│
    └──────────────────────┘
```

### 安全性を高める 3 つのメカニズム

#### 1. 多様性による誤り検出

```
同じ要件で3つの実装:

┌──────────────────────────────────┐
│ LLM A (汎用・軽量)                │
│ ✅ bcryptでハッシュ化            │
│ ✅ prepared statement            │
│ ⚠️  エラーハンドリングが簡易     │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ LLM B (汎用・高性能)              │
│ ✅ bcryptでハッシュ化            │
│ ✅ prepared statement            │
│ ✅ 詳細なエラーハンドリング      │
│ ✅ ログ記録                      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ LLM C (Reasoning)                   │
│ ✅ bcryptでハッシュ化            │
│ ⚠️  ORMを使用（要件外？）        │
│ ✅ 包括的なエラーハンドリング    │
│ 💭 思考: 「SQLインジェクション   │
│           対策を考慮...」        │
└──────────────────────────────────┘

→ 共通点: bcrypt（信頼できる）
→ 相違点: エラー処理、データアクセス層
→ 推奨: LLM Bをベースに調整
```

#### 2. 思考プロセスの可視化

LLM C (Reasoning)は推論過程を出力:

```
【LLM C (Reasoning)の思考プロセス】

「ユーザー認証機能を実装する前に、
 セキュリティ要件を整理します：

 1. パスワードのハッシュ化
    → bcryptを使用（推奨強度: 10-12）

 2. SQLインジェクション対策
    → prepared statementまたはORM

 3. セッション管理
    → JWTまたはサーバーサイドセッション
    → 有効期限の設定

 4. レート制限
    → ブルートフォース攻撃対策

では、これらを満たす実装を...」

↓

[実装コード]
```

**価値:**

- なぜその実装にしたか理解できる
- セキュリティ考慮点が明確
- 他の LLM の実装と比較できる

#### 3. 自動セキュリティレビュー

生成されたコードを別の LLM がレビュー:

```typescript
// 生成されたコード
function authenticate(email, password) {
  return db.query(`SELECT * FROM users WHERE email='${email}'`);
}

↓ [自動レビュー]

┌────────────────────────────────────┐
│ 🔍 セキュリティレビュー結果        │
├────────────────────────────────────┤
│ ❌ 重大: SQLインジェクション脆弱性 │
│    行3: テンプレート文字列使用     │
│    → prepared statementに変更      │
│                                    │
│ ❌ 重大: 平文パスワード比較        │
│    行4: user.password === password │
│    → bcrypt.compare()を使用        │
│                                    │
│ ⚠️  中: エラーハンドリング不足     │
│    → try-catchで例外処理           │
│                                    │
│ 💡 推奨事項:                       │
│    - JWTの有効期限設定             │
│    - ログイン試行回数制限          │
└────────────────────────────────────┘
```

---

## 具体的な使用例

### 例 1: REST API 実装

**要件:**
「ブログ記事の CRUD API を作成。認証必須、ページネーション付き」

#### Step 1: 複数 LLM で生成

```
Llamune > 3つのLLMで実装生成中...

✅ LLM A 完了 (25秒)
✅ LLM B 完了 (32秒)
✅ LLM C (Reasoning) 完了 (48秒、思考プロセス付き)
```

#### Step 2: 自動比較分析

```
📊 実装の比較

【共通のアプローチ】
✅ Express.js + PostgreSQL
✅ JWT認証
✅ RESTful設計

【相違点】

1. ページネーション実装
   LLM A    → OFFSET/LIMIT
   LLM B  → カーソルベース
   LLM C  → OFFSET/LIMIT + count最適化

2. バリデーション
   LLM A    → 手動チェック
   LLM B  → Joi使用
   LLM C  → express-validator

3. エラーハンドリング
   LLM A    → 基本的なtry-catch
   LLM B  → カスタムエラークラス
   LLM C  → ミドルウェアで集約

【セキュリティチェック】
✅ SQLインジェクション対策: 全員OK
✅ 認証チェック: 全員OK
⚠️  入力バリデーション: LLM Aが不十分

【推奨】
LLM Bの実装をベースに：
- カーソルベースのページネーション（スケーラブル）
- Joiによる堅牢なバリデーション
- LLM Cのエラー処理アイデアを統合
```

#### Step 3: 統合版生成 or 選択

```
[オプション]

1. 推奨実装を採用
   → LLM Bベースで即座に使用

2. 統合版を生成
   → 各実装の良い部分を組み合わせ

3. カスタム選択
   → ページネーション: LLM B
   → バリデーション: LLM B
   → エラー処理: LLM C
   → これらを統合した実装を生成
```

### 例 2: セキュリティ重視の実装

**要件:**
「パスワードリセット機能。メール送信付き。」

```
🚨 セキュリティクリティカルな機能
→ Llamuneが自動的に厳格モードで生成

【生成結果】

┌─────────────────────────────────────┐
│ LLM A                           │
├─────────────────────────────────────┤
│ ✅ トークン生成: crypto.randomBytes │
│ ✅ 有効期限: 1時間                  │
│ ⚠️  トークン長: 16バイト（短い？） │
│ ❌ レート制限: なし                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ LLM B                         │
├─────────────────────────────────────┤
│ ✅ トークン生成: crypto.randomBytes │
│ ✅ 有効期限: 1時間                  │
│ ✅ トークン長: 32バイト             │
│ ✅ レート制限: 3回/時間             │
│ ✅ 使用済みトークンの無効化         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ LLM C (Reasoning)                      │
├─────────────────────────────────────┤
│ 💭 思考:                            │
│    「パスワードリセットは攻撃対象」│
│    「以下のセキュリティを考慮」    │
│    1. CSRF対策                      │
│    2. タイミング攻撃対策            │
│    3. メール検証                    │
│                                     │
│ ✅ トークン: 32バイト + HMAC        │
│ ✅ 有効期限: 30分（短め）           │
│ ✅ レート制限: IP単位               │
│ ✅ メール検証コード: 6桁            │
│ ✅ 監査ログ                         │
└─────────────────────────────────────┘

【自動レビュー結果】
⚠️  LLM A: トークン長不足、レート制限なし
✅ LLM B: 基本的なセキュリティはOK
🌟 LLM C: 最も包括的な対策

【推奨】
LLM Cの実装を採用
理由: セキュリティ考慮が最も徹底
```

### 例 3: パフォーマンス最適化

**要件:**
「大量データの集計 API。100 万行以上を想定」

```
【生成結果の比較】

LLM A (汎用・軽量)
├─ アプローチ: 素直なSELECT + GROUP BY
├─ インデックス: 考慮なし
└─ 推定速度: 遅い

LLM B (汎用・高性能)
├─ アプローチ: マテリアライズドビュー
├─ インデックス: 複合インデックス提案
├─ バッチ処理の提案
└─ 推定速度: 速い

LLM C (Reasoning)
├─ 思考: 「100万行なら分割処理が必要」
├─ アプローチ: ストリーミング処理
├─ インデックス: 詳細な設計
├─ キャッシュ戦略: Redis活用
└─ 推定速度: 最速

【推奨】
要件に応じて選択:
- シンプル重視 → LLM A
- バランス → LLM B
- 最大パフォーマンス → LLM C
```

---

## 機能詳細

### 1. コード比較エンジン

```typescript
interface CodeComparison {
  prompt: string;

  implementations: Implementation[];

  analysis: {
    commonApproaches: string[];
    differences: Difference[];
    securityIssues: SecurityIssue[];
    performanceNotes: string[];
    recommendations: Recommendation[];
  };

  metadata: {
    generatedAt: Date;
    executionTimes: { [model: string]: number };
    confidence: number; // 0-1
  };
}

interface Implementation {
  modelName: string;
  code: string;
  language: string;
  explanation: string;
  thinkingProcess?: string; // LLM C (Reasoning)のみ

  features: {
    errorHandling: QualityScore;
    security: QualityScore;
    performance: QualityScore;
    readability: QualityScore;
    testability: QualityScore;
  };
}

interface Difference {
  category: "architecture" | "security" | "performance" | "style";
  aspect: string;
  implementations: {
    model: string;
    approach: string;
    pros: string[];
    cons: string[];
  }[];
  recommendation: string;
  importance: "critical" | "high" | "medium" | "low";
}

interface SecurityIssue {
  severity: "critical" | "high" | "medium" | "low";
  type: string; // 'sql-injection', 'xss', etc.
  description: string;
  affectedModels: string[];
  recommendation: string;
  cweId?: string; // Common Weakness Enumeration ID
}

interface Recommendation {
  type: "use-as-is" | "merge" | "custom";
  primaryModel?: string;
  mergeStrategy?: {
    base: string;
    incorporate: { model: string; aspects: string[] }[];
  };
  reasoning: string;
}

type QualityScore = "excellent" | "good" | "fair" | "poor" | "critical";
```

### 2. セキュリティスキャナー

```typescript
interface SecurityScanner {
  scan(code: string, language: string): SecurityReport;
}

interface SecurityReport {
  overallScore: number; // 0-100

  vulnerabilities: Vulnerability[];

  compliance: {
    owasp: ComplianceCheck[];
    cwe: ComplianceCheck[];
  };

  recommendations: SecurityRecommendation[];
}

interface Vulnerability {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  description: string;
  location: {
    file?: string;
    line: number;
    column?: number;
  };
  codeSnippet: string;
  recommendation: string;
  references: string[];
}

// 自動スキャン項目
const securityChecks = [
  "sql-injection",
  "xss",
  "csrf",
  "command-injection",
  "path-traversal",
  "insecure-deserialization",
  "weak-crypto",
  "hardcoded-secrets",
  "insecure-random",
  "xxe", // XML External Entity
  "ssrf", // Server-Side Request Forgery
  "open-redirect",
  "cors-misconfiguration",
  "jwt-vulnerabilities",
  "authentication-bypass",
  "authorization-issues",
  "rate-limit-missing",
  "error-disclosure",
  "insecure-dependencies",
];
```

### 3. 統合コード生成

```typescript
interface MergeRequest {
  implementations: Implementation[];
  strategy: MergeStrategy;
  priorities: Priority[];
}

interface MergeStrategy {
  type: "best-of-each" | "weighted-average" | "custom";

  // best-of-each: 各側面で最良の実装を選択
  bestOfEach?: {
    errorHandling: string; // model name
    security: string;
    performance: string;
    // ...
  };

  // weighted-average: 重み付け平均
  weights?: {
    [modelName: string]: number;
  };

  // custom: ユーザー指定
  custom?: {
    base: string;
    patches: Patch[];
  };
}

interface Priority {
  aspect: string;
  importance: number; // 1-10
}

interface Patch {
  from: string; // model name
  what: string; // 'error-handling', 'validation', etc.
  where?: string; // specific location
}

// 統合の例
const mergeRequest: MergeRequest = {
  implementations: [implA, implB, implC],
  strategy: {
    type: "best-of-each",
    bestOfEach: {
      errorHandling: "LLM C (Reasoning)",
      security: "LLM B",
      performance: "LLM A",
      structure: "LLM B",
    },
  },
  priorities: [
    { aspect: "security", importance: 10 },
    { aspect: "errorHandling", importance: 8 },
    { aspect: "performance", importance: 6 },
  ],
};

// → 統合されたコードを生成
```

---

## UI/UX 設計

### メイン画面

```
┌─────────────────────────────────────────────────┐
│ 💻 Llamune - Vibe Coding Mode                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📝 要件入力                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ ブログ記事のCRUD APIを作成。              │ │
│ │ - 認証必須（JWT）                          │ │
│ │ - ページネーション付き                     │ │
│ │ - Markdown対応                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 使用するLLM: [LLM A] [LLM B]         │
│              [LLM C (Reasoning)] [+追加]          │
│                                                 │
│ 重視する点: [セキュリティ優先 ▼]              │
│                                                 │
│ [🚀 コード生成開始]                             │
│                                                 │
├─────────────────────────────────────────────────┤
│ 📊 生成状況                                     │
│                                                 │
│ ✅ LLM A      完了 (28秒)                   │
│ ✅ LLM B    完了 (35秒)                   │
│ ⏳ LLM C (Reasoning) 実行中... 42秒経過           │
│                                                 │
├─────────────────────────────────────────────────┤
│ 📄 生成結果（タブ表示）                        │
│                                                 │
│ [比較ビュー] [LLM A] [LLM B] [LLM C] [統合]│
│                                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ 📊 自動比較分析                           │   │
│ │                                           │   │
│ │ 【共通のアプローチ】                      │   │
│ │ ✅ Express.js + PostgreSQL               │   │
│ │ ✅ JWT認証                                │   │
│ │ ✅ RESTful設計                           │   │
│ │                                           │   │
│ │ 【主な違い】                              │   │
│ │ ├─ ページネーション                       │   │
│ │ │  LLM A: OFFSET/LIMIT                 │   │
│ │ │  LLM B: カーソルベース ⭐           │   │
│ │ │  LLM C: 最適化されたOFFSET         │   │
│ │ │                                        │   │
│ │ ├─ バリデーション                         │   │
│ │ │  LLM A: 手動チェック                 │   │
│ │ │  LLM B: Joi ⭐                     │   │
│ │ │  LLM C: express-validator          │   │
│ │ │                                        │   │
│ │ └─ エラーハンドリング                     │   │
│ │    LLM A: 基本的                        │   │
│ │    LLM B: カスタムエラークラス ⭐      │   │
│ │    LLM C: ミドルウェア集約 ⭐         │   │
│ │                                           │   │
│ │ 🔒 セキュリティチェック                   │   │
│ │ ✅ SQLインジェクション対策: 全員OK       │   │
│ │ ✅ 認証チェック: 全員OK                  │   │
│ │ ⚠️  入力バリデーション: LLM Aが不十分   │   │
│ │                                           │   │
│ │ 💡 推奨: LLM Bをベースに                │   │
│ │    LLM Cのエラー処理を統合            │   │
│ │                                           │   │
│ │ [詳細を見る] [統合版を生成]              │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 詳細比較ビュー

````
┌─────────────────────────────────────────────────┐
│ 🔍 詳細比較: ページネーション実装              │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ LLM A: OFFSET/LIMIT                     │ │
│ │                                             │ │
│ │ ```typescript                               │ │
│ │ const page = parseInt(req.query.page) || 1; │ │
│ │ const limit = 20;                           │ │
│ │ const offset = (page - 1) * limit;          │ │
│ │                                             │ │
│ │ const posts = await db.query(               │ │
│ │   'SELECT * FROM posts LIMIT $1 OFFSET $2', │ │
│ │   [limit, offset]                           │ │
│ │ );                                          │ │
│ │ ```                                         │ │
│ │                                             │ │
│ │ ✅ シンプル                                 │ │
│ │ ✅ 実装が容易                               │ │
│ │ ⚠️  大量データで遅い                        │ │
│ │ ⚠️  深いページで重い                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ LLM B: カーソルベース               │ │
│ │                                             │ │
│ │ ```typescript                               │ │
│ │ const cursor = req.query.cursor;            │ │
│ │ const limit = 20;                           │ │
│ │                                             │ │
│ │ const posts = await db.query(               │ │
│ │   `SELECT * FROM posts                      │ │
│ │    WHERE id > $1                            │ │
│ │    ORDER BY id ASC                          │ │
│ │    LIMIT $2`,                               │ │
│ │   [cursor || 0, limit]                      │ │
│ │ );                                          │ │
│ │                                             │ │
│ │ const nextCursor = posts[posts.length-1]?.id;│ │
│ │ ```                                         │ │
│ │                                             │ │
│ │ ✅ スケーラブル                             │ │
│ │ ✅ 一定のパフォーマンス                     │ │
│ │ ⚠️  ページ番号が使えない                    │ │
│ │ ✅ リアルタイム更新に強い                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ LLM C (Reasoning): 最適化されたOFFSET        │ │
│ │                                             │ │
│ │ 💭 思考プロセス:                            │ │
│ │ 「OFFSET/LIMITは深いページで遅い。         │ │
│ │  しかしページ番号が必要な場合も。          │ │
│ │  → サブクエリで最適化」                    │ │
│ │                                             │ │
│ │ ```typescript                               │ │
│ │ const posts = await db.query(`              │ │
│ │   SELECT p.* FROM posts p                   │ │
│ │   INNER JOIN (                              │ │
│ │     SELECT id FROM posts                    │ │
│ │     ORDER BY created_at DESC                │ │
│ │     LIMIT $1 OFFSET $2                      │ │
│ │   ) AS subq ON p.id = subq.id               │ │
│ │   ORDER BY p.created_at DESC                │ │
│ │ `, [limit, offset]);                        │ │
│ │ ```                                         │ │
│ │                                             │ │
│ │ ✅ OFFSET使用だが最適化                     │ │
│ │ ✅ ページ番号使える                         │ │
│ │ ✅ カウントクエリも最適化                   │ │
│ │ ⚠️  複雑                                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 💡 推奨: 要件に応じて選択                      │
│    - UI重視（ページ番号必要）→ LLM C      │
│    - スケール重視 → LLM B                    │
│    - シンプル重視 → LLM A                     │
│                                                 │
│ [この実装を採用] [統合版に含める] [戻る]      │
│                                                 │
└─────────────────────────────────────────────────┘
````

### セキュリティレポート

````
┌─────────────────────────────────────────────────┐
│ 🔒 セキュリティレポート                         │
├─────────────────────────────────────────────────┤
│                                                 │
│ 総合スコア: 85 / 100 (良好)                     │
│                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                 │
│ 🔴 Critical (0件)                               │
│                                                 │
│ 🟠 High (1件)                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ ⚠️  入力バリデーション不足                  │ │
│ │                                             │ │
│ │ 影響モデル: LLM A                       │ │
│ │ 箇所: POST /api/posts エンドポイント        │ │
│ │                                             │ │
│ │ 問題:                                       │ │ │ │ ユーザー入力を検証せずにDB挿入            │ │
│ │                                             │ │
│ │ ```typescript                               │ │
│ │ // 現在のコード (LLM A)                 │ │
│ │ const { title, content } = req.body;        │ │
│ │ await db.query(                             │ │
│ │   'INSERT INTO posts (title, content) ...'  │ │
│ │ );                                          │ │
│ │ ```                                         │ │
│ │                                             │ │
│ │ 推奨:                                       │ │
│ │ ```typescript                               │ │
│ │ // Joiでバリデーション (LLM Bの実装)     │ │
│ │ const schema = Joi.object({                 │ │
│ │   title: Joi.string().min(1).max(200)       │ │
│ │            .required(),                     │ │
│ │   content: Joi.string().min(1).max(10000)   │ │
│ │             .required()                     │ │
│ │ });                                         │ │
│ │ const { error } = schema.validate(req.body);│ │
│ │ ```                                         │ │
│ │                                             │ │
│ │ [LLM Bの実装に置き換える]                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 🟡 Medium (2件)                                 │
│ ├─ レート制限なし                              │
│ └─ 詳細なエラーメッセージの露出                │
│                                                 │
│ 🟢 Low (3件)                                    │
│ ├─ ログレベルの最適化                          │
│ ├─ CORSポリシーの明確化                        │
│ └─ セキュリティヘッダーの追加                  │
│                                                 │
│ ✅ OWASP Top 10 対応状況                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ✅ A01:2021 Broken Access Control              │
│ ✅ A02:2021 Cryptographic Failures             │
│ ✅ A03:2021 Injection                          │
│ ⚠️  A04:2021 Insecure Design                   │
│ ✅ A05:2021 Security Misconfiguration          │
│ ⚠️  A06:2021 Vulnerable Components             │
│ ✅ A07:2021 Identification and Auth Failures   │
│ ⚠️  A08:2021 Software and Data Integrity       │
│ ✅ A09:2021 Security Logging Failures          │
│ ✅ A10:2021 Server-Side Request Forgery        │
│                                                 │
│ [詳細レポートをダウンロード] [修正版を生成]   │
│                                                 │
└─────────────────────────────────────────────────┘
````

---

## ベストプラクティス

### 1. 要件の明確化

**Good:**

```
「ブログ記事のCRUD APIを作成。
 - 認証: JWT（有効期限24時間）
 - DB: PostgreSQL
 - ページネーション: カーソルベース、20件/ページ
 - 本文: Markdown対応、最大10,000文字
 - 画像: 別途S3に保存
 - エラー処理: 統一的なレスポンス形式」
```

**Bad:**

```
「ブログのAPI作って」
```

### 2. セキュリティ要件の明示

```
「決済処理を実装。

 セキュリティ要件:
 - PCI DSS準拠
 - カード情報は保存しない
 - 3Dセキュア対応
 - 通信: TLS 1.3以上
 - ログ: カード番号をマスク」
```

### 3. LLM の選択

| 用途                 | 推奨モデル        | 理由             |
| -------------------- | ----------------- | ---------------- |
| 基本的な CRUD        | LLM A             | 高速・高品質     |
| セキュリティ重視     | LLM B + LLM C     | 包括的な考慮     |
| パフォーマンス最適化 | 全モデル          | 多様なアプローチ |
| 新しい技術スタック   | LLM B             | 最新情報         |
| 学習目的             | LLM C (Reasoning) | 思考プロセス     |

### 4. レビューの重点

```
✅ 必ず確認:
- セキュリティ脆弱性（SQLi, XSS, etc.）
- 認証・認可の実装
- エラーハンドリング
- 入力バリデーション

✅ 推奨確認:
- パフォーマンス
- コードの可読性
- テスト容易性
- ドキュメンテーション

⚠️ 状況に応じて:
- スケーラビリティ
- 運用性（ログ、監視）
- 国際化対応
```

### 5. 段階的な実装

```
Phase 1: MVP（単一モデル）
↓
Phase 2: 比較検証（複数モデル）
↓
Phase 3: 統合版生成
↓
Phase 4: テスト追加
↓
Phase 5: 本番デプロイ
```

### 6. やってはいけないこと

❌ **生成されたコードを無検証で本番投入**

```
理由: セキュリティリスク、バグの可能性
対策: 必ず比較・レビュー・テスト
```

❌ **単一モデルの出力を盲信**

```
理由: モデル固有の偏りや誤り
対策: 複数モデルで生成・比較
```

❌ **思考プロセスを無視**

```
理由: 実装の意図が理解できない
対策: DeepSeekの思考を読み、学ぶ
```

❌ **要件を曖昧に伝える**

```
理由: 意図しない実装になる
対策: 具体的・明確な要件定義
```

---

## 技術実装

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│          ユーザーインターフェース       │
│          (Next.js Frontend)             │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│     Vibe Coding Controller               │
│     (Backend API)                        │
│  ┌──────────────────────────────────┐   │
│  │ - 要件解析                       │   │
│  │ - LLM実行オーケストレーション    │   │
│  │ - 結果収集                       │   │
│  └──────────────────────────────────┘   │
└──┬────────┬────────┬────────────────────┘
   │        │        │
   ▼        ▼        ▼
┌────────┐┌────────┐┌──────────┐
│LLM A   ││LLM B   ││LLM C     │
│(汎用)  ││(汎用)  ││(Reasoning)│
└───┬────┘└───┬────┘└────┬─────┘
    │         │          │
    └─────────┴──────────┘
              │
┌─────────────▼───────────────────────────┐
│     Code Analysis Engine                 │
│  ┌──────────────────────────────────┐   │
│  │ - 構文解析                       │   │
│  │ - セマンティック分析             │   │
│  │ - セキュリティスキャン           │   │
│  │ - パフォーマンス分析             │   │
│  │ - ベストプラクティスチェック     │   │
│  └──────────────────────────────────┘   │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│     Merge Engine                         │
│  ┌──────────────────────────────────┐   │
│  │ - 実装比較                       │   │
│  │ - 統合戦略決定                   │   │
│  │ - コード生成                     │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### API 設計

```typescript
// コード生成リクエスト
POST /api/vibe-coding/generate

Request:
{
  prompt: string;
  language: 'typescript' | 'python' | 'go' | ...;
  models: string[];  // ['LLM A', 'LLM B', ...]
  priority: 'security' | 'performance' | 'simplicity' | 'balanced';
  context?: {
    framework?: string;  // 'express', 'fastapi', etc.
    database?: string;   // 'postgresql', 'mysql', etc.
    auth?: string;       // 'jwt', 'oauth2', etc.
  };
}

Response:
{
  id: string;
  status: 'completed' | 'partial' | 'failed';
  implementations: Implementation[];
  analysis: CodeAnalysis;
  recommendations: Recommendation[];
}

// 統合版生成
POST /api/vibe-coding/merge

Request:
{
  implementationIds: string[];
  strategy: MergeStrategy;
  customInstructions?: string;
}

Response:
{
  code: string;
  explanation: string;
  changes: Change[];
}

// セキュリティスキャン
POST /api/vibe-coding/security-scan

Request:
{
  code: string;
  language: string;
}

Response:
{
  report: SecurityReport;
}
```

### データベーススキーマ

```sql
-- コード生成セッション
CREATE TABLE vibe_coding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  language VARCHAR(50) NOT NULL,
  priority VARCHAR(50),
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 生成された実装
CREATE TABLE generated_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES vibe_coding_sessions(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  code TEXT NOT NULL,
  explanation TEXT,
  thinking_process TEXT,  -- LLM C (Reasoning)用
  execution_time INTEGER, -- ms
  quality_scores JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分析結果
CREATE TABLE code_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES vibe_coding_sessions(id) ON DELETE CASCADE,
  common_approaches TEXT[],
  differences JSONB,
  security_issues JSONB,
  recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 統合版
CREATE TABLE merged_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES vibe_coding_sessions(id) ON DELETE CASCADE,
  source_implementation_ids UUID[],
  code TEXT NOT NULL,
  strategy JSONB,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## まとめ

### Vibe Coding with Llamune の価値

1. **安全性の向上**

   - 複数 LLM によるクロスチェック
   - 自動セキュリティスキャン
   - 多様な視点からのレビュー

2. **品質の向上**

   - ベストプラクティスの自動提案
   - パフォーマンス比較
   - 実装パターンの学習

3. **生産性の維持**

   - Vibe Coding の速度を損なわない
   - バックグラウンド処理
   - ワンクリックで統合版生成

4. **学習効果**
   - 思考プロセスの可視化
   - 複数の実装パターン
   - セキュリティ知識の習得

### 今後の展開

**Phase 1: MVP（2026 Q2）**

- 基本的な複数 LLM 生成
- シンプルな比較表示
- セキュリティスキャン

**Phase 2: 拡張（2026 Q3）**

- 統合版自動生成
- 詳細な分析機能
- カスタムルール

**Phase 3: 高度化（2026 Q4~）**

- AI によるレビュー
- 自動テスト生成
- リファクタリング提案

---

**初版作成**: 2025-11-11  
**作成者**: mop  
**バージョン**: 1.0.0
