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
  getHomeAreaSettings,
  isOutsideHomeArea,
  HomeAreaSettings,
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

const MIN_WALK_DURATION_MINUTES = 5; // Minimum walk duration (5 minutes)
const LOCATION_UPDATE_INTERVAL = 10000; // Update every 10 seconds (to save battery)
const STOP_DETECTION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes without movement = stopped

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
  const walkStartTimeRef = useRef<string | null>(null);
  const homeAreaSettingsRef = useRef<HomeAreaSettings | null>(null);
  const isOutsideHomeAreaRef = useRef<boolean>(false);
  // Pause detection: track when user stopped and where
  const pauseStartTimeRef = useRef<number | null>(null);
  const pauseStartLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // Home area debounce: require N consecutive "inside home" readings before ending walk
  const homeAreaCountRef = useRef<number>(0);
  const HOME_AREA_THRESHOLD = 4; // ~40 seconds at 10s interval before walk ends

  // Initialize permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const permissions = await checkLocationPermissions();
    setTrackingState(prev => ({
      ...prev,
      isPermissionGranted: permissions.foreground, // background not required in Expo Go
    }));
  };

  // Check if tracking should be enabled based on user settings
  useEffect(() => {
    const checkTrackingEnabled = async () => {
      if (!trackingState.isPermissionGranted) {
        console.log('Walk tracking: Waiting for location permissions');
        return;
      }

      const enabled = await isWalkTrackingEnabled(user?.id || null);
      console.log(`Walk tracking: ${enabled ? 'ENABLED' : 'DISABLED'} for user ${user?.id || 'anonymous'}`);
      
      if (!enabled) {
        console.log('Walk tracking: ⚠️ Tracking is disabled. Enable it in Settings > Turdeling > Aktiver GPS-sporing');
        return;
      }
      
      if (enabled && !trackingState.isTracking) {
        // Start tracking if enabled and not already tracking
        console.log('Walk tracking: Starting automatic tracking');
        console.log('Walk tracking: ⚠️ IMPORTANT - Keep the app open while walking (Expo Go limitation)');
        startTracking();
      } else if (!enabled && trackingState.isTracking) {
        // Stop tracking if disabled
        console.log('Walk tracking: Stopping (disabled by user)');
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

      // Load home area settings
      homeAreaSettingsRef.current = await getHomeAreaSettings(user?.id || null);

      // Set up location subscription with background support
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 5, // Update every 5 meters (was 10)
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          handleLocationUpdate(location);
        }
      );

      // Also start background location updates
      // Try to start background location updates (may not work in Expo Go)
      try {
        await Location.startLocationUpdatesAsync('walkTracking', {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'GetSteppin tracker turer',
            notificationBody: 'Spore din tur...',
            notificationColor: '#1ED760',
          },
          pausesUpdatesAutomatically: true,
          activityType: Location.ActivityType.Fitness,
          mayShowUserSettingsDialog: true,
        });
        console.log('Walk tracking: Background location updates started successfully');
      } catch (err: any) {
        console.warn('Walk tracking: Background location updates failed (this is normal in Expo Go):', err?.message || err);
        console.log('Walk tracking: ⚠️ IMPORTANT - Keep the app open while walking (Expo Go limitation)');
        // Continue with foreground tracking only
      }

      // Reset walk state
      walkCoordinatesRef.current = [];
      lastLocationTimeRef.current = Date.now();
      stepsAtWalkStartRef.current = stepData.steps;
      walkStartTimeRef.current = new Date().toISOString();
      pauseStartTimeRef.current = null;
      pauseStartLocationRef.current = null;

      setTrackingState(prev => ({
        ...prev,
        isTracking: true,
        currentWalk: {
          coordinates: [],
          startTime: walkStartTimeRef.current!,
          distance: 0,
        },
      }));

      console.log('Walk tracking started - will auto-save when walk reaches 1km and 5 minutes');
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
      if (currentWalk.length >= 2 && walkStartTimeRef.current) {
        const duration = new Date().getTime() - new Date(walkStartTimeRef.current).getTime();
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
      walkStartTimeRef.current = null;
      pauseStartTimeRef.current = null;
      pauseStartLocationRef.current = null;

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

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    if (!location.coords || !homeAreaSettingsRef.current) return;

    const now = Date.now();
    const timestamp = new Date().toISOString();
    const settings = homeAreaSettingsRef.current;
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;

    // Calculate speed from GPS or from displacement since last point
    let speed = (location.coords.speed ?? 0) * 3.6; // m/s → km/h
    if (speed === 0 && lastKnownLocationRef.current && lastLocationTimeRef.current) {
      const timeDiff = (now - lastLocationTimeRef.current) / 1000;
      if (timeDiff > 0 && timeDiff < 60) { // only if last update was recent
        const dist = calculateDistance([
          { lat: lastKnownLocationRef.current.coords.latitude, lng: lastKnownLocationRef.current.coords.longitude, timestamp: '' },
          { lat, lng, timestamp: '' },
        ]);
        speed = (dist / timeDiff) * 3.6;
      }
    }

    // Skip GPS jumps (>50 km/h while not running) — don't end the walk, just ignore the point
    if (speed > 50) {
      lastKnownLocationRef.current = location;
      lastLocationTimeRef.current = now;
      return;
    }

    // Update home area debounce
    const outsideHome = isOutsideHomeArea(lat, lng, settings);
    if (outsideHome) {
      homeAreaCountRef.current = 0;
      isOutsideHomeAreaRef.current = true;
    } else {
      homeAreaCountRef.current += 1;
      if (homeAreaCountRef.current >= HOME_AREA_THRESHOLD) {
        isOutsideHomeAreaRef.current = false;
      }
    }

    lastKnownLocationRef.current = location;
    lastLocationTimeRef.current = now;

    // Always add coordinate if outside home area (even when slow/still)
    if (isOutsideHomeAreaRef.current) {
      walkCoordinatesRef.current.push({ lat, lng, timestamp });

      // Start walk timer on first coordinate outside home
      if (!walkStartTimeRef.current) {
        walkStartTimeRef.current = timestamp;
        stepsAtWalkStartRef.current = stepData.steps;
        pauseStartTimeRef.current = null;
        pauseStartLocationRef.current = null;
      }

      const distance = calculateDistance(walkCoordinatesRef.current);

      // Pause detection: user stopped for too long → save and end walk
      const currentLoc = { lat, lng };
      const movedFromPause = pauseStartLocationRef.current
        ? calculateDistance([
            { lat: pauseStartLocationRef.current.lat, lng: pauseStartLocationRef.current.lng, timestamp: '' },
            { lat, lng, timestamp: '' },
          ]) > settings.pause_radius_meters
        : true;

      if (movedFromPause) {
        pauseStartTimeRef.current = null;
        pauseStartLocationRef.current = null;
      } else if (pauseStartTimeRef.current) {
        const pausedMinutes = (now - pauseStartTimeRef.current) / 60000;
        if (pausedMinutes >= settings.pause_tolerance_minutes) {
          // Long pause — save walk and end
          const durationMinutes = (now - new Date(walkStartTimeRef.current).getTime()) / 60000;
          if (durationMinutes >= MIN_WALK_DURATION_MINUTES && distance >= settings.min_walk_distance_meters) {
            const stepsDuringWalk = Math.max(0, stepData.steps - stepsAtWalkStartRef.current);
            const deviceId = user ? null : await getDeviceId();
            const { error } = await saveWalk(user?.id || null, deviceId, [...walkCoordinatesRef.current], stepsDuringWalk);
            if (error) console.error('Error saving walk after pause:', error);
          }
          // Clear walk data before stopTracking so it doesn't try to save again
          walkCoordinatesRef.current = [];
          walkStartTimeRef.current = null;
          stopTracking();
          return;
        }
      } else if (speed < settings.min_walk_speed_kmh) {
        // Start pause timer
        pauseStartTimeRef.current = now;
        pauseStartLocationRef.current = currentLoc;
      }

      setTrackingState(prev => ({
        ...prev,
        currentWalk: prev.currentWalk
          ? { ...prev.currentWalk, coordinates: [...walkCoordinatesRef.current], distance }
          : null,
      }));
    } else if (!isOutsideHomeAreaRef.current && walkStartTimeRef.current && walkCoordinatesRef.current.length >= 2) {
      // Back home (debounced) — save walk
      const durationMinutes = (now - new Date(walkStartTimeRef.current).getTime()) / 60000;
      const distance = calculateDistance(walkCoordinatesRef.current);
      if (durationMinutes >= MIN_WALK_DURATION_MINUTES && distance >= settings.min_walk_distance_meters) {
        const stepsDuringWalk = Math.max(0, stepData.steps - stepsAtWalkStartRef.current);
        const deviceId = user ? null : await getDeviceId();
        const { error } = await saveWalk(user?.id || null, deviceId, [...walkCoordinatesRef.current], stepsDuringWalk);
        if (error) console.error('Error saving walk on return home:', error);
      }
      walkCoordinatesRef.current = [];
      walkStartTimeRef.current = null;
      stepsAtWalkStartRef.current = stepData.steps;
      setTrackingState(prev => ({ ...prev, currentWalk: null }));
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
    isOutsideHomeArea: isOutsideHomeAreaRef.current,
    startTracking,
    stopTracking,
    requestPermissions: requestLocationPermissions,
  };
};

