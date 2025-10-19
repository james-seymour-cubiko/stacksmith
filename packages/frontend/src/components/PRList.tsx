import { useQueryClient } from '@tanstack/react-query';
import { theme } from '../lib/theme';
import type { GithubCheckRun } from '../../../shared/src/types';

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
}

// Hook to get CI status for a PR
function useCIStatus(owner: string, repo: string, prNumber: number) {
  const queryClient = useQueryClient();
  const checkRuns = queryClient.getQueryData<GithubCheckRun[]>(['prs', owner, repo, prNumber, 'checks']);

  const failedChecks = checkRuns?.filter((c) => c.conclusion === 'failure').length || 0;
  const inProgressChecks = checkRuns?.filter((c) => c.status === 'in_progress').length || 0;
  const queuedChecks = checkRuns?.filter((c) => c.status === 'queued').length || 0;
  const passedChecks = checkRuns?.filter((c) => c.conclusion === 'success').length || 0;
  const totalChecks = checkRuns?.length || 0;

  return {
    checkRuns,
    isLoading: false,
    failedChecks,
    inProgressChecks,
    queuedChecks,
    passedChecks,
    totalChecks,
    hasFailed: failedChecks > 0,
    isRunning: inProgressChecks > 0 || queuedChecks > 0,
    allPassed: totalChecks > 0 && passedChecks === totalChecks,
  };
}

// Component to display CI status badge for a PR
function CIStatusBadge({ owner, repo, prNumber }: { owner: string; repo: string; prNumber: number }) {
  const ciStatus = useCIStatus(owner, repo, prNumber);

  if (ciStatus.isLoading) {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium bg-everforest-bg3 text-everforest-grey0`}>
        CI: ...
      </span>
    );
  }

  if (!ciStatus.checkRuns || ciStatus.totalChecks === 0) {
    return null;
  }

  let badgeColor = '';
  let badgeText = '';
  let badgeIcon = '';

  if (ciStatus.hasFailed) {
    badgeColor = 'bg-everforest-red/20 text-everforest-red';
    badgeIcon = '✗';
    badgeText = `CI: ${ciStatus.failedChecks} failed`;
  } else if (ciStatus.isRunning) {
    badgeColor = 'bg-everforest-yellow/20 text-everforest-yellow';
    badgeIcon = '⟳';
    badgeText = `CI: ${ciStatus.inProgressChecks + ciStatus.queuedChecks} running`;
  } else if (ciStatus.allPassed) {
    badgeColor = 'bg-everforest-green/20 text-everforest-green';
    badgeIcon = '✓';
    badgeText = `CI: ${ciStatus.passedChecks} passed`;
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

function PRItem({ pr, index, isSelected, onSelect, onMerge, mergePending, sortedPRs, currentUser, owner, repo }: PRItemProps) {
  const queryClient = useQueryClient();

  // Calculate how many branches need to be merged (from base to current, excluding already merged)
  const prsToMerge = sortedPRs.slice(0, index + 1).filter(p => !p.merged_at);
  const branchesToMerge = prsToMerge.length;
  const branchWord = branchesToMerge === 1 ? 'branch' : 'branches';

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

      // Check CI status for this PR
      const checkRuns = queryClient.getQueryData<GithubCheckRun[]>(['prs', owner, repo, checkPr.number, 'checks']);
      if (checkRuns && checkRuns.length > 0) {
        const failedChecks = checkRuns.filter((c) => c.conclusion === 'failure').length;
        const inProgressChecks = checkRuns.filter((c) => c.status === 'in_progress').length;
        const queuedChecks = checkRuns.filter((c) => c.status === 'queued').length;

        if (failedChecks > 0) {
          mergeButtonText = '⚠ CI Failed';
          mergeButtonTooltip = `PR #${checkPr.number} has ${failedChecks} failing CI check${failedChecks > 1 ? 's' : ''}. Fix the failures before merging.`;
          mergeButtonDisabled = true;
          canMerge = false;
          break;
        }

        if (inProgressChecks > 0 || queuedChecks > 0) {
          mergeButtonText = '⟳ CI Running';
          mergeButtonTooltip = `PR #${checkPr.number} has ${inProgressChecks + queuedChecks} CI check${inProgressChecks + queuedChecks > 1 ? 's' : ''} in progress. Wait for CI to complete before merging.`;
          mergeButtonDisabled = true;
          canMerge = false;
          break;
        }
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                {pr.draft ? 'Draft' : pr.merged_at ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open'}
              </span>
              <CIStatusBadge owner={owner} repo={repo} prNumber={pr.number} />
              <span className={`font-medium ${theme.textPrimary} truncate`}>
                #{pr.number} {pr.title}
              </span>
            </div>
            <div className={`mt-1 text-xs ${theme.textSecondary} flex items-center gap-2 flex-wrap`}>
              <span>{pr.head.ref} → {pr.base.ref}</span>
              {isBasePR && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium bg-everforest-purple/20 text-everforest-purple`}>
                  Base PR
                </span>
              )}
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${theme.textLink} text-xs`}
              >
                GitHub →
              </a>
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
  return (
    <div className="px-6 py-4">
      <h2 className={`text-sm font-medium ${theme.textPrimary} mb-3`}>
        Pull Requests in Stack ({sortedPRs.length})
      </h2>

      <div className="space-y-2">
        {sortedPRs.map((pr, index) => (
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
          />
        ))}
      </div>
    </div>
  );
}
