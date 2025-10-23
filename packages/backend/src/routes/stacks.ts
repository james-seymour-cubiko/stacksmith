import type { FastifyPluginAsync } from 'fastify';
import { writeFile, readFile } from "node:fs/promises";
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { githubServiceManager } from '../services/github-manager.js';
import { inferStacksFromPRs, getStackById } from '../services/stack-inference.js';
import type { StackWithPRs } from '@review-app/shared';
import {stackService, StackService} from '../services/stacks.js';

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

      const knownStacks = await stackService.loadStacks();
      // Fetch stacks from all (or filtered) repos
      for (const { owner, repo: repoName, service } of servicesToQuery) {
        const prs = await service.listPRs('open', { per_page: 100 });
        const stacks = inferStacksFromPRs(prs, knownStacks, owner, repoName);
        allStacks.push(...stacks);
      }

      await stackService.saveStacks(allStacks);

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
        // Log available repos for debugging
        const availableRepos = githubServiceManager.listRepos();
        console.error(`Failed to get service for ${owner}/${repo}. Available repos:`, availableRepos);
        return reply.code(404).send({
          error: 'Not Found',
          message: `${error.message}. Available repositories: ${availableRepos.map(r => `${r.owner}/${r.repo}`).join(', ')}`,
          statusCode: 404,
        });
      }

      // Load known stacks and find the requested stack
      const knownStacks = await stackService.loadStacks();
      const stack = getStackById(knownStacks, stackId);

      if (!stack) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Stack with ID "${stackId}" not found in ${owner}/${repo}`,
          statusCode: 404,
        });
      }

      // Query each PR individually from GitHub to get updated status (including merged PRs)
      const updatedPRs = await Promise.all(
        stack.prs.map(async (pr) => {
          try {
            const freshPR = await service.getPR(pr.number);
            // Preserve stack metadata while updating PR data
            return {
              ...freshPR,
              stackOrder: pr.stackOrder,
              stackId: pr.stackId,
              stackName: pr.stackName,
              repoOwner: pr.repoOwner,
              repoName: pr.repoName,
            };
          } catch (error) {
            // If PR fetch fails (e.g., deleted), keep the existing PR data
            console.warn(`Failed to fetch PR #${pr.number}:`, error);
            return pr;
          }
        })
      );

      // Update the stack with fresh PR data
      const updatedStack: StackWithPRs = {
        ...stack,
        prs: updatedPRs,
        updated_at: new Date(Math.max(...updatedPRs.map((p) => new Date(p.updated_at).getTime()))).toISOString(),
      };

      // Save the updated stack back to stacks.json
      const allStacks = knownStacks.map((s) =>
        s.id === stackId ? updatedStack : s
      );
      await stackService.saveStacks(allStacks);

      return updatedStack;
    }
  );

};
