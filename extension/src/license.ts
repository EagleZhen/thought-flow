import * as vscode from "vscode";

const BACKEND_URL = "https://csci3100-thought-flow.vercel.app/api";

/**
 * User account info from backend
 */
export interface UserAccount {
  tier: "free" | "paid";
  login: string;
}

/**
 * Get GitHub user session (both ID and username)
 * userId: numeric GitHub ID (immutable)
 * userName: GitHub username (can change, for display only)
 */
export async function getGitHubSession(): Promise<vscode.AuthenticationSession | null> {
  try {
    const session = await vscode.authentication.getSession("github", ["user:email"], {
      createIfNone: true,
    });

    if (!session) {
      return null;
    }

    return session;
  } catch (error) {
    console.error("❌ Error getting GitHub session:", error);
    return null;
  }
}

/**
 * Get or create user account in backend database
 * @param session - GitHub authentication session
 * @returns User account info (tier and login) or null if failed
 */
export async function getOrCreateAccount(
  session: vscode.AuthenticationSession
): Promise<UserAccount | null> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: session.account.id,
        githubToken: session.accessToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend error (${response.status}):`, errorText);
      return null;
    }

    const account = (await response.json()) as UserAccount;
    console.log(`✅ User account: ${account.login} (${account.tier})`);
    return account;
  } catch (error) {
    console.error("❌ Error calling backend:", error);
    return null;
  }
}
