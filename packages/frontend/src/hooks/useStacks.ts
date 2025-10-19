import { useQuery } from '@tanstack/react-query';
import { stacksAPI } from '../lib/api';

export function useStacks(repo?: string) {
  return useQuery({
    queryKey: ['stacks', { repo }],
    queryFn: () => stacksAPI.list(repo),
  });
}

export function useStack(owner: string | undefined, repo: string | undefined, stackId: string | undefined) {
  return useQuery({
    queryKey: ['stacks', owner, repo, stackId],
    queryFn: () => stacksAPI.get(owner!, repo!, stackId!),
    enabled: !!owner && !!repo && !!stackId,
  });
}
