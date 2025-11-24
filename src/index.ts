#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  formatSize,
  formatParams,
  type ChatMessage,
  type ChatParameters,
} from './utils/ollama.js';
import {
  displaySystemSpec,
  displayRecommendedModels,
} from './utils/system.js';
import {
  getLastUsedModel,
  saveLastUsedModel,
} from './utils/config.js';
import {
  registerCommand,
  loginCommand,
  logoutCommand,
  whoamiCommand,
} from './commands/auth.js';
import {
  type ParameterPreset,
} from './utils/database.js';
import * as readline from 'readline';

// ESModuleでpackage.jsonを読み込む
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

// 基本設定
program
  .name('llamune')
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', 'バージョンを表示');

// メインコマンド（引数なしで実行）
program
  .action(() => {
    console.log('🔵 Llamune ✨ - Closed Network LLM Platform');
    console.log('');
    console.log('使い方:');
    console.log('  llamune [コマンド] [オプション]');
    console.log('  llmn [コマンド] [オプション]  # 短縮版');
    console.log('');
    console.log('利用可能なコマンド:');
    console.log('  register     ユーザー登録');
    console.log('  login        ログイン');
    console.log('  logout       ログアウト');
    console.log('  whoami       現在のユーザー情報を表示');
    console.log('  ls           利用可能なモデル一覧を表示');
    console.log('  pull         モデルをダウンロード');
    console.log('  rm           モデルを削除');
    console.log('  recommend    推奨モデルを表示');
    console.log('  chat         チャットを開始');
    console.log('  compare      複数のLLMで比較実行');
    console.log('  history      会話履歴を表示・編集・削除');
    console.log('  config       設定を管理');
    console.log('');
    console.log('ヘルプを表示: llamune --help');
  });

/**
 * モデルを選択（インタラクティブ）
 */
async function selectModel(
  models: { name: string }[],
  lastUsedModel?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('利用可能なモデル:');
    console.log('');

    models.forEach((model, index) => {
      const isLast = model.name === lastUsedModel;
      const prefix = isLast ? '⭐' : '  ';
      const suffix = isLast ? ' (前回使用)' : '';
      console.log(`${prefix} ${index + 1}. ${model.name}${suffix}`);
    });

    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('モデルを選択してください (番号): ', (answer) => {
      rl.close();

      const num = parseInt(answer.trim(), 10);
      if (num >= 1 && num <= models.length) {
        resolve(models[num - 1].name);
      } else {
        console.log('');
        console.log('❌ 無効な番号です');
        reject(new Error('Invalid model selection'));
      }
    });
  });
}

/**
 * パラメータプリセットを選択（インタラクティブ）
 */
async function selectPreset(presets: ParameterPreset[]): Promise<ParameterPreset> {
  return new Promise((resolve, reject) => {
    console.log('パラメータプリセットを選択:');
    console.log('');

    presets.forEach((preset, index) => {
      const description = preset.description ? ` - ${preset.description}` : '';
      console.log(`  ${index + 1}. ${preset.display_name}${description}`);
    });

    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('プリセットを選択してください (番号): ', (answer) => {
      rl.close();

      const num = parseInt(answer.trim(), 10);
      if (num >= 1 && num <= presets.length) {
        resolve(presets[num - 1]);
      } else {
        console.log('');
        console.log('❌ 無効な番号です');
        reject(new Error('Invalid preset selection'));
      }
    });
  });
}

/**
 * スピナーを表示
 */
function showSpinner(): NodeJS.Timeout {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  return setInterval(() => {
    process.stdout.write(`\r${frames[i]} 考え中...`);
    i = (i + 1) % frames.length;
  }, 80);
}

/**
 * スピナーを停止
 */
function stopSpinner(spinner: NodeJS.Timeout): void {
  clearInterval(spinner);
  process.stdout.write('\r\x1b[K'); // 行をクリア
}

