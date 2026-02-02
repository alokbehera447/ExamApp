// storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Token keys
const ACCESS_TOKEN_KEY = '@access_token';
const REFRESH_TOKEN_KEY = '@refresh_token';
const USER_DATA_KEY = '@user_data';
const CREDENTIALS_KEY = '@student_credentials';

// Token management
export const saveTokens = async (access: string, refresh: string) => {
  try {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, access],
      [REFRESH_TOKEN_KEY, refresh],
    ]);
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

// User data management
export const saveUserData = async (userData: any) => {
  try {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

export const getUserData = async (): Promise<any> => {
  try {
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const clearUserData = async () => {
  try {
    await AsyncStorage.removeItem(USER_DATA_KEY);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
};

// Credentials management (for auto-login)
export const saveCredentials = async (username: string, password: string) => {
  try {
    const credentials = JSON.stringify({ username, password });
    await AsyncStorage.setItem(CREDENTIALS_KEY, credentials);
  } catch (error) {
    console.error('Error saving credentials:', error);
  }
};

export const getStoredCredentials = async () => {
  try {
    const credentials = await AsyncStorage.getItem(CREDENTIALS_KEY);
    return credentials ? JSON.parse(credentials) : null;
  } catch (error) {
    console.error('Error loading credentials:', error);
    return null;
  }
};

export const clearCredentials = async () => {
  try {
    await AsyncStorage.removeItem(CREDENTIALS_KEY);
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

// Clear all data (logout)
export const clearTokens = async () => {
  try {
    await AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_DATA_KEY,
      CREDENTIALS_KEY,
    ]);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
};
export const saveDeviceInfo = async (deviceInfo: any) => {
  try {
    await AsyncStorage.setItem('device_info', JSON.stringify(deviceInfo));
  } catch (error) {
    console.error("Error saving device info:", error);
  }
};

export const getDeviceInfo = async () => {
  try {
    const info = await AsyncStorage.getItem('device_info');
    return info ? JSON.parse(info) : null;
  } catch (error) {
    console.error("Error getting device info:", error);
    return null;
  }
};