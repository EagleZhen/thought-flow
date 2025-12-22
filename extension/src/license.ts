import * as vscode from "vscode";

// Use preview backend URL if set in environment, otherwise use production
const BACKEND_URL = process.env.PREVIEW_BACKEND_URL || "https://csci3100-thought-flow.vercel.app/api";
const VERCEL_BYPASS_SECRET = process.env.VERCEL_BYPASS_SECRET;

/**
 * Get fetch headers with Vercel bypass if needed
 */
function getFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add Vercel protection bypass header if secret is available
  if (VERCEL_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = VERCEL_BYPASS_SECRET;
  }

  return headers;
}

/**
 * User account info from backend
 */
export interface UserAccount {
  tier: "free" | "paid";
  login: string;
  licenseKey?: string;
  licenseExpiresAt?: Date;
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

    // Parse and validate response
    const data = (await response.json()) as any;
    if (!data || typeof data.tier !== "string" || typeof data.login !== "string") {
      console.error("❌ Invalid response from backend - missing or invalid fields:", data);
      return null;
    }

    // Validate tier value
    if (data.tier !== "free" && data.tier !== "paid") {
      console.error(`❌ Invalid tier value from backend: ${data.tier}`);
      return null;
    }

    const account: UserAccount = {
      tier: data.tier as "free" | "paid",
      login: data.login,
      licenseKey: data.licenseKey,
      licenseExpiresAt: data.licenseExpiresAt ? new Date(data.licenseExpiresAt) : undefined,
    };
    console.log(`✅ User account: ${account.login} (${account.tier})`);
    return account;
  } catch (error) {
    console.error("❌ Error calling backend:", error);
    return null;
  }
}

/**
 * Apply a license key to the user's account
 * @param session - GitHub authentication session
 * @param licenseKey - License key to apply
 * @returns Success status and updated account info, or error message
 */
export async function applyLicense(
  session: vscode.AuthenticationSession,
  licenseKey: string
): Promise<{ success: boolean; error?: string; tier?: string; expiresAt?: Date }> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "applyLicense",
        userId: session.account.id,
        githubToken: session.accessToken,
        licenseKey: licenseKey.trim().toUpperCase(), // Normalize key format
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as any;
      console.error(`❌ Backend error (${response.status}):`, errorData.error);
      return { success: false, error: errorData.error || "Failed to apply license" };
    }

    const result = (await response.json()) as any;
    console.log(`✅ License applied: ${result.tier}`);
    return {
      success: true,
      tier: result.tier,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
    };
  } catch (error) {
    console.error("❌ Error applying license:", error);
    return { success: false, error: "Network error" };
  }
}
