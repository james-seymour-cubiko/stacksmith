import { useQuery } from '@tanstack/react-query';
import { stacksAPI } from '../lib/api';

export function useStacks() {
  return useQuery({
    queryKey: ['stacks'],
    queryFn: () => stacksAPI.list(),
  });
}

export function useStack(stackId: string | undefined) {
  return useQuery({
    queryKey: ['stacks', stackId],
    queryFn: () => stacksAPI.get(stackId!),
    enabled: !!stackId,
  });
}
