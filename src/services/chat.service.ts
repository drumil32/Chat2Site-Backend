import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { getRemainingRequests } from '../middleware/rateLimiter';
import { redisService } from './redis.service';

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
}

class ChatService {
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    try {
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
      const responseId = uuidv4();
      logger.debug('Generated new response ID', { 
        responseId, 
        token, 
        ip: request.ip, 
        requestId: request.requestId 
      });

      // Store the new response ID in Redis
      logger.debug('Storing response ID in Redis', { 
        token, 
        responseId, 
        ip: request.ip, 
        requestId: request.requestId 
      });
      await redisService.setLastResponseId(token, responseId, request.requestId);

      // For now, return a dummy response
      const dummyMessages = [
        "Hello! I'm a dummy chat bot. How can I help you today?",
        "That's an interesting message! I'm still learning how to respond properly.",
        "Thanks for your message! I'm processing your request...",
        "I appreciate your patience. This is a placeholder response.",
        "Your message has been received. I'll get back to you with a real response soon!"
      ];

      const messageIndex = Math.floor(Math.random() * dummyMessages.length);
      const randomMessage = dummyMessages[messageIndex];
      logger.debug('Selected dummy message', { 
        messageIndex, 
        selectedMessage: randomMessage, 
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
        message: randomMessage,
        token,
        responseId,
        isNewToken,
        remainingRequests
      };

      logger.info('Chat response generated successfully', { 
        requestId: request.requestId,
        responseBody: response,
        ip: request.ip,
        processingMeta: {
          token, 
          responseId, 
          isNewToken, 
          remainingRequests, 
          messageLength: randomMessage.length
        }
      });
      
      return response;

    } catch (error) {
      logger.error('Error processing chat request', { 
        error, 
        requestId: request.requestId,
        requestBody: {
          msg: request.msg,
          token: request.token,
          messageLength: request.msg.length,
          hasToken: !!request.token
        },
        ip: request.ip 
      });
      throw new Error('Failed to process chat request');
    }
  }
}

export const chatService = new ChatService();