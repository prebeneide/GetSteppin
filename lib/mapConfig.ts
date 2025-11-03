/**
 * Map Configuration
 * 
 * Supports multiple map providers with customizable styling
 * Priority: Mapbox > Google Maps > Fallback SVG
 */

import { encodePolyline } from './polylineEncoder';

// App theme colors
export const APP_COLORS = {
  primary: '#1ED760', // Spotify green - app's main color
  primaryDark: '#1DB954', // Darker green variant
  startMarker: '#1ED760', // Green for start marker
  endMarker: '#F44336', // Red for end marker
  routePath: '#1ED760', // Route path color
  background: '#ffffff', // Map background
  water: '#E3F2FD', // Light blue for water (lighter, app-themed)
  roads: '#FFFFFF', // White for roads
  buildings: '#F5F5F5', // Light gray for buildings
};

/**
 * Get Mapbox Static Image URL with custom styling
 * Requires Mapbox access token (set in .env as MAPBOX_ACCESS_TOKEN)
 */
export const getMapboxStaticMapUrl = (
  centerLat: number,
  centerLng: number,
  pathCoordinates: Array<{ lat: number; lng: number }>,
  startCoord: { lat: number; lng: number },
  endCoord: { lat: number; lng: number },
  width: number = 600,
  height: number = 500,
  accessToken?: string
): string => {
  if (!accessToken) {
    throw new Error('Mapbox access token required');
  }

  // Try polyline encoding - more compact than semicolon-separated
  // Polyline encoding can handle more points with shorter URL
  // Limit to 20-25 points for polyline (more than semicolon since it's compact)
  const maxPathPoints = 25;
  const limitedCoords = pathCoordinates.slice(0, maxPathPoints);
  
  // Option 1: Polyline encoding (more compact, supports more points)
  const encodedPathPolyline = encodePolyline(limitedCoords);
  
  // Option 2: Semicolon-separated (fallback if polyline doesn't work)
  const encodedPathSemicolon = limitedCoords
    .map(coord => `${coord.lng},${coord.lat}`)
    .join(';');
  
  // Use polyline if it's shorter (which it should be), otherwise semicolon
  const usePolyline = encodedPathPolyline.length < encodedPathSemicolon.length;
  const encodedPath = usePolyline ? encodedPathPolyline : encodedPathSemicolon;

  // Build Mapbox Static Images API URL
  // Using Mapbox Outdoors style as base (good for walking routes)
  const styleId = 'mapbox/outdoors-v12';
  
  // Path overlay with custom color
  // Format: path-<strokeWidth>+<color>+<opacity>(<path-data>)
  // Color without # and with opacity (0.8 = 80 in hex)
  const routeColor = APP_COLORS.routePath.replace('#', '');
  
  // Build path overlay - Mapbox Static Images API
  // Format options:
  // 1. path-<width>+<color>(<path-data>) - semicolon separated: lng,lat;lng,lat
  // 2. path-<width>+<color>+<opacity>(<path-data>) - with opacity
  
  // Try with just start and end points first (simplest test)
  // Then add more points if that works
  let pathOverlay = '';
  
  // Build path overlay - Mapbox supports both polyline and semicolon-separated
  // Polyline encoding is more compact and allows more points
  if (encodedPath && encodedPath.length < 500) {
    // Try with polyline format first: path-width+color(polyline-string)
    // Mapbox Static Images API should accept polyline encoding
    pathOverlay = `path-5+${routeColor}(${encodedPath})`;
    
    // Path overlay successfully created
  } else if (encodedPath) {
    console.warn('Path too long (' + encodedPath.length + ' chars), using only start/end');
    // Fallback: just start and end points (always semicolon format)
    const startEndPath = `${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}`;
    pathOverlay = `path-5+${routeColor}(${startEndPath})`;
  }

  // Markers for start and end
  // Format: pin-s-<size>+<color>(<lng>,<lat>)
  const markers = [
    `pin-s-s+${APP_COLORS.startMarker.replace('#', '')}(${startCoord.lng},${startCoord.lat})`,
    `pin-s-e+${APP_COLORS.endMarker.replace('#', '')}(${endCoord.lng},${endCoord.lat})`,
  ].join(',');

  // Build overlays - Mapbox Static Images API format
  // Format: path-width+color(path-data),pin-s-label+color(lng,lat)
  // Path MUST come before markers, separated by comma
  // Each overlay component should be properly formatted
  
  // Build overlay string - path first (if exists), then markers
  let overlayString = '';
  
  if (pathOverlay && pathOverlay.length > 0) {
    // Add path first
    overlayString = pathOverlay;
    if (markers && markers.length > 0) {
      // Add markers after path, comma separated
      overlayString += ',' + markers;
    }
  } else if (markers && markers.length > 0) {
    // Just markers if no path
    overlayString = markers;
  } else {
    // No overlays, just return a basic map
    const url = `https://api.mapbox.com/styles/v1/${styleId}/static/${centerLng},${centerLat},14/${width}x${height}@2x?access_token=${accessToken}`;
    return url;
  }
  
  // Build URL - Mapbox Static Images API format:
  // https://api.mapbox.com/styles/v1/{style_id}/static/{overlay}/{lon},{lat},{zoom}/{width}x{height}{@2x}?access_token={token}
  
  // IMPORTANT: Mapbox requires the overlay parameter to be URL-encoded
  // However, the path data WITHIN the overlay should NOT be double-encoded
  // Format: path-5+1ED760(10.752,59.913;10.761,59.921),pin-s-s+1ED760(10.752,59.913)
  
  // Check URL length before encoding (to avoid issues)
  const testUrl = `https://api.mapbox.com/styles/v1/${styleId}/static/${overlayString}/${centerLng},${centerLat},14/${width}x${height}@2x?access_token=${accessToken}`;
  
  // If URL would be too long, fall back to markers only
  if (testUrl.length > 2000 && pathOverlay) {
    console.warn('Mapbox: URL too long, using markers only');
    overlayString = markers;
  }
  
  // URL encode the ENTIRE overlay string
  // This is critical - Mapbox Static Images API requires the overlay parameter to be URL-encoded
  const encodedOverlays = encodeURIComponent(overlayString);
  const url = `https://api.mapbox.com/styles/v1/${styleId}/static/${encodedOverlays}/${centerLng},${centerLat},14/${width}x${height}@2x?access_token=${accessToken}`;
  
  // Debug logging (reduced - only log if there are issues)
  if (pathOverlay) {
    console.log('Mapbox: Path overlay created (' + (usePolyline ? 'polyline' : 'semicolon') + ', ' + encodedPath.length + ' chars)');
  }
  
  return url;
};

