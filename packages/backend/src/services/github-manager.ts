import { GithubService } from './github.js';
import type { RepoIdentifier } from '@review-app/shared';

/**
 * Manages multiple GithubService instances for multi-repo support
 */
export class GithubServiceManager {
  private services: Map<string, GithubService> = new Map();
  private currentUser: string = '';

  /**
   * Configure repos from environment variables or direct configuration
   * @param repos Array of repo identifiers
   * @param token GitHub token (shared across all repos for now)
   * @param currentUser GitHub username
   */
  configure(repos: RepoIdentifier[], token?: string, currentUser?: string) {
    this.currentUser = currentUser || '';

    for (const { owner, repo } of repos) {
      const key = this.getRepoKey(owner, repo);
      const service = new GithubService();
      service.configure(owner, repo, token, currentUser);
      this.services.set(key, service);
    }
  }

  /**
   * Add or update a single repo configuration
   */
  addRepo(owner: string, repo: string, token?: string, currentUser?: string) {
    const key = this.getRepoKey(owner, repo);
    const service = new GithubService();
    service.configure(owner, repo, token, currentUser || this.currentUser);
    this.services.set(key, service);
  }

  /**
   * Get a GithubService instance for a specific repo
   */
  getService(owner: string, repo: string): GithubService {
    const key = this.getRepoKey(owner, repo);
    const service = this.services.get(key);

    if (!service) {
      throw new Error(`GitHub service not configured for ${owner}/${repo}. Please configure this repository first.`);
    }

    return service;
  }

  /**
   * Get any configured GithubService instance
   * Useful for operations that don't depend on a specific repo (e.g., rate limits)
   */
  getAnyService(): GithubService {
    const firstService = this.services.values().next().value;

    if (!firstService) {
      throw new Error('No GitHub services configured. Please configure at least one repository first.');
    }

    return firstService;
  }

  /**
   * Get all configured GithubService instances
   */
  getAllServices(): Array<{ owner: string; repo: string; service: GithubService }> {
    return Array.from(this.services.entries()).map(([key, service]) => {
      const [owner, repo] = key.split('/');
      return { owner, repo, service };
    });
  }

  /**
   * Get list of all configured repos
   */
  listRepos(): RepoIdentifier[] {
    return Array.from(this.services.keys()).map((key) => {
      const [owner, repo] = key.split('/');
      return { owner, repo };
    });
  }

  /**
   * Check if any repos are configured
   */
  isConfigured(): boolean {
    return this.services.size > 0;
  }

  /**
   * Check if a specific repo is configured
   */
  hasRepo(owner: string, repo: string): boolean {
    const key = this.getRepoKey(owner, repo);
    return this.services.has(key);
  }

  /**
   * Get current user
   */
  getCurrentUser(): string {
    return this.currentUser;
  }

  /**
   * Get config for all repos
   */
  getConfig() {
    return {
      repos: this.listRepos(),
      currentUser: this.currentUser || undefined,
    };
  }

  /**
   * Remove a repo configuration
   */
  removeRepo(owner: string, repo: string): boolean {
    const key = this.getRepoKey(owner, repo);
    return this.services.delete(key);
  }

  /**
   * Clear all repo configurations
   */
  clear() {
    this.services.clear();
    this.currentUser = '';
  }

  /**
   * Generate a unique key for a repo
   */
  private getRepoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }
}

// Singleton instance
export const githubServiceManager = new GithubServiceManager();
