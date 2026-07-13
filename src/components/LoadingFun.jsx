import { useEffect, useState } from 'react'

// Shown during any wait so the screen keeps moving: an animated ticker of bars
// plus a rotating finance fun fact.
const FACTS = [
  'The name "Wall Street" comes from a real wall — a wooden palisade Dutch settlers built across lower Manhattan in 1653 to keep out the British.',
  'The "bull" and "bear" markets may come from how each animal attacks: a bull thrusts its horns up, a bear swipes its paws down.',
  'The New York Stock Exchange traces back to 1792, when 24 brokers signed the Buttonwood Agreement under a buttonwood tree.',
  'The ticker tape, invented in 1867, was the first electronic way to send stock prices — "ticker" is the sound the machine made.',
  'The Dow Jones Industrial Average launched in 1896 with just 12 companies. Only the concept survives — none of the original 12 remain in it.',
  'A "blue chip" stock is named after the blue chips in poker, historically the highest-value ones at the table.',
  'The term "IPO" — initial public offering — dates to the Dutch East India Company, the first firm to sell shares to the public, in 1602.',
  'Circuit breakers halt US trading if the market drops too fast in a day — a safeguard added after the 1987 "Black Monday" crash.',
]

export default function LoadingFun({ label }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length))
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % FACTS.length), 4200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="loadfun">
      <div className="loadfun-bars" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((b) => (
          <span key={b} style={{ animationDelay: `${b * 0.11}s` }} />
        ))}
      </div>
      {label && <div className="loadfun-label">{label}</div>}
      <div className="loadfun-fact">
        <div className="loadfun-fact-head">Did you know?</div>
        <div className="loadfun-fact-body" key={i}>{FACTS[i]}</div>
      </div>
    </div>
  )
}
