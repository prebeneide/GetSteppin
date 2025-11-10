import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { WalkCoordinate } from '../services/walkService';
import Svg, { Polyline, Circle, Rect } from 'react-native-svg';
import { getMapUrl, APP_COLORS } from '../lib/mapConfig';
import { useTranslation } from '../lib/i18n';

interface WalkMapViewProps {
  coordinates: WalkCoordinate[];
  height?: number;
  showOpenButton?: boolean;
}

export default function WalkMapView({ coordinates, height = 250, showOpenButton = true }: WalkMapViewProps) {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  // Calculate center and bounds
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  // Sample coordinates for map display (limit points for API efficiency)
  const maxPoints = 100;
  const sampledCoordinates = coordinates.length > maxPoints 
    ? coordinates.filter((_, index) => index % Math.ceil(coordinates.length / maxPoints) === 0)
    : coordinates;
  
  // Create coordinate arrays for map APIs
  const pathCoordinates = sampledCoordinates.map(c => ({ lat: c.lat, lng: c.lng }));
  const startCoord = { lat: coordinates[0].lat, lng: coordinates[0].lng };
  const endCoord = { 
    lat: coordinates[coordinates.length - 1].lat, 
    lng: coordinates[coordinates.length - 1].lng 
  };

  // Get map URL from configured provider (Mapbox > Google > null)
  const mapConfig = useMemo(() => getMapUrl(
    centerLat,
    centerLng,
    pathCoordinates,
    startCoord,
    endCoord,
    600,
    height * 2
  ), [centerLat, centerLng, pathCoordinates, startCoord, endCoord, height]);

  const staticMapUrl = mapConfig.url;
  const hasApiKey = mapConfig.provider !== null;

  // Google Maps URL for opening in app
  const googleMapsUrl = `https://www.google.com/maps/dir/${startCoord.lat},${startCoord.lng}/${endCoord.lat},${endCoord.lng}/@${centerLat},${centerLng},14z`;

  const handleOpenInMaps = () => {
    Linking.openURL(googleMapsUrl).catch(err => {
      console.error('Error opening map:', err);
    });
  };

  // Compute points for SVG fallback (always available)
  const { pointsAttr, startPoint, endPoint } = useMemo(() => {
    const padding = 12;
    const width = 600; // arbitrary canvas size; will scale to container via viewBox
    const heightPx = Math.max(200, height * 2);

    const latMin = minLat;
    const latMax = maxLat;
    const lngMin = minLng;
    const lngMax = maxLng;

    const latRange = Math.max(1e-6, latMax - latMin);
    const lngRange = Math.max(1e-6, lngMax - lngMin);

    const toPoint = (c: WalkCoordinate) => {
      const x = padding + ((c.lng - lngMin) / lngRange) * (width - padding * 2);
      // Invert Y because lat increases upwards while SVG increases downwards
      const y = padding + ((latMax - c.lat) / latRange) * (heightPx - padding * 2);
      return { x, y };
    };

    const pts = sampledCoordinates.map(toPoint);
    const pointsAttrStr = pts.map(p => `${p.x},${p.y}`).join(' ');
    const sp = toPoint(sampledCoordinates[0]);
    const ep = toPoint(sampledCoordinates[sampledCoordinates.length - 1]);
    return { pointsAttr: pointsAttrStr, startPoint: sp, endPoint: ep };
  }, [sampledCoordinates, minLat, maxLat, minLng, maxLng, height]);

  // Create interactive map HTML for modal
  const interactiveMapHtml = useMemo(() => {
    const pathData = pathCoordinates.map(c => `${c.lng},${c.lat}`).join(';');
    const startLabel = t('common.start');
    const endLabel = t('common.end');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { margin: 0; padding: 0; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            #map { width: 100vw; height: 100vh; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            // Initialize map
            const map = L.map('map').setView([${centerLat}, ${centerLng}], 14);
            
            // Add Mapbox tile layer (requires token, but works with public token)
            const mapboxToken = '${process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ''}';
            if (mapboxToken) {
              L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=' + mapboxToken, {
                attribution: '© Mapbox © OpenStreetMap',
                maxZoom: 19,
                tileSize: 512,
                zoomOffset: -1
              }).addTo(map);
            } else {
              // Fallback to OpenStreetMap
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
              }).addTo(map);
            }
            
            // Create polyline from coordinates
            const coordinates = [${pathCoordinates.map(c => `[${c.lat}, ${c.lng}]`).join(', ')}];
            const polyline = L.polyline(coordinates, {
              color: '${APP_COLORS.routePath}',
              weight: 6,
              opacity: 0.9
            }).addTo(map);
            
            // Fit map to show entire route
            map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
            
            // Add start marker (green)
            const startMarker = L.marker([${startCoord.lat}, ${startCoord.lng}], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: ${APP_COLORS.startMarker}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">S</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(map).bindPopup('${startLabel}');
            
            // Add end marker (red)
            const endMarker = L.marker([${endCoord.lat}, ${endCoord.lng}], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: ${APP_COLORS.endMarker}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">E</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(map).bindPopup('${endLabel}');
          </script>
        </body>
      </html>
    `;
  }, [pathCoordinates, centerLat, centerLng, startCoord, endCoord, t]);

  return (
    <>
      <View style={[styles.container, { height }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
          style={styles.mapTouchable}
        >
        {staticMapUrl && !imageError ? (
          <View style={styles.imageContainer}>
            {imageLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color={APP_COLORS.primary} />
              </View>
            )}
            <Image
              source={{ uri: staticMapUrl }}
              style={styles.webview}
              contentFit="cover"
              transition={200}
              onError={(error) => {
                console.log('Map image error:', error);
                console.log('Failed URL length:', staticMapUrl?.length);
                console.log('Map provider:', mapConfig.provider);
                console.log('URL (first 200 chars):', staticMapUrl?.substring(0, 200));
                setImageError(true);
                setImageLoading(false);
              }}
              onLoadStart={() => {
                setImageLoading(true);
                setImageError(false);
              }}
              onLoad={() => {
                console.log('Map image loaded successfully');
                setImageLoading(false);
              }}
            />
          </View>
        ) : (
          // Offline SVG fallback showing the route path
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 600 ${Math.max(200, height * 2)}`}
          >
            <Rect x="0" y="0" width="600" height={Math.max(200, height * 2)} fill="#eaeaea" />
            <Polyline
              points={pointsAttr}
              fill="none"
              stroke={APP_COLORS.routePath}
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Start and end markers */}
            <Circle cx={startPoint.x} cy={startPoint.y} r="8" fill={APP_COLORS.startMarker} stroke="#ffffff" strokeWidth="3" />
            <Circle cx={endPoint.x} cy={endPoint.y} r="8" fill={APP_COLORS.endMarker} stroke="#ffffff" strokeWidth="3" />
          </Svg>
        )}
      </TouchableOpacity>
      {showOpenButton && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.openButton}
            onPress={handleOpenInMaps}
          >
            <Text style={styles.openButtonText}>{t('common.openInGoogleMaps')} →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>

    {/* Fullscreen Interactive Map Modal */}
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalCloseText}>{t('common.backArrow')}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{t('common.route')}</Text>
          <TouchableOpacity
            style={styles.modalOpenButton}
            onPress={handleOpenInMaps}
          >
            <Text style={styles.modalOpenText}>{t('common.open')} →</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ html: interactiveMapHtml }}
          style={styles.modalWebview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_COLORS.primary} />
            </View>
          )}
        />
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  mapTouchable: {
    width: '100%',
    height: '100%',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    zIndex: 1,
  },
  webview: {
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  modalCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCloseText: {
    fontSize: 16,
    color: APP_COLORS.primary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  modalOpenButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalOpenText: {
    fontSize: 14,
    color: APP_COLORS.primary,
    fontWeight: '600',
  },
  modalWebview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  fallbackSubtext: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  buttonContainer: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  openButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1ED760',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  openButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

