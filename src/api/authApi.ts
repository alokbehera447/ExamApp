// authApi.ts - COMPLETE CORRECTED VERSION
import axios from "axios";
import { Platform, Dimensions } from "react-native";

export interface InstituteData {
  id: number;
  name: string;
  domain: string;
  description: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  logo: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_by: number;
  created_by_name: string;
  user_count: number;
  active_user_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserData {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  institute: InstituteData;
  institute_id: number;
  center_id: number | null;
  center_name: string | null;
  phone: string | null;
  profile_picture: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  user: UserData;
  tokens: {
    access: string;
    refresh: string;
  };
}

export interface ConflictInfo {
  device_type: string;
  browser: string;
  os: string;
  login_timestamp: string;
  last_activity: string;
  device_fingerprint: string;
}

// Response types
export interface LoginSuccessResponse extends LoginResponse {
  message?: string;
}

export interface LoginConflictResponse {
  has_conflict: true;
  conflict_info: ConflictInfo;
  message: string;
}

// Device information - UPDATED
export interface DeviceInfo {
  device_type: string;
  browser: string;
  os: string;
  device_model: string;
  user_agent: string;
  screen_resolution: string;
  timezone: string;
  device_id: string; // Added
}

// Generate unique device ID
const generateDeviceId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `mobile-${timestamp}-${random}`;
};

