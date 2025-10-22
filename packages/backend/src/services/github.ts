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
      side: comment.side as 'LEFT' | 'RIGHT' | undefined,
      commit_id: comment.commit_id,
      in_reply_to_id: comment.in_reply_to_id || undefined,
      // Outdated comment tracking
      position: comment.position,
      original_position: comment.original_position || undefined,
      diff_hunk: comment.diff_hunk || undefined,
      original_line: comment.original_line || undefined,
      original_commit_id: comment.original_commit_id || undefined,
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

    // Get check runs for that SHA (each check run has a check_suite.id)
    // filter: 'latest' returns only the most recent check runs by completed_at timestamp
    const { data: checkRunsData } = await this.octokit!.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: pr.head.sha,
      filter: 'latest',
    });

    // Get workflow runs for that SHA (each workflow run has check_suite_id and name)
    const { data: workflowRunsData } = await this.octokit!.actions.listWorkflowRunsForRepo({
      owner: this.owner,
      repo: this.repo,
      head_sha: pr.head.sha,
      per_page: 100,
    });

    // Build a map of check_suite_id → workflow_name
    // This allows us to look up workflow names by check suite ID without additional API calls
    const checkSuiteToWorkflowName = new Map<number, string>();
    for (const workflowRun of workflowRunsData.workflow_runs) {
      if (workflowRun.check_suite_id) {
        checkSuiteToWorkflowName.set(workflowRun.check_suite_id, workflowRun.name);
      }
    }

    // Map check runs to include workflow names using check suite IDs
    const checkRunsWithWorkflowNames = checkRunsData.check_runs
      .filter((check) => check.name !== "Graphite / mergeability_check")
      .map((check) => {
        // Look up workflow name using the check run's check suite ID
        let workflowName = '';
        if (check.check_suite?.id) {
          workflowName = checkSuiteToWorkflowName.get(check.check_suite.id) || '';
        }

        // If we found a workflow name, prefix the check name with it
        const displayName = workflowName ? `${workflowName} / ${check.name}` : check.name;

        return {
          id: check.id,
          name: displayName,
          status: check.status as 'queued' | 'in_progress' | 'completed',
          conclusion: check.conclusion as 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null,
          started_at: check.started_at,
          completed_at: check.completed_at,
          html_url: check.html_url,
          details_url: check.details_url,
        };
      });

    // Deduplicate by name, keeping only the latest check run for each job
    // When a job is rerun, GitHub creates a new check run with a higher ID
    // The filter: 'latest' parameter doesn't fully deduplicate when jobs are rerun
    // because in-progress reruns don't have a completed_at timestamp yet
    const latestCheckRuns = new Map<string, typeof checkRunsWithWorkflowNames[0]>();
    for (const checkRun of checkRunsWithWorkflowNames) {
      const existing = latestCheckRuns.get(checkRun.name);
      if (!existing || checkRun.id > existing.id) {
        latestCheckRuns.set(checkRun.name, checkRun);
      }
    }

    return Array.from(latestCheckRuns.values());
  }

  async rerunCheckRun(checkRunId: number): Promise<void> {
    this.ensureConfigured();

    try {
      // For GitHub Actions, check run IDs and job IDs are the same
      // Use reRunJobForWorkflowRun to rerun just this specific job
      await this.octokit!.actions.reRunJobForWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        job_id: checkRunId,
      });
    } catch (error: any) {
      // If the Actions API fails, try the Checks API (for non-Actions checks)
      if (error.status === 404 || error.status === 422) {
        try {
          await this.octokit!.checks.rerequestRun({
            owner: this.owner,
            repo: this.repo,
            check_run_id: checkRunId,
          });
          return;
        } catch (checksError: any) {
          if (checksError.status === 403) {
            throw new Error('You do not have permission to rerun this check. Make sure your token has the necessary permissions.');
          }
          throw checksError;
        }
      }
      if (error.status === 403) {
        throw new Error('You do not have permission to rerun this check. Make sure your token has the necessary permissions.');
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
            line: parentComment.line || parentComment.original_line!,
            outdated: thread.isOutdated || (parentComment.position === null && !!parentComment.original_position),
            diffHunk: parentComment.diff_hunk,
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
        const isOutdated = comment.position === null && !!comment.original_position;
        threads.push({
          id: `fallback-${comment.id}`,
          parentComment: comment,
          replies,
          resolved: false, // Can't determine without GraphQL
          path: comment.path,
          line: comment.line || comment.original_line!,
          outdated: isOutdated,
          diffHunk: comment.diff_hunk,
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

  async getCollaborators() {
    this.ensureConfigured();

    try {
      const { data } = await this.octokit!.repos.listCollaborators({
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      return data.map((user: any) => ({
        login: user.login,
        id: user.id,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
      }));
    } catch (error: any) {
      console.error('Error fetching collaborators:', error);
      throw new Error(`Failed to fetch collaborators: ${error.message}`);
    }
  }

  async getRateLimit() {
    this.ensureConfigured();

    try {
      // Get REST API rate limit
      const { data: restRateLimit } = await this.octokit!.rateLimit.get();

      // Get GraphQL rate limit using GraphQL query
      const graphqlQuery = `
        query {
          rateLimit {
            limit
            remaining
            resetAt
            used
          }
        }
      `;

      const graphqlRateLimit: any = await this.octokit!.graphql(graphqlQuery);

      return {
        rest: {
          limit: restRateLimit.rate.limit,
          remaining: restRateLimit.rate.remaining,
          reset: restRateLimit.rate.reset,
          used: restRateLimit.rate.used,
          resetAt: new Date(restRateLimit.rate.reset * 1000).toISOString(),
        },
        graphql: {
          limit: graphqlRateLimit.rateLimit.limit,
          remaining: graphqlRateLimit.rateLimit.remaining,
          resetAt: graphqlRateLimit.rateLimit.resetAt,
          used: graphqlRateLimit.rateLimit.used,
        },
      };
    } catch (error: any) {
      console.error('Error fetching rate limit:', error);
      throw new Error(`Failed to fetch rate limit: ${error.message}`);
    }
  }
}

// Singleton instance
export const githubService = new GithubService();
