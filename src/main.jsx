import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// Dev-only harnesses: ?demo=insights for the insights overlay, ?demo=lab for
// the Lab, ?demo=portfolio for the fund chart. The DEV guard keeps them (and their fetch stubs) out of
// production bundles entirely.
const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo')
if (demo === 'insights') {
  import('./dev/InsightsDemo.jsx').then(({ default: InsightsDemo }) => {
    root.render(<InsightsDemo />)
  })
} else if (demo === 'lab' || demo === 'studio') {
  import('./dev/LabDemo.jsx').then(({ default: LabDemo }) => {
    root.render(<LabDemo />)
  })
} else if (demo === 'portfolio') {
  import('./dev/PortfolioDemo.jsx').then(({ default: PortfolioDemo }) => {
    root.render(<PortfolioDemo />)
  })
} else {
  root.render(
    <React.StrictMode>
      <App />
      <Analytics />
    </React.StrictMode>
  )
}
