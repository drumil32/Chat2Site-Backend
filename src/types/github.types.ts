import { z } from 'zod';

// Zod schemas for GitHub API responses and requests
export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  html_url: z.string().url(),
  clone_url: z.string().url(),
  default_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  owner: z.object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string().url(),
  }),
});

export const GitHubPagesSchema = z.object({
  url: z.string().url(),
  status: z.string(),
  cname: z.string().nullable(),
  html_url: z.string().url(),
  source: z.object({
    branch: z.string(),
    path: z.string(),
  }),
});

export const GitHubFileContentSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  url: z.string().url(),
  html_url: z.string().url(),
  git_url: z.string().url(),
  download_url: z.string().url(),
  type: z.enum(['file', 'dir']),
  content: z.string(),
  encoding: z.string(),
});

export const GitHubFileResponseSchema = z.object({
  name: z.string(),
  path: z.string(),
  content: z.string(),
  sha: z.string(),
  size: z.number(),
  url: z.string().url(),
  downloadUrl: z.string().url(),
  encoding: z.string(),
});

export const CreateRepoRequestSchema = z.object({
  name: z.string().min(1, 'Repository name is required'),
  description: z.string().optional(),
  private: z.boolean().optional().default(false),
  autoInit: z.boolean().optional().default(true),
  requestId: z.string().optional(),
});

export const CreateFileRequestSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  content: z.string(),
  message: z.string().optional(),
  branch: z.string().optional().default('main'),
  requestId: z.string().optional(),
});

export const ReadFileRequestSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  branch: z.string().optional(),
  requestId: z.string().optional(),
});

export const EnablePagesRequestSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  branch: z.string().optional().default('main'),
  path: z.string().optional().default('/'),
  requestId: z.string().optional(),
});

// Infer TypeScript types from zod schemas
export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;
export type GitHubPages = z.infer<typeof GitHubPagesSchema>;
export type GitHubFileContent = z.infer<typeof GitHubFileContentSchema>;
export type GitHubFileResponse = z.infer<typeof GitHubFileResponseSchema>;
export type CreateRepoRequest = z.infer<typeof CreateRepoRequestSchema>;
export type CreateFileRequest = z.infer<typeof CreateFileRequestSchema>;
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;
export type EnablePagesRequest = z.infer<typeof EnablePagesRequestSchema>;