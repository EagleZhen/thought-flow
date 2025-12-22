# Backend - License Management API

## Architecture

```
Extension          Vercel Backend         GitHub API         Firestore
    |                     |                     |                 |
    |--POST /api--------->|                     |                 |
    | (userId + token)    |                     |                 |
    |                     |--Verify Token------>|                 |
    |                     |<--{id, login}-------|                 |
    |                     |                                       |
    |                     |--Get/Create Account or Apply License->|
    |                     |<--Account Data------------------------|
    |                     |                                       |
    |<--Account/License---|                     |                 |
    |                     |                     |                 |
```

The extension calls a single endpoint on Vercel. The backend:

1. Verifies the GitHub token is valid and matches the user ID (via GitHub API)
2. Performs the requested action (get account or apply license) using Firestore
3. Returns user's license tier, GitHub username, and license details

---

## API Endpoint

**URL:** `https://csci3100-thought-flow.vercel.app/api`

### Get or Create Account

**Request (POST):**

```json
{
  "userId": "31062364",
  "githubToken": "gho_xxx..."
}
```

**Response (200):**

```json
{
  "tier": "free",
  "login": "octocat",
  "licenseKey": "ABCD-1234-EFGH-5678", // Only if license applied
  "licenseExpiresAt": "2026-12-31T23:59:59Z" // Only if license applied
}
```

### Apply License Key

**Request (POST):**

```json
{
  "action": "applyLicense",
  "userId": "31062364",
  "githubToken": "gho_xxx...",
  "licenseKey": "PAID-0001-2025-1222"
}
```

**Response (200):**

```json
{
  "success": true,
  "tier": "paid",
  "expiresAt": "2026-12-22T00:00:00Z"
}
```

### Error Responses

- `400` - Bad request (missing fields, invalid license, expired license, license already used)
- `401` - Invalid GitHub token or user ID mismatch
- `405` - Wrong HTTP method
- `500` - Server error

---

## Implementation

**Files:**

- `backend/api/index.ts` - HTTP handler, GitHub token verification, request routing
- `backend/api/firebase.ts` - Firestore operations (accounts & licenses)

**Key Patterns:**

- **Token verification**: Calls [GitHub Users API](https://docs.github.com/en/rest/users/users) (`https://api.github.com/user` endpoint) to validate token and verify ID match
- **Get-or-create**: Attempts `create()`, falls back to `get()` on `ALREADY_EXISTS` error
- **License validation**: Atomic transaction checks expiration → usage → updates both collections
- **Reapplication allowed**: Same user can re-enter their key (checked via `usedBy !== userId`)

---

## Database Schema

### Collection: `accounts`

**Document ID:** GitHub user ID (numeric)

```typescript
{
  createdAt: Timestamp; // Account creation time
  githubUserId: string; // GitHub user ID (immutable)
  licenseKey: string | null; // Applied license key (if any)
  licenseExpiresAt: Timestamp | null; // License expiration
  login: string; // GitHub username
  tier: "free" | "paid"; // Current license tier
}
```

### Collection: `licenses`

**Document ID:** License key (e.g., "PAID-0001-2025-1222")

```typescript
{
  expiresAt: Timestamp; // Expiration date
  isUsed: boolean; // Whether key has been used
  tier: "free" | "paid"; // License tier
  usedAt: Timestamp | null; // When it was used
  usedBy: string | null; // GitHub user ID who used it
}
```

**Security Rules:** `allow read, write: if false;` - Only backend service account can access.

**Why Firestore?**

- **Serverless-friendly**: Works perfectly with Vercel's stateless functions
- **Secure**: Service account authentication prevents direct client access
- **Simple**: NoSQL schema matches our needs (no complex relationships)
- **Concurrent-safe**: Built-in atomic operations and transactions

---

## License Application Flow

1. **Verify license exists** in `licenses` collection
2. **Check expiration** - Reject if expired
3. **Check usage** - Reject if used by another user (same user can re-apply)
4. **Atomic transaction**:
   - Update `accounts/{userId}` with tier and license info
   - Mark license as used in `licenses/{licenseKey}`

---

## Deployment

**Platform:** Vercel (Node.js 18.x serverless functions)

**Environment Variables** (set in Vercel dashboard: Settings → Environment Variables)

- `FIREBASE_SERVICE_ACCOUNT` - Firebase Admin SDK credentials (JSON, single-line)
- `VERCEL_BYPASS_SECRET` - Protection bypass token (for preview deployments)

The backend auto-deploys via GitHub integration. Different branches deploy to different environments:

### Production (main branch)

**Deployment:** Push to `main` → auto-deploy to production  
**URL:** `https://csci3100-thought-flow.vercel.app/api`  
**Protection:** None - publicly accessible  
**Extension config:** No configuration needed (default URL)

### Preview (feature branches)

**Deployment:** Push to any branch → auto-deploy to unique preview URL  
**URL:** `https://thought-flow-{branch}-{hash}.vercel.app/api` (find in Vercel dashboard or PR comments)  
**Protection:** Requires `x-vercel-protection-bypass` header  
**Extension config:**

```bash
# extension/.env.local
PREVIEW_BACKEND_URL=https://thought-flow-branch-xyz.vercel.app/api
VERCEL_BYPASS_SECRET=your_bypass_token_here
```

The extension automatically uses preview URL when `PREVIEW_BACKEND_URL` is set, and includes the bypass header when `VERCEL_BYPASS_SECRET` is provided.

---

## Testing

### With Extension

1. For production: No configuration needed
2. For preview: Set `PREVIEW_BACKEND_URL` and `VERCEL_BYPASS_SECRET` in `extension/.env.local`
3. Rebuild extension: `npm run watch` (or `npm run compile` for one-time build)
4. Reload VS Code window
5. Test features (sign in, apply license, etc.)

### With curl

```bash
# Production
curl -X POST https://csci3100-thought-flow.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{"userId": "YOUR_GITHUB_ID", "githubToken": "YOUR_TOKEN"}'

# Preview (requires bypass header)
curl -X POST https://thought-flow-branch-xyz.vercel.app/api \
  -H "Content-Type: application/json" \
  -H "x-vercel-protection-bypass: YOUR_BYPASS_TOKEN" \
  -d '{"userId": "YOUR_GITHUB_ID", "githubToken": "YOUR_TOKEN"}'
```

**View logs:** Vercel Dashboard → Deployments → Select the specific deployment → Logs

---

## Key Design Decisions

| Decision                    | Rationale                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| **Single /api endpoint**    | Simpler than multiple endpoints; action parameter routes requests |
| **Vercel over Cloudflare**  | Firebase Admin SDK requires Node.js runtime                       |
| **GitHub user ID as key**   | Immutable identifier prevents account spoofing                    |
| **Transaction for license** | Ensures atomicity; prevents double-assignment race conditions     |
| **Check expiry first**      | Better UX - users see "expired" instead of "already used"         |
| **Allow re-application**    | Same user can re-enter their own key without errors               |
