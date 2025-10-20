import React from 'react';
import { theme } from '../lib/theme';

interface ThreadResolutionButtonProps {
  threadId: string;
  resolved: boolean;
  onResolve: (threadId: string) => void;
  onUnresolve: (threadId: string) => void;
  isLoading?: boolean;
}

export function ThreadResolutionButton({
  threadId,
  resolved,
  onResolve,
  onUnresolve,
  isLoading = false,
}: ThreadResolutionButtonProps) {
  const handleClick = () => {
    if (resolved) {
      onUnresolve(threadId);
    } else {
      onResolve(threadId);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
        isLoading
          ? 'bg-everforest-bg3 text-everforest-grey0 cursor-wait'
          : resolved
          ? 'bg-everforest-bg-yellow text-everforest-yellow hover:bg-everforest-yellow/20'
          : 'bg-everforest-bg-green text-everforest-green hover:bg-everforest-green/20'
      }`}
      title={resolved ? 'Mark thread as unresolved' : 'Mark thread as resolved'}
    >
      {isLoading ? 'Loading...' : resolved ? 'Unresolve thread' : 'Resolve thread'}
    </button>
  );
}
