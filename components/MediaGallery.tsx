import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { WebView } from 'react-native-webview';
import { Linking } from 'react-native';
import { WalkCoordinate } from '../services/walkService';
import { getMapUrl, APP_COLORS } from '../lib/mapConfig';
import Svg, { Polyline, Circle } from 'react-native-svg';
import WalkMapView from './WalkMapView';

interface MediaItem {
  type: 'image' | 'map';
  url?: string; // For images
  coordinates?: WalkCoordinate[]; // For map
  index: number;
}

interface MediaGalleryProps {
  images: string[];
  coordinates?: WalkCoordinate[];
  primaryImageIndex?: number;
  mapPosition?: number; // Position in the slider (after which image index)
  height?: number;
}

export default function MediaGallery({
  images,
  coordinates,
  primaryImageIndex = 0,
  mapPosition = -1, // -1 means map at the end, otherwise position after image index
  height = 300,
}: MediaGalleryProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build media items array: images + map
  const mediaItems: MediaItem[] = useMemo(() => {
    const items: MediaItem[] = [];
    
    // Add images
    images.forEach((url, idx) => {
      items.push({
        type: 'image',
        url,
        index: idx,
      });
    });
    
    // Add map if coordinates exist
    if (coordinates && coordinates.length >= 2) {
      const mapIndex = mapPosition === -1 
        ? items.length // Add at end if -1
        : Math.min(mapPosition + 1, items.length); // Add after specified image index
      
      items.splice(mapIndex, 0, {
        type: 'map',
        coordinates,
        index: mapIndex,
      });
    }
    
    // Sort by primary image index if specified
    if (primaryImageIndex >= 0 && primaryImageIndex < images.length && primaryImageIndex !== 0) {
      const primaryItem = items.find(item => item.type === 'image' && item.index === primaryImageIndex);
      if (primaryItem) {
        const primaryIdx = items.indexOf(primaryItem);
        items.splice(primaryIdx, 1);
        items.unshift(primaryItem);
        // Update all indices after moving
        items.forEach((item, idx) => {
          item.index = idx;
        });
      }
    }
    
    return items;
  }, [images, coordinates, primaryImageIndex, mapPosition]);

  if (mediaItems.length === 0) {
    return null;
  }

  const screenWidth = Dimensions.get('window').width;

  return (
    <>
      <View style={[styles.container, { height }]}>
        {/* Horizontal scrollable media gallery */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.mediaScrollView}
          contentContainerStyle={styles.mediaScrollContent}
          snapToInterval={screenWidth}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / screenWidth
            );
            setSelectedIndex(index);
          }}
        >
          {mediaItems.map((item, index) => (
            <View key={index} style={styles.mediaSlideContainer}>
              {item.type === 'image' ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedIndex(index);
                    setModalVisible(true);
                  }}
                  style={styles.mediaSlide}
                >
                  <ExpoImage
                    source={{ uri: item.url }}
                    style={styles.mediaSlideImage}
                    contentFit="cover"
                    transition={200}
                  />
                </TouchableOpacity>
              ) : (
                <MapSlide
                  coordinates={item.coordinates!}
                  height={height}
                  onPress={() => {
                    setSelectedIndex(index);
                    setModalVisible(true);
                  }}
                />
              )}
              
              {/* Media counter overlay */}
              {mediaItems.length > 1 && (
                <View style={styles.mediaCounterOverlay}>
                  <Text style={styles.mediaCounterText}>
                    {index + 1} / {mediaItems.length}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Dots indicator for multiple items */}
        {mediaItems.length > 1 && (
          <View style={styles.dotsIndicator}>
            {mediaItems.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === selectedIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Fullscreen Modal */}
      <Modal
        visible={modalVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.closeButtonContent}>
              <View style={styles.closeButtonLine1} />
              <View style={styles.closeButtonLine2} />
            </View>
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / screenWidth
              );
              setSelectedIndex(index);
            }}
            contentOffset={{ x: screenWidth * selectedIndex, y: 0 }}
          >
            {mediaItems.map((item, index) => (
              <View key={index} style={{ width: screenWidth }}>
                {item.type === 'image' ? (
                  <ExpoImage
                    source={{ uri: item.url }}
                    style={styles.fullscreenImage}
                    contentFit="contain"
                  />
                ) : (
                  <InteractiveMapView
                    coordinates={item.coordinates!}
                    height={Dimensions.get('window').height}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Media counter */}
          <View style={styles.imageCounter}>
            <View style={styles.counterContent}>
              {mediaItems.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.counterDot,
                    index === selectedIndex && styles.counterDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaScrollView: {
    width: '100%',
    height: '100%',
  },
  mediaScrollContent: {
    alignItems: 'center',
  },
  mediaSlideContainer: {
    width: Dimensions.get('window').width,
    height: '100%',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  mediaSlide: {
    width: '100%',
    height: '100%',
  },
  mediaSlideImage: {
    width: '100%',
    height: '100%',
  },
  mediaCounterOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsIndicator: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 22,
  },
  closeButtonContent: {
    width: 20,
    height: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonLine1: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
    top: '50%',
    marginTop: -1,
  },
  closeButtonLine2: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '-45deg' }],
    top: '50%',
    marginTop: -1,
  },
  fullscreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageCounter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counterContent: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  counterDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
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
  svgContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  svgMap: {
    width: '100%',
    height: '100%',
  },
});

