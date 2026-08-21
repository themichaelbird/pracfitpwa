import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// PRD 7/9.1: lets the app shell boot with no network at all. Data-layer
// offline handling (session logging reads/writes) is separate -- see
// src/lib/offlineQueue.js -- this only registers the precaching service
// worker itself.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
