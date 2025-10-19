import { useStacks } from '../hooks/useStacks';
import { useMultiRepoStacks } from '../hooks/useMultiRepoStacks';
import { Link } from 'react-router-dom';
import { theme } from '../lib/theme';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { configAPI, stacksAPI } from '../lib/api';

const REPO_PREFERENCE_KEY = 'stacksmith:selectedRepo';

export function StacksListPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'review'>('all');
  const [page, setPage] = useState(1);
  const [myPage, setMyPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');

  const queryClient = useQueryClient();

  // Fetch config first to get available repos
  const { data: config } = useQuery({
    queryKey: ['config', 'github'],
    queryFn: () => configAPI.getGithub(),
    retry: false,
  });

  // Get available repos from config
  const availableRepos = useMemo(() => {
    if (!config?.repos) return [];
    return config.repos.map((r: { owner: string; repo: string }) => `${r.owner}/${r.repo}`);
  }, [config?.repos]);

  // Initialize selectedRepo with smart defaults
  const [selectedRepo, setSelectedRepo] = useState<string>(() => {
    // Try to get from localStorage
    const saved = localStorage.getItem(REPO_PREFERENCE_KEY);
    return saved || 'auto'; // 'auto' means we'll set it once config loads
  });

  // Update selectedRepo once config loads if it's still on 'auto'
  useEffect(() => {
    if (selectedRepo === 'auto' && availableRepos.length > 0) {
      // Check if saved preference is still valid
      const saved = localStorage.getItem(REPO_PREFERENCE_KEY);
      if (saved && saved !== 'auto' && availableRepos.includes(saved)) {
        setSelectedRepo(saved);
      } else {
        // Default to first repo
        setSelectedRepo(availableRepos[0]);
      }
    }
  }, [availableRepos, selectedRepo]);

  // Save repo preference to localStorage when it changes
  useEffect(() => {
    if (selectedRepo && selectedRepo !== 'auto') {
      localStorage.setItem(REPO_PREFERENCE_KEY, selectedRepo);
    }
  }, [selectedRepo]);

  // Prefetch other repos in the background after initial load
  useEffect(() => {
    if (availableRepos.length > 1 && selectedRepo !== 'all' && selectedRepo !== 'auto') {
      // Wait a bit for the initial load to complete, then prefetch other repos
      const timer = setTimeout(() => {
        availableRepos.forEach((repo) => {
          if (repo !== selectedRepo) {
            queryClient.prefetchQuery({
              queryKey: ['stacks', { repo }],
              queryFn: () => stacksAPI.list(repo),
            });
          }
        });
      }, 1000); // Wait 1 second after initial render

      return () => clearTimeout(timer);
    }
  }, [availableRepos, selectedRepo, queryClient]);

  const itemsPerPage = 10;

  // Use different hooks depending on whether we're viewing all repos or a single repo
  const singleRepoResult = useStacks(
    selectedRepo !== 'all' && selectedRepo !== 'auto' ? selectedRepo : undefined
  );
  const multiRepoResult = useMultiRepoStacks(
    availableRepos,
    selectedRepo === 'all'
  );

  // Choose which result to use based on selectedRepo
  const { data: stacks, isLoading, error } = selectedRepo === 'all' ? multiRepoResult : singleRepoResult;

  // Get unique authors for filter - must be called before any returns
  const authors = useMemo(() => {
    if (!stacks) return [];
    const uniqueAuthors = new Set<string>();
    stacks.forEach(stack => {
      stack.prs.forEach((pr: { user: { login: string } }) => uniqueAuthors.add(pr.user.login));
    });
    return Array.from(uniqueAuthors).sort();
  }, [stacks]);

  // Fuzzy search and filter logic - must be called before any returns
  const filteredStacks = useMemo(() => {
    if (!stacks) return [];

    let filtered = stacks;

    filtered = filtered.filter(stack => stack.prs.some(pr => pr.user.login !== "cubiko-integrations"));
    // Filter by author
    if (selectedAuthor !== 'all') {
      filtered = filtered.filter(stack =>
        stack.prs.some(pr => pr.user.login === selectedAuthor)
      );
    }

    // Fuzzy search by stack name or PR titles
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(stack => {
        // Search in stack name
        if (stack.name.toLowerCase().includes(query)) return true;

        // Search in any PR title
        return stack.prs.some(pr =>
          pr.title.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [stacks, selectedAuthor, searchQuery]);

  // Filter stacks for current user
  const myStacks = useMemo(() => {
    if (!stacks || !config?.currentUser) return [];
    let filtered = stacks.filter(stack =>
      stack.prs.some(pr => pr.user.login === config.currentUser)
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(stack => {
        // Search in stack name
        if (stack.name.toLowerCase().includes(query)) return true;

        // Search in any PR title
        return stack.prs.some(pr =>
          pr.title.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [stacks, config?.currentUser, searchQuery]);

  // Filter stacks where current user is requested as reviewer
  const reviewStacks = useMemo(() => {
    if (!stacks || !config?.currentUser) return [];
    let filtered = stacks.filter(stack =>
      stack.prs.some(pr =>
        pr.requested_reviewers.some(reviewer => reviewer.login === config.currentUser)
      )
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(stack => {
        // Search in stack name
        if (stack.name.toLowerCase().includes(query)) return true;

        // Search in any PR title
        return stack.prs.some(pr =>
          pr.title.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [stacks, config?.currentUser, searchQuery]);

  // Calculate pagination for My PRs
  const totalMyStacks = myStacks.length;
  const totalMyPages = Math.ceil(totalMyStacks / itemsPerPage);
  const myStartIndex = (myPage - 1) * itemsPerPage;
  const myEndIndex = myStartIndex + itemsPerPage;
  const paginatedMyStacks = myStacks.slice(myStartIndex, myEndIndex);

  // Calculate pagination for Review Requested
  const totalReviewStacks = reviewStacks.length;
  const totalReviewPages = Math.ceil(totalReviewStacks / itemsPerPage);
  const reviewStartIndex = (reviewPage - 1) * itemsPerPage;
  const reviewEndIndex = reviewStartIndex + itemsPerPage;
  const paginatedReviewStacks = reviewStacks.slice(reviewStartIndex, reviewEndIndex);

  // Calculate pagination for All PRs
  const totalStacks = filteredStacks.length;
  const totalPages = Math.ceil(totalStacks / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStacks = filteredStacks.slice(startIndex, endIndex);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${theme.spinner}`}></div>
        <p className={`mt-2 text-sm ${theme.textSecondary}`}>Loading pull requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.errorBox} border rounded-lg p-4`}>
        <h3 className={`text-sm font-medium ${theme.textError}`}>Error loading pull requests</h3>
        <p className={`mt-1 text-sm ${theme.textError}`}>{(error as Error).message}</p>
      </div>
    );
  }

  if (!stacks || stacks.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className={`mx-auto h-12 w-12 ${theme.textMuted}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className={`mt-2 text-sm font-medium ${theme.textPrimary}`}>No pull requests</h3>
        <p className={`mt-1 text-sm ${theme.textSecondary}`}>No open pull requests found.</p>
      </div>
    );
  }

  // Render a compact table for stacks - function definition AFTER all hooks and early returns
  const renderStacksTable = (stackList: typeof stacks) => {
    if (!stackList || stackList.length === 0) return null;

    return (
      <div className={`${theme.card} overflow-hidden`}>
        <table className="min-w-full divide-y divide-everforest-bg3">
          <thead className={`${theme.bgSecondary}`}>
            <tr>
              <th scope="col" className={`py-2 pl-4 pr-2 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Title
              </th>
              <th scope="col" className={`px-2 py-2 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Author
              </th>
              <th scope="col" className={`px-2 py-2 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Status
              </th>
              <th scope="col" className={`px-2 py-2 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                PRs
              </th>
              <th scope="col" className={`px-2 py-2 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Updated
              </th>
              <th scope="col" className="relative py-2 pl-2 pr-4">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-everforest-bg3`}>
            {stackList.map((stack) => {
              const basePR = stack.prs[0];
              const hasMultiplePRs = stack.prs.length > 1;

              const statusColor = basePR.draft
                ? theme.statusDraft
                : basePR.merged_at
                ? theme.statusMerged
                : basePR.state === 'closed'
                ? theme.statusClosed
                : theme.statusOpen;

              const statusText = basePR.draft
                ? 'Draft'
                : basePR.merged_at
                ? 'Merged'
                : basePR.state === 'closed'
                ? 'Closed'
                : 'Open';

              const stackUrl = `/stacks/${stack.repoOwner}/${stack.repoName}/${stack.id}`;

              return (
                <tr key={stack.id} className={`${theme.cardHover} transition-colors`}>
                  <td className="py-2 pl-4 pr-2">
                    <Link to={stackUrl} className="flex items-center gap-1.5">
                      {hasMultiplePRs && (
                        <span className="px-1 py-0.5 rounded text-xs font-medium bg-everforest-purple/20 text-everforest-purple flex-shrink-0" title="Stacked PRs">
                          ⚡
                        </span>
                      )}
                      <span className={`text-sm font-medium ${theme.textPrimary} hover:text-everforest-green truncate`}>
                        {stack.name}
                      </span>
                    </Link>
                    <div className={`text-xs ${theme.textMuted} mt-0.5`}>
                      {stack.repoOwner}/{stack.repoName}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <img
                        src={basePR.user.avatar_url}
                        alt={basePR.user.login}
                        className="h-5 w-5 rounded-full"
                      />
                      <span className={`text-xs ${theme.textSecondary}`}>
                        {basePR.user.login}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`text-xs ${theme.textSecondary}`}>
                      {stack.prs.length}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`text-xs ${theme.textSecondary}`}>
                      {new Date(stack.updated_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-2 pl-2 pr-4 text-right">
                    <Link
                      to={stackUrl}
                      className={`text-xs font-medium ${theme.textLink}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>Pull Requests</h1>
          <p className={`mt-2 text-sm ${theme.textSecondary}`}>
            Manage and review your pull requests.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-everforest-bg3">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('all')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'all'
                  ? 'border-everforest-green text-everforest-green'
                  : `border-transparent ${theme.textSecondary} hover:text-everforest-aqua hover:border-everforest-aqua`
              }`}
            >
              All Pull Requests
            </button>
            {config?.currentUser && myStacks.length > 0 && (
              <button
                onClick={() => setActiveTab('my')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'my'
                    ? 'border-everforest-green text-everforest-green'
                    : `border-transparent ${theme.textSecondary} hover:text-everforest-aqua hover:border-everforest-aqua`
                }`}
              >
                My Pull Requests
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === 'my'
                    ? 'bg-everforest-green/20 text-everforest-green'
                    : `${theme.bgTertiary} ${theme.textMuted}`
                }`}>
                  {myStacks.length}
                </span>
              </button>
            )}
            {config?.currentUser && reviewStacks.length > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'review'
                    ? 'border-everforest-green text-everforest-green'
                    : `border-transparent ${theme.textSecondary} hover:text-everforest-aqua hover:border-everforest-aqua`
                }`}
              >
                Review Requested
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === 'review'
                    ? 'bg-everforest-green/20 text-everforest-green'
                    : `${theme.bgTertiary} ${theme.textMuted}`
                }`}>
                  {reviewStacks.length}
                </span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* My PRs Tab Content */}
      {activeTab === 'my' && config?.currentUser && myStacks.length > 0 && (
        <div>
          {/* Search and Filter Controls for My PRs */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className={`h-5 w-5 ${theme.textMuted}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by stack or PR title..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setMyPage(1); // Reset to first page on search
                  }}
                  className={`block w-full pl-10 pr-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
                />
              </div>
            </div>

            {/* Repo Filter (only show if multiple repos configured) */}
            {availableRepos.length > 1 && (
              <div className="sm:w-64 relative">
                <select
                  value={selectedRepo === 'auto' ? availableRepos[0] || '' : selectedRepo}
                  onChange={(e) => {
                    setSelectedRepo(e.target.value);
                    setMyPage(1); // Reset to first page on filter change
                  }}
                  className={`block w-full px-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
                >
                  <option value="all">
                    All Repositories
                    {selectedRepo === 'all' && multiRepoResult.isLoading ? ' (Loading...)' : ''}
                  </option>
                  {availableRepos.map(repo => (
                    <option key={repo} value={repo}>
                      {repo}
                    </option>
                  ))}
                </select>
                {/* Show loading spinner next to dropdown when fetching multiple repos */}
                {selectedRepo === 'all' && multiRepoResult.isLoading && (
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                    <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
                  </div>
                )}
              </div>
            )}

            {/* Clear Filters Button */}
            {(searchQuery || selectedRepo !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRepo('all');
                  setMyPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md ${theme.buttonSecondary} ${theme.textSecondary} hover:bg-everforest-bg3 transition-colors`}
              >
                Clear Filters
              </button>
            )}
          </div>

          {renderStacksTable(paginatedMyStacks)}

          {/* My PRs Pagination Controls */}
          {totalMyPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-4">
              <div className={`text-sm ${theme.textSecondary}`}>
                Showing {myStartIndex + 1} to {Math.min(myEndIndex, totalMyStacks)} of {totalMyStacks} stacks
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMyPage(p => Math.max(1, p - 1))}
                  disabled={myPage === 1}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    myPage === 1
                      ? `${theme.textMuted} cursor-not-allowed`
                      : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                  }`}
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalMyPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setMyPage(pageNum)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        myPage === pageNum
                          ? 'bg-everforest-green text-everforest-bg0'
                          : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setMyPage(p => Math.min(totalMyPages, p + 1))}
                  disabled={myPage === totalMyPages}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    myPage === totalMyPages
                      ? `${theme.textMuted} cursor-not-allowed`
                      : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Requested Tab Content */}
      {activeTab === 'review' && config?.currentUser && reviewStacks.length > 0 && (
        <div>
          {/* Search and Filter Controls for Review Requested */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className={`h-5 w-5 ${theme.textMuted}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by stack or PR title..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setReviewPage(1); // Reset to first page on search
                  }}
                  className={`block w-full pl-10 pr-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
                />
              </div>
            </div>

            {/* Repo Filter (only show if multiple repos configured) */}
            {availableRepos.length > 1 && (
              <div className="sm:w-64 relative">
                <select
                  value={selectedRepo === 'auto' ? availableRepos[0] || '' : selectedRepo}
                  onChange={(e) => {
                    setSelectedRepo(e.target.value);
                    setReviewPage(1); // Reset to first page on filter change
                  }}
                  className={`block w-full px-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
                >
                  <option value="all">
                    All Repositories
                    {selectedRepo === 'all' && multiRepoResult.isLoading ? ' (Loading...)' : ''}
                  </option>
                  {availableRepos.map(repo => (
                    <option key={repo} value={repo}>
                      {repo}
                    </option>
                  ))}
                </select>
                {/* Show loading spinner next to dropdown when fetching multiple repos */}
                {selectedRepo === 'all' && multiRepoResult.isLoading && (
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                    <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
                  </div>
                )}
              </div>
            )}

            {/* Clear Filters Button */}
            {(searchQuery || selectedRepo !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRepo('all');
                  setReviewPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-md ${theme.buttonSecondary} ${theme.textSecondary} hover:bg-everforest-bg3 transition-colors`}
              >
                Clear Filters
              </button>
            )}
          </div>

          {renderStacksTable(paginatedReviewStacks)}

          {/* Review Requested Pagination Controls */}
          {totalReviewPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-4">
              <div className={`text-sm ${theme.textSecondary}`}>
                Showing {reviewStartIndex + 1} to {Math.min(reviewEndIndex, totalReviewStacks)} of {totalReviewStacks} stacks
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                  disabled={reviewPage === 1}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    reviewPage === 1
                      ? `${theme.textMuted} cursor-not-allowed`
                      : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                  }`}
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalReviewPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setReviewPage(pageNum)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        reviewPage === pageNum
                          ? 'bg-everforest-green text-everforest-bg0'
                          : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setReviewPage(p => Math.min(totalReviewPages, p + 1))}
                  disabled={reviewPage === totalReviewPages}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    reviewPage === totalReviewPages
                      ? `${theme.textMuted} cursor-not-allowed`
                      : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All PRs Tab Content */}
      {activeTab === 'all' && (
      <div>
        {/* Search and Filter Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className={`h-5 w-5 ${theme.textMuted}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by stack or PR title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1); // Reset to first page on search
              }}
              className={`block w-full pl-10 pr-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
            />
          </div>
        </div>

        {/* Author Filter */}
        <div className="sm:w-64">
          <select
            value={selectedAuthor}
            onChange={(e) => {
              setSelectedAuthor(e.target.value);
              setPage(1); // Reset to first page on filter change
            }}
            className={`block w-full px-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
          >
            <option value="all">All Authors</option>
            {authors.map(author => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        </div>

        {/* Repo Filter (only show if multiple repos configured) */}
        {availableRepos.length > 1 && (
          <div className="sm:w-64 relative">
            <select
              value={selectedRepo === 'auto' ? availableRepos[0] || '' : selectedRepo}
              onChange={(e) => {
                setSelectedRepo(e.target.value);
                setPage(1); // Reset to first page on filter change
              }}
              className={`block w-full px-3 py-2 border rounded-md ${theme.input} focus:outline-none focus:ring-2 focus:ring-everforest-green focus:border-transparent`}
            >
              <option value="all">
                All Repositories
                {selectedRepo === 'all' && multiRepoResult.isLoading ? ' (Loading...)' : ''}
              </option>
              {availableRepos.map(repo => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
            {/* Show loading spinner next to dropdown when fetching multiple repos */}
            {selectedRepo === 'all' && multiRepoResult.isLoading && (
              <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
              </div>
            )}
          </div>
        )}

        {/* Clear Filters Button */}
        {(searchQuery || selectedAuthor !== 'all' || selectedRepo !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedAuthor('all');
              setSelectedRepo('all');
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md ${theme.buttonSecondary} ${theme.textSecondary} hover:bg-everforest-bg3 transition-colors`}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Multi-repo loading status */}
      {selectedRepo === 'all' && multiRepoResult.isLoading && (
        <div className={`mb-4 p-3 border ${theme.border} rounded-lg ${theme.bgSecondary}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
            <span className={`text-sm ${theme.textSecondary}`}>Loading repositories...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {multiRepoResult.repoStates && multiRepoResult.repoStates.map((state) => (
              <span
                key={state.repo}
                className={`text-xs px-2 py-1 rounded ${
                  state.isSuccess
                    ? 'bg-everforest-green/20 text-everforest-green'
                    : state.error
                    ? 'bg-everforest-red/20 text-everforest-red'
                    : 'bg-everforest-bg3 text-everforest-grey0'
                }`}
              >
                {state.repo}
                {state.isSuccess && ' ✓'}
                {state.error && ' ✗'}
                {state.isLoading && ' ...'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {filteredStacks.length === 0 && (searchQuery || selectedAuthor !== 'all' || selectedRepo !== 'all') && (
        <div className="text-center py-12">
          <svg
            className={`mx-auto h-12 w-12 ${theme.textMuted}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className={`mt-2 text-sm font-medium ${theme.textPrimary}`}>No results found</h3>
          <p className={`mt-1 text-sm ${theme.textSecondary}`}>
            Try adjusting your search or filters.
          </p>
        </div>
      )}

      {/* Table - only show if there are results */}
      {filteredStacks.length > 0 && renderStacksTable(paginatedStacks)}

      {/* Pagination Controls */}
      {filteredStacks.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-4">
          <div className={`text-sm ${theme.textSecondary}`}>
            Showing {startIndex + 1} to {Math.min(endIndex, totalStacks)} of {totalStacks} stacks
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                page === 1
                  ? `${theme.textMuted} cursor-not-allowed`
                  : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
              }`}
            >
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-everforest-green text-everforest-bg0'
                      : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                page === totalPages
                  ? `${theme.textMuted} cursor-not-allowed`
                  : `${theme.textPrimary} ${theme.buttonSecondary} hover:bg-everforest-bg3`
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
