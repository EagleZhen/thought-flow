import { getOrCreateAccount } from "./firebase";

/**
 * Verify GitHub OAuth token is valid and belongs to the claimed user
 * @param githubToken - GitHub OAuth access token (from VS Code auth provider)
 * @param userId - Claimed GitHub user ID (numeric string)
 * @returns GitHub user data { id, login } if valid and matches userId, null otherwise
 */
async function verifyGitHubToken(
  githubToken: string,
  userId: string
): Promise<{ id: number; login: string } | null> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "ThoughtFlow",
      },
    });

    if (!response.ok) {
      return null; // Token is invalid or expired
    }

    const githubUser = (await response.json()) as { id: number; login: string };

    // Verify ID matches claimed userId
    if (githubUser.id.toString() !== userId) {
      return null; // ID mismatch - token doesn't belong to claimed user
    }

    return githubUser; // Return both id and login
  } catch (error) {
    console.error("GitHub verification error:", error);
    return null; // Network or parsing error
  }
}

export default async function handler(req: any, res: any) {
  try {
    // Validate request body exists
    const body = req.body as { userId?: string; githubToken?: string } | undefined;
    if (!body) {
      return res.status(400).json({ error: "Request body is required" });
    }

    // Extract and validate required fields
    const { userId, githubToken } = body;
    if (!userId || !githubToken) {
      return res.status(400).json({ error: "Missing userId or githubToken" });
    }

    // Verify GitHub token is valid and matches userId
    // Returns GitHub user data if valid, null otherwise
    const githubUser = await verifyGitHubToken(githubToken, userId);
    if (!githubUser) {
      return res.status(401).json({ error: "Invalid GitHub token" });
    }

    // Token is valid - get or create account with GitHub username
    const account = await getOrCreateAccount(userId, githubUser.login);
    return res.json(account);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Request error:", errorMessage);
    return res.status(500).json({ error: "Internal server error" });
  }
}
