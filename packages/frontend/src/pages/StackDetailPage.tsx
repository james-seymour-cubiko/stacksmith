import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStack } from '../hooks/useStacks';
import { usePR, usePRDiff, usePRCommits, useCreatePRComment, usePRComments, usePRReviews, usePRIssueComments, useCreatePRIssueComment, useMergePR, usePRCheckRuns, useRerunAllChecks, useDeleteComment, useDeleteIssueComment, useReplyToComment, useApprovePR } from '../hooks/usePRs';
import { theme } from '../lib/theme';
import { StackHeader } from '../components/StackHeader';
import { CIStatusPanel } from '../components/CIStatusPanel';
import { SyntaxHighlightedLine } from '../components/SyntaxHighlightedLine';
import { InlineDiffLine } from '../components/InlineDiffLine';
import { getLanguageFromFilename } from '../lib/languageMapper';
import { configAPI } from '../lib/api';
import DiffMatchPatch from 'diff-match-patch';
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


export function StackDetailPage() {
  const { stackId, prNumber } = useParams<{ stackId: string; prNumber?: string }>();
  const { data: stack, isLoading, error } = useStack(stackId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Track selected PR for diff view (read from URL or default to first PR)
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(
    prNumber ? parseInt(prNumber) : null
  );

  // Sync selected PR when URL changes
  useEffect(() => {
    if (prNumber) {
      const prNum = parseInt(prNumber);
      if (prNum !== selectedPRNumber) {
        setSelectedPRNumber(prNum);
      }
    }
  }, [prNumber]);

  // Update URL when selected PR changes
  useEffect(() => {
    if (selectedPRNumber && stackId) {
      const newPath = `/stacks/${stackId}/pr/${selectedPRNumber}`;
      if (window.location.pathname !== newPath) {
        navigate(newPath, { replace: true });
      }
    }
  }, [selectedPRNumber, stackId, navigate]);

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

  // Approve PR mutation
  const approvePR = useApprovePR(currentPRNumber || 0);

  // Fetch GitHub config to get current user
  const { data: config } = useQuery({
    queryKey: ['config', 'github'],
    queryFn: () => configAPI.getGithub(),
  });

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

  // Track expanded files in diff view (files are collapsed by default)
  const [expandedFiles, setExpandedFiles] = useState<Set<string> | null>(null);

  // Initialize all files as collapsed when diff loads
  useEffect(() => {
    if (diff && expandedFiles === null) {
      setExpandedFiles(new Set());
    }
  }, [diff, expandedFiles]);

  const toggleFileExpanded = (filename: string) => {
    setExpandedFiles((prev) => {
      if (!prev) return new Set([filename]);
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const expandAllFiles = () => {
    if (diff) {
      setExpandedFiles(new Set(diff.map(f => f.filename)));
    }
  };

  const collapseAllFiles = () => {
    setExpandedFiles(new Set());
  };

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
    const isFileExpanded = expandedFiles?.has(node.path) ?? false;

    return (
      <button
        onClick={() => {
          scrollToFile(node.path);
          toggleFileExpanded(node.path);
        }}
        className={`w-full text-left px-2 py-1 rounded flex items-center gap-1 text-xs transition-colors ${
          isSelected ? 'bg-everforest-bg2 border-l-2 border-everforest-green' : 'hover:bg-everforest-bg2'
        } ${!isFileExpanded ? 'opacity-50' : ''}`}
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
    const dmp = new DiffMatchPatch();
    const lines = patch.split('\n');

    type DiffSegment = { text: string; type: 'equal' | 'delete' | 'insert' };
    type LineData = {
      lineNum: number | null;
      content: string;
      type: 'context' | 'removed' | 'added' | 'empty' | 'modified';
      inlineDiff?: DiffSegment[];
    };

    const leftLines: LineData[] = [];
    const rightLines: LineData[] = [];

    let leftLineNum = 0;
    let rightLineNum = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('@@')) {
        // Parse hunk header to get line numbers
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          leftLineNum = parseInt(match[1]);
          rightLineNum = parseInt(match[2]);
        }
        leftLines.push({ lineNum: null, content: line, type: 'context' });
        rightLines.push({ lineNum: null, content: line, type: 'context' });
        i++;
      } else if (line.startsWith('-')) {
        // Collect all consecutive removed lines
        const removedLines: string[] = [];
        let j = i;
        while (j < lines.length && lines[j].startsWith('-')) {
          removedLines.push(lines[j].slice(1));
          j++;
        }

        // Check if followed by added lines
        const addedLines: string[] = [];
        let k = j;
        while (k < lines.length && lines[k].startsWith('+')) {
          addedLines.push(lines[k].slice(1));
          k++;
        }

        if (addedLines.length > 0) {
          // We have a block of removes followed by adds - pair them up
          const maxLines = Math.max(removedLines.length, addedLines.length);

          for (let idx = 0; idx < maxLines; idx++) {
            const oldContent = removedLines[idx];
            const newContent = addedLines[idx];

            if (oldContent !== undefined && newContent !== undefined) {
              // Pair these lines and compute inline diff
              const diffs = dmp.diff_main(oldContent, newContent);
              dmp.diff_cleanupSemantic(diffs);

              // Calculate similarity ratio
              let equalChars = 0;
              let totalChars = 0;
              for (const [op, text] of diffs) {
                totalChars += text.length;
                if (op === 0) equalChars += text.length; // 0 = DIFF_EQUAL
              }
              const similarity = totalChars > 0 ? equalChars / totalChars : 0;

              // Only show inline diff if > 40% similar, otherwise show as regular modified lines
              if (similarity > 0.4) {
                const leftSegments: DiffSegment[] = [];
                const rightSegments: DiffSegment[] = [];

                for (const [op, text] of diffs) {
                  if (op === 0) {
                    // Equal
                    leftSegments.push({ text, type: 'equal' });
                    rightSegments.push({ text, type: 'equal' });
                  } else if (op === -1) {
                    // Delete
                    leftSegments.push({ text, type: 'delete' });
                  } else if (op === 1) {
                    // Insert
                    rightSegments.push({ text, type: 'insert' });
                  }
                }

                leftLines.push({ lineNum: leftLineNum++, content: oldContent, type: 'modified', inlineDiff: leftSegments });
                rightLines.push({ lineNum: rightLineNum++, content: newContent, type: 'modified', inlineDiff: rightSegments });
              } else {
                // Too different - show as separate remove and add without inline diff
                leftLines.push({ lineNum: leftLineNum++, content: oldContent, type: 'removed' });
                rightLines.push({ lineNum: rightLineNum++, content: newContent, type: 'added' });
              }
            } else if (oldContent !== undefined) {
              // Only removed line, no corresponding add
              leftLines.push({ lineNum: leftLineNum++, content: oldContent, type: 'removed' });
              rightLines.push({ lineNum: null, content: '', type: 'empty' });
            } else if (newContent !== undefined) {
              // Only added line, no corresponding remove
              leftLines.push({ lineNum: null, content: '', type: 'empty' });
              rightLines.push({ lineNum: rightLineNum++, content: newContent, type: 'added' });
            }
          }

          i = k; // Skip all processed lines
        } else {
          // Only removed lines, no adds following
          for (const content of removedLines) {
            leftLines.push({ lineNum: leftLineNum++, content, type: 'removed' });
            rightLines.push({ lineNum: null, content: '', type: 'empty' });
          }
          i = j;
        }
      } else if (line.startsWith('+')) {
        // Standalone added line (not preceded by removes)
        leftLines.push({ lineNum: null, content: '', type: 'empty' });
        rightLines.push({ lineNum: rightLineNum++, content: line.slice(1), type: 'added' });
        i++;
      } else {
        // Context line
        const content = line.startsWith(' ') ? line.slice(1) : line;
        leftLines.push({ lineNum: leftLineNum++, content, type: 'context' });
        rightLines.push({ lineNum: rightLineNum++, content, type: 'context' });
        i++;
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

        <div className="flex gap-6 mb-6">
          {/* Left side - Stack Header and PR List */}
          <div className="flex-1 min-w-0">
            <StackHeader
              stack={stack}
              isCopied={isCopied}
              onShareStack={handleShareStack}
              sortedPRs={sortedPRs}
              currentPRNumber={currentPRNumber}
              onSelectPR={setSelectedPRNumber}
              onMergePR={handleMergePR}
              mergePending={mergePR.isPending}
            />
          </div>

          {/* Right side - CI Status */}
          {selectedPR && (
            <CIStatusPanel
              checkRuns={checkRuns}
              checkRunsLoading={checkRunsLoading}
              onRerunAll={() => rerunAllChecks.mutate()}
              rerunPending={rerunAllChecks.isPending}
            />
          )}
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
          {/* Left Sidebar - File Tree */}
          <div className={`w-80 flex-shrink-0 ${theme.card} overflow-y-auto sticky top-6 self-start max-h-[calc(100vh-8rem)]`}>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-medium ${theme.textPrimary}`}>
                Files Changed ({diff?.length || 0})
              </h3>
              {diff && diff.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={expandAllFiles}
                    className={`text-xs px-3 py-1 rounded ${theme.textPrimary} bg-everforest-bg3 hover:bg-everforest-bg4 transition-colors`}
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAllFiles}
                    className={`text-xs px-3 py-1 rounded ${theme.textPrimary} bg-everforest-bg3 hover:bg-everforest-bg4 transition-colors`}
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>

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
                  const language = getLanguageFromFilename(file.filename);

                  return (
                    <div
                      key={file.filename}
                      ref={(el) => (fileRefs.current[file.filename] = el)}
                      className={`border ${theme.border} rounded-lg overflow-hidden scroll-mt-4`}
                    >
                      {/* File Header */}
                      <button
                        onClick={() => toggleFileExpanded(file.filename)}
                        className={`w-full ${theme.bgSecondary} px-4 py-3 border-b ${theme.border} hover:bg-everforest-bg3 transition-colors`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs ${theme.textSecondary}`}>
                              {expandedFiles?.has(file.filename) ? '▼' : '▶'}
                            </span>
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
                      </button>

                      {/* Split Diff View */}
                      {file.patch && expandedFiles?.has(file.filename) && (
                        <div className="flex">
                          {/* Left Side - Original */}
                          <div className={`flex-1 border-r ${theme.border} ${theme.bgSecondary}`}>
                            <div className={`px-3 py-2 border-b ${theme.border} ${theme.bgTertiary}`}>
                              <span className={`text-xs font-medium ${theme.textSecondary}`}>Original</span>
                            </div>
                            <div>
                              {leftLines.map((line, index) => {
                                const isRemoved = line.type === 'removed';
                                const isModified = line.type === 'modified';
                                const canComment = (isRemoved || isModified) && line.lineNum !== null;

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
                                        isRemoved ? 'bg-everforest-bg-red' : isModified ? 'bg-everforest-bg-red/15' : ''
                                      } ${isInSelectionRange ? 'bg-everforest-blue/20' : ''} ${
                                        isInCommentRange ? 'bg-everforest-aqua/20' : ''
                                      } ${canComment ? 'cursor-pointer' : ''}`}
                                      onMouseDown={() => canComment && handleLineMouseDown(file.filename, line.lineNum!, 'left')}
                                      onMouseEnter={() => canComment && handleLineMouseEnter(file.filename, line.lineNum!, 'left')}
                                    >
                                      <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right select-none ${theme.textMuted}`}>
                                        {line.lineNum ?? ''}
                                      </span>
                                      <span className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${
                                        isRemoved || isModified ? 'text-everforest-red' :
                                        line.type === 'context' && line.content.startsWith('@@') ? 'text-everforest-blue' :
                                        line.type === 'empty' ? theme.textMuted :
                                        theme.textSecondary
                                      }`}>
                                        {line.type === 'context' && line.content.startsWith('@@') ? (
                                          line.content || ' '
                                        ) : line.type === 'empty' || !line.content ? (
                                          ' '
                                        ) : line.inlineDiff ? (
                                          <InlineDiffLine segments={line.inlineDiff} language={language} isModifiedLine={true} />
                                        ) : (
                                          <SyntaxHighlightedLine code={line.content} language={language} />
                                        )}
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
                                const isModified = line.type === 'modified';
                                const canComment = (isAdded || isModified) && line.lineNum !== null;

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
                                        isAdded ? 'bg-everforest-bg-green' : isModified ? 'bg-everforest-bg-green/15' : ''
                                      } ${isInSelectionRange ? 'bg-everforest-blue/20' : ''} ${
                                        isInCommentRange ? 'bg-everforest-aqua/20' : ''
                                      } ${canComment ? 'cursor-pointer' : ''}`}
                                      onMouseDown={() => canComment && handleLineMouseDown(file.filename, line.lineNum!, 'right')}
                                      onMouseEnter={() => canComment && handleLineMouseEnter(file.filename, line.lineNum!, 'right')}
                                    >
                                      <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right select-none ${theme.textMuted}`}>
                                        {line.lineNum ?? ''}
                                      </span>
                                      <span className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${
                                        isAdded || isModified ? 'text-everforest-green' :
                                        line.type === 'context' && line.content.startsWith('@@') ? 'text-everforest-blue' :
                                        line.type === 'empty' ? theme.textMuted :
                                        theme.textSecondary
                                      }`}>
                                        {line.type === 'context' && line.content.startsWith('@@') ? (
                                          line.content || ' '
                                        ) : line.type === 'empty' || !line.content ? (
                                          ' '
                                        ) : line.inlineDiff ? (
                                          <InlineDiffLine segments={line.inlineDiff} language={language} isModifiedLine={true} />
                                        ) : (
                                          <SyntaxHighlightedLine code={line.content} language={language} />
                                        )}
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

      {/* Extra scrolling space */}
      <div className="h-[50vh]"></div>

      {/* Sticky Approve Button - only show if current user is not the PR author */}
      {selectedPR && config?.currentUser && selectedPR.user.login !== config.currentUser && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => approvePR.mutate()}
            disabled={approvePR.isPending}
            className={`px-6 py-3 rounded-lg font-medium shadow-lg transition-colors ${
              approvePR.isPending
                ? 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                : 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
            }`}
          >
            {approvePR.isPending ? 'Approving...' : '✓ Approve PR'}
          </button>
        </div>
      )}
    </div>
  );
}
