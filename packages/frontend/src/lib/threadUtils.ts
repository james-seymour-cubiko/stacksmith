import { CommentThread, GithubComment, ThreadResolutionInfo } from '@review-app/shared';

/**
 * Groups comments into threads based on in_reply_to_id relationships
 * This is a fallback method when GraphQL data is not available
 */
export function groupCommentsIntoThreads(comments: GithubComment[]): CommentThread[] {
  const threads: CommentThread[] = [];
  const threadMap = new Map<number, GithubComment[]>();

  // Filter only inline code comments (those with path)
  const inlineComments = comments.filter((c) => c.path);

  // Group by in_reply_to_id to find replies
  for (const comment of inlineComments) {
    if (comment.in_reply_to_id) {
      if (!threadMap.has(comment.in_reply_to_id)) {
        threadMap.set(comment.in_reply_to_id, []);
      }
      threadMap.get(comment.in_reply_to_id)!.push(comment);
    }
  }

  // Create threads from parent comments
  for (const comment of inlineComments) {
    if (!comment.in_reply_to_id && comment.path && comment.line) {
      // This is a parent comment
      const replies = threadMap.get(comment.id) || [];

      threads.push({
        id: comment.conversation_id || `thread-${comment.id}`,
        parentComment: comment,
        replies,
        resolved: false, // Default to false when not using GraphQL
        path: comment.path,
        line: comment.line,
      });
    }
  }

  return threads;
}

/**
 * Computes thread resolution information from a list of threads
 */
export function computeThreadResolutionInfo(threads: CommentThread[]): ThreadResolutionInfo {
  const totalThreads = threads.length;
  const unresolvedCount = threads.filter((t) => !t.resolved).length;
  const byFile: Record<string, number> = {};

  for (const thread of threads) {
    if (!thread.resolved) {
      byFile[thread.path] = (byFile[thread.path] || 0) + 1;
    }
  }

  return {
    totalThreads,
    unresolvedCount,
    byFile,
  };
}

/**
 * Filters threads for a specific file
 */
export function getThreadsForFile(threads: CommentThread[], filename: string): CommentThread[] {
  return threads.filter((thread) => thread.path === filename);
}

/**
 * Checks if a thread is resolved
 */
export function isThreadResolved(thread: CommentThread): boolean {
  return thread.resolved;
}

/**
 * Gets unresolved thread count by file
 */
export function getUnresolvedCountByFile(threads: CommentThread[]): Map<string, number> {
  const countMap = new Map<string, number>();

  for (const thread of threads) {
    if (!thread.resolved) {
      countMap.set(thread.path, (countMap.get(thread.path) || 0) + 1);
    }
  }

  return countMap;
}

/**
 * Finds a thread by its ID
 */
export function findThreadById(threads: CommentThread[], threadId: string): CommentThread | undefined {
  return threads.find((thread) => thread.id === threadId);
}

/**
 * Gets the total count of replies in a thread
 */
export function getThreadReplyCount(thread: CommentThread): number {
  return thread.replies.length;
}

/**
 * Filters threads by resolution status
 */
export function filterThreadsByResolution(
  threads: CommentThread[],
  resolved: boolean | null
): CommentThread[] {
  if (resolved === null) {
    return threads; // Return all
  }
  return threads.filter((thread) => thread.resolved === resolved);
}
