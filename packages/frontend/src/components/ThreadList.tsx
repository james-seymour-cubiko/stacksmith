import React, { useState } from 'react';
import { CommentThread } from '@review-app/shared';
import { theme } from '../lib/theme';
import { ThreadStatusBadge } from './ThreadStatusBadge';

interface ThreadListProps {
  threads: CommentThread[];
  onResolve: (threadId: string) => void;
  onUnresolve: (threadId: string) => void;
  onThreadClick?: (thread: CommentThread) => void;
  isLoading?: boolean;
}

export function ThreadList({ threads, onResolve, onUnresolve, onThreadClick, isLoading = false }: ThreadListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Sort threads: unresolved first, then resolved
  const sortedThreads = [...threads].sort((a, b) => {
    if (a.resolved === b.resolved) return 0;
    return a.resolved ? 1 : -1;
  });

  const getFilename = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const truncateComment = (text: string, maxLength: number = 35) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const resolvedCount = threads.filter((t) => t.resolved).length;
  const totalCount = threads.length;
  const unresolvedCount = totalCount - resolvedCount;

  return (
    <div className={`${theme.card}`}>
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
        <div className="px-6 py-4">
          {threads.length === 0 ? (
            <p className={theme.textSecondary}>No comment threads yet.</p>
          ) : (
            <>
              {/* Unresolved threads section */}
              {unresolvedCount > 0 && (
                <div className="mb-3">
                  <div className={`text-xs font-medium ${theme.textSecondary} mb-1 px-2 flex items-center gap-2`}>
                    <ThreadStatusBadge resolved={false} />
                    <span>({unresolvedCount})</span>
                  </div>
                  <div className={`border ${theme.border} rounded overflow-hidden`}>
                    <table className="w-full">
                      <tbody>
                        {sortedThreads.filter(t => !t.resolved).map((thread) => (
                          <tr
                            key={thread.id}
                            className={`border-b last:border-b-0 ${theme.border} ${theme.bgPrimary} ${
                              onThreadClick ? 'cursor-pointer hover:bg-everforest-bg2' : ''
                            }`}
                            onClick={() => onThreadClick?.(thread)}
                          >
                            <td className={`py-2 px-3 text-sm ${theme.textPrimary}`}>
                              {truncateComment(thread.parentComment.body)}
                            </td>
                            <td className={`py-2 px-3 text-xs ${theme.textSecondary} w-32`}>
                              {getFilename(thread.path)}
                            </td>
                            <td className="py-2 px-3 w-8">
                              <img
                                src={thread.parentComment.user.avatar_url}
                                alt={thread.parentComment.user.login}
                                className="h-6 w-6 rounded-full"
                                title={thread.parentComment.user.login}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resolved threads section */}
              {resolvedCount > 0 && (
                <div>
                  <div className={`text-xs font-medium ${theme.textSecondary} mb-1 px-2 flex items-center gap-2`}>
                    <ThreadStatusBadge resolved={true} />
                    <span>({resolvedCount})</span>
                  </div>
                  <div className={`border ${theme.border} rounded overflow-hidden`}>
                    <table className="w-full">
                      <tbody>
                        {sortedThreads.filter(t => t.resolved).map((thread) => (
                          <tr
                            key={thread.id}
                            className={`border-b last:border-b-0 ${theme.border} ${theme.bgPrimary} opacity-60 ${
                              onThreadClick ? 'cursor-pointer hover:bg-everforest-bg2' : ''
                            }`}
                            onClick={() => onThreadClick?.(thread)}
                          >
                            <td className={`py-2 px-3 text-sm ${theme.textPrimary}`}>
                              {truncateComment(thread.parentComment.body)}
                            </td>
                            <td className={`py-2 px-3 text-xs ${theme.textSecondary} w-32`}>
                              {getFilename(thread.path)}
                            </td>
                            <td className="py-2 px-3 w-8">
                              <img
                                src={thread.parentComment.user.avatar_url}
                                alt={thread.parentComment.user.login}
                                className="h-6 w-6 rounded-full"
                                title={thread.parentComment.user.login}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
