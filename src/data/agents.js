// The board — keys match what the backend emits.
// These are the REAL council seats: five different investing lenses, each run
// by a different model family, deliberating over a real Alpaca paper account.
export const AGENTS = {
  aggressive: { name: 'The Aggressive', strat: 'Asymmetric Upside · GPT-4.1 mini', color: '#2b9bd8', avatar: '#2b9bd8' },
  value: { name: 'The Value Seat', strat: 'Intrinsic Value · DeepSeek V3', color: '#e8734a', avatar: '#e8734a' },
  technical: { name: 'The Technical', strat: 'Price & Volume · Gemini 2.5 Flash', color: '#1fae7a', avatar: '#1fae7a' },
  conservative: { name: 'The Conservative', strat: 'Capital Preservation · Claude Haiku 4.5', color: '#d84a6b', avatar: '#d84a6b' },
  skeptic: { name: 'The Skeptic', strat: 'Red Team · Llama 3.3 70B', color: '#9c5cff', avatar: '#9c5cff' },
  mod: { name: 'The Moderator', strat: 'Board Chair · Claude Sonnet 4.6', color: '#128c7e', avatar: '#128c7e' },
}
