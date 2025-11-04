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
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

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
