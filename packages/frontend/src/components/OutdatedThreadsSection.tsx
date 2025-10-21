import { useState, useEffect } from 'react';
import { CommentThread, GithubComment } from '@review-app/shared';
import { theme } from '../lib/theme';
import { ThreadStatusBadge } from './ThreadStatusBadge';
import { SyntaxHighlightedLine } from './SyntaxHighlightedLine';

interface OutdatedThreadsSectionProps {
  threads: CommentThread[];
  onReply: (threadId: string, commentId: number, body: string) => void;
  onResolve: (threadId: string) => void;
  onUnresolve: (threadId: string) => void;
  onDelete: (commentId: number) => void;
  replyPending: boolean;
  deletePending: boolean;
  resolvePending: boolean;
  unresolvePending: boolean;
  language?: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

// Parse diff_hunk to extract code lines
function parseDiffHunk(diffHunk: string): { lineNum: number | null; content: string; type: 'context' | 'added' | 'removed' }[] {
  const lines = diffHunk.split('\n');
  const result: { lineNum: number | null; content: string; type: 'context' | 'added' | 'removed' }[] = [];

  let leftLineNum: number | null = null;
  let rightLineNum: number | null = null;

  for (const line of lines) {
    // Parse hunk header like @@ -10,7 +10,6 @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        leftLineNum = parseInt(match[1], 10);
        rightLineNum = parseInt(match[2], 10);
      }
      result.push({ lineNum: null, content: line, type: 'context' });
      continue;
    }

    if (line.startsWith('-')) {
      result.push({ lineNum: leftLineNum, content: line.substring(1), type: 'removed' });
      if (leftLineNum !== null) leftLineNum++;
    } else if (line.startsWith('+')) {
      result.push({ lineNum: rightLineNum, content: line.substring(1), type: 'added' });
      if (rightLineNum !== null) rightLineNum++;
    } else {
      // Context line (no prefix or space prefix)
      const content = line.startsWith(' ') ? line.substring(1) : line;
      result.push({ lineNum: leftLineNum ?? rightLineNum, content, type: 'context' });
      if (leftLineNum !== null) leftLineNum++;
      if (rightLineNum !== null) rightLineNum++;
    }
  }

  return result;
}

