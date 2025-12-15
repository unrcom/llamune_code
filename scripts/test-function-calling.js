#!/usr/bin/env node

/**
 * Function Calling テストスクリプト (Node.js版)
 * 
 * 目的: 各LLMモデルがFunction Callingをサポートしているか確認
 * テスト対象:
 *  1. gpt-oss:20b
 *  2. qwen2.5-coder:7b
 *  3. mistral-nemo:12b
 *  4. deepseek-r1:7b
 *  5. qwen2.5:14b
 *  6. gemma2:27b
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';

// テスト用のツール定義
const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'ファイルの内容を読み取ります',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'ファイルパス（例: src/index.ts）',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: '指定されたディレクトリのファイル一覧を取得します',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'ディレクトリパス（例: src）',
          },
        },
        required: ['directory'],
      },
    },
  },
];

// テスト対象のモデルリスト
const testModels = [
  'gpt-oss:20b',
  'qwen2.5-coder:7b',
  'mistral-nemo:12b',
  'deepseek-r1:7b',
  'qwen2.5:14b',
  'gemma2:27b',
];

/**
 * Ollamaに Function Calling リクエストを送信
 */
async function testFunctionCalling(modelName) {
  const requestBody = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: 'src/index.ts ファイルの内容を読み取ってください',
      },
    ],
    tools: tools,
    stream: false,
  };

  try {
    console.log(`\n🧪 Testing ${modelName}...`);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ HTTP Error: ${response.status}`);
      console.error(`   Response: ${errorText}`);
      return false;
    }

    const data = await response.json();
    
    // ツール呼び出しがあるかチェック
    if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
      console.log(`   ✅ SUCCESS: Function calling is supported!`);
      console.log(`   Tool called: ${data.message.tool_calls[0].function.name}`);
      console.log(`   Arguments:`, data.message.tool_calls[0].function.arguments);
      return true;
    } else {
      console.log(`   ⚠️  FAILED: No tool calls detected`);
      console.log(`   Response content:`, data.message?.content?.substring(0, 150));
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * 利用可能なモデルを取得
 */
async function getAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const data = await response.json();
    return data.models?.map(m => m.name) || [];
  } catch (error) {
    console.error('Failed to fetch models:', error.message);
    return [];
  }
}

/**
 * sleep関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 Function Calling Test Started');
  console.log('=====================================');
  
  // 利用可能なモデルを取得
  const availableModels = await getAvailableModels();
  console.log(`\n📦 Available models in Ollama:`);
  availableModels.forEach(m => console.log(`   - ${m}`));

  const results = [];

  // 各モデルをテスト
  for (const model of testModels) {
    if (!availableModels.includes(model)) {
      console.log(`\n⏭️  Skipping ${model} (not installed)`);
      continue;
    }

    const supported = await testFunctionCalling(model);
    results.push({ model, supported });
    
    // 次のテストまで少し待機
    await sleep(1000);
  }

  // 結果サマリー
  console.log('\n\n=====================================');
  console.log('📊 Test Results Summary');
  console.log('=====================================');
  
  const supportedModels = results.filter(r => r.supported);
  const unsupportedModels = results.filter(r => !r.supported);

  if (supportedModels.length > 0) {
    console.log('\n✅ Supported Models:');
    supportedModels.forEach(r => console.log(`   - ${r.model}`));
  }

  if (unsupportedModels.length > 0) {
    console.log('\n❌ Unsupported Models:');
    unsupportedModels.forEach(r => console.log(`   - ${r.model}`));
  }

  if (supportedModels.length === 0) {
    console.log('\n⚠️  WARNING: No models support Function Calling');
    console.log('   Please install one of the recommended models:');
    testModels.forEach(m => console.log(`   - ollama pull ${m}`));
  } else {
    console.log(`\n🎉 ${supportedModels.length} model(s) ready for implementation!`);
    console.log(`   Recommended for use: ${supportedModels[0].model}`);
  }
}

// 実行
main().catch(console.error);
