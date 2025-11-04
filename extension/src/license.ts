// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAXQmIxOGQ5Szxnh6v1uxKxt4D52T1rO8I",
  authDomain: "csci3100-thought-flow.firebaseapp.com",
  projectId: "csci3100-thought-flow",
  storageBucket: "csci3100-thought-flow.firebasestorage.app",
  messagingSenderId: "312181637733",
  appId: "1:312181637733:web:027af76fec415bdc96bc8c",
  measurementId: "G-92KX2F49TV",
};

import * as vscode from "vscode";
import type { FirebaseApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

let app: FirebaseApp | null = null;

/**
 * Initialize Firebase lazily (singleton pattern)
 * Returns the same Firebase app instance on subsequent calls
 */
function initializeFirebaseApp(): FirebaseApp {
  if (app) {
    return app;
  }
  app = initializeApp(firebaseConfig);
  getAnalytics(app);
  return app;
}

/**
 * Get GitHub user session (both ID and username)
 * userId: numeric GitHub ID (immutable)
 * userName: GitHub username (can change, for display only)
 */
export async function getGitHubSession(): Promise<{
  userId: string;
  userName: string;
} | null> {
  try {
    const session = await vscode.authentication.getSession("github", ["user:email"], {
      createIfNone: true,
    });

    if (!session) {
      return null;
    }

    return {
      userId: session.account.id,
      userName: session.account.label,
    };
  } catch (error) {
    console.error("❌ Error getting GitHub session:", error);
    return null;
  }
}

/**
 * Get or create an account in Firestore
 * If account doesn't exist, creates one with free tier and core features
 */
export async function getOrCreateAccount(
  userId: string,
  userName: string
): Promise<{ tier: "free" | "paid"; features: string[] } | null> {
  try {
    const db = getFirestore(initializeFirebaseApp());
    const accountRef = doc(db, "accounts", userId);
    const accountDoc = await getDoc(accountRef);

    if (accountDoc.exists()) {
      const data = accountDoc.data();
      return {
        tier: data.tier,
        features: data.features,
      };
    }

    // Create new account with free tier and core features if not exists
    const newAccount = {
      tier: "free",
      features: ["core"],
      userName,
      createdAt: serverTimestamp(),
    };

    await setDoc(accountRef, newAccount);
    return {
      tier: "free",
      features: ["core"],
    };
  } catch (error) {
    console.error("❌ Error getting or creating account:", error);
    return null;
  }
}