// chat コマンド（API クライアント版）
program
  .command('chat')
  .description('チャットを開始')
  .option('-m, --model <model>', 'モデルを指定')
  .option('-c, --continue <session-id>', '過去の会話を再開')
  .action(async (options: { model?: string; continue?: string }) => {
    try {
      // API クライアント機能をインポート
      const {
        sendMessageStream,
        retryMessageStream,
        getSessionDetail,
        rewindSessionApi,
        switchModelApi,
        getParameterPresetsApi,
      } = await import('./utils/chat-client.js');
      const { listModelsApi } = await import('./utils/models-client.js');

      // モデル一覧を取得（API経由）
      const models = await listModelsApi();
      if (models.length === 0) {
        console.log('❌ インストール済みのモデルがありません');
        console.log('');
        console.log('モデルをインストールしてください:');
        console.log('  llamune pull gemma2:9b');
        console.log('  llmn pull gemma2:9b');
        process.exit(1);
      }

      // 会話履歴とセッションID
      let messages: ChatMessage[] = [];
      let sessionId: number | null = null;
      let selectedModel: string;
      let selectedParameters: ChatParameters | undefined = undefined;

      // /retry で保留中の回答
      let pendingRetry: { response: string; model: string; previousResponse: ChatMessage } | null = null;

      // /rewind で保留中の巻き戻し
      let pendingRewind: { sessionId: number | null; turnNumber: number } | null = null;

      // /retry の選択待ち（モデル × プリセット）
      let pendingRetryComboSelection = false;
      let retryModelPresetCombos: Array<{ model: string; preset: ParameterPreset; displayName: string }> = [];

      // --continue オプションで過去の会話を再開
      if (options.continue) {
        const sid = parseInt(options.continue, 10);
        let sessionData;
        try {
          sessionData = await getSessionDetail(sid);
        } catch (error) {
          console.log(`❌ セッションID ${sid} が見つかりません（または、あなたのセッションではありません）`);
          console.log('');
          console.log('履歴を確認してください:');
          console.log('  llamune history');
          console.log('  llmn history');
          process.exit(1);
        }

        // 過去の会話を復元
        sessionId = sid;
        messages = sessionData.messages;
        selectedModel = sessionData.session.model;

        // モデルが存在するか確認
        const modelExists = models.some((m) => m.name === selectedModel);
        if (!modelExists) {
          console.log(`❌ セッションのモデル "${selectedModel}" が見つかりません`);
          console.log('');
          console.log('モデルをインストールしてください:');
          console.log(`  llamune pull ${selectedModel}`);
          console.log(`  llmn pull ${selectedModel}`);
          process.exit(1);
        }

        console.log('');
        console.log('💬 Chat モード（会話を再開）');
        console.log(`セッションID: ${sessionId}`);
        console.log(`モデル: ${selectedModel}`);
        console.log('');
        console.log('--- 過去の会話 ---');
        console.log('');

        // 過去の会話を表示
        messages.forEach((msg) => {
          if (msg.role === 'user') {
            console.log(`You: ${msg.content}`);
          } else {
            const modelName = msg.model || selectedModel;
            console.log(`AI (${modelName}): ${msg.content}`);
          }
          console.log('');
        });

        console.log('--- 会話の続きを開始 ---');
        console.log('');
      } else {
        // 新規会話
        // モデルを選択
        if (options.model) {
          // -m オプションで指定された場合
          const modelExists = models.some((m) => m.name === options.model);
          if (!modelExists) {
            console.log(`❌ モデル "${options.model}" が見つかりません`);
            console.log('');
            console.log('利用可能なモデル:');
            models.forEach((m) => console.log(`  - ${m.name}`));
            process.exit(1);
          }
          selectedModel = options.model;
        } else {
          // オプション未指定の場合、インタラクティブに選択
          try {
            const lastUsedModel = getLastUsedModel();
            selectedModel = await selectModel(models, lastUsedModel);
          } catch {
            // 無効な選択の場合は終了
            process.exit(1);
          }
        }

        // 選択したモデルを保存
        saveLastUsedModel(selectedModel);

        console.log('');
        console.log('💬 Chat モード');
        console.log(`モデル: ${selectedModel}`);
        console.log('');
      }

      console.log('終了するには "exit" または "quit" と入力してください');
      console.log('---');
      console.log('');

      // Readline インターフェース
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'You: ',
      });

      rl.prompt();

      rl.on('line', async (input: string) => {
        const userInput = input.trim();

        // 終了コマンド
        if (userInput === 'exit' || userInput === 'quit') {
          rl.close();
          return;
        }

        // 空入力は無視
        if (!userInput) {
          rl.prompt();
          return;
        }

        // /retry の組み合わせ選択待ち処理
        if (pendingRetryComboSelection) {
          const comboNumber = parseInt(userInput, 10);

          if (isNaN(comboNumber) || comboNumber < 1 || comboNumber > retryModelPresetCombos.length) {
            console.log('');
            console.log('❌ 有効な番号を入力してください');
            console.log('');
            rl.prompt();
            return;
          }

          const combo = retryModelPresetCombos[comboNumber - 1];

          // 最後のメッセージがアシスタントでない場合
          if (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') {
            console.log('');
            console.log('❌ 再実行する回答がありません');
            console.log('');
            pendingRetryComboSelection = false;
            rl.prompt();
            return;
          }

          console.log('');
          console.log(`🔄 ${combo.displayName} で再実行します...`);
          console.log('');

          const retrySpinner = showSpinner();
          let retryResponse = '';
          let retryFirstChunk = true;

          // 最後のアシスタントの応答を保存（後で復元できるように）
          const previousResponse = messages[messages.length - 1];

          // 一時的にアシスタントの応答を削除して再実行
          messages.pop();

          try {
            // API経由でリトライ（ストリーミング）
            const retryGenerator = retryMessageStream(sessionId || undefined, combo.model, combo.preset.id, messages);

            let previousLength = 0;
            for await (const chunk of retryGenerator) {
              if (retryFirstChunk) {
                stopSpinner(retrySpinner);
                process.stdout.write(`AI (${combo.displayName}): `);
                retryFirstChunk = false;
              }
              retryResponse = chunk;
              // chunk は累積コンテンツなので、差分だけを出力
              const newContent = chunk.substring(previousLength);
              process.stdout.write(newContent);
              previousLength = chunk.length;
            }

            process.stdout.write('\n\n');

            // 保留中の回答として保存（まだmessagesには追加しない）
            pendingRetry = {
              response: retryResponse,
              model: combo.model,
              previousResponse: previousResponse,
            };

            const previousModelName = previousResponse.model || 'previous model';
            console.log('💡 この回答を採用しますか？');
            console.log(`  yes, y  - 採用 (${combo.displayName} の回答を採用する)`);
            console.log(`  no, n   - 破棄 (${previousModelName} の回答を採用する)`);
            console.log('');
          } catch (error) {
            stopSpinner(retrySpinner);
            console.error('\n');
            console.error('❌ エラー:', error instanceof Error ? error.message : '予期しないエラーが発生しました');
            console.log('');
            // エラーの場合は元の応答を復元
            messages.push(previousResponse);
          }

          // 選択待ち状態を解除
          pendingRetryComboSelection = false;

          rl.prompt();
          return;
        }

        // yes/no の簡易入力処理（スラッシュなしでも認識）
        const lowerInput = userInput.toLowerCase();
        if (lowerInput === 'yes' || lowerInput === 'y') {
          // /yes の処理を実行
          // /retry の採用
          if (pendingRetry) {
            // 新しい回答を採用
            messages.push({
              role: 'assistant',
              content: pendingRetry.response,
              model: pendingRetry.model,
            });

            console.log('');
            console.log(`✅ ${pendingRetry.model} の回答を採用しました`);
            console.log('');

            // 保留中の回答をクリア
            pendingRetry = null;

            rl.prompt();
            return;
          }

          // /rewind の実行
          if (pendingRewind) {
            let deletedCount = 0;

            // セッションがある場合は API 経由で巻き戻し
            if (pendingRewind.sessionId !== null) {
              try {
                await rewindSessionApi(pendingRewind.sessionId, pendingRewind.turnNumber);
                // 巻き戻し後、セッション詳細を再取得してメッセージを更新
                const updatedSession = await getSessionDetail(pendingRewind.sessionId);
                const keepCount = pendingRewind.turnNumber * 2;
                deletedCount = messages.length - keepCount;
                messages = updatedSession.messages;
              } catch (error) {
                console.log('');
                console.error('❌ 巻き戻しに失敗しました:', error instanceof Error ? error.message : 'Unknown error');
                console.log('');
                pendingRewind = null;
                rl.prompt();
                return;
              }
            } else {
              // 新規会話の場合は削除されるメッセージ数を計算
              const keepCount = pendingRewind.turnNumber * 2;
              deletedCount = messages.length - keepCount;
              // メモリ上の messages 配列を更新
              messages = messages.slice(0, keepCount);
            }

            console.log('');
            console.log(`✅ 会話 #${pendingRewind.turnNumber} まで巻き戻しました`);
            console.log(`削除されたメッセージ: ${deletedCount}件`);
            console.log('');

            // 保留中の巻き戻しをクリア
            pendingRewind = null;

            rl.prompt();
            return;
          }

          // 保留中の操作がない場合は通常メッセージとして処理
        }

        if (lowerInput === 'no' || lowerInput === 'n') {
          // /no の処理を実行
          // /retry のキャンセル
          if (pendingRetry) {
            // 前の回答を復元
            messages.push(pendingRetry.previousResponse);

            console.log('');
            console.log(`✅ ${pendingRetry.previousResponse.model || 'previous'} の回答を維持しました`);
            console.log('');

            // 保留中の回答をクリア
            pendingRetry = null;

            rl.prompt();
            return;
          }

          // /rewind のキャンセル
          if (pendingRewind) {
            console.log('');
            console.log('✅ 巻き戻しをキャンセルしました');
            console.log('');

            // 保留中の巻き戻しをクリア
            pendingRewind = null;

            rl.prompt();
            return;
          }

          // 保留中の操作がない場合は通常メッセージとして処理
        }

        // スラッシュコマンド処理
        if (userInput.startsWith('/')) {
          const parts = userInput.split(/\s+/);
          const command = parts[0].toLowerCase();
          const args = parts.slice(1);

          switch (command) {
            case '/help':
              console.log('');
              console.log('📖 コマンド一覧:');
              console.log('');
              console.log('  /retry          - 最後の質問を別のモデル・プリセットで再実行');
              console.log('  yes, y, /yes    - retry の回答を採用');
              console.log('  no, n, /no      - retry の回答を破棄');
              console.log('  /switch <model> - モデルを切り替え');
              console.log('  /models         - 利用可能なモデル一覧');
              console.log('  /current        - 現在のモデルを表示');
              console.log('  /history        - 現在の会話履歴を表示');
              console.log('  /rewind <番号>  - 指定した往復まで巻き戻し');
              console.log('  /help           - このヘルプを表示');
              console.log('  exit, quit      - チャットを終了');
              console.log('');
              rl.prompt();
              return;

            case '/current':
              console.log('');
              console.log(`📦 現在のモデル: ${selectedModel}`);
              console.log('');
              rl.prompt();
              return;

            case '/models':
              console.log('');
              console.log('📦 利用可能なモデル:');
              models.forEach((m) => {
                const current = m.name === selectedModel ? ' ⭐' : '';
                console.log(`  - ${m.name}${current}`);
              });
              console.log('');
              rl.prompt();
              return;

            case '/switch':
              if (args.length === 0) {
                console.log('');
                console.log('❌ モデル名を指定してください: /switch <model>');
                console.log('');
                rl.prompt();
                return;
              }

              const newModel = args[0];
              const modelExists = models.some((m) => m.name === newModel);
              if (!modelExists) {
                console.log('');
                console.log(`❌ モデル "${newModel}" が見つかりません`);
                console.log('');
                console.log('利用可能なモデル:');
                models.forEach((m) => console.log(`  - ${m.name}`));
                console.log('');
                rl.prompt();
                return;
              }

              // セッションがある場合は API 経由でモデル切り替え
              if (sessionId !== null) {
                try {
                  await switchModelApi(sessionId, newModel);
                } catch (error) {
                  console.log('');
                  console.error('❌ モデル切り替えに失敗しました:', error instanceof Error ? error.message : 'Unknown error');
                  console.log('');
                  rl.prompt();
                  return;
                }
              }

              selectedModel = newModel;
              saveLastUsedModel(selectedModel);
              console.log('');
              console.log(`✅ モデルを ${selectedModel} に切り替えました`);
              console.log('');
              rl.prompt();
              return;

            case '/retry':
              if (messages.length === 0) {
                console.log('');
                console.log('❌ 再実行する質問がありません');
                console.log('');
                rl.prompt();
                return;
              }

              // 最後のメッセージがアシスタントでない場合
              if (messages[messages.length - 1].role !== 'assistant') {
                console.log('');
                console.log('❌ 再実行する回答がありません');
                console.log('');
                rl.prompt();
                return;
              }

              // モデル × プリセットの組み合わせを生成
              const presets = await getParameterPresetsApi();
              retryModelPresetCombos = [];

              models.forEach((model) => {
                presets.forEach((preset) => {
                  retryModelPresetCombos.push({
                    model: model.name,
                    preset: preset,
                    displayName: `${model.name} (${preset.display_name})`
                  });
                });
              });

              console.log('');
              console.log('モデルとプリセットの組み合わせ:');
              console.log('');
              retryModelPresetCombos.forEach((combo, index) => {
                const isCurrent = combo.model === selectedModel;
                const prefix = isCurrent ? '⭐' : '  ';
                console.log(`${prefix} ${index + 1}. ${combo.displayName}`);
              });
              console.log('');
              console.log('組み合わせを選択してください (番号): ');

              // 組み合わせ選択待ち状態にする
              pendingRetryComboSelection = true;

              rl.prompt();
              return;

            case '/yes':
              // /retry の採用
              if (pendingRetry) {
                // 新しい回答を採用
                messages.push({
                  role: 'assistant',
                  content: pendingRetry.response,
                  model: pendingRetry.model,
                });

                console.log('');
                console.log(`✅ ${pendingRetry.model} の回答を採用しました`);
                console.log('');

                // 保留中の回答をクリア
                pendingRetry = null;

                rl.prompt();
                return;
              }

              // /rewind の実行
              if (pendingRewind) {
                let yesDeletedCount = 0;

                // セッションがある場合は API 経由で巻き戻し
                if (pendingRewind.sessionId !== null) {
                  try {
                    await rewindSessionApi(pendingRewind.sessionId, pendingRewind.turnNumber);
                    // 巻き戻し後、セッション詳細を再取得してメッセージを更新
                    const updatedSession = await getSessionDetail(pendingRewind.sessionId);
                    const yesKeepCount = pendingRewind.turnNumber * 2;
                    yesDeletedCount = messages.length - yesKeepCount;
                    messages = updatedSession.messages;
                  } catch (error) {
                    console.log('');
                    console.error('❌ 巻き戻しに失敗しました:', error instanceof Error ? error.message : 'Unknown error');
                    console.log('');
                    pendingRewind = null;
                    rl.prompt();
                    return;
                  }
                } else {
                  // 新規会話の場合は削除されるメッセージ数を計算
                  const yesKeepCount = pendingRewind.turnNumber * 2;
                  yesDeletedCount = messages.length - yesKeepCount;
                  // メモリ上の messages 配列を更新
                  messages = messages.slice(0, yesKeepCount);
                }

                console.log('');
                console.log(`✅ 会話 #${pendingRewind.turnNumber} まで巻き戻しました`);
                console.log(`削除されたメッセージ: ${yesDeletedCount}件`);
                console.log('');

                // 保留中の巻き戻しをクリア
                pendingRewind = null;

                rl.prompt();
                return;
              }

              console.log('');
              console.log('❌ 実行する操作がありません');
              console.log('');
              rl.prompt();
              return;

            case '/no':
              // /retry のキャンセル
              if (pendingRetry) {
                // 前の回答を復元
                messages.push(pendingRetry.previousResponse);

                console.log('');
                console.log(`✅ ${pendingRetry.previousResponse.model || 'previous'} の回答を維持しました`);
                console.log('');

                // 保留中の回答をクリア
                pendingRetry = null;

                rl.prompt();
                return;
              }

              // /rewind のキャンセル
              if (pendingRewind) {
                console.log('');
                console.log('✅ 巻き戻しをキャンセルしました');
                console.log('');

                // 保留中の巻き戻しをクリア
                pendingRewind = null;

                rl.prompt();
                return;
              }

              console.log('');
              console.log('❌ キャンセルする操作がありません');
              console.log('');
              rl.prompt();
              return;

            case '/history':
              console.log('');
              console.log('📜 現在の会話履歴:');
              console.log('');

              // 往復単位でメッセージを表示（メモリから往復を作成）
              const historyTurns = [];
              for (let i = 0; i < messages.length; i += 2) {
                if (i + 1 < messages.length && messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
                  historyTurns.push({
                    turnNumber: Math.floor(i / 2) + 1,
                    user: messages[i],
                    assistant: messages[i + 1],
                  });
                }
              }

              if (historyTurns.length === 0) {
                console.log('  会話履歴がありません');
              } else {
                historyTurns.forEach((turn) => {
                  console.log(`[${turn.turnNumber}] You: ${turn.user.content}`);
                  const aiModel = turn.assistant.model || selectedModel;
                  const aiPreview = turn.assistant.content.length > 50
                    ? turn.assistant.content.substring(0, 50) + '...'
                    : turn.assistant.content;
                  console.log(`    AI (${aiModel}): ${aiPreview}`);
                  console.log('');
                });
              }

              console.log(`合計: ${historyTurns.length} 往復`);
              console.log('');

              rl.prompt();
              return;

            case '/rewind':
              if (args.length === 0) {
                console.log('');
                console.log('❌ 巻き戻す往復番号を指定してください: /rewind <番号>');
                console.log('');
                rl.prompt();
                return;
              }

              const rewindTurn = parseInt(args[0], 10);
              if (isNaN(rewindTurn) || rewindTurn < 1) {
                console.log('');
                console.log('❌ 有効な往復番号を指定してください');
                console.log('');
                rl.prompt();
                return;
              }

              // 現在の往復数を取得（メモリから往復を作成）
              const rewindCurrentTurns = [];
              for (let i = 0; i < messages.length; i += 2) {
                if (i + 1 < messages.length && messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
                  rewindCurrentTurns.push({
                    turnNumber: Math.floor(i / 2) + 1,
                    user: messages[i],
                    assistant: messages[i + 1],
                  });
                }
              }

              if (rewindTurn >= rewindCurrentTurns.length) {
                console.log('');
                console.log(`❌ 往復 #${rewindTurn} は存在しません（現在: ${rewindCurrentTurns.length} 往復）`);
                console.log('');
                rl.prompt();
                return;
              }

              // 削除される往復数を計算
              const deletedTurns = rewindCurrentTurns.length - rewindTurn;

              console.log('');
              console.log(`⏪ 会話 #${rewindTurn} まで巻き戻します`);
              console.log(`削除される往復: #${rewindTurn + 1}〜#${rewindCurrentTurns.length} (${deletedTurns}往復)`);
              console.log('');
              console.log('この操作を実行しますか？');
              console.log('  yes, y - 巻き戻しを実行');
              console.log('  no, n  - キャンセル');
              console.log('');

              // 巻き戻し情報を保存
              pendingRewind = { sessionId, turnNumber: rewindTurn };

              rl.prompt();
              return;

            default:
              console.log('');
              console.log(`❌ 不明なコマンド: ${command}`);
              console.log('ヘルプを表示するには /help と入力してください');
              console.log('');
              rl.prompt();
              return;
          }
        }

        // 通常のメッセージ処理
        // もし組み合わせ選択待ち状態の場合は、キャンセル
        if (pendingRetryComboSelection) {
          console.log('');
          console.log('ℹ️  選択をキャンセルしました');
          console.log('');
          pendingRetryComboSelection = false;
        }

        // もし保留中の回答がある場合は、元の回答を復元
        if (pendingRetry) {
          messages.push(pendingRetry.previousResponse);
          console.log('');
          console.log(`ℹ️  保留中の回答を破棄し、${pendingRetry.previousResponse.model || 'previous'} の回答を維持しました`);
          console.log('');
          pendingRetry = null;
        }

        // もし保留中の巻き戻しがある場合は、キャンセル
        if (pendingRewind) {
          console.log('');
          console.log('ℹ️  巻き戻しをキャンセルしました');
          console.log('');
          pendingRewind = null;
        }

        // AI の応答を取得（API経由）
        console.log('');
        const spinner = showSpinner();

        let fullResponse = '';
        let isFirstChunk = true;

        try {
          // API経由でメッセージ送信（ストリーミング）
          const messageGenerator = sendMessageStream(
            userInput,
            sessionId || undefined,
            selectedModel,
            undefined, // presetId
            messages
          );

          let previousLength = 0;
          let result;

          // 手動でイテレーションして return 値を取得
          while (true) {
            result = await messageGenerator.next();
            if (result.done) {
              // ジェネレーター完了時に return 値を取得
              if (result.value) {
                sessionId = result.value.sessionId;
                fullResponse = result.value.fullContent;
              }
              break;
            }

            // yield された値を処理
            const chunk = result.value;
            if (isFirstChunk) {
              stopSpinner(spinner);
              process.stdout.write(`AI (${selectedModel}): `);
              isFirstChunk = false;
            }
            fullResponse = chunk;
            // chunk は累積コンテンツなので、差分だけを出力
            const newContent = chunk.substring(previousLength);
            process.stdout.write(newContent);
            previousLength = chunk.length;
          }

          // ユーザーメッセージとアシスタントの応答を履歴に追加
          messages.push({
            role: 'user',
            content: userInput,
          });
          messages.push({
            role: 'assistant',
            content: fullResponse,
            model: selectedModel,
          });

          process.stdout.write('\n\n');
        } catch (error) {
          stopSpinner(spinner);
          console.error('\n');
          console.error('❌ エラー:', error instanceof Error ? error.message : '予期しないエラーが発生しました');
          console.log('');
        }

        rl.prompt();
      });

      rl.on('close', () => {
        console.log('');

        // API クライアント版では、メッセージは API 経由で送信時に自動保存されるため、
        // ここでの明示的な保存は不要
        if (sessionId !== null) {
          console.log(`💾 会話は自動保存されています (ID: ${sessionId})`);
        }

        console.log('👋 チャットを終了します');
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ エラー:', error instanceof Error ? error.message : '予期しないエラーが発生しました');
      process.exit(1);
    }
  });