// Interactive map view for modal (full screen with zoom)
interface InteractiveMapViewProps {
  coordinates: WalkCoordinate[];
  height: number;
}

function InteractiveMapView({ coordinates, height }: InteractiveMapViewProps) {
  // Calculate center and bounds
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  // Sample coordinates for map display
  const maxPoints = 100;
  const sampledCoordinates = coordinates.length > maxPoints 
    ? coordinates.filter((_, index) => index % Math.ceil(coordinates.length / maxPoints) === 0)
    : coordinates;
  
  const pathCoordinates = sampledCoordinates.map(c => ({ lat: c.lat, lng: c.lng }));
  const startCoord = { lat: coordinates[0].lat, lng: coordinates[0].lng };
  const endCoord = { 
    lat: coordinates[coordinates.length - 1].lat, 
    lng: coordinates[coordinates.length - 1].lng 
  };

  // Google Maps URL for opening in app
  const googleMapsUrl = `https://www.google.com/maps/dir/${startCoord.lat},${startCoord.lng}/${endCoord.lat},${endCoord.lng}/@${centerLat},${centerLng},14z`;

  const handleOpenInMaps = () => {
    Linking.openURL(googleMapsUrl).catch(err => {
      console.error('Error opening map:', err);
    });
  };

  // Create interactive map HTML
  const interactiveMapHtml = useMemo(() => {
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
            .leaflet-control-zoom {
              margin-top: 60px !important;
            }
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
            }).addTo(map).bindPopup('Start');
            
            // Add end marker (red)
            const endMarker = L.marker([${endCoord.lat}, ${endCoord.lng}], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: ${APP_COLORS.endMarker}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">E</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(map).bindPopup('Slutt');
          </script>
        </body>
      </html>
    `;
  }, [pathCoordinates, centerLat, centerLng, startCoord, endCoord]);

  return (
    <View style={{ width: '100%', height: '100%' }}>
      <WebView
        source={{ html: interactiveMapHtml }}
        style={{ width: '100%', height: '100%' }}
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
  );
}

// Map slide component (simplified version of WalkMapView for inline use)
interface MapSlideProps {
  coordinates: WalkCoordinate[];
  height: number;
  onPress: () => void;
  showOpenButton?: boolean;
}

function MapSlide({ coordinates, height, onPress, showOpenButton = false }: MapSlideProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Calculate center and bounds
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  // Sample coordinates for map display
  const maxPoints = 100;
  const sampledCoordinates = coordinates.length > maxPoints 
    ? coordinates.filter((_, index) => index % Math.ceil(coordinates.length / maxPoints) === 0)
    : coordinates;
  
  const pathCoordinates = sampledCoordinates.map(c => ({ lat: c.lat, lng: c.lng }));
  const startCoord = { lat: coordinates[0].lat, lng: coordinates[0].lng };
  const endCoord = { 
    lat: coordinates[coordinates.length - 1].lat, 
    lng: coordinates[coordinates.length - 1].lng 
  };

  // Get map URL
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

  // SVG fallback
  const { pointsAttr, startPoint, endPoint } = useMemo(() => {
    const padding = 12;
    const width = 600;
    const heightPx = Math.max(200, height * 2);

    const latRange = Math.max(1e-6, maxLat - minLat);
    const lngRange = Math.max(1e-6, maxLng - minLng);

    const toPoint = (c: WalkCoordinate) => {
      const x = padding + ((c.lng - minLng) / lngRange) * (width - padding * 2);
      const y = padding + ((maxLat - c.lat) / latRange) * (heightPx - padding * 2);
      return { x, y };
    };

    const pts = sampledCoordinates.map(toPoint);
    const pointsAttrStr = pts.map(p => `${p.x},${p.y}`).join(' ');
    const sp = toPoint(sampledCoordinates[0]);
    const ep = toPoint(sampledCoordinates[sampledCoordinates.length - 1]);
    return { pointsAttr: pointsAttrStr, startPoint: sp, endPoint: ep };
  }, [sampledCoordinates, minLat, maxLat, minLng, maxLng, height]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.mediaSlide}
    >
      {imageLoading && !imageError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
        </View>
      )}
      
      {staticMapUrl && !imageError && hasApiKey ? (
        <ExpoImage
          source={{ uri: staticMapUrl }}
          style={styles.mediaSlideImage}
          contentFit="cover"
          transition={200}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
      ) : (
        <View style={styles.svgContainer}>
          <Svg
            viewBox={`0 0 600 ${Math.max(200, height * 2)}`}
            style={styles.svgMap}
          >
            <Polyline
              points={pointsAttr}
              fill="none"
              stroke={APP_COLORS.routePath}
              strokeWidth="4"
            />
            <Circle
              cx={startPoint.x}
              cy={startPoint.y}
              r="8"
              fill={APP_COLORS.startMarker}
            />
            <Circle
              cx={endPoint.x}
              cy={endPoint.y}
              r="8"
              fill={APP_COLORS.endMarker}
            />
          </Svg>
        </View>
      )}
    </TouchableOpacity>
  );
}

