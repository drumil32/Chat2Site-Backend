import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

 // Get real IP from nginx headers
 export const getRealIP = (req: Request): string => {
    return req.get('X-Real-IP') || 
           req.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
           req.ip || 
           req.connection.remoteAddress || 
           'unknown';
  };

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = randomUUID();
  
  // Store requestId and domain in request for use in other middlewares
  req.requestId = requestId;

  // Extract domain from host header
  const getDomain = (req: Request): string => {
    const origin = req.get('Origin');
    if (!origin) return 'unknown';

    try {
      const url = new URL(origin);
      return url.hostname; // keeps full domain including subdomain
    } catch {
      return 'unknown';
    }
  };

  // Set domain in request for use in other middlewares
  req.finalDomain = getDomain(req);
  
  // Log incoming request
  logger.info('Incoming Request', {
    requestId,
    method: req.method,
    endpoint: req.originalUrl,
    finalDomain: req.finalDomain,
    ip: getRealIP(req),
    userAgent: req.get('User-Agent'),
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  // Store original end function
  const originalEnd = res.end;
  let responseBody = '';

  // Override res.end to capture response
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    if (chunk) {
      responseBody = chunk;
    }
    
    const responseTime = Date.now() - startTime;
    
    // Log outgoing response
    logger.info('Outgoing Response', {
      requestId,
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
      responseBody: responseBody.toString()
    });

    return originalEnd.call(res, chunk, encoding, cb);
  };
  logger.info("calling next")
  next();
};