import { Octokit } from '@octokit/rest';
import type { GithubPR, GithubReview, GithubComment, GithubCommit, GithubDiff, GithubCheckRun, CommentThread, ThreadResolutionInfo } from '@review-app/shared';

export class GithubService {
  private octokit: Octokit | null = null;
  private owner: string = '';
  private repo: string = '';
  private currentUser: string = '';

  configure(owner: string, repo: string, token?: string, currentUser?: string) {
    this.owner = owner;
    this.repo = repo;
    this.currentUser = currentUser || '';
    this.octokit = new Octokit({
      auth: token,
    });
  }

  isConfigured(): boolean {
    return this.octokit !== null && this.owner !== '' && this.repo !== '';
  }

  getConfig() {
    return {
      owner: this.owner,
      repo: this.repo,
      currentUser: this.currentUser || undefined,
    };
  }

  private ensureConfigured() {
    if (!this.isConfigured()) {
      throw new Error('GitHub service not configured. Please configure with owner, repo, and token.');
    }
  }

  async getPR(prNumber: number): Promise<GithubPR> {
    this.ensureConfigured();

    try {
      const { data } = await this.octokit!.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return this.mapPRResponse(data);
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Pull request #${prNumber} not found in ${this.owner}/${this.repo}.`);
      }
      if (error.status === 401) {
        throw new Error('GitHub authentication failed. Please check your token.');
      }
      throw error;
    }
  }

  async listPRs(
    state: 'open' | 'closed' | 'all' = 'open',
    options?: { per_page?: number; page?: number; sort?: 'created' | 'updated' | 'popularity' | 'long-running'; direction?: 'asc' | 'desc' }
  ): Promise<GithubPR[]> {
    this.ensureConfigured();

    try {
      const { data } = await this.octokit!.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state,
        per_page: options?.per_page ?? 50, // Reduced from 100 to 50 for better performance
        page: options?.page ?? 1,
        sort: options?.sort ?? 'updated', // Default to most recently updated
        direction: options?.direction ?? 'desc', // Newest first
      });

      return data.map((pr) => this.mapPRResponse(pr));
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${this.owner}/${this.repo} not found. Please check your GitHub configuration.`);
      }
      if (error.status === 401) {
        throw new Error('GitHub authentication failed. Please check your token.');
      }
      throw error;
    }
  }

  async getPRReviews(prNumber: number): Promise<GithubReview[]> {
    this.ensureConfigured();

    const { data } = await this.octokit!.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return data.map((review) => ({
      id: review.id,
      user: {
        login: review.user?.login || 'unknown',
        id: review.user?.id || 0,
        avatar_url: review.user?.avatar_url || '',
        html_url: review.user?.html_url || '',
      },
      body: review.body || '',
      state: review.state as GithubReview['state'],
      html_url: review.html_url,
      submitted_at: review.submitted_at || new Date().toISOString(),
    }));
  }

  async getPRComments(prNumber: number): Promise<GithubComment[]> {
    this.ensureConfigured();

    const { data } = await this.octokit!.pulls.listReviewComments({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return data.map((comment) => ({
      id: comment.id,
      user: {
        login: comment.user?.login || 'unknown',
        id: comment.user?.id || 0,
        avatar_url: comment.user?.avatar_url || '',
        html_url: comment.user?.html_url || '',
      },
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      html_url: comment.html_url,
      path: comment.path,
      line: comment.line || undefined,
      commit_id: comment.commit_id,
      in_reply_to_id: comment.in_reply_to_id || undefined,
    }));
  }

  async getPRIssueComments(prNumber: number): Promise<GithubComment[]> {
    this.ensureConfigured();

    const { data } = await this.octokit!.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
    });

    return data.map((comment) => ({
      id: comment.id,
      user: {
        login: comment.user?.login || 'unknown',
        id: comment.user?.id || 0,
        avatar_url: comment.user?.avatar_url || '',
        html_url: comment.user?.html_url || '',
      },
      body: comment.body || '',
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      html_url: comment.html_url,
      path: undefined,
      line: undefined,
      commit_id: '',
    }));
  }

  async createPRIssueComment(prNumber: number, body: string): Promise<GithubComment> {
    this.ensureConfigured();

    const { data } = await this.octokit!.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });

    return {
      id: data.id,
      user: {
        login: data.user?.login || 'unknown',
        id: data.user?.id || 0,
        avatar_url: data.user?.avatar_url || '',
        html_url: data.user?.html_url || '',
      },
      body: data.body || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      html_url: data.html_url,
      path: undefined,
      line: undefined,
      commit_id: '',
    };
  }

  async deleteReviewComment(commentId: number): Promise<void> {
    this.ensureConfigured();

    try {
      await this.octokit!.pulls.deleteReviewComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId,
      });
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error('Comment not found.');
      }
      if (error.status === 403) {
        throw new Error('You do not have permission to delete this comment.');
      }
      throw error;
    }
  }

  async deleteIssueComment(commentId: number): Promise<void> {
    this.ensureConfigured();

    try {
      await this.octokit!.issues.deleteComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId,
      });
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error('Comment not found.');
      }
      if (error.status === 403) {
        throw new Error('You do not have permission to delete this comment.');
      }
      throw error;
    }
  }

  async replyToReviewComment(prNumber: number, body: string, inReplyTo: number): Promise<GithubComment> {
    this.ensureConfigured();

    try {
      const { data } = await this.octokit!.pulls.createReplyForReviewComment({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        comment_id: inReplyTo,
        body,
      });

      return {
        id: data.id,
        user: {
          login: data.user?.login || 'unknown',
          id: data.user?.id || 0,
          avatar_url: data.user?.avatar_url || '',
          html_url: data.user?.html_url || '',
        },
        body: data.body,
        created_at: data.created_at,
        updated_at: data.updated_at,
        html_url: data.html_url,
        path: data.path,
        line: data.line || undefined,
        commit_id: data.commit_id,
      };
    } catch (error: any) {
      if (error.status === 422) {
        throw new Error('Cannot reply to this comment.');
      }
      throw error;
    }
  }

  async mergePR(prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase'): Promise<{ merged: boolean; message: string; sha?: string }> {
    this.ensureConfigured();

    try {
      const { data } = await this.octokit!.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
      });

      return {
        merged: data.merged,
        message: data.message,
        sha: data.sha,
      };
    } catch (error: any) {
      if (error.status === 405) {
        throw new Error('Pull request is not mergeable. Check if it has conflicts or required checks are failing.');
      }
      if (error.status === 409) {
        throw new Error('Pull request head was modified. Review and try again.');
      }
      throw error;
    }
  }

  async getPRCheckRuns(prNumber: number): Promise<GithubCheckRun[]> {
    this.ensureConfigured();

    // First get the PR to get the head SHA
    const { data: pr } = await this.octokit!.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // Then get check runs for that SHA
    const { data } = await this.octokit!.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: pr.head.sha,
    });

    return data.check_runs.filter((check) => check.name !== "Graphite / mergeability_check").map((check) => ({
      id: check.id,
      name: check.name,
      status: check.status as 'queued' | 'in_progress' | 'completed',
      conclusion: check.conclusion as 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null,
      started_at: check.started_at,
      completed_at: check.completed_at,
      html_url: check.html_url,
      details_url: check.details_url,
    }));
  }

  async rerunCheckRun(checkRunId: number): Promise<void> {
    this.ensureConfigured();

    try {
      // First, try to get the check run to find its associated workflow run
      const { data: checkRun } = await this.octokit!.checks.get({
        owner: this.owner,
        repo: this.repo,
        check_run_id: checkRunId,
      });

      // If this check run has a check suite, try to find the workflow run
      if (checkRun.check_suite) {
        // List all workflow runs for the check suite's head SHA
        const { data: workflowRuns } = await this.octokit!.actions.listWorkflowRunsForRepo({
          owner: this.owner,
          repo: this.repo,
          head_sha: checkRun.head_sha,
          per_page: 100,
        });

        // Find the specific workflow run that contains this check by matching job names
        for (const run of workflowRuns.workflow_runs) {
          if (run.status !== 'completed') continue;

          // Get jobs for this workflow run
          const { data: jobs } = await this.octokit!.actions.listJobsForWorkflowRun({
            owner: this.owner,
            repo: this.repo,
            run_id: run.id,
          });

          // Check if this workflow run has a job with the same name as our check
          const matchingJob = jobs.jobs.find((job) => job.name === checkRun.name);

          if (matchingJob) {
            // Found the workflow that contains this specific check
            // Rerun only this workflow (not all workflows)
            await this.octokit!.actions.reRunWorkflow({
              owner: this.owner,
              repo: this.repo,
              run_id: run.id,
            });
            return;
          }
        }

        // If we didn't find a matching workflow, just rerun the first completed one
        const firstCompleted = workflowRuns.workflow_runs.find((run) => run.status === 'completed');
        if (firstCompleted) {
          await this.octokit!.actions.reRunWorkflow({
            owner: this.owner,
            repo: this.repo,
            run_id: firstCompleted.id,
          });
          return;
        }
      }

      // Fallback: Try the checks API rerequestRun (for non-Actions checks)
      await this.octokit!.checks.rerequestRun({
        owner: this.owner,
        repo: this.repo,
        check_run_id: checkRunId,
      });
    } catch (error: any) {
      if (error.status === 403) {
        throw new Error('You do not have permission to rerun this check. Make sure your token has the necessary permissions.');
      }
      if (error.status === 404) {
        throw new Error('Check run or workflow not found.');
      }
      throw error;
    }
  }

  async rerunAllChecksForPR(prNumber: number): Promise<void> {
    this.ensureConfigured();

    // Get the PR to get the head SHA
    const { data: pr } = await this.octokit!.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // Get all workflow runs for this PR's head SHA
    const { data: workflowRuns } = await this.octokit!.actions.listWorkflowRunsForRepo({
      owner: this.owner,
      repo: this.repo,
      head_sha: pr.head.sha,
      per_page: 100,
    });

    // Rerun all completed/failed workflow runs
    const rerunPromises = workflowRuns.workflow_runs
      .filter((run) => run.status === 'completed' || run.status === 'failure')
      .map((run) =>
        this.octokit!.actions.reRunWorkflow({
          owner: this.owner,
          repo: this.repo,
          run_id: run.id,
        }).catch((error) => {
          // Log error but don't fail the whole operation
          console.error(`Failed to rerun workflow ${run.name}:`, error.message);
        })
      );

    await Promise.all(rerunPromises);
  }

  async getPRCommits(prNumber: number): Promise<GithubCommit[]> {
    this.ensureConfigured();

    const { data } = await this.octokit!.pulls.listCommits({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      commit: {
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'unknown',
          email: commit.commit.author?.email || '',
          date: commit.commit.author?.date || new Date().toISOString(),
        },
      },
      html_url: commit.html_url,
      author: commit.author
        ? {
            login: commit.author.login,
            id: commit.author.id,
            avatar_url: commit.author.avatar_url,
            html_url: commit.author.html_url,
          }
        : null,
    }));
  }

  async getPRFiles(prNumber: number): Promise<GithubDiff[]> {
    this.ensureConfigured();

    const { data } = await this.octokit!.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return data.map((file) => ({
      sha: file.sha,
      filename: file.filename,
      status: file.status as GithubDiff['status'],
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previous_filename: file.previous_filename,
    }));
  }

  async createPRReviewComment(
    prNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number,
    startLine?: number,
    side?: 'LEFT' | 'RIGHT',
    startSide?: 'LEFT' | 'RIGHT'
  ): Promise<GithubComment> {
    this.ensureConfigured();

    try {
      const params: any = {
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        body,
        commit_id: commitId,
        path,
        line,
      };

      // Add optional parameters for multi-line comments
      if (startLine !== undefined) {
        params.start_line = startLine;
      }
      if (side !== undefined) {
        params.side = side;
      }
      if (startSide !== undefined) {
        params.start_side = startSide;
      }

      const { data } = await this.octokit!.pulls.createReviewComment(params);

      return {
        id: data.id,
        user: {
          login: data.user?.login || 'unknown',
          id: data.user?.id || 0,
          avatar_url: data.user?.avatar_url || '',
          html_url: data.user?.html_url || '',
        },
        body: data.body,
        created_at: data.created_at,
        updated_at: data.updated_at,
        html_url: data.html_url,
        path: data.path,
        line: data.line || undefined,
        commit_id: data.commit_id,
      };
    } catch (error: any) {
      if (error.status === 422) {
        throw new Error('Cannot comment on this line. GitHub only allows comments on modified lines.');
      }
      throw error;
    }
  }

  private mapPRResponse(data: any): GithubPR {
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      html_url: data.html_url,
      user: {
        login: data.user.login,
        id: data.user.id,
        avatar_url: data.user.avatar_url,
        html_url: data.user.html_url,
      },
      created_at: data.created_at,
      updated_at: data.updated_at,
      closed_at: data.closed_at,
      merged_at: data.merged_at,
      draft: data.draft,
      head: {
        ref: data.head.ref,
        sha: data.head.sha,
      },
      base: {
        ref: data.base.ref,
        sha: data.base.sha,
      },
      labels: data.labels.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })),
      assignees: data.assignees.map((assignee: any) => ({
        login: assignee.login,
        id: assignee.id,
        avatar_url: assignee.avatar_url,
        html_url: assignee.html_url,
      })),
      requested_reviewers: data.requested_reviewers.map((reviewer: any) => ({
        login: reviewer.login,
        id: reviewer.id,
        avatar_url: reviewer.avatar_url,
        html_url: reviewer.html_url,
      })),
      mergeable: data.mergeable,
      mergeable_state: data.mergeable_state,
      comments: data.comments,
      review_comments: data.review_comments,
      commits: data.commits,
      additions: data.additions,
      deletions: data.deletions,
      changed_files: data.changed_files,
    };
  }

  async requestReviewers(prNumber: number, reviewers: string[]): Promise<void> {
    this.ensureConfigured();

    await this.octokit!.pulls.requestReviewers({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      reviewers,
    });
  }

  async approvePR(prNumber: number): Promise<GithubReview> {
    this.ensureConfigured();

    const { data } = await this.octokit!.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      event: 'APPROVE',
    });

    return {
      id: data.id,
      user: {
        login: data.user?.login || '',
        id: data.user?.id || 0,
        avatar_url: data.user?.avatar_url || '',
        html_url: data.user?.html_url || '',
      },
      body: data.body || '',
      state: data.state as 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING',
      html_url: data.html_url,
      submitted_at: data.submitted_at || new Date().toISOString(),
    };
  }

  async closePR(prNumber: number): Promise<GithubPR> {
    this.ensureConfigured();

    try {
      const { data } = await this.octokit!.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        state: 'closed',
      });

      return this.mapPRResponse(data);
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Pull request #${prNumber} not found.`);
      }
      if (error.status === 403) {
        throw new Error('You do not have permission to close this pull request.');
      }
      throw error;
    }
  }

  /**
   * Fetches conversation threads for a PR with resolution status using GraphQL
   */
  async getConversationThreads(prNumber: number): Promise<CommentThread[]> {
    this.ensureConfigured();

    // Get regular comments first
    const comments = await this.getPRComments(prNumber);

    // Filter only review comments that have a path (inline code comments)
    const inlineComments = comments.filter(c => c.path);

    // Use GraphQL to get conversation/thread data with resolution status
    const query = `
      query($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                isOutdated
                comments(first: 50) {
                  nodes {
                    databaseId
                    body
                    path
                    line
                    author {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result: any = await this.octokit!.graphql(query, {
        owner: this.owner,
        repo: this.repo,
        prNumber,
      });

      const threads: CommentThread[] = [];
      const reviewThreads = result.repository.pullRequest.reviewThreads.nodes;

      for (const thread of reviewThreads) {
        const threadCommentIds = thread.comments.nodes.map((c: any) => c.databaseId);

        // Find the matching comments from our REST API comments
        const threadComments = inlineComments.filter(c =>
          threadCommentIds.includes(c.id)
        );

        if (threadComments.length > 0) {
          // Sort by created_at to find parent
          threadComments.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          const parentComment = threadComments[0];
          const replies = threadComments.slice(1);

          threads.push({
            id: thread.id,
            parentComment: {
              ...parentComment,
              conversation_id: thread.id,
            },
            replies: replies.map(r => ({
              ...r,
              conversation_id: thread.id,
            })),
            resolved: thread.isResolved,
            path: parentComment.path!,
            line: parentComment.line!,
          });
        }
      }

      return threads;
    } catch (error: any) {
      console.error('Error fetching conversation threads:', error);
      // Fallback: group comments manually without resolution status
      return this.groupCommentsIntoThreadsFallback(inlineComments);
    }
  }

  /**
   * Fallback method to group comments into threads without GraphQL
   */
  private groupCommentsIntoThreadsFallback(comments: GithubComment[]): CommentThread[] {
    const threads: CommentThread[] = [];
    const threadMap = new Map<number, GithubComment[]>();

    // Group by in_reply_to_id
    for (const comment of comments) {
      if (comment.in_reply_to_id) {
        if (!threadMap.has(comment.in_reply_to_id)) {
          threadMap.set(comment.in_reply_to_id, []);
        }
        threadMap.get(comment.in_reply_to_id)!.push(comment);
      }
    }

    // Create threads
    for (const comment of comments) {
      if (!comment.in_reply_to_id && comment.path) {
        // This is a parent comment
        const replies = threadMap.get(comment.id) || [];
        threads.push({
          id: `fallback-${comment.id}`,
          parentComment: comment,
          replies,
          resolved: false, // Can't determine without GraphQL
          path: comment.path,
          line: comment.line!,
        });
      }
    }

    return threads;
  }

  /**
   * Resolves a conversation thread using GraphQL
   */
  async resolveConversation(threadId: string): Promise<void> {
    this.ensureConfigured();

    const mutation = `
      mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread {
            id
            isResolved
          }
        }
      }
    `;

    try {
      await this.octokit!.graphql(mutation, { threadId });
    } catch (error: any) {
      console.error('Error resolving conversation:', error);
      throw new Error(`Failed to resolve thread: ${error.message}`);
    }
  }

  /**
   * Unresolves a conversation thread using GraphQL
   */
  async unresolveConversation(threadId: string): Promise<void> {
    this.ensureConfigured();

    const mutation = `
      mutation($threadId: ID!) {
        unresolveReviewThread(input: { threadId: $threadId }) {
          thread {
            id
            isResolved
          }
        }
      }
    `;

    try {
      await this.octokit!.graphql(mutation, { threadId });
    } catch (error: any) {
      console.error('Error unresolving conversation:', error);
      throw new Error(`Failed to unresolve thread: ${error.message}`);
    }
  }

  /**
   * Computes thread resolution info for a PR
   */
  async getThreadResolutionInfo(prNumber: number): Promise<ThreadResolutionInfo> {
    const threads = await this.getConversationThreads(prNumber);

    const totalThreads = threads.length;
    const unresolvedCount = threads.filter(t => !t.resolved).length;
    const byFile: Record<string, number> = {};

    for (const thread of threads) {
      if (!thread.resolved) {
        byFile[thread.path] = (byFile[thread.path] || 0) + 1;
      }
    }

    return {
      totalThreads,
      unresolvedCount,
      byFile,
    };
  }
}

// Singleton instance
export const githubService = new GithubService();
