import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { githubService } from '../services/github.js';
import { inferStacksFromPRs, getStackById } from '../services/stack-inference.js';

export const stackRoutes: FastifyPluginAsync = async (server) => {
  const typedServer = server.withTypeProvider<ZodTypeProvider>();

  // List all stacks (inferred from GitHub PRs)
  typedServer.get(
    '/',
    {
      schema: {
        description: 'List all stacks inferred from GitHub PR branch relationships',
        tags: ['stacks'],
      },
    },
    async (_request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        } as any);
      }

      // Get all open PRs for stack inference
      // Use a higher limit to ensure we capture all potential stacks
      const allPRs = await githubService.listPRs('open', { per_page: 100 });

      // Infer stacks from PR relationships and return full data
      const stacksWithPRs = inferStacksFromPRs(allPRs);

      return stacksWithPRs;
    }
  );

  // Get a specific stack with enriched PR data
  typedServer.get(
    '/:stackId',
    {
      schema: {
        description: 'Get a stack with enriched GitHub PR data',
        tags: ['stacks'],
        params: z.object({
          stackId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        } as any);
      }

      const { stackId } = request.params;

      // Get all open PRs and infer stacks
      // Use a higher limit to ensure we capture all potential stacks
      const allPRs = await githubService.listPRs('open', { per_page: 100 });
      const stacksWithPRs = inferStacksFromPRs(allPRs);

      // Find the requested stack
      const stack = getStackById(stacksWithPRs, stackId);

      if (!stack) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Stack with ID "${stackId}" not found`,
          statusCode: 404,
        });
      }

      return stack;
    }
  );
};
