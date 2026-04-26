import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch custom claims to determine role
          const idTokenResult = await user.getIdTokenResult();
          const isSuperAdmin = !!idTokenResult.claims.super_admin;
          setUserRole(isSuperAdmin ? 'super_admin' : 'gym_owner');

          // Only create default documents if the user is a gym_owner
          if (!isSuperAdmin) {
            // 1. Check if user document exists
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
              await setDoc(userDocRef, {
                gymId: user.uid,
                email: user.email
              });
            }

            // 2. Check if gym document exists
            const gymDocRef = doc(db, 'gyms', user.uid);
            const gymDocSnap = await getDoc(gymDocRef);

            if (!gymDocSnap.exists()) {
              await setDoc(gymDocRef, {
                name: 'GYMFLOW',
                createdAt: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error("Error setting up user/gym docs:", err);
        }
      } else {
        setUserRole(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

