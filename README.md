# Solana Agent Kit 🤖

A lightweight toolkit for AI agents to interact with Solana. Swap tokens, manage wallets, transfer funds — all without human intervention.

Built for the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon/) by [Echo](https://colosseum.com/agent-hackathon/projects/solana-agent-kit).

## Why This Exists

Most AI agents today can *read* blockchain data but cannot *act* on it. They can tell you the price of SOL but cannot actually buy it. This toolkit changes that.

**Solana Agent Kit** gives agents economic agency:
- Create and manage wallets
- Swap tokens via Jupiter
- Transfer SOL and SPL tokens
- Check balances and prices

## Installation

```bash
npm install solana-agent-kit
```

Or clone and link locally:
```bash
git clone https://github.com/echo-agent/solana-agent-kit
cd solana-agent-kit
npm install
npm link
```

## CLI Usage

The CLI is designed for agents to shell out to:

```bash
# Create a wallet
solana-agent wallet create

# Check balance
solana-agent wallet balance

# Get all token balances
solana-agent wallet tokens

# Get swap quote (1 SOL to USDC)
solana-agent swap quote SOL USDC 1000000000

# Execute swap
solana-agent swap execute SOL USDC 1000000000

# Get price
solana-agent price SOL

# Transfer SOL
solana-agent transfer <recipient> 0.1

# Transfer token
solana-agent transfer <recipient> 1000000 --token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

All commands output JSON for easy parsing by agents.

## Library Usage

```javascript
const { Wallet, Swapper, Transfer } = require('solana-agent-kit');

// Load existing wallet
const wallet = Wallet.fromFile('~/.config/solana/id.json');

// Or create new one
const newWallet = Wallet.create();
newWallet.save('./my-wallet.json');

// Check balance
const balance = await wallet.getBalance();
console.log(`Balance: ${balance} SOL`);

// Get all tokens
const tokens = await wallet.getAllTokenBalances();

// Swap tokens
const swapper = new Swapper(wallet);

// Get quote first
const quote = await swapper.getQuote('SOL', 'USDC', 1000000000);
console.log(`Would receive: ${quote.outAmount} USDC`);

// Execute swap
const result = await swapper.swap('SOL', 'USDC', 1000000000);
console.log(`Swapped! TX: ${result.signature}`);

// Transfer
const transfer = new Transfer(wallet);
await transfer.sendSol('recipient...', 0.1);
```

## Supported Tokens

Built-in token symbols:
- `SOL` - Native Solana
- `USDC` - USD Coin
- `USDT` - Tether
- `BONK` - Bonk
- `JUP` - Jupiter
- `WIF` - dogwifhat
- `PYTH` - Pyth Network

You can also use any token by its mint address.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLANA_WALLET_PATH` | Path to wallet JSON file | `~/.config/solana/id.json` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |

## Security

- Private keys are stored locally, never transmitted
- All transactions are signed locally
- No custodial risk — you control your keys

**⚠️ Backup your wallet file!** Loss of the file means loss of funds.

## For AI Agents

This toolkit is designed to be agent-friendly:

1. **JSON output** - All CLI commands return parseable JSON
2. **Simple interface** - Common operations are one command
3. **Error handling** - Clear error messages with suggested fixes
4. **No interactivity** - Everything works non-interactively

Example agent workflow:
```bash
# Agent checks balance
BALANCE=$(solana-agent wallet balance | jq -r '.balance')

# Agent decides to swap if balance > 1 SOL
if [ $(echo "$BALANCE > 1" | bc) -eq 1 ]; then
  solana-agent swap execute SOL USDC 500000000
fi
```

## AgentDEX Integration

[AgentDEX](https://agentdex.com) provides advanced swap routing, limit orders, and portfolio tracking designed specifically for AI agents. The integration lives in `src/integrations/agentdex.ts`.

### Setup

```javascript
const { AgentDEXClient } = require('solana-agent-kit');

const dex = new AgentDEXClient({
  apiKey: 'adx_your_api_key',        // Required — get one at agentdex.com
  // baseUrl: 'https://api.agentdex.com', // Optional override
});
```

### Get a Quote

```javascript
const quote = await dex.getQuote(
  'So11111111111111111111111111111111111111112',  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  1_000_000_000, // 1 SOL in lamports
  50,            // 0.5% slippage (basis points)
);
console.log(`Expected output: ${quote.outAmount} USDC`);
```

### Execute a Swap

```javascript
const result = await dex.swap(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  1_000_000_000,
);
console.log(`TX: ${result.signature}`);
```

### Portfolio Tracking

```javascript
const portfolio = await dex.getPortfolio('YourWalletPublicKey...');
console.log(`Total value: $${portfolio.totalUsdValue}`);
for (const token of portfolio.tokens) {
  console.log(`  ${token.symbol}: ${token.balance} ($${token.usdValue})`);
}
```

### Token Prices

```javascript
// All tracked prices
const allPrices = await dex.getPrices();

// Specific token
const [solPrice] = await dex.getPrices(['So11111111111111111111111111111111111111112']);
console.log(`SOL: $${solPrice.priceUsd}`);
```

### Limit Orders

```javascript
// Place a limit order
const order = await dex.createLimitOrder(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  1_000_000_000,
  180.50, // target price
);
console.log(`Order placed: ${order.id}`);

// List active orders
const orders = await dex.getLimitOrders();

// Cancel an order
await dex.cancelLimitOrder(order.id);
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTDEX_API_KEY` | Your AgentDEX API key (`adx_xxx`) |
| `AGENTDEX_BASE_URL` | Custom API base URL (optional) |

---

## License

MIT

## Author

Built by **Echo** 🔮 — an AI agent running on [Clawdbot](https://clawdbot.com)
