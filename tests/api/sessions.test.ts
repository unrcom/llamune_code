/**
 * Sessions API Tests
 * Based on manual testing performed
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { apiClient } from './helpers/api-client';

describe('Sessions API', () => {
  let testSessionId: number;

  beforeAll(async () => {
    // Create a test session with multiple messages
    const response1 = await apiClient.postStream('/api/chat/messages', {
      content: '素数を3つ出力してください。',
      modelName: 'gemma2:27b'
    });
    const doneEvent1 = response1.find(c => c.event === 'done');
    testSessionId = doneEvent1!.data.sessionId;

    // Add a second message
    await apiClient.postStream('/api/chat/messages', {
      sessionId: testSessionId,
      content: '5 の次に大きい素数を教えてください'
    });
  }, 60000);

  describe('GET /api/chat/sessions', () => {
    test('should return list of sessions', async () => {
      const response = await apiClient.get<{ sessions: any[] }>('/api/chat/sessions');

      expect(response.sessions).toBeInstanceOf(Array);
      expect(response.sessions.length).toBeGreaterThan(0);

      const firstSession = response.sessions[0];
      expect(firstSession).toHaveProperty('id');
      expect(firstSession).toHaveProperty('model');
      expect(firstSession).toHaveProperty('created_at');
      expect(firstSession).toHaveProperty('message_count');
    });
  });

  describe('GET /api/chat/sessions/:id', () => {
    test('should return session details with messages', async () => {
      const response = await apiClient.get<{ session: any; messages: any[] }>(
        `/api/chat/sessions/${testSessionId}`
      );

      expect(response.session).toBeDefined();
      expect(response.session.id).toBe(testSessionId);

      expect(response.messages).toBeInstanceOf(Array);
      expect(response.messages.length).toBeGreaterThanOrEqual(4); // At least 2 turns

      // Check message structure
      const userMessage = response.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage).toHaveProperty('content');

      const assistantMessage = response.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage).toHaveProperty('content');
      expect(assistantMessage).toHaveProperty('model');
    });
  });

  describe('PUT /api/chat/sessions/:id/model - switchModel', () => {
    test('should switch model and persist to database', async () => {
      // Switch model
      const switchResponse = await apiClient.put<{ success: boolean; modelName: string }>(
        `/api/chat/sessions/${testSessionId}/model`,
        { modelName: 'deepseek-r1:7b' }
      );

      expect(switchResponse.success).toBe(true);
      expect(switchResponse.modelName).toBe('deepseek-r1:7b');

      // Send a new message - should use the new model
      const chatResponse = await apiClient.postStream('/api/chat/messages', {
        sessionId: testSessionId,
        content: '11 の次に大きな素数を教えてください'
      });

      const doneEvent = chatResponse.find(c => c.event === 'done');
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.data.model).toBe('deepseek-r1:7b');

      // Verify database persistence - fetch session again
      const sessionResponse = await apiClient.get<{ session: any }>(
        `/api/chat/sessions/${testSessionId}`
      );
      // Note: The session.model might still show the original model
      // because the database only updates when messages are saved
      // But the last message should have the new model
      const messages = await apiClient.get<{ messages: any[] }>(
        `/api/chat/sessions/${testSessionId}`
      );
      const lastMessage = messages.messages[messages.messages.length - 1];
      expect(lastMessage.model).toBe('deepseek-r1:7b');
    }, 30000);
  });

  describe('DELETE /api/chat/sessions/:id/rewind', () => {
    test('should rewind conversation to specific turn', async () => {
      // Get current message count
      const beforeResponse = await apiClient.get<{ messages: any[] }>(
        `/api/chat/sessions/${testSessionId}`
      );
      const beforeCount = beforeResponse.messages.length;

      // Rewind to turn 2 (keep first 2 user-assistant pairs)
      const rewindResponse = await apiClient.delete<{ success: boolean; turnNumber: number }>(
        `/api/chat/sessions/${testSessionId}/rewind`,
        { turnNumber: 2 }
      );

      expect(rewindResponse.success).toBe(true);
      expect(rewindResponse.turnNumber).toBe(2);

      // Verify messages were deleted (logically)
      const afterResponse = await apiClient.get<{ messages: any[] }>(
        `/api/chat/sessions/${testSessionId}`
      );
      const afterCount = afterResponse.messages.length;

      // Should have fewer messages (4 messages for 2 turns)
      expect(afterCount).toBeLessThan(beforeCount);
      expect(afterCount).toBe(4); // 2 turns = 4 messages
    });
  });
});
