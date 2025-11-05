# Cloudflare Workers Experiment

## What Was This?
Testing Cloudflare Workers as the backend for ThoughtFlow's user/license management system.

## What We Tried
1. **firebase-admin SDK** - Tried to use official Firebase SDK with `nodejs_compat` flag
2. **Firestore REST API** - Planned manual JWT creation to exchange for access tokens

## What We Learned

### ❌ Didn't Work
- Firebase-admin SDK incompatible with Workers:
  - Requires Node.js APIs (gRPC, streams, child_process, fs)
  - `nodejs_compat` flag insufficient
  - Security policy blocks dynamic code generation (`EvalError`)
  - Even with compatibility flags, fundamental architecture mismatch

### ✅ What Worked
- Basic Worker deployment and routing
- Environment variables via `.dev.vars`
- Service account JSON storage and gitignore

## Why We Abandoned It
Workers are designed for **edge computing** (lightweight, fast responses), but Firebase-admin SDK expects a **Node.js server environment** (full OS access). Mismatch was too fundamental.

Better approach: **Vercel** (Node.js platform where firebase-admin works natively).

## Commands

```bash
# Install dependencies
npm install

# Run locally (http://localhost:8787)
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Key Takeaway
Not every platform is suitable for every use case. Cloud platforms have architectural assumptions - know them before committing.

**Status:** Archived. Logic moved to `/backend` (Vercel).
