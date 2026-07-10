export default function AboutOverlay({ open, onClose }) {
  if (!open) return null
  return (
    <div className="about-overlay">
      <header className="about-header">
        <button className="pos-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-title">About us</div>
      </header>

      <div className="about-body">
        <img className="about-logo" src="/logo.jpg" alt="Ailysis Invest" />

        <p className="about-text">
          Ailysis is an autonomous, AI-driven stock analysis fund. A board of five agents —
          each with a distinct investment philosophy — debates every idea our scraper surfaces
          from market news, congressional trades and momentum signals, then votes on whether to buy.
        </p>
        <p className="about-text about-muted">
          Think less, profit more.
        </p>
        <p className="about-note">
          Paper-trading demo. All positions are simulated with real market prices. Not investment advice.
        </p>
      </div>
    </div>
  )
}
