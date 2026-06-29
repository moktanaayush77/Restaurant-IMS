# Project docs & decisions

Working notes and plans for Crafted Bistro POS. These capture decisions and
discussions that aren't obvious from the code itself.

| Doc | What it covers |
|-----|----------------|
| [item-cancellation-workflow.md](item-cancellation-workflow.md) | How a customer cancelling *part* of an order (e.g. some momos) should work — per-item cancel, push-vs-pull, kitchen confirm. |
| [realtime-and-websockets.md](realtime-and-websockets.md) | Why WebSockets, the alternatives, and why a single instance with no Redis is correct at this scale. |
| [hosting-and-deployment.md](hosting-and-deployment.md) | Free cloud stack (Render + Supabase + Cloudflare/Vercel), validated free-tier limits, LAN/Docker option, and the recommendation. |
| [known-issues-auth-token.md](known-issues-auth-token.md) | The recurring stale-token bug (couldn't take order / serve / edit menu) and the proposed fix. |
| [open-decisions.md](open-decisions.md) | Decisions still open: deployment target, cancellation policy, the Accountant role. |
| [../PRODUCTION_READINESS_PLAN.md](../PRODUCTION_READINESS_PLAN.md) | Full code-level production hardening plan (security, CI/CD, tests, ops). |

*Last updated: 2026-06-16.*
