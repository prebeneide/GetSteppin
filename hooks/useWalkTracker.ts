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
  calculateDistance,
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
    if (!location.coords || !homeAreaSettingsRef.current) {
      console.log('Walk tracking: Missing location coords or home area settings');
      return;
    }

    const now = Date.now();
    const timestamp = new Date().toISOString();
    // GPS speed can be null/undefined, so we calculate it from coordinates if available
    let speed = location.coords.speed ? location.coords.speed * 3.6 : 0; // Convert m/s to km/h
    
    // If speed is not available from GPS, estimate from last known location
    if (speed === 0 && lastKnownLocationRef.current && lastLocationTimeRef.current) {
      const timeDiff = (now - lastLocationTimeRef.current) / 1000; // seconds
      if (timeDiff > 0) {
        // Calculate distance between two coordinates
        const distance = calculateDistance([
          {
            lat: lastKnownLocationRef.current.coords.latitude,
            lng: lastKnownLocationRef.current.coords.longitude,
            timestamp: new Date(lastLocationTimeRef.current).toISOString(),
          },
          {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            timestamp: timestamp,
          },
        ]);
        speed = (distance / timeDiff) * 3.6; // Convert m/s to km/h
      }
    }
    
    const settings = homeAreaSettingsRef.current;

    // Check if user is outside home area
    const outsideHome = isOutsideHomeArea(
      location.coords.latitude,
      location.coords.longitude,
      settings
    );

    // Update outside home area ref
    if (outsideHome !== isOutsideHomeAreaRef.current) {
      isOutsideHomeAreaRef.current = outsideHome;
      if (outsideHome) {
        console.log('Walk tracking: User left home area - walk tracking can start');
      } else {
        console.log('Walk tracking: User entered home area - walk tracking will pause');
      }
    }

    // Check if user is moving (using minimum speed from settings - only for starting)
    // Once tracking has started, ignore minimum speed to allow for pauses
    const isMoving = walkStartTimeRef.current ? true : speed >= settings.min_walk_speed_kmh;
    
    // Check maximum speed (with step detection to allow running)
    const hasSteps = stepData.steps > stepsAtWalkStartRef.current;
    const stepsSinceStart = stepData.steps - stepsAtWalkStartRef.current;
    const isLikelyRunning = hasSteps && stepsSinceStart > 50; // At least 50 steps indicates actual movement
    
    // If speed exceeds max AND user is not running (no steps), abort tracking (vehicle detected)
    if (speed > settings.max_walk_speed_kmh && !isLikelyRunning && walkStartTimeRef.current) {
      console.log(`Walk tracking: ⚠️ Speed too high (${speed.toFixed(1)}km/h) without steps - aborting (vehicle detected)`);
      stopTracking();
      return;
    }
    
    // Debug logging
    if (walkStartTimeRef.current) {
      const durationMinutes = (now - new Date(walkStartTimeRef.current).getTime()) / (1000 * 60);
      const distance = calculateDistance(walkCoordinatesRef.current);
      console.log(`Walk tracking: Speed=${speed.toFixed(1)}km/h, Distance=${distance.toFixed(0)}m, Duration=${durationMinutes.toFixed(1)}min, Steps=${stepsSinceStart}, OutsideHome=${outsideHome}`);
    }

    // Only track if user is outside home area
    if (isMoving && outsideHome) {
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

      // Start tracking if not already tracking
      if (!walkStartTimeRef.current) {
        walkStartTimeRef.current = new Date().toISOString();
        stepsAtWalkStartRef.current = stepData.steps;
        pauseStartTimeRef.current = null;
        pauseStartLocationRef.current = null;
        console.log('Walk tracking started - user outside home area');
      }

      // Check pause detection (only when tracking is active)
      const currentLocation = { lat: location.coords.latitude, lng: location.coords.longitude };
      const hasMovedFromPauseLocation = pauseStartLocationRef.current ? 
        calculateDistance([
          { lat: pauseStartLocationRef.current.lat, lng: pauseStartLocationRef.current.lng, timestamp: '' },
          { lat: currentLocation.lat, lng: currentLocation.lng, timestamp: '' }
        ]) > settings.pause_radius_meters : true;
      
      // Pause detection logic
      if (hasMovedFromPauseLocation) {
        // User has moved outside pause radius - reset pause detection
        pauseStartTimeRef.current = null;
        pauseStartLocationRef.current = null;
      } else if (pauseStartTimeRef.current) {
        // User is still within pause radius - check if pause time exceeded
        const pauseDurationMinutes = (now - pauseStartTimeRef.current) / (1000 * 60);
        if (pauseDurationMinutes >= settings.pause_tolerance_minutes) {
          // User has been stationary too long - check if this is shopping center walking
          const totalDistance = calculateDistance(walkCoordinatesRef.current);
          if (totalDistance < 50) {
            // Less than 50m total movement - likely shopping center, abort
            console.log(`Walk tracking: ⚠️ Pause too long (${pauseDurationMinutes.toFixed(1)}min) with minimal movement (${totalDistance.toFixed(0)}m) - aborting (shopping center detected)`);
            stopTracking();
            return;
          } else {
            // User has moved significantly before pausing - save walk (likely dog park)
            console.log(`Walk tracking: ⚠️ Pause too long (${pauseDurationMinutes.toFixed(1)}min) but significant movement (${totalDistance.toFixed(0)}m) - saving walk`);
            if (!walkStartTimeRef.current) return;
            const durationMinutes = (now - new Date(walkStartTimeRef.current).getTime()) / (1000 * 60);
            if (durationMinutes >= MIN_WALK_DURATION_MINUTES && totalDistance >= settings.min_walk_distance_meters) {
              const stepsDuringWalk = stepData.steps - stepsAtWalkStartRef.current;
              const deviceId = user ? null : await getDeviceId();
              const { error } = await saveWalk(
                user?.id || null,
                deviceId,
                [...walkCoordinatesRef.current],
                Math.max(0, stepsDuringWalk)
              );
              if (error) {
                console.error('Error saving walk:', error);
              }
            }
            stopTracking();
            return;
          }
        }
      } else if (!hasMovedFromPauseLocation && speed < settings.min_walk_speed_kmh) {
        // User just stopped (speed below minimum) - start pause detection
        if (!pauseStartTimeRef.current) {
          pauseStartTimeRef.current = now;
          pauseStartLocationRef.current = currentLocation;
          console.log(`Walk tracking: Pause detected - will abort if stationary for ${settings.pause_tolerance_minutes}min within ${settings.pause_radius_meters}m`);
        }
      }

      // Check if walk should be saved automatically
      if (walkStartTimeRef.current && walkCoordinatesRef.current.length >= 2) {
        const duration = now - new Date(walkStartTimeRef.current).getTime();
        const durationMinutes = duration / (1000 * 60);

        // Auto-save if walk meets criteria (using settings for minimum distance)
        if (distance >= settings.min_walk_distance_meters && durationMinutes >= MIN_WALK_DURATION_MINUTES) {
          console.log(`Walk tracking: ✅ Auto-saving walk! Distance: ${(distance / 1000).toFixed(2)}km, Duration: ${durationMinutes.toFixed(1)}min`);
          
          // Save current walk and start a new one
          const stepsDuringWalk = stepData.steps - stepsAtWalkStartRef.current;
          const deviceId = user ? null : await getDeviceId();
          const { error } = await saveWalk(
            user?.id || null,
            deviceId,
            [...walkCoordinatesRef.current],
            Math.max(0, stepsDuringWalk)
          );

          if (error) {
            console.error('Error auto-saving walk:', error);
          } else {
            console.log('Walk auto-saved successfully');
            
            // Start a new walk tracking session
            walkCoordinatesRef.current = [];
            stepsAtWalkStartRef.current = stepData.steps;
            lastLocationTimeRef.current = now;
            walkStartTimeRef.current = new Date().toISOString();
            
            setTrackingState(prev => ({
              ...prev,
              currentWalk: {
                coordinates: [],
                startTime: walkStartTimeRef.current!,
                distance: 0,
              },
            }));
          }
          
          return; // Don't update state with old walk data
        }
      }

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
    } else if (!outsideHome) {
      // User is inside home area - stop tracking if active
      if (walkStartTimeRef.current && walkCoordinatesRef.current.length >= 2) {
        const duration = now - new Date(walkStartTimeRef.current).getTime();
        const durationMinutes = duration / (1000 * 60);
        const distance = calculateDistance(walkCoordinatesRef.current);

        // Save walk if it meets criteria
        if (durationMinutes >= MIN_WALK_DURATION_MINUTES && distance >= settings.min_walk_distance_meters) {
          console.log('User returned home - saving walk');
          const stepsDuringWalk = stepData.steps - stepsAtWalkStartRef.current;
          const deviceId = user ? null : await getDeviceId();
          const { error } = await saveWalk(
            user?.id || null,
            deviceId,
            [...walkCoordinatesRef.current],
            Math.max(0, stepsDuringWalk)
          );

          if (error) {
            console.error('Error saving walk:', error);
          } else {
            console.log('Walk saved successfully');
          }
        }

        // Reset walk tracking
        walkCoordinatesRef.current = [];
        walkStartTimeRef.current = null;
        stepsAtWalkStartRef.current = stepData.steps;
        
        setTrackingState(prev => ({
          ...prev,
          currentWalk: null,
        }));
      }
    } else if (outsideHome && walkStartTimeRef.current) {
      // User is stationary but outside home area and tracking is active
      // Check pause detection even when stationary
      const currentLocation = { lat: location.coords.latitude, lng: location.coords.longitude };
      const hasMovedFromPauseLocation = pauseStartLocationRef.current ? 
        calculateDistance([
          { lat: pauseStartLocationRef.current.lat, lng: pauseStartLocationRef.current.lng, timestamp: '' },
          { lat: currentLocation.lat, lng: currentLocation.lng, timestamp: '' }
        ]) > settings.pause_radius_meters : true;
      
      if (hasMovedFromPauseLocation) {
        // User has moved outside pause radius - reset pause detection
        pauseStartTimeRef.current = null;
        pauseStartLocationRef.current = null;
      } else if (pauseStartTimeRef.current) {
        // User is still within pause radius - check if pause time exceeded
        const pauseDurationMinutes = (now - pauseStartTimeRef.current) / (1000 * 60);
        if (pauseDurationMinutes >= settings.pause_tolerance_minutes) {
          // User has been stationary too long - check if this is shopping center walking
          const totalDistance = calculateDistance(walkCoordinatesRef.current);
          if (totalDistance < 50) {
            // Less than 50m total movement - likely shopping center, abort
            console.log(`Walk tracking: ⚠️ Pause too long (${pauseDurationMinutes.toFixed(1)}min) with minimal movement (${totalDistance.toFixed(0)}m) - aborting (shopping center detected)`);
            stopTracking();
            return;
          } else {
            // User has moved significantly before pausing - save walk (likely dog park)
            console.log(`Walk tracking: ⚠️ Pause too long (${pauseDurationMinutes.toFixed(1)}min) but significant movement (${totalDistance.toFixed(0)}m) - saving walk`);
            if (!walkStartTimeRef.current) return;
            const durationMinutes = (now - new Date(walkStartTimeRef.current).getTime()) / (1000 * 60);
            if (durationMinutes >= MIN_WALK_DURATION_MINUTES && totalDistance >= settings.min_walk_distance_meters) {
              const stepsDuringWalk = stepData.steps - stepsAtWalkStartRef.current;
              const deviceId = user ? null : await getDeviceId();
              const { error } = await saveWalk(
                user?.id || null,
                deviceId,
                [...walkCoordinatesRef.current],
                Math.max(0, stepsDuringWalk)
              );
              if (error) {
                console.error('Error saving walk:', error);
              }
            }
            stopTracking();
            return;
          }
        }
      } else if (!hasMovedFromPauseLocation && speed < settings.min_walk_speed_kmh) {
        // User just stopped (speed below minimum) - start pause detection
        if (!pauseStartTimeRef.current) {
          pauseStartTimeRef.current = now;
          pauseStartLocationRef.current = currentLocation;
          console.log(`Walk tracking: Pause detected - will abort if stationary for ${settings.pause_tolerance_minutes}min within ${settings.pause_radius_meters}m`);
        }
      } else {
        // Fallback: check old stop detection threshold
        if (lastLocationTimeRef.current) {
          const timeSinceLastMovement = now - lastLocationTimeRef.current;
          if (timeSinceLastMovement >= STOP_DETECTION_THRESHOLD_MS) {
            // User has been stationary for 5 minutes - stop tracking and save walk
            console.log('Walk ended: User stationary for 5 minutes');
            stopTracking();
          }
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
    isOutsideHomeArea: isOutsideHomeAreaRef.current,
    startTracking,
    stopTracking,
    requestPermissions: requestLocationPermissions,
  };
};

