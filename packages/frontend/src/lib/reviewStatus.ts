import { GithubReview, CombinedReviewStatus, ReviewStatusInfo } from '@review-app/shared';

/**
 * Computes the combined review status from an array of reviews.
 *
 * Logic:
 * - If any CHANGES_REQUESTED exists → CHANGES_REQUESTED (blocks merge)
 * - Else if at least one APPROVED → APPROVED (allows merge)
 * - Else if any COMMENTED → COMMENTED (neutral)
 * - Else → NO_REVIEWS (blocks merge)
 *
 * Note: Only considers the most recent review from each reviewer
 */
export function computeReviewStatus(reviews: GithubReview[]): ReviewStatusInfo {
  // Get the most recent review from each user
  const latestReviewsByUser = new Map<string, GithubReview>();

  for (const review of reviews) {
    const existing = latestReviewsByUser.get(review.user.login);
    if (!existing || new Date(review.submitted_at) > new Date(existing.submitted_at)) {
      latestReviewsByUser.set(review.user.login, review);
    }
  }

  const latestReviews = Array.from(latestReviewsByUser.values());

  // Count each review type (ignoring DISMISSED and PENDING)
  let approvalCount = 0;
  let changesRequestedCount = 0;
  let commentedCount = 0;

  for (const review of latestReviews) {
    switch (review.state) {
      case 'APPROVED':
        approvalCount++;
        break;
      case 'CHANGES_REQUESTED':
        changesRequestedCount++;
        break;
      case 'COMMENTED':
        commentedCount++;
        break;
      // DISMISSED and PENDING are not counted
    }
  }

  // Determine combined status
  let status: CombinedReviewStatus;

  if (changesRequestedCount > 0) {
    status = 'CHANGES_REQUESTED';
  } else if (approvalCount > 0) {
    status = 'APPROVED';
  } else if (commentedCount > 0) {
    status = 'COMMENTED';
  } else {
    status = 'NO_REVIEWS';
  }

  return {
    status,
    approvalCount,
    changesRequestedCount,
    commentedCount,
    totalReviews: latestReviews.length,
  };
}

/**
 * Determines if a PR is mergeable based on its review status.
 *
 * Requirements:
 * - Must have at least one APPROVED review
 * - Must NOT have any CHANGES_REQUESTED reviews
 */
export function isMergeableByReviewStatus(reviewStatus: ReviewStatusInfo): boolean {
  return reviewStatus.status === 'APPROVED';
}

/**
 * Gets a human-readable label for the review status
 */
export function getReviewStatusLabel(status: CombinedReviewStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'Approved';
    case 'CHANGES_REQUESTED':
      return 'Changes Requested';
    case 'COMMENTED':
      return 'Commented';
    case 'NO_REVIEWS':
      return 'No Reviews';
  }
}

/**
 * Gets a short label for badges
 */
export function getReviewStatusShortLabel(status: CombinedReviewStatus): string {
  switch (status) {
    case 'APPROVED':
      return '✓ Approved';
    case 'CHANGES_REQUESTED':
      return '✗ Changes';
    case 'COMMENTED':
      return '💬 Commented';
    case 'NO_REVIEWS':
      return '◷ No Reviews';
  }
}
