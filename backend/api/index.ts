import { getDb } from "./firebase";

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
