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
 * @param userId - GitHub numeric user ID
 * @param userName - GitHub username
 * @returns Account data with tier and userName
 */
export async function getOrCreateAccount(
  userId: string,
  userName: string
): Promise<{ tier: string; userName: string }> {
  const db = getDb();
  const accountRef = db.collection("accounts").doc(userId);
  const accountSnap = await accountRef.get();

  // Account exists - return it
  if (accountSnap.exists) {
    const data = accountSnap.data() as { tier: string; userName: string };
    return { tier: data.tier, userName: data.userName };
  }

  // New account - create with free tier
  await accountRef.set({
    githubUserId: userId,
    userName: userName,
    tier: "free",
    createdAt: new Date(),
  });

  return { tier: "free", userName: userName };
}
