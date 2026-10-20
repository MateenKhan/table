import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { makeData } from './makeData'
import { ToastProvider, ConfirmProvider } from './ui'
import LandingPage from './LandingPage'

import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <ConfirmProvider>
          <LandingPage>
            <App makeDemoData={() => makeData(1000)} embedded />
          </LandingPage>
        </ConfirmProvider>
      </ToastProvider>
    </MotionConfig>
  </React.StrictMode>,
)
