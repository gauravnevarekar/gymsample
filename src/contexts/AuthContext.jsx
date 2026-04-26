import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, db, messagingPromise } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [gymStatus, setGymStatus] = useState('active');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [planExpiryDate, setPlanExpiryDate] = useState(null);
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
          const isSuperAdmin = idTokenResult.claims.role === 'super_admin';
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
              const now = new Date();
              const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
              await setDoc(gymDocRef, {
                name: 'GYMFLOW',
                plan: 'trial',
                status: 'active',
                planStartDate: now.toISOString(),
                planExpiryDate: expiry.toISOString(),
                createdAt: now.toISOString()
              });
            }
          }
        } catch (err) {
          console.error("Error setting up user/gym docs:", err);
        }
      } else {
        setUserRole(null);
        setGymStatus('active');
        setMustChangePassword(false);
        setPlanExpiryDate(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Real-time listener for gym status access control
  useEffect(() => {
    let unsubscribeGym = () => {};
    if (currentUser && userRole === 'gym_owner') {
      const gymDocRef = doc(db, 'gyms', currentUser.uid);
      unsubscribeGym = onSnapshot(gymDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGymStatus(data.status || 'active');
          setMustChangePassword(data.mustChangePassword || false);
          setPlanExpiryDate(data.planExpiryDate || null);
        }
      });

      // Register FCM Token
      const registerFCMToken = async () => {
        try {
          const messaging = await messagingPromise;
          if (!messaging) return; // Browser doesn't support FCM
          
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const currentToken = await getToken(messaging, { 
              vapidKey: 'BKtS0Lfj_Hz9R4S22Ys-YEg1f8OimxC7ujki8P7MPS23WBMaaVntueMEpq95yrFLhWfLXhpkZa7YnaUhR2Bm70s' 
            });
            if (currentToken) {
              await updateDoc(gymDocRef, { fcmToken: currentToken });
            }
          }
        } catch (err) {
          console.warn('Failed to register FCM token:', err);
        }
      };

      registerFCMToken();
    }
    return () => unsubscribeGym();
  }, [currentUser, userRole]);

  const value = {
    currentUser,
    userRole,
    gymStatus,
    mustChangePassword,
    planExpiryDate,
    login,
    logout
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

