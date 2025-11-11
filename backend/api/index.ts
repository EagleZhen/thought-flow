import { getDb } from "./firebase";

/**
 * Verify GitHub OAuth token is valid and belongs to the claimed user
 * @param githubToken - GitHub OAuth access token (from VS Code auth provider)
 * @param userId - Claimed GitHub user ID (numeric string)
 * @returns true if token is valid and matches userId, false otherwise
 */
async function verifyGitHubToken(githubToken: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "ThoughtFlow",
      },
    });

    if (!response.ok) {
      return false; // Token is invalid or expired
    }

    const githubUser = (await response.json()) as { id: number };
    return githubUser.id.toString() === userId; // Verify ID matches
  } catch (error) {
    console.error("GitHub verification error:", error);
    return false; // Network or parsing error
  }
}

export default async function handler(req: any, res: any) {
  try {
    const db = getDb();
    const testDoc = await db.collection("accounts").doc("test").get();

    return res.json({
      message: "Firebase works!",
      testDocExists: testDoc.exists,
      data: testDoc.data(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: errorMessage });
  }
}
