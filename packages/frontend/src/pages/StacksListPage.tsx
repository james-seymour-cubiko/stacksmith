import { useStacks } from '../hooks/useStacks';
import { Link } from 'react-router-dom';
import { theme } from '../lib/theme';

export function StacksListPage() {
  const { data: stacks, isLoading, error } = useStacks();

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${theme.spinner}`}></div>
        <p className={`mt-2 text-sm ${theme.textSecondary}`}>Loading stacks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.errorBox} border rounded-lg p-4`}>
        <h3 className={`text-sm font-medium ${theme.textError}`}>Error loading stacks</h3>
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
        <h3 className={`mt-2 text-sm font-medium ${theme.textPrimary}`}>No stacks</h3>
        <p className={`mt-1 text-sm ${theme.textSecondary}`}>Get started by creating a new stack.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>Stacks</h1>
          <p className={`mt-2 text-sm ${theme.textSecondary}`}>
            A list of all your stacked pull requests.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {stacks.map((stack) => (
          <Link
            key={stack.id}
            to={`/stacks/${stack.id}`}
            className={`block ${theme.card} ${theme.cardHover} transition-all p-6`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className={`text-lg font-medium ${theme.textPrimary}`}>{stack.name}</h3>
                {stack.description && (
                  <p className={`mt-1 text-sm ${theme.textSecondary}`}>{stack.description}</p>
                )}
                <div className={`mt-2 flex items-center gap-4 text-sm ${theme.textSecondary}`}>
                  <span>{stack.prs.length} PRs</span>
                  <span>Updated {new Date(stack.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
