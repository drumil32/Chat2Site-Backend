import { z } from 'zod';

// Zod schemas for AI service requests and responses
export const AIRequestSchema = z.object({
  message: z.string().min(1, 'Message is required and cannot be empty'),
  lastResponseId: z.string().optional(),
  requestId: z.string().optional(),
});

export const AIMetadataSchema = z.object({
  model: z.string().optional(),
  tokens: z.number().min(0).optional(),
  processingTime: z.number().min(0).optional(),
});

export const AIResponseSchema = z.object({
  response: z.string().min(1, 'Response cannot be empty'),
  conversationId: z.string().min(1, 'Conversation ID is required'),
  metadata: AIMetadataSchema.optional(),
});

// Infer TypeScript types from zod schemas
export type AIRequest = z.infer<typeof AIRequestSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;
export type AIMetadata = z.infer<typeof AIMetadataSchema>;