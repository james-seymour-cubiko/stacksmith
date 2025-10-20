import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { githubServiceManager } from '../services/github-manager.js';

export const prRoutes: FastifyPluginAsync = async (server) => {
  const typedServer = server.withTypeProvider<ZodTypeProvider>();

  // Helper to get the GitHub service for a specific repo
  const getServiceFromQuery = (owner?: string, repo?: string) => {
    if (!owner || !repo) {
      throw new Error('Repository owner and name are required. Please provide owner and repo query parameters.');
    }

    if (!githubServiceManager.isConfigured()) {
      throw new Error('GitHub service not configured');
    }

    return githubServiceManager.getService(owner, repo);
  };

  // List all PRs
  typedServer.get(
    '/',
    {
      schema: {
        description: 'List all pull requests from GitHub',
        tags: ['prs'],
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
          state: z.enum(['open', 'closed', 'all']).optional().default('open'),
          per_page: z.coerce.number().int().min(1).max(100).optional().default(50),
          page: z.coerce.number().int().min(1).optional().default(1),
          sort: z.enum(['created', 'updated', 'popularity', 'long-running']).optional().default('updated'),
          direction: z.enum(['asc', 'desc']).optional().default('desc'),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { owner, repo, state, per_page, page, sort, direction } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const prs = await service.listPRs(state, { per_page, page, sort, direction });
        return prs;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const pr = await service.getPR(prNumber);
        return pr;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const files = await service.getPRFiles(prNumber);
        return files;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const reviews = await service.getPRReviews(prNumber);
        return reviews;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const comments = await service.getPRComments(prNumber);
        return comments;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const comments = await service.getPRIssueComments(prNumber);
        return comments;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const commits = await service.getPRCommits(prNumber);
        return commits;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
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
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const { body, commit_id, path, line, start_line, side, start_side } = request.body;

        const comment = await service.createPRReviewComment(
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
        body: z.object({
          body: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const { body } = request.body;

        const comment = await service.createPRIssueComment(prNumber, body);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const checks = await service.getPRCheckRuns(prNumber);
        return checks;
      } catch (error: any) {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: error.message,
          statusCode: 503,
        });
      }
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { checkRunId } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        await service.rerunCheckRun(checkRunId);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        await service.rerunAllChecksForPR(prNumber);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
        body: z.object({
          merge_method: z.enum(['merge', 'squash', 'rebase']).optional(),
        }).optional(),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const mergeMethod = request.body?.merge_method || 'rebase';

        const result = await service.mergePR(prNumber, mergeMethod);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { commentId } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        await service.deleteReviewComment(commentId);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { commentId } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        await service.deleteIssueComment(commentId);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
        body: z.object({
          body: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber, commentId } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);
        const { body } = request.body;

        const comment = await service.replyToReviewComment(prNumber, body, commentId);
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
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        const review = await service.approvePR(prNumber);
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

  // Close pull request
  typedServer.post(
    '/:prNumber/close',
    {
      schema: {
        description: 'Close a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        const pr = await service.closePR(prNumber);
        return reply.code(200).send(pr);
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to close PR',
          statusCode: 400,
        });
      }
    }
  );

  // Request reviewers for a pull request
  typedServer.post(
    '/:prNumber/reviewers',
    {
      schema: {
        description: 'Request reviewers for a pull request',
        tags: ['prs'],
        params: z.object({
          prNumber: z.coerce.number().int().positive(),
        }),
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
        body: z.object({
          reviewers: z.array(z.string()).min(1),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const { reviewers } = request.body;
        const service = getServiceFromQuery(owner, repo);

        await service.requestReviewers(prNumber, reviewers);
        return reply.code(201).send({ success: true });
      } catch (error) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error instanceof Error ? error.message : 'Failed to request reviewers',
          statusCode: 400,
        });
      }
    }
  );

  // Get conversation threads for a PR
  typedServer.get(
    '/:prNumber/threads',
    {
      schema: {
        description: 'Get conversation threads for a pull request',
        tags: ['prs', 'threads'],
        params: z.object({
          prNumber: z.coerce.number(),
        }),
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        const threads = await service.getConversationThreads(prNumber);
        return reply.send(threads);
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to fetch conversation threads',
          statusCode: 500,
        });
      }
    }
  );

  // Get thread resolution info for a PR
  typedServer.get(
    '/:prNumber/threads/resolution-info',
    {
      schema: {
        description: 'Get thread resolution summary for a pull request',
        tags: ['prs', 'threads'],
        params: z.object({
          prNumber: z.coerce.number(),
        }),
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        const info = await service.getThreadResolutionInfo(prNumber);
        return reply.send(info);
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to fetch thread resolution info',
          statusCode: 500,
        });
      }
    }
  );

  // Resolve a conversation thread
  typedServer.post(
    '/:prNumber/threads/:threadId/resolve',
    {
      schema: {
        description: 'Mark a conversation thread as resolved',
        tags: ['prs', 'threads'],
        params: z.object({
          prNumber: z.coerce.number(),
          threadId: z.string(),
        }),
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber, threadId } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        await service.resolveConversation(threadId);
        return reply.code(200).send({ success: true, resolved: true });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to resolve thread',
          statusCode: 500,
        });
      }
    }
  );

  // Unresolve a conversation thread
  typedServer.post(
    '/:prNumber/threads/:threadId/unresolve',
    {
      schema: {
        description: 'Mark a conversation thread as unresolved',
        tags: ['prs', 'threads'],
        params: z.object({
          prNumber: z.coerce.number(),
          threadId: z.string(),
        }),
        querystring: z.object({
          owner: z.string(),
          repo: z.string(),
        }),
      },
    },
    async (request, reply) => {
      try {
        const { prNumber, threadId } = request.params;
        const { owner, repo } = request.query;
        const service = getServiceFromQuery(owner, repo);

        await service.unresolveConversation(threadId);
        return reply.code(200).send({ success: true, resolved: false });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to unresolve thread',
          statusCode: 500,
        });
      }
    }
  );
};
