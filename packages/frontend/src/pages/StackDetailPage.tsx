import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useStack } from '../hooks/useStacks';
import { usePR, usePRDiff, usePRCommits, useCreatePRComment, usePRComments, usePRReviews, usePRIssueComments, useCreatePRIssueComment, useMergePR, usePRCheckRuns, useRerunAllChecks, useDeleteComment, useDeleteIssueComment, useReplyToComment } from '../hooks/usePRs';
import { theme } from '../lib/theme';
import type { GithubDiff, GithubPR, GithubCheckRun } from '@review-app/shared';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  fileData?: GithubDiff;
}

interface FileTreeNodeInternal {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: Record<string, FileTreeNodeInternal>;
  fileData?: GithubDiff;
}

// Hook to get CI status for a PR
function useCIStatus(prNumber: number) {
  const { data: checkRuns, isLoading } = usePRCheckRuns(prNumber);

  const failedChecks = checkRuns?.filter((c) => c.conclusion === 'failure').length || 0;
  const inProgressChecks = checkRuns?.filter((c) => c.status === 'in_progress').length || 0;
  const queuedChecks = checkRuns?.filter((c) => c.status === 'queued').length || 0;
  const passedChecks = checkRuns?.filter((c) => c.conclusion === 'success').length || 0;
  const totalChecks = checkRuns?.length || 0;

  return {
    checkRuns,
    isLoading,
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
function CIStatusBadge({ prNumber }: { prNumber: number }) {
  const ciStatus = useCIStatus(prNumber);

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

// Component for each PR item in the stack list
interface PRItemProps {
  pr: any;
  index: number;
  isSelected: boolean;
  onSelect: (prNumber: number) => void;
  onMerge: (prNumber: number) => void;
  mergePending: boolean;
  sortedPRs: any[];
}

function PRItem({ pr, index, isSelected, onSelect, onMerge, mergePending, sortedPRs }: PRItemProps) {
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

  // Determine merge button state and text by checking ALL PRs that need to be merged
  let mergeButtonText = `⬇ Merge ${branchesToMerge} ${branchWord}`;
  let mergeButtonDisabled = false;
  let mergeButtonTooltip = '';
  let canMerge = true;

  if (mergePending) {
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
      const checkRuns = queryClient.getQueryData<GithubCheckRun[]>(['prs', checkPr.number, 'checks']);
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
                {pr.draft ? 'Draft' : pr.merged_at ? 'Merged' : pr.state}
              </span>
              <CIStatusBadge prNumber={pr.number} />
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

export function StackDetailPage() {
  const { stackId } = useParams<{ stackId: string }>();
  const { data: stack, isLoading, error } = useStack(stackId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Track selected PR for diff view (default to first PR)
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(null);

  // Track selected file for highlighting
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Track selected line range for commenting
  const [commentingLine, setCommentingLine] = useState<{
    file: string;
    startLine: number;
    endLine: number;
    side: 'left' | 'right';
  } | null>(null);

  // Track line selection in progress (for drag selection)
  const [selectingLines, setSelectingLines] = useState<{
    file: string;
    startLine: number;
    currentLine: number;
    side: 'left' | 'right';
  } | null>(null);

  // Track comment body
  const [commentBody, setCommentBody] = useState('');

  // Refs for scrolling to files
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Add global mouse up handler to finalize selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      handleLineMouseUp();
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [selectingLines]);

  // Sort PRs by stack order
  const sortedPRs = stack ? [...stack.prs].sort((a, b) => a.stackOrder - b.stackOrder) : [];

  // Redirect to stacks page if base PR is already merged
  useEffect(() => {
    if (stack && sortedPRs.length > 0) {
      const basePR = sortedPRs[0];
      if (basePR.merged_at) {
        // Base branch has been merged, stack ID is now invalid
        navigate('/stacks');
      }
    }
  }, [stack, sortedPRs, navigate]);

  // Set default selected PR when stack loads
  const currentPRNumber = selectedPRNumber ?? sortedPRs[0]?.number;

  // Fetch full PR details for stats (commits, additions, deletions, etc.)
  const { data: currentPRDetails } = usePR(currentPRNumber);

  // Fetch diff for selected PR
  const { data: diff, isLoading: diffLoading } = usePRDiff(currentPRNumber);

  // Fetch commits for selected PR (to get commit SHA)
  const { data: commits } = usePRCommits(currentPRNumber);

  // Fetch comments and reviews for selected PR
  const { data: comments } = usePRComments(currentPRNumber);
  const { data: reviews } = usePRReviews(currentPRNumber);
  const { data: issueComments } = usePRIssueComments(currentPRNumber);

  // Fetch check runs for selected PR
  const { data: checkRuns, isLoading: checkRunsLoading } = usePRCheckRuns(currentPRNumber);

  // Create comment mutations
  const createComment = useCreatePRComment(currentPRNumber || 0);
  const createIssueComment = useCreatePRIssueComment(currentPRNumber || 0);

  // Delete and reply comment mutations
  const deleteComment = useDeleteComment(currentPRNumber || 0);
  const deleteIssueComment = useDeleteIssueComment(currentPRNumber || 0);
  const replyToComment = useReplyToComment(currentPRNumber || 0);

  // Merge PR mutation
  const mergePR = useMergePR();

  // CI check rerun mutation
  const rerunAllChecks = useRerunAllChecks(currentPRNumber || 0);

  // Track PR-level comment form state
  const [isAddingPRComment, setIsAddingPRComment] = useState(false);
  const [prCommentBody, setPRCommentBody] = useState('');

  // Track reply form state for code comments
  const [replyingToComment, setReplyingToComment] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  // Track reply form state for issue comments
  const [replyingToIssueComment, setReplyingToIssueComment] = useState<number | null>(null);
  const [issueReplyBody, setIssueReplyBody] = useState('');

  // Track copy to clipboard state
  const [isCopied, setIsCopied] = useState(false);

  // Track comments section collapse state
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);

  // Build file tree from diff
  const buildFileTree = (files: GithubDiff[]): FileTreeNode[] => {
    const root: Record<string, FileTreeNodeInternal> = {};

    files.forEach((file) => {
      const parts = file.filename.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const path = parts.slice(0, index + 1).join('/');

        if (!current[part]) {
          current[part] = {
            name: part,
            path,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : {},
            fileData: isFile ? file : undefined,
          };
        }

        if (!isFile && current[part].children) {
          current = current[part].children!;
        }
      });
    });

    const convertToArray = (obj: Record<string, FileTreeNodeInternal>): FileTreeNode[] => {
      return Object.values(obj).map((node) => {
        const convertedNode: FileTreeNode = {
          name: node.name,
          path: node.path,
          type: node.type,
          children: node.children ? convertToArray(node.children) : undefined,
          fileData: node.fileData,
        };
        return convertedNode;
      }).sort((a, b) => {
        // Folders first, then files
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    };

    return convertToArray(root);
  };

  const fileTree = diff ? buildFileTree(diff) : [];

  // Scroll to file
  const scrollToFile = (filename: string) => {
    setSelectedFile(filename);
    const element = fileRefs.current[filename];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handle mouse down on a line (start selection)
  const handleLineMouseDown = (file: string, line: number, side: 'left' | 'right') => {
    setSelectingLines({ file, startLine: line, currentLine: line, side });
  };

  // Handle mouse enter on a line (update selection)
  const handleLineMouseEnter = (file: string, line: number, side: 'left' | 'right') => {
    if (selectingLines && selectingLines.file === file && selectingLines.side === side) {
      setSelectingLines({ ...selectingLines, currentLine: line });
    }
  };

  // Handle mouse up (finalize selection)
  const handleLineMouseUp = () => {
    if (selectingLines) {
      const startLine = Math.min(selectingLines.startLine, selectingLines.currentLine);
      const endLine = Math.max(selectingLines.startLine, selectingLines.currentLine);

      setCommentingLine({
        file: selectingLines.file,
        startLine,
        endLine,
        side: selectingLines.side,
      });
      setCommentBody('');
      setSelectingLines(null);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!commentingLine || !commentBody.trim() || !commits || commits.length === 0) {
      return;
    }

    // Get the latest commit SHA from the PR
    const latestCommit = commits[commits.length - 1];

    try {
      // GitHub API uses 'line' for single line or end of range, 'start_line' for multi-line
      const commentData: any = {
        body: commentBody.trim(),
        commit_id: latestCommit.sha,
        path: commentingLine.file,
        line: commentingLine.endLine,
      };

      // Add start_line if selecting multiple lines
      if (commentingLine.startLine !== commentingLine.endLine) {
        commentData.start_line = commentingLine.startLine;
        commentData.start_side = commentingLine.side === 'left' ? 'LEFT' : 'RIGHT';
      }

      // Set the side for the end line
      commentData.side = commentingLine.side === 'left' ? 'LEFT' : 'RIGHT';

      await createComment.mutateAsync(commentData);

      // Reset comment state
      setCommentingLine(null);
      setCommentBody('');
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert('Failed to create comment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle comment cancellation
  const handleCancelComment = () => {
    setCommentingLine(null);
    setCommentBody('');
  };

  // Handle suggestion button click
  const handleSuggestion = () => {
    if (!commentingLine || !diff) return;

    // Find the file
    const file = diff.find((f) => f.filename === commentingLine.file);
    if (!file || !file.patch) return;

    // Parse the diff to get the selected lines
    const { leftLines, rightLines } = parseDiffForSplitView(file.patch);
    const lines = commentingLine.side === 'left' ? leftLines : rightLines;

    // Extract the selected line content
    const selectedLines = lines
      .filter((line) =>
        line.lineNum !== null &&
        line.lineNum >= commentingLine.startLine &&
        line.lineNum <= commentingLine.endLine
      )
      .map((line) => line.content);

    // Create GitHub suggestion markdown
    const suggestionText = selectedLines.join('\n');
    const suggestionMarkdown = `\`\`\`suggestion\n${suggestionText}\n\`\`\``;

    setCommentBody(suggestionMarkdown);
  };

  // Separate inline comments (on specific lines) from general comments
  const inlineComments = comments?.filter((c) => c.line !== undefined) || [];
  const generalReviews = reviews?.filter((r) => r.body && r.body.trim() !== '') || [];

  // Handle PR-level comment submission
  const handleSubmitPRComment = async () => {
    if (!prCommentBody.trim()) return;

    try {
      await createIssueComment.mutateAsync(prCommentBody.trim());
      setPRCommentBody('');
      setIsAddingPRComment(false);
    } catch (error) {
      console.error('Failed to create PR comment:', error);
      alert('Failed to create comment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle PR merge - merges all PRs from base to target sequentially
  const handleMergePR = async (targetPRNumber: number) => {
    // Find the target PR's index
    const targetIndex = sortedPRs.findIndex(pr => pr.number === targetPRNumber);
    if (targetIndex === -1) return;

    // Get all PRs from base to target that aren't merged yet
    const prsToMerge = sortedPRs
      .slice(0, targetIndex + 1)
      .filter(pr => !pr.merged_at);

    if (prsToMerge.length === 0) {
      alert('All PRs in this stack have already been merged.');
      return;
    }

    const branchWord = prsToMerge.length === 1 ? 'branch' : 'branches';
    if (!confirm(`This will merge ${prsToMerge.length} ${branchWord} sequentially. Continue?`)) {
      return;
    }

    try {
      // Merge each PR sequentially
      for (let i = 0; i < prsToMerge.length; i++) {
        const pr = prsToMerge[i];
        console.log(`Merging PR #${pr.number} (${i + 1}/${prsToMerge.length})...`);

        const result = await mergePR.mutateAsync({ prNumber: pr.number });

        if (!result.merged) {
          alert(`Failed to merge PR #${pr.number}: ${result.message}\n\nStopped at ${i + 1}/${prsToMerge.length} branches.`);
          return; // Stop if any merge fails
        }

        console.log(`Successfully merged PR #${pr.number}`);

        // Invalidate queries after each merge
        queryClient.invalidateQueries({ queryKey: ['prs'] });
        queryClient.invalidateQueries({ queryKey: ['stacks'] });

        // Small delay to let GitHub process the merge before next one
        if (i < prsToMerge.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      alert(`Successfully merged ${prsToMerge.length} ${branchWord}!`);

      // Always redirect to stacks page since we always merge from the base
      navigate('/stacks');
    } catch (error) {
      console.error('Failed to merge PRs:', error);
      alert('Failed to merge: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle share stack
  const handleShareStack = async () => {
    if (!stack) return;

    // Determine emoji based on PR status
    const getStatusEmoji = (pr: GithubPR) => {
      if (pr.merged_at) return '🎉'; // Merged
      if (pr.state === 'closed') return '🚫'; // Closed without merge
      if (pr.draft) return '📝'; // Draft
      return '🔄'; // Open
    };

    // Determine CI emoji based on check runs from cache
    const getCIEmoji = (prNumber: number) => {
      const checkRuns = queryClient.getQueryData<GithubCheckRun[]>(['prs', prNumber, 'checks']);

      if (!checkRuns) {
        return '❓'; // Not loaded
      }

      if (checkRuns.length === 0) {
        return '➖'; // No CI
      }

      const failedChecks = checkRuns.filter((c) => c.conclusion === 'failure').length;
      const inProgressChecks = checkRuns.filter((c) => c.status === 'in_progress').length;
      const queuedChecks = checkRuns.filter((c) => c.status === 'queued').length;
      const passedChecks = checkRuns.filter((c) => c.conclusion === 'success').length;

      if (failedChecks > 0) return '💥'; // CI failed
      if (inProgressChecks > 0 || queuedChecks > 0) return '⏳'; // CI running
      if (passedChecks === checkRuns.length && passedChecks > 0) return '✨'; // CI passed
      return '❓'; // Unknown
    };

    // Format as single HTML blockquote with all PRs
    let htmlLinks = '';
    let plainTextContent = '';

    sortedPRs.forEach((pr) => {
      const statusEmoji = getStatusEmoji(pr);
      const ciEmoji = getCIEmoji(pr.number);
      htmlLinks += `${statusEmoji} ${ciEmoji} <a href="${pr.html_url}">${pr.title}</a><br>\n`;
      plainTextContent += `${statusEmoji} ${ciEmoji} ${pr.title}\n${pr.html_url}\n\n`;
    });

    const htmlContent = `<blockquote>${htmlLinks}</blockquote>`;

    try {
      // Use ClipboardItem to write both HTML and plain text formats
      // This ensures Microsoft Teams recognizes it as HTML
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainTextContent], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);

      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${theme.spinner}`}></div>
        <p className={`mt-2 text-sm ${theme.textSecondary}`}>Loading stack...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.errorBox} border rounded-lg p-4`}>
        <h3 className={`text-sm font-medium ${theme.textError}`}>Error loading stack</h3>
        <p className={`mt-1 text-sm ${theme.textError}`}>{(error as Error).message}</p>
        <Link to="/" className={`mt-4 inline-block text-sm ${theme.textLink}`}>
          ← Back to stacks
        </Link>
      </div>
    );
  }

  if (!stack) {
    return (
      <div className="text-center py-12">
        <p className={`text-sm ${theme.textSecondary}`}>Stack not found</p>
        <Link to="/" className={`mt-4 inline-block text-sm ${theme.textLink}`}>
          ← Back to stacks
        </Link>
      </div>
    );
  }

  const selectedPR = sortedPRs.find((pr) => pr.number === currentPRNumber);

  // Render file tree recursively
  const FileTreeItem = ({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (node.type === 'folder') {
      return (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full text-left px-2 py-1 hover:bg-everforest-bg2 rounded flex items-center gap-1 text-xs ${theme.textSecondary}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span className="w-4">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span>📁 {node.name}</span>
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => (
                <FileTreeItem key={child.path} node={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    const statusColor =
      node.fileData?.status === 'added' ? theme.fileAdded :
      node.fileData?.status === 'removed' ? theme.fileRemoved :
      node.fileData?.status === 'renamed' ? theme.fileRenamed :
      theme.fileModified;

    const isSelected = selectedFile === node.path;

    return (
      <button
        onClick={() => scrollToFile(node.path)}
        className={`w-full text-left px-2 py-1 rounded flex items-center gap-1 text-xs transition-colors ${
          isSelected ? 'bg-everforest-bg2 border-l-2 border-everforest-green' : 'hover:bg-everforest-bg2'
        }`}
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
      >
        <span className={`px-1 py-0.5 rounded text-xs font-medium ${statusColor}`}>
          {node.fileData?.status?.[0].toUpperCase()}
        </span>
        <span className={`truncate ${theme.textPrimary}`} title={node.name}>
          {node.name}
        </span>
        <span className={`ml-auto text-xs ${theme.textMuted} flex-shrink-0`}>
          +{node.fileData?.additions} -{node.fileData?.deletions}
        </span>
      </button>
    );
  };

  // Parse diff into split view format
  const parseDiffForSplitView = (patch: string) => {
    const lines = patch.split('\n');
    const leftLines: { lineNum: number | null; content: string; type: 'context' | 'removed' | 'empty' }[] = [];
    const rightLines: { lineNum: number | null; content: string; type: 'context' | 'added' | 'empty' }[] = [];

    let leftLineNum = 0;
    let rightLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse hunk header to get line numbers
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          leftLineNum = parseInt(match[1]);
          rightLineNum = parseInt(match[2]);
        }
        leftLines.push({ lineNum: null, content: line, type: 'context' });
        rightLines.push({ lineNum: null, content: line, type: 'context' });
      } else if (line.startsWith('-')) {
        leftLines.push({ lineNum: leftLineNum++, content: line.slice(1), type: 'removed' });
        rightLines.push({ lineNum: null, content: '', type: 'empty' });
      } else if (line.startsWith('+')) {
        leftLines.push({ lineNum: null, content: '', type: 'empty' });
        rightLines.push({ lineNum: rightLineNum++, content: line.slice(1), type: 'added' });
      } else {
        // Context line
        leftLines.push({ lineNum: leftLineNum++, content: line.startsWith(' ') ? line.slice(1) : line, type: 'context' });
        rightLines.push({ lineNum: rightLineNum++, content: line.startsWith(' ') ? line.slice(1) : line, type: 'context' });
      }
    }

    return { leftLines, rightLines };
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/" className={`text-sm ${theme.textLink}`}>
            ← Back to stacks
          </Link>
        </div>

        {/* Stack Header */}
        <div className={`${theme.card} mb-6`}>
        <div className={`px-6 py-5 border-b ${theme.border}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>{stack.name}</h1>
              {stack.description && (
                <p className={`mt-1 text-sm ${theme.textSecondary}`}>{stack.description}</p>
              )}
            </div>
            <button
              onClick={handleShareStack}
              className={`ml-4 px-4 py-2 rounded text-sm font-medium transition-colors ${
                isCopied
                  ? 'bg-everforest-green text-everforest-bg0'
                  : 'bg-everforest-blue text-everforest-bg0 hover:bg-everforest-blue/90'
              }`}
            >
              {isCopied ? '✓ Copied!' : '📋 Share Stack'}
            </button>
          </div>
        </div>

        {/* PR Selection List */}
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
                onSelect={setSelectedPRNumber}
                onMerge={handleMergePR}
                mergePending={mergePR.isPending}
                sortedPRs={sortedPRs}
              />
            ))}
          </div>
        </div>
        </div>

        {/* General Reviews (non-code-specific comments) */}
        {selectedPR && generalReviews.length > 0 && (
          <div className={`${theme.card} mb-6`}>
          <div className={`px-6 py-4 border-b ${theme.border}`}>
            <h2 className={`text-sm font-medium ${theme.textPrimary}`}>
              Reviews ({generalReviews.length})
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            {generalReviews.map((review) => (
              <div key={review.id} className={`border-l-2 ${
                review.state === 'APPROVED' ? 'border-everforest-green' :
                review.state === 'CHANGES_REQUESTED' ? 'border-everforest-red' :
                review.state === 'COMMENTED' ? 'border-everforest-blue' :
                'border-everforest-grey0'
              } pl-4`}>
                <div className="flex items-start gap-3">
                  <img
                    src={review.user.avatar_url}
                    alt={review.user.login}
                    className="h-8 w-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${theme.textPrimary}`}>
                        {review.user.login}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        review.state === 'APPROVED' ? theme.statusOpen :
                        review.state === 'CHANGES_REQUESTED' ? theme.statusClosed :
                        theme.statusDraft
                      }`}>
                        {review.state === 'CHANGES_REQUESTED' ? 'Changes Requested' : review.state}
                      </span>
                      <span className={`text-xs ${theme.textMuted}`}>
                        {new Date(review.submitted_at).toLocaleString()}
                      </span>
                    </div>
                    <div className={`mt-2 text-sm ${theme.textSecondary} whitespace-pre-wrap`}>
                      {review.body}
                    </div>
                    <a
                      href={review.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-2 inline-block text-xs ${theme.textLink}`}
                    >
                      View on GitHub →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* PR-Level Comments */}
        {selectedPR && (
          <div className={`${theme.card} mb-6`}>
          <div className={`px-6 py-4 border-b ${theme.border} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <h2 className={`text-sm font-medium ${theme.textPrimary}`}>
                Comments ({issueComments?.length || 0})
              </h2>
              {issueComments && issueComments.length > 0 && (
                <button
                  onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                  className={`text-xs px-2 py-1 rounded ${theme.textSecondary} hover:bg-everforest-bg3 transition-colors`}
                >
                  {isCommentsExpanded ? '▼ Collapse' : '▶ Expand'}
                </button>
              )}
            </div>
            {!isAddingPRComment && (
              <button
                onClick={() => setIsAddingPRComment(true)}
                className={`text-xs px-3 py-1 rounded ${theme.textPrimary} bg-everforest-green hover:bg-everforest-green/90 font-medium`}
              >
                Add Comment
              </button>
            )}
          </div>
          <div className="px-6 py-4 space-y-4">
            {issueComments && issueComments.length > 0 && isCommentsExpanded && issueComments.map((comment) => (
              <div key={comment.id} className="border-l-2 border-everforest-aqua pl-4">
                <div className="flex items-start gap-3">
                  <img
                    src={comment.user.avatar_url}
                    alt={comment.user.login}
                    className="h-8 w-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${theme.textPrimary}`}>
                        {comment.user.login}
                      </span>
                      <span className={`text-xs ${theme.textMuted}`}>
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className={`mt-2 text-sm ${theme.textSecondary} whitespace-pre-wrap`}>
                      {comment.body}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <a
                        href={comment.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs ${theme.textLink}`}
                      >
                        View on GitHub →
                      </a>
                      <button
                        onClick={() => {
                          setReplyingToIssueComment(comment.id);
                          setIssueReplyBody(`@${comment.user.login} `);
                        }}
                        className={`text-xs ${theme.textMuted} hover:text-everforest-green`}
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this comment?')) {
                            deleteIssueComment.mutate(comment.id);
                          }
                        }}
                        disabled={deleteIssueComment.isPending}
                        className={`text-xs ${theme.textMuted} hover:text-everforest-red disabled:opacity-50`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                {replyingToIssueComment === comment.id && (
                  <div className={`mt-3 p-3 border ${theme.border} rounded ${theme.bgSecondary}`}>
                    <textarea
                      value={issueReplyBody}
                      onChange={(e) => setIssueReplyBody(e.target.value)}
                      placeholder="Write a reply..."
                      className={`w-full p-3 border ${theme.border} rounded text-sm ${theme.textPrimary} ${theme.bgPrimary} focus:outline-none focus:ring-2 focus:ring-everforest-green`}
                      rows={4}
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={async () => {
                          if (issueReplyBody.trim()) {
                            await createIssueComment.mutateAsync(issueReplyBody);
                            setReplyingToIssueComment(null);
                            setIssueReplyBody('');
                          }
                        }}
                        disabled={!issueReplyBody.trim() || createIssueComment.isPending}
                        className={`px-4 py-2 rounded text-sm font-medium ${
                          issueReplyBody.trim() && !createIssueComment.isPending
                            ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                            : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                        }`}
                      >
                        {createIssueComment.isPending ? 'Posting...' : 'Reply'}
                      </button>
                      <button
                        onClick={() => {
                          setReplyingToIssueComment(null);
                          setIssueReplyBody('');
                        }}
                        disabled={createIssueComment.isPending}
                        className={`px-4 py-2 rounded text-sm ${theme.textSecondary} hover:bg-everforest-bg2`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Show indicator when comments are collapsed */}
            {issueComments && issueComments.length > 0 && !isCommentsExpanded && (
              <div className={`text-center py-2 ${theme.textMuted} text-sm`}>
                {issueComments.length} comment{issueComments.length !== 1 ? 's' : ''} hidden. Click "Expand" to view all.
              </div>
            )}

            {isAddingPRComment && (
              <div className={`p-4 border ${theme.border} rounded-lg ${theme.bgSecondary}`}>
                <textarea
                  value={prCommentBody}
                  onChange={(e) => setPRCommentBody(e.target.value)}
                  placeholder="Add a comment to this pull request..."
                  className={`w-full p-3 border ${theme.border} rounded text-sm ${theme.textPrimary} ${theme.bgPrimary} focus:outline-none focus:ring-2 focus:ring-everforest-green`}
                  rows={4}
                  autoFocus
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSubmitPRComment}
                    disabled={!prCommentBody.trim() || createIssueComment.isPending}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      prCommentBody.trim() && !createIssueComment.isPending
                        ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                        : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                    }`}
                  >
                    {createIssueComment.isPending ? 'Posting...' : 'Add Comment'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingPRComment(false);
                      setPRCommentBody('');
                    }}
                    disabled={createIssueComment.isPending}
                    className={`px-4 py-2 rounded text-sm ${theme.textSecondary} hover:bg-everforest-bg2`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(!issueComments || issueComments.length === 0) && !isAddingPRComment && (
              <p className={`text-sm ${theme.textMuted} text-center py-4`}>
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Main Content Area with Sidebar */}
      {selectedPR && (
        <div className="flex gap-6">
          {/* Left Sidebar - CI Status and File Tree */}
          <div className={`w-64 flex-shrink-0 ${theme.card} overflow-y-auto sticky top-6 self-start max-h-[calc(100vh-8rem)]`}>
            {/* CI Status Section */}
            <div className={`px-4 py-3 border-b ${theme.border}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-medium ${theme.textPrimary}`}>
                  CI Status
                </h3>
                {checkRuns && checkRuns.length > 0 && (
                  <button
                    onClick={() => rerunAllChecks.mutate()}
                    disabled={rerunAllChecks.isPending}
                    className={`text-xs px-2 py-1 rounded ${theme.textPrimary} bg-everforest-green hover:bg-everforest-green/90 disabled:bg-everforest-bg3 disabled:text-everforest-grey0 disabled:cursor-not-allowed font-medium transition-colors`}
                    title="Rerun all CI checks"
                  >
                    {rerunAllChecks.isPending ? '⟳ Rerunning...' : '⟳ Rerun All'}
                  </button>
                )}
              </div>
              {checkRunsLoading ? (
                <div className="text-center py-4">
                  <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
                </div>
              ) : !checkRuns || checkRuns.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} text-center py-4`}>No CI checks</p>
              ) : checkRuns.filter((check) => check.conclusion !== 'success').length === 0 ? (
                <div className={`text-center py-4 px-2 rounded ${theme.successBox}`}>
                  <p className={`text-xs ${theme.textSuccess} font-medium`}>
                    ✓ All checks passed
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checkRuns.filter((check) => check.conclusion !== 'success').map((check) => {
                    const isSuccess = check.conclusion === 'success';
                    const isFailure = check.conclusion === 'failure';
                    const isInProgress = check.status === 'in_progress';
                    const isQueued = check.status === 'queued';

                    let statusColor = theme.textMuted;
                    let statusIcon = '○';

                    if (isSuccess) {
                      statusColor = theme.textSuccess;
                      statusIcon = '✓';
                    } else if (isFailure) {
                      statusColor = theme.textError;
                      statusIcon = '✗';
                    } else if (isInProgress) {
                      statusColor = theme.textWarning;
                      statusIcon = '⟳';
                    } else if (isQueued) {
                      statusColor = theme.textMuted;
                      statusIcon = '◷';
                    } else if (check.conclusion === 'cancelled') {
                      statusColor = theme.textMuted;
                      statusIcon = '⊘';
                    } else if (check.conclusion === 'skipped') {
                      statusColor = theme.textMuted;
                      statusIcon = '⊝';
                    }

                    return (
                      <div
                        key={check.id}
                        className={`p-2 rounded border ${theme.border} hover:bg-everforest-bg1 transition-colors`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`text-sm ${statusColor} flex-shrink-0 mt-0.5`}>
                            {statusIcon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-medium ${theme.textPrimary} truncate`} title={check.name}>
                              {check.name}
                            </div>
                            {(check.html_url || check.details_url) && (
                              <a
                                href={check.html_url || check.details_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs ${theme.textLink} mt-1 inline-block`}
                              >
                                Details →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Files Changed Section */}
            <div className={`px-4 py-3 border-b ${theme.border} sticky top-0 ${theme.bgSecondary} z-10`}>
              <h3 className={`text-sm font-medium ${theme.textPrimary}`}>
                Files Changed ({diff?.length || 0})
              </h3>
            </div>
            <div className="p-2">
              {diffLoading ? (
                <div className="text-center py-4">
                  <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
                </div>
              ) : fileTree.length === 0 ? (
                <p className={`text-xs ${theme.textSecondary} p-2`}>No files changed</p>
              ) : (
                fileTree.map((node) => <FileTreeItem key={node.path} node={node} />)
              )}
            </div>
          </div>

          {/* Center - Diff Viewer */}
          <div className={`flex-1 min-w-0 ${theme.card}`}>
            <div className={`px-6 py-4 border-b ${theme.border}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className={`text-lg font-medium ${theme.textPrimary}`}>
                  #{selectedPR.number} {selectedPR.title}
                </h2>
                <div className={`mt-2 flex items-center gap-4 text-sm ${theme.textSecondary}`}>
                  <span className="flex items-center gap-1">
                    <img
                      src={selectedPR.user.avatar_url}
                      alt={selectedPR.user.login}
                      className="h-5 w-5 rounded-full"
                    />
                    {selectedPR.user.login}
                  </span>
                  <span>{selectedPR.head.ref} → {selectedPR.base.ref}</span>
                </div>
              </div>
            </div>

            {/* PR Stats */}
            {currentPRDetails && (
              <div className={`mt-3 pt-3 border-t ${theme.border}`}>
                <div className="flex items-center gap-6 text-sm">
                  <span className="flex items-center gap-1">
                    <strong>{currentPRDetails.commits}</strong> commits
                  </span>
                  <span className="flex items-center gap-1">
                    <strong>{currentPRDetails.changed_files}</strong> files
                  </span>
                  <span className={theme.textSuccess}>
                    <strong>+{currentPRDetails.additions}</strong>
                  </span>
                  <span className={theme.textError}>
                    <strong>-{currentPRDetails.deletions}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* File Changes */}
          <div className="px-6 py-5">
            <h3 className={`text-base font-medium ${theme.textPrimary} mb-4`}>
              Files Changed ({diff?.length || 0})
            </h3>

            {diffLoading ? (
              <div className="text-center py-8">
                <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 ${theme.spinner}`}></div>
                <p className={`mt-2 text-sm ${theme.textSecondary}`}>Loading diff...</p>
              </div>
            ) : !diff || diff.length === 0 ? (
              <p className={`text-sm ${theme.textSecondary}`}>No file changes to display</p>
            ) : (
              <div className="space-y-4">
                {diff.map((file) => {
                  const { leftLines, rightLines } = file.patch ? parseDiffForSplitView(file.patch) : { leftLines: [], rightLines: [] };

                  return (
                    <div
                      key={file.filename}
                      ref={(el) => (fileRefs.current[file.filename] = el)}
                      className={`border ${theme.border} rounded-lg overflow-hidden scroll-mt-4`}
                    >
                      {/* File Header */}
                      <div className={`${theme.bgSecondary} px-4 py-3 border-b ${theme.border}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                file.status === 'added'
                                  ? theme.fileAdded
                                  : file.status === 'removed'
                                  ? theme.fileRemoved
                                  : file.status === 'renamed'
                                  ? theme.fileRenamed
                                  : theme.fileModified
                              }`}
                            >
                              {file.status}
                            </span>
                            <span className={`font-mono text-sm ${theme.textPrimary}`}>{file.filename}</span>
                            {file.previous_filename && (
                              <span className={`text-xs ${theme.textSecondary}`}>
                                (renamed from {file.previous_filename})
                              </span>
                            )}
                          </div>
                          <div className={`text-xs ${theme.textSecondary}`}>
                            <span className={theme.textSuccess}>+{file.additions}</span>
                            {' / '}
                            <span className={theme.textError}>-{file.deletions}</span>
                          </div>
                        </div>
                      </div>

                      {/* Split Diff View */}
                      {file.patch && (
                        <div className="flex">
                          {/* Left Side - Original */}
                          <div className={`flex-1 border-r ${theme.border} ${theme.bgSecondary}`}>
                            <div className={`px-3 py-2 border-b ${theme.border} ${theme.bgTertiary}`}>
                              <span className={`text-xs font-medium ${theme.textSecondary}`}>Original</span>
                            </div>
                            <div>
                              {leftLines.map((line, index) => {
                                const isRemoved = line.type === 'removed';
                                const canComment = isRemoved && line.lineNum !== null;

                                // Check if this line is in the selected range
                                const isInCommentRange = commentingLine?.file === file.filename &&
                                  commentingLine?.side === 'left' &&
                                  line.lineNum !== null &&
                                  line.lineNum >= commentingLine.startLine &&
                                  line.lineNum <= commentingLine.endLine;

                                // Check if this line is being selected (dragging)
                                const isInSelectionRange = selectingLines?.file === file.filename &&
                                  selectingLines?.side === 'left' &&
                                  line.lineNum !== null &&
                                  line.lineNum >= Math.min(selectingLines.startLine, selectingLines.currentLine) &&
                                  line.lineNum <= Math.max(selectingLines.startLine, selectingLines.currentLine);

                                // Find existing comments for this line
                                // For the left side (old code), only show comments if the corresponding right line is empty
                                // This prevents showing comments on both sides for modified lines
                                const rightLine = rightLines[index];
                                const shouldShowComments = rightLine?.type === 'empty' || line.type === 'context';
                                const lineComments = shouldShowComments ? inlineComments.filter(
                                  (c) => c.path === file.filename && c.line === line.lineNum
                                ) : [];

                                return (
                                  <div key={index}>
                                    <div
                                      className={`flex font-mono text-xs ${
                                        isRemoved ? 'bg-everforest-bg-red' : ''
                                      } ${isInSelectionRange ? 'bg-everforest-blue/20' : ''} ${
                                        isInCommentRange ? 'bg-everforest-aqua/20' : ''
                                      } ${canComment ? 'cursor-pointer hover:bg-everforest-bg1' : ''}`}
                                      onMouseDown={() => canComment && handleLineMouseDown(file.filename, line.lineNum!, 'left')}
                                      onMouseEnter={() => canComment && handleLineMouseEnter(file.filename, line.lineNum!, 'left')}
                                    >
                                      <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right select-none ${theme.textMuted}`}>
                                        {line.lineNum ?? ''}
                                      </span>
                                      <span className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${
                                        isRemoved ? 'text-everforest-red' :
                                        line.type === 'context' && line.content.startsWith('@@') ? 'text-everforest-blue' :
                                        line.type === 'empty' ? theme.textMuted :
                                        theme.textSecondary
                                      }`}>
                                        {line.content || ' '}
                                      </span>
                                    </div>
                                    {lineComments.length > 0 && (
                                      <div className={`p-3 border-t ${theme.border} ${theme.bgPrimary} space-y-2`}>
                                        {lineComments.map((comment) => (
                                          <div key={comment.id} className={`border-l-2 border-everforest-blue pl-3`}>
                                            <div className="flex items-start gap-2">
                                              <img
                                                src={comment.user.avatar_url}
                                                alt={comment.user.login}
                                                className="h-5 w-5 rounded-full flex-shrink-0"
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className={`text-xs font-medium ${theme.textPrimary}`}>
                                                    {comment.user.login}
                                                  </span>
                                                  <span className={`text-xs ${theme.textMuted}`}>
                                                    {new Date(comment.created_at).toLocaleString()}
                                                  </span>
                                                </div>
                                                <div className={`mt-1 text-xs ${theme.textSecondary} whitespace-pre-wrap`}>
                                                  {comment.body}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2">
                                                  <a
                                                    href={comment.html_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`text-xs ${theme.textLink}`}
                                                  >
                                                    View on GitHub →
                                                  </a>
                                                  <button
                                                    onClick={() => {
                                                      setReplyingToComment(comment.id);
                                                      setReplyBody('');
                                                    }}
                                                    className={`text-xs ${theme.textMuted} hover:text-everforest-green`}
                                                  >
                                                    Reply
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      if (confirm('Are you sure you want to delete this comment?')) {
                                                        deleteComment.mutate(comment.id);
                                                      }
                                                    }}
                                                    disabled={deleteComment.isPending}
                                                    className={`text-xs ${theme.textMuted} hover:text-everforest-red disabled:opacity-50`}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                        {replyingToComment && lineComments.some(c => c.id === replyingToComment) && (
                                          <div className={`mt-2 p-3 border ${theme.border} rounded ${theme.bgSecondary}`}>
                                            <textarea
                                              value={replyBody}
                                              onChange={(e) => setReplyBody(e.target.value)}
                                              placeholder="Write a reply..."
                                              className={`w-full p-2 border ${theme.border} rounded text-xs ${theme.textPrimary} ${theme.bgPrimary} focus:outline-none focus:ring-2 focus:ring-everforest-green`}
                                              rows={3}
                                              autoFocus
                                            />
                                            <div className="mt-2 flex gap-2">
                                              <button
                                                onClick={async () => {
                                                  if (replyBody.trim()) {
                                                    await replyToComment.mutateAsync({ commentId: replyingToComment, body: replyBody });
                                                    setReplyingToComment(null);
                                                    setReplyBody('');
                                                  }
                                                }}
                                                disabled={!replyBody.trim() || replyToComment.isPending}
                                                className={`px-3 py-1 rounded text-xs font-medium ${
                                                  replyBody.trim() && !replyToComment.isPending
                                                    ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                                                    : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                                                }`}
                                              >
                                                {replyToComment.isPending ? 'Posting...' : 'Reply'}
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setReplyingToComment(null);
                                                  setReplyBody('');
                                                }}
                                                disabled={replyToComment.isPending}
                                                className={`px-3 py-1 rounded text-xs ${theme.textSecondary} hover:bg-everforest-bg2`}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {commentingLine?.file === file.filename &&
                                     commentingLine?.side === 'left' &&
                                     line.lineNum === commentingLine.endLine && (
                                      <div className={`p-3 border-t ${theme.border} ${theme.bgPrimary}`}>
                                        <div className={`mb-2 flex items-center justify-between`}>
                                          <div className={`text-xs ${theme.textMuted}`}>
                                            Commenting on line{commentingLine.startLine !== commentingLine.endLine ? 's' : ''} {commentingLine.startLine}{commentingLine.startLine !== commentingLine.endLine && `-${commentingLine.endLine}`}
                                          </div>
                                          <button
                                            onClick={handleSuggestion}
                                            disabled={createComment.isPending}
                                            className={`text-xs px-2 py-1 rounded ${theme.textLink} hover:bg-everforest-bg2`}
                                            title="Insert suggestion template"
                                          >
                                            💡 Suggestion
                                          </button>
                                        </div>
                                        <textarea
                                          value={commentBody}
                                          onChange={(e) => setCommentBody(e.target.value)}
                                          placeholder="Add a comment..."
                                          className={`w-full p-2 border ${theme.border} rounded text-sm ${theme.textPrimary} ${theme.bgSecondary} focus:outline-none focus:ring-2 focus:ring-everforest-green font-mono`}
                                          rows={3}
                                          autoFocus
                                        />
                                        <div className="mt-2 flex gap-2">
                                          <button
                                            onClick={handleSubmitComment}
                                            disabled={!commentBody.trim() || createComment.isPending}
                                            className={`px-3 py-1 rounded text-sm font-medium ${
                                              commentBody.trim() && !createComment.isPending
                                                ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                                                : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                                            }`}
                                          >
                                            {createComment.isPending ? 'Posting...' : 'Add comment'}
                                          </button>
                                          <button
                                            onClick={handleCancelComment}
                                            disabled={createComment.isPending}
                                            className={`px-3 py-1 rounded text-sm ${theme.textSecondary} hover:bg-everforest-bg2`}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Right Side - Modified */}
                          <div className={`flex-1 ${theme.bgSecondary}`}>
                            <div className={`px-3 py-2 border-b ${theme.border} ${theme.bgTertiary}`}>
                              <span className={`text-xs font-medium ${theme.textSecondary}`}>Modified</span>
                            </div>
                            <div>
                              {rightLines.map((line, index) => {
                                const isAdded = line.type === 'added';
                                const canComment = isAdded && line.lineNum !== null;

                                // Check if this line is in the selected range
                                const isInCommentRange = commentingLine?.file === file.filename &&
                                  commentingLine?.side === 'right' &&
                                  line.lineNum !== null &&
                                  line.lineNum >= commentingLine.startLine &&
                                  line.lineNum <= commentingLine.endLine;

                                // Check if this line is being selected (dragging)
                                const isInSelectionRange = selectingLines?.file === file.filename &&
                                  selectingLines?.side === 'right' &&
                                  line.lineNum !== null &&
                                  line.lineNum >= Math.min(selectingLines.startLine, selectingLines.currentLine) &&
                                  line.lineNum <= Math.max(selectingLines.startLine, selectingLines.currentLine);

                                // Find existing comments for this line
                                const lineComments = inlineComments.filter(
                                  (c) => c.path === file.filename && c.line === line.lineNum
                                );

                                return (
                                  <div key={index}>
                                    <div
                                      className={`flex font-mono text-xs ${
                                        isAdded ? 'bg-everforest-bg-green' : ''
                                      } ${isInSelectionRange ? 'bg-everforest-blue/20' : ''} ${
                                        isInCommentRange ? 'bg-everforest-aqua/20' : ''
                                      } ${canComment ? 'cursor-pointer hover:bg-everforest-bg1' : ''}`}
                                      onMouseDown={() => canComment && handleLineMouseDown(file.filename, line.lineNum!, 'right')}
                                      onMouseEnter={() => canComment && handleLineMouseEnter(file.filename, line.lineNum!, 'right')}
                                    >
                                      <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right select-none ${theme.textMuted}`}>
                                        {line.lineNum ?? ''}
                                      </span>
                                      <span className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${
                                        isAdded ? 'text-everforest-green' :
                                        line.type === 'context' && line.content.startsWith('@@') ? 'text-everforest-blue' :
                                        line.type === 'empty' ? theme.textMuted :
                                        theme.textSecondary
                                      }`}>
                                        {line.content || ' '}
                                      </span>
                                    </div>
                                    {lineComments.length > 0 && (
                                      <div className={`p-3 border-t ${theme.border} ${theme.bgPrimary} space-y-2`}>
                                        {lineComments.map((comment) => (
                                          <div key={comment.id} className={`border-l-2 border-everforest-blue pl-3`}>
                                            <div className="flex items-start gap-2">
                                              <img
                                                src={comment.user.avatar_url}
                                                alt={comment.user.login}
                                                className="h-5 w-5 rounded-full flex-shrink-0"
                                              />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className={`text-xs font-medium ${theme.textPrimary}`}>
                                                    {comment.user.login}
                                                  </span>
                                                  <span className={`text-xs ${theme.textMuted}`}>
                                                    {new Date(comment.created_at).toLocaleString()}
                                                  </span>
                                                </div>
                                                <div className={`mt-1 text-xs ${theme.textSecondary} whitespace-pre-wrap`}>
                                                  {comment.body}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2">
                                                  <a
                                                    href={comment.html_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`text-xs ${theme.textLink}`}
                                                  >
                                                    View on GitHub →
                                                  </a>
                                                  <button
                                                    onClick={() => {
                                                      setReplyingToComment(comment.id);
                                                      setReplyBody('');
                                                    }}
                                                    className={`text-xs ${theme.textMuted} hover:text-everforest-green`}
                                                  >
                                                    Reply
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      if (confirm('Are you sure you want to delete this comment?')) {
                                                        deleteComment.mutate(comment.id);
                                                      }
                                                    }}
                                                    disabled={deleteComment.isPending}
                                                    className={`text-xs ${theme.textMuted} hover:text-everforest-red disabled:opacity-50`}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                        {replyingToComment && lineComments.some(c => c.id === replyingToComment) && (
                                          <div className={`mt-2 p-3 border ${theme.border} rounded ${theme.bgSecondary}`}>
                                            <textarea
                                              value={replyBody}
                                              onChange={(e) => setReplyBody(e.target.value)}
                                              placeholder="Write a reply..."
                                              className={`w-full p-2 border ${theme.border} rounded text-xs ${theme.textPrimary} ${theme.bgPrimary} focus:outline-none focus:ring-2 focus:ring-everforest-green`}
                                              rows={3}
                                              autoFocus
                                            />
                                            <div className="mt-2 flex gap-2">
                                              <button
                                                onClick={async () => {
                                                  if (replyBody.trim()) {
                                                    await replyToComment.mutateAsync({ commentId: replyingToComment, body: replyBody });
                                                    setReplyingToComment(null);
                                                    setReplyBody('');
                                                  }
                                                }}
                                                disabled={!replyBody.trim() || replyToComment.isPending}
                                                className={`px-3 py-1 rounded text-xs font-medium ${
                                                  replyBody.trim() && !replyToComment.isPending
                                                    ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                                                    : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                                                }`}
                                              >
                                                {replyToComment.isPending ? 'Posting...' : 'Reply'}
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setReplyingToComment(null);
                                                  setReplyBody('');
                                                }}
                                                disabled={replyToComment.isPending}
                                                className={`px-3 py-1 rounded text-xs ${theme.textSecondary} hover:bg-everforest-bg2`}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {commentingLine?.file === file.filename &&
                                     commentingLine?.side === 'right' &&
                                     line.lineNum === commentingLine.endLine && (
                                      <div className={`p-3 border-t ${theme.border} ${theme.bgPrimary}`}>
                                        <div className={`mb-2 flex items-center justify-between`}>
                                          <div className={`text-xs ${theme.textMuted}`}>
                                            Commenting on line{commentingLine.startLine !== commentingLine.endLine ? 's' : ''} {commentingLine.startLine}{commentingLine.startLine !== commentingLine.endLine && `-${commentingLine.endLine}`}
                                          </div>
                                          <button
                                            onClick={handleSuggestion}
                                            disabled={createComment.isPending}
                                            className={`text-xs px-2 py-1 rounded ${theme.textLink} hover:bg-everforest-bg2`}
                                            title="Insert suggestion template"
                                          >
                                            💡 Suggestion
                                          </button>
                                        </div>
                                        <textarea
                                          value={commentBody}
                                          onChange={(e) => setCommentBody(e.target.value)}
                                          placeholder="Add a comment..."
                                          className={`w-full p-2 border ${theme.border} rounded text-sm ${theme.textPrimary} ${theme.bgSecondary} focus:outline-none focus:ring-2 focus:ring-everforest-green font-mono`}
                                          rows={3}
                                          autoFocus
                                        />
                                        <div className="mt-2 flex gap-2">
                                          <button
                                            onClick={handleSubmitComment}
                                            disabled={!commentBody.trim() || createComment.isPending}
                                            className={`px-3 py-1 rounded text-sm font-medium ${
                                              commentBody.trim() && !createComment.isPending
                                                ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                                                : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                                            }`}
                                          >
                                            {createComment.isPending ? 'Posting...' : 'Add comment'}
                                          </button>
                                          <button
                                            onClick={handleCancelComment}
                                            disabled={createComment.isPending}
                                            className={`px-3 py-1 rounded text-sm ${theme.textSecondary} hover:bg-everforest-bg2`}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
