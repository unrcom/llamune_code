/**
 * Models API Tests
 * Based on manual testing performed
 */

import { describe, test, expect } from 'vitest';
import { apiClient } from './helpers/api-client';

describe('Models API', () => {
  describe('GET /api/models', () => {
    test('should return list of installed models', async () => {
      const response = await apiClient.get<{ models: any[] }>('/api/models');

      expect(response.models).toBeInstanceOf(Array);
      expect(response.models.length).toBeGreaterThan(0);

      // Check model structure
      const firstModel = response.models[0];
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('size');
      expect(firstModel).toHaveProperty('modified_at');
      expect(firstModel).toHaveProperty('details');
    });

    test('should include model details with parameter_size', async () => {
      const response = await apiClient.get<{ models: any[] }>('/api/models');

      const modelWithDetails = response.models.find(m => m.details?.parameter_size);
      expect(modelWithDetails).toBeDefined();
      expect(modelWithDetails.details.parameter_size).toMatch(/\d+\.?\d*[BM]/);
    });
  });

  describe('GET /api/models/recommended', () => {
    test('should return system spec and recommended models', async () => {
      const response = await apiClient.get<{ spec: any; recommended: any[] }>('/api/models/recommended');

      expect(response.spec).toBeDefined();
      expect(response.spec).toHaveProperty('totalMemoryGB');
      expect(response.spec).toHaveProperty('cpuCores');

      expect(response.recommended).toBeInstanceOf(Array);
      expect(response.recommended.length).toBeGreaterThan(0);

      const firstRecommended = response.recommended[0];
      expect(firstRecommended).toHaveProperty('name');
      expect(firstRecommended).toHaveProperty('description');
      expect(firstRecommended).toHaveProperty('priority');
    });
  });

  describe('POST /api/models/pull and DELETE /api/models', () => {
    const testModelName = 'qwen2.5:0.5b';

    test('should download a small model', async () => {
      const response = await apiClient.post<{ success: boolean; modelName: string }>('/api/models/pull', {
        modelName: testModelName
      });

      expect(response.success).toBe(true);
      expect(response.modelName).toBe(testModelName);

      // Verify model appears in list
      const modelsResponse = await apiClient.get<{ models: any[] }>('/api/models');
      const downloadedModel = modelsResponse.models.find(m => m.name === testModelName);
      expect(downloadedModel).toBeDefined();
    }, 60000); // Increase timeout for download

    test('should delete the downloaded model', async () => {
      const response = await apiClient.delete<{ success: boolean; modelName: string }>('/api/models', {
        modelName: testModelName
      });

      expect(response.success).toBe(true);
      expect(response.modelName).toBe(testModelName);

      // Verify model is removed from list
      const modelsResponse = await apiClient.get<{ models: any[] }>('/api/models');
      const deletedModel = modelsResponse.models.find(m => m.name === testModelName);
      expect(deletedModel).toBeUndefined();
    });
  });
});
