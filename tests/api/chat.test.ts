/**
 * Chat API Tests
 * Based on manual testing performed
 */

import { describe, test, expect } from 'vitest';
import { apiClient } from './helpers/api-client';

describe('Chat API', () => {
  let testSessionId: number;

  describe('POST /api/chat/messages - New chat', () => {
    test('should start a new chat and return streaming response', async () => {
      const chunks = await apiClient.postStream('/api/chat/messages', {
        content: '素数を3つ出力してください。',
        modelName: 'gemma2:27b'
      });

      expect(chunks.length).toBeGreaterThan(0);

      // Check streaming chunks are cumulative
      const dataChunks = chunks.filter(c => !c.event || c.event !== 'done');
      expect(dataChunks.length).toBeGreaterThan(0);

      // Verify cumulative content (each chunk should contain previous content)
      for (let i = 1; i < dataChunks.length; i++) {
        const prevContent = dataChunks[i - 1].data.content;
        const currentContent = dataChunks[i].data.content;
        expect(currentContent.startsWith(prevContent)).toBe(true);
      }

      // Check done event
      const doneEvent = chunks.find(c => c.event === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.data).toHaveProperty('sessionId');
      expect(doneEvent!.data).toHaveProperty('fullContent');
      expect(doneEvent!.data).toHaveProperty('model');
      expect(doneEvent!.data.model).toBe('gemma2:27b');

      // Save session ID for next tests
      testSessionId = doneEvent!.data.sessionId;

      // Verify response contains expected numbers
      const fullContent = doneEvent!.data.fullContent;
      expect(fullContent).toMatch(/2/);
      expect(fullContent).toMatch(/3/);
      expect(fullContent).toMatch(/5/);
    }, 30000);
  });

  describe('POST /api/chat/messages - Continue session', () => {
    test('should continue previous chat session', async () => {
      const chunks = await apiClient.postStream('/api/chat/messages', {
        sessionId: testSessionId,
        content: '5 の次に大きい素数を教えてください'
      });

      const doneEvent = chunks.find(c => c.event === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.data.sessionId).toBe(testSessionId);

      // Should mention 7 as it's the next prime after 5
      const fullContent = doneEvent!.data.fullContent;
      expect(fullContent).toMatch(/7/);
    }, 30000);
  });

  describe('POST /api/chat/retry', () => {
    test('should retry with different model', async () => {
      const chunks = await apiClient.postStream('/api/chat/retry', {
        sessionId: testSessionId,
        modelName: 'qwen2.5:14b'
      });

      const doneEvent = chunks.find(c => c.event === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.data.sessionId).toBe(testSessionId);
      expect(doneEvent!.data.model).toBe('qwen2.5:14b');

      // Should still answer about prime after 5
      const fullContent = doneEvent!.data.fullContent;
      expect(fullContent).toMatch(/7/);
    }, 30000);
  });

  describe('SSE Streaming behavior', () => {
    test('should return cumulative content in each chunk', async () => {
      const chunks = await apiClient.postStream('/api/chat/messages', {
        content: 'こんにちは',
        modelName: 'gemma2:27b'
      });

      const dataChunks = chunks.filter(c => !c.event || c.event !== 'done');

      // Verify each chunk contains cumulative content
      let previousLength = 0;
      for (const chunk of dataChunks) {
        const currentLength = chunk.data.content.length;
        expect(currentLength).toBeGreaterThanOrEqual(previousLength);
        previousLength = currentLength;
      }

      // Final content should be in done event
      const doneEvent = chunks.find(c => c.event === 'done');
      expect(doneEvent).toBeDefined();
      const finalContent = doneEvent!.data.fullContent;

      // Last data chunk should match final content
      if (dataChunks.length > 0) {
        const lastDataChunk = dataChunks[dataChunks.length - 1];
        expect(lastDataChunk.data.content).toBe(finalContent);
      }
    }, 30000);
  });
});
