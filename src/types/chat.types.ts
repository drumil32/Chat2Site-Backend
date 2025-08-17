import { z } from 'zod';

// Zod schemas for chat service requests and responses
export const ChatRequestSchema = z.object({
  msg: z.string().min(1, 'Message is required and cannot be empty'),
  token: z.string().nullish(),
  ip: z.string().ip(),
  requestId: z.string(),
});

export const ChatAIMetadataSchema = z.object({
  model: z.string().nullish(),
  tokens: z.number().min(0).nullish(),
  processingTime: z.number().min(0).nullish(),
  conversationId: z.string().nullish(),
});

export const ChatResponseSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  token: z.string().min(1, 'Token is required'),
  responseId: z.string().min(1, 'Response ID is required'),
  isNewToken: z.boolean(),
  remainingRequests: z.number().min(0, 'Remaining requests cannot be negative'),
  aiMetadata: ChatAIMetadataSchema.nullish(),
});

// Infer TypeScript types from zod schemas
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type ChatAIMetadata = z.infer<typeof ChatAIMetadataSchema>;