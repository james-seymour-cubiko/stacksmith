import React from 'react';

interface ThreadStatusBadgeProps {
  resolved: boolean;
}

export function ThreadStatusBadge({ resolved }: ThreadStatusBadgeProps) {
  if (resolved) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded bg-everforest-green/20 text-everforest-green border-everforest-green/30"
        title="Thread is resolved"
      >
        ✓ Resolved
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded bg-everforest-yellow/20 text-everforest-yellow border-everforest-yellow/30"
      title="Thread is unresolved"
    >
      ◯ Unresolved
    </span>
  );
}
