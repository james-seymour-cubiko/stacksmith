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

        {config && (
          <div className={`px-6 py-4 ${theme.successBox} border-b border`}>
            <p className={`text-sm ${theme.textSuccess}`}>
              Currently configured: <strong>{config.owner}/{config.repo}</strong>
              {config.currentUser && <span> • User: <strong>{config.currentUser}</strong></span>}
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
    </div>
  );
}
