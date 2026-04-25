import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, messagingPromise } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// REPLACE THIS with your generated Web Push VAPID Key from Firebase Console
const VAPID_KEY = 'BKtS0Lfj_Hz9R4S22Ys-YEg1f8OimxC7ujki8P7MPS23WBMaaVntueMEpq95yrFLhWfLXhpkZa7YnaUhR2Bm70s';

export function usePushNotifications() {
  const { currentUser } = useAuth();
  const [isSupportedBrowser, setIsSupportedBrowser] = useState(false);
  const [permission, setPermission] = useState(Notification.permission);
  const [currentToken, setCurrentToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkSupport() {
      const messaging = await messagingPromise;
      setIsSupportedBrowser(!!messaging);
    }
    checkSupport();

    // Check if we already have a token locally stored
    const savedToken = localStorage.getItem('gymflow_device_token');
    if (savedToken && Notification.permission === 'granted') {
      setCurrentToken(savedToken);
    }
  }, []);

  const enableNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');

    try {
      const messaging = await messagingPromise;
      if (!messaging) {
        throw new Error('Push notifications are not supported in this browser.');
      }

      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission !== 'granted') {
        throw new Error('Notification permission was denied. Please allow them in your browser settings.');
      }

      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (!token) {
        throw new Error('Failed to generate device token.');
      }

      // Save token to firestore under this specific gym owner
      const deviceRef = doc(db, 'gyms', currentUser.uid, 'devices', token);
      await setDoc(deviceRef, {
        token: token,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      });

      // Save locally so we know this device is registered
      localStorage.setItem('gymflow_device_token', token);
      setCurrentToken(token);

    } catch (err) {
      console.error('Push setup failed:', err);
      setError(err.message || 'An unknown error occurred while setting up notifications.');
    } finally {
      setLoading(false);
    }
  };

  const disableNotifications = async () => {
    if (!currentUser || !currentToken) return;
    setLoading(true);

    try {
      // Remove from firestore
      const deviceRef = doc(db, 'gyms', currentUser.uid, 'devices', currentToken);
      await deleteDoc(deviceRef);

      localStorage.removeItem('gymflow_device_token');
      setCurrentToken(null);
    } catch (err) {
      console.error('Error removing token:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupportedBrowser,
    permission,
    currentToken,
    loading,
    error,
    enableNotifications,
    disableNotifications
  };
}
