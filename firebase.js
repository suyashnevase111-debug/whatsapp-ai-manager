const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function getUser(phone) {
  try {
    const doc = await db.collection("users").doc(phone).get();
    if (doc.exists) {
      return doc.data();
    }
    return { stock: {}, udhaar: {}, sales: [], history: [] };
  } catch (err) {
    console.error("Firebase getUser error:", err);
    return { stock: {}, udhaar: {}, sales: [], history: [] };
  }
}

async function saveUser(phone, data) {
  try {
    await db.collection("users").doc(phone).set(data, { merge: true });
  } catch (err) {
    console.error("Firebase saveUser error:", err);
  }
}

module.exports = { db, getUser, saveUser };