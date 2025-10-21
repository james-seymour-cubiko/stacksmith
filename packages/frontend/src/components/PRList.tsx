import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { theme } from '../lib/theme';
import type { GithubCheckRun, GithubReview, ReviewStatusInfo, CommentThread } from '../../../shared/src/types';
import { useBulkPRReviews, useBulkPRThreads } from '../hooks/usePRs';
import { computeReviewStatus } from '../lib/reviewStatus';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { ThreadCountBadge } from './ThreadCountBadge';

// Copy button component with visual feedback
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
        copied
          ? 'bg-everforest-green/20 text-everforest-green'
          : 'bg-everforest-bg3/50 text-everforest-grey1 hover:bg-everforest-bg3 hover:text-everforest-fg'
      }`}
      title={copied ? 'Copied!' : `Copy ${label}`}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

interface PRItemProps {
  pr: any;
  index: number;
  isSelected: boolean;
  onSelect: (prNumber: number) => void;
  onMerge: (prNumber: number) => void;
  mergePending: boolean;
  sortedPRs: any[];
  currentUser?: string;
  owner: string;
  repo: string;
  reviewStatus?: ReviewStatusInfo;
  reviewsMap: Map<number, GithubReview[]>;
  threadsMap: Map<number, CommentThread[]>;
  reviewsLoading: boolean;
}

// Hook to get CI status for a PR - matches GitHub's actual mergeability logic
function useCIStatus(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();

  // Use useQuery to subscribe to changes instead of just reading from cache
  const { data: checkRuns, isLoading } = useQuery({
    queryKey: ['prs', owner, repo, prNumber, 'checks'],
    enabled: false, // Don't fetch, just subscribe to cache updates
    initialData: () => queryClient.getQueryData<GithubCheckRun[]>(['prs', owner, repo, prNumber, 'checks']),
  });

  // Blocking states that prevent merge
  const blockingChecks = checkRuns?.filter((c) =>
    c.conclusion === 'failure' ||
    c.conclusion === 'timed_out' ||
    c.conclusion === 'action_required'
  ).length || 0;

  // In-progress states
  const inProgressChecks = checkRuns?.filter((c) =>
    c.status === 'in_progress' ||
    c.status === 'queued'
  ).length || 0;

  // Non-blocking states (success, skipped, cancelled, neutral)
  const nonBlockingChecks = checkRuns?.filter((c) =>
    c.conclusion === 'success' ||
    c.conclusion === 'skipped' ||
    c.conclusion === 'cancelled' ||
    c.conclusion === 'neutral'
  ).length || 0;

  const totalChecks = checkRuns?.length || 0;

  return {
    checkRuns,
    isLoading,
    blockingChecks,
    inProgressChecks,
    nonBlockingChecks,
    totalChecks,
    hasBlocking: blockingChecks > 0,
    isRunning: inProgressChecks > 0,
    allPassed: totalChecks > 0 && nonBlockingChecks === totalChecks,
  };
}

// Component to display merge conflict badge for a PR
function MergeConflictBadge({ pr, owner, repo }: { pr: any; owner: string; repo: string }) {
  const queryClient = useQueryClient();

  // Get full PR details from cache (includes mergeable status)
  const fullPR = queryClient.getQueryData<any>(['prs', owner, repo, pr.number]);

  // Use the full PR data if available, otherwise fall back to the pr prop
  const prData = fullPR || pr;

  // Debug: Log the mergeable status
  console.log(`PR #${pr.number} mergeable status:`, {
    mergeable: prData.mergeable,
    mergeable_state: prData.mergeable_state,
    type: typeof prData.mergeable,
    hasFullData: !!fullPR
  });

  // If we don't have full PR data yet, show loading state
  if (!fullPR && prData.mergeable === undefined && prData.mergeable_state === undefined) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-everforest-bg3/50 text-everforest-grey0 animate-pulse">
        Merge: ...
      </span>
    );
  }

  // pr.mergeable is null when GitHub hasn't calculated it yet, false when there are conflicts, true when it's mergeable
  // pr.mergeable_state can be: 'clean', 'dirty', 'unstable', 'blocked', 'behind', 'unknown', etc.

  // Show conflicts badge if mergeable is explicitly false OR if mergeable_state is 'dirty'
  if (prData.mergeable === false || prData.mergeable_state === 'dirty') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-everforest-red/20 text-everforest-red">
        ⚠ Conflicts
      </span>
    );
  }

  // Optionally show if behind or blocked
  if (prData.mergeable_state === 'behind') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-everforest-yellow/20 text-everforest-yellow">
        ⚠ Behind
      </span>
    );
  }

  return null; // Don't show badge if there are no conflicts
}

