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
  const accountSnap = await accountRef.get();

  // Account exists - return it
  if (accountSnap.exists) {
    const data = accountSnap.data() as { tier: string; login: string };
    return { tier: data.tier, login: data.login };
  }

  // New account - create with free tier
  await accountRef.set({
    githubUserId: userId,
    login: login,
    tier: "free",
    createdAt: new Date(),
  });

  return { tier: "free", login: login };
}
