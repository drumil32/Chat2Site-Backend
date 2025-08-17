import * as Boom from '@hapi/boom';
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../logger';
import { AIRequest, AIResponse, AIRequestSchema, AIResponseSchema } from '../types/ai.types';


class AIService {
  private readonly axiosInstance: AxiosInstance;

  constructor() {
    const aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8080';
    const aiApiKey = process.env.AI_API_KEY || '';
    const timeout = parseInt(process.env.AI_TIMEOUT || '30000'); // 30 seconds default

    this.axiosInstance = axios.create({
      baseURL: aiServerUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(aiApiKey && { 'Authorization': `Bearer ${aiApiKey}` }),
      },
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('AI service request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: { ...config.headers, Authorization: aiApiKey ? '[REDACTED]' : undefined }
        });
        return config;
      },
      (error) => {
        logger.error('AI service request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('AI service response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error('AI service response error', {
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url,
            data: error.response.data
          });
        } else {
          logger.error('AI service network error', {
            message: error.message,
            url: error.config?.url
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async processMessage(request: AIRequest): Promise<AIResponse> {
    // Validate input using zod schema
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
      const response: AxiosResponse<any> = await this.axiosInstance.post('/api/chat', aiPayload, {
        headers: {
          'X-Request-ID': validatedRequest.requestId || ''
        }
      });

      const processingTime = Date.now() - startTime;
      const aiResponse = response.data;

      logger.info('AI service response received', {
        requestId: validatedRequest.requestId,
        processingTime: `${processingTime}ms`,
        responseLength: aiResponse.response?.length || 0,
        hasConversationId: !!aiResponse.conversationId,
        metadata: aiResponse.metadata
      });

      logger.debug('AI service response payload', {
        requestId: validatedRequest.requestId,
        response: aiResponse
      });

      const responseData = {
        response: aiResponse.response || aiResponse.message || 'No response from AI service',
        conversationId: aiResponse.conversationId,
        metadata: {
          model: aiResponse.metadata?.model,
          tokens: aiResponse.metadata?.tokens,
          processingTime
        }
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

  async healthCheck(requestId?: string): Promise<boolean> {
    logger.debug('Checking AI service health', { requestId });

    try {
      const response: AxiosResponse = await this.axiosInstance.get('/health', {
        headers: {
          'X-Request-ID': requestId || ''
        },
        timeout: 5000 // 5 second timeout for health check
      });

      const isHealthy = response.status === 200;
      
      logger.info('AI service health check result', {
        requestId,
        isHealthy,
        status: response.status
      });

      return isHealthy;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.info('AI service health check result', {
        requestId,
        isHealthy: false,
        status: axiosError.response?.status || 'Network Error'
      });

      return false;
    }
  }
}

export const aiService = new AIService();