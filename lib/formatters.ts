/**
 * Formatting utilities for internationalization
 * Phase 1: Distance formatting
 */

export type DistanceUnit = 'km' | 'mi';

/**
 * Convert meters to kilometers
 */
const metersToKilometers = (meters: number): number => {
  return meters / 1000;
};

/**
 * Convert meters to miles
 */
const metersToMiles = (meters: number): number => {
  return meters / 1609.34;
};

/**
 * Format distance in meters to the specified unit
 * @param meters - Distance in meters
 * @param unit - Target unit ('km' or 'mi')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted distance string (e.g., "5.00 km" or "3.11 mi")
 */
export const formatDistance = (
  meters: number,
  unit: DistanceUnit = 'km',
  decimals: number = 2
): string => {
  if (meters < 0) {
    return '0.00 ' + (unit === 'km' ? 'km' : 'mi');
  }

  let distance: number;
  let unitLabel: string;

  if (unit === 'km') {
    distance = metersToKilometers(meters);
    unitLabel = 'km';
  } else {
    distance = metersToMiles(meters);
    unitLabel = 'mi';
  }

  // For very short distances, show in meters if using km
  if (unit === 'km' && distance < 0.1) {
    return `${Math.round(meters)} m`;
  }

  // For very short distances in miles, show in feet
  if (unit === 'mi' && distance < 0.01) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }

  return `${distance.toFixed(decimals)} ${unitLabel}`;
};

/**
 * Convert distance from one unit to another
 * @param value - Distance value
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted distance value
 */
export const convertDistance = (
  value: number,
  fromUnit: DistanceUnit,
  toUnit: DistanceUnit
): number => {
  if (fromUnit === toUnit) {
    return value;
  }

  // Convert to meters first, then to target unit
  let meters: number;
  if (fromUnit === 'km') {
    meters = value * 1000;
  } else {
    meters = value * 1609.34;
  }

  if (toUnit === 'km') {
    return meters / 1000;
  } else {
    return meters / 1609.34;
  }
};

/**
 * Format speed in km/h to the specified unit
 * @param kmh - Speed in km/h
 * @param unit - Target unit ('km' or 'mi')
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted speed string (e.g., "5.0 km/h" or "3.1 mph")
 */
export const formatSpeed = (
  kmh: number,
  unit: DistanceUnit = 'km',
  decimals: number = 1
): string => {
  if (unit === 'km') {
    return `${kmh.toFixed(decimals)} km/h`;
  } else {
    // Convert km/h to mph (1 km/h = 0.621371 mph)
    const mph = kmh * 0.621371;
    return `${mph.toFixed(decimals)} mph`;
  }
};

