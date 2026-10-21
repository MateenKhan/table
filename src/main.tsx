import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { ToastProvider, ConfirmProvider } from './ui'
import LandingPage from './LandingPage'

import './index.css'

const LazyApp = React.lazy(() =>
  Promise.all([
    import('./App'),
    import('./makeData'),
  ]).then(([{ App }, { makeData }]) => ({
    default: () => <App makeDemoData={() => makeData(1000)} embedded />,
  })),
)

function DemoFallback() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      Loading interactive demo…
    </div>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <ConfirmProvider>
          <LandingPage>
            <React.Suspense fallback={<DemoFallback />}>
              <LazyApp />
            </React.Suspense>
          </LandingPage>
        </ConfirmProvider>
      </ToastProvider>
    </MotionConfig>
  </React.StrictMode>,
)
