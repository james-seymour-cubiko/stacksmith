import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StacksListPage } from './pages/StacksListPage';
import { StackDetailPage } from './pages/StackDetailPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function Navigation() {
  const location = useLocation();

  const isStackDetailPage = location.pathname.startsWith('/stacks/');

  const isActive = (path: string) => {
    if (path === '/' || path === '/stacks') {
      return location.pathname === '/' || location.pathname.startsWith('/stacks');
    }
    return location.pathname.startsWith(path);
  };

  const linkClass = (path: string) => {
    const base = 'inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2';
    if (isActive(path)) {
      return `${base} text-everforest-green border-everforest-green`;
    }
    return `${base} text-everforest-grey1 border-transparent hover:border-everforest-grey0 hover:text-everforest-fg`;
  };

  return (
    <nav className="bg-everforest-bg1 border-b border-everforest-bg3">
      <div className={`${isStackDetailPage ? 'max-w-[95%]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-everforest-fg">Review App</h1>
            </div>
            <div className="ml-6 flex space-x-8">
              <Link to="/" className={linkClass('/stacks')}>
                Pull Requests
              </Link>
              <Link to="/settings" className={linkClass('/settings')}>
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function MainContent() {
  const location = useLocation();
  const isStackDetailPage = location.pathname.startsWith('/stacks/');

  return (
    <main className={`${isStackDetailPage ? 'max-w-[95%]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
      <Routes>
        <Route path="/" element={<StacksListPage />} />
        <Route path="/stacks/:stackId" element={<StackDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </main>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-everforest-bg0">
          <Navigation />
          <MainContent />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
