const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Helper to verify super_admin
function checkSuperAdmin(request) {
  if (!request.auth || !request.auth.token.super_admin) {
    throw new HttpsError('permission-denied', 'Only super_admin can perform this action.');
  }
}

exports.createGym = onCall(async (request) => {
  checkSuperAdmin(request);
  
  const { email, password, name } = request.data;
  
  if (!email || !password || !name) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    // 1. Create auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Set custom claim
    await admin.auth().setCustomUserClaims(userRecord.uid, { gym_owner: true });

    // 3. Create initial gym document
    const now = new Date();
    const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
    await admin.firestore().collection('gyms').doc(userRecord.uid).set({
      name,
      ownerEmail: email,
      ownerName: name, // can be updated later
      plan: 'trial',
      status: 'active',
      planStartDate: now.toISOString(),
      planExpiryDate: expiry.toISOString(),
      createdAt: now.toISOString()
    });

    // 4. Create user document
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      gymId: userRecord.uid
    });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

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
  
  const { email } = request.data;
  if (!email) throw new HttpsError('invalid-argument', 'Missing email.');

  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    return { success: true, link };
  } catch (error) {
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
