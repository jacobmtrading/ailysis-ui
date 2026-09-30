import { useMarketStatus } from '../useMarketStatus'

export default function MarketPill() {
  const m = useMarketStatus()
  return (
    <div className="market-pill">
      <span className={`market-dot ${m.open ? 'open' : 'closed'}`} />
      <span>
        {m.open ? 'Open' : 'Closed'} · <b>{m.label}</b>
      </span>
    </div>
  )
}
