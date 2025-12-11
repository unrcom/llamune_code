import { Router, Request, Response } from 'express';
import { ChatSession } from '../../core/chat-session.js';
import {
  getAllSessions,
  getSession,
  deleteSession,
  updateSessionTitle,
  getDomainPromptById,
} from '../../utils/database.js';
import type {
  ApiError,
  ChatMessagesRequest,
  ChatRetryRequest,
  RewindRequest,
  SwitchModelRequest,
  SessionsResponse,
  SessionDetailResponse,
  ChatChunkResponse,
  ChatDoneResponse
} from '../types.js';

const router = Router();

/**
 * POST /api/chat/messages - メッセージ送信（ストリーミング）
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId, content, modelName, presetId, history, domainPromptId } = req.body as ChatMessagesRequest;

    if (!content || content.trim() === '') {
      const error: ApiError = {
        error: 'content is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ドメインプロンプトIDが指定されている場合、検証してsystem_promptを取得
    let systemPrompt: string | undefined;
    if (domainPromptId) {
      const domainPrompt = getDomainPromptById(domainPromptId);
      if (!domainPrompt) {
        const error: ApiError = {
          error: 'Invalid domain prompt ID',
          code: 'INVALID_DOMAIN_PROMPT',
          statusCode: 400,
        };
        res.status(400).json(error);
        return;
      }
      // system_promptを取得（nullの場合はundefined）
      systemPrompt = domainPrompt.system_prompt || undefined;
    }

    // セッションを作成または復元
    const userId = req.user?.userId;
    let session: ChatSession;
    if (sessionId) {
      // 既存セッションの所有者チェック
      const existing = ChatSession.fromSessionId(sessionId, userId);
      if (!existing) {
        const error: ApiError = {
          error: 'Session not found or access denied',
          code: 'NOT_FOUND',
          statusCode: 404,
        };
        res.status(404).json(error);
        return;
      }
      session = existing;

    } else {
      // リポジトリが指定されている場合は設定
      const model = modelName || 'gemma2:9b';
      session = new ChatSession(
        model,
        null,
        history,
        undefined,
        userId,
        systemPrompt,
      );
    }

    // SSEヘッダーを設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullContent = '';

    try {
      // ストリーミングでメッセージを送信
      const generator = session.sendMessage(content);
      for await (const chunk of generator) {
        fullContent = chunk;
        const data: ChatChunkResponse = { content: chunk };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      // セッションを保存
      const newSessionId = session.save();

      // 完了イベントを送信
      const doneData: ChatDoneResponse = {
        sessionId: newSessionId,
        fullContent,
        model: session.getModel(),
      };
      res.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`);
      res.end();
    } catch (error) {
      const errorData: ApiError = {
        error: error instanceof Error ? error.message : 'Stream error',
        code: 'STREAM_ERROR',
        statusCode: 500,
      };
      res.write(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      const apiError: ApiError = {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      };
      res.status(500).json(apiError);
    }
  }
});

/**
 * POST /api/chat/retry - 再実行
 */
