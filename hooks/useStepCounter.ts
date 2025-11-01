import { useState, useEffect } from 'react';
import { Pedometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: EventSubscription | null = null;
    let isActive = true;

    const checkAvailability = async () => {
      try {
        // Check if pedometer is available on this device
        const isAvailable = await Pedometer.isAvailableAsync();
        
        if (!isAvailable) {
          if (isActive) {
            setError('Skrittteller er ikke tilgjengelig på denne enheten');
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
              setError('Tillatelse til å bruke skrittteller ble ikke gitt');
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
            // Calculate distance (assuming average step length of 0.75 meters)
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

        // Subscribe to step updates (works on both iOS and Android)
        subscription = Pedometer.watchStepCount((result: { steps: number }) => {
          if (isActive) {
            // Calculate distance (assuming average step length of 0.75 meters)
            const distanceInMeters = result.steps * 0.75;
            setStepData({
              steps: result.steps,
              distance: Math.round(distanceInMeters),
              isAvailable: true,
            });
          }
        });
      } catch (err: any) {
        console.error('Step counter error:', err);
        if (isActive) {
          setError(err.message || 'Feil ved henting av skrittdata');
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

