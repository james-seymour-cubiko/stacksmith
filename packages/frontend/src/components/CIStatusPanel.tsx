import { theme } from '../lib/theme';
import type { GithubCheckRun } from '../../../shared/src/types';

interface CIStatusPanelProps {
  checkRuns: GithubCheckRun[] | undefined;
  checkRunsLoading: boolean;
  onRerunAll: () => void;
  rerunPending: boolean;
}

export function CIStatusPanel({ checkRuns, checkRunsLoading, onRerunAll, rerunPending }: CIStatusPanelProps) {
  return (
    <div className={`w-80 flex-shrink-0 ${theme.card} self-stretch`}>
      <div className={`px-4 py-3 ${theme.border}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-medium ${theme.textPrimary}`}>
            CI Status
          </h3>
          {checkRuns && checkRuns.length > 0 && (
            <button
              onClick={onRerunAll}
              disabled={rerunPending}
              className={`text-xs px-2 py-1 rounded text-everforest-bg0 bg-everforest-green hover:bg-everforest-green/90 disabled:bg-everforest-bg3 disabled:text-everforest-grey0 disabled:cursor-not-allowed font-medium transition-colors`}
              title="Rerun all CI checks"
            >
              {rerunPending ? '⟳ Rerunning...' : '⟳ Rerun All'}
            </button>
          )}
        </div>
        {checkRunsLoading ? (
          <div className="text-center py-4">
            <div className={`inline-block animate-spin rounded-full h-4 w-4 border-b-2 ${theme.spinner}`}></div>
          </div>
        ) : !checkRuns || checkRuns.length === 0 ? (
          <p className={`text-xs ${theme.textMuted} text-center py-4`}>No CI checks</p>
        ) : checkRuns.every((check) =>
            check.conclusion === 'success' ||
            check.conclusion === 'skipped' ||
            check.conclusion === 'cancelled' ||
            check.conclusion === 'neutral'
          ) ? (
          <div className={`text-center py-4 px-2 rounded ${theme.successBox}`}>
            <p className={`text-xs ${theme.textSuccess} font-medium`}>
              ✓ All checks passed
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {checkRuns.filter((check) =>
              // Show blocking failures and in-progress checks
              check.conclusion === 'failure' ||
              check.conclusion === 'timed_out' ||
              check.conclusion === 'action_required' ||
              check.status === 'in_progress' ||
              check.status === 'queued'
            ).map((check) => {
              let statusColor = theme.textMuted;
              let statusIcon = '○';

              // Blocking failures
              if (check.conclusion === 'failure') {
                statusColor = theme.textError;
                statusIcon = '✗';
              } else if (check.conclusion === 'timed_out') {
                statusColor = theme.textError;
                statusIcon = '⏱';
              } else if (check.conclusion === 'action_required') {
                statusColor = theme.textError;
                statusIcon = '⚠';
              }
              // In-progress states
              else if (check.status === 'in_progress') {
                statusColor = theme.textWarning;
                statusIcon = '⟳';
              } else if (check.status === 'queued') {
                statusColor = theme.textMuted;
                statusIcon = '◷';
              }
              // Non-blocking states (shouldn't show up due to filter, but keep for safety)
              else if (check.conclusion === 'success') {
                statusColor = theme.textSuccess;
                statusIcon = '✓';
              } else if (check.conclusion === 'cancelled') {
                statusColor = theme.textMuted;
                statusIcon = '⊘';
              } else if (check.conclusion === 'skipped') {
                statusColor = theme.textMuted;
                statusIcon = '⊝';
              } else if (check.conclusion === 'neutral') {
                statusColor = theme.textMuted;
                statusIcon = '○';
              }

              return (
                <div
                  key={check.id}
                  className={`p-2 rounded border ${theme.border} hover:bg-everforest-bg1 transition-colors`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-sm ${statusColor} flex-shrink-0 mt-0.5`}>
                      {statusIcon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${theme.textPrimary} truncate`} title={check.name}>
                        {check.name}
                      </div>
                      {(check.html_url || check.details_url) && (
                        <a
                          href={check.html_url || check.details_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-xs ${theme.textLink} mt-1 inline-block`}
                        >
                          Details →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
