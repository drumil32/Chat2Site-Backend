import { Request, Response, NextFunction } from 'express';
import * as Boom from '@hapi/boom';
import { logger } from '../logger';

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;

  // Convert to Boom error if not already
  let boomError: Boom.Boom;
  if (Boom.isBoom(err)) {
    boomError = err;
  } else
    if (err.name === 'ValidationError') {
      boomError = Boom.badRequest(err.message);
    } else if (err.name === 'CastError') {
      boomError = Boom.badRequest('Invalid ID format');
    } else if (err.code === 11000) {
      boomError = Boom.conflict('Resource already exists');
    } else {
      boomError = Boom.internal( 'Internal Server Error');
    }


  // Log the error with full context
  logger.error('Application Error', {
    requestId,
    method: req.method,
    endpoint: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    error: {
      name: boomError.name,
      message: boomError.message,
      stack: err.stack,
      statusCode: boomError.output.statusCode,
      payload: boomError.output.payload
    },
    requestBody: req.body,
    query: req.query,
    params: req.params
  });

  // Send error response
  res.status(boomError.output.statusCode).json({
    message:boomError.output.payload.message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};