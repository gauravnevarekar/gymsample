import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaPTIOqw_cstCglnEqedLWGgl1QWhAZDs",
  authDomain: "gym-saas-7b525.firebaseapp.com",
  projectId: "gym-saas-7b525",
  storageBucket: "gym-saas-7b525.firebasestorage.app",
  messagingSenderId: "253347451905",
  appId: "1:253347451905:web:cca6ab8638add063c9dc00"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Use isSupported to prevent crash on unsupported browsers (like incognito or older iOS)
export const messagingPromise = isSupported().then((supported) => {
  if (supported) {
    return getMessaging(app);
  }
  return null;
});
