import { useParams, Link } from 'react-router-dom';
import { usePR, usePRDiff } from '../hooks/usePRs';
import { theme } from '../lib/theme';

export function PRDetailPage() {
  const { prNumber } = useParams<{ prNumber: string }>();
  const prNum = prNumber ? parseInt(prNumber) : undefined;

  const { data: pr, isLoading: prLoading, error: prError } = usePR(prNum);
  const { data: diff, isLoading: diffLoading, error: diffError } = usePRDiff(prNum);

  if (prLoading || diffLoading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${theme.spinner}`}></div>
        <p className={`mt-2 text-sm ${theme.textSecondary}`}>Loading pull request...</p>
      </div>
    );
  }

  if (prError || diffError) {
    return (
      <div className={`${theme.errorBox} border rounded-lg p-4`}>
        <h3 className={`text-sm font-medium ${theme.textError}`}>Error loading pull request</h3>
        <p className={`mt-1 text-sm ${theme.textError}`}>
          {((prError || diffError) as Error).message}
        </p>
        <Link to="/prs" className={`mt-4 inline-block text-sm ${theme.textLink}`}>
          ← Back to pull requests
        </Link>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="text-center py-12">
        <p className={`text-sm ${theme.textSecondary}`}>Pull request not found</p>
        <Link to="/prs" className={`mt-4 inline-block text-sm ${theme.textLink}`}>
          ← Back to pull requests
        </Link>
      </div>
    );
  }

  const statusColor = pr.draft
    ? theme.statusDraft
    : pr.merged_at
    ? theme.statusMerged
    : pr.state === 'closed'
    ? theme.statusClosed
    : theme.statusOpen;

  return (
    <div>
      <div className="mb-6">
        <Link to="/prs" className={`text-sm ${theme.textLink}`}>
          ← Back to pull requests
        </Link>
      </div>

      {/* PR Header */}
      <div className={`${theme.card}`}>
        <div className={`px-6 py-5 border-b ${theme.border}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                  {pr.draft ? 'Draft' : pr.merged_at ? 'Merged' : pr.state}
                </span>
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${theme.textLink} text-sm`}
                >
                  View on GitHub →
                </a>
              </div>
              <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>
                #{pr.number} {pr.title}
              </h1>
              <div className={`mt-2 flex items-center gap-4 text-sm ${theme.textSecondary}`}>
                <span className="flex items-center gap-1">
                  <img
                    src={pr.user.avatar_url}
                    alt={pr.user.login}
                    className="h-5 w-5 rounded-full"
                  />
                  {pr.user.login}
                </span>
                <span>wants to merge into {pr.base.ref} from {pr.head.ref}</span>
              </div>
            </div>
          </div>

          {pr.body && (
            <div className="mt-4 prose prose-sm max-w-none">
              <div className={`${theme.textSecondary} whitespace-pre-wrap`}>{pr.body}</div>
            </div>
          )}
        </div>

        {/* PR Stats */}
        <div className={`px-6 py-4 ${theme.bgSecondary} border-b ${theme.border}`}>
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1">
              <svg className={`h-4 w-4 ${theme.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <strong>{pr.commits}</strong> commits
            </span>
            <span className="flex items-center gap-1">
              <svg className={`h-4 w-4 ${theme.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <strong>{pr.comments + pr.review_comments}</strong> comments
            </span>
            <span className="flex items-center gap-1">
              <svg className={`h-4 w-4 ${theme.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <strong>{pr.changed_files}</strong> files changed
            </span>
            <span className={theme.textSuccess}>
              <strong>+{pr.additions}</strong>
            </span>
            <span className={theme.textError}>
              <strong>-{pr.deletions}</strong>
            </span>
          </div>
        </div>

        {/* File Changes */}
        <div className="px-6 py-5">
          <h2 className={`text-lg font-medium ${theme.textPrimary} mb-4`}>
            Files Changed ({diff?.length || 0})
          </h2>

          {!diff || diff.length === 0 ? (
            <p className={`text-sm ${theme.textSecondary}`}>No file changes to display</p>
          ) : (
            <div className="space-y-4">
              {diff.map((file) => (
                <div key={file.filename} className={`border ${theme.border} rounded-lg overflow-hidden`}>
                  {/* File Header */}
                  <div className={`${theme.bgSecondary} px-4 py-3 border-b ${theme.border}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            file.status === 'added'
                              ? theme.fileAdded
                              : file.status === 'removed'
                              ? theme.fileRemoved
                              : file.status === 'renamed'
                              ? theme.fileRenamed
                              : theme.fileModified
                          }`}
                        >
                          {file.status}
                        </span>
                        <span className={`font-mono text-sm ${theme.textPrimary}`}>{file.filename}</span>
                        {file.previous_filename && (
                          <span className={`text-xs ${theme.textSecondary}`}>
                            (renamed from {file.previous_filename})
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${theme.textSecondary}`}>
                        <span className={theme.textSuccess}>+{file.additions}</span>
                        {' / '}
                        <span className={theme.textError}>-{file.deletions}</span>
                      </div>
                    </div>
                  </div>

                  {/* Diff Content */}
                  {file.patch && (
                    <div className={theme.bgSecondary}>
                      <pre className="text-xs font-mono p-4 overflow-x-auto">
                        {file.patch.split('\n').map((line, index) => {
                          const bgColor = line.startsWith('+')
                            ? 'bg-everforest-bg-green'
                            : line.startsWith('-')
                            ? 'bg-everforest-bg-red'
                            : line.startsWith('@@')
                            ? 'bg-everforest-bg-blue'
                            : '';
                          const textColor = line.startsWith('+')
                            ? 'text-everforest-green'
                            : line.startsWith('-')
                            ? 'text-everforest-red'
                            : line.startsWith('@@')
                            ? 'text-everforest-blue'
                            : theme.textSecondary;

                          return (
                            <div key={index} className={`${bgColor} ${textColor}`}>
                              {line || ' '}
                            </div>
                          );
                        })}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
