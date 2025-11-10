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
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Walk, WalkCoordinate } from '../services/walkService';
import { PostWithDetails, getAllImageUrls } from '../services/postService';
import AlertModal from '../components/AlertModal';
import WalkMapView from '../components/WalkMapView';
import MediaGallery from '../components/MediaGallery';
import { formatDistance, formatSpeed, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useTranslation } from '../lib/i18n';

interface PostWalkDetailScreenProps {
  navigation: any;
  route: { params: { postId: string } };
}

export default function PostWalkDetailScreen({ navigation, route }: PostWalkDetailScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { postId } = route.params;
  const [post, setPost] = useState<PostWithDetails | null>(null);
  const [walk, setWalk] = useState<Walk | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  useEffect(() => {
    loadPostAndWalk();
    loadPreferences();
  }, [postId]);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  // Reload preferences when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadPreferences();
    }, [user])
  );

  const loadPreferences = async () => {
    try {
      const preferences = await getUserPreferences(user?.id || null);
      setDistanceUnit(preferences.distance_unit);
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  const loadPostAndWalk = async () => {
    setLoading(true);
    try {
      // Load post with walk details
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          user:user_profiles!posts_user_id_fkey(username, avatar_url),
          walk:walks(*)
        `)
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      // Transform post data
      const transformedPost: PostWithDetails = {
        id: postData.id,
        user_id: postData.user_id,
        walk_id: postData.walk_id,
        content: postData.content,
        image_url: postData.image_url || null,
        images: postData.images || null,
        primary_image_index: postData.primary_image_index || 0,
        map_position: postData.map_position !== undefined ? postData.map_position : -1,
        display_settings: postData.display_settings || null,
        created_at: postData.created_at,
        updated_at: postData.updated_at,
        username: postData.user?.username || t('screens.postWalkDetail.unknown'),
        avatar_url: postData.user?.avatar_url || null,
        walk: postData.walk || null,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        has_user_liked: false,
      };

      setPost(transformedPost);
      
      if (postData.walk) {
        setWalk(postData.walk as Walk);
      }
    } catch (err) {
      console.error('Error loading post:', err);
      setAlertMessage(t('screens.postDetail.couldNotLoadPost'));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // formatDistance is now imported from lib/formatters.ts

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}t ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    const locale = language === 'en' ? 'en-US' : 'no-NO';
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || !post || !walk) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{t('common.backArrow')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  const imageUrls = getAllImageUrls(post);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{t('common.backArrow')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Gallery (images + map in same slider, larger than feed) */}
        {(imageUrls.length > 0 || (walk.route_coordinates && walk.route_coordinates.length > 0)) && (
          <View style={styles.mediaContainer}>
            <MediaGallery
              images={imageUrls}
              coordinates={walk.route_coordinates || undefined}
              primaryImageIndex={post.primary_image_index || 0}
              mapPosition={post.map_position !== undefined ? post.map_position : -1}
              height={400}
            />
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDistance(walk.distance_meters, distanceUnit)}</Text>
            <Text style={styles.statLabel}>{t('common.distance')}</Text>
          </View>
          {post.display_settings?.show_duration !== false && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatDuration(walk.duration_minutes)}</Text>
              <Text style={styles.statLabel}>{t('common.duration')}</Text>
            </View>
          )}
          {walk.average_speed_kmh && post.display_settings?.show_avg_speed !== false && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatSpeed(walk.average_speed_kmh, distanceUnit)}
              </Text>
              <Text style={styles.statLabel}>{t('common.averageSpeed')}</Text>
            </View>
          )}
        </View>

        {walk.max_speed_kmh && post.display_settings?.show_max_speed !== false && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('common.maxSpeed')}:</Text>
            <Text style={styles.detailValue}>
              {formatSpeed(walk.max_speed_kmh, distanceUnit)}
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

        {/* Route Details */}
        <View style={styles.routeContainer}>
          {post.display_settings?.show_date !== false && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('screens.walkDetail.date')}</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(walk.start_time)}
              </Text>
            </View>
          )}
          {post.display_settings?.show_start_time !== false && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('screens.walkDetail.startTime')}</Text>
              <Text style={styles.detailValue}>
                {formatTime(walk.start_time)}
              </Text>
            </View>
          )}
          {walk.end_time && post.display_settings?.show_end_time !== false && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('screens.walkDetail.endTime')}</Text>
              <Text style={styles.detailValue}>
                {formatTime(walk.end_time)}
              </Text>
            </View>
          )}
        </View>

        {/* Post Content */}
        {post.content && (
          <View style={styles.contentContainer}>
            <Text style={styles.contentText}>{post.content}</Text>
          </View>
        )}
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        title={t('common.error')}
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
    padding: 20,
    paddingBottom: 40,
  },
  mediaContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1ED760',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contentContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  contentText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  routeContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
  },
});