// compare コマンド（後で実装）
program
  .command('compare')
  .description('複数のLLMで比較実行')
  .argument('<query>', '比較するクエリ')
  .option('-m, --models <models...>', '比較するモデル（複数指定可能）')
  .action((query, options) => {
    console.log('📊 Compare モードを起動します...');
    console.log('クエリ:', query);
    console.log('モデル:', options.models || '全モデル');
    console.log('');
    console.log('⚠️  このコマンドは開発中です');
  });

// config コマンド（後で実装）
program
  .command('config')
  .description('設定を管理')
  .option('--list', '現在の設定を表示')
  .option('--set <key=value>', '設定値を変更')
  .action((options) => {
    console.log('⚙️  Config モードを起動します...');
    console.log('');
    console.log('⚠️  このコマンドは開発中です');
  });

// モデル一覧表示の共通処理（API クライアント版）
async function showModelList() {
  try {
    console.log('📦 利用可能なモデル:');
    console.log('');

    const { listModelsApi, getSystemSpecApi, getRecommendedModelsApi } = await import('./utils/models-client.js');

    // モデル一覧を取得（API経由）
    const models = await listModelsApi();

    if (models.length === 0) {
      console.log('⚠️  インストール済みのモデルがありません');
      console.log('');
      console.log('🎉 Llamune へようこそ！');
      console.log('');

      // システムスペックを取得して表示（API経由）
      const specData = await getSystemSpecApi();
      displaySystemSpec(specData.spec);

      // 推奨モデルを表示（API経由）
      const recommendedData = await getRecommendedModelsApi();
      displayRecommendedModels(recommendedData.recommended);

      return;
    }

    // モデル一覧を表示
    models.forEach((model) => {
      const params = formatParams(model);
      const size = formatSize(model.size);
      console.log(`  ✓ ${model.name.padEnd(20)} (${params}, ${size})`);
    });

    console.log('');
    console.log(`合計: ${models.length} モデル`);
  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// ls コマンド
program.command('ls').description('利用可能なモデル一覧を表示').action(showModelList);

// models コマンド（後方互換性のためのエイリアス）
program.command('models', { hidden: true }).action(showModelList);

// pull コマンド（ollama CLI へのリダイレクト）
program
  .command('pull')
  .description('モデルをダウンロード')
  .argument('[model]', 'モデル名（例: gemma2:9b）')
  .action(async (modelName?: string) => {
    try {
      const { getSystemSpecApi, getRecommendedModelsApi } = await import('./utils/models-client.js');

      // モデル名が指定されていない場合は推奨モデルを表示
      if (!modelName) {
        console.log('📥 モデルをダウンロードします');
        console.log('');

        const specData = await getSystemSpecApi();
        displaySystemSpec(specData.spec);

        const recommendedData = await getRecommendedModelsApi();
        console.log('🎯 推奨モデル:');
        console.log('');
        recommendedData.recommended.forEach((model: any, index: number) => {
          const badge = index === 0 ? '⭐' : '  ';
          console.log(`${badge} ${model.name} - ${model.description}`);
        });
        console.log('');
        console.log('⚠️  モデルのダウンロードは ollama コマンドを直接使用してください:');
        console.log('');
        console.log(`  ollama pull ${recommendedData.recommended[0].name}`);
        console.log('');
        return;
      }

      // モデル名が指定されている場合は ollama pull を案内
      console.log('⚠️  モデルのダウンロードは ollama コマンドを直接使用してください:');
      console.log('');
      console.log(`  ollama pull ${modelName}`);
      console.log('');
      console.log('ダウンロード後、以下のコマンドで確認できます:');
      console.log('  llamune ls');
      console.log('  llmn ls');
    } catch (error) {
      console.error('❌ エラー:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// rm コマンド（API クライアント版）
program
  .command('rm')
  .description('モデルを削除')
  .argument('<model>', 'モデル名（例: gemma2:9b）')
  .action(async (modelName: string) => {
    try {
      const { deleteModelApi } = await import('./utils/models-client.js');

      console.log(`🗑️  ${modelName} を削除しています...`);
      console.log('');

      // モデルを削除（API経由）
      await deleteModelApi(modelName);

      console.log(`✅ ${modelName} を削除しました`);
      console.log('');
      console.log('残りのモデルを確認:');
      console.log('  llamune ls');
      console.log('  llmn ls');
    } catch (error) {
      console.error('❌ エラー:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// history コマンド（API クライアント版）
program
  .command('history [action] [sessionId] [title]')
  .description('会話履歴を表示・編集・削除')
  .option('-n, --limit <number>', '表示する履歴数', '10')
  .action(async (action, sessionId, title, options) => {
    try {
      const { getSessionsList, getSessionDetail, deleteSessionApi, updateSessionTitleApi } = await import('./utils/chat-client.js');

      // show サブコマンドの処理
      if (action === 'show') {
        if (!sessionId) {
          console.error('❌ 使い方: llmn history show <session_id>');
          console.error('例: llmn history show 5');
          process.exit(1);
        }

        const id = parseInt(sessionId, 10);
        if (isNaN(id)) {
          console.error('❌ セッションIDは数値で指定してください');
          process.exit(1);
        }

        try {
          const sessionData = await getSessionDetail(id);
          const session = sessionData.session;
          const messages = sessionData.messages;

          console.log('');
          console.log('📜 会話詳細:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`  ID: ${session.id}`);
          console.log(`  タイトル: ${session.title || '(タイトルなし)'}`);
          console.log(`  モデル: ${session.model}`);
          console.log(`  作成日時: ${new Date(session.created_at).toLocaleString('ja-JP')}`);
          console.log(`  メッセージ数: ${session.message_count}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');

          // メッセージを表示
          if (messages.length === 0) {
            console.log('  メッセージがありません');
            console.log('');
          } else {
            messages.forEach((msg) => {
              if (msg.role === 'user') {
                console.log(`👤 You:`);
                console.log(`${msg.content}`);
                console.log('');
              } else if (msg.role === 'assistant') {
                const modelName = msg.model || session.model;
                console.log(`🤖 AI (${modelName}):`);
                console.log(`${msg.content}`);
                console.log('');
              }
            });
          }

          console.log('💡 この会話を再開するには:');
          console.log(`  llmn chat --continue ${id}`);
          console.log('');
        } catch (error) {
          console.error(`❌ セッション ${id} の取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
        return;
      }

      // edit サブコマンドの処理
      if (action === 'edit') {
        if (!sessionId || !title) {
          console.error('❌ 使い方: llmn history edit <session_id> <new_title>');
          console.error('例: llmn history edit 5 "新しいタイトル"');
          process.exit(1);
        }

        const id = parseInt(sessionId, 10);
        if (isNaN(id)) {
          console.error('❌ セッションIDは数値で指定してください');
          process.exit(1);
        }

        try {
          await updateSessionTitleApi(id, title);
          console.log(`✅ セッション ${id} のタイトルを更新しました`);
          console.log(`   新しいタイトル: ${title}`);
        } catch (error) {
          console.error(`❌ セッション ${id} の更新に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
        return;
      }

      // delete サブコマンドの処理
      if (action === 'delete') {
        if (!sessionId) {
          console.error('❌ 使い方: llmn history delete <session_id>');
          console.error('例: llmn history delete 5');
          process.exit(1);
        }

        const id = parseInt(sessionId, 10);
        if (isNaN(id)) {
          console.error('❌ セッションIDは数値で指定してください');
          process.exit(1);
        }

        try {
          await deleteSessionApi(id);
          console.log(`✅ セッション ${id} を削除しました`);
        } catch (error) {
          console.error(`❌ セッション ${id} の削除に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
        return;
      }

      // セッション一覧表示
      const sessions = await getSessionsList();

      if (sessions.length === 0) {
        console.log('📜 会話履歴がありません');
        console.log('');
        console.log('チャットを開始して会話を保存しましょう:');
        console.log('  llamune chat');
        console.log('  llmn chat');
        return;
      }

      console.log('📜 会話履歴:');
      console.log('');

      const limit = parseInt(options.limit, 10);
      const displaySessions = sessions.slice(0, limit);

      displaySessions.forEach((session: any) => {
        const date = new Date(session.created_at);
        const formattedDate = date.toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        // タイトルを表示（なければ「(タイトルなし)」と会話の冒頭を表示）
        let displayTitle = session.title;
        if (!displayTitle) {
          const preview = session.preview ? session.preview.substring(0, 30) : '';
          displayTitle = `(タイトルなし) ${preview}${preview.length === 30 ? '...' : ''}`;
        }

        console.log(`  ID: ${session.id}`);
        console.log(`  日時: ${formattedDate}`);
        console.log(`  モデル: ${session.model}`);
        console.log(`  メッセージ数: ${session.message_count}`);
        console.log(`  タイトル: ${displayTitle}`);
        console.log('');
      });

      console.log(`合計: ${displaySessions.length} 件の会話`);
      console.log('');
      console.log('💡 使い方:');
      console.log('  会話の詳細を表示: llmn history show <ID>');
      console.log('  会話を再開: llmn chat --continue <ID>');
      console.log('  タイトル編集: llmn history edit <ID> <新しいタイトル>');
      console.log('  会話を削除: llmn history delete <ID>');
      console.log('');
      console.log('例: llmn history show 1');
    } catch (error) {
      console.error('❌ 履歴の取得に失敗しました');
      console.error(error);
      process.exit(1);
    }
  });

// recommend コマンド（API クライアント版）
program
  .command('recommend')
  .description('推奨モデルを表示')
  .action(async () => {
    try {
      const { getSystemSpecApi, getRecommendedModelsApi } = await import('./utils/models-client.js');

      console.log('🎯 推奨モデル');
      console.log('');

      // システムスペックを取得（API経由）
      const specData = await getSystemSpecApi();
      displaySystemSpec(specData.spec);

      // 推奨モデルを表示（API経由）
      const recommendedData = await getRecommendedModelsApi();
      displayRecommendedModels(recommendedData.recommended);
    } catch (error) {
      console.error('❌ 推奨モデルの取得に失敗しました:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// ========================================
// 認証コマンド
// ========================================

// register コマンド
program
  .command('register')
  .description('ユーザー登録')
  .action(async () => {
    await registerCommand();
  });

// login コマンド
program
  .command('login')
  .description('ログイン')
  .action(async () => {
    await loginCommand();
  });

// logout コマンド
program
  .command('logout')
  .description('ログアウト')
  .action(async () => {
    await logoutCommand();
  });

// whoami コマンド
program
  .command('whoami')
  .description('現在のユーザー情報を表示')
  .action(async () => {
    await whoamiCommand();
  });

// コマンドをパース
program.parse(process.argv);
