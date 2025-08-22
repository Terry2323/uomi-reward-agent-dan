# Dani — UOMI Reward Agent (WASP-ready)

Rewards users in **UOMI** for milestones:
- First faucet claim → 10 UOMI
- Daily active → 5 UOMI

## Quick steps (phone-friendly)

1. Create repo `uomi-reward-agent-dani` on GitHub.
2. Add files exactly as provided (`package.json`, `src/agent.ts`, `.gitignore`, etc.)
3. Deploy to Railway (steps below).

## Notes
- Script runs in **simulation** by default so it always starts and prints reward logs.
- To enable real rewards, install the WASP SDK (`@uomi/wasp` or package name from docs) and add any required private keys as Railway env variables.
