import React, { useState } from 'react';
import { CommentThread } from '@review-app/shared';
import { theme } from '../lib/theme';
import { ThreadStatusBadge } from './ThreadStatusBadge';
import { ThreadResolutionButton } from './ThreadResolutionButton';
import { filterThreadsByResolution, getThreadReplyCount } from '../lib/threadUtils';

interface ThreadListProps {
  threads: CommentThread[];
  onResolve: (threadId: string) => void;
  onUnresolve: (threadId: string) => void;
  onThreadClick?: (thread: CommentThread) => void;
  isLoading?: boolean;
}

type FilterType = 'all' | 'unresolved' | 'resolved';

export function ThreadList({ threads, onResolve, onUnresolve, onThreadClick, isLoading = false }: ThreadListProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  // Apply filter
  const filteredThreads =
    filter === 'all'
      ? threads
      : filter === 'unresolved'
      ? filterThreadsByResolution(threads, false)
      : filterThreadsByResolution(threads, true);

  // Group threads by file
  const threadsByFile = new Map<string, CommentThread[]>();
  for (const thread of filteredThreads) {
    if (!threadsByFile.has(thread.path)) {
      threadsByFile.set(thread.path, []);
    }
    threadsByFile.get(thread.path)!.push(thread);
  }

  const resolvedCount = threads.filter((t) => t.resolved).length;
  const totalCount = threads.length;

  if (threads.length === 0) {
    return (
      <div className={`${theme.card} p-6`}>
        <h2 className={`text-lg font-semibold ${theme.textPrimary} mb-3`}>Comment Threads (0)</h2>
        <p className={theme.textSecondary}>No comment threads yet.</p>
      </div>
    );
  }

  return (
    <div className={`${theme.card} p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className={`text-lg font-semibold ${theme.textPrimary}`}>
            Comment Threads ({resolvedCount} / {totalCount} resolved)
          </h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`text-sm ${theme.textLink}`}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {/* Filter tabs */}
        {isExpanded && (
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-everforest-green text-everforest-bg0'
                  : 'bg-everforest-bg3 text-everforest-grey1 hover:bg-everforest-bg4'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('unresolved')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === 'unresolved'
                  ? 'bg-everforest-yellow text-everforest-bg0'
                  : 'bg-everforest-bg3 text-everforest-grey1 hover:bg-everforest-bg4'
              }`}
            >
              Unresolved ({totalCount - resolvedCount})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === 'resolved'
                  ? 'bg-everforest-green text-everforest-bg0'
                  : 'bg-everforest-bg3 text-everforest-grey1 hover:bg-everforest-bg4'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        )}
      </div>

      {/* Thread list */}
      {isExpanded && (
        <div className="space-y-4">
          {filteredThreads.length === 0 ? (
            <p className={theme.textSecondary}>
              {filter === 'unresolved'
                ? 'All threads resolved! ✓'
                : filter === 'resolved'
                ? 'No resolved threads yet.'
                : 'No threads to display.'}
            </p>
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
