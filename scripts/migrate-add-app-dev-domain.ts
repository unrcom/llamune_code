#!/usr/bin/env tsx
/**
 * アプリケーション開発ドメインモードを追加するマイグレーションスクリプト
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_DIR = join(homedir(), '.llamune');
const DB_FILE = join(DB_DIR, 'history.db');

// ディレクトリがなければ作成
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

console.log('📂 Database:', DB_FILE);
console.log('');

const db = new Database(DB_FILE);

console.log('🔄 アプリケーション開発ドメインモードを追加します...');
console.log('');

try {
  // トランザクション開始
  db.exec('BEGIN TRANSACTION');

  const now = new Date().toISOString();

  // ========================================
  // 1. アプリケーション開発ドメインモードを追加
  // ========================================
  const existingDomain = db
    .prepare("SELECT id FROM domain_modes WHERE name = 'app-development'")
    .get() as { id: number } | undefined;

  let domainId: number;

  if (existingDomain) {
    console.log('✅ アプリケーション開発ドメインモードは既に存在します');
    domainId = existingDomain.id;
  } else {
    console.log('➕ アプリケーション開発ドメインモードを追加します...');

    const result = db
      .prepare(`
        INSERT INTO domain_modes (name, display_name, description, icon, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        'app-development',
        'アプリケーション開発',
        'コード生成、レビュー、リファクタリング、バグ修正など、アプリケーション開発全般を支援します。Gitリポジトリと連携して動作します。',
        '💻',
        1,
        now
      );

    domainId = result.lastInsertRowid as number;
    console.log(`✅ アプリケーション開発ドメインモード (ID: ${domainId}) を追加しました`);
  }

  // ========================================
  // 2. ドメインプロンプトを追加
  // ========================================

  const prompts = [
    {
      name: 'code-generation',
      display_name: 'コード生成',
      description: '新しい機能の実装やコンポーネントの作成を支援します',
      system_prompt: `あなたはアプリケーション開発の専門家です。以下のガイドラインに従ってコードを生成してください：

1. **コード品質**
   - 読みやすく、保守しやすいコードを書く
   - 適切な命名規則を使用する
   - 必要に応じてコメントを追加する
   - DRY原則（Don't Repeat Yourself）を守る

2. **ベストプラクティス**
   - 型安全性を重視する（TypeScriptの場合）
   - エラーハンドリングを適切に行う
   - セキュリティを考慮する（SQLインジェクション、XSSなど）
   - パフォーマンスを考慮する

3. **既存コードとの整合性**
   - プロジェクトの既存のコーディングスタイルに合わせる
   - 既存のアーキテクチャパターンを踏襲する
   - 依存関係を適切に管理する

4. **テスト**
   - 可能な限りテストしやすいコードを書く
   - エッジケースを考慮する`,
      recommended_model: 'qwen2.5:14b',
      is_default: 1,
    },
    {
      name: 'code-review',
      display_name: 'コードレビュー',
      description: '既存コードの問題点や改善点を指摘します',
      system_prompt: `あなたはコードレビューの専門家です。以下の観点でコードをレビューしてください：

1. **コード品質**
   - 可読性と保守性
   - 命名規則の適切性
   - コードの重複（DRY原則）
   - 複雑度（循環的複雑度）

2. **潜在的な問題**
   - バグの可能性
   - エッジケースの考慮漏れ
   - メモリリークの可能性
   - パフォーマンス上の問題

3. **セキュリティ**
   - SQLインジェクション
   - XSS（クロスサイトスクリプティング）
   - CSRF対策
   - 認証・認可の問題

4. **改善提案**
   - より良い実装方法の提案
   - リファクタリングの提案
   - パフォーマンス改善の提案`,
      recommended_model: 'gemma2:9b',
      is_default: 0,
    },
    {
      name: 'refactoring',
      display_name: 'リファクタリング',
      description: '既存コードの構造改善と最適化を行います',
      system_prompt: `あなたはリファクタリングの専門家です。以下の原則に従ってコードを改善してください：

1. **リファクタリングの原則**
   - 機能を変更せずに、コード構造を改善する
   - 小さな変更を積み重ねる
   - テストを書いてから（または確認してから）リファクタリングする

2. **改善項目**
   - 長すぎる関数を分割する
   - 重複コードを抽出する
   - 複雑な条件式を簡潔にする
   - マジックナンバーを定数化する

3. **設計パターンの適用**
   - 適切なデザインパターンを提案する
   - 依存性注入を活用する
   - インターフェースと実装を分離する

4. **パフォーマンス改善**
   - 不要な計算を削減する
   - メモリ使用量を最適化する
   - キャッシュを活用する`,
      recommended_model: 'qwen2.5:14b',
      is_default: 0,
    },
    {
      name: 'bug-fixing',
      display_name: 'バグ修正',
      description: 'バグの原因を特定し、修正方法を提案します',
      system_prompt: `あなたはデバッグの専門家です。以下の手順でバグを分析・修正してください：

1. **問題の特定**
   - エラーメッセージやスタックトレースを分析する
   - 再現手順を理解する
   - 期待される動作と実際の動作の差を明確にする

2. **原因の調査**
   - コードフローを追跡する
   - 変数の状態を確認する
   - エッジケースを考慮する
   - 関連するコードも確認する

3. **修正方法の提案**
   - 根本原因を解決する修正を提案する
   - 副作用がないか確認する
   - テストケースを追加する
   - 同様の問題が他にないか確認する

4. **予防策**
   - 再発防止のための改善提案
   - バリデーションの追加
   - エラーハンドリングの改善`,
      recommended_model: 'deepseek-r1:7b',
      is_default: 0,
    },
    {
      name: 'architecture-design',
      display_name: 'アーキテクチャ設計',
      description: 'システム設計やアーキテクチャの相談に対応します',
      system_prompt: `あなたはソフトウェアアーキテクトです。以下の観点でアーキテクチャを設計・提案してください：

1. **設計原則**
   - SOLID原則を適用する
   - 関心の分離を徹底する
   - 疎結合・高凝集を目指す
   - スケーラビリティを考慮する

2. **アーキテクチャパターン**
   - レイヤードアーキテクチャ
   - クリーンアーキテクチャ
   - マイクロサービス
   - イベント駆動アーキテクチャ

3. **技術選定**
   - 要件に適した技術スタックの提案
   - トレードオフの明確化
   - 既存システムとの互換性を考慮

4. **非機能要件**
   - パフォーマンス
   - セキュリティ
   - 可用性
   - 保守性`,
      recommended_model: 'gemma2:9b',
      is_default: 0,
    },
  ];

  for (const prompt of prompts) {
    const existingPrompt = db
      .prepare(
        "SELECT id FROM domain_prompts WHERE domain_mode_id = ? AND name = ?"
      )
      .get(domainId, prompt.name) as { id: number } | undefined;

    if (existingPrompt) {
      console.log(`✅ ${prompt.display_name}プロンプトは既に存在します`);
    } else {
      // プリセットIDを取得（balanced）
      const balancedPreset = db
        .prepare("SELECT id FROM parameter_presets WHERE name = 'default'")
        .get() as { id: number } | undefined;

      db.prepare(`
        INSERT INTO domain_prompts (
          domain_mode_id, name, display_name, description,
          system_prompt, recommended_model, preset_id, is_default, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        domainId,
        prompt.name,
        prompt.display_name,
        prompt.description,
        prompt.system_prompt,
        prompt.recommended_model,
        balancedPreset?.id || null,
        prompt.is_default,
        now
      );

      console.log(`✅ ${prompt.display_name}プロンプトを追加しました`);
    }
  }

  // トランザクションコミット
  db.exec('COMMIT');

  console.log('');
  console.log('📊 登録済みドメインモードとプロンプト:');
  console.log('');

  // ドメインモード一覧
  const domains = db.prepare('SELECT * FROM domain_modes').all() as Array<{
    id: number;
    name: string;
    display_name: string;
    icon: string;
  }>;

  domains.forEach((domain) => {
    console.log(`${domain.icon} ${domain.display_name} (${domain.name}) - ID: ${domain.id}`);

    const domainPrompts = db
      .prepare('SELECT name, display_name, is_default FROM domain_prompts WHERE domain_mode_id = ?')
      .all(domain.id) as Array<{
        name: string;
        display_name: string;
        is_default: number;
      }>;

    domainPrompts.forEach((p) => {
      const defaultMark = p.is_default ? ' [デフォルト]' : '';
      console.log(`  - ${p.display_name} (${p.name})${defaultMark}`);
    });
    console.log('');
  });

  console.log('✅ マイグレーション完了');
  console.log('');
  console.log('🚀 次のステップ:');
  console.log('1. Web UIでアプリケーション開発モードを選択');
  console.log('2. リポジトリを登録');
  console.log('3. LLMによるコード生成・レビューを開始');
} catch (error) {
  console.error('❌ マイグレーションに失敗しました');
  console.error(error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
