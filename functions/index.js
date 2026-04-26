const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

// Helper to verify super_admin
function checkSuperAdmin(request) {
  if (!request.auth || request.auth.token.role !== "super_admin") {
    console.error("Auth check failed:", request.auth?.token);
    throw new HttpsError('permission-denied', 'Only super_admin can perform this action.');
  }
}

exports.createGym = onCall(async (request) => {
  checkSuperAdmin(request);
  
  const { email, password, name } = request.data;
  console.log("Create Gym called with:", { email, name });
  
  if (!email || !password || !name) {
    throw new HttpsError('invalid-argument', 'Missing required fields: email, password, and gym name are required.');
  }

  try {
    // 1. Create auth user
    console.log("Creating auth user...");
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
    console.log("Auth user created:", userRecord.uid);

    // 2. Set custom claim
    console.log("Setting custom claims...");
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "gym_owner" });
    console.log("Custom claims set: { role: 'gym_owner' }");

    // 3. Create initial gym document
    console.log("Creating gym document...");
    const now = new Date();
    const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
    await admin.firestore().collection('gyms').doc(userRecord.uid).set({
      gymName: name,
      ownerName: name,
      email: email,
      phone: "", // placeholder
      plan: 'trial',
      status: 'active',
      planStartDate: now.toISOString(),
      planExpiryDate: expiry.toISOString(),
      createdAt: now.toISOString()
    });
    console.log("Gym document created.");

    // 4. Create user document
    console.log("Creating user document...");
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      gymId: userRecord.uid
    });
    console.log("User document created.");

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Error creating gym:", error);
    
    // Handle specific Auth errors
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'This email is already registered to another gym.');
    }
    if (error.code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'The password is too weak or invalid.');
    }
    if (error.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'The email address is invalid.');
    }

    throw new HttpsError('internal', error.message || 'An unexpected error occurred while creating the gym.');
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
