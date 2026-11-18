import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initSentry } from './lib/sentry'
import { initInstallCapture, registerServiceWorker } from './lib/installApp'

initSentry()
initInstallCapture()
registerServiceWorker()

const rootEl = document.getElementById('root')

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
