import * as vscode from "vscode";

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