router.post('/retry', async (req: Request, res: Response) => {
  try {
    const { sessionId, modelName, presetId, history } = req.body as ChatRetryRequest;

    if (!modelName) {
      const error: ApiError = {
        error: 'modelName is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // セッションを復元
    const userId = req.user?.userId;
    let session: ChatSession;
    if (sessionId) {
      // 既存セッションの所有者チェック
      const existing = ChatSession.fromSessionId(sessionId, userId);
      if (!existing) {
        const error: ApiError = {
          error: 'Session not found or access denied',
          code: 'NOT_FOUND',
          statusCode: 404,
        };
        res.status(404).json(error);
        return;
      }
      session = existing;
    } else {
      // historyから新規セッション作成
      if (!history || history.length === 0) {
        const error: ApiError = {
          error: 'sessionId or history is required',
          code: 'INVALID_REQUEST',
          statusCode: 400,
        };
        res.status(400).json(error);
        return;
      }
      session = new ChatSession(modelName, null, history, undefined, userId);
    }

    // SSEヘッダーを設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullContent = '';

    try {
      // リトライ実行
      const generator = session.retry(modelName, presetId);
      for await (const chunk of generator) {
        fullContent = chunk;
        const data: ChatChunkResponse = { content: chunk };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }

      // セッションを保存（retry後なので isRetry=true）
      const newSessionId = session.save(true);

      // 完了イベントを送信
      const doneData: ChatDoneResponse = {
        sessionId: newSessionId,
        fullContent,
        model: session.getModel(),
      };
      res.write(`event: done\ndata: ${JSON.stringify(doneData)}\n\n`);
      res.end();
    } catch (error) {
      const errorData: ApiError = {
        error: error instanceof Error ? error.message : 'Retry error',
        code: 'RETRY_ERROR',
        statusCode: 500,
      };
      res.write(`event: error\ndata: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      const apiError: ApiError = {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      };
      res.status(500).json(apiError);
    }
  }
});

/**
 * GET /api/chat/sessions - セッション一覧
 */
router.get('/sessions', (req: Request, res: Response) => {
  try {
    // ログインユーザーのセッションのみ取得
    const userId = req.user?.userId;
    const sessions = getAllSessions(userId);
    const response: SessionsResponse = {
      sessions: sessions.map((s) => ({
        id: s.id,
        model: s.model,
        created_at: s.created_at,
        message_count: s.message_count,
        preview: s.preview,
        title: s.title,
      })),
    };
    res.json(response);
  } catch (error) {
    const apiError: ApiError = {
      error: 'Failed to fetch sessions',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * GET /api/chat/sessions/:id - セッション詳細
 */
router.get('/sessions/:id', (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      const error: ApiError = {
        error: 'Invalid session ID',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ログインユーザーのセッションのみ取得（所有者チェック）
    const userId = req.user?.userId;
    const sessionData = getSession(sessionId, userId);
    if (!sessionData) {
      const error: ApiError = {
        error: 'Session not found or access denied',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const response: SessionDetailResponse = {
      session: sessionData.session,
      messages: sessionData.messages,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching session:', error);
    const apiError: ApiError = {
      error: error instanceof Error ? error.message : 'Failed to fetch session',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * DELETE /api/chat/sessions/:id/rewind - 巻き戻し
 */
router.delete('/sessions/:id/rewind', (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      const error: ApiError = {
        error: 'Invalid session ID',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    const { turnNumber } = req.body as RewindRequest;
    if (typeof turnNumber !== 'number' || turnNumber < 0) {
      const error: ApiError = {
        error: 'turnNumber is required and must be non-negative',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // 所有者チェック
    const userId = req.user?.userId;
    const session = ChatSession.fromSessionId(sessionId, userId);
    if (!session) {
      const error: ApiError = {
        error: 'Session not found or access denied',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    session.rewind(turnNumber);
    res.json({ success: true, sessionId, turnNumber });
  } catch (error) {
    const apiError: ApiError = {
      error: error instanceof Error ? error.message : 'Rewind failed',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * PUT /api/chat/sessions/:id/model - モデル切り替え
 */
router.put('/sessions/:id/model', (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      const error: ApiError = {
        error: 'Invalid session ID',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    const { modelName } = req.body as SwitchModelRequest;
    if (!modelName) {
      const error: ApiError = {
        error: 'modelName is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // 所有者チェック
    const userId = req.user?.userId;
    const session = ChatSession.fromSessionId(sessionId, userId);
    if (!session) {
      const error: ApiError = {
        error: 'Session not found or access denied',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    session.switchModel(modelName);
    res.json({ success: true, sessionId, modelName });
  } catch (error) {
    const apiError: ApiError = {
      error: error instanceof Error ? error.message : 'Model switch failed',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * PUT /api/chat/sessions/:id/title - タイトル更新
 */
router.put('/sessions/:id/title', (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      const error: ApiError = {
        error: 'Invalid session ID',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    const { title } = req.body as { title: string };
    if (!title || typeof title !== 'string') {
      const error: ApiError = {
        error: 'title is required',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // 所有者チェック
    const userId = req.user?.userId;
    const sessionData = getSession(sessionId, userId);
    if (!sessionData) {
      const error: ApiError = {
        error: 'Session not found or access denied',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const success = updateSessionTitle(sessionId, title);
    if (!success) {
      const error: ApiError = {
        error: 'Failed to update title',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      };
      res.status(500).json(error);
      return;
    }

    res.json({ success: true, sessionId, title });
  } catch (error) {
    const apiError: ApiError = {
      error: error instanceof Error ? error.message : 'Title update failed',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

/**
 * DELETE /api/chat/sessions/:id - セッション削除
 */
router.delete('/sessions/:id', (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      const error: ApiError = {
        error: 'Invalid session ID',
        code: 'INVALID_REQUEST',
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // 所有者チェック
    const userId = req.user?.userId;
    const sessionData = getSession(sessionId, userId);
    if (!sessionData) {
      const error: ApiError = {
        error: 'Session not found or access denied',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
      res.status(404).json(error);
      return;
    }

    const success = deleteSession(sessionId);
    if (!success) {
      const error: ApiError = {
        error: 'Failed to delete session',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      };
      res.status(500).json(error);
      return;
    }

    res.json({ success: true, sessionId });
  } catch (error) {
    const apiError: ApiError = {
      error: error instanceof Error ? error.message : 'Delete failed',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
    res.status(500).json(apiError);
  }
});

export default router;
