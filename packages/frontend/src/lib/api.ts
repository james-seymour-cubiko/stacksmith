import type {
  StackWithPRs,
  GithubPR,
  GithubDiff,
  GithubReview,
  GithubComment,
  GithubCommit,
  GithubCheckRun,
  ConfigureGithubRequest,
  GithubConfig,
  CommentThread,
  ThreadResolutionInfo,
  MultiRepoConfig,
} from '@review-app/shared';

const API_BASE = '/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };

  // Only set Content-Type if there's a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Stack API
export const stacksAPI = {
  list: (repo?: string) => {
    const params = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    return fetchAPI<StackWithPRs[]>(`/stacks${params}`);
  },
  get: (owner: string, repo: string, stackId: string) =>
    fetchAPI<StackWithPRs>(`/stacks/${owner}/${repo}/${stackId}`),
};

// PR API
export const prsAPI = {
  list: (
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    options?: {
      per_page?: number;
      page?: number;
      sort?: 'created' | 'updated' | 'popularity' | 'long-running';
      direction?: 'asc' | 'desc';
    }
  ) => {
    const params = new URLSearchParams({ owner, repo, state });
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.sort) params.append('sort', options.sort);
    if (options?.direction) params.append('direction', options.direction);
    return fetchAPI<GithubPR[]>(`/prs?${params.toString()}`);
  },

  get: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubPR>(`/prs/${prNumber}?owner=${owner}&repo=${repo}`),

  getDiff: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubDiff[]>(`/prs/${prNumber}/diff?owner=${owner}&repo=${repo}`),

  getReviews: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubReview[]>(`/prs/${prNumber}/reviews?owner=${owner}&repo=${repo}`),

  getComments: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubComment[]>(`/prs/${prNumber}/comments?owner=${owner}&repo=${repo}`),

  getIssueComments: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubComment[]>(`/prs/${prNumber}/issue-comments?owner=${owner}&repo=${repo}`),

  getCommits: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubCommit[]>(`/prs/${prNumber}/commits?owner=${owner}&repo=${repo}`),

  getCheckRuns: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubCheckRun[]>(`/prs/${prNumber}/checks?owner=${owner}&repo=${repo}`),

  rerunCheckRun: (owner: string, repo: string, prNumber: number, checkRunId: number) =>
    fetchAPI<{ success: boolean }>(`/prs/${prNumber}/checks/${checkRunId}/rerun?owner=${owner}&repo=${repo}`, {
      method: 'POST',
    }),

  rerunAllChecks: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<{ success: boolean }>(`/prs/${prNumber}/checks/rerun?owner=${owner}&repo=${repo}`, {
      method: 'POST',
    }),

  createComment: (owner: string, repo: string, prNumber: number, data: {
    body: string;
    commit_id: string;
    path: string;
    line: number;
    start_line?: number;
    side?: 'LEFT' | 'RIGHT';
    start_side?: 'LEFT' | 'RIGHT';
  }) =>
    fetchAPI<GithubComment>(`/prs/${prNumber}/comments?owner=${owner}&repo=${repo}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createIssueComment: (owner: string, repo: string, prNumber: number, body: string) =>
    fetchAPI<GithubComment>(`/prs/${prNumber}/issue-comments?owner=${owner}&repo=${repo}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  mergePR: (owner: string, repo: string, prNumber: number, mergeMethod?: 'merge' | 'squash' | 'rebase') =>
    fetchAPI<{ merged: boolean; message: string; sha?: string }>(`/prs/${prNumber}/merge?owner=${owner}&repo=${repo}`, {
      method: 'POST',
      body: JSON.stringify({ merge_method: mergeMethod }),
    }),

  deleteComment: (owner: string, repo: string, prNumber: number, commentId: number) =>
    fetchAPI<void>(`/prs/${prNumber}/comments/${commentId}?owner=${owner}&repo=${repo}`, {
      method: 'DELETE',
    }),

  deleteIssueComment: (owner: string, repo: string, prNumber: number, commentId: number) =>
    fetchAPI<void>(`/prs/${prNumber}/issue-comments/${commentId}?owner=${owner}&repo=${repo}`, {
      method: 'DELETE',
    }),

  replyToComment: (owner: string, repo: string, prNumber: number, commentId: number, body: string) =>
    fetchAPI<GithubComment>(`/prs/${prNumber}/comments/${commentId}/replies?owner=${owner}&repo=${repo}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  approvePR: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubReview>(`/prs/${prNumber}/approve?owner=${owner}&repo=${repo}`, {
      method: 'POST',
    }),

  closePR: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<GithubPR>(`/prs/${prNumber}/close?owner=${owner}&repo=${repo}`, {
      method: 'POST',
    }),

  requestReviewers: (owner: string, repo: string, prNumber: number, reviewers: string[]) =>
    fetchAPI<{ success: boolean }>(`/prs/${prNumber}/reviewers?owner=${owner}&repo=${repo}`, {
      method: 'POST',
      body: JSON.stringify({ reviewers }),
    }),

  // Thread operations
  getThreads: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<CommentThread[]>(`/prs/${prNumber}/threads?owner=${owner}&repo=${repo}`),

  getThreadResolutionInfo: (owner: string, repo: string, prNumber: number) =>
    fetchAPI<ThreadResolutionInfo>(`/prs/${prNumber}/threads/resolution-info?owner=${owner}&repo=${repo}`),

  resolveThread: (owner: string, repo: string, prNumber: number, threadId: string) =>
    fetchAPI<{ success: boolean; resolved: boolean }>(`/prs/${prNumber}/threads/${threadId}/resolve?owner=${owner}&repo=${repo}`, {
      method: 'POST',
    }),

  unresolveThread: (owner: string, repo: string, prNumber: number, threadId: string) =>
    fetchAPI<{ success: boolean; resolved: boolean }>(`/prs/${prNumber}/threads/${threadId}/unresolve?owner=${owner}&repo=${repo}`, {
      method: 'POST',
    }),

  getCollaborators: (owner: string, repo: string) =>
    fetchAPI<{ login: string; id: number; avatar_url: string; html_url: string }[]>(`/prs/collaborators?owner=${owner}&repo=${repo}`),
};

// Config API
export const configAPI = {
  getGithub: () => fetchAPI<MultiRepoConfig>('/config/github'),

  configureGithub: (data: ConfigureGithubRequest) =>
    fetchAPI<{ success: boolean }>('/config/github', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
