import * as Boom from '@hapi/boom';
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../logger';

// TypeScript interfaces for GitHub API responses
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface GitHubPages {
  url: string;
  status: string;
  cname: string | null;
  html_url: string;
  source: {
    branch: string;
    path: string;
  };
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content: string;
  encoding: string;
}

export interface GitHubFileResponse {
  name: string;
  path: string;
  content: string;
  sha: string;
  size: number;
  url: string;
  downloadUrl: string;
  encoding: string;
}

export interface CreateRepoRequest {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  requestId?: string;
}

export interface CreateFileRequest {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message?: string;
  branch?: string;
  requestId?: string;
}

export interface ReadFileRequest {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
  requestId?: string;
}

export interface EnablePagesRequest {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  requestId?: string;
}

class GitHubService {
  private readonly axiosInstance: AxiosInstance;
  private readonly owner: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN || '';
    const baseUrl = process.env.GITHUB_BASE_API || 'https://api.github.com';
    this.owner = process.env.GITHUB_OWNER || '';

    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('GitHub API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: { ...config.headers, Authorization: '[REDACTED]' }
        });
        return config;
      },
      (error) => {
        logger.error('GitHub API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('GitHub API response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error('GitHub API response error', {
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url,
            data: error.response.data
          });
        } else {
          logger.error('GitHub API network error', {
            message: error.message,
            url: error.config?.url
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async createRepository(request: CreateRepoRequest): Promise<GitHubRepository> {
    logger.info('Creating GitHub repository', {
      repoName: request.name,
      description: request.description,
      private: request.private,
      requestId: request.requestId
    });

    try {
      const response: AxiosResponse<GitHubRepository> = await this.axiosInstance.post('/user/repos', {
        name: request.name,
        description: request.description || '',
        private: request.private || false,
        auto_init: request.autoInit || true
      });

      const repo = response.data;
      
      logger.info('GitHub repository created successfully', {
        repoName: repo.name,
        repoUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        requestId: request.requestId
      });

      return repo;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to create GitHub repository', {
        error: axiosError.response?.data || axiosError.message,
        status: axiosError.response?.status,
        repoName: request.name,
        requestId: request.requestId
      });
      
      if (axiosError.response?.status === 422) {
        throw Boom.conflict(`Repository "${request.name}" already exists`);
      } else if (axiosError.response?.status === 401) {
        throw Boom.unauthorized('Invalid GitHub token');
      } else {
        throw Boom.badRequest(`GitHub API Error: ${axiosError.response?.data || axiosError.message}`);
      }
    }
  }

  async enableGitHubPages(request: EnablePagesRequest): Promise<GitHubPages> {
    logger.info('Enabling GitHub Pages', {
      owner: request.owner,
      repo: request.repo,
      branch: request.branch,
      path: request.path,
      requestId: request.requestId
    });

    try {
      const response: AxiosResponse<GitHubPages> = await this.axiosInstance.post(
        `/repos/${request.owner}/${request.repo}/pages`,
        {
          source: {
            branch: request.branch || 'main',
            path: request.path || '/'
          }
        }
      );

      const pages = response.data;
      
      logger.info('GitHub Pages enabled successfully', {
        pagesUrl: pages.html_url,
        status: pages.status,
        owner: request.owner,
        repo: request.repo,
        requestId: request.requestId
      });

      return pages;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to enable GitHub Pages', {
        error: axiosError.response?.data || axiosError.message,
        status: axiosError.response?.status,
        owner: request.owner,
        repo: request.repo,
        requestId: request.requestId
      });
      
      if (axiosError.response?.status === 404) {
        throw Boom.notFound(`Repository "${request.owner}/${request.repo}" not found`);
      } else if (axiosError.response?.status === 409) {
        throw Boom.conflict('GitHub Pages already enabled for this repository');
      } else {
        throw Boom.badRequest(`Failed to enable GitHub Pages: ${axiosError.response?.data || axiosError.message}`);
      }
    }
  }

  async getGitHubPagesUrl(owner: string, repo: string, requestId?: string): Promise<string | null> {
    logger.debug('Getting GitHub Pages URL', {
      owner,
      repo,
      requestId
    });

    try {
      const response: AxiosResponse<GitHubPages> = await this.axiosInstance.get(
        `/repos/${owner}/${repo}/pages`
      );

      const pages = response.data;
      
      logger.debug('GitHub Pages URL retrieved', {
        pagesUrl: pages.html_url,
        owner,
        repo,
        requestId
      });

      return pages.html_url;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.debug('GitHub Pages not found or not enabled', {
        status: axiosError.response?.status,
        owner,
        repo,
        requestId
      });
      return null;
    }
  }

  private toBase64(content: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    return btoa(String.fromCharCode(...data));
  }

  async createFile(request: CreateFileRequest): Promise<GitHubFileContent> {
    logger.info('Creating file in GitHub repository', {
      owner: request.owner,
      repo: request.repo,
      path: request.path,
      contentLength: request.content.length,
      message: request.message,
      branch: request.branch,
      requestId: request.requestId
    });

    const base64Content = this.toBase64(request.content);
    
    try {
      const response: AxiosResponse<{ content: GitHubFileContent }> = await this.axiosInstance.put(
        `/repos/${request.owner}/${request.repo}/contents/${request.path}`,
        {
          message: request.message || 'Add file via API',
          content: base64Content,
          branch: request.branch || 'main'
        }
      );

      const result = response.data;
      
      logger.info('File created successfully in GitHub repository', {
        owner: request.owner,
        repo: request.repo,
        path: request.path,
        sha: result.content.sha,
        requestId: request.requestId
      });

      return result.content;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to create file in GitHub repository', {
        error: axiosError.response?.data || axiosError.message,
        status: axiosError.response?.status,
        owner: request.owner,
        repo: request.repo,
        path: request.path,
        requestId: request.requestId
      });
      
      if (axiosError.response?.status === 404) {
        throw Boom.notFound(`Repository "${request.owner}/${request.repo}" not found`);
      } else if (axiosError.response?.status === 422) {
        throw Boom.conflict(`File "${request.path}" already exists`);
      } else {
        throw Boom.badRequest(`Failed to create file: ${axiosError.response?.data || axiosError.message}`);
      }
    }
  }

  async readFile(request: ReadFileRequest): Promise<GitHubFileResponse> {
    logger.debug('Reading file from GitHub repository', {
      owner: request.owner,
      repo: request.repo,
      path: request.path,
      branch: request.branch,
      requestId: request.requestId
    });

    try {
      const response: AxiosResponse<GitHubFileContent> = await this.axiosInstance.get(
        `/repos/${request.owner}/${request.repo}/contents/${request.path}`,
        {
          params: request.branch ? { ref: request.branch } : undefined
        }
      );

      const data = response.data;
      
      if (data.type !== 'file') {
        logger.error('Path is not a file', {
          path: request.path,
          type: data.type,
          requestId: request.requestId
        });
        throw Boom.badRequest(`Path "${request.path}" is not a file`);
      }

      // Decode base64 content
      const content = decodeURIComponent(escape(atob(data.content)));
      
      logger.debug('File read successfully from GitHub repository', {
        owner: request.owner,
        repo: request.repo,
        path: request.path,
        size: data.size,
        sha: data.sha,
        requestId: request.requestId
      });

      return {
        name: data.name,
        path: data.path,
        content: content,
        sha: data.sha,
        size: data.size,
        url: data.html_url,
        downloadUrl: data.download_url,
        encoding: data.encoding
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to read file from GitHub repository', {
        error: axiosError.response?.data || axiosError.message,
        status: axiosError.response?.status,
        owner: request.owner,
        repo: request.repo,
        path: request.path,
        requestId: request.requestId
      });
      
      if (axiosError.response?.status === 404) {
        throw Boom.notFound(`File "${request.path}" not found in repository "${request.owner}/${request.repo}"`);
      } else {
        throw Boom.badRequest(`Failed to read file: ${axiosError.response?.data || axiosError.message}`);
      }
    }
  }

  async updateFile(request: CreateFileRequest): Promise<GitHubFileContent> {
    
    const currentFile = await this.readFile({owner:request.owner,path:request.path,repo:request.repo,branch:request.branch,requestId:request.requestId});
    const sha = currentFile.sha;

    logger.info('Updating file in GitHub repository', {
      owner: request.owner,
      repo: request.repo,
      path: request.path,
      contentLength: request.content.length,
      message: request.message,
      sha: sha,
      requestId: request.requestId
    });

    const base64Content = this.toBase64(request.content);
    
    try {
      const response: AxiosResponse<{ content: GitHubFileContent }> = await this.axiosInstance.put(
        `/repos/${request.owner}/${request.repo}/contents/${request.path}`,
        {
          message: request.message || 'Update file via API',
          content: base64Content,
          sha: sha,
          branch: request.branch || 'main'
        }
      );

      const result = response.data;
      
      logger.info('File updated successfully in GitHub repository', {
        owner: request.owner,
        repo: request.repo,
        path: request.path,
        newSha: result.content.sha,
        requestId: request.requestId
      });

      return result.content;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      logger.error('Failed to update file in GitHub repository', {
        error: axiosError.response?.data || axiosError.message,
        status: axiosError.response?.status,
        owner: request.owner,
        repo: request.repo,
        path: request.path,
        requestId: request.requestId
      });
      
      if (axiosError.response?.status === 404) {
        throw Boom.notFound(`File "${request.path}" not found in repository "${request.owner}/${request.repo}"`);
      } else if (axiosError.response?.status === 409) {
        throw Boom.conflict('File has been modified since last read. Please refresh and try again.');
      } else {
        throw Boom.badRequest(`Failed to update file: ${axiosError.response?.data || axiosError.message}`);
      }
    }
  }

  getDefaultOwner(): string {
    return this.owner;
  }
}

export const githubService = new GitHubService();