// Get device info for login
export const getDeviceInfo = (): DeviceInfo => {
  const isIOS = Platform.OS === 'ios';
  const deviceId = generateDeviceId();
  
  // Get actual device dimensions
  const { width, height } = Dimensions.get('window');
  const screenResolution = `${Math.round(width)}x${Math.round(height)}`;
  
  return {
    device_type: 'mobile',
    browser: isIOS ? 'Safari Mobile' : 'Chrome Mobile',
    os: isIOS ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`,
    device_model: isIOS ? 'iPhone' : 'Android Device',
    user_agent: isIOS 
      ? `Mozilla/5.0 (iPhone; CPU iPhone OS ${Platform.Version?.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${Platform.Version} Mobile/15E148 Safari/604.1`
      : `Mozilla/5.0 (Linux; Android ${Platform.Version}; ${deviceId}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36`,
    screen_resolution: screenResolution,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Calcutta',
    device_id: deviceId,
  };
};

// Main login function with conflict handling - UPDATED
export const studentLogin = async (
  username: string,
  password: string,
  forceSwitch: boolean = false
): Promise<LoginSuccessResponse | LoginConflictResponse> => {
  try {
    const deviceInfo = getDeviceInfo();
    
    const requestBody: any = {
      username: username.trim(),
      password: password.trim(),
      user_agent: deviceInfo.user_agent,
      screen_resolution: deviceInfo.screen_resolution,
      timezone: deviceInfo.timezone,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device_model: deviceInfo.device_model, // Added
      device_id: deviceInfo.device_id,
    };

    // Add force_switch flag if needed
    if (forceSwitch) {
      requestBody.force_switch = true;
    }

    console.log("STUDENT LOGIN REQUEST BODY:", JSON.stringify(requestBody, null, 2));

    const response = await axios.post(
      "https://exams.dashoapp.com/api/auth/student/login/",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        validateStatus: (status) => {
          return (status >= 200 && status < 300) || status === 409;
        },
        timeout: 10000,
      }
    );

    console.log("STUDENT LOGIN RESPONSE:", {
      status: response.status,
      force_switch_sent: forceSwitch,
      data: response.data
    });

    // Handle 409 Conflict
    if (response.status === 409) {
      return {
        has_conflict: true,
        conflict_info: response.data?.conflict_info || response.data,
        message: response.data?.message || "You are already logged in on another device."
      };
    }

    // Handle success
    if (response.status === 200 || response.status === 201) {
      if (response.data.has_conflict) {
        return {
          has_conflict: true,
          conflict_info: response.data.conflict_info,
          message: response.data.message || "Conflict detected"
        };
      }
      
      return {
        user: response.data.user,
        tokens: response.data.tokens,
        message: response.data.message
      };
    }

    throw new Error(`Login failed with status ${response.status}`);

  } catch (error: any) {
    console.error("STUDENT LOGIN ERROR:", error);
    throw new Error(error.response?.data?.message || "Login failed");
  }
};

// Force switch login - UPDATED
export const forceSwitchLogin = async (
  username: string,
  password: string
): Promise<LoginSuccessResponse> => {
  try {
    const deviceInfo = getDeviceInfo();
    
    const requestBody = {
      username: username.trim(),
      password: password.trim(),
      user_agent: deviceInfo.user_agent,
      screen_resolution: deviceInfo.screen_resolution,
      timezone: deviceInfo.timezone,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device_model: deviceInfo.device_model, // Added
      device_id: deviceInfo.device_id, // Added
      force_switch: true,
    };

    console.log("FORCE SWITCH LOGIN REQUEST:", JSON.stringify(requestBody, null, 2));

    const response = await axios.post(
      "https://exams.dashoapp.com/api/auth/student/login/",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        validateStatus: (status) => {
          return (status >= 200 && status < 300) || status === 409;
        },
        timeout: 15000,
      }
    );

    console.log("FORCE SWITCH RESPONSE:", {
      status: response.status,
      data: response.data
    });

    if (response.status === 200 || response.status === 201) {
      if (response.data.has_conflict) {
        throw new Error("Force switch failed: Conflict still exists");
      }
      
      return {
        user: response.data.user,
        tokens: response.data.tokens,
        message: response.data.message
      };
    }
    
    if (response.status === 409) {
      throw new Error(`Force switch rejected: ${response.data?.message || 'Server does not allow force switch'}`);
    }
    
    throw new Error(`Force switch failed with status ${response.status}`);

  } catch (error: any) {
    console.error("FORCE SWITCH ERROR:", error);
    throw error;
  }
};

// Keep other functions as they are...

// New function to get user profile
export const getUserProfile = async (token: string): Promise<UserData> => {
  try {
    const response = await axios.get(
      "https://exams.dashoapp.com/api/auth/profile/",
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error fetching user profile:", error.response?.data || error.message);
    throw error;
  }
};

// Check device session
export const checkDeviceSession = async (username: string): Promise<any> => {
  try {
    const response = await axios.post(
      "https://exams.dashoapp.com/api/auth/check-device/",
      { username },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Check device error:", error);
    return null;
  }
};

// Get active sessions
export const getActiveSessions = async (accessToken: string): Promise<any> => {
  try {
    const response = await axios.get(
      "https://exams.dashoapp.com/api/auth/active-sessions/",
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Get active sessions error:", error);
    return [];
  }
};

// Delete specific session
export const deleteSession = async (accessToken: string, fingerprint: string): Promise<any> => {
  try {
    const response = await axios.delete(
      `https://exams.dashoapp.com/api/auth/session/${fingerprint}/`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Delete session error:", error);
    return null;
  }
};

// Logout current device
export const logoutCurrentDevice = async (accessToken: string): Promise<any> => {
  try {
    const response = await axios.post(
      "https://exams.dashoapp.com/api/auth/logout/",
      {},
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("Logout error:", error);
    return null;
  }
};

// Add this function to check for active sessions before login
export const checkActiveSessionsBeforeLogin = async (
  username: string,
  currentDeviceId: string
): Promise<{
  hasActiveSessions: boolean;
  sessions?: any[];
  message?: string;
}> => {
  try {
    // First, check device session
    const deviceCheck = await checkDeviceSession(username);
    
    if (deviceCheck && deviceCheck.has_active_sessions) {
      console.log("Device check found active sessions:", deviceCheck);
      return {
        hasActiveSessions: true,
        sessions: deviceCheck.sessions,
        message: deviceCheck.message || "Active sessions found"
      };
    }
    
    // If we had an access token, we could check active sessions
    // But without login, we can't get sessions
    return {
      hasActiveSessions: false
    };
    
  } catch (error) {
    console.log("Session check error (might be normal):", error);
    return {
      hasActiveSessions: false
    };
  }
};

// Enhanced studentLogin that warns about active sessions
export const studentLoginWithSessionCheck = async (
  username: string,
  password: string,
  forceSwitch: boolean = false
): Promise<LoginSuccessResponse | LoginConflictResponse> => {
  try {
    const deviceInfo = getDeviceInfo();
    
    // First check if there might be active sessions
    if (!forceSwitch) {
      const sessionCheck = await checkActiveSessionsBeforeLogin(username, deviceInfo.device_id);
      
      if (sessionCheck.hasActiveSessions) {
        console.log("WARNING: Active sessions detected but server may allow login");
        // We'll still try to login, but we might want to warn the user
      }
    }
    
    // Proceed with normal login
    return await studentLogin(username, password, forceSwitch);
    
  } catch (error: any) {
    console.error("Login with session check error:", error);
    throw error;
  }
};