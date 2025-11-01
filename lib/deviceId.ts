// Device ID utility
// Genererer og lagrer en unik enhet-ID for å identifisere ikke-innloggede brukere

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'steppin_device_id';

// Memory cache for device ID (fallback if storage fails)
let cachedDeviceId: string | null = null;

/**
 * Generates or retrieves a unique device ID
 * Stores it in AsyncStorage for native or localStorage for web
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    // Check memory cache first
    if (cachedDeviceId) {
      return cachedDeviceId;
    }

    // Try to get from storage
    let storedId: string | null = null;
    
    if (Platform.OS === 'web') {
      // Use localStorage on web
      try {
        storedId = localStorage.getItem(DEVICE_ID_KEY);
      } catch (err) {
        console.log('localStorage not available:', err);
      }
    } else {
      // Use AsyncStorage on native
      try {
        storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      } catch (err) {
        console.log('AsyncStorage error:', err);
      }
    }

    if (storedId) {
      cachedDeviceId = storedId;
      return storedId;
    }

    // Generate a new device ID (UUID-like format)
    const newId = generateUUID();
    
    // Store it
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(DEVICE_ID_KEY, newId);
      } else {
        await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
      }
      cachedDeviceId = newId;
    } catch (err) {
      console.log('Could not store device ID:', err);
      // Still return the ID even if storage fails
    }
    
    return newId;
  } catch (err) {
    // Fallback: generate a new ID each time (not ideal but works)
    console.error('Error getting device ID:', err);
    return generateUUID();
  }
};

/**
 * Generates a UUID-like string
 */
function generateUUID(): string {
  // Generate a simple UUID v4-like string
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
