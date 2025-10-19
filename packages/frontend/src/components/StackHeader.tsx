import { theme } from '../lib/theme';
import { PRList } from './PRList';
import type { GithubStack } from '../../../shared/src/types';

interface StackHeaderProps {
  stack: GithubStack;
  isCopied: boolean;
  onShareStack: () => void;
  sortedPRs: any[];
  currentPRNumber: number;
  onSelectPR: (prNumber: number) => void;
  onMergePR: (prNumber: number) => void;
  mergePending: boolean;
}

export function StackHeader({
  stack,
  isCopied,
  onShareStack,
  sortedPRs,
  currentPRNumber,
  onSelectPR,
  onMergePR,
  mergePending
}: StackHeaderProps) {
  return (
    <div className={`${theme.card} h-full`}>
      <div className={`px-6 py-5 border-b ${theme.border}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>{stack.name}</h1>
            {stack.description && (
              <p className={`mt-1 text-sm ${theme.textSecondary}`}>{stack.description}</p>
            )}
          </div>
          <button
            onClick={onShareStack}
            className={`ml-4 px-4 py-2 rounded text-sm font-medium transition-colors ${
              isCopied
                ? 'bg-everforest-blue text-everforest-bg0'
                : 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
            }`}
          >
            {isCopied ? '✓ Copied!' : '📋 Share Stack'}
          </button>
        </div>
      </div>

      <PRList
        sortedPRs={sortedPRs}
        currentPRNumber={currentPRNumber}
        onSelectPR={onSelectPR}
        onMergePR={onMergePR}
        mergePending={mergePending}
      />
    </div>
  );
}
