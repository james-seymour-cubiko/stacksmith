import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prsAPI } from '../lib/api';

export function usePRs(state: 'open' | 'closed' | 'all' = 'open') {
  return useQuery({
    queryKey: ['prs', 'list', state],
    queryFn: () => prsAPI.list(state),
  });
}

export function usePR(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', prNumber],
    queryFn: () => prsAPI.get(prNumber!),
    enabled: !!prNumber,
  });
}

export function usePRDiff(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', prNumber, 'diff'],
    queryFn: () => prsAPI.getDiff(prNumber!),
    enabled: !!prNumber,
  });
}

export function usePRReviews(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', prNumber, 'reviews'],
    queryFn: () => prsAPI.getReviews(prNumber!),
    enabled: !!prNumber,
  });
}

export function usePRComments(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', prNumber, 'comments'],
    queryFn: () => prsAPI.getComments(prNumber!),
    enabled: !!prNumber,
  });
}

export function usePRIssueComments(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', prNumber, 'issue-comments'],
    queryFn: () => prsAPI.getIssueComments(prNumber!),
    enabled: !!prNumber,
  });
}

export function usePRCommits(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['prs', prNumber, 'commits'],
    queryFn: () => prsAPI.getCommits(prNumber!),
    enabled: !!prNumber,
  });
}

export function usePRCheckRuns(prNumber: number | undefined, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['prs', prNumber, 'checks'],
    queryFn: () => prsAPI.getCheckRuns(prNumber!),
    enabled: !!prNumber,
    refetchInterval: options?.refetchInterval,
  });
}

export function useRerunCheckRun(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkRunId: number) => prsAPI.rerunCheckRun(prNumber, checkRunId),
    onSuccess: () => {
      // Delay invalidation to give GitHub time to create new check runs
      // GitHub takes a moment to start the new workflow and create check runs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'checks'] });
      }, 3000); // 3 second delay
    },
  });
}

export function useRerunAllChecks(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => prsAPI.rerunAllChecks(prNumber),
    onSuccess: () => {
      // Delay invalidation to give GitHub time to create new check runs
      // GitHub takes a moment to start the new workflows and create check runs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'checks'] });
      }, 3000); // 3 second delay
    },
  });
}

export function useCreatePRComment(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      body: string;
      commit_id: string;
      path: string;
      line: number;
    }) => prsAPI.createComment(prNumber, data),
    onSuccess: () => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'comments'] });
    },
  });
}

export function useCreatePRIssueComment(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => prsAPI.createIssueComment(prNumber, body),
    onSuccess: () => {
      // Invalidate issue comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'issue-comments'] });
    },
  });
}

export function useMergePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prNumber, mergeMethod }: { prNumber: number; mergeMethod?: 'merge' | 'squash' | 'rebase' }) =>
      prsAPI.mergePR(prNumber, mergeMethod),
    onSuccess: () => {
      // Invalidate all PR-related queries to refetch
      queryClient.invalidateQueries({ queryKey: ['prs'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
    },
  });
}

export function useApprovePR(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => prsAPI.approvePR(prNumber),
    onSuccess: () => {
      // Invalidate reviews to show the new approval
      queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'reviews'] });
    },
  });
}

export function useDeleteComment(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => prsAPI.deleteComment(prNumber, commentId),
    onSuccess: () => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'comments'] });
    },
  });
}

export function useDeleteIssueComment(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => prsAPI.deleteIssueComment(prNumber, commentId),
    onSuccess: () => {
      // Invalidate issue comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'issue-comments'] });
    },
  });
}

export function useReplyToComment(prNumber: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) =>
      prsAPI.replyToComment(prNumber, commentId, body),
    onSuccess: () => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['prs', prNumber, 'comments'] });
    },
  });
}
