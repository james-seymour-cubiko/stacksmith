import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { githubService } from '../services/github.js';

export const prRoutes: FastifyPluginAsync = async (server) => {
  const typedServer = server.withTypeProvider<ZodTypeProvider>();

  // List all PRs
  typedServer.get(
    '/',
    {
      schema: {
        description: 'List all pull requests from GitHub',
        tags: ['prs'],
        querystring: z.object({
          state: z.enum(['open', 'closed', 'all']).optional().default('open'),
          per_page: z.coerce.number().int().min(1).max(100).optional().default(50),
          page: z.coerce.number().int().min(1).optional().default(1),
          sort: z.enum(['created', 'updated', 'popularity', 'long-running']).optional().default('updated'),
          direction: z.enum(['asc', 'desc']).optional().default('desc'),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { state, per_page, page, sort, direction } = request.query;
      const prs = await githubService.listPRs(state, { per_page, page, sort, direction });
      return prs;
    }
  );

  // Get PR details
  typedServer.get(
    '/:prNumber',
    {
      schema: {
        description: 'Get pull request details from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const pr = await githubService.getPR(prNumber);
      return pr;
    }
  );

  // Get PR diff
  typedServer.get(
    '/:prNumber/diff',
    {
      schema: {
        description: 'Get pull request diff/files from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const files = await githubService.getPRFiles(prNumber);
      return files;
    }
  );

  // Get PR reviews
  typedServer.get(
    '/:prNumber/reviews',
    {
      schema: {
        description: 'Get pull request reviews from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const reviews = await githubService.getPRReviews(prNumber);
      return reviews;
    }
  );

  // Get PR review comments (code-specific)
  typedServer.get(
    '/:prNumber/comments',
    {
      schema: {
        description: 'Get pull request review comments from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const comments = await githubService.getPRComments(prNumber);
      return comments;
    }
  );

  // Get PR issue comments (general PR-level comments)
  typedServer.get(
    '/:prNumber/issue-comments',
    {
      schema: {
        description: 'Get pull request issue comments from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const comments = await githubService.getPRIssueComments(prNumber);
      return comments;
    }
  );

  // Get PR commits
  typedServer.get(
    '/:prNumber/commits',
    {
      schema: {
        description: 'Get pull request commits from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const commits = await githubService.getPRCommits(prNumber);
      return commits;
    }
  );

  // Create PR review comment (code-specific)
  typedServer.post(
    '/:prNumber/comments',
    {
      schema: {
        description: 'Create a review comment on a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
        body: z.object({
          body: z.string().min(1),
          commit_id: z.string(),
          path: z.string(),
          line: z.number().int().positive(),
          start_line: z.number().int().positive().optional(),
          side: z.enum(['LEFT', 'RIGHT']).optional(),
          start_side: z.enum(['LEFT', 'RIGHT']).optional(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const { body, commit_id, path, line, start_line, side, start_side } = request.body;

      try {
        const comment = await githubService.createPRReviewComment(
          prNumber,
          body,
          commit_id,
          path,
          line,
          start_line,
          side,
          start_side
        );
        return reply.code(201).send(comment);
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to create comment',
          statusCode: 400,
        });
      }
    }
  );

  // Create PR issue comment (general PR-level comment)
  typedServer.post(
    '/:prNumber/issue-comments',
    {
      schema: {
        description: 'Create a general comment on a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
        body: z.object({
          body: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const { body } = request.body;

      try {
        const comment = await githubService.createPRIssueComment(prNumber, body);
        return reply.code(201).send(comment);
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to create comment',
          statusCode: 400,
        });
      }
    }
  );

  // Get PR check runs
  typedServer.get(
    '/:prNumber/checks',
    {
      schema: {
        description: 'Get pull request check runs from GitHub',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const checks = await githubService.getPRCheckRuns(prNumber);
      return checks;
    }
  );

  // Rerun a specific check run
  typedServer.post(
    '/:prNumber/checks/:checkRunId/rerun',
    {
      schema: {
        description: 'Rerun a specific check run',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
          checkRunId: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { checkRunId } = request.params;

      try {
        await githubService.rerunCheckRun(checkRunId);
        return reply.code(200).send({ success: true });
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to rerun check',
          statusCode: 400,
        });
      }
    }
  );

  // Rerun all checks for a PR
  typedServer.post(
    '/:prNumber/checks/rerun',
    {
      schema: {
        description: 'Rerun all check runs for a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;

      try {
        await githubService.rerunAllChecksForPR(prNumber);
        return reply.code(200).send({ success: true });
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to rerun checks',
          statusCode: 400,
        });
      }
    }
  );

  // Merge PR
  typedServer.post(
    '/:prNumber/merge',
    {
      schema: {
        description: 'Merge a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
        body: z.object({
          merge_method: z.enum(['merge', 'squash', 'rebase']).optional(),
        }).optional(),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;
      const mergeMethod = request.body?.merge_method || 'merge';

      try {
        const result = await githubService.mergePR(prNumber, mergeMethod);
        return reply.code(200).send(result);
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to merge PR',
          statusCode: 400,
        });
      }
    }
  );

  // Delete review comment
  typedServer.delete(
    '/:prNumber/comments/:commentId',
    {
      schema: {
        description: 'Delete a review comment',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
          commentId: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { commentId } = request.params;

      try {
        await githubService.deleteReviewComment(commentId);
        return reply.code(204).send();
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to delete comment',
          statusCode: 400,
        });
      }
    }
  );

  // Delete issue comment
  typedServer.delete(
    '/:prNumber/issue-comments/:commentId',
    {
      schema: {
        description: 'Delete an issue comment',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
          commentId: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { commentId } = request.params;

      try {
        await githubService.deleteIssueComment(commentId);
        return reply.code(204).send();
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to delete comment',
          statusCode: 400,
        });
      }
    }
  );

  // Reply to review comment
  typedServer.post(
    '/:prNumber/comments/:commentId/replies',
    {
      schema: {
        description: 'Reply to a review comment',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
          commentId: z.coerce.number().int().positive(),
        }),
        body: z.object({
          body: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber, commentId } = request.params;
      const { body } = request.body;

      try {
        const comment = await githubService.replyToReviewComment(prNumber, body, commentId);
        return reply.code(201).send(comment);
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to reply to comment',
          statusCode: 400,
        });
      }
    }
  );

  // Approve pull request
  typedServer.post(
    '/:prNumber/approve',
    {
      schema: {
        description: 'Approve a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      if (!githubService.isConfigured()) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'GitHub service not configured',
          statusCode: 503,
        });
      }

      const { prNumber } = request.params;

      try {
        const review = await githubService.approvePR(prNumber);
        return reply.code(201).send(review);
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to approve PR',
          statusCode: 400,
        });
      }
    }
  );
};
