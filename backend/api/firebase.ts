import { initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore, GrpcStatus } from "firebase-admin/firestore";

/**
 * Get Firestore instance
 * Handles Firebase app initialization with reuse (avoids "app already exists" error)
 */
export function getDb() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  }

  let app;
  try {
    app = getApp(); // Try to reuse existing app
  } catch {
    app = initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
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
    if (error.code === GrpcStatus.ALREADY_EXISTS) {
      const accountSnap = await accountRef.get();
      const data = accountSnap.data() as { tier: string; login: string } | undefined;

      if (!data) {
        throw new Error("Account document exists but has no data");
      }

      return { tier: data.tier, login: data.login };
    }
    // Re-throw other errors (network, permission, etc.)
    throw error;
  }
}

/**
 * Apply a license key to a user account
 * @param userId - GitHub numeric user ID
 * @param licenseKey - License key to apply
 * @returns Success status and account data, or error message
 */
export async function applyLicenseKey(
  userId: string,
  licenseKey: string
): Promise<{ success: boolean; error?: string; tier?: string; expiresAt?: Date }> {
  const db = getDb();
  const licenseRef = db.collection("licenses").doc(licenseKey);
  const accountRef = db.collection("accounts").doc(userId);

  // Check if license exists
  const licenseSnap = await licenseRef.get();
  if (!licenseSnap.exists) {
    return { success: false, error: "Invalid license key" };
  }

  const license = licenseSnap.data() as any;

  // Check if already used
  if (license.isUsed) {
    return { success: false, error: "License key already used" };
  }

  // Check if expired
  const expiresAt = license.expiresAt?.toDate();
  if (expiresAt && expiresAt < new Date()) {
    return { success: false, error: "License key expired" };
  }

  // Apply license to user account
  await accountRef.update({
    tier: license.tier,
    licenseKey: licenseKey,
    licenseExpiresAt: license.expiresAt,
  });

  // Mark license as used
  await licenseRef.update({
    isUsed: true,
    usedBy: userId,
    usedAt: new Date(),
  });

  return {
    success: true,
    tier: license.tier,
    expiresAt: expiresAt,
  };
}
