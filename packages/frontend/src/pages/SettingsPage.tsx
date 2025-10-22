import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configAPI } from '../lib/api';
import { theme } from '../lib/theme';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ['config', 'github'],
    queryFn: () => configAPI.getGithub(),
    retry: false,
  });

  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  // Fetch rate limit once (shared across all repositories)
  const {
    data: rateLimit,
    isLoading: isLoadingRateLimit,
    refetch: refetchRateLimit,
  } = useQuery({
    queryKey: ['rateLimit'],
    queryFn: () => configAPI.getRateLimit(),
    retry: false,
    enabled: config?.repos && config.repos.length > 0,
  });

  const configureMutation = useMutation({
    mutationFn: configAPI.configureGithub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'github'] });
      setToken(''); // Clear token from form
      alert('GitHub configuration saved successfully!');
    },
    onError: (error) => {
      alert(`Error: ${(error as Error).message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!owner || !repo || !token) {
      alert('Please fill in all required fields');
      return;
    }

    configureMutation.mutate({ owner, repo, token, currentUser: currentUser || undefined });
  };

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className={`text-2xl font-semibold ${theme.textPrimary}`}>Settings</h1>
          <p className={`mt-2 text-sm ${theme.textSecondary}`}>
            Configure your GitHub integration and other settings.
          </p>
        </div>
      </div>

      <div className={`mt-8 ${theme.card}`}>
        <div className={`px-6 py-5 border-b ${theme.border}`}>
          <h2 className={`text-lg font-medium ${theme.textPrimary}`}>GitHub Configuration</h2>
          <p className={`mt-1 text-sm ${theme.textSecondary}`}>
            Configure GitHub repository and access token.
          </p>
        </div>

        {config && config.repos && config.repos.length > 0 && (
          <div className={`px-6 py-4 ${theme.successBox} border-b border`}>
            <p className={`text-sm ${theme.textSuccess} mb-2`}>
              <strong>Currently configured repositories:</strong>
            </p>
            <ul className={`text-sm ${theme.textSuccess} list-disc list-inside space-y-1`}>
              {config.repos.map((repo, index) => (
                <li key={index}>
                  <strong>{repo.owner}/{repo.repo}</strong>
                </li>
              ))}
            </ul>
            {config.currentUser && (
              <p className={`text-sm ${theme.textSuccess} mt-2`}>
                User: <strong>{config.currentUser}</strong>
              </p>
            )}
            <p className={`text-sm ${theme.textSecondary} mt-3`}>
              To configure multiple repositories, update the <code className="px-1 py-0.5 bg-everforest-bg2 rounded">GITHUB_REPOS</code> environment variable in your <code className="px-1 py-0.5 bg-everforest-bg2 rounded">.env.local</code> file.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          <div>
            <label htmlFor="owner" className={`block text-sm font-medium ${theme.textSecondary}`}>
              Repository Owner
            </label>
            <input
              type="text"
              id="owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g., facebook"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${theme.input}`}
            />
            <p className={`mt-1 text-sm ${theme.textSecondary}`}>
              The GitHub username or organization that owns the repository
            </p>
          </div>

          <div>
            <label htmlFor="repo" className={`block text-sm font-medium ${theme.textSecondary}`}>
              Repository Name
            </label>
            <input
              type="text"
              id="repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="e.g., react"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${theme.input}`}
            />
            <p className={`mt-1 text-sm ${theme.textSecondary}`}>The name of the repository</p>
          </div>

          <div>
            <label htmlFor="token" className={`block text-sm font-medium ${theme.textSecondary}`}>
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${theme.input}`}
            />
            <p className={`mt-1 text-sm ${theme.textSecondary}`}>
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className={theme.textLink}
              >
                github.com/settings/tokens
              </a>{' '}
              with <code className={`text-xs ${theme.bgTertiary} px-1 py-0.5 rounded`}>repo</code> scope
            </p>
          </div>

          <div>
            <label htmlFor="currentUser" className={`block text-sm font-medium ${theme.textSecondary}`}>
              Your GitHub Username (Optional)
            </label>
            <input
              type="text"
              id="currentUser"
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
              placeholder="e.g., octocat"
              className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border ${theme.input}`}
            />
            <p className={`mt-1 text-sm ${theme.textSecondary}`}>
              Set this to filter PRs to show only your pull requests
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={configureMutation.isPending}
              className={`inline-flex justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${theme.buttonPrimary}`}
            >
              {configureMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Rate Limit Section */}
      {config && config.repos && config.repos.length > 0 && (
        <div className={`mt-8 ${theme.card}`}>
          <div className={`px-6 py-5 border-b ${theme.border} flex justify-between items-center`}>
            <div>
              <h2 className={`text-lg font-medium ${theme.textPrimary}`}>API Rate Limit</h2>
              <p className={`mt-1 text-sm ${theme.textSecondary}`}>
                Current GitHub API rate limit usage (shared across all repositories).
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetchRateLimit()}
              disabled={isLoadingRateLimit}
              className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${theme.buttonSecondary}`}
            >
              {isLoadingRateLimit ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="px-6 py-5">
            {isLoadingRateLimit && (
              <p className={`text-sm ${theme.textSecondary}`}>Loading rate limit...</p>
            )}

            {!isLoadingRateLimit && !rateLimit && (
              <p className={`text-sm ${theme.textSecondary}`}>
                Failed to load rate limit information.
              </p>
            )}

            {rateLimit && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* REST API Rate Limit */}
                <div className={`${theme.bgSecondary} rounded-lg p-4 border ${theme.border}`}>
                  <h4 className={`text-sm font-medium ${theme.textPrimary} mb-3`}>REST API</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${theme.textSecondary}`}>Used:</span>
                      <span className={`text-sm font-medium ${theme.textPrimary}`}>{rateLimit.rest.used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${theme.textSecondary}`}>Remaining:</span>
                      <span className={`text-sm font-medium ${theme.textPrimary}`}>{rateLimit.rest.remaining}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${theme.textSecondary}`}>Limit:</span>
                      <span className={`text-sm font-medium ${theme.textPrimary}`}>{rateLimit.rest.limit}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex justify-between">
                        <span className={`text-sm ${theme.textSecondary}`}>Resets at:</span>
                        <span className={`text-sm font-medium ${theme.textPrimary}`}>
                          {new Date(rateLimit.rest.resetAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="pt-2">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (rateLimit.rest.remaining / rateLimit.rest.limit) > 0.5
                              ? 'bg-green-600'
                              : (rateLimit.rest.remaining / rateLimit.rest.limit) > 0.2
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${(rateLimit.rest.remaining / rateLimit.rest.limit) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GraphQL API Rate Limit */}
                <div className={`${theme.bgSecondary} rounded-lg p-4 border ${theme.border}`}>
                  <h4 className={`text-sm font-medium ${theme.textPrimary} mb-3`}>GraphQL API</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${theme.textSecondary}`}>Used:</span>
                      <span className={`text-sm font-medium ${theme.textPrimary}`}>{rateLimit.graphql.used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${theme.textSecondary}`}>Remaining:</span>
                      <span className={`text-sm font-medium ${theme.textPrimary}`}>{rateLimit.graphql.remaining}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${theme.textSecondary}`}>Limit:</span>
                      <span className={`text-sm font-medium ${theme.textPrimary}`}>{rateLimit.graphql.limit}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex justify-between">
                        <span className={`text-sm ${theme.textSecondary}`}>Resets at:</span>
                        <span className={`text-sm font-medium ${theme.textPrimary}`}>
                          {new Date(rateLimit.graphql.resetAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="pt-2">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (rateLimit.graphql.remaining / rateLimit.graphql.limit) > 0.5
                              ? 'bg-green-600'
                              : (rateLimit.graphql.remaining / rateLimit.graphql.limit) > 0.2
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${(rateLimit.graphql.remaining / rateLimit.graphql.limit) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
