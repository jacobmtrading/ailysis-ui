import { useEffect, useState } from 'react'
import Intro from './components/Intro'
import ChatOverlay from './components/ChatOverlay'
import MenuOverlay from './components/MenuOverlay'
import StudioOverlay from './components/StudioOverlay'
import InsightsOverlay from './components/InsightsOverlay'
import AdminOverlay from './components/AdminOverlay'
import PortfolioView from './components/PortfolioView'
import FeatureCarousel from './components/FeatureCarousel'
import * as account from './account'

export default function App() {
  const [introDone, setIntroDone] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuExpandTier, setMenuExpandTier] = useState(null)
  const [studioOpen, setStudioOpen] = useState(false)
  const [studioTab, setStudioTab] = useState('analyze')
  const [portfolioOpen, setPortfolioOpen] = useState(false)
  const [insightsCtx, setInsightsCtx] = useState(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [resetToken, setResetToken] = useState(null)
  // Feature tapped while logged out — opened as soon as the login succeeds.
  const [pending, setPending] = useState(null)

  // Restore session + handle links we may have been redirected from
  // (email verify, magic login, password reset, Stripe checkout).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cleanUrl = () => window.history.replaceState({}, '', window.location.pathname)

    // Magic-link login: the API redirected here with a fresh session token.
    const magicToken = params.get('token')
    if (magicToken) {
      account.setToken(magicToken)
      setMenuOpen(true)
    }

    // Password-reset link: show the "set a new password" form in the menu.
    const reset = params.get('reset')
    if (reset) {
      setResetToken(reset)
      setMenuOpen(true)
    }

    // Coming back from an email-confirmation link, or an expired magic link.
    if (params.get('verified') !== null || params.get('login') !== null) {
      setMenuOpen(true)
    }
    if (magicToken || reset || params.get('verified') !== null || params.get('login') !== null) {
      cleanUrl()
    }

    if (!account.getToken()) return
    account
      .me()
      .then(async (d) => {
        if (!d.user) return account.setToken(null)
        setUser(d.user)
        const sid = params.get('session_id')
        if (sid) {
          try {
            await account.confirmCheckout(sid)
            const fresh = await account.me()
            if (fresh.user) setUser(fresh.user)
            setMenuOpen(true)
          } catch {
            /* payment not completed */
          }
          window.history.replaceState({}, '', window.location.pathname)
        }
      })
      .catch(() => {})
  }, [])

  const openFeature = (id) => {
    if (id === 'portfolio') {
      setMenuOpen(false)
      setPortfolioOpen(true)
    } else {
      setStudioTab(id)
      setStudioOpen(true)
    }
  }

  const pickFeature = (f) => {
    if (user) return openFeature(f.id)
    setPending(f.id)
    setMenuOpen(true)
  }

  // Logged in (any way) with a feature waiting → go straight to it.
  // Logged out → the members-only portfolio closes.
  useEffect(() => {
    if (user && pending) {
      setPending(null)
      setMenuOpen(false)
      openFeature(pending)
    }
    if (!user) setPortfolioOpen(false)
  }, [user, pending])

  return (
    <div className="app">
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}

      <section className="landing">
        <div className="top-bar">
          <button className="help-btn burger" onClick={() => setMenuOpen(true)} aria-label="Account & subscription">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            {user && <span className={`burger-dot tier-${user.tier}`} />}
          </button>
          <div className="landing-brand">ailysis</div>
          <div className="top-spacer" />
        </div>

        <FeatureCarousel user={user} onPick={pickFeature} />
      </section>

      <PortfolioView open={portfolioOpen} onClose={() => setPortfolioOpen(false)} onOpenChat={setActiveOrder} />
      <MenuOverlay
        open={menuOpen}
        user={user}
        onUser={setUser}
        expandTier={menuExpandTier}
        resetToken={resetToken}
        onResetDone={() => setResetToken(null)}
        onClose={() => {
          setMenuOpen(false)
          setMenuExpandTier(null)
          setResetToken(null)
          setPending(null)
        }}
        onOpenFeature={openFeature}
        onOpenAdmin={() => setAdminOpen(true)}
      />
      <StudioOverlay
        open={studioOpen}
        user={user}
        initialTab={studioTab}
        onOpenChat={setActiveOrder}
        onOpenInsights={setInsightsCtx}
        onUpgrade={(tier) => {
          setStudioOpen(false)
          setMenuExpandTier(tier)
          setMenuOpen(true)
        }}
        onClose={() => setStudioOpen(false)}
      />
      <InsightsOverlay
        ctx={insightsCtx}
        user={user}
        onUpgrade={(tier) => {
          setInsightsCtx(null)
          setStudioOpen(false)
          setMenuExpandTier(tier)
          setMenuOpen(true)
        }}
        onClose={() => setInsightsCtx(null)}
      />
      <AdminOverlay open={adminOpen} onClose={() => setAdminOpen(false)} />
      <ChatOverlay order={activeOrder} onClose={() => setActiveOrder(null)} />
    </div>
  )
}
