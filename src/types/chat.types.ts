import { z } from 'zod';

// Zod schemas for chat service requests and responses
export const ChatRequestSchema = z.object({
  msg: z.string().min(1, 'Message is required and cannot be empty'),
  token: z.string().optional(),
  ip: z.string().ip().optional(),
  requestId: z.string().optional(),
});

export const ChatAIMetadataSchema = z.object({
  model: z.string().optional(),
  tokens: z.number().min(0).optional(),
  processingTime: z.number().min(0).optional(),
  conversationId: z.string().optional(),
});

export const ChatResponseSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  token: z.string().min(1, 'Token is required'),
  responseId: z.string().min(1, 'Response ID is required'),
  isNewToken: z.boolean(),
  remainingRequests: z.number().min(0, 'Remaining requests cannot be negative'),
  aiMetadata: ChatAIMetadataSchema.optional(),
});

// Infer TypeScript types from zod schemas
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type ChatAIMetadata = z.infer<typeof ChatAIMetadataSchema>;