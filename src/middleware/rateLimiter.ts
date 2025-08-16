import { Request, Response, NextFunction } from 'express';
import * as Boom from '@hapi/boom';
import { redisService } from '../services/redis.service';
import { logger } from '../logger';
import { getRealIP } from './logging.middleware';

const RATE_LIMIT_PER_DAY = parseInt(process.env.RATE_LIMIT_PER_DAY || '20');

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Skip rate limiting for health check endpoints
  if (req.path === '/health' || req.path === '/') {
    logger.debug('Skipping rate limit for health endpoint', { 
      path: req.path, 
      method: req.method 
    });
    return next();
  }

  const ip = getRealIP(req);

  logger.info('Rate limit check started', {
    method: req.method,
    path: req.path,
    ip,
    requestId: req.requestId,
    userAgent: req.get('User-Agent')
  });

  const currentCount = await redisService.getRateLimitCount(ip, req.requestId);

  if (currentCount === null) {
    // First request from this IP today
    const initialCount = RATE_LIMIT_PER_DAY - 1;
    await redisService.setRateLimitCount(ip, initialCount, req.requestId);
    
    const checkTime = Date.now() - startTime;
    logger.info('Rate limit initialized for new IP', {
      ip,
      initialCount,
      limit: RATE_LIMIT_PER_DAY,
      checkTime: `${checkTime}ms`,
      requestId: req.requestId
    });
  } else if (currentCount <= 0) {
    // Rate limit exceeded
    const checkTime = Date.now() - startTime;
    
    logger.warn('Rate limit exceeded', {
      method: req.method,
      path: req.path,
      ip,
      currentCount,
      limit: RATE_LIMIT_PER_DAY,
      checkTime: `${checkTime}ms`,
      requestId: req.requestId,
      userAgent: req.get('User-Agent')
    });
    
    throw Boom.tooManyRequests(`You have exceeded the daily limit of ${RATE_LIMIT_PER_DAY} requests. Please try again tomorrow.`);
  } else {
    // Decrement the count
    const newCount = await redisService.decrementRateLimitCount(ip, req.requestId);
    
    const checkTime = Date.now() - startTime;
    logger.info('Rate limit check passed', {
      ip,
      previousCount: currentCount,
      newCount,
      checkTime: `${checkTime}ms`,
      requestId: req.requestId
    });
  }

  next();
};

// Function to get remaining requests for an IP
export const getRemainingRequests = async (ip: string, requestId?: string): Promise<number> => {
  logger.debug('Getting remaining requests count', { ip, requestId });
  const remaining = await redisService.getRateLimitCount(ip, requestId);
  const result = remaining !== null ? remaining : RATE_LIMIT_PER_DAY;
  
  logger.debug('Retrieved remaining requests count', { 
    ip, 
    remaining, 
    result, 
    isFirstTime: remaining === null,
    requestId 
  });
  
  return result;
};