export function OutdatedThreadsSection({
  threads,
  onReply,
  onResolve,
  onUnresolve,
  onDelete,
  replyPending,
  deletePending,
  resolvePending,
  unresolvePending,
  language,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
}: OutdatedThreadsSectionProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{ threadId: string; commentId: number } | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const toggleThreadCollapse = (threadId: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const handleReplySubmit = async (threadId: string, commentId: number) => {
    if (replyBody.trim() && !replyPending) {
      await onReply(threadId, commentId, replyBody);
      setReplyingTo(null);
      setReplyBody('');
    }
  };

  // When section is expanded, collapse all resolved threads but keep unresolved ones expanded
  useEffect(() => {
    if (isExpanded) {
      const resolvedThreadIds = threads.filter(t => t.resolved).map(t => t.id);
      setCollapsedThreads(new Set(resolvedThreadIds));
    }
  }, [isExpanded, threads]);

  if (threads.length === 0) {
    return null;
  }

  return (
    <div className={`border-b ${theme.border} ${theme.bgSecondary}`}>
      {/* Header - Collapsible */}
      <button
        onClick={() => {
          if (onToggleExpanded) {
            onToggleExpanded();
          } else {
            setInternalIsExpanded(!internalIsExpanded);
          }
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-everforest-bg3 transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs ${theme.textSecondary}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className={`text-sm text-everforest-yellow`}>
            ⏱
          </span>
          <span className={`text-sm font-medium text-everforest-yellow`}>
            Outdated Threads
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-4 max-w-5xl mx-auto">
          {threads.map((thread) => {
            const isCollapsed = collapsedThreads.has(thread.id);
            const diffLines = thread.diffHunk ? parseDiffHunk(thread.diffHunk) : [];

            return (
              <div
                key={thread.id}
                className={`border-2 border-everforest-yellow/40 bg-everforest-bg1 rounded-lg ${thread.resolved ? 'opacity-75' : ''}`}
              >
                {/* Thread Header */}
                <div
                  className={`p-2 border-b ${theme.border} bg-everforest-bg2/30 flex items-center justify-between cursor-pointer hover:bg-everforest-bg2 transition-colors`}
                  onClick={() => toggleThreadCollapse(thread.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${theme.textMuted}`}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                    <span className={`text-xs font-medium ${theme.textPrimary}`}>
                      {thread.parentComment.user.login}
                    </span>
                    <ThreadStatusBadge resolved={thread.resolved} />
                    {thread.replies.length > 0 && (
                      <span className={`text-xs ${theme.textMuted}`}>
                        ({thread.replies.length + 1} comment{thread.replies.length + 1 !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <span className={`text-xs ${theme.textMuted}`}>
                    {new Date(thread.parentComment.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Thread Content */}
                {!isCollapsed && (
                  <>
                    {/* Code Snippet from diff_hunk */}
                    {diffLines.length > 0 && (
                      <div className={`border-b ${theme.border} ${theme.bgPrimary} overflow-x-auto`}>
                        <div className={`px-3 py-1.5 ${theme.bgTertiary} border-b ${theme.border}`}>
                          <span className={`text-xs font-medium ${theme.textMuted}`}>
                            Original Code (Line {thread.line})
                          </span>
                        </div>
                        <div className="font-mono text-xs">
                          {diffLines.map((line, index) => {
                            const isCommentedLine = line.lineNum === thread.line;
                            const bgColor = line.type === 'removed'
                              ? 'bg-everforest-bg-red/15'
                              : line.type === 'added'
                              ? 'bg-everforest-bg-green/15'
                              : isCommentedLine
                              ? 'bg-everforest-yellow/10'
                              : '';

                            return (
                              <div key={index} className={`flex ${bgColor}`}>
                                <span className={`w-12 flex-shrink-0 px-2 py-0.5 text-right select-none ${theme.textMuted}`}>
                                  {line.lineNum ?? ''}
                                </span>
                                <span className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-all ${
                                  line.type === 'removed' ? 'text-everforest-red' :
                                  line.type === 'added' ? 'text-everforest-green' :
                                  line.content.startsWith('@@') ? 'text-everforest-blue' :
                                  theme.textSecondary
                                }`}>
                                  {line.content.startsWith('@@') ? (
                                    line.content
                                  ) : (
                                    <SyntaxHighlightedLine code={line.content} language={language} />
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Parent Comment */}
                    <div className="p-3">
                      <div className="flex items-start gap-2">
                        <img
                          src={thread.parentComment.user.avatar_url}
                          alt={thread.parentComment.user.login}
                          className="h-5 w-5 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${theme.textPrimary} whitespace-pre-wrap`}>
                            {thread.parentComment.body}
                          </div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <a
                              href={thread.parentComment.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs ${theme.textLink}`}
                            >
                              View on GitHub →
                            </a>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this comment?')) {
                                  onDelete(thread.parentComment.id);
                                }
                              }}
                              disabled={deletePending}
                              className={`text-xs ${theme.textMuted} hover:text-everforest-red disabled:opacity-50`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {thread.replies.length > 0 && (
                      <div className={`px-3 pb-3 space-y-2 border-l-2 ml-3 ${theme.border}`}>
                        {thread.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2 pl-3">
                            <img
                              src={reply.user.avatar_url}
                              alt={reply.user.login}
                              className="h-5 w-5 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${theme.textPrimary}`}>
                                  {reply.user.login}
                                </span>
                                <span className={`text-xs ${theme.textMuted}`}>
                                  {new Date(reply.created_at).toLocaleString()}
                                </span>
                              </div>
                              <div className={`text-sm ${theme.textPrimary} whitespace-pre-wrap`}>
                                {reply.body}
                              </div>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <a
                                  href={reply.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs ${theme.textLink}`}
                                >
                                  View on GitHub →
                                </a>
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this comment?')) {
                                      onDelete(reply.id);
                                    }
                                  }}
                                  disabled={deletePending}
                                  className={`text-xs ${theme.textMuted} hover:text-everforest-red disabled:opacity-50`}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Form */}
                    {replyingTo?.threadId === thread.id ? (
                      <div className={`p-3 border-t ${theme.border}`}>
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              e.preventDefault();
                              handleReplySubmit(thread.id, replyingTo.commentId);
                            }
                          }}
                          placeholder="Write a reply..."
                          className={`w-full p-2 border ${theme.border} rounded text-sm ${theme.textPrimary} ${theme.bgPrimary} focus:outline-none focus:ring-2 focus:ring-everforest-green`}
                          rows={3}
                          autoFocus
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => handleReplySubmit(thread.id, replyingTo.commentId)}
                            disabled={!replyBody.trim() || replyPending}
                            className={`px-3 py-1 rounded text-xs font-medium ${
                              replyBody.trim() && !replyPending
                                ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                                : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                            }`}
                          >
                            {replyPending ? 'Posting...' : 'Reply'}
                          </button>
                          <button
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyBody('');
                            }}
                            disabled={replyPending}
                            className={`px-3 py-1 rounded text-xs ${theme.textSecondary} hover:bg-everforest-bg2`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-2 border-t ${theme.border} bg-everforest-bg1/30 flex gap-2`}>
                        <button
                          onClick={() => setReplyingTo({ threadId: thread.id, commentId: thread.parentComment.id })}
                          className={`flex-1 px-4 py-2 rounded border-2 border-everforest-blue/40 text-sm font-medium ${theme.textPrimary} hover:bg-everforest-bg2 hover:border-everforest-blue transition-colors`}
                        >
                          Reply
                        </button>
                        <button
                          onClick={() => thread.resolved ? onUnresolve(thread.id) : onResolve(thread.id)}
                          disabled={resolvePending || unresolvePending}
                          className={`flex-1 px-4 py-2 rounded border-2 text-sm font-medium transition-colors ${
                            thread.resolved
                              ? 'border-everforest-yellow/40 text-everforest-yellow hover:bg-everforest-bg2 hover:border-everforest-yellow'
                              : 'border-everforest-green/40 text-everforest-green hover:bg-everforest-bg2 hover:border-everforest-green'
                          } ${resolvePending || unresolvePending ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {resolvePending || unresolvePending
                            ? '...'
                            : thread.resolved
                            ? 'Unresolve'
                            : 'Resolve'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
