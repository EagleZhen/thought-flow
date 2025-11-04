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
// Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
/**
 * Get the current user's GitHub user ID from VS Code auth
 * Returns the numeric GitHub user ID (immutable, unique identifier)
 */
export async function getGitHubUserId(): Promise<string | null> {
  try {
    const session = await vscode.authentication.getSession("github", ["user:email"], {
      createIfNone: true,
    });

    if (!session) {
      console.log("❌ No GitHub session found");
      return null;
    }

    console.log("✓ GitHub session found");
    console.log("  session.account.id:", session.account.id);
    console.log("  session.account.label:", session.account.label);

    // Return the user ID (immutable identifier)
    return session.account.id;
  } catch (error) {
    console.error("❌ Error getting GitHub session:", error);
    return null;
  }
}
