// src/hooks/useProctoring.ts
import { useState, useEffect, useRef } from 'react';
import { Platform, Dimensions, AppState, Alert } from 'react-native';
import { takeProctoringSnapshot, SnapshotData } from '../api/examApi';
import { Camera } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';

const { width, height } = Dimensions.get('window');

// Violation modal state interface
export interface ViolationModalState {
  visible: boolean;
  violationType: string;
  violationTitle: string;
  violationMessage: string;
  totalViolations: number;
  isDisqualified: boolean;
}

export const useProctoring = (attemptId: number, isProctoringEnabled: boolean) => {
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [lastSnapshotTime, setLastSnapshotTime] = useState<string | null>(null);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  
  // Violation modal state
  const [violationModal, setViolationModal] = useState<ViolationModalState>({
    visible: false,
    violationType: '',
    violationTitle: '',
    violationMessage: '',
    totalViolations: 0,
    isDisqualified: false,
  });
  
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<Camera>(null);

  // Track app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Request camera permission
  useEffect(() => {
    const requestPermission = async () => {
      if (!isProctoringEnabled) return;

      console.log('Requesting camera permission...');
      const permission = await Camera.requestCameraPermission();
      
      if (permission === 'granted') {
        console.log('✅ Camera permission granted');
        setHasPermission(true);
      } else {
        console.log('❌ Camera permission denied');
        setHasPermission(false);
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required for exam proctoring. Without it, your exam attempt may be invalidated.',
          [{ text: 'OK' }]
        );
      }
    };

    requestPermission();
  }, [isProctoringEnabled]);

  // Set camera reference from parent component
  const setCameraRef = (ref: any) => {
    cameraRef.current = ref;
    if (ref) {
      setCameraReady(true);
      console.log('📷 Camera reference set and ready');
    }
  };

  // Function to capture image silently from camera
  const captureImageSilently = async (): Promise<string | null> => {
    // Check if app is in background
    if (appState !== 'active') {
      console.log('App not active, skipping snapshot');
      return null;
    }

    // Check if camera is ready
    if (!cameraRef.current) {
      console.log('Camera not ready yet');
      return null;
    }

    if (!hasPermission) {
      console.log('No camera permission');
      return null;
    }

    try {
      console.log('📸 Capturing image from camera...');
      
      // Take photo using vision camera
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
        enableShutterSound: false,
      });

      console.log('Photo captured:', photo.path);

      // Read the file and convert to base64
      const base64Image = await RNFS.readFile(photo.path, 'base64');
      
      // Delete the temporary file
      await RNFS.unlink(photo.path).catch(() => {
        console.log('Could not delete temp file');
      });

      console.log('✅ Image captured and converted to base64');
      return base64Image;

    } catch (error) {
      console.error('❌ Error capturing image:', error);
      return null;
    }
  };

  // Prepare snapshot data with metadata
  const prepareSnapshotData = (base64Image: string): SnapshotData => {
    return {
      image_data: base64Image,
      timestamp: new Date().toISOString(),
      metadata: {
        user_agent: `Mobile App ${Platform.OS} ${Platform.Version}`,
        screen_resolution: `${Math.round(width)}x${Math.round(height)}`,
        device_pixel_ratio: Platform.OS === 'ios' ? 2 : 3,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  };

  // Get violation details for modal
  const getViolationDetails = (violationType: string) => {
    switch (violationType) {
      case 'no_face':
        return {
          title: 'Face Not Detected',
          message: 'Your face is not visible in the camera.\n\n📌 Action Required:\n• Position yourself so your face is clearly visible\n• Ensure proper lighting\n• Look at the screen',
        };
      case 'multiple_faces':
        return {
          title: 'Multiple Faces Detected',
          message: 'More than one person detected in the frame.\n\n📌 Action Required:\n• Ensure you are alone during the exam\n• Remove others from camera view\n• Maintain exam integrity',
        };
      case 'looking_away':
        return {
          title: 'Looking Away Detected',
          message: 'You appear to be looking away from the screen.\n\n📌 Action Required:\n• Keep your eyes on the exam\n• Focus on the questions\n• Avoid looking at other materials',
        };
      case 'suspicious_gaze':
        return {
          title: 'Suspicious Eye Movement',
          message: 'Unusual eye movement pattern detected.\n\n📌 Action Required:\n• Focus on the exam screen\n• Avoid looking around\n• Keep your gaze steady',
        };
      case 'head_pose_violation':
        return {
          title: 'Unusual Head Position',
          message: 'Your head position seems unusual.\n\n📌 Action Required:\n• Face the screen directly\n• Sit upright\n• Maintain proper posture',
        };
      // default:
      //   return {
      //     title: 'Proctoring Warning',
      //     message: 'A potential violation has been detected.\n\n📌 Action Required:\n• Maintain proper exam conduct\n• Follow exam guidelines',
      //   };
    }
  };

  // Show violation modal
  const showViolationModal = (
    violationType: string,
    totalViolations: number,
    isDisqualified: boolean = false
  ) => {
    const details = getViolationDetails(violationType);
    
    setViolationModal({
      visible: true,
      violationType,
      violationTitle: details.title,
      violationMessage: details.message,
      totalViolations,
      isDisqualified,
    });
  };

  // Close violation modal
  const closeViolationModal = () => {
    setViolationModal(prev => ({ ...prev, visible: false }));
  };

  // Function to take and upload snapshot
  const takeAndUploadSnapshot = async () => {
    if (isTakingSnapshot) {
      console.log('Already taking snapshot, skipping...');
      return;
    }

    if (!cameraReady || !hasPermission) {
      console.log('Camera not ready or no permission, skipping snapshot');
      return;
    }
    
    try {
      setIsTakingSnapshot(true);
      console.log(`📸 Taking snapshot for attempt ${attemptId}...`);
      
      // Capture image from camera
      const base64Image = await captureImageSilently();
      
      if (!base64Image) {
        console.log('❌ Failed to capture image, skipping upload');
        return;
      }

      // Prepare snapshot data
      const snapshotData = prepareSnapshotData(base64Image);

      // Upload to server
      console.log('📤 Uploading snapshot to server...');
      const response = await takeProctoringSnapshot(attemptId, snapshotData);
      
      // Update state
      setSnapshotCount(prev => prev + 1);
      const currentTime = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      setLastSnapshotTime(currentTime);
      
      console.log(`✅ Snapshot #${snapshotCount + 1} uploaded successfully:`, {
        uploaded: response.snapshot_uploaded,
        storage: response.storage_type,
        faces: response.analysis.faces_detected,
        currentViolations: response.analysis.violations?.length || 0,
        totalViolationCount: response.violation_count,
      });
      
      // Always update the violation count from server
      setViolationCount(response.violation_count);
      
      // Check if CURRENT snapshot has violations
      const currentSnapshotViolations = response.analysis.violations || [];
      const hasViolationInCurrentSnapshot = currentSnapshotViolations.length > 0;
      
      // ONLY show modal if current snapshot contains violations
      if (hasViolationInCurrentSnapshot) {
        console.warn(`⚠️ Violation in current snapshot! Total count: ${response.violation_count}`);
        
        // Get the first violation from current snapshot
        const currentViolation = currentSnapshotViolations[0];
        
        // Show professional modal
        showViolationModal(
          currentViolation.type,
          response.violation_count,
          false
        );
      } else {
        // No violations in current snapshot
        console.log(`✅ No violations in current snapshot. Total accumulated violations: ${response.violation_count}`);
      }
      
      // Check if auto-disqualified
      if (response.auto_disqualified) {
        console.error('❌ Student auto-disqualified due to violations');
        
        // Show disqualification modal
        showViolationModal(
          'disqualified',
          response.violation_count,
          true
        );
        
        // You might want to add a callback here to end the exam
      }
      
      return response;
    } catch (error: any) {
      console.error('❌ Error in takeAndUploadSnapshot:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Don't throw - just log and continue
      // This prevents the proctoring from stopping if one snapshot fails
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  // Start proctoring interval
  const startProctoring = () => {
    if (!isProctoringEnabled) {
      console.log('Proctoring not enabled, skipping...');
      return;
    }

    if (!cameraReady || !hasPermission) {
      console.log('Camera not ready or no permission, will start when ready');
      return;
    }
    
    // Clear any existing interval
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
    }
    
    console.log('🎥 Starting camera proctoring');
    
    // Take first snapshot after 5 seconds
    setTimeout(() => {
      takeAndUploadSnapshot();
    }, 5000);
    
    // Set interval for subsequent snapshots (every 5 seconds for testing, adjust as needed)
    snapshotIntervalRef.current = setInterval(() => {
      takeAndUploadSnapshot();
    }, 5000); // Adjust this interval as needed (30000 for 30 seconds in production)
  };

  // Stop proctoring
  const stopProctoring = () => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
      console.log('🛑 Proctoring stopped');
    }
  };

  // Start proctoring when camera becomes ready
  useEffect(() => {
    if (isProctoringEnabled && attemptId && cameraReady && hasPermission) {
      console.log('Camera ready with permission, starting proctoring for attempt:', attemptId);
      startProctoring();
    }
    
    // Cleanup on unmount
    return () => {
      stopProctoring();
    };
  }, [attemptId, isProctoringEnabled, cameraReady, hasPermission]);

  // Pause proctoring when app goes to background
  useEffect(() => {
    if (appState !== 'active' && snapshotIntervalRef.current) {
      console.log('App went to background, pausing proctoring');
      stopProctoring();
    } else if (appState === 'active' && isProctoringEnabled && cameraReady && hasPermission && !snapshotIntervalRef.current) {
      console.log('App became active, resuming proctoring');
      startProctoring();
    }
  }, [appState]);

  return {
    snapshotCount,
    lastSnapshotTime,
    isTakingSnapshot,
    violationCount,
    cameraReady,
    hasPermission,
    violationModal,
    setCameraRef,
    closeViolationModal,
    takeAndUploadSnapshot,
    startProctoring,
    stopProctoring,
  };
};