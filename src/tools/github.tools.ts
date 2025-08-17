import { tool } from '@openai/agents';
import { githubService } from '../services/github.service';
import {
  CreateRepoRequestSchema,
  CreateFileRequestSchema,
  ReadFileRequestSchema,
  EnablePagesRequestSchema
} from '../types/github.types';

class GitHubTools {
  createRepositoryTool = tool({
    name: 'createRepository',
    description: 'Create a new GitHub repository. This should only be called once per conversation.',
    parameters: CreateRepoRequestSchema,
    execute: githubService.createRepository
  });

  createFileTool = tool({
    name: 'createFile',
    description: 'Create a new file in a GitHub repository',
    parameters: CreateFileRequestSchema,
    execute: githubService.createFile
  });

  readFileTool = tool({
    name: 'readFile',
    description: 'Read a file from a GitHub repository',
    parameters: ReadFileRequestSchema,
    execute: githubService.readFile
  });

  updateFileTool = tool({
    name: 'updateFile',
    description: 'Update an existing file in a GitHub repository',
    parameters: CreateFileRequestSchema,
    execute: githubService.updateFile
  });

  enablePagesTool = tool({
    name: 'enableGitHubPages',
    description: 'Enable GitHub Pages for a repository',
    parameters: EnablePagesRequestSchema,
    execute: githubService.enableGitHubPages
  });
}

export const githubTools = new GitHubTools();