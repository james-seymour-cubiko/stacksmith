import React from 'react';
import { ReviewStatusInfo } from '@review-app/shared';
import { getReviewStatusShortLabel } from '../lib/reviewStatus';

interface ReviewStatusBadgeProps {
  reviewStatus?: ReviewStatusInfo;
}

export function ReviewStatusBadge({ reviewStatus }: ReviewStatusBadgeProps) {
  // If no review status provided, show "Needs Reviewers"
  if (!reviewStatus) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded bg-everforest-yellow/20 text-everforest-yellow border-everforest-yellow/30"
        title="No reviewers have been requested for this PR"
      >
        ⚠ Needs Reviewers
      </span>
    );
  }

  const { status, approvalCount, changesRequestedCount, commentedCount, totalReviews } = reviewStatus;

  // Determine badge color based on status
  const badgeClasses = {
    APPROVED: 'bg-everforest-green/20 text-everforest-green border-everforest-green/30',
    CHANGES_REQUESTED: 'bg-everforest-red/20 text-everforest-red border-everforest-red/30',
    COMMENTED: 'bg-everforest-blue/20 text-everforest-blue border-everforest-blue/30',
    NO_REVIEWS: 'bg-everforest-grey0/20 text-everforest-grey2 border-everforest-grey0/30',
  };

  // Create tooltip content
  const tooltipLines: string[] = [];
  if (approvalCount > 0) {
    tooltipLines.push(`${approvalCount} approval${approvalCount === 1 ? '' : 's'}`);
  }
  if (changesRequestedCount > 0) {
    tooltipLines.push(`${changesRequestedCount} change${changesRequestedCount === 1 ? '' : 's'} requested`);
  }
  if (commentedCount > 0) {
    tooltipLines.push(`${commentedCount} comment${commentedCount === 1 ? '' : 's'}`);
  }
  if (totalReviews === 0) {
    tooltipLines.push('No reviews submitted');
  }

  const tooltipContent = tooltipLines.join(', ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${badgeClasses[status]}`}
      title={tooltipContent}
    >
      {getReviewStatusShortLabel(status)}
    </span>
  );
}
