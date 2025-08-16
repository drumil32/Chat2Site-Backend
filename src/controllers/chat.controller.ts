import { Request, Response, NextFunction, RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import * as Boom from '@hapi/boom';
import { chatService, ChatRequest } from '../services/chat.service';
import { logger } from '../logger';
import { getRealIP } from '../middleware/logging.middleware';

export class ChatController {
  public chat: RequestHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const ip = getRealIP(req);
    
    logger.info('Chat endpoint accessed', { 
      ip, 
      requestId: req.requestId,
      requestBody: req.body,
      headers: {
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        origin: req.get('Origin'),
        referer: req.get('Referer')
      },
      bodySize: JSON.stringify(req.body).length
    });

    const { msg, token } = req.body as ChatRequest;

    // Validate required fields
    if (!msg || typeof msg !== 'string' || msg.trim().length === 0) {
      logger.warn('Chat request validation failed - empty message', { 
        ip, 
        requestId: req.requestId,
        requestBody: req.body,
        validation: {
          messageProvided: !!msg,
          messageType: typeof msg,
          messageLength: msg?.length || 0
        }
      });
      
      throw Boom.badRequest('Message is required and cannot be empty');
    }

    // Validate token if provided
    if (token && typeof token !== 'string') {
      logger.warn('Chat request validation failed - invalid token type', { 
        ip, 
        requestId: req.requestId,
        requestBody: req.body,
        validation: {
          tokenProvided: !!token,
          tokenType: typeof token
        }
      });
      
      throw Boom.badRequest('Token must be a string');
    }

    logger.info('Chat request validated successfully', { 
      ip, 
      requestId: req.requestId,
      validatedRequest: {
        messageLength: msg.length,
        hasToken: !!token,
        tokenLength: token?.length
      }
    });

    const chatResponse = await chatService.processChat({ 
      msg, 
      token, 
      ip, 
      requestId: req.requestId 
    });

    const responseTime = Date.now() - startTime;
    const successResponse = {
      success: true,
      data: chatResponse
    };

    logger.info('Chat request processed successfully', { 
      ip, 
      requestId: req.requestId,
      responseTime: `${responseTime}ms`,
      responseBody: successResponse,
      processingMeta: {
        token: chatResponse.token,
        responseId: chatResponse.responseId,
        isNewToken: chatResponse.isNewToken,
        remainingRequests: chatResponse.remainingRequests
      }
    });

    res.status(200).json(successResponse);
  });
}

export const chatController = new ChatController();