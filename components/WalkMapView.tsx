import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Modal, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { WalkCoordinate } from '../services/walkService';
import { APP_COLORS } from '../lib/mapConfig';
import { useTranslation } from '../lib/i18n';

interface WalkMapViewProps {
  coordinates: WalkCoordinate[];
  height?: number;
  showOpenButton?: boolean;
}

export default function WalkMapView({ coordinates, height = 250, showOpenButton = true }: WalkMapViewProps) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const maxPoints = 100;
  const sampled = coordinates.length > maxPoints
    ? coordinates.filter((_, i) => i % Math.ceil(coordinates.length / maxPoints) === 0)
    : coordinates;

  const pathCoordinates = sampled.map(c => ({ lat: c.lat, lng: c.lng }));
  const startCoord = { lat: coordinates[0].lat, lng: coordinates[0].lng };
  const endCoord = {
    lat: coordinates[coordinates.length - 1].lat,
    lng: coordinates[coordinates.length - 1].lng,
  };
  const centerLat = (startCoord.lat + endCoord.lat) / 2;
  const centerLng = (startCoord.lng + endCoord.lng) / 2;

  const googleMapsUrl = `https://www.google.com/maps/dir/${startCoord.lat},${startCoord.lng}/${endCoord.lat},${endCoord.lng}/@${centerLat},${centerLng},14z`;

  const mapHtml = useMemo(() => {
    const pathCoords = pathCoordinates.map(c => `[${c.lat},${c.lng}]`).join(',');
    const startLabel = t('common.start');
    const endLabel = t('common.end');
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{overflow:hidden}#map{width:100vw;height:100vh}</style>
</head><body><div id="map"></div><script>
const map=L.map('map',{zoomControl:false,attributionControl:false});
const token='${mapboxToken}';
if(token){L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token='+token,{tileSize:512,zoomOffset:-1,maxZoom:19}).addTo(map);}
else{L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);}
const coords=[${pathCoords}];
const poly=L.polyline(coords,{color:'${APP_COLORS.routePath}',weight:6,opacity:0.9}).addTo(map);
map.fitBounds(poly.getBounds(),{padding:[20,20]});
L.marker([${startCoord.lat},${startCoord.lng}],{icon:L.divIcon({className:'',html:'<div style="background:${APP_COLORS.startMarker};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px">S</div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map).bindPopup('${startLabel}');
L.marker([${endCoord.lat},${endCoord.lng}],{icon:L.divIcon({className:'',html:'<div style="background:${APP_COLORS.endMarker};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px">E</div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map).bindPopup('${endLabel}');
</script></body></html>`;
  }, [pathCoordinates, centerLat, centerLng, startCoord, endCoord, t]);

  return (
    <>
      <View style={[styles.container, { height }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setModalVisible(true)}
          style={styles.mapTouchable}
        >
          <WebView
            source={{ html: mapHtml }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            pointerEvents="none"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            overScrollMode="never"
            startInLoadingState={false}
          />
        </TouchableOpacity>
        {showOpenButton && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.openButton}
              onPress={() => Linking.openURL(googleMapsUrl).catch(() => {})}
            >
              <Text style={styles.openButtonText}>{t('common.openInGoogleMaps')} →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.backArrow')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('common.route')}</Text>
            <TouchableOpacity
              style={styles.modalOpenButton}
              onPress={() => Linking.openURL(googleMapsUrl).catch(() => {})}
            >
              <Text style={styles.modalOpenText}>{t('common.open')} →</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: mapHtml }}
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
  webview: {
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
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
  },
  loadingContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
});
