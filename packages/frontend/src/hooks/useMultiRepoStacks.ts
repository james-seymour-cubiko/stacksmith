import { useQueries } from '@tanstack/react-query';
import { stacksAPI } from '../lib/api';
import type { StackWithPRs } from '@review-app/shared';

/**
 * Hook to fetch stacks from multiple repos in parallel
 * Used when user selects "All Repositories"
 */
export function useMultiRepoStacks(repos: string[], enabled: boolean = true) {
  const queries = useQueries({
    queries: repos.map((repo) => ({
      queryKey: ['stacks', { repo }],
      queryFn: () => stacksAPI.list(repo),
      enabled,
      staleTime: 1000 * 60 * 5, // 5 minutes
    })),
  });

  // Combine all results
  const allStacks: StackWithPRs[] = [];
  let isAnyLoading = false;
  let hasAnyError = false;
  let firstError: Error | null = null;

  queries.forEach((query) => {
    if (query.isLoading) {
      isAnyLoading = true;
    }
    if (query.error) {
      hasAnyError = true;
      if (!firstError) {
        firstError = query.error as Error;
      }
    }
    if (query.data) {
      allStacks.push(...query.data);
    }
  });

  // Sort combined results by most recently updated
  allStacks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return {
    data: allStacks.length > 0 ? allStacks : undefined,
    isLoading: isAnyLoading,
    error: firstError,
    // Individual query states for more granular loading indicators
    repoStates: repos.map((repo, index) => ({
      repo,
      isLoading: queries[index].isLoading,
      isSuccess: queries[index].isSuccess,
      error: queries[index].error,
      data: queries[index].data,
    })),
  };
}
