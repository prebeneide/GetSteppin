import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
// MapView removed - requires native modules not available in Expo managed workflow
// To enable maps, use expo-dev-client or EAS Build with react-native-maps configured
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Walk, WalkCoordinate } from '../services/walkService';
import { createPostFromWalk } from '../services/postService';
import AlertModal from '../components/AlertModal';

interface WalkDetailScreenProps {
  navigation: any;
  route: { params: { walkId: string } };
}

export default function WalkDetailScreen({ navigation, route }: WalkDetailScreenProps) {
  const { user } = useAuth();
  const { walkId } = route.params;
  const [walk, setWalk] = useState<Walk | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareContent, setShareContent] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    loadWalk();
  }, [walkId]);

  const loadWalk = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('walks')
        .select('*')
        .eq('id', walkId)
        .single();

      if (error) throw error;
      setWalk(data as Walk);
    } catch (err) {
      console.error('Error loading walk:', err);
      setAlertMessage('Kunne ikke laste tur');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!user || !walk) return;

    setSharing(true);
    try {
      const { error } = await createPostFromWalk(
        walk.id,
        user.id,
        shareContent.trim() || null,
        null // No image for now
      );

      if (error) throw error;

      setAlertMessage('Tur delt!');
      setAlertVisible(true);
      setShowShareModal(false);
      setShareContent('');
      
      // Reload walk to update is_shared
      await loadWalk();
    } catch (err) {
      console.error('Error sharing walk:', err);
      setAlertMessage('Kunne ikke dele tur');
      setAlertVisible(true);
    } finally {
      setSharing(false);
    }
  };

  // Map region calculation removed - can be re-enabled when maps are configured

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}t ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading || !walk) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Tilbake</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  const coordinates: WalkCoordinate[] = walk.route_coordinates || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Info */}
        {coordinates.length > 0 && (
          <View style={styles.routeContainer}>
            <Text style={styles.routeTitle}>📍 Rute</Text>
            <Text style={styles.routeText}>
              {coordinates.length} lokasjonspunkt registrert
            </Text>
            <View style={styles.coordinatesInfo}>
              <View style={styles.coordinateItem}>
                <Text style={styles.coordinateLabel}>Start:</Text>
                <Text style={styles.coordinateValue}>
                  {coordinates[0].lat.toFixed(6)}, {coordinates[0].lng.toFixed(6)}
                </Text>
              </View>
              <View style={styles.coordinateItem}>
                <Text style={styles.coordinateLabel}>Slutt:</Text>
                <Text style={styles.coordinateValue}>
                  {coordinates[coordinates.length - 1].lat.toFixed(6)}, {coordinates[coordinates.length - 1].lng.toFixed(6)}
                </Text>
              </View>
            </View>
            {walk.start_location_lat && walk.end_location_lat && (
              <TouchableOpacity
                style={styles.mapLinkButton}
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/${walk.start_location_lat},${walk.start_location_lng}/${walk.end_location_lat},${walk.end_location_lng}`;
                  Linking.openURL(url).catch(err => {
                    console.error('Error opening map:', err);
                    setAlertMessage('Kunne ikke åpne kart');
                    setAlertVisible(true);
                  });
                }}
              >
                <Text style={styles.mapLinkText}>Åpne i Google Maps →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDistance(walk.distance_meters)}</Text>
            <Text style={styles.statLabel}>Distanse</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDuration(walk.duration_minutes)}</Text>
            <Text style={styles.statLabel}>Varighet</Text>
          </View>
          {walk.average_speed_kmh && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {walk.average_speed_kmh.toFixed(1)} km/h
              </Text>
              <Text style={styles.statLabel}>Snitthastighet</Text>
            </View>
          )}
        </View>

        {walk.max_speed_kmh && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Maks hastighet:</Text>
            <Text style={styles.detailValue}>
              {walk.max_speed_kmh.toFixed(1)} km/h
            </Text>
          </View>
        )}

        {walk.steps > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Skritt:</Text>
            <Text style={styles.detailValue}>
              {walk.steps.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Share Button */}
        {user && (
          <TouchableOpacity
            style={[
              styles.shareButton,
              walk.is_shared && styles.shareButtonShared,
            ]}
            onPress={() => walk.is_shared ? null : setShowShareModal(true)}
            disabled={walk.is_shared || sharing}
          >
            <Text style={styles.shareButtonText}>
              {walk.is_shared ? '✓ Delt' : 'Del som innlegg'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Del tur</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Legg til en beskrivelse (valgfritt)..."
              value={shareContent}
              onChangeText={setShareContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowShareModal(false);
                  setShareContent('');
                }}
                disabled={sharing}
              >
                <Text style={styles.modalButtonTextCancel}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonShare]}
                onPress={handleShare}
                disabled={sharing}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextShare}>Del</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={alertVisible}
        title="Feil"
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1ED760',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  routeContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  routeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  coordinatesInfo: {
    gap: 8,
    marginBottom: 12,
  },
  coordinateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  coordinateLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  coordinateValue: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  mapLinkButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1ED760',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  mapLinkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1ED760',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  shareButton: {
    backgroundColor: '#1ED760',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  shareButtonShared: {
    backgroundColor: '#4CAF50',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonShare: {
    backgroundColor: '#1ED760',
  },
  modalButtonTextCancel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextShare: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

