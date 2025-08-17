import { Request, Response, NextFunction, RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import * as Boom from '@hapi/boom';
import { ZodError } from 'zod';
import { chatService } from '../services/chat.service';
import { ChatRequest, ChatRequestSchema } from '../types/chat.types';
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

    try {
      // Validate request using zod schema
      const validatedRequest = ChatRequestSchema.parse({
        ...req.body,
        ip,
        requestId: req.requestId
      });

      logger.info('Chat request validated successfully', { 
        ip, 
        requestId: req.requestId,
        validatedRequest: {
          messageLength: validatedRequest.msg.length,
          hasToken: !!validatedRequest.token,
          tokenLength: validatedRequest.token?.length
        }
      });

      const chatResponse = await chatService.processChat(validatedRequest);

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
    } catch (error: any) {
      if (error instanceof ZodError) {
        logger.warn('Chat request validation failed', { 
          ip, 
          requestId: req.requestId,
          requestBody: req.body,
          validationErrors: error.errors
        });
        
        throw Boom.badRequest(`Validation failed: ${error.errors.map((e: any) => e.message).join(', ')}`);
      }
      throw error;
    }
  });
}

export const chatController = new ChatController();