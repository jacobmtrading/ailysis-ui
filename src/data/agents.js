// The board — keys MUST match what the backend emits (api/_lib/board.js:
// max / valeria / kian / rayan / emilia / mod). If a key here doesn't match an
// emitted `from`, ChatOverlay falls back to AGENTS.mod and every message shows
// up as the Moderator.
// Names are the ailysis roster; the model family running each seat (from Nitro's
// council engine) is shown after the "·" in strat.
// NOTE: first word of each name is used standalone in the UI (participants
// header, typing indicator).
export const AGENTS = {
  max: { name: 'Max Momentum', strat: 'Momentum & News · GPT-4.1 mini', color: '#2b9bd8', avatar: '#2b9bd8' },
  valeria: { name: 'Valeria Value', strat: 'Value / Fundamentals · DeepSeek V3', color: '#e8734a', avatar: '#e8734a' },
  kian: { name: 'Kian Quant', strat: 'Charts / Quant · Gemini 2.5 Flash', color: '#1fae7a', avatar: '#1fae7a' },
  rayan: { name: 'Rayan Risk', strat: 'Strategy & Risk · Claude Haiku 4.5', color: '#d84a6b', avatar: '#d84a6b' },
  emilia: { name: 'Emilia ETF', strat: 'Asset Allocation · Llama 3.3 70B', color: '#9c5cff', avatar: '#9c5cff' },
  mod: { name: 'The Moderator', strat: 'Board Chair · Claude Sonnet 4.6', color: '#128c7e', avatar: '#128c7e' },
}

// Nitro's council engine (api/ingest.js) can push chats keyed by the seat
// lens instead of the ailysis names. Same six seats, so map them onto the
// canonical keys above — otherwise those messages fall back to the Moderator.
const ALIASES = {
  aggressive: 'max',
  value: 'valeria',
  technical: 'kian',
  conservative: 'rayan',
  skeptic: 'emilia',
}

// Resolve any emitted `from`/agent key (either namespace) to a board seat,
// defaulting to the Moderator for anything unrecognized.
export function agentFor(key) {
  return AGENTS[key] || AGENTS[ALIASES[key]] || AGENTS.mod
}

