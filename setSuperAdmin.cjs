const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "wcCsLXIjUXPlWqXvmKZZTP70vzr1";

async function run() {
  await admin.auth().setCustomUserClaims(uid, {
    role: "super_admin",
  });

  console.log("super_admin assigned");
}

run().catch(console.error);