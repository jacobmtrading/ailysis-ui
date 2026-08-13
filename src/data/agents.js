// The board — keys match what the backend emits.
// These are the REAL council seats: five different investing lenses, each run
// by a different model family, deliberating over a real Alpaca paper account.
// NOTE: first word of each name is used standalone in the UI (participants
// header, typing indicator) — keep names one distinctive word (+ optional rest).
export const AGENTS = {
  aggressive: { name: 'Aggressive', strat: 'Asymmetric Upside · GPT-4.1 mini', color: '#2b9bd8', avatar: '#2b9bd8' },
  value: { name: 'Value', strat: 'Intrinsic Value · DeepSeek V3', color: '#e8734a', avatar: '#e8734a' },
  technical: { name: 'Technical', strat: 'Price & Volume · Gemini 2.5 Flash', color: '#1fae7a', avatar: '#1fae7a' },
  conservative: { name: 'Conservative', strat: 'Capital Preservation · Claude Haiku 4.5', color: '#d84a6b', avatar: '#d84a6b' },
  skeptic: { name: 'Skeptic', strat: 'Red Team · Llama 3.3 70B', color: '#9c5cff', avatar: '#9c5cff' },
  mod: { name: 'Moderator', strat: 'Board Chair · Claude Sonnet 4.6', color: '#128c7e', avatar: '#128c7e' },
}
