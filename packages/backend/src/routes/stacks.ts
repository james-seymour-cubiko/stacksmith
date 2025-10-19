import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { githubServiceManager } from '../services/github-manager.js';
import { inferStacksFromPRs, getStackById } from '../services/stack-inference.js';
import type { StackWithPRs } from '@review-app/shared';

export const stackRoutes: FastifyPluginAsync = async (server) => {
  const typedServer = server.withTypeProvider<ZodTypeProvider>();

  // List all stacks (inferred from GitHub PRs) - multi-repo support
  typedServer.get(
    '/',
    {
      schema: {
        description: 'List all stacks inferred from GitHub PR branch relationships across all configured repos',
        tags: ['stacks'],
        querystring: z.object({
          repo: z.string().optional().describe('Filter by specific repo (format: owner/name)'),
        }),
      },
    },
    async (request, reply) => {
      if (!githubServiceManager.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        } as any);
      }

      const { repo } = request.query;
      let allStacks: StackWithPRs[] = [];

      const services = githubServiceManager.getAllServices();

      // Filter by repo if specified
      const servicesToQuery = repo
        ? services.filter(({ owner, repo: repoName }) => `${owner}/${repoName}` === repo)
        : services;

      // Fetch stacks from all (or filtered) repos
      for (const { owner, repo: repoName, service } of servicesToQuery) {
        const prs = await service.listPRs('open', { per_page: 100 });
        const stacks = inferStacksFromPRs(prs, owner, repoName);
        allStacks.push(...stacks);
      }

      // Sort by most recently updated
      allStacks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      return allStacks;
    }
  );

  // Get a specific stack with enriched PR data (repo-scoped URL)
  typedServer.get(
    '/:owner/:repo/:stackId',
    {
      schema: {
        description: 'Get a stack with enriched GitHub PR data from a specific repo',
        tags: ['stacks'],
        params: z.object({
          owner: z.string(),
          repo: z.string(),
          stackId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { owner, repo, stackId } = request.params;

      if (!githubServiceManager.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        } as any);
      }

      // Get the service for this specific repo
      let service;
      try {
        service = githubServiceManager.getService(owner, repo);
      } catch (error: any) {
        return reply.code(404).send({
          error: 'Not Found',
          message: error.message,
          statusCode: 404,
        });
      }

      // Get all open PRs and infer stacks for this repo
      const allPRs = await service.listPRs('open', { per_page: 100 });
      const stacksWithPRs = inferStacksFromPRs(allPRs, owner, repo);

      // Find the requested stack
      const stack = getStackById(stacksWithPRs, stackId);

      if (!stack) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Stack with ID "${stackId}" not found in ${owner}/${repo}`,
          statusCode: 404,
        });
      }

      return stack;
    }
  );

};
