import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { getRemainingRequests } from '../middleware/rateLimiter';
import { redisService } from './redis.service';
import { aiService } from './ai.service';
import { ChatRequest, ChatResponse, ChatRequestSchema, ChatResponseSchema } from '../types/chat.types';


class ChatService {
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    // Validate input using zod schema
    const validatedRequest = ChatRequestSchema.parse(request);
    
    logger.info('Processing chat request', {
      requestId: validatedRequest.requestId,
      requestBody: {
        msg: validatedRequest.msg,
        token: validatedRequest.token,
        messageLength: validatedRequest.msg.length,
        hasToken: !!validatedRequest.token
      },
      ip: validatedRequest.ip
    });

    let token = validatedRequest.token;
    let isNewToken = false;
    let lastResponseId: string | null = null;

    // If no token provided, create a new one
    if (!token) {
      token = uuidv4();
      isNewToken = true;
      logger.info('Created new chat token', {
        token,
        ip: validatedRequest.ip,
        requestId: validatedRequest.requestId
      });
    } else {
      // Get last response ID for existing token
      logger.debug('Retrieving last response for existing token', {
        token,
        ip: validatedRequest.ip,
        requestId: validatedRequest.requestId
      });
      lastResponseId = await redisService.getLastResponseId(token, validatedRequest.requestId);
      logger.info('Processing existing token', {
        token,
        lastResponseId,
        ip: validatedRequest.ip,
        requestId: validatedRequest.requestId
      });
    }

    // Generate new response ID
    const aiResponse = await aiService.processMessage({
      message: validatedRequest.msg,
      lastResponseId: lastResponseId || undefined,
      requestId: validatedRequest.requestId
    });

    logger.debug('Generated new response ID', {
      responseId: aiResponse.conversationId,
      token,
      ip: validatedRequest.ip,
      requestId: validatedRequest.requestId
    });

    // Store the new response ID in Redis
    logger.debug('Storing response ID in Redis', {
      token,
      responseId: aiResponse.conversationId,
      ip: validatedRequest.ip,
      requestId: validatedRequest.requestId
    });
    await redisService.setLastResponseId(token, aiResponse.conversationId, validatedRequest.requestId);

    // Call AI service to process the message
    logger.debug('Calling AI service to process message', {
      messageLength: validatedRequest.msg.length,
      hasLastResponseId: !!lastResponseId,
      ip: validatedRequest.ip,
      requestId: validatedRequest.requestId
    });



    logger.debug('AI service response received', {
      responseLength: aiResponse.response.length,
      hasConversationId: !!aiResponse.conversationId,
      processingTime: aiResponse.metadata?.processingTime,
      ip: validatedRequest.ip,
      requestId: validatedRequest.requestId
    });

    // Get remaining requests for the IP
    logger.debug('Getting remaining requests for IP', {
      ip: validatedRequest.ip,
      requestId: validatedRequest.requestId
    });
    const remainingRequests = await getRemainingRequests(validatedRequest.ip || 'unknown', validatedRequest.requestId);

    const responseData = {
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

    // Validate response using zod schema
    const validatedResponse = ChatResponseSchema.parse(responseData);

    logger.info('Chat response generated successfully', {
      requestId: validatedRequest.requestId,
      responseBody: validatedResponse,
      ip: validatedRequest.ip,
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

    return validatedResponse;
  }
}

export const chatService = new ChatService();