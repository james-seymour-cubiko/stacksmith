import React from 'react';

type ThreadCountBadgeProps =
  | {
      variant?: 'default';
      resolvedCount: number;
      totalCount: number;
    }
  | {
      variant: 'fileHeader';
      unresolvedCount: number;
    };

export function ThreadCountBadge(props: ThreadCountBadgeProps) {
  // File header variant: show "x Unresolved Comments"
  if (props.variant === 'fileHeader') {
    if (props.unresolvedCount === 0) {
      return null;
    }

    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded bg-everforest-yellow/20 text-everforest-yellow border-everforest-yellow/30"
        title={`${props.unresolvedCount} unresolved thread${props.unresolvedCount === 1 ? '' : 's'}`}
      >
        {props.unresolvedCount} Unresolved Comment{props.unresolvedCount === 1 ? '' : 's'}
      </span>
    );
  }

  // Default variant: show "x/y resolved" (for PR list)
  const { resolvedCount, totalCount } = props;

  // Don't show if no threads
  if (totalCount === 0) {
    return null;
  }

  const allResolved = resolvedCount === totalCount;
  const icon = allResolved ? '✓' : '◯';
  const colorClasses = allResolved
    ? 'bg-everforest-green/20 text-everforest-green border-everforest-green/30'
    : 'bg-everforest-yellow/20 text-everforest-yellow border-everforest-yellow/30';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${colorClasses}`}
      title={`${resolvedCount} of ${totalCount} thread${totalCount === 1 ? '' : 's'} resolved`}
    >
      {icon} {resolvedCount}/{totalCount} resolved
    </span>
  );
}
