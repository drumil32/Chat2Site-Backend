import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { getRemainingRequests } from '../middleware/rateLimiter';
import { redisService } from './redis.service';
import { aiService } from './ai.service';

export interface ChatRequest {
  msg: string;
  token?: string;
  ip?: string;
  requestId?: string;
}

export interface ChatResponse {
  message: string;
  token: string;
  responseId: string;
  isNewToken: boolean;
  remainingRequests: number;
  aiMetadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
    conversationId?: string;
  };
}

class ChatService {
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    logger.info('Processing chat request', {
      requestId: request.requestId,
      requestBody: {
        msg: request.msg,
        token: request.token,
        messageLength: request.msg.length,
        hasToken: !!request.token
      },
      ip: request.ip
    });

    let token = request.token;
    let isNewToken = false;
    let lastResponseId: string | null = null;

    // If no token provided, create a new one
    if (!token) {
      token = uuidv4();
      isNewToken = true;
      logger.info('Created new chat token', {
        token,
        ip: request.ip,
        requestId: request.requestId
      });
    } else {
      // Get last response ID for existing token
      logger.debug('Retrieving last response for existing token', {
        token,
        ip: request.ip,
        requestId: request.requestId
      });
      lastResponseId = await redisService.getLastResponseId(token, request.requestId);
      logger.info('Processing existing token', {
        token,
        lastResponseId,
        ip: request.ip,
        requestId: request.requestId
      });
    }

    // Generate new response ID
    const aiResponse = await aiService.processMessage({
      message: request.msg,
      lastResponseId: lastResponseId || undefined,
      requestId: request.requestId
    });

    logger.debug('Generated new response ID', {
      responseId: aiResponse.conversationId,
      token,
      ip: request.ip,
      requestId: request.requestId
    });

    // Store the new response ID in Redis
    logger.debug('Storing response ID in Redis', {
      token,
      responseId: aiResponse.conversationId,
      ip: request.ip,
      requestId: request.requestId
    });
    await redisService.setLastResponseId(token, aiResponse.conversationId, request.requestId);

    // Call AI service to process the message
    logger.debug('Calling AI service to process message', {
      messageLength: request.msg.length,
      hasLastResponseId: !!lastResponseId,
      ip: request.ip,
      requestId: request.requestId
    });



    logger.debug('AI service response received', {
      responseLength: aiResponse.response.length,
      hasConversationId: !!aiResponse.conversationId,
      processingTime: aiResponse.metadata?.processingTime,
      ip: request.ip,
      requestId: request.requestId
    });

    // Get remaining requests for the IP
    logger.debug('Getting remaining requests for IP', {
      ip: request.ip,
      requestId: request.requestId
    });
    const remainingRequests = await getRemainingRequests(request.ip || 'unknown', request.requestId);

    const response: ChatResponse = {
      message: aiResponse.response,
      token,
      responseId: aiResponse.conversationId,
      isNewToken,
      remainingRequests,
      aiMetadata: {
        model: aiResponse.metadata?.model,
        tokens: aiResponse.metadata?.tokens,
        processingTime: aiResponse.metadata?.processingTime,
        conversationId: aiResponse.conversationId
      }
    };

    logger.info('Chat response generated successfully', {
      requestId: request.requestId,
      responseBody: response,
      ip: request.ip,
      processingMeta: {
        token,
        responseId: aiResponse.conversationId,
        isNewToken,
        remainingRequests,
        messageLength: aiResponse.response.length,
        aiProcessingTime: aiResponse.metadata?.processingTime,
        aiModel: aiResponse.metadata?.model,
        aiTokens: aiResponse.metadata?.tokens
      }
    });

    return response;
  }
}

export const chatService = new ChatService();