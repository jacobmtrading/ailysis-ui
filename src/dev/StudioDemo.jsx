// Dev-only harness: open http://localhost:5173/?demo=studio to exercise the
// discussion-room panel (feature grid, insight tools, position entry) with a
// fake logged-in user. Only reachable in `vite dev` — main.jsx guards it.
import { useState } from 'react'
import StudioOverlay from '../components/StudioOverlay'
import InsightsOverlay from '../components/InsightsOverlay'

const DEMO_USER = { username: 'demo', tier: 'tailormade' }

export default function StudioDemo() {
  const [ctx, setCtx] = useState(null)
  return (
    <>
      <StudioOverlay
        open
        user={DEMO_USER}
        onOpenChat={() => {}}
        onOpenInsights={setCtx}
        onUpgrade={() => {}}
        onClose={() => window.location.assign('/')}
      />
      <InsightsOverlay ctx={ctx} user={DEMO_USER} onUpgrade={() => {}} onClose={() => setCtx(null)} />
    </>
  )
}
