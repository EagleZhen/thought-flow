# License Management - Client Side

This document covers the VS Code extension's authentication and license management implementation. For backend API details, see [backend.md](backend.md).

## Authentication Flow

```
Extension Activation
    ↓
Restore from globalState (instant, offline)
    ↓
Try get existing session (createIfNone: false) ← No prompt
    ↓
Refresh from backend in background
```

**On feature use** (if no session):

1. User triggers command (e.g., "Apply License")
2. Extension calls `getGitHubSession()` with `createIfNone: true`
3. VS Code prompts for GitHub OAuth
4. Session created → Backend called → Account created/fetched

## State Management

**Implementation:** [extension/src/license.ts](../extension/src/license.ts)

### Caching Strategy

- **In-memory cache** (`cachedAccount`): Fast access during session
- **GlobalState** (`thoughtflow.account`): Persists across VS Code restarts
- **Backend refresh**: Updates cache on activation (if session exists)

### Data Structure

```typescript
interface UserAccount {
  tier: "free" | "paid";
  login: string; // GitHub username
  licenseKey?: string; // Applied key (if any)
  licenseExpiresAt?: Date; // Expiration timestamp
}
```

**Note:** GlobalState serializes `Date` objects to strings - must deserialize on restore.

## Key Functions

| Function                   | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `getGitHubSession()`       | Get OAuth session via VS Code authentication API        |
| `getOrCreateAccount()`     | Call backend to get/create account                      |
| `initializeAccountState()` | Restore from cache + background refresh (on activation) |
| `getCurrentAccount()`      | Get cached account with client-side expiration check    |
| `applyLicense()`           | Submit license key to backend                           |
| `refreshAccountState()`    | Force refresh from backend                              |
| `logout()`                 | Clear cache and globalState                             |

## Commands

Registered in [extension/src/extension.ts](../extension/src/extension.ts):

- **`thoughtflow.showAccountInfo`** - Display account tier and license status in modal
- **`thoughtflow.applyLicense`** - Prompt for license key and apply it
- **`thoughtflow.logout`** - Clear account state with confirmation dialog

## Client-Side Expiration

`getCurrentAccount()` checks expiration before returning:

```typescript
if (cachedAccount.licenseExpiresAt && cachedAccount.licenseExpiresAt < new Date()) {
  return { ...cachedAccount, tier: "free" }; // Downgrade locally
}
```

This prevents paid features from being used after expiration without requiring backend calls.

## Environment Variables

Development configuration in `extension/.env.local`:

```bash
PREVIEW_BACKEND_URL=https://thought-flow-branch-xyz.vercel.app/api
VERCEL_BYPASS_SECRET=your_bypass_token_here
```

- If `PREVIEW_BACKEND_URL` is set, extension uses preview backend
- If `VERCEL_BYPASS_SECRET` is set, adds `x-vercel-protection-bypass` header
- Production: Both undefined → uses `https://csci3100-thought-flow.vercel.app/api`

Injected via [webpack.config.js](../extension/webpack.config.js) using `dotenv-webpack`.

## Key Design Decisions

| Decision                    | Rationale                                                   |
| --------------------------- | ----------------------------------------------------------- |
| **GlobalState persistence** | Account info available offline and across restarts          |
| **createIfNone: false**     | Don't prompt on activation - only when user needs auth      |
| **Client expiration check** | Prevents backend calls on every feature use                 |
| **In-memory + disk cache**  | Balance speed (RAM) with persistence (globalState)          |
| **Background refresh**      | Update license status without blocking extension activation |
