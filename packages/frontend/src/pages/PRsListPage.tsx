import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePRs } from '../hooks/usePRs';
import { theme } from '../lib/theme';

export function PRsListPage() {
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');
  const { data: prs, isLoading, error } = usePRs(state);

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

  if (!prs || prs.length === 0) {
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
        <p className={`mt-1 text-sm ${theme.textSecondary}`}>
          No {state === 'all' ? '' : state} pull requests found in this repository.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>Pull Requests</h1>
          <p className={`mt-2 text-sm ${theme.textSecondary}`}>
            Browse all pull requests in the configured repository.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <select
            value={state}
            onChange={(e) => setState(e.target.value as 'open' | 'closed' | 'all')}
            className={`block rounded-md shadow-sm sm:text-sm px-3 py-2 border ${theme.input}`}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {prs.map((pr) => {
          const statusColor = pr.draft
            ? theme.statusDraft
            : pr.merged_at
            ? theme.statusMerged
            : pr.state === 'closed'
            ? theme.statusClosed
            : theme.statusOpen;

          return (
            <Link
              key={pr.number}
              to={`/prs/${pr.number}`}
              className={`block rounded-lg shadow hover:shadow-md transition-shadow p-4 ${theme.card} ${theme.cardHover}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {pr.draft ? 'Draft' : pr.merged_at ? 'Merged' : pr.state}
                    </span>
                    <h3 className={`text-base font-medium ${theme.textPrimary} truncate`}>
                      #{pr.number} {pr.title}
                    </h3>
                  </div>

                  <div className={`mt-2 flex items-center gap-4 text-sm ${theme.textSecondary}`}>
                    <span className="flex items-center gap-1">
                      <img
                        src={pr.user.avatar_url}
                        alt={pr.user.login}
                        className="h-5 w-5 rounded-full"
                      />
                      {pr.user.login}
                    </span>
                    <span>
                      {pr.head.ref} → {pr.base.ref}
                    </span>
                    <span>Updated {new Date(pr.updated_at).toLocaleDateString()}</span>
                  </div>

                  <div className={`mt-2 flex items-center gap-4 text-xs ${theme.textSecondary}`}>
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                        />
                      </svg>
                      {pr.comments + pr.review_comments}
                    </span>
                    <span>+{pr.additions} -{pr.deletions}</span>
                    <span>{pr.commits} commits</span>
                    <span>{pr.changed_files} files</span>
                  </div>
                </div>

                <svg
                  className={`h-5 w-5 ${theme.textMuted} flex-shrink-0 ml-4`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