/**
 * Get Google Maps Static Map URL with custom styling
 * Requires Google Maps API key (set in .env as GOOGLE_MAPS_API_KEY)
 */
export const getGoogleStaticMapUrl = (
  centerLat: number,
  centerLng: number,
  pathCoordinates: Array<{ lat: number; lng: number }>,
  startCoord: { lat: number; lng: number },
  endCoord: { lat: number; lng: number },
  width: number = 600,
  height: number = 500,
  apiKey?: string
): string => {
  // Limit path points for Google Maps (max ~100 points in path)
  const pathForMap = pathCoordinates
    .slice(0, 100)
    .map(c => `${c.lat},${c.lng}`)
    .join('|');

  const startMarker = `${startCoord.lat},${startCoord.lng}`;
  const endMarker = `${endCoord.lat},${endCoord.lng}`;

  // URL encode markers and path
  const markers = [
    `color:${APP_COLORS.startMarker.replace('#', '0x')}|label:S|${startMarker}`,
    `color:${APP_COLORS.endMarker.replace('#', '0x')}|label:E|${endMarker}`,
  ].map(m => encodeURIComponent(m)).join('&markers=');

  const path = `weight:4|color:${APP_COLORS.routePath.replace('#', '0x')}|${encodeURIComponent(pathForMap)}`;

  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams({
    center: `${centerLat},${centerLng}`,
    zoom: '14',
    size: `${width}x${height}`,
    scale: '2',
    maptype: 'roadmap',
    markers: markers,
    path: path,
  });

  if (apiKey) {
    params.append('key', apiKey);
  }

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Get the best available map URL based on configured providers
 */
export const getMapUrl = (
  centerLat: number,
  centerLng: number,
  pathCoordinates: Array<{ lat: number; lng: number }>,
  startCoord: { lat: number; lng: number },
  endCoord: { lat: number; lng: number },
  width: number = 600,
  height: number = 500
): { url: string | null; provider: 'mapbox' | 'google' | null; requiresKey: boolean } => {
  // Check for Mapbox token first (priority)
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (mapboxToken) {
    try {
      const url = getMapboxStaticMapUrl(
        centerLat,
        centerLng,
        pathCoordinates,
        startCoord,
        endCoord,
        width,
        height,
        mapboxToken
      );
      return { url, provider: 'mapbox', requiresKey: true };
    } catch (err) {
      console.warn('Mapbox URL generation failed:', err);
    }
  }

  // Fallback to Google Maps
  const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    const url = getGoogleStaticMapUrl(
      centerLat,
      centerLng,
      pathCoordinates,
      startCoord,
      endCoord,
      width,
      height,
      googleApiKey
    );
    return { url, provider: 'google', requiresKey: true };
  }

  // No API keys configured - return null (will use SVG fallback)
  return { url: null, provider: null, requiresKey: true };
};

