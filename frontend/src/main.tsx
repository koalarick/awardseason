import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

// Filter out Chrome extension errors from console
if (import.meta.env.DEV) {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args.join(' ');
    // Filter out chrome-extension:// errors
    if (
      errorMessage.includes('chrome-extension://') ||
      errorMessage.includes('ERR_FILE_NOT_FOUND') ||
      errorMessage.includes('extensionState.js') ||
      errorMessage.includes('heuristicsRedefinitions.js') ||
      errorMessage.includes('completion_list.html')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
