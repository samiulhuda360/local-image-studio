import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './styles.css'

if (import.meta.env.DEV) {
  // Lets the eval scripts drive the same browser pipeline the UI uses.
  void import('./evalHarness.ts')
}

const root = document.getElementById('root')
if (root) createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
