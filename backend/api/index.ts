import { initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export default async function handler(req: any, res: any) {
  try {
    try {
    let app;
    try {
      app = getApp(); // Avoid re-initialization
    } catch {
      app = initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
      });
    }

    const db = getFirestore(app);
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
