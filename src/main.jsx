import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// Dev-only harness for the insights overlay (?demo=insights). The DEV guard
// keeps it (and its fetch stub) out of production bundles entirely.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === 'insights') {
  import('./dev/InsightsDemo.jsx').then(({ default: InsightsDemo }) => {
    root.render(<InsightsDemo />)
  })
} else {
  root.render(
    <React.StrictMode>
      <App />
      <Analytics />
    </React.StrictMode>
  )
}
