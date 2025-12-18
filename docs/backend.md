# Backend - License Management API

## Architecture

```
VS Code Extension          Vercel Backend           Firebase Firestore
       |                        |                           |
       |--POST /api------------>|                           |
       | (userId + token)       |                           |
       |                        |--Verify Token------------>|
       |                        | (GitHub API)              |
       |                        |                           |
       |                        |--Get/Create Account------>|
       |                        |                           |
       |<--{tier, login}--------|                           |
       |
```

The extension calls a single endpoint on Vercel. The backend:
1. Verifies the GitHub token is valid and matches the user ID
2. Checks if user exists in Firestore; creates new account if not
3. Returns user's license tier and GitHub username

---

## API Endpoint

**URL:** `https://csci3100-thought-flow.vercel.app/api`

**Request (POST):**
```json
{
  "userId": <a numeric GitHub user ID as a string>,
  "githubToken": "gho_xxx..."
}
```

**Response (200):**
```json
{
  "tier": "free",
  "login": "octocat"
}
```

**Error Responses:**
- `400` - Bad request (missing/invalid fields)
- `401` - Invalid token or user ID mismatch
- `405` - Wrong HTTP method
- `500` - Server error

---

## Implementation

**Files:**
- `backend/api/index.ts` - HTTP handler, GitHub API verification, orchestration
- `backend/api/firebase.ts` - Firestore initialization and account operations

**Key Pattern:** Uses Firestore's `create()` method with error handling to safely handle concurrent get-or-create requests.

---

## Database

**Firestore Collection:** `accounts`
**Document ID:** GitHub user ID (immutable, prevents spoofing)

Schema:
```typescript
{
  githubUserId: string;      // Reference to GitHub user ID
  login: string;             // GitHub username (from API response)
  tier: "free" | "paid";     // License tier
  createdAt: Timestamp;      // Account creation time
}
```

**Security:** `allow read, write: if false;` - Only backend (service account) can access.

---

## Deployment

**Platform:** Vercel (Node.js serverless)

**Environment Variable:**
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON (single-line format)

Set in Vercel dashboard: Settings → Environment Variables

---

## Development & Testing

**Test the endpoint:**
```bash
curl -X POST https://csci3100-thought-flow.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{"userId": "31062364", "githubToken": "ghu_..."}'
```

**View logs:**
Vercel dashboard → Deployments → Recent deployment → Functions → api

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Vercel** | Firebase Admin SDK needs Node.js (Cloudflare Workers don't have it) |
| **Firestore** | Secure (service account only), simple schema, handles concurrent writes |
| **Numeric GitHub ID** | Immutable, perfect document key |
| **Single /api endpoint** | Simple, stateless, all logic in one place |
