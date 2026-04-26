const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const uid = "HGP11KrX0eREsX88mdmn8SAZy8m1";

async function run() {
    await admin.auth().setCustomUserClaims(uid, {
        role: "gym_owner",
    });

    console.log("gym_owner assigned");
}

run().catch(console.error);