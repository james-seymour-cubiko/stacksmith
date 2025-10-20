import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { prsAPI } from '../lib/api';
import { GithubReview } from '@review-app/shared';

export function usePRs(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
  return useQuery({
    queryKey: ['prs', owner, repo, 'list', state],
    queryFn: () => prsAPI.list(owner, repo, state),
  });
}

export function usePR(owner: string | undefined, repo: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber],
    queryFn: () => prsAPI.get(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
  });
}

export function usePRDiff(owner: string | undefined, repo: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'diff'],
    queryFn: () => prsAPI.getDiff(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
  });
}

export function usePRReviews(owner: string | undefined, repo: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'reviews'],
    queryFn: () => prsAPI.getReviews(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
  });
}

/**
 * Fetches reviews for multiple PRs in parallel.
 * Returns a map of PR number to reviews array.
 */
export function useBulkPRReviews(owner: string | undefined, repo: string | undefined, prNumbers: number[]) {
  const queries = useQueries({
    queries: prNumbers.map((prNumber) => ({
      queryKey: ['prs', owner, repo, prNumber, 'reviews'],
      queryFn: () => prsAPI.getReviews(owner!, repo!, prNumber),
      enabled: !!owner && !!repo,
    })),
  });

  // Convert to a map for easy lookup
  const reviewsMap = new Map<number, GithubReview[]>();
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  queries.forEach((query, index) => {
    if (query.data) {
      reviewsMap.set(prNumbers[index], query.data);
    }
  });

  return {
    reviewsMap,
    isLoading,
    isError,
    queries,
  };
}

export function usePRComments(owner: string | undefined, repo: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'comments'],
    queryFn: () => prsAPI.getComments(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
  });
}

export function usePRIssueComments(owner: string | undefined, repo: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'issue-comments'],
    queryFn: () => prsAPI.getIssueComments(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
  });
}

export function usePRCommits(owner: string | undefined, repo: string | undefined, prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'commits'],
    queryFn: () => prsAPI.getCommits(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
  });
}

export function usePRCheckRuns(owner: string | undefined, repo: string | undefined, prNumber: number | undefined, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'checks'],
    queryFn: () => prsAPI.getCheckRuns(owner!, repo!, prNumber!),
    enabled: !!owner && !!repo && !!prNumber,
    refetchInterval: options?.refetchInterval,
  });
}

export function useRerunCheckRun(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkRunId: number) => prsAPI.rerunCheckRun(owner, repo, prNumber, checkRunId),
    onSuccess: () => {
      // Delay invalidation to give GitHub time to create new check runs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'checks'] });
      }, 3000);
    },
  });
}

export function useRerunAllChecks(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => prsAPI.rerunAllChecks(owner, repo, prNumber),
    onSuccess: () => {
      // Delay invalidation to give GitHub time to create new check runs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'checks'] });
      }, 3000);
    },
  });
}

export function useCreatePRComment(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      body: string;
      commit_id: string;
      path: string;
      line: number;
    }) => prsAPI.createComment(owner, repo, prNumber, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'comments'] });
    },
  });
}

export function useCreatePRIssueComment(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => prsAPI.createIssueComment(owner, repo, prNumber, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'issue-comments'] });
    },
  });
}

export function useMergePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ owner, repo, prNumber, mergeMethod }: { owner: string; repo: string; prNumber: number; mergeMethod?: 'merge' | 'squash' | 'rebase' }) =>
      prsAPI.mergePR(owner, repo, prNumber, mergeMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
    },
  });
}

export function useApprovePR(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => prsAPI.approvePR(owner, repo, prNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'reviews'] });
    },
  });
}

export function useRequestReviewers(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewers: string[]) => prsAPI.requestReviewers(owner, repo, prNumber, reviewers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber] });
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'reviews'] });
    },
  });
}

export function useDeleteComment(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => prsAPI.deleteComment(owner, repo, prNumber, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'comments'] });
    },
  });
}

export function useDeleteIssueComment(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => prsAPI.deleteIssueComment(owner, repo, prNumber, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'issue-comments'] });
    },
  });
}

export function useReplyToComment(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) =>
      prsAPI.replyToComment(owner, repo, prNumber, commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs', owner, repo, prNumber, 'comments'] });
    },
  });
}
