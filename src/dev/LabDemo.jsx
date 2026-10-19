// Dev-only harness: open http://localhost:5173/?demo=lab to exercise the Lab
// (shared portfolio entry, tool grid, insight tools) with a fake logged-in user
// and the canned insights data. Only reachable in `vite dev` — main.jsx guards it.
import { useState } from 'react'
import LabOverlay from '../components/LabOverlay'
import InsightsOverlay from '../components/InsightsOverlay'
import { useLab, addPosition, removePosition } from '../lab'
import '../dev/InsightsDemo.jsx' // installs the /api/insights fetch stub

const DEMO_USER = { username: 'demo', tier: 'tailormade' }

export default function LabDemo() {
  const [ctx, setCtx] = useState(null)
  const [lab, setLab] = useLab()
  return (
    <>
      <LabOverlay
        open
        user={DEMO_USER}
        lab={lab}
        onLab={setLab}
        onOpenChat={() => {}}
        onOpenInsights={setCtx}
        onUpgrade={() => {}}
        onClose={() => window.location.assign('/')}
      />
      <InsightsOverlay
        ctx={ctx}
        user={DEMO_USER}
        lab={lab}
        onAddToLab={(t) => setLab((l) => addPosition(l, t))}
        onRemoveFromLab={(t) => setLab((l) => removePosition(l, t))}
        onUpgrade={() => {}}
        onClose={() => setCtx(null)}
      />
    </>
  )
}
