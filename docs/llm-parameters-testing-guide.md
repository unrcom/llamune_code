# LLM パラメータテストガイド

## 目次

1. [概要](#概要)
2. [7 つの重要パラメータ](#7つの重要パラメータ)
3. [Gemma2:27B について](#gemma227bについて)
4. [テスト環境要件](#テスト環境要件)
5. [体系的なテスト手順](#体系的なテスト手順)
6. [結果の分析方法](#結果の分析方法)
7. [用途別推奨設定](#用途別推奨設定)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### 目的

LLM の出力を制御する 7 つの主要パラメータを体系的にテストし、各パラメータが出力に与える影響を定量的・定性的に評価する。

### 対象モデル

**Gemma2:27B（32GB 環境で実施）**

- パラメータ数: 27.2B
- コンテキスト長: 8,192 トークン
- 量子化: Q4_0
- ファイルサイズ: 約 16GB
- メモリ要件: 約 18-20GB

### テスト実施予定

**32GB MacBook Air 到着後**

- 予定日: 2025-11-11（3 日後）
- 環境: M1/M2/M3 Mac、32GB RAM
- 所要時間: 約 2-3 時間

---

## 7 つの重要パラメータ

### 1. Temperature（温度）

#### 概念

サンプリングの「ランダム性」を制御するパラメータ。確率分布の尖度（とんがり具合）を調整する。

#### 数学的定義

```python
def softmax_with_temperature(logits, temperature):
    """
    温度パラメータ付きSoftmax関数
    """
    scaled_logits = logits / temperature
    exp_values = np.exp(scaled_logits - np.max(scaled_logits))
    probabilities = exp_values / np.sum(exp_values)
    return probabilities
```

#### 効果

**低温（0.0 - 0.5）:**

```
確率分布が鋭くなる
→ 高確率の選択肢がさらに高確率に
→ 決定的、一貫性が高い、再現性が高い

例（温度=0.1）:
"好き" : 99.8%  ← ほぼ確実
"嫌い" : 0.2%
```

**中温（0.6 - 1.0）:**

```
バランスの取れた分布
→ 自然な多様性
→ 現実的なバリエーション

例（温度=0.8、デフォルト）:
"好き" : 65%
"大好き" : 20%
"嫌い" : 10%
"怖い" : 5%
```

**高温（1.1 - 2.0）:**

```
確率分布が平坦になる
→ 低確率の選択肢も選ばれやすく
→ 創造的、多様、予測困難

例（温度=1.5）:
"好き" : 30%
"大好き" : 25%
"嫌い" : 20%
"怖い" : 15%
"見る" : 10%
```

#### デフォルト値

```bash
temperature = 0.8
```

**ollama での確認:**

```bash
ollama show gemma2:27b --modelfile
# 出力: PARAMETER temperature 0.8
```

#### チューニング方法

**用途別推奨値:**

| 用途                     | 推奨温度 | 理由                       |
| ------------------------ | -------- | -------------------------- |
| **コード生成**           | 0.1-0.3  | 正確性・再現性重視         |
| **技術文書**             | 0.3-0.5  | 正確だが適度な表現の多様性 |
| **翻訳**                 | 0.3-0.6  | 正確さと自然さのバランス   |
| **質問応答**             | 0.5-0.8  | 事実性と読みやすさ         |
| **一般チャット**         | 0.7-1.0  | 自然な会話                 |
| **ブログ記事**           | 0.8-1.2  | 創造性と一貫性             |
| **創作（小説等）**       | 1.0-1.5  | 創造的で予測不能           |
| **ブレインストーミング** | 1.3-1.8  | 意外なアイデア             |

**チューニングのコツ:**

```bash
# Step 1: ベースライン確立（デフォルト）
ollama run gemma2:27b --temperature 0.8 "プロンプト"

# Step 2: より決定的にしたい場合
ollama run gemma2:27b --temperature 0.3 "プロンプト"

# Step 3: より創造的にしたい場合
ollama run gemma2:27b --temperature 1.2 "プロンプト"

# Step 4: 段階的に調整
# 大きく変えすぎない（0.2-0.3刻みで調整）
```

---

### 2. Top-p (Nucleus Sampling)

#### 概念

累積確率が p（0.0-1.0）に達するまでの上位候補から選択する手法。

#### 動作原理

```python
def top_p_sampling(probabilities, top_p=0.9):
    """
    Top-p (Nucleus) sampling
    """
    # 確率の高い順にソート
    sorted_probs, sorted_indices = torch.sort(probabilities, descending=True)

    # 累積確率を計算
    cumsum_probs = torch.cumsum(sorted_probs, dim=-1)

    # top_pを超える部分を除外
    mask = cumsum_probs <= top_p
    mask[0] = True  # 最低1つは含める

    # フィルター後の候補から選択
    filtered_probs = sorted_probs * mask
    filtered_probs = filtered_probs / filtered_probs.sum()

    return sample(filtered_probs)
```

#### 効果

**例（top_p = 0.9）:**

```
単語の確率:
"好き"   : 65%  ← 累積 65%
"大好き" : 15%  ← 累積 80%
"飼う"   : 10%  ← 累積 90% ← ここまで選択
"見る"   : 5%   ← 除外（累積95% > 90%）
"苦手"   : 5%   ← 除外

→ 上位3つから選択（動的）
```

**top_p の値による違い:**

```
top_p = 0.7  → 非常に保守的（上位数個のみ）
top_p = 0.9  → バランス（デフォルト）
top_p = 0.95 → やや広範囲
top_p = 0.99 → ほぼ全候補
top_p = 1.0  → 全候補（無制限）
```

#### デフォルト値

```bash
top_p = 0.9
```

#### Top-k との違い

| 特性       | Top-p              | Top-k             |
| ---------- | ------------------ | ----------------- |
| **候補数** | 動的（確率による） | 固定（常に k 個） |
| **柔軟性** | 高い               | 低い              |
| **推奨**   | 一般的に推奨       | 古い手法          |

**視覚的な違い:**

```
確率分布が集中している場合:
Top-p (0.9): 2-3個の候補
Top-k (50):  50個の候補（無駄）

確率分布が分散している場合:
Top-p (0.9): 20-30個の候補
Top-k (50):  50個の候補（適切）
```

#### チューニング方法

**推奨値:**

```bash
# 保守的（確実な選択）
--top-p 0.7

# バランス（デフォルト）
--top-p 0.9

# 多様性重視
--top-p 0.95

# ほぼ無制限
--top-p 0.99
```

**Temperature との組み合わせ:**

```bash
# 決定的（コード生成）
--temperature 0.2 --top-p 0.9

# バランス（一般チャット）
--temperature 0.8 --top-p 0.9

# 創造的（創作）
--temperature 1.2 --top-p 0.95
```

---

### 3. Top-k

#### 概念

上位 k 個の候補からのみ選択する手法（固定数）。

#### 動作原理

```python
def top_k_sampling(probabilities, top_k=40):
    """
    Top-k sampling
    """
    # 上位k個のインデックスを取得
    top_k_probs, top_k_indices = torch.topk(probabilities, top_k)

    # 再正規化
    top_k_probs = top_k_probs / top_k_probs.sum()

    # サンプリング
    return sample(top_k_probs)
```

#### 効果

**例（top_k = 3）:**

```
単語の確率:
"好き"   : 65%  ← 1位: 選択
"大好き" : 15%  ← 2位: 選択
"飼う"   : 10%  ← 3位: 選択
"見る"   : 5%   ← 4位: 除外
"苦手"   : 5%   ← 5位: 除外

再正規化後:
"好き"   : 72%  (65/90)
"大好き" : 17%  (15/90)
"飼う"   : 11%  (10/90)
```

#### デフォルト値

```bash
top_k = 40
```

#### チューニング方法

**推奨値:**

```bash
# 非常に保守的
--top-k 10

# やや保守的
--top-k 20

# バランス（デフォルト）
--top-k 40

# 多様性重視
--top-k 100
```

**注意:**
現代の LLM では **Top-p の方が推奨**されています。Top-k は固定値のため、柔軟性に欠けます。

---

### 4. Num_predict（最大トークン数）

#### 概念

生成する最大トークン数を制限するパラメータ。

#### トークンとは

```
1トークン ≈ 0.75単語（英語）
1トークン ≈ 0.5-1文字（日本語）

例:
"こんにちは" = 2-3トークン
"Hello, how are you?" = 5トークン
```

#### 効果

**例:**

```bash
# 50トークン（約40単語）
ollama run gemma2:27b --num-predict 50 "Pythonについて"
# 出力: "Pythonは汎用プログラミング言語で..." （短い）

# 500トークン（約375単語）
ollama run gemma2:27b --num-predict 500 "Pythonについて"
# 出力: "Pythonは... 特徴は... 用途は..." （詳細）

# 無制限
ollama run gemma2:27b --num-predict -1 "Pythonについて"
# 出力: モデルが終了判定するまで生成
```

#### デフォルト値

```bash
num_predict = 128
```

**デフォルトの意味:**

- 約 100 単語程度
- 簡潔な回答に適している
- 長文が必要な場合は増やす必要あり

#### チューニング方法

**用途別推奨値:**

| 用途             | 推奨トークン数 | 理由                   |
| ---------------- | -------------- | ---------------------- |
| **短い質問応答** | 50-100         | 簡潔さ重視             |
| **標準的な回答** | 200-500        | バランス               |
| **詳細な説明**   | 500-1000       | 十分な情報量           |
| **長文生成**     | 1000-2000      | ブログ記事、レポート   |
| **無制限**       | -1             | 制限なし（注意が必要） |

**注意事項:**

```bash
# -1（無制限）の危険性
ollama run gemma2:27b --num-predict -1 "カウントアップして"
# → 無限ループの可能性

# 適切な上限設定を推奨
ollama run gemma2:27b --num-predict 2000 "詳しく説明して"
```

---

### 5. Repeat_penalty（繰り返しペナルティ）

#### 概念

同じ単語・フレーズの繰り返しに対してペナルティを課すパラメータ。

#### 動作原理

```python
def apply_repeat_penalty(logits, generated_tokens, penalty=1.1):
    """
    繰り返しペナルティの適用
    """
    for token in generated_tokens:
        # 既出トークンの確率を下げる
        if logits[token] > 0:
            logits[token] /= penalty
        else:
            logits[token] *= penalty
    return logits
```

#### 効果

**例（"猫"について説明）:**

**penalty = 1.0（ペナルティなし）:**

```
出力: "猫は可愛いです。猫は人気のペットです。猫は..."
→ "猫"が頻繁に繰り返される
```

**penalty = 1.1（軽いペナルティ、デフォルト）:**

```
出力: "猫は可愛いです。ペットとして人気があります。動物の中でも..."
→ 適度に代名詞や類義語を使用
```

**penalty = 1.3（中程度のペナルティ）:**

```
出力: "猫は可愛いです。この動物は人気があります。彼らは..."
→ 積極的に言い換え
```

**penalty = 1.5（強いペナルティ）:**

```
出力: "猫は可愛い。動物として人気。ペット界で重要。生物..."
→ 過度な言い換えで不自然になる可能性
```

#### デフォルト値

```bash
repeat_penalty = 1.1
```

#### チューニング方法

**推奨値:**

| 用途           | 推奨ペナルティ | 理由                   |
| -------------- | -------------- | ---------------------- |
| **コード生成** | 1.0-1.05       | 変数名の繰り返しは自然 |
| **技術文書**   | 1.1            | 適度な言い換え         |
| **一般文章**   | 1.1-1.2        | バランス               |
| **創作**       | 1.2-1.3        | 表現の多様性           |

**調整のコツ:**

```bash
# 繰り返しが多い場合
--repeat-penalty 1.2

# 不自然な言い換えが多い場合
--repeat-penalty 1.05

# テスト
ollama run gemma2:27b --repeat-penalty 1.0 "猫について詳しく"
ollama run gemma2:27b --repeat-penalty 1.3 "猫について詳しく"
```

---

### 6. Seed（乱数シード）

#### 概念

乱数生成器のシード値を固定することで、完全な再現性を実現するパラメータ。

#### 動作原理

```python
def generate_with_seed(prompt, seed=42):
    """
    シード固定で再現可能な生成
    """
    # 乱数シードを設定
    torch.manual_seed(seed)
    np.random.seed(seed)
    random.seed(seed)

    # 生成（同じシードなら同じ結果）
    output = model.generate(prompt)
    return output
```

#### 効果

**シード固定:**

```bash
# 実行1
ollama run gemma2:27b --seed 42 --temperature 0.8 "こんにちは"
# 出力: "こんにちは！今日はどのようなお手伝いができますか？"

# 実行2（同じシード）
ollama run gemma2:27b --seed 42 --temperature 0.8 "こんにちは"
# 出力: "こんにちは！今日はどのようなお手伝いができますか？"
# → 完全に同じ
```

**シード未指定:**

```bash
# 実行1
ollama run gemma2:27b --temperature 0.8 "こんにちは"
# 出力: "こんにちは！今日は良い天気ですね。"

# 実行2
ollama run gemma2:27b --temperature 0.8 "こんにちは"
# 出力: "こんにちは！お元気ですか？"
# → 毎回異なる
```

#### デフォルト値

```bash
seed = ランダム（未指定）
```

#### 温度との関係

```
temperature = 0.0 + seed固定 = 完全に決定的
temperature = 0.0 + seed未指定 = ほぼ決定的（微妙に異なる可能性）
temperature = 1.0 + seed固定 = ランダム性あるが再現可能
temperature = 1.0 + seed未指定 = 完全にランダム
```

#### チューニング方法

**用途別推奨:**

| 用途                 | Seed 設定      | 理由         |
| -------------------- | -------------- | ------------ |
| **テスト・デバッグ** | 固定（例: 42） | 再現性が重要 |
| **A/B テスト**       | 固定           | 公平な比較   |
| **本番環境**         | 未指定         | 多様な出力   |
| **デモ**             | 固定           | 一貫した動作 |

**実装例:**

```bash
# テスト用（再現性）
ollama run gemma2:27b --seed 42 --temperature 0.8 "プロンプト"

# 本番用（多様性）
ollama run gemma2:27b --temperature 0.8 "プロンプト"
```

---

### 7. Num_ctx（コンテキスト長）

#### 概念

モデルが参照できる過去のトークン数（コンテキストウィンドウサイズ）。

#### 重要性

```
コンテキスト長が短い:
- 古い会話を忘れる
- 長いドキュメントを処理できない

コンテキスト長が長い:
- 長い会話を記憶
- 大きなファイルを処理可能
- ただしメモリ使用量増加
```

#### 効果

**例（会話）:**

**num_ctx = 2048（約 1500 単語）:**

```
ユーザー: 私の名前はmopです
AI: こんにちは、mopさん

[... 長い会話 ...]

ユーザー: 私の名前は？
AI: すみません、記憶にありません
→ コンテキスト外に押し出された
```

**num_ctx = 8192（約 6000 単語）:**

```
ユーザー: 私の名前はmopです
AI: こんにちは、mopさん

[... 長い会話 ...]

ユーザー: 私の名前は？
AI: mopさんですね
→ まだコンテキスト内
```

#### モデルごとの最大値

| モデル             | デフォルト | 最大値  |
| ------------------ | ---------- | ------- |
| **gemma2:9b**      | 4096       | 8,192   |
| **gemma2:27b**     | 4096       | 8,192   |
| **qwen2.5:14b**    | 4096       | 32,768  |
| **phi3.5**         | 4096       | 131,072 |
| **deepseek-r1:7b** | 4096       | 131,072 |

#### デフォルト値

```bash
num_ctx = 4096  # gemma2:27b
```

#### メモリとの関係

```python
# メモリ使用量の計算
KV_cache_memory = num_ctx × num_layers × hidden_size × 2 × bytes_per_param

# gemma2:27bの例
num_ctx = 8192
num_layers = 46
hidden_size = 4608
bytes = 2 (FP16)

KV_cache = 8192 × 46 × 4608 × 2 × 2 / (1024^3)
         ≈ 6.7 GB

モデル本体: 16 GB
KV cache:    6.7 GB
作業メモリ:  2 GB
合計:       約25 GB ← 32GB環境で動作可能
```

#### チューニング方法

**推奨値:**

| 用途                      | 推奨コンテキスト | 理由               |
| ------------------------- | ---------------- | ------------------ |
| **短い会話**              | 2048-4096        | メモリ効率的       |
| **一般的な会話**          | 4096-8192        | バランス           |
| **長文処理**              | 8192+            | 大きなドキュメント |
| **超長文（phi3.5 のみ）** | 32768-131072     | 特殊用途           |

**設定例:**

```bash
# 標準
ollama run gemma2:27b --num-ctx 4096 "プロンプト"

# 長文処理
ollama run gemma2:27b --num-ctx 8192 "長いドキュメント分析"

# メモリ節約
ollama run gemma2:27b --num-ctx 2048 "短い質問"
```

**注意:**

```bash
# 最大値を超えると警告
ollama run gemma2:27b --num-ctx 16384 "プロンプト"
# → 警告: gemma2の最大は8192

# メモリ不足
ollama run gemma2:27b --num-ctx 8192 "プロンプト"
# → 16GB環境では動作不可（32GB必要）
```

---

## Gemma2:27B について

### モデル概要

**基本スペック:**

```
正式名称: Gemma 2 27B Instruct
開発元: Google DeepMind
リリース: 2024年6月
アーキテクチャ: gemma2
パラメータ数: 27.2B（272億）
コンテキスト長: 8,192トークン
量子化: Q4_0（ollama）
ファイルサイズ: 約16GB
```

### Gemma2:9B との比較

| 項目               | Gemma2:9B | Gemma2:27B     | 差          |
| ------------------ | --------- | -------------- | ----------- |
| **パラメータ数**   | 9.24B     | 27.2B          | 3 倍        |
| **ファイルサイズ** | 5.1GB     | 16GB           | 3 倍        |
| **メモリ使用**     | 7.5GB     | 20GB+          | 2.7 倍      |
| **推論速度**       | 52 秒\*   | 推定 90-120 秒 | 約 2 倍遅い |
| **出力品質**       | 高        | 最高           | 向上        |
| **16GB 環境**      | ✅ 動作可 | ❌ 不可        | -           |
| **32GB 環境**      | ✅ 余裕   | ✅ 動作可      | -           |

\*16GB M1 Mac での複雑な Reasoning タスク

### 性能特性

**公式ベンチマーク:**

```
MMLU（知識理解）:
gemma2:9b  → 71.3%
gemma2:27b → 75.2%

HumanEval（コード生成）:
gemma2:9b  → 51.8%
gemma2:27b → 65.4%

GSM8K（数学推論）:
gemma2:9b  → 68.6%
gemma2:27b → 79.7%
```

**特徴:**

- 27B は同等サイズの他モデルを超える性能
- 特にコード生成と数学的推論で強い
- 構造化された出力が得意

### メモリ要件詳細

**32GB 環境での動作:**

```
モデル本体（GPU VRAM）: 16 GB
KV Cache（デフォルト4096）: 3.5 GB
作業メモリ: 1.5 GB
合計GPU使用: 約21 GB

macOS: 3 GB
ブラウザ等: 3 GB
余裕: 5 GB

32GB - 21GB（GPU）- 6GB（OS等）= 5GB余裕
→ ✅ 動作可能
```

**コンテキスト長による変動:**

```
num_ctx = 2048: 約19 GB（軽量）
num_ctx = 4096: 約21 GB（デフォルト）
num_ctx = 8192: 約25 GB（最大）
```

### 推奨用途

**27B が特に優れている分野:**

1. **複雑なコード生成**

   - 複数ファイルにまたがるプロジェクト
   - アーキテクチャ設計
   - リファクタリング提案

2. **高度な推論**

   - 多段階の論理推論
   - 数学的証明
   - 複雑な問題解決

3. **専門的な文章生成**

   - 技術文書
   - 学術論文
   - 詳細なレポート

4. **構造化データ処理**
   - JSON 生成
   - データベーススキーマ設計
   - API 仕様書作成

**9B で十分な分野:**

- 一般的なチャット
- 簡単なコード生成
- 短い文章作成
- 翻訳

### ollama での使用

**インストール:**

```bash
# モデルのpull（約16GB）
ollama pull gemma2:27b

# 確認
ollama list
# NAME           ID              SIZE
# gemma2:27b     a17d42f1a28a    16 GB
```

**基本的な使用:**

```bash
# 実行
ollama run gemma2:27b "Pythonでクイックソートを実装してください"

# パラメータ付き
ollama run gemma2:27b \
  --temperature 0.3 \
  --num-predict 1000 \
  "複雑なマイクロサービスアーキテクチャを設計してください"
```

**メモリ監視:**

```bash
# 別ターミナルで監視
watch -n 1 "ps aux | grep ollama"

# またはアクティビティモニタで確認
# → メモリ使用量を確認
```

---

## テスト環境要件

### ハードウェア要件

**最小要件:**

```
CPU: Apple Silicon（M1以降）
RAM: 32GB
ストレージ: 30GB以上の空き
```

**推奨要件:**

```
CPU: M2/M3
RAM: 32GB
ストレージ: SSD、50GB以上の空き
```

### ソフトウェア要件

```bash
# ollama（最新版）
brew install ollama
# または
curl -fsSL https://ollama.com/install.sh | sh

# Python（分析用）
python3 --version  # 3.8以上

# 必要なライブラリ
pip install numpy pandas matplotlib
```

### モデルのインストール

```bash
# gemma2:27bをpull
ollama pull gemma2:27b

# 確認
ollama list | grep gemma2:27b
```

### テストデータの準備

```bash
# テスト用ディレクトリ作成
mkdir -p ~/llm_tests/gemma2_27b_params
cd ~/llm_tests/gemma2_27b_params

# テストプロンプト準備
cat > test_prompts.txt << 'EOF'
Pythonでフィボナッチ数列を計算する関数を実装してください。効率的な方法を提案してください。
猫について詳しく説明してください。猫の特徴、行動、歴史について教えてください。
マイクロサービスでECサイトを設計する場合、どのようなサービス分割が適切ですか？
EOF
```

---

## 体系的なテスト手順

### 全体テストスクリプト

```bash
#!/bin/bash
# test_all_parameters.sh
# Gemma2:27B パラメータテスト

set -e

MODEL="gemma2:27b"
TEST_DIR="$HOME/llm_tests/gemma2_27b_params"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_DIR="$TEST_DIR/results_$TIMESTAMP"

mkdir -p "$RESULT_DIR"
cd "$RESULT_DIR"

# テストプロンプト
PROMPT="Pythonでフィボナッチ数列を計算する関数を実装してください。効率的な方法を提案してください。"
REPEAT_PROMPT="猫について詳しく説明してください。猫の特徴、行動、歴史について教えてください。"

echo "========================================"
echo "Gemma2:27B パラメータテスト"
echo "開始時刻: $(date)"
echo "========================================"
echo ""

# ========================================
# Test 1: Temperature
# ========================================
echo "[1/7] Temperature テスト"
echo "予想所要時間: 約10分"

for temp in 0.0 0.3 0.8 1.2 1.8; do
  echo "  temperature = $temp"
  ollama run $MODEL --temperature $temp "$PROMPT" > temp_${temp}.txt 2>&1
  sleep 2
done

echo "✓ Temperature テスト完了"
echo ""

# ========================================
# Test 2: Top-p
# ========================================
echo "[2/7] Top-p テスト"
echo "予想所要時間: 約8分"

for top_p in 0.7 0.9 0.95 0.99; do
  echo "  top_p = $top_p"
  ollama run $MODEL --temperature 0.8 --top-p $top_p "$PROMPT" > top_p_${top_p}.txt 2>&1
  sleep 2
done

echo "✓ Top-p テスト完了"
echo ""

# ========================================
# Test 3: Top-k
# ========================================
echo "[3/7] Top-k テスト"
echo "予想所要時間: 約8分"

for top_k in 10 20 40 100; do
  echo "  top_k = $top_k"
  ollama run $MODEL --temperature 0.8 --top-p 0.9 --top-k $top_k "$PROMPT" > top_k_${top_k}.txt 2>&1
  sleep 2
done

echo "✓ Top-k テスト完了"
echo ""

# ========================================
# Test 4: Num_predict
# ========================================
echo "[4/7] Num_predict テスト"
echo "予想所要時間: 約8分"

for tokens in 50 150 500 1000; do
  echo "  num_predict = $tokens"
  ollama run $MODEL --num-predict $tokens "$PROMPT" > predict_${tokens}.txt 2>&1
  sleep 2
done

echo "✓ Num_predict テスト完了"
echo ""

# ========================================
# Test 5: Repeat_penalty
# ========================================
echo "[5/7] Repeat_penalty テスト"
echo "予想所要時間: 約8分"

for penalty in 1.0 1.1 1.3 1.5; do
  echo "  repeat_penalty = $penalty"
  ollama run $MODEL --repeat-penalty $penalty "$REPEAT_PROMPT" > repeat_${penalty}.txt 2>&1
  sleep 2
done

echo "✓ Repeat_penalty テスト完了"
echo ""

# ========================================
# Test 6: Seed（再現性）
# ========================================
echo "[6/7] Seed テスト（再現性）"
echo "予想所要時間: 約12分"

# Seed固定で3回
for i in 1 2 3; do
  echo "  seed=42, 実行 $i"
  ollama run $MODEL --seed 42 --temperature 0.8 "$PROMPT" > seed_42_run${i}.txt 2>&1
  sleep 2
done

# Seed未指定で3回
for i in 1 2 3; do
  echo "  seed未指定, 実行 $i"
  ollama run $MODEL --temperature 0.8 "$PROMPT" > seed_random_run${i}.txt 2>&1
  sleep 2
done

echo "✓ Seed テスト完了"
echo ""

# ========================================
# Test 7: Num_ctx
# ========================================
echo "[7/7] Num_ctx テスト"
echo "予想所要時間: 約6分"

for ctx in 2048 4096 8192; do
  echo "  num_ctx = $ctx"
  ollama run $MODEL --num-ctx $ctx "$PROMPT" > ctx_${ctx}.txt 2>&1
  sleep 2
done

echo "✓ Num_ctx テスト完了"
echo ""

# ========================================
# 結果サマリー生成
# ========================================
echo "結果サマリー生成中..."

cat > summary.txt << EOF
Gemma2:27B パラメータテストサマリー
=====================================

実行日時: $(date)
モデル: $MODEL
結果ディレクトリ: $RESULT_DIR

テスト結果:
-----------

1. Temperature (5パターン)
   - temp_0.0.txt
   - temp_0.3.txt
   - temp_0.8.txt
   - temp_1.2.txt
   - temp_1.8.txt

2. Top-p (4パターン)
   - top_p_0.7.txt
   - top_p_0.9.txt
   - top_p_0.95.txt
   - top_p_0.99.txt

3. Top-k (4パターン)
   - top_k_10.txt
   - top_k_20.txt
   - top_k_40.txt
   - top_k_100.txt

4. Num_predict (4パターン)
   - predict_50.txt
   - predict_150.txt
   - predict_500.txt
   - predict_1000.txt

5. Repeat_penalty (4パターン)
   - repeat_1.0.txt
   - repeat_1.1.txt
   - repeat_1.3.txt
   - repeat_1.5.txt

6. Seed (6パターン)
   - seed_42_run1.txt
   - seed_42_run2.txt
   - seed_42_run3.txt
   - seed_random_run1.txt
   - seed_random_run2.txt
   - seed_random_run3.txt

7. Num_ctx (3パターン)
   - ctx_2048.txt
   - ctx_4096.txt
   - ctx_8192.txt

ファイル数: $(ls -1 *.txt | wc -l)
合計サイズ: $(du -sh . | cut -f1)

次のステップ:
-------------
1. 各ファイルを確認して違いを分析
2. analysis.sh を実行して定量分析
3. 結果をドキュメント化
EOF

echo "✓ サマリー作成完了"
echo ""

echo "========================================"
echo "全テスト完了！"
echo "終了時刻: $(date)"
echo "結果: $RESULT_DIR"
echo "========================================"
echo ""
echo "次のコマンドで結果を確認:"
echo "  cd $RESULT_DIR"
echo "  cat summary.txt"
echo "  ls -lh *.txt"
```

### スクリプトの実行

```bash
# 実行権限付与
chmod +x test_all_parameters.sh

# 実行（約60-90分）
./test_all_parameters.sh

# または、バックグラウンドで実行
nohup ./test_all_parameters.sh > test.log 2>&1 &

# 進捗確認
tail -f test.log
```

---

## 結果の分析方法

### 定量分析スクリプト

```bash
#!/bin/bash
# analysis.sh
# テスト結果の定量分析

RESULT_DIR="$1"

if [ -z "$RESULT_DIR" ]; then
  echo "使用方法: ./analysis.sh <結果ディレクトリ>"
  exit 1
fi

cd "$RESULT_DIR"

echo "========================================"
echo "定量分析"
echo "========================================"
echo ""

# ========================================
# 1. 文字数・単語数の分析
# ========================================
echo "1. 出力の長さ分析"
echo "------------------"

echo ""
echo "Temperature:"
for file in temp_*.txt; do
  words=$(wc -w < "$file")
  chars=$(wc -m < "$file")
  echo "  $file: $words words, $chars chars"
done

echo ""
echo "Num_predict:"
for file in predict_*.txt; do
  words=$(wc -w < "$file")
  chars=$(wc -m < "$file")
  echo "  $file: $words words, $chars chars"
done

echo ""

# ========================================
# 2. 繰り返しの分析（Repeat_penalty）
# ========================================
echo "2. 単語の繰り返し分析"
echo "--------------------"

echo ""
echo "Repeat_penalty（'猫'の出現回数）:"
for file in repeat_*.txt; do
  count=$(grep -o "猫" "$file" | wc -l)
  echo "  $file: $count 回"
done

echo ""

# ========================================
# 3. 再現性の確認（Seed）
# ========================================
echo "3. 再現性分析（Seed）"
echo "-------------------"

echo ""
echo "Seed固定（差分確認）:"
diff_12=$(diff seed_42_run1.txt seed_42_run2.txt | wc -l)
diff_23=$(diff seed_42_run2.txt seed_42_run3.txt | wc -l)
echo "  run1 vs run2: $diff_12 行の差分"
echo "  run2 vs run3: $diff_23 行の差分"

if [ "$diff_12" -eq 0 ] && [ "$diff_23" -eq 0 ]; then
  echo "  → ✓ 完全に再現されています"
else
  echo "  → ✗ 差分があります（要確認）"
fi

echo ""
echo "Seed未指定（差分確認）:"
diff_r12=$(diff seed_random_run1.txt seed_random_run2.txt | wc -l)
diff_r23=$(diff seed_random_run2.txt seed_random_run3.txt | wc -l)
echo "  run1 vs run2: $diff_r12 行の差分"
echo "  run2 vs run3: $diff_r23 行の差分"

if [ "$diff_r12" -gt 0 ] && [ "$diff_r23" -gt 0 ]; then
  echo "  → ✓ 期待通り異なっています"
else
  echo "  → ✗ 同一です（要確認）"
fi

echo ""

# ========================================
# 4. コード品質の簡易分析
# ========================================
echo "4. コード品質の簡易分析"
echo "---------------------"

echo ""
echo "Temperature（関数定義の検出）:"
for file in temp_*.txt; do
  def_count=$(grep -c "^def " "$file" || true)
  echo "  $file: $def_count 個の関数定義"
done

echo ""

echo "========================================"
echo "分析完了"
echo "========================================"
```

### Python 分析スクリプト（詳細）

```python
#!/usr/bin/env python3
# detailed_analysis.py

import os
import sys
from pathlib import Path
import matplotlib.pyplot as plt

def analyze_directory(result_dir):
    """詳細な分析を実行"""

    result_path = Path(result_dir)

    # 1. Temperature分析
    print("Temperature分析:")
    temps = [0.0, 0.3, 0.8, 1.2, 1.8]
    lengths = []

    for temp in temps:
        file = result_path / f"temp_{temp}.txt"
        if file.exists():
            with open(file, 'r') as f:
                content = f.read()
                length = len(content.split())
                lengths.append(length)
                print(f"  temp={temp}: {length} words")

    # グラフ生成
    plt.figure(figsize=(10, 6))
    plt.plot(temps, lengths, marker='o')
    plt.xlabel('Temperature')
    plt.ylabel('Output Length (words)')
    plt.title('Temperature vs Output Length')
    plt.grid(True)
    plt.savefig(result_path / 'temp_analysis.png')
    print("  → グラフ保存: temp_analysis.png")

    # 2. Repeat_penalty分析
    print("\nRepeat_penalty分析:")
    penalties = [1.0, 1.1, 1.3, 1.5]
    cat_counts = []

    for penalty in penalties:
        file = result_path / f"repeat_{penalty}.txt"
        if file.exists():
            with open(file, 'r') as f:
                content = f.read()
                count = content.count('猫')
                cat_counts.append(count)
                print(f"  penalty={penalty}: '猫' {count}回")

    plt.figure(figsize=(10, 6))
    plt.plot(penalties, cat_counts, marker='o', color='red')
    plt.xlabel('Repeat Penalty')
    plt.ylabel("Count of '猫'")
    plt.title("Repeat Penalty vs Word Repetition")
    plt.grid(True)
    plt.savefig(result_path / 'repeat_analysis.png')
    print("  → グラフ保存: repeat_analysis.png")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python3 detailed_analysis.py <result_dir>")
        sys.exit(1)

    analyze_directory(sys.argv[1])
    print("\n分析完了")
```

### 分析の実行

```bash
# Bash分析
./analysis.sh ~/llm_tests/gemma2_27b_params/results_YYYYMMDD_HHMMSS

# Python詳細分析
python3 detailed_analysis.py ~/llm_tests/gemma2_27b_params/results_YYYYMMDD_HHMMSS
```

---

## 用途別推奨設定

### プリセット 1: コード生成

```bash
ollama run gemma2:27b \
  --temperature 0.2 \
  --top-p 0.9 \
  --top-k 30 \
  --num-predict 1000 \
  --repeat-penalty 1.05 \
  "Pythonで複雑なデータ構造を実装してください"
```

**理由:**

- 低温: 正確で一貫したコード
- 標準的な top-p/k: 定番パターン優先
- 長めのトークン: 完全な実装
- 低い repeat_penalty: 変数名の繰り返しは自然

### プリセット 2: 技術文書

```bash
ollama run gemma2:27b \
  --temperature 0.5 \
  --top-p 0.9 \
  --num-predict 1500 \
  --repeat-penalty 1.1 \
  "マイクロサービスアーキテクチャについて詳しく説明してください"
```

**理由:**

- やや低温: 正確性重視
- 長いトークン: 詳細な説明
- 標準的な repeat_penalty: 適度な言い換え

### プリセット 3: 一般チャット

```bash
ollama run gemma2:27b \
  --temperature 0.8 \
  --top-p 0.95 \
  --num-predict 500 \
  "今日の天気について話しましょう"
```

**理由:**

- デフォルト設定
- 自然な会話
- 適度な長さ

### プリセット 4: 創作

```bash
ollama run gemma2:27b \
  --temperature 1.3 \
  --top-p 0.98 \
  --top-k 100 \
  --num-predict 2000 \
  --repeat-penalty 1.2 \
  "未来の世界について創造的なストーリーを書いてください"
```

**理由:**

- 高温: 創造的
- 広いサンプリング: 多様な表現
- 長いトークン: 詳細なストーリー
- 高い repeat_penalty: 表現の多様性

### プリセット 5: デバッグ・テスト

```bash
ollama run gemma2:27b \
  --temperature 0.8 \
  --seed 42 \
  --num-predict 500 \
  "テスト用のプロンプト"
```

**理由:**

- seed 固定: 再現性
- 標準的な温度: 自然な出力
- 適度な長さ

---

## トラブルシューティング

### 問題 1: メモリ不足

**症状:**

```
Error: out of memory
または
モデルのロードが失敗
```

**原因:**

- 32GB RAM 不足（他のアプリが使用中）
- num_ctx が大きすぎる

**解決策:**

```bash
# 1. 他のアプリを終了
# ブラウザ、IDEなどを閉じる

# 2. num_ctxを小さくする
ollama run gemma2:27b --num-ctx 2048 "プロンプト"

# 3. より小さいモデルを使用
ollama run gemma2:9b "プロンプト"

# 4. システムを再起動
sudo reboot
```

### 問題 2: 推論が遅い

**症状:**

```
1つの応答に5分以上かかる
```

**原因:**

- CPU で実行されている（GPU が使われていない）
- num_ctx が大きすぎる
- num_predict が大きすぎる

**解決策:**

```bash
# 1. GPU使用確認
# アクティビティモニタ → GPU履歴を確認

# 2. パラメータ調整
ollama run gemma2:27b \
  --num-ctx 4096 \
  --num-predict 500 \
  "プロンプト"

# 3. ollamaの再起動
pkill ollama
ollama serve
```

### 問題 3: 出力が途中で止まる

**症状:**

```
文章が完結せずに終了
```

**原因:**

- num_predict が小さすぎる

**解決策:**

```bash
# トークン数を増やす
ollama run gemma2:27b --num-predict 1000 "プロンプト"

# または無制限（注意）
ollama run gemma2:27b --num-predict -1 "プロンプト"
```

### 問題 4: 同じ出力が繰り返される

**症状:**

```
temperature > 0 でも毎回同じ出力
```

**原因:**

- seed が意図せず固定されている
- temperature が 0 に近い

**解決策:**

```bash
# seedを明示的に未指定（デフォルト）
ollama run gemma2:27b --temperature 0.8 "プロンプト"

# temperatureを上げる
ollama run gemma2:27b --temperature 1.0 "プロンプト"
```

### 問題 5: 出力が不自然

**症状:**

```
文法エラーや意味不明な文章
```

**原因:**

- temperature が高すぎる
- repeat_penalty が高すぎる

**解決策:**

```bash
# パラメータを保守的に
ollama run gemma2:27b \
  --temperature 0.7 \
  --repeat-penalty 1.1 \
  "プロンプト"
```

---

## まとめ

### テスト準備チェックリスト

**32GB Mac 到着後:**

- [ ] ollama 最新版インストール
- [ ] gemma2:27b pull（16GB）
- [ ] テストスクリプトダウンロード
- [ ] テストディレクトリ作成
- [ ] システムの空きメモリ確認（25GB 以上）

**テスト実行:**

- [ ] 全パラメータテスト実行（2-3 時間）
- [ ] 結果ファイル確認
- [ ] 定量分析実行
- [ ] グラフ生成

**ドキュメント化:**

- [ ] 結果を Markdown にまとめる
- [ ] GitHub に push
- [ ] Llamune プロジェクトに反映

### 次のステップ

1. **32GB Mac 到着**

   - gemma2:27b でテスト実行
   - 結果をドキュメント化

2. **他の大規模モデル**

   - qwq:32b（Reasoning 特化）
   - deepseek-r1:14b（Reasoning）
   - qwen2.5:32b（汎用）

3. **Llamune 実装**
   - パラメータ UI の設計
   - プリセット機能
   - リアルタイム比較

---

## 参考資料

### 公式ドキュメント

- **Ollama**: https://github.com/ollama/ollama/blob/main/docs/api.md
- **Gemma2**: https://ai.google.dev/gemma/docs
- **Temperature 論文**: "The Curious Case of Neural Text Degeneration"
- **Nucleus Sampling**: "The Curious Case of Neural Text Degeneration" (Holtzman et al., 2019)

### 関連ドキュメント

- [Ollama 操作マニュアル](./ollama-operations.md)
- [LLM ファイルとファインチューニング](./llm-files-and-finetuning.md)
- [Gemma2:9B Reasoning テスト](./reasoning-test-gemma2-9b.md)
- [モデル比較まとめ](./model-comparison-summary.md)

---

**最終更新:** 2025-11-11
**作成者:** mop
**Llamune Project:** https://github.com/unrcom/llamune
