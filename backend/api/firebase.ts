import { initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Get Firestore instance
 * Handles Firebase app initialization with reuse (avoids "app already exists" error)
 */
export function getDb() {
  let app;
  try {
    app = getApp(); // Try to reuse existing app
  } catch {
    app = initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
    });
  }
  return getFirestore(app);
}

/**
 * Get existing account or create new one with free tier
 * @param userId - GitHub numeric user ID (as string)
 * @param login - GitHub username (login field)
 * @returns Account data with tier and login
 */
export async function getOrCreateAccount(
  userId: string,
  login: string
): Promise<{ tier: string; login: string }> {
  const db = getDb();
  const accountRef = db.collection("accounts").doc(userId);

  try {
    // Try to create new account
    await accountRef.create({
      githubUserId: userId,
      login: login,
      tier: "free",
      createdAt: new Date(),
    });
    return { tier: "free", login };
  } catch (error: any) {
    // Document already exists - read and return it
    if (error.code === "ALREADY_EXISTS") {
      const accountSnap = await accountRef.get();
      const data = accountSnap.data() as { tier: string; login: string };
      return { tier: data.tier, login: data.login };
    }
    // Re-throw other errors (network, permission, etc.)
    throw error;
  }
}
