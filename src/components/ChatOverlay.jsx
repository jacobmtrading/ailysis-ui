import { useEffect, useState } from 'react'
import { AGENTS } from '../data/agents'

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Poll({ msg }) {
  const yes = msg.votes.filter((v) => v.vote === 'yes').length
  const no = msg.votes.filter((v) => v.vote === 'no').length
  const total = msg.votes.length
  return (
    <div className="wa-bubble wa-in wa-poll">
      <div className="wa-sender" style={{ color: AGENTS.mod.color }}>
        {AGENTS.mod.name}
      </div>
      <div className="wa-poll-q">{msg.question}</div>

      <div className="wa-poll-opt">
        <div className="wa-poll-optline">
          <span>✅ Yes</span>
          <span>{yes}</span>
        </div>
        <div className="wa-poll-bar">
          <div className="wa-poll-fill yes" style={{ width: `${(yes / total) * 100}%` }} />
        </div>
      </div>
      <div className="wa-poll-opt">
        <div className="wa-poll-optline">
          <span>❌ No</span>
          <span>{no}</span>
        </div>
        <div className="wa-poll-bar">
          <div className="wa-poll-fill no" style={{ width: `${(no / total) * 100}%` }} />
        </div>
      </div>

      <div className="wa-poll-voters">
        {msg.votes.map((v, i) => {
          const voter = AGENTS[v.agent] || AGENTS.mod
          return (
            <span key={i} className="wa-voter">
              <span className="wa-voter-dot" style={{ background: voter.avatar }}>
                {initials(voter.name)}
              </span>
              {v.vote === 'yes' ? '✅' : '❌'}
            </span>
          )
        })}
      </div>
      <span className="wa-time">{msg.time}</span>
    </div>
  )
}

function Bubble({ msg, chat }) {
  const agent = AGENTS[msg.from] || AGENTS.mod
  const replied = msg.replyTo != null ? chat[msg.replyTo] : null
  const repliedAgent = replied ? AGENTS[replied.from] || AGENTS.mod : null

  return (
    <div className="wa-row">
      <div className="wa-avatar" style={{ background: agent.avatar }}>
        {initials(agent.name)}
      </div>
      <div className="wa-bubble wa-in">
        <div className="wa-sender" style={{ color: agent.color }}>
          {agent.name} <span className="wa-strat">· {agent.strat}</span>
        </div>

        {replied && (
          <div className="wa-reply" style={{ borderColor: repliedAgent.color }}>
            <div className="wa-reply-name" style={{ color: repliedAgent.color }}>
              {repliedAgent.name}
            </div>
            <div className="wa-reply-text">{replied.text}</div>
          </div>
        )}

        <div className="wa-text">{msg.text}</div>
        <span className="wa-time">{msg.time}</span>

        {msg.reactions && (
          <div className="wa-reactions">
            {msg.reactions.map((r, i) => (
              <span key={i}>{r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingBubble({ msg }) {
  const agent = AGENTS[msg?.from] || AGENTS.mod
  return (
    <div className="wa-row">
      <div className="wa-avatar" style={{ background: agent.avatar }}>
        {initials(agent.name)}
      </div>
      <div className="wa-bubble wa-in wa-typing">
        <span className="wa-typing-name" style={{ color: agent.color }}>
          {agent.name.split(' ')[0]} is typing
        </span>
        <span className="wa-dots">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  )
}

export default function ChatOverlay({ order, onClose }) {
  const msgs = order?.chat || []
  const live = !!order?.live
  // On a freshly-generated board chat, reveal messages one at a time so the
  // agents look like they're talking in real time.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!order) return
    if (!live) {
      setShown(msgs.length)
      return
    }
    setShown(1)
    let i = 1
    const id = setInterval(() => {
      i += 1
      setShown(i)
      if (i >= msgs.length) clearInterval(id)
    }, 1100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  if (!order) return null
  const participants = ['max', 'valeria', 'kian', 'rayan', 'emilia', 'mod']
    .map((k) => AGENTS[k].name.split(' ')[0])
    .join(', ')
  const visible = msgs.slice(0, shown)
  const typingNext = live && shown < msgs.length ? msgs[shown] : null

  return (
    <div className="wa-overlay">
      <header className="wa-header">
        <button className="wa-back" onClick={onClose} aria-label="Leave chat">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="wa-header-avatar">🧠</div>
        <div className="wa-header-info">
          <div className="wa-header-title">{order.ticker} · Board Review</div>
          <div className="wa-header-sub">{participants}</div>
        </div>
        <div className="wa-header-icons">
          <span>📞</span>
          <span>⋮</span>
        </div>
      </header>

      <div className="wa-chat">
        <div className="wa-daydivider"><span>Board convened · {order.source}</span></div>
        {visible.map((m, i) =>
          m.poll ? <Poll key={i} msg={m} /> : <Bubble key={i} msg={m} chat={msgs} />
        )}
        {typingNext && !typingNext.poll && <TypingBubble msg={typingNext} />}
        {shown >= msgs.length && (
          <div className="wa-endnote">
            Decisions are made by autonomous agents. Not investment advice.
          </div>
        )}
      </div>

      <footer className="wa-inputbar">
        <div className="wa-input">Board decision recorded — chat is read-only</div>
        <div className="wa-send">🎤</div>
      </footer>
    </div>
  )
}
