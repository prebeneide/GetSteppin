import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getUserWalks, Walk } from '../services/walkService';
import { getDeviceId } from '../lib/deviceId';
import AlertModal from '../components/AlertModal';

interface MyWalksScreenProps {
  navigation: any;
}

export default function MyWalksScreen({ navigation }: MyWalksScreenProps) {
  const { user } = useAuth();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    loadWalks();
  }, [user]);

  const loadWalks = async () => {
    setLoading(true);
    try {
      let deviceId: string | null = null;
      if (!user) {
        deviceId = await getDeviceId();
      }

      const { data, error } = await getUserWalks(user?.id || null, deviceId, 50);

      if (error) throw error;

      setWalks(data || []);
    } catch (err) {
      console.error('Error loading walks:', err);
      setAlertMessage('Kunne ikke laste turer');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min siden`;
    } else if (diffHours < 24) {
      return `${diffHours} timer siden`;
    } else if (diffDays < 7) {
      return `${diffDays} dager siden`;
    } else {
      return date.toLocaleDateString('no-NO', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mine turer</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : walks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👣</Text>
          <Text style={styles.emptyText}>Ingen turer ennå</Text>
          <Text style={styles.emptySubtext}>
            Turer du går/løper vil vises her når GPS-tracking er aktivert
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {walks.map((walk) => (
            <TouchableOpacity
              key={walk.id}
              style={styles.walkCard}
              onPress={() => navigation.navigate('WalkDetail', { walkId: walk.id })}
            >
              <View style={styles.walkHeader}>
                <Text style={styles.walkDistance}>
                  {formatDistance(walk.distance_meters)}
                </Text>
                {walk.is_shared && (
                  <View style={styles.sharedBadge}>
                    <Text style={styles.sharedBadgeText}>✓ Delt</Text>
                  </View>
                )}
              </View>

              <View style={styles.walkStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Varighet</Text>
                  <Text style={styles.statValue}>
                    {formatDuration(walk.duration_minutes)}
                  </Text>
                </View>
                {walk.average_speed_kmh && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Hastighet</Text>
                    <Text style={styles.statValue}>
                      {walk.average_speed_kmh.toFixed(1)} km/h
                    </Text>
                  </View>
                )}
                {walk.steps > 0 && (
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Skritt</Text>
                    <Text style={styles.statValue}>
                      {walk.steps.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.walkDate}>
                {formatDate(walk.start_time)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

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
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1ED760',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  walkCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  walkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walkDistance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1ED760',
  },
  sharedBadge: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  walkStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  walkDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});

