import React, { useState } from 'react';
import { CommentThread } from '@review-app/shared';
import { theme } from '../lib/theme';
import { ThreadStatusBadge } from './ThreadStatusBadge';
import { ThreadResolutionButton } from './ThreadResolutionButton';
import { getThreadReplyCount } from '../lib/threadUtils';

interface ThreadListProps {
  threads: CommentThread[];
  onResolve: (threadId: string) => void;
  onUnresolve: (threadId: string) => void;
  onThreadClick?: (thread: CommentThread) => void;
  isLoading?: boolean;
}

export function ThreadList({ threads, onResolve, onUnresolve, onThreadClick, isLoading = false }: ThreadListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Group threads by file
  const threadsByFile = new Map<string, CommentThread[]>();
  for (const thread of threads) {
    if (!threadsByFile.has(thread.path)) {
      threadsByFile.set(thread.path, []);
    }
    threadsByFile.get(thread.path)!.push(thread);
  }

  const resolvedCount = threads.filter((t) => t.resolved).length;
  const totalCount = threads.length;

  return (
    <div className={`${theme.card} mb-6`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${theme.border} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {threads.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-xs ${theme.textSecondary} hover:text-everforest-fg transition-colors`}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          <h2 className={`text-sm font-medium ${theme.textPrimary}`}>
            Comment Threads ({resolvedCount} / {totalCount} resolved)
          </h2>
        </div>
      </div>

      {/* Thread list */}
      {isExpanded && (
        <div className="px-6 py-4 space-y-4">
          {threads.length === 0 ? (
            <p className={theme.textSecondary}>No comment threads yet.</p>
          ) : (
            Array.from(threadsByFile.entries()).map(([file, fileThreads]) => (
              <div key={file} className="space-y-2">
                {/* File header */}
                <h3 className={`text-sm font-medium ${theme.textPrimary} flex items-center gap-2`}>
                  <span>{file}</span>
                  <span className={`text-xs ${theme.textSecondary}`}>
                    ({fileThreads.length} thread{fileThreads.length === 1 ? '' : 's'})
                  </span>
                </h3>

                {/* Threads in this file */}
                <div className="space-y-2 ml-4">
                  {fileThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className={`p-3 rounded border ${
                        thread.resolved
                          ? 'border-everforest-green/30 bg-everforest-bg0/50 opacity-75'
                          : 'border-everforest-bg4 bg-everforest-bg1'
                      } ${onThreadClick ? 'cursor-pointer hover:bg-everforest-bg2' : ''}`}
                      onClick={() => onThreadClick?.(thread)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Thread header */}
                          <div className="flex items-center gap-2 mb-1">
                            <ThreadStatusBadge resolved={thread.resolved} />
                            <span className={`text-xs ${theme.textSecondary}`}>
                              Line {thread.line}
                            </span>
                            {getThreadReplyCount(thread) > 0 && (
                              <span className={`text-xs ${theme.textSecondary}`}>
                                · {getThreadReplyCount(thread)} repl{getThreadReplyCount(thread) === 1 ? 'y' : 'ies'}
                              </span>
                            )}
                          </div>

                          {/* Comment preview */}
                          <p className={`text-sm ${theme.textPrimary} line-clamp-2`}>
                            {thread.parentComment.body}
                          </p>

                          {/* Comment metadata */}
                          <div className={`mt-1 text-xs ${theme.textSecondary}`}>
                            by {thread.parentComment.user.login}
                          </div>
                        </div>

                        {/* Resolution button */}
                        <div className="flex-shrink-0">
                          <ThreadResolutionButton
                            threadId={thread.id}
                            resolved={thread.resolved}
                            onResolve={onResolve}
                            onUnresolve={onUnresolve}
                            isLoading={isLoading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