// Component to display CI status badge for a PR
function CIStatusBadge({ owner, repo, prNumber }: { owner: string; repo: string; prNumber: number }) {
  const ciStatus = useCIStatus(owner, repo, prNumber);

  // Show loading state while fetching
  if (!ciStatus.checkRuns) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-everforest-bg3/50 text-everforest-grey0 animate-pulse">
        CI: ...
      </span>
    );
  }

  // Don't show badge if there are no CI checks
  if (ciStatus.totalChecks === 0) {
    return null;
  }

  let badgeColor = '';
  let badgeText = '';
  let badgeIcon = '';

  if (ciStatus.hasBlocking) {
    badgeColor = 'bg-everforest-red/20 text-everforest-red';
    badgeIcon = '✗';
    badgeText = `CI: ${ciStatus.blockingChecks} failed`;
  } else if (ciStatus.isRunning) {
    badgeColor = 'bg-everforest-yellow/20 text-everforest-yellow';
    badgeIcon = '⟳';
    badgeText = `CI: ${ciStatus.inProgressChecks} running`;
  } else if (ciStatus.allPassed) {
    badgeColor = 'bg-everforest-green/20 text-everforest-green';
    badgeIcon = '✓';
    badgeText = `CI: ${ciStatus.nonBlockingChecks} passed`;
  } else {
    badgeColor = 'bg-everforest-bg3 text-everforest-grey0';
    badgeIcon = '○';
    badgeText = `CI: ${ciStatus.totalChecks}`;
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
      {badgeIcon} {badgeText}
    </span>
  );
}

