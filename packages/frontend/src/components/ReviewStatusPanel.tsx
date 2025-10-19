import { useState } from 'react';
import { theme } from '../lib/theme';
import type { GithubPR, GithubReview, GithubUser, PRReviewState } from '@review-app/shared';

interface ReviewStatusPanelProps {
  selectedPR: GithubPR;
  reviews: GithubReview[] | undefined;
  reviewsLoading: boolean;
  onRequestReviewers: (usernames: string[]) => void;
  requestReviewersPending: boolean;
}

interface ReviewerWithStatus {
  user: GithubUser;
  status: PRReviewState | 'PENDING';
  reviewUrl?: string;
  submittedAt?: string;
}

export function ReviewStatusPanel({
  selectedPR,
  reviews,
  reviewsLoading,
  onRequestReviewers,
  requestReviewersPending,
}: ReviewStatusPanelProps) {
  const [isAddingReviewer, setIsAddingReviewer] = useState(false);
  const [reviewerUsername, setReviewerUsername] = useState('');

  // Compute status for each reviewer
  const getReviewerStatus = (reviewer: GithubUser, isRequested: boolean): ReviewerWithStatus => {
    if (!reviews) {
      return { user: reviewer, status: 'PENDING' };
    }

    // Find most recent review from this reviewer
    const userReviews = reviews
      .filter((r) => r.user.login === reviewer.login)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

    if (userReviews.length === 0) {
      return { user: reviewer, status: 'PENDING' };
    }

    const latestReview = userReviews[0];

    // If they have a review AND are in requested_reviewers, show as re-requested
    if (isRequested) {
      return {
        user: reviewer,
        status: 'PENDING',
        reviewUrl: latestReview.html_url,
        submittedAt: latestReview.submitted_at,
      };
    }

    return {
      user: reviewer,
      status: latestReview.state,
      reviewUrl: latestReview.html_url,
      submittedAt: latestReview.submitted_at,
    };
  };

  // Get all reviewers (requested + those who have reviewed)
  const requestedReviewers = selectedPR.requested_reviewers.map(r => getReviewerStatus(r, true));

  // Find reviewers who submitted reviews but weren't requested
  const unrequestedReviewers: ReviewerWithStatus[] = [];
  if (reviews) {
    const requestedLogins = new Set(selectedPR.requested_reviewers.map((r) => r.login));
    const reviewerLogins = new Set<string>();

    reviews.forEach((review) => {
      // Ignore reviews from the author of the PR
      if (review.user.login === selectedPR.user.login) return;


      if (!requestedLogins.has(review.user.login) && !reviewerLogins.has(review.user.login)) {
        reviewerLogins.add(review.user.login);
        unrequestedReviewers.push({
          user: review.user,
          status: review.state,
          reviewUrl: review.html_url,
          submittedAt: review.submitted_at,
        });
      }
    });
  }

  const allReviewers = [...requestedReviewers, ...unrequestedReviewers];

  const handleAddReviewer = () => {
    if (!reviewerUsername.trim()) return;

    onRequestReviewers([reviewerUsername.trim()]);
    setReviewerUsername('');
    setIsAddingReviewer(false);
  };

  const getStatusDisplay = (status: PRReviewState | 'PENDING') => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: '✓',
          color: theme.textSuccess,
          label: 'Approved',
        };
      case 'CHANGES_REQUESTED':
        return {
          icon: '✗',
          color: theme.textError,
          label: 'Changes Requested',
        };
      case 'COMMENTED':
        return {
          icon: '💬',
          color: theme.textLink,
          label: 'Commented',
        };
      case 'DISMISSED':
        return {
          icon: '⊘',
          color: theme.textMuted,
          label: 'Dismissed',
        };
      case 'PENDING':
        return {
          icon: '◷',
          color: theme.textWarning,
          label: 'Pending',
        };
      default:
        return {
          icon: '○',
          color: theme.textMuted,
          label: 'Unknown',
        };
    }
  };

  return (
    <div className={`w-80 flex-shrink-0 ${theme.card} sticky top-6 self-start mt-6`}>
      <div className={`px-4 py-3 ${theme.border}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-medium ${theme.textPrimary}`}>
            Reviews ({allReviewers.length})
          </h3>
          {!isAddingReviewer && (
            <button
              onClick={() => setIsAddingReviewer(true)}
              className={`text-xs px-2 py-1 rounded text-everforest-bg0 bg-everforest-green hover:bg-everforest-green/90 font-medium transition-colors`}
              title="Request review from someone"
            >
              + Add
            </button>
          )}
        </div>

        {reviewsLoading ? (
          <div className="text-center py-4">
            <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
          </div>
        ) : allReviewers.length === 0 ? (
          <p className={`text-xs ${theme.textMuted} text-center py-4`}>No reviewers yet</p>
        ) : (
          <div className="space-y-2">
            {allReviewers.map((reviewer) => {
              const statusDisplay = getStatusDisplay(reviewer.status);

              return (
                <div
                  key={reviewer.user.login}
                  className={`p-2 rounded border ${theme.border} hover:bg-everforest-bg1 transition-colors`}
                >
                  <div className="flex items-start gap-2">
                    <img
                      src={reviewer.user.avatar_url}
                      alt={reviewer.user.login}
                      className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${theme.textPrimary} truncate`}>
                          {reviewer.user.login}
                        </span>
                        <span className={`text-sm ${statusDisplay.color} flex-shrink-0`} title={statusDisplay.label}>
                          {statusDisplay.icon}
                        </span>
                      </div>
                      <div className={`text-xs ${theme.textMuted} mt-0.5`}>
                        {statusDisplay.label}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {reviewer.reviewUrl && (
                          <a
                            href={reviewer.reviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs ${theme.textLink}`}
                          >
                            View review →
                          </a>
                        )}
                        {reviewer.status !== 'PENDING' && (
                          <button
                            onClick={() => onRequestReviewers([reviewer.user.login])}
                            disabled={requestReviewersPending}
                            className={`text-xs ${theme.textMuted} hover:text-everforest-green disabled:opacity-50`}
                            title="Re-request review"
                          >
                            ⟳ Re-request
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Reviewer Form */}
        {isAddingReviewer && (
          <div className={`mt-3 p-3 border ${theme.border} rounded ${theme.bgSecondary}`}>
            <label className={`text-xs font-medium ${theme.textPrimary} block mb-2`}>
              GitHub Username
            </label>
            <input
              type="text"
              value={reviewerUsername}
              onChange={(e) => setReviewerUsername(e.target.value)}
              placeholder="username"
              className={`block w-full px-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent text-sm`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddReviewer();
                } else if (e.key === 'Escape') {
                  setIsAddingReviewer(false);
                  setReviewerUsername('');
                }
              }}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleAddReviewer}
                disabled={!reviewerUsername.trim() || requestReviewersPending}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  reviewerUsername.trim() && !requestReviewersPending
                    ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                    : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                }`}
              >
                {requestReviewersPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setIsAddingReviewer(false);
                  setReviewerUsername('');
                }}
                disabled={requestReviewersPending}
                className={`px-3 py-1 rounded text-xs ${theme.textSecondary} hover:bg-everforest-bg2`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
