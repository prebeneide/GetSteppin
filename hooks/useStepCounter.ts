import { useState, useEffect, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';

export type StepCounterErrorCode = 'not_available' | 'permission_denied' | 'unknown';

interface StepData {
  steps: number;
  distance: number; // in meters
  isAvailable: boolean;
}

export const useStepCounter = () => {
  const [stepData, setStepData] = useState<StepData>({
    steps: 0,
    distance: 0,
    isAvailable: false,
  });
  const [error, setError] = useState<StepCounterErrorCode | null>(null);
  // Steps since midnight fetched via getStepCountAsync — used as base for watchStepCount deltas
  const initialStepsRef = useRef<number>(0);

  useEffect(() => {
    let subscription: EventSubscription | null = null;
    let isActive = true;

    const checkAvailability = async () => {
      try {
        // Check if pedometer is available on this device
        const isAvailable = await Pedometer.isAvailableAsync();
        
        if (!isAvailable) {
          if (isActive) {
            setError('not_available');
            setStepData(prev => ({ ...prev, isAvailable: false }));
          }
          return;
        }

        // Check and request permissions
        let { status } = await Pedometer.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Pedometer.requestPermissionsAsync();
          if (newStatus !== 'granted') {
            if (isActive) {
              setError('permission_denied');
              setStepData(prev => ({ ...prev, isAvailable: false }));
            }
            return;
          }
          status = newStatus;
        }

        if (isActive) {
          setStepData(prev => ({ ...prev, isAvailable: true }));
          setError(null);
        }

        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        // Get initial step count for today (iOS only, or use watchStepCount on Android)
        try {
          const result = await Pedometer.getStepCountAsync(startOfDay, endOfDay);
          if (isActive) {
            initialStepsRef.current = result.steps;
            const distanceInMeters = result.steps * 0.75;
            setStepData({
              steps: result.steps,
              distance: Math.round(distanceInMeters),
              isAvailable: true,
            });
          }
        } catch (err) {
          console.log('getStepCountAsync not available (Android?), using watchStepCount');
        }

        // Subscribe to step updates (works on both iOS and Android).
        // watchStepCount returns steps since the subscription started (delta from 0),
        // so we add the initial count to keep the total since midnight.
        subscription = Pedometer.watchStepCount((result: { steps: number }) => {
          if (isActive) {
            const totalSteps = initialStepsRef.current + result.steps;
            const distanceInMeters = totalSteps * 0.75;
            setStepData({
              steps: totalSteps,
              distance: Math.round(distanceInMeters),
              isAvailable: true,
            });
          }
        });
      } catch (err: any) {
        console.error('Step counter error:', err);
        if (isActive) {
          setError('unknown');
          setStepData(prev => ({ ...prev, isAvailable: false }));
        }
      }
    };

    checkAvailability();

    return () => {
      isActive = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return { stepData, error };
};

