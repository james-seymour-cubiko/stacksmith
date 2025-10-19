import { useStacks } from '../hooks/useStacks';
import { Link } from 'react-router-dom';
import { theme } from '../lib/theme';

export function StacksListPage() {
  const { data: stacks, isLoading, error } = useStacks();

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

  return (
    <div>
      <div className="sm:flex sm:items-center mb-6">
        <div className="sm:flex-auto">
          <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>Pull Requests</h1>
          <p className={`mt-2 text-sm ${theme.textSecondary}`}>
            All open pull requests, including stacked PRs.
          </p>
        </div>
      </div>

      <div className={`${theme.card} overflow-hidden`}>
        <table className="min-w-full divide-y divide-everforest-bg3">
          <thead className={`${theme.bgSecondary}`}>
            <tr>
              <th scope="col" className={`py-3 pl-6 pr-3 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Title
              </th>
              <th scope="col" className={`px-3 py-3 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Author
              </th>
              <th scope="col" className={`px-3 py-3 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Status
              </th>
              <th scope="col" className={`px-3 py-3 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                PRs
              </th>
              <th scope="col" className={`px-3 py-3 text-left text-xs font-medium ${theme.textSecondary} uppercase tracking-wider`}>
                Updated
              </th>
              <th scope="col" className="relative py-3 pl-3 pr-6">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-everforest-bg3`}>
            {stacks.map((stack) => {
              const basePR = stack.prs[0];
              const hasMultiplePRs = stack.prs.length > 1;

              // Determine status color
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

              return (
                <tr key={stack.id} className={`${theme.cardHover} transition-colors`}>
                  <td className="py-4 pl-6 pr-3">
                    <Link to={`/stacks/${stack.id}`} className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {hasMultiplePRs && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-everforest-purple/20 text-everforest-purple" title="Stacked PRs">
                            ⚡
                          </span>
                        )}
                        <span className={`text-sm font-medium ${theme.textPrimary} hover:text-everforest-green`}>
                          {stack.name}
                        </span>
                      </div>
                      <span className={`text-xs ${theme.textMuted} mt-1`}>
                        #{basePR.number} • {basePR.head.ref} → {basePR.base.ref}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={basePR.user.avatar_url}
                        alt={basePR.user.login}
                        className="h-6 w-6 rounded-full"
                      />
                      <span className={`text-sm ${theme.textSecondary}`}>
                        {basePR.user.login}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`text-sm ${theme.textSecondary}`}>
                      {stack.prs.length}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`text-sm ${theme.textSecondary}`}>
                      {new Date(stack.updated_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-4 pl-3 pr-6 text-right">
                    <Link
                      to={`/stacks/${stack.id}`}
                      className={`text-sm font-medium ${theme.textLink}`}
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
    </div>
  );
}
