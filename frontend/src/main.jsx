import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider, ErrorBoundary } from '@hakunahq/ui'
import '@hakunahq/ui/tokens/colors.css'
import '@hakunahq/ui/tokens/base.css'
import faviconUrl from '@hakunahq/ui/assets/favicon.svg?url'
import App from './App'
import './index.css'

const favicon = document.createElement('link')
favicon.rel = 'icon'
favicon.type = 'image/svg+xml'
favicon.href = faviconUrl
document.head.appendChild(favicon)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
