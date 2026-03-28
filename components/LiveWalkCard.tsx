import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { WalkCoordinate } from '../services/walkService';
import { APP_COLORS } from '../lib/mapConfig';
import { formatDistance, DistanceUnit } from '../lib/formatters';
import { useTranslation } from '../lib/i18n';

interface LiveWalkCardProps {
  coordinates: WalkCoordinate[];
  distance: number;
  startTime: string | null;
  distanceUnit: DistanceUnit;
}

export default function LiveWalkCard({
  coordinates,
  distance,
  startTime,
  distanceUnit,
}: LiveWalkCardProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0); // seconds
  const [modalVisible, setModalVisible] = useState(false);

  // Elapsed timer
  useEffect(() => {
    if (!startTime) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      setElapsed(Math.max(0, diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const paceText = useMemo(() => {
    if (distance < 200 || elapsed < 30) return '--:--';
    const distKm = distance / 1000;
    const totalMins = elapsed / 60;
    const paceMinKm = totalMins / distKm;
    const paceMin = Math.floor(paceMinKm);
    const paceSec = Math.round((paceMinKm - paceMin) * 60);
    return `${paceMin}:${String(paceSec).padStart(2, '0')}`;
  }, [distance, elapsed]);

  // Leaflet HTML used both for the preview card and the full-screen modal
  const interactiveMapHtml = useMemo(() => {
    if (coordinates.length < 1) return '';
    const pathCoords = coordinates.map(c => `[${c.lat},${c.lng}]`).join(',');
    const last = coordinates[coordinates.length - 1];
    const first = coordinates[0];
    const centerLat = last.lat;
    const centerLng = last.lng;
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { overflow: hidden; }
            #map { width: 100vw; height: 100vh; }
            @keyframes pulse {
              0%   { transform: scale(1);   opacity: 1; }
              50%  { transform: scale(1.6); opacity: 0.4; }
              100% { transform: scale(1);   opacity: 1; }
            }
            .pulse-ring {
              width: 20px; height: 20px;
              border-radius: 50%;
              background: rgba(33,150,243,0.35);
              animation: pulse 1.4s infinite;
              display: flex; align-items: center; justify-content: center;
            }
            .pulse-dot {
              width: 12px; height: 12px;
              border-radius: 50%;
              background: #2196F3;
              border: 2px solid white;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            const map = L.map('map', { zoomControl: false, attributionControl: false })
              .setView([${centerLat}, ${centerLng}], 16);

            const token = '${mapboxToken}';
            if (token) {
              L.tileLayer(
                'https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=' + token,
                { maxZoom: 19, tileSize: 512, zoomOffset: -1 }
              ).addTo(map);
            } else {
              L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                { maxZoom: 19 }
              ).addTo(map);
            }

            const coords = [${pathCoords}];
            const polyline = L.polyline(coords, {
              color: '${APP_COLORS.routePath}',
              weight: 6,
              opacity: 0.9
            }).addTo(map);

            // Start marker
            L.marker([${first.lat}, ${first.lng}], {
              icon: L.divIcon({
                className: '',
                html: '<div style="background:${APP_COLORS.startMarker};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
                iconSize: [14, 14], iconAnchor: [7, 7]
              })
            }).addTo(map);

            // Current position
            L.marker([${last.lat}, ${last.lng}], {
              icon: L.divIcon({
                className: '',
                html: '<div class="pulse-ring"><div class="pulse-dot"></div></div>',
                iconSize: [20, 20], iconAnchor: [10, 10]
              })
            }).addTo(map);

            if (coords.length >= 2) {
              map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
            }
          </script>
        </body>
      </html>
    `;
  }, [coordinates]);

  return (
    <>
      <View style={styles.container}>
        {/* Map preview — real Leaflet map, touch forwarded to modal opener */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setModalVisible(true)}
          style={styles.mapPreview}
        >
          {interactiveMapHtml ? (
            <WebView
              source={{ html: interactiveMapHtml }}
              style={styles.previewWebview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              pointerEvents="none"
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              androidHardwareAccelerationDisabled={false}
              startInLoadingState={false}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>📍</Text>
              <Text style={styles.mapPlaceholderLabel}>{t('screens.home.starting')}</Text>
            </View>
          )}

          {/* LIVE badge */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>

          {/* Tap hint */}
          <View style={styles.expandHint}>
            <Text style={styles.expandHintText}>⤢</Text>
          </View>
        </TouchableOpacity>

        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDistance(distance, distanceUnit)}</Text>
            <Text style={styles.statLabel}>{t('screens.home.distance')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDuration(elapsed)}</Text>
            <Text style={styles.statLabel}>{t('screens.home.duration')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{paceText}</Text>
            <Text style={styles.statLabel}>{t('screens.home.paceUnit')}</Text>
          </View>
        </View>
      </View>

      {/* Full-screen interactive map modal */}
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
            <Text style={styles.modalTitle}>{t('screens.home.liveWalkTitle')}</Text>
            {/* Stats in header */}
            <View style={styles.modalStats}>
              <Text style={styles.modalStatText}>{formatDistance(distance, distanceUnit)}</Text>
            </View>
          </View>
          {interactiveMapHtml ? (
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
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e9',
  },
  mapPreview: {
    height: 200,
    backgroundColor: '#e8f0e8',
    position: 'relative',
    overflow: 'hidden',
  },
  previewWebview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 32,
    marginBottom: 8,
  },
  mapPlaceholderLabel: {
    fontSize: 14,
    color: '#666',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F44336',
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  expandHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandHintText: {
    color: '#fff',
    fontSize: 14,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#ebebeb',
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  modalCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  modalCloseText: {
    fontSize: 16,
    color: APP_COLORS.primary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  modalStats: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  modalStatText: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.primary,
  },
  modalWebview: {
    flex: 1,
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
});
