import * as Boom from '@hapi/boom';
import { run } from '@openai/agents';
import { AxiosError } from 'axios';
import { agent } from '../agents/coding.agent';
import { logger } from '../logger';
import { AIRequest, AIRequestSchema, AIResponse, AIResponseSchema } from '../types/ai.types';


class AIService {

  async processMessage(request: AIRequest): Promise<AIResponse> {
    // Validate input using zod schema
    console.log(request);
    const validatedRequest = AIRequestSchema.parse(request);

    const startTime = Date.now();

    logger.info('Calling AI service', {
      requestId: validatedRequest.requestId,
      hasLastResponseId: !!validatedRequest.lastResponseId,
      messageLength: validatedRequest.message.length
    });

    const aiPayload = {
      message: validatedRequest.message,
      lastResponseId: validatedRequest.lastResponseId,
      timestamp: new Date().toISOString()
    };

    logger.debug('AI service request payload', {
      requestId: validatedRequest.requestId,
      payload: aiPayload
    });

    try {
      const obj = {
        ...(validatedRequest.lastResponseId ? { previousResponseId: validatedRequest.lastResponseId } : {})
      };
      console.log(obj)
      const response = await run(agent, validatedRequest.message, obj)
    
      const processingTime = Date.now() - startTime;
      console.log(response.lastResponseId);

      logger.info('AI service response received', {
        requestId: validatedRequest.requestId,
        responseId: response.lastResponseId,
        processingTime: `${processingTime}ms`,
        responseLength: response.finalOutput?.content.length || 0,
        hasConversationId: !!response.lastResponseId,
      });

      logger.debug('AI service response payload', {
        requestId: validatedRequest.requestId,
        response: response.finalOutput
      });

      const responseData = {
        content: response.finalOutput?.content || 'No response from AI service',
        conversationId: response.lastResponseId,
        processingTime
      };

      // Validate response using zod schema
      return AIResponseSchema.parse(responseData);
    } catch (error) {
      const axiosError = error as AxiosError;
      const processingTime = Date.now() - startTime;

      logger.error('AI service error response', {
        requestId: validatedRequest.requestId,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        processingTime: `${processingTime}ms`,
        error: axiosError.response?.data || axiosError.message
      });

      if (axiosError.response?.status === 429) {
        throw Boom.tooManyRequests('AI service rate limit exceeded');
      } else if (axiosError.response?.status && axiosError.response.status >= 500) {
        throw Boom.badGateway('AI service is temporarily unavailable');
      } else if (axiosError.response?.status === 401) {
        throw Boom.unauthorized('Invalid AI service credentials');
      } else {
        throw Boom.badRequest(`AI service error: ${axiosError.response?.statusText || axiosError.message}`);
      }
    }
  }
}

export const aiService = new AIService();