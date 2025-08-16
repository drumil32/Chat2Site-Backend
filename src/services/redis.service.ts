import { createClient, RedisClientType } from 'redis';
import * as Boom from '@hapi/boom';
import { logger } from '../logger';

class RedisService {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
    });

    this.client.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    // Connect to Redis
    this.connect();
  }

  private async connect() {
    logger.info('Attempting to connect to Redis...', {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || '6379'
    });
    
    await this.client.connect();
    logger.info('Redis client connected successfully');
  }

  async setLastResponseId(token: string, responseId: string, requestId?: string): Promise<void> {
    logger.debug('Setting lastResponseId', { token, responseId, ttl: 3600, requestId });
    await this.client.setEx(`token:${token}:lastResponseId`, 3600, responseId); // 1 hour expiry
    logger.info('Successfully set lastResponseId', { token, responseId, requestId });
  }

  async getLastResponseId(token: string, requestId?: string): Promise<string | null> {
    logger.debug('Retrieving lastResponseId', { token, requestId });
    const responseId = await this.client.get(`token:${token}:lastResponseId`);
    logger.info('Retrieved lastResponseId', { token, responseId, found: !!responseId, requestId });
    return responseId;
  }

  async deleteToken(token: string, requestId?: string): Promise<void> {
    logger.debug('Deleting token data', { token, requestId });
    const deleted = await this.client.del(`token:${token}:lastResponseId`);
    logger.info('Deleted token data', { token, keysDeleted: deleted, requestId });
  }

  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Redis...');
    await this.client.quit();
    logger.info('Successfully disconnected from Redis');
  }

  // Rate limiting methods
  async getRateLimitCount(ip: string, requestId?: string): Promise<number | null> {
    const key = `rate_limit:${ip}`;
    logger.debug('Getting rate limit count', { ip, key, requestId });
    const count = await this.client.get(key);
    const result = count ? parseInt(count) : null;
    logger.debug('Retrieved rate limit count', { ip, count: result, raw: count, requestId });
    return result;
  }

  async setRateLimitCount(ip: string, count: number, requestId?: string): Promise<void> {
    const key = `rate_limit:${ip}`;
    const ttl = 86400; // 24 hours
    logger.debug('Setting rate limit count', { ip, key, count, ttl, requestId });
    await this.client.setEx(key, ttl, count.toString());
    logger.info('Successfully set rate limit count', { ip, count, ttl, requestId });
  }

  async decrementRateLimitCount(ip: string, requestId?: string): Promise<number> {
    const key = `rate_limit:${ip}`;
    logger.debug('Decrementing rate limit count', { ip, key, requestId });
    const newCount = await this.client.decr(key);
    logger.info('Successfully decremented rate limit count', { ip, newCount, requestId });
    return newCount;
  }

  // Expose client for rate limiter
  getClient(): RedisClientType {
    return this.client;
  }
}

export const redisService = new RedisService();