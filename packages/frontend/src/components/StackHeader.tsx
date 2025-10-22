import { useState } from 'react';
import { theme } from '../lib/theme';
import { PRList } from './PRList';
import type { GithubStack } from '../../../shared/src/types';

// Branch copy button - shows truncated branch name, copies on click
function BranchCopyButton({ branchName }: { branchName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(branchName);
      setCopied(true);
      setTimeout(() => setCopied(false), 500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Truncate branch name if too long
  const truncatedName = branchName.length > 40 ? branchName.substring(0, 40) + '...' : branchName;

  return (
    <button
      onClick={handleCopy}
      className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
        copied
          ? 'bg-everforest-green/20 text-everforest-green'
          : 'bg-everforest-bg3/50 text-everforest-grey1 hover:bg-everforest-bg3 hover:text-everforest-fg'
      }`}
      title={copied ? `Copied: ${branchName}` : `Click to copy branch: ${branchName}`}
    >
      {copied ? '✓ Copied' : truncatedName}
    </button>
  );
}

interface StackHeaderProps {
  stack: GithubStack;
  isCopied: boolean;
  onShareStack: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  sortedPRs: any[];
  currentPRNumber: number;
  onSelectPR: (prNumber: number) => void;
  onMergePR: (prNumber: number) => void;
  mergePending: boolean;
  currentUser?: string;
  owner: string;
  repo: string;
  selectedPR?: any;
  currentPRDetails?: any;
}

export function StackHeader({
  stack,
  isCopied,
  onShareStack,
  onRefresh,
  isRefreshing,
  sortedPRs,
  currentPRNumber,
  onSelectPR,
  onMergePR,
  mergePending,
  currentUser,
  owner,
  repo,
  selectedPR,
  currentPRDetails
}: StackHeaderProps) {
  return (
    <div className={`${theme.card} h-full`}>
      <div className={`px-6 py-5 border-b ${theme.border}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>
              {stack.name.replace(/^Single PR:\s*/, '')}
            </h1>
            {selectedPR && (
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className={`${theme.textSecondary}`}>
                  {owner}/{repo}
                </span>
                <div className="flex items-center gap-2">
                  <img
                    src={selectedPR.user.avatar_url}
                    alt={selectedPR.user.login}
                    className="h-5 w-5 rounded-full"
                    title={`Author: ${selectedPR.user.login}`}
                  />
                  <span className={`${theme.textSecondary}`}>
                    {selectedPR.user.login}
                  </span>
                </div>
                {currentPRDetails && (
                  <span className={`${theme.textSecondary}`}>
                    <span className={theme.textSuccess}>+{currentPRDetails.additions}</span>
                    {' / '}
                    <span className={theme.textError}>-{currentPRDetails.deletions}</span>
                  </span>
                )}
                <BranchCopyButton branchName={selectedPR.head.ref} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="ml-4 p-2 rounded transition-colors hover:bg-everforest-bg3/30"
              title="Refresh all stack data"
            >
              <svg
                className={`w-5 h-5 ${theme.textSecondary} opacity-60 hover:opacity-100 transition-opacity ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={onShareStack}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isCopied
                  ? 'bg-everforest-blue text-everforest-bg0'
                  : 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
              }`}
            >
              {isCopied ? '✓ Copied!' : '📋 Share Stack'}
            </button>
          </div>
        </div>
      </div>

      <PRList
        sortedPRs={sortedPRs}
        currentPRNumber={currentPRNumber}
        onSelectPR={onSelectPR}
        onMergePR={onMergePR}
        mergePending={mergePending}
        currentUser={currentUser}
        owner={owner}
        repo={repo}
      />
    </div>
  );
}
