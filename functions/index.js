const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const corsOrigins = [
  "http://localhost:5173",
  /localhost:\d+/,
  /.*\.vercel\.app/
];

setGlobalOptions({ 
  maxInstances: 10,
  region: "us-central1",
  invoker: "public",
  cors: corsOrigins
});

// Helper to verify super_admin
function checkSuperAdmin(request) {
  if (!request.auth || request.auth.token.role !== "super_admin") {
    console.error("Auth check failed:", request.auth?.token);
    throw new HttpsError('permission-denied', 'Only super_admin can perform this action.');
  }
}


exports.disableGym = onCall(async (request) => {
  checkSuperAdmin(request);
  
  const { uid, disabled } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'Missing uid.');

  try {
    // Only update the Firestore status field to control app access, 
    // keeping Firebase Authentication active as requested for the MVP.
    await admin.firestore().collection('gyms').doc(uid).update({
      status: disabled ? 'disabled' : 'active'
    });
    return { success: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

exports.resetGymPassword = onCall(async (request) => {
  checkSuperAdmin(request);
  
  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'Missing uid.');

  try {
    // 1. Fetch real Auth user
    let authUser;
    try {
      authUser = await admin.auth().getUser(uid);
    } catch (authErr) {
      console.error(`[resetGymPassword] Auth user not found for uid ${uid}:`, authErr);
      throw new HttpsError('not-found', 'Firebase Auth user not found for this gym.');
    }

    if (!authUser.email) {
      console.error(`[resetGymPassword] Auth user has no email for uid ${uid}`);
      throw new HttpsError('failed-precondition', 'Auth user does not have an email address.');
    }

    const authEmail = authUser.email;

    // 2. Generate reset link using the verified Auth email
    let link;
    try {
      link = await admin.auth().generatePasswordResetLink(authEmail);
    } catch (linkErr) {
      console.error(`[resetGymPassword] Failed to generate link for ${authEmail}:`, linkErr);
      throw new HttpsError('internal', 'Unable to create the email action link.');
    }

    // 3. Self-heal Firestore if mismatched
    try {
      const gymRef = admin.firestore().collection('gyms').doc(uid);
      const gymSnap = await gymRef.get();
      if (gymSnap.exists) {
        const gymData = gymSnap.data();
        if (gymData.email !== authEmail || gymData.ownerEmail !== authEmail) {
          console.warn(`[resetGymPassword] Mismatch detected for ${uid}. Syncing Firestore email to ${authEmail}`);
          await gymRef.update({ 
            email: authEmail,
            ...(gymData.ownerEmail !== undefined ? { ownerEmail: authEmail } : {})
          });

          // Also sync users collection if it exists
          const userRef = admin.firestore().collection('users').doc(uid);
          const userSnap = await userRef.get();
          if (userSnap.exists) {
            await userRef.update({ email: authEmail });
          }
        }
      }
    } catch (syncErr) {
      console.error(`[resetGymPassword] Non-fatal error syncing Firestore email for ${uid}:`, syncErr);
    }

    return { success: true, link };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});

exports.forceResetGymPassword = onCall(async (request) => {
  checkSuperAdmin(request);
  
  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'Missing uid.');

  try {
    // 1. Fetch real Auth user
    let authUser;
    try {
      authUser = await admin.auth().getUser(uid);
    } catch (authErr) {
      console.error(`[forceResetGymPassword] Auth user not found for uid ${uid}:`, authErr);
      throw new HttpsError('not-found', 'Firebase Auth user not found for this gym.');
    }

    // 2. Generate secure temporary password (12 chars: 8 hex + 4 random special/upper)
    const tempPassword = crypto.randomBytes(4).toString('hex') + 'Xy!9';

    // 3. Update Auth password directly
    await admin.auth().updateUser(uid, { password: tempPassword });

    // 4. Set mustChangePassword flag in Firestore
    const gymRef = admin.firestore().collection('gyms').doc(uid);
    await gymRef.update({ mustChangePassword: true });

    return { 
      success: true, 
      tempPassword, 
      authEmail: authUser.email 
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});

exports.deleteGym = onCall(async (request) => {
  checkSuperAdmin(request);
  
  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'Missing uid.');

  try {
    await admin.auth().deleteUser(uid);
    // Optionally delete or mark the gym document as deleted
    await admin.firestore().collection('gyms').doc(uid).update({
      status: 'deleted',
      deletedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

exports.dailyExpiryNotifier = onSchedule({ schedule: "0 9 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
  try {
    const gymsSnapshot = await admin.firestore().collection('gyms').get();
    
    // YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    // Iterate through all gyms
    for (const gymDoc of gymsSnapshot.docs) {
      const gymData = gymDoc.data();
      const gymId = gymDoc.id;
      
      // If the gym doesn't have an FCM token registered, skip
      if (!gymData.fcmToken) continue;
      
      const membersRef = admin.firestore().collection('gyms').doc(gymId).collection('members');
      
      // Query members where expiry_date matches today exactly
      const expiredMembersSnap = await membersRef.where('expiry_date', '==', todayStr).get();
      
      const count = expiredMembersSnap.size;
      
      if (count > 0) {
        const title = 'Membership Expiry Alert';
        const body = `${count} ${count === 1 ? 'member' : 'members'} expired today`;
        
        const message = {
          notification: { title, body },
          token: gymData.fcmToken
        };
        
        try {
          await admin.messaging().send(message);
          console.log(`Successfully sent expiry notification to gym ${gymId} for ${count} members.`);
        } catch (msgErr) {
          console.error(`Failed to send FCM to gym ${gymId}:`, msgErr);
        }
      }
    }
  } catch (error) {
    console.error("dailyExpiryNotifier encountered an error:", error);
  }
});
