import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { getDeviceId } from '../lib/deviceId';
import {
  isWalkTrackingEnabled,
  saveWalk,
  WalkCoordinate,
  requestLocationPermissions,
  checkLocationPermissions,
} from '../services/walkService';
import { useStepCounter } from './useStepCounter';

interface WalkTrackingState {
  isTracking: boolean;
  isPermissionGranted: boolean;
  currentWalk: {
    coordinates: WalkCoordinate[];
    startTime: string | null;
    distance: number;
  } | null;
}

const MIN_DISTANCE_KM = 1; // Minimum distance to save walk (1km)
const MIN_WALK_DURATION_MINUTES = 5; // Minimum walk duration (5 minutes)
const LOCATION_UPDATE_INTERVAL = 10000; // Update every 10 seconds (to save battery)
const STOP_DETECTION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes without movement = stopped
const MIN_SPEED_KMH = 3; // Minimum speed to consider "moving" (3 km/h)

export const useWalkTracker = () => {
  const { user } = useAuth();
  const { stepData } = useStepCounter();
  
  const [trackingState, setTrackingState] = useState<WalkTrackingState>({
    isTracking: false,
    isPermissionGranted: false,
    currentWalk: null,
  });

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const walkCoordinatesRef = useRef<WalkCoordinate[]>([]);
  const lastLocationTimeRef = useRef<number | null>(null);
  const lastKnownLocationRef = useRef<Location.LocationObject | null>(null);
  const stepsAtWalkStartRef = useRef<number>(0);

  // Initialize permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const permissions = await checkLocationPermissions();
    setTrackingState(prev => ({
      ...prev,
      isPermissionGranted: permissions.foreground && permissions.background,
    }));
  };

  // Check if tracking should be enabled based on user settings
  useEffect(() => {
    const checkTrackingEnabled = async () => {
      if (!trackingState.isPermissionGranted) return;

      const enabled = await isWalkTrackingEnabled(user?.id || null);
      
      if (enabled && !trackingState.isTracking) {
        // Start tracking if enabled and not already tracking
        startTracking();
      } else if (!enabled && trackingState.isTracking) {
        // Stop tracking if disabled
        stopTracking();
      }
    };

    checkTrackingEnabled();
  }, [user, trackingState.isPermissionGranted]);

  const startTracking = async () => {
    try {
      // Request permissions if not granted
      if (!trackingState.isPermissionGranted) {
        const granted = await requestLocationPermissions();
        if (!granted) {
          console.log('Location permissions not granted');
          return;
        }
        setTrackingState(prev => ({ ...prev, isPermissionGranted: true }));
      }

      // Check if tracking is enabled for user
      const enabled = await isWalkTrackingEnabled(user?.id || null);
      if (!enabled) {
        console.log('Walk tracking is disabled for user');
        return;
      }

      // Set up location subscription with background support
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Balanced accuracy for battery efficiency
          timeInterval: LOCATION_UPDATE_INTERVAL, // Update every 10 seconds
          distanceInterval: 10, // Update every 10 meters
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          handleLocationUpdate(location);
        }
      );

      // Also start background location updates
      await Location.startLocationUpdatesAsync('walkTracking', {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_UPDATE_INTERVAL,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'Steppin tracker turer',
          notificationBody: 'Spore din tur...',
          notificationColor: '#1ED760',
        },
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.Fitness,
        mayShowUserSettingsDialog: true,
      }).catch(err => {
        console.warn('Error starting background location updates:', err);
        // Continue with foreground tracking only
      });

      // Reset walk state
      walkCoordinatesRef.current = [];
      lastLocationTimeRef.current = Date.now();
      stepsAtWalkStartRef.current = stepData.steps;

      setTrackingState(prev => ({
        ...prev,
        isTracking: true,
        currentWalk: {
          coordinates: [],
          startTime: new Date().toISOString(),
          distance: 0,
        },
      }));

      console.log('Walk tracking started');
    } catch (err) {
      console.error('Error starting walk tracking:', err);
    }
  };

  const stopTracking = async () => {
    try {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      await Location.stopLocationUpdatesAsync('walkTracking');

      // Save walk if it meets criteria
      const currentWalk = walkCoordinatesRef.current;
      if (currentWalk.length >= 2 && trackingState.currentWalk?.startTime) {
        const duration = new Date().getTime() - new Date(trackingState.currentWalk.startTime).getTime();
        const durationMinutes = duration / (1000 * 60);

        // Only save if duration >= 5 minutes and distance >= 1km
        if (durationMinutes >= MIN_WALK_DURATION_MINUTES) {
          const stepsDuringWalk = stepData.steps - stepsAtWalkStartRef.current;
          
          const deviceId = user ? null : await getDeviceId();
          const { error } = await saveWalk(
            user?.id || null,
            deviceId,
            currentWalk,
            Math.max(0, stepsDuringWalk)
          );

          if (error) {
            console.error('Error saving walk:', error);
          } else {
            console.log('Walk saved successfully');
          }
        }
      }

      walkCoordinatesRef.current = [];
      lastLocationTimeRef.current = null;
      lastKnownLocationRef.current = null;

      setTrackingState(prev => ({
        ...prev,
        isTracking: false,
        currentWalk: null,
      }));

      console.log('Walk tracking stopped');
    } catch (err) {
      console.error('Error stopping walk tracking:', err);
    }
  };

  const handleLocationUpdate = (location: Location.LocationObject) => {
    if (!location.coords) return;

    const now = Date.now();
    const timestamp = new Date().toISOString();
    const speed = location.coords.speed ? location.coords.speed * 3.6 : 0; // Convert m/s to km/h

    // Check if user is moving (speed >= 3 km/h) or stationary
    const isMoving = speed >= MIN_SPEED_KMH;

    if (isMoving) {
      // User is moving - add coordinate and reset stop timer
      const coordinate: WalkCoordinate = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        timestamp,
      };

      walkCoordinatesRef.current.push(coordinate);
      lastLocationTimeRef.current = now;
      lastKnownLocationRef.current = location;

      // Calculate current distance
      const distance = calculateDistance(walkCoordinatesRef.current);

      setTrackingState(prev => ({
        ...prev,
        currentWalk: prev.currentWalk
          ? {
              ...prev.currentWalk,
              coordinates: [...walkCoordinatesRef.current],
              distance,
            }
          : null,
      }));
    } else {
      // User is stationary - check if they've stopped long enough
      if (lastLocationTimeRef.current) {
        const timeSinceLastMovement = now - lastLocationTimeRef.current;

        if (timeSinceLastMovement >= STOP_DETECTION_THRESHOLD_MS) {
          // User has been stationary for 5 minutes - stop tracking and save walk
          console.log('Walk ended: User stationary for 5 minutes');
          stopTracking();
        }
      }
    }
  };

  const calculateDistance = (coordinates: WalkCoordinate[]): number => {
    if (coordinates.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const distance = calculateCoordinateDistance(
        coordinates[i - 1].lat,
        coordinates[i - 1].lng,
        coordinates[i].lat,
        coordinates[i].lng
      );
      totalDistance += distance;
    }
    return totalDistance;
  };

  const calculateCoordinateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
      Location.stopLocationUpdatesAsync('walkTracking').catch(() => {});
    };
  }, []);

  return {
    ...trackingState,
    startTracking,
    stopTracking,
    requestPermissions: requestLocationPermissions,
  };
};

