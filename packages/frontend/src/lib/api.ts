import type {
  Stack,
  StackWithPRs,
  GithubPR,
  GithubDiff,
  GithubReview,
  GithubComment,
  GithubCommit,
  GithubCheckRun,
  ConfigureGithubRequest,
  GithubConfig,
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
  list: () => fetchAPI<Stack[]>('/stacks'),
  get: (stackId: string) => fetchAPI<StackWithPRs>(`/stacks/${stackId}`),
};

// PR API
export const prsAPI = {
  list: (
    state: 'open' | 'closed' | 'all' = 'open',
    options?: {
      per_page?: number;
      page?: number;
      sort?: 'created' | 'updated' | 'popularity' | 'long-running';
      direction?: 'asc' | 'desc';
    }
  ) => {
    const params = new URLSearchParams({ state });
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.sort) params.append('sort', options.sort);
    if (options?.direction) params.append('direction', options.direction);
    return fetchAPI<GithubPR[]>(`/prs?${params.toString()}`);
  },

  get: (prNumber: number) => fetchAPI<GithubPR>(`/prs/${prNumber}`),

  getDiff: (prNumber: number) => fetchAPI<GithubDiff[]>(`/prs/${prNumber}/diff`),

  getReviews: (prNumber: number) => fetchAPI<GithubReview[]>(`/prs/${prNumber}/reviews`),

  getComments: (prNumber: number) => fetchAPI<GithubComment[]>(`/prs/${prNumber}/comments`),

  getIssueComments: (prNumber: number) => fetchAPI<GithubComment[]>(`/prs/${prNumber}/issue-comments`),

  getCommits: (prNumber: number) => fetchAPI<GithubCommit[]>(`/prs/${prNumber}/commits`),

  getCheckRuns: (prNumber: number) => fetchAPI<GithubCheckRun[]>(`/prs/${prNumber}/checks`),

  rerunCheckRun: (prNumber: number, checkRunId: number) =>
    fetchAPI<{ success: boolean }>(`/prs/${prNumber}/checks/${checkRunId}/rerun`, {
      method: 'POST',
    }),

  rerunAllChecks: (prNumber: number) =>
    fetchAPI<{ success: boolean }>(`/prs/${prNumber}/checks/rerun`, {
      method: 'POST',
    }),

  createComment: (prNumber: number, data: {
    body: string;
    commit_id: string;
    path: string;
    line: number;
    start_line?: number;
    side?: 'LEFT' | 'RIGHT';
    start_side?: 'LEFT' | 'RIGHT';
  }) =>
    fetchAPI<GithubComment>(`/prs/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createIssueComment: (prNumber: number, body: string) =>
    fetchAPI<GithubComment>(`/prs/${prNumber}/issue-comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  mergePR: (prNumber: number, mergeMethod?: 'merge' | 'squash' | 'rebase') =>
    fetchAPI<{ merged: boolean; message: string; sha?: string }>(`/prs/${prNumber}/merge`, {
      method: 'POST',
      body: JSON.stringify({ merge_method: mergeMethod }),
    }),

  deleteComment: (prNumber: number, commentId: number) =>
    fetchAPI<void>(`/prs/${prNumber}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  deleteIssueComment: (prNumber: number, commentId: number) =>
    fetchAPI<void>(`/prs/${prNumber}/issue-comments/${commentId}`, {
      method: 'DELETE',
    }),

  replyToComment: (prNumber: number, commentId: number, body: string) =>
    fetchAPI<GithubComment>(`/prs/${prNumber}/comments/${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};

// Config API
export const configAPI = {
  getGithub: () => fetchAPI<GithubConfig>('/config/github'),

  configureGithub: (data: ConfigureGithubRequest) =>
    fetchAPI<{ success: boolean }>('/config/github', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
