import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { githubServiceManager } from '../services/github-manager.js';
import { ConfigureGithubSchema } from '../schemas/index.js';

export const configRoutes: FastifyPluginAsync = async (server) => {
  const typedServer = server.withTypeProvider<ZodTypeProvider>();

  // Get current GitHub configuration
  typedServer.get(
    '/github',
    {
      schema: {
        description: 'Get current GitHub configuration (without token)',
        tags: ['config'],
      },
    },
    async (_request, reply) => {
      if (!githubServiceManager.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      return githubServiceManager.getConfig();
    }
  );

  // Configure GitHub
  typedServer.post(
    '/github',
    {
      schema: {
        description: 'Configure GitHub integration',
        tags: ['config'],
        body: ConfigureGithubSchema,
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (request, _reply) => {
      const { owner, repo, token, currentUser } = request.body;
      githubService.configure(owner, repo, token, currentUser);
      return { success: true };
    }
  );

  // Get GitHub API rate limit
  typedServer.get(
    '/github/rate-limit',
    {
      schema: {
        description: 'Get GitHub API rate limit information',
        tags: ['config'],
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { owner, repo } = request.query;

        if (!githubServiceManager.isConfigured()) {
          return reply.code(503).send({
            error: 'Service Unavailable',
            message: 'GitHub service not configured',
            statusCode: 503,
          });
        }

        const service = githubServiceManager.getService(owner, repo);
        const rateLimit = await service.getRateLimit();
        return rateLimit;
      } catch (error: any) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error.message,
          statusCode: 500,
        });
      }
    }
  );
};