function PRItem({ pr, index, isSelected, onSelect, onMerge, mergePending, sortedPRs, currentUser, owner, repo, reviewStatus, reviewsMap, threadsMap, reviewsLoading }: PRItemProps) {
  const queryClient = useQueryClient();

  // Calculate how many branches need to be merged (from base to current, excluding already merged)
  const prsToMerge = sortedPRs.slice(0, index + 1).filter(p => !p.merged_at);
  const branchesToMerge = prsToMerge.length;
  const branchWord = branchesToMerge === 1 ? 'branch' : 'branches';

  // Get threads for this PR
  const threads = threadsMap.get(pr.number) || [];
  const resolvedThreadCount = threads.filter(t => t.resolved).length;
  const totalThreadCount = threads.length;

  const statusColor = pr.draft
    ? theme.statusDraft
    : pr.merged_at
    ? theme.statusMerged
    : pr.state === 'closed'
    ? theme.statusClosed
    : theme.statusOpen;

  // Check if this PR targets main (base of the stack)
  const isBasePR = pr.base.ref === 'main' || pr.base.ref === 'master';
  const isMerged = !!pr.merged_at;
  const isClosed = pr.state === 'closed' && !isMerged;

  // Check if current user is the author of this PR
  const isAuthor = currentUser && pr.user.login === currentUser;

  // Determine merge button state and text by checking ALL PRs that need to be merged
  let mergeButtonText = `⬇ Merge ${branchesToMerge} ${branchWord}`;
  let mergeButtonDisabled = false;
  let mergeButtonTooltip = '';
  let canMerge = true;

  if (!isAuthor) {
    mergeButtonText = '⚠ Not Author';
    mergeButtonTooltip = `Only the PR author (${pr.user.login}) can merge this PR`;
    mergeButtonDisabled = true;
    canMerge = false;
  } else if (mergePending) {
    mergeButtonText = 'Merging...';
    mergeButtonTooltip = `Merging ${branchesToMerge} ${branchWord}...`;
    mergeButtonDisabled = true;
    canMerge = false;
  } else if (isMerged) {
    mergeButtonText = '✓ Merged';
    mergeButtonTooltip = `PR #${pr.number} has already been merged`;
    mergeButtonDisabled = true;
    canMerge = false;
  } else if (isClosed) {
    mergeButtonText = 'Closed';
    mergeButtonTooltip = `PR #${pr.number} is closed and cannot be merged`;
    mergeButtonDisabled = true;
    canMerge = false;
  } else {
    // Check all PRs that need to be merged for blockers
    for (const checkPr of prsToMerge) {
      // Check if closed
      if (checkPr.state === 'closed' && !checkPr.merged_at) {
        mergeButtonText = 'Closed';
        mergeButtonTooltip = `PR #${checkPr.number} is closed and must be reopened before merging`;
        mergeButtonDisabled = true;
        canMerge = false;
        break;
      }

      // Check draft status
      if (checkPr.draft) {
        mergeButtonText = '⚠ Draft';
        mergeButtonTooltip = `PR #${checkPr.number} is a draft and must be marked as ready for review before merging`;
        mergeButtonDisabled = true;
        canMerge = false;
        break;
      }

      // Check merge conflicts
      if (checkPr.mergeable === false) {
        mergeButtonText = '⚠ Conflicts';
        mergeButtonTooltip = `PR #${checkPr.number} has merge conflicts that must be resolved before merging`;
        mergeButtonDisabled = true;
        canMerge = false;
        break;
      }

      // Check CI status for this PR using GitHub's mergeability logic
      const checkRuns = queryClient.getQueryData<GithubCheckRun[]>(['prs', owner, repo, checkPr.number, 'checks']);
      if (checkRuns && checkRuns.length > 0) {
        // Blocking states that prevent merge
        const blockingChecks = checkRuns.filter((c) =>
          c.conclusion === 'failure' ||
          c.conclusion === 'timed_out' ||
          c.conclusion === 'action_required'
        ).length;

        const inProgressChecks = checkRuns.filter((c) =>
          c.status === 'in_progress' ||
          c.status === 'queued'
        ).length;

        if (blockingChecks > 0) {
          mergeButtonText = '⚠ CI Failed';
          mergeButtonTooltip = `PR #${checkPr.number} has ${blockingChecks} failing CI check${blockingChecks > 1 ? 's' : ''}. Fix the failures before merging.`;
          mergeButtonDisabled = true;
          canMerge = false;
          break;
        }

        if (inProgressChecks > 0) {
          mergeButtonText = '⟳ CI Running';
          mergeButtonTooltip = `PR #${checkPr.number} has ${inProgressChecks} CI check${inProgressChecks > 1 ? 's' : ''} in progress. Wait for CI to complete before merging.`;
          mergeButtonDisabled = true;
          canMerge = false;
          break;
        }
      }

      // Check review status for this PR
      const reviews = reviewsMap.get(checkPr.number);
      if (reviews) {
        const prReviewStatus = computeReviewStatus(reviews);

        if (prReviewStatus.status === 'CHANGES_REQUESTED') {
          mergeButtonText = '⚠ Changes Requested';
          mergeButtonTooltip = `PR #${checkPr.number} has ${prReviewStatus.changesRequestedCount} change${prReviewStatus.changesRequestedCount > 1 ? 's' : ''} requested. Address the requested changes before merging.`;
          mergeButtonDisabled = true;
          canMerge = false;
          break;
        }

        if (prReviewStatus.status !== 'APPROVED') {
          mergeButtonText = '⚠ Needs Approval';
          mergeButtonTooltip = `PR #${checkPr.number} needs at least one approval before merging.`;
          mergeButtonDisabled = true;
          canMerge = false;
          break;
        }
      }

      // Check thread resolution status for this PR
      const prThreads = threadsMap.get(checkPr.number) || [];
      const prUnresolvedCount = prThreads.filter(t => !t.resolved).length;

      if (prUnresolvedCount > 0) {
        mergeButtonText = '⚠ Unresolved Threads';
        mergeButtonTooltip = `PR #${checkPr.number} has ${prUnresolvedCount} unresolved comment thread${prUnresolvedCount > 1 ? 's' : ''}. Resolve all threads before merging.`;
        mergeButtonDisabled = true;
        canMerge = false;
        break;
      }
    }

    // If no blockers found, ready to merge
    if (canMerge) {
      mergeButtonTooltip = `Click to merge ${branchesToMerge} ${branchWord} sequentially into their targets`;
    }
  }

  return (
    <div
      key={pr.number}
      className={`border rounded-lg transition-all relative ${
        isSelected
          ? `${theme.border} bg-everforest-bg2 border-everforest-green`
          : `${theme.border}`
      }`}
    >
      {/* Merge Button - Top Right */}
      <div className="absolute top-3 right-3 z-10">
        <div className="relative group">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canMerge) {
                onMerge(pr.number);
              }
            }}
            disabled={mergeButtonDisabled}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              mergeButtonDisabled
                ? 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                : 'bg-everforest-purple text-everforest-bg0 hover:bg-everforest-purple/90 shadow-sm'
            }`}
          >
            {mergeButtonText}
          </button>
          {mergeButtonTooltip && (
            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-everforest-bg0 text-everforest-fg border border-everforest-bg4 rounded shadow-lg text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
              {mergeButtonTooltip}
              <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-everforest-bg4"></div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onSelect(pr.number)}
        className={`w-full text-left p-3 pr-24 ${!isSelected && 'hover:bg-everforest-bg1'}`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${theme.textSecondary}`}>
            #{index + 1}
          </span>
          <div className="flex-1 min-w-0">
            {/* Badges on first line */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                {pr.draft ? 'Draft' : pr.merged_at ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open'}
              </span>
              <MergeConflictBadge pr={pr} owner={owner} repo={repo} />
              <CIStatusBadge owner={owner} repo={repo} prNumber={pr.number} />
              <ReviewStatusBadge reviewStatus={reviewStatus} isLoading={reviewsLoading} />
              <ThreadCountBadge resolvedCount={resolvedThreadCount} totalCount={totalThreadCount} />
            </div>
            {/* Title on second line */}
            <div className={`font-medium ${theme.textPrimary} break-words flex items-center gap-1.5`}>
              <CopyButton text={pr.head.ref} label="branch name" />
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${theme.textLink} hover:underline`}
              >
                #{pr.number}
              </a>
              {' '}{pr.title}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

interface PRListProps {
  sortedPRs: any[];
  currentPRNumber: number;
  onSelectPR: (prNumber: number) => void;
  onMergePR: (prNumber: number) => void;
  mergePending: boolean;
  currentUser?: string;
  owner: string;
  repo: string;
}

export function PRList({ sortedPRs, currentPRNumber, onSelectPR, onMergePR, mergePending, currentUser, owner, repo }: PRListProps) {
  // Fetch reviews for all PRs in the stack
  const prNumbers = sortedPRs.map((pr) => pr.number);
  const { reviewsMap, isLoading } = useBulkPRReviews(owner, repo, prNumbers);

  // Fetch threads for all PRs in the stack
  const { threadsMap } = useBulkPRThreads(owner, repo, prNumbers);

  return (
    <div className="px-6 py-4">
      <h2 className={`text-sm font-medium ${theme.textPrimary} mb-3`}>
        Pull Requests in Stack ({sortedPRs.length})
      </h2>

      <div className="space-y-2">
        {sortedPRs.map((pr, index) => {
          // Compute review status for this PR
          const reviews = reviewsMap.get(pr.number) || [];
          const reviewStatus = reviews.length > 0 ? computeReviewStatus(reviews) : undefined;

          return (
            <PRItem
              key={pr.number}
              pr={pr}
              index={index}
              isSelected={pr.number === currentPRNumber}
              onSelect={onSelectPR}
              onMerge={onMergePR}
              mergePending={mergePending}
              sortedPRs={sortedPRs}
              currentUser={currentUser}
              owner={owner}
              repo={repo}
              reviewStatus={reviewStatus}
              reviewsMap={reviewsMap}
              threadsMap={threadsMap}
              reviewsLoading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
}
