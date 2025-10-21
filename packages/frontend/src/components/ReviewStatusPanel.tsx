import { useState, useRef, useEffect } from 'react';
import { theme } from '../lib/theme';
import type { GithubPR, GithubReview, GithubUser, PRReviewState } from '@review-app/shared';

interface ReviewStatusPanelProps {
  selectedPR: GithubPR;
  reviews: GithubReview[] | undefined;
  reviewsLoading: boolean;
  onRequestReviewers: (usernames: string[]) => void;
  requestReviewersPending: boolean;
  availableUsers: GithubUser[];
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
  availableUsers,
}: ReviewStatusPanelProps) {
  const [isAddingReviewer, setIsAddingReviewer] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isAddingReviewer && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isAddingReviewer) {
      setSearchQuery('');
    }
  }, [isAddingReviewer]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (selectedUsernames.size > 0) {
          // Submit selected reviewers
          onRequestReviewers(Array.from(selectedUsernames));
          setSelectedUsernames(new Set());
        }
        setIsAddingReviewer(false);
      }
    };

    if (isAddingReviewer) {
      // Use setTimeout to ensure state updates have completed
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAddingReviewer, selectedUsernames, onRequestReviewers]);

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

  // Filter available users to exclude PR author and existing reviewers
  const existingReviewerLogins = new Set(allReviewers.map(r => r.user.login));
  const filteredAvailableUsers = availableUsers.filter(
    user => user.login !== selectedPR.user.login && !existingReviewerLogins.has(user.login)
  );

  // Apply search filter
  const searchFilteredUsers = filteredAvailableUsers.filter(user =>
    user.login.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (username: string) => {
    setSelectedUsernames(prev => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const handleSubmitReviewers = () => {
    if (selectedUsernames.size === 0) return;
    onRequestReviewers(Array.from(selectedUsernames));
    setSelectedUsernames(new Set());
    setIsAddingReviewer(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      // If exactly one user in filtered list, select and submit
      if (searchFilteredUsers.length === 1) {
        const user = searchFilteredUsers[0];
        onRequestReviewers([user.login]);
        setSelectedUsernames(new Set());
        setIsAddingReviewer(false);
      }
    } else if (e.key === 'Escape') {
      setIsAddingReviewer(false);
      setSelectedUsernames(new Set());
    }
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
            Reviewers ({allReviewers.length})
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

        {/* Add Reviewer Dropdown */}
        {isAddingReviewer && (
          <div ref={dropdownRef} className={`mt-3 p-3 border ${theme.border} rounded ${theme.bgSecondary}`}>
            <div className={`text-xs font-medium ${theme.textPrimary} mb-2`}>
              Select reviewers ({selectedUsernames.size} selected)
            </div>

            {/* Search Input */}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search users..."
              className={`w-full px-3 py-2 mb-2 border ${theme.border} rounded text-xs ${theme.textPrimary} ${theme.bgPrimary} focus:outline-none focus:ring-2 focus:ring-everforest-green`}
            />

            <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
              {searchFilteredUsers.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} text-center py-2`}>
                  {searchQuery ? 'No users match your search' : 'No available users'}
                </p>
              ) : (
                searchFilteredUsers.map((user) => (
                  <label
                    key={user.login}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-everforest-bg2 transition-colors ${
                      selectedUsernames.has(user.login) ? 'bg-everforest-bg3' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsernames.has(user.login)}
                      onChange={() => toggleUserSelection(user.login)}
                      className="rounded border-gray-300 text-everforest-green focus:ring-everforest-green"
                    />
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="h-5 w-5 rounded-full"
                    />
                    <span className={`text-xs ${theme.textPrimary}`}>
                      {user.login}
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitReviewers}
                disabled={selectedUsernames.size === 0 || requestReviewersPending}
                className={`flex-1 px-3 py-2 rounded text-xs font-medium ${
                  selectedUsernames.size > 0 && !requestReviewersPending
                    ? 'bg-everforest-green text-everforest-bg0 hover:bg-everforest-green/90'
                    : 'bg-everforest-bg3 text-everforest-grey0 cursor-not-allowed'
                }`}
              >
                {requestReviewersPending ? 'Adding...' : `Add ${selectedUsernames.size > 0 ? `(${selectedUsernames.size})` : ''}`}
              </button>
              <button
                onClick={() => {
                  setIsAddingReviewer(false);
                  setSelectedUsernames(new Set());
                }}
                disabled={requestReviewersPending}
                className={`px-3 py-2 rounded text-xs ${theme.textSecondary} hover:bg-everforest-bg2`}
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
