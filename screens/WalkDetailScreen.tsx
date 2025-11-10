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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Walk, WalkCoordinate } from '../services/walkService';
import { createPostFromWalk, getPostByWalkId, deletePost, getAllImageUrls } from '../services/postService';
import { Post } from '../services/postService';
import { pickImages, uploadPostImages, ImageUploadResult } from '../services/imageService';
import AlertModal from '../components/AlertModal';
import WalkMapView from '../components/WalkMapView';
import MediaGallery from '../components/MediaGallery';
import { Image as ExpoImage } from 'expo-image';
import { formatDistance, formatSpeed, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useTranslation } from '../lib/i18n';

interface WalkDetailScreenProps {
  navigation: any;
  route: { params: { walkId: string } };
}

export default function WalkDetailScreen({ navigation, route }: WalkDetailScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { walkId } = route.params;
  const [walk, setWalk] = useState<Walk | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareContent, setShareContent] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState(t('common.error'));
  const [alertMessage, setAlertMessage] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [mapPosition, setMapPosition] = useState(-1); // -1 = end, 0+ = after image index
  const [existingPost, setExistingPost] = useState<Post | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  
  // Slider order: array of { type: 'image' | 'map', url?: string, originalIndex?: number, isExisting?: boolean }
  const [sliderOrder, setSliderOrder] = useState<Array<{ type: 'image' | 'map'; url?: string; originalIndex?: number; isExisting?: boolean }>>([]);
  
  // Display settings (all default to true/visible)
  const [displaySettings, setDisplaySettings] = useState({
    show_start_time: true,
    show_end_time: true,
    show_date: true,
    show_max_speed: true,
    show_avg_speed: true,
    show_duration: true,
    is_public: true,
  });
  
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  useEffect(() => {
    loadWalk();
    loadPreferences();
  }, [walkId]);

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

  useEffect(() => {
    if (walk?.is_shared) {
      loadExistingPost();
    } else {
      setExistingPost(null);
      setExistingImageUrls([]);
      setPrimaryImageIndex(0);
      setMapPosition(-1);
      setSliderOrder([]);
    }
  }, [walk?.is_shared, walkId]);
  
  // Update slider order when images or map position changes
  useEffect(() => {
    updateSliderOrder();
  }, [existingImageUrls, selectedImages, mapPosition, primaryImageIndex, walk?.route_coordinates]);
  
  const updateSliderOrder = () => {
    const allImages: Array<{ url: string; isExisting: boolean; originalIndex: number }> = [];
    
    // Add existing images
    existingImageUrls.forEach((url, idx) => {
      allImages.push({ url, isExisting: true, originalIndex: idx });
    });
    
    // Add new images
    selectedImages.forEach((uri, idx) => {
      allImages.push({ url: uri, isExisting: false, originalIndex: idx });
    });
    
    // Build order exactly like MediaGallery does:
    // 1. Add all images in their original order
    // 2. Insert map at the correct position based on mapPosition
    // 3. Move primary image to position 0 (or 1 if map is at position 0)
    
    const order: Array<{ type: 'image' | 'map'; url?: string; originalIndex?: number; isExisting?: boolean }> = [];
    
    // Step 1: Add all images in their original order
    allImages.forEach((img) => {
      order.push({
        type: 'image',
        url: img.url,
        originalIndex: img.originalIndex,
        isExisting: img.isExisting,
      });
    });
    
    // Step 2: Insert map at the correct position (before moving primary image)
    if (walk?.route_coordinates && walk.route_coordinates.length >= 2 && mapPosition !== -2) {
      let mapIndex = 0;
      
      if (mapPosition === -3) {
        // Map first (before everything, including primary)
        mapIndex = 0;
      } else if (mapPosition === -1) {
        // Map at end
        mapIndex = order.length;
      } else {
        // Map after image at index mapPosition
        mapIndex = Math.min(mapPosition + 1, order.length);
      }
      
      order.splice(mapIndex, 0, { type: 'map' });
    }
    
    // Step 3: Move primary image to position 0 (or 1 if map is at position 0)
    if (primaryImageIndex >= 0 && primaryImageIndex < allImages.length && order.length > 0) {
      const primaryItem = order.find(
        item => item.type === 'image' && 
        ((item.isExisting && item.originalIndex === primaryImageIndex) ||
         (!item.isExisting && item.originalIndex === (primaryImageIndex - existingImageUrls.length)))
      );
      
      if (primaryItem) {
        const primaryIdx = order.indexOf(primaryItem);
        // Target position: 0 if map is not first, 1 if map is first
        const targetIdx = order[0]?.type === 'map' ? 1 : 0;
        
        if (primaryIdx !== targetIdx) {
          order.splice(primaryIdx, 1);
          order.splice(targetIdx, 0, primaryItem);
        }
      }
    }
    
    // If no primary image set and we have images, set first image as primary
    if (order.length > 0 && order[0].type === 'image' && primaryImageIndex < 0) {
      const firstImage = order[0];
      if (firstImage.isExisting) {
        setPrimaryImageIndex(firstImage.originalIndex!);
      } else {
        setPrimaryImageIndex(existingImageUrls.length + firstImage.originalIndex!);
      }
    }
    
    setSliderOrder(order);
  };
  
  const moveItemUp = (index: number) => {
    if (index === 0) return; // Already at top
    
    const newOrder = [...sliderOrder];
    const item = newOrder[index];
    newOrder.splice(index, 1);
    newOrder.splice(index - 1, 0, item);
    
    setSliderOrder(newOrder);
    
    // Update primaryImageIndex if item at position 1 changes
    if (index - 1 === 0 && item.type === 'image') {
      if (item.isExisting) {
        setPrimaryImageIndex(item.originalIndex!);
      } else {
        setPrimaryImageIndex(existingImageUrls.length + item.originalIndex!);
      }
    }
    
    // Update mapPosition based on new position
    if (item.type === 'map') {
      const newMapIndex = index - 1;
      if (newMapIndex === 0) {
        setMapPosition(-3); // First
      } else if (newMapIndex === newOrder.length - 1) {
        setMapPosition(-1); // End
      } else {
        // Count images before map
        const imagesBefore = newOrder.slice(0, newMapIndex).filter(i => i.type === 'image').length;
        setMapPosition(imagesBefore - 1);
      }
    }
  };
  
  const moveItemDown = (index: number) => {
    if (index === sliderOrder.length - 1) return; // Already at bottom
    
    const newOrder = [...sliderOrder];
    const item = newOrder[index];
    newOrder.splice(index, 1);
    newOrder.splice(index + 1, 0, item);
    
    setSliderOrder(newOrder);
    
    // Update primaryImageIndex if item moves to position 1
    if (index + 1 === 0 && item.type === 'image') {
      if (item.isExisting) {
        setPrimaryImageIndex(item.originalIndex!);
      } else {
        setPrimaryImageIndex(existingImageUrls.length + item.originalIndex!);
      }
    }
    
    // Update mapPosition based on new position
    if (item.type === 'map') {
      const newMapIndex = index + 1;
      if (newMapIndex === 0) {
        setMapPosition(-3); // First
      } else if (newMapIndex === newOrder.length - 1) {
        setMapPosition(-1); // End
      } else {
        // Count images before map
        const imagesBefore = newOrder.slice(0, newMapIndex).filter(i => i.type === 'image').length;
        setMapPosition(imagesBefore - 1);
      }
    }
  };

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
      setAlertTitle(t('common.error'));
      setAlertMessage(t('common.error'));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPost = async () => {
    try {
      const { data, error } = await getPostByWalkId(walkId);
      if (error) {
        console.error('Error loading existing post:', error);
        return;
      }
      
      if (data) {
        setExistingPost(data);
        const imageUrls = getAllImageUrls(data);
        setExistingImageUrls(imageUrls);
        // Restore primary image index and map position
        if (data.primary_image_index !== undefined) {
          setPrimaryImageIndex(data.primary_image_index);
        }
        if (data.map_position !== undefined) {
          setMapPosition(data.map_position);
        }
        // Restore display settings (default to all visible if not set)
        if (data.display_settings) {
          setDisplaySettings({
            show_start_time: data.display_settings.show_start_time !== false,
            show_end_time: data.display_settings.show_end_time !== false,
            show_date: data.display_settings.show_date !== false,
            show_max_speed: data.display_settings.show_max_speed !== false,
            show_avg_speed: data.display_settings.show_avg_speed !== false,
            show_duration: data.display_settings.show_duration !== false,
            is_public: data.display_settings.is_public !== false,
          });
        } else {
          // Default: all visible, public
          setDisplaySettings({
            show_start_time: true,
            show_end_time: true,
            show_date: true,
            show_max_speed: true,
            show_avg_speed: true,
            show_duration: true,
            is_public: true,
          });
        }
        // Slider order will be updated by useEffect
      }
    } catch (err) {
      console.error('Error loading existing post:', err);
    }
  };

  const handlePickImages = async () => {
    try {
      const currentImageCount = existingImageUrls.length + selectedImages.length;
      const maxImages = 5;
      const remainingSlots = maxImages - currentImageCount;
      
      if (remainingSlots <= 0) {
        setAlertTitle(t('common.error'));
        setAlertMessage('Du kan maksimalt legge til 5 bilder');
        setAlertVisible(true);
        return;
      }
      
      const imageUris = await pickImages(remainingSlots);
      if (imageUris.length > 0) {
        setSelectedImages(prev => [...prev, ...imageUris]);
        // Primary image will be updated by useEffect
      }
    } catch (err: any) {
      console.error('Error picking images:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(err.message || t('common.error'));
      setAlertVisible(true);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    if (primaryImageIndex >= newImages.length) {
      setPrimaryImageIndex(Math.max(0, newImages.length - 1));
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
  };

  const handleShare = async () => {
    if (!user || !walk) return;

    setSharing(true);
    setUploadingImages(true);
    
    try {
      // Combine existing images with newly selected images
      let allImages: ImageUploadResult[] | null = null;
      let newImagesToUpload: string[] = selectedImages;

      // If we have existing images, convert them to ImageUploadResult format
      if (existingPost && existingImageUrls.length > 0) {
        const existingImageResults: ImageUploadResult[] = existingImageUrls.map((url, idx) => ({
          url,
          index: idx,
        }));

        // Upload new images if any selected
        if (selectedImages.length > 0) {
          try {
            const uploadedImages = await uploadPostImages(
              selectedImages,
              user.id,
              existingPost.id // Use existing post ID for folder structure
            );
            
            // Combine existing and new images
            allImages = [
              ...existingImageResults,
              ...uploadedImages.map((img, idx) => ({
                ...img,
                index: existingImageResults.length + idx,
              })),
            ];
          } catch (uploadErr: any) {
            console.error('Error uploading new images:', uploadErr);
            setAlertTitle(t('common.error'));
            setAlertMessage(t('common.error') + ': ' + (uploadErr.message || t('common.error')));
            setAlertVisible(true);
            setUploadingImages(false);
            setSharing(false);
            return;
          }
        } else {
          // No new images, just use existing ones
          allImages = existingImageResults;
        }
      } else {
        // No existing images, upload new ones if any
        if (selectedImages.length > 0) {
          try {
            const uploadedImages = await uploadPostImages(
              selectedImages,
              user.id,
              existingPost?.id || null
            );
            
            allImages = uploadedImages.map((img, idx) => ({
              ...img,
              index: idx,
            }));
          } catch (uploadErr: any) {
            console.error('Error uploading images:', uploadErr);
            setAlertTitle(t('common.error'));
            setAlertMessage(t('common.error') + ': ' + (uploadErr.message || t('common.error')));
            setAlertVisible(true);
            setUploadingImages(false);
            setSharing(false);
            return;
          }
        }
      }

      // Determine final primary_image_index and map_position from sliderOrder
      // The first image in sliderOrder is always the primary image
      let finalPrimaryIndex = 0;
      let finalMapPosition = -1;
      
      if (sliderOrder.length > 0) {
        // Find primary image (first image in order)
        const primaryItem = sliderOrder.find(item => item.type === 'image');
        if (primaryItem && primaryItem.originalIndex !== undefined) {
          if (primaryItem.isExisting) {
            finalPrimaryIndex = primaryItem.originalIndex;
          } else {
            finalPrimaryIndex = existingImageUrls.length + primaryItem.originalIndex;
          }
        }
        
        // Find map position
        const mapIndex = sliderOrder.findIndex(item => item.type === 'map');
        if (mapIndex !== -1) {
          if (mapIndex === 0) {
            finalMapPosition = -3; // First
          } else if (mapIndex === sliderOrder.length - 1) {
            finalMapPosition = -1; // End
          } else {
            // Count images before map
            const imagesBefore = sliderOrder.slice(0, mapIndex).filter(item => item.type === 'image').length;
            finalMapPosition = imagesBefore - 1; // After image at index (imagesBefore - 1)
          }
        } else {
          finalMapPosition = -2; // Hide map
        }
      }

      // Create or update post with images and display settings
      const { error } = await createPostFromWalk(
        walk.id,
        user.id,
        shareContent.trim() || null,
        allImages,
        finalPrimaryIndex,
        finalMapPosition,
        displaySettings
      );

      if (error) throw error;

      setAlertTitle(t('common.success'));
      setAlertMessage(existingPost ? t('screens.walkDetail.postUpdated') : t('screens.walkDetail.walkShared'));
      setAlertVisible(true);
      setShowShareModal(false);
      setShareContent('');
      setSelectedImages([]);
      setPrimaryImageIndex(0);
      // Keep mapPosition as user selected
      
      // Reload walk and post to update is_shared
      await loadWalk();
      if (walk?.is_shared) {
        await loadExistingPost();
      }
    } catch (err: any) {
      console.error('Error sharing walk:', err);
      setAlertTitle('Feil');
      setAlertMessage(t('common.error') + ': ' + (err.message || t('common.error')));
      setAlertVisible(true);
    } finally {
      setSharing(false);
      setUploadingImages(false);
    }
  };

  const handleDeletePost = async () => {
    if (!user || !walk || !existingPost) return;

    setSharing(true);
    try {
      const { error } = await deletePost(existingPost.id, walk.id);
      
      if (error) throw error;

      setDeleteConfirmVisible(false);
      setShowShareModal(false);
      setShareContent('');
      setSelectedImages([]);
      setExistingPost(null);
      setExistingImageUrls([]);
      setPrimaryImageIndex(0);
      setMapPosition(-1);
      
      // Navigate back to MyWalksScreen so the deleted post disappears
      navigation.goBack();
    } catch (err: any) {
      console.error('Error deleting post:', err);
      setDeleteConfirmVisible(false);
      setAlertTitle('Feil');
      setAlertMessage(t('common.error') + ': ' + (err.message || t('common.error')));
      setAlertVisible(true);
    } finally {
      setSharing(false);
    }
  };

  // Map region calculation removed - can be re-enabled when maps are configured

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

  if (loading || !walk) {
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

  const coordinates: WalkCoordinate[] = walk.route_coordinates || [];
  const imageUrls = existingPost ? getAllImageUrls(existingPost) : [];
  const hasImages = imageUrls.length > 0;
  const hasMap = coordinates.length >= 2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
        {/* Shared badge - show "Delt" or "Ikke delt" based on is_public */}
        {walk.is_shared && (
          <View style={[
            styles.sharedBadge,
            existingPost?.display_settings?.is_public === false && styles.notSharedBadge
          ]}>
            <Text style={[
              styles.sharedBadgeText,
              existingPost?.display_settings?.is_public === false && styles.notSharedBadgeText
            ]}>
              {existingPost?.display_settings?.is_public === false ? `✗ ${t('walk.notShared')}` : `✓ ${t('walk.shared')}`}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Gallery (images + map in same slider, larger than feed) */}
        {(hasImages || hasMap) && (
          <View style={styles.mediaContainer}>
            <MediaGallery
              images={imageUrls}
              coordinates={hasMap ? coordinates : undefined}
              primaryImageIndex={existingPost?.primary_image_index || 0}
              mapPosition={existingPost?.map_position !== undefined ? existingPost.map_position : -1}
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
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {formatDuration(walk.duration_minutes)}
            </Text>
            <Text style={styles.statLabel}>
              {t('common.duration')}
              {existingPost?.display_settings?.show_duration === false && (
                <Text style={styles.hiddenLabel}>{t('screens.walkDetail.hidden')}</Text>
              )}
            </Text>
          </View>
          {walk.average_speed_kmh && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatSpeed(walk.average_speed_kmh, distanceUnit)}
              </Text>
              <Text style={styles.statLabel}>
                {t('common.averageSpeed')}
                {existingPost?.display_settings?.show_avg_speed === false && (
                  <Text style={styles.hiddenLabel}>{t('screens.walkDetail.hidden')}</Text>
                )}
              </Text>
            </View>
          )}
        </View>

        {walk.max_speed_kmh && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t('common.maxSpeed')}
              {existingPost?.display_settings?.show_max_speed === false && (
                <Text style={styles.hiddenLabel}>{t('screens.walkDetail.hidden')}</Text>
              )}
            </Text>
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
        <View style={styles.routeDetailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t('screens.walkDetail.date')}
              {existingPost?.display_settings?.show_date === false && (
                <Text style={styles.hiddenLabel}>{t('screens.walkDetail.hidden')}</Text>
              )}
            </Text>
            <Text style={styles.detailValue}>
              {formatDateTime(walk.start_time)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t('screens.walkDetail.startTime')}
              {existingPost?.display_settings?.show_start_time === false && (
                <Text style={styles.hiddenLabel}>{t('screens.walkDetail.hidden')}</Text>
              )}
            </Text>
            <Text style={styles.detailValue}>
              {formatTime(walk.start_time)}
            </Text>
          </View>
          
          {walk.end_time && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t('screens.walkDetail.endTime')}
                {existingPost?.display_settings?.show_end_time === false && (
                  <Text style={styles.hiddenLabel}>{t('screens.walkDetail.hidden')}</Text>
                )}
              </Text>
              <Text style={styles.detailValue}>
                {formatTime(walk.end_time)}
              </Text>
            </View>
          )}
        </View>

        {/* Post Content */}
        {existingPost?.content && (
          <View style={styles.contentContainer}>
            <Text style={styles.contentText}>{existingPost.content}</Text>
          </View>
        )}

        {/* Share/Edit Button */}
        {user && (
          <TouchableOpacity
            style={[
              styles.shareButton,
              walk.is_shared && styles.shareButtonShared,
            ]}
            onPress={() => {
              if (walk.is_shared && existingPost) {
                // Load existing content into modal
                setShareContent(existingPost.content || '');
                setExistingImageUrls(getAllImageUrls(existingPost));
                setPrimaryImageIndex(existingPost.primary_image_index !== undefined ? existingPost.primary_image_index : 0);
                setMapPosition(existingPost.map_position !== undefined ? existingPost.map_position : -1);
                // Restore display settings
                if (existingPost.display_settings) {
                  setDisplaySettings({
                    show_start_time: existingPost.display_settings.show_start_time !== false,
                    show_end_time: existingPost.display_settings.show_end_time !== false,
                    show_date: existingPost.display_settings.show_date !== false,
                    show_max_speed: existingPost.display_settings.show_max_speed !== false,
                    show_avg_speed: existingPost.display_settings.show_avg_speed !== false,
                    show_duration: existingPost.display_settings.show_duration !== false,
                    is_public: existingPost.display_settings.is_public !== false,
                  });
                } else {
                  setDisplaySettings({
                    show_start_time: true,
                    show_end_time: true,
                    show_date: true,
                    show_max_speed: true,
                    show_avg_speed: true,
                    show_duration: true,
                    is_public: true,
                  });
                }
              } else {
                // Reset for new post
                setShareContent('');
                setSelectedImages([]);
                setExistingImageUrls([]);
                setPrimaryImageIndex(0);
                setMapPosition(-1); // Map at end by default
                // Reset display settings to defaults (all visible, public)
                setDisplaySettings({
                  show_start_time: true,
                  show_end_time: true,
                  show_date: true,
                  show_max_speed: true,
                  show_avg_speed: true,
                  show_duration: true,
                  is_public: true,
                });
              }
              setShowShareModal(true);
            }}
            disabled={sharing}
          >
            <Text style={styles.shareButtonText}>
              {walk.is_shared ? `✏️ ${t('screens.walkDetail.editPost')}` : t('screens.walkDetail.shareWalk')}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
            <Text style={styles.modalTitle}>
              {walk?.is_shared ? t('screens.walkDetail.editPost') : t('screens.walkDetail.shareWalk')}
            </Text>
            
            {/* Image Selection */}
            <View style={styles.imageSection}>
              <Text style={styles.imageSectionTitle}>{t('screens.walkDetail.images')}</Text>
              <Text style={styles.imageSectionSubtitle}>
                {t('screens.walkDetail.imagesSubtitle')}
              </Text>
              
              {/* Slider order list */}
              {sliderOrder.length > 0 ? (
                <View style={styles.orderList}>
                  {sliderOrder.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === sliderOrder.length - 1;
                    
                    // Determine if this image is primary
                    let isPrimary = false;
                    if (item.type === 'image' && isFirst) {
                      isPrimary = true;
                    }
                    
                    return (
                      <View key={`${item.type}-${index}`} style={styles.orderItem}>
                        <View style={styles.orderItemContent}>
                          <View style={styles.orderPosition}>
                            <Text style={styles.orderPositionText}>{index + 1}</Text>
                          </View>
                          
                          {item.type === 'map' ? (
                            <View style={[styles.orderItemPreview, styles.mapPreviewContainer]}>
                              <View style={styles.mapIcon}>
                                <Text style={styles.mapIconText}>🗺️</Text>
                              </View>
                              <Text style={styles.mapPreviewText}>{t('screens.walkDetail.map')}</Text>
                            </View>
                          ) : (
                            <View style={styles.orderItemPreview}>
                              <ExpoImage
                                source={{ uri: item.url! }}
                                style={styles.orderItemImage}
                                contentFit="cover"
                              />
                              {isPrimary && (
                                <View style={styles.primaryBadgeSmall}>
                                  <Text style={styles.primaryBadgeTextSmall}>{t('screens.walkDetail.primaryImage')}</Text>
                                </View>
                              )}
                            </View>
                          )}
                          
                          <View style={styles.orderItemControls}>
                            <TouchableOpacity
                              style={[styles.orderControlButton, isFirst && styles.orderControlButtonDisabled]}
                              onPress={() => moveItemUp(index)}
                              disabled={isFirst || uploadingImages || sharing}
                            >
                              <Text style={[styles.orderControlButtonText, isFirst && styles.orderControlButtonTextDisabled]}>
                                ↑
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.orderControlButton, isLast && styles.orderControlButtonDisabled]}
                              onPress={() => moveItemDown(index)}
                              disabled={isLast || uploadingImages || sharing}
                            >
                              <Text style={[styles.orderControlButtonText, isLast && styles.orderControlButtonTextDisabled]}>
                                ↓
                              </Text>
                            </TouchableOpacity>
                          </View>
                          
                          {item.type === 'image' && (
                            <TouchableOpacity
                              style={styles.orderItemRemove}
                              onPress={() => {
                                const newOrder = sliderOrder.filter((_, i) => i !== index);
                                setSliderOrder(newOrder);
                                
                                // Remove from appropriate array
                                if (item.isExisting) {
                                  // Remove existing image
                                  const newExistingUrls = existingImageUrls.filter((_, i) => i !== item.originalIndex!);
                                  setExistingImageUrls(newExistingUrls);
                                  
                                  // Update primary image index if needed
                                  if (primaryImageIndex === item.originalIndex! && newExistingUrls.length > 0) {
                                    setPrimaryImageIndex(0);
                                  } else if (primaryImageIndex > item.originalIndex!) {
                                    setPrimaryImageIndex(primaryImageIndex - 1);
                                  }
                                } else {
                                  // Remove new image
                                  handleRemoveImage(item.originalIndex!);
                                }
                              }}
                              disabled={uploadingImages || sharing}
                            >
                              <Text style={styles.orderItemRemoveText}>×</Text>
                            </TouchableOpacity>
                          )}
                          
                          {/* Map cannot be removed - no remove button */}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handlePickImages}
                  disabled={uploadingImages || sharing}
                >
                  <Text style={styles.addImageButtonText}>{t('screens.walkDetail.addImages')}</Text>
                </TouchableOpacity>
              )}
              
              {/* Add more images button */}
              {sliderOrder.length > 0 && sliderOrder.filter(item => item.type === 'image').length < 5 && (
                <TouchableOpacity
                  style={styles.addMoreButton}
                  onPress={handlePickImages}
                  disabled={uploadingImages || sharing}
                >
                  <Text style={styles.addMoreButtonText}>{t('screens.walkDetail.addMoreImages')}</Text>
                </TouchableOpacity>
              )}
              
              {/* Add map button if not already in order */}
              {walk?.route_coordinates && walk.route_coordinates.length >= 2 && 
               sliderOrder.filter(item => item.type === 'map').length === 0 && (
                <TouchableOpacity
                  style={styles.addMapButton}
                  onPress={() => {
                    // Add map at position 2 (after primary image) by default
                    const newOrder = [...sliderOrder];
                    newOrder.splice(1, 0, { type: 'map' });
                    setSliderOrder(newOrder);
                    setMapPosition(0); // After first image
                  }}
                  disabled={uploadingImages || sharing}
                >
                  <Text style={styles.addMapButtonText}>{t('screens.walkDetail.addMap')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={t('screens.walkDetail.descriptionPlaceholder')}
              value={shareContent}
              onChangeText={setShareContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            
            {/* Display Settings */}
            <View style={styles.displaySettingsSection}>
              <Text style={styles.displaySettingsTitle}>{t('screens.walkDetail.displaySettings')}</Text>
              
              <View style={styles.displaySettingsContent}>
                  <View style={styles.displaySettingsRow}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.date')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.show_date && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, show_date: !displaySettings.show_date })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.show_date && styles.toggleButtonTextActive]}>
                        {displaySettings.show_date ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.displaySettingsRow}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.startTime')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.show_start_time && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, show_start_time: !displaySettings.show_start_time })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.show_start_time && styles.toggleButtonTextActive]}>
                        {displaySettings.show_start_time ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.displaySettingsRow}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.endTime')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.show_end_time && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, show_end_time: !displaySettings.show_end_time })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.show_end_time && styles.toggleButtonTextActive]}>
                        {displaySettings.show_end_time ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.displaySettingsRow}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.duration')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.show_duration && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, show_duration: !displaySettings.show_duration })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.show_duration && styles.toggleButtonTextActive]}>
                        {displaySettings.show_duration ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.displaySettingsRow}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.averageSpeed')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.show_avg_speed && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, show_avg_speed: !displaySettings.show_avg_speed })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.show_avg_speed && styles.toggleButtonTextActive]}>
                        {displaySettings.show_avg_speed ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.displaySettingsRow}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.maxSpeed')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.show_max_speed && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, show_max_speed: !displaySettings.show_max_speed })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.show_max_speed && styles.toggleButtonTextActive]}>
                        {displaySettings.show_max_speed ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.displaySettingsRow, styles.displaySettingsRowLast]}>
                    <Text style={styles.displaySettingsLabel}>{t('screens.walkDetail.postPublic')}</Text>
                    <TouchableOpacity
                      style={[styles.toggleButton, displaySettings.is_public && styles.toggleButtonActive]}
                      onPress={() => setDisplaySettings({ ...displaySettings, is_public: !displaySettings.is_public })}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[styles.toggleButtonText, displaySettings.is_public && styles.toggleButtonTextActive]}>
                        {displaySettings.is_public ? t('walk.on') : t('walk.off')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
            </View>
            
              {uploadingImages && (
                <View style={styles.uploadingIndicator}>
                  <ActivityIndicator size="small" color="#1ED760" />
                  <Text style={styles.uploadingText}>{t('screens.walkDetail.uploadingImages')}</Text>
                </View>
              )}
            </ScrollView>
            
            {/* Fixed action buttons at bottom */}
            <View style={styles.modalActions}>
              {walk?.is_shared && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDelete]}
                  onPress={() => {
                    setShowShareModal(false); // Close share modal first
                    setTimeout(() => setDeleteConfirmVisible(true), 300); // Small delay to ensure modal closes
                  }}
                  disabled={sharing || uploadingImages}
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextDelete}>{t('screens.walkDetail.delete')}</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowShareModal(false);
                  setShareContent('');
                  setSelectedImages([]);
                  setPrimaryImageIndex(0);
                  setMapPosition(-1);
                  // Reload existing post data when closing
                  if (walk?.is_shared) {
                    loadExistingPost();
                  }
                }}
                disabled={sharing || uploadingImages}
              >
                <Text style={styles.modalButtonTextCancel}>{t('screens.walkDetail.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonShare]}
                onPress={handleShare}
                disabled={sharing || uploadingImages}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextShare}>
                    {walk?.is_shared ? t('screens.walkDetail.save') : t('screens.walkDetail.share')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirmation dialog - must be outside Modal to appear on top */}
      <AlertModal
        visible={deleteConfirmVisible}
        title={t('screens.walkDetail.delete')}
        message={t('screens.walkDetail.deleteConfirm')}
        buttons={[
          {
            text: t('screens.walkDetail.no'),
            onPress: () => setDeleteConfirmVisible(false),
            style: 'cancel',
          },
          {
            text: t('screens.walkDetail.yes'),
            onPress: handleDeletePost,
            style: 'destructive',
          },
        ]}
        onClose={() => setDeleteConfirmVisible(false)}
      />

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
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
  routeDetailsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
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
  shareButton: {
    backgroundColor: '#1ED760',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  shareButtonShared: {
    backgroundColor: '#1ED760',
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
    maxHeight: '90%',
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 20,
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
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
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
  imageSection: {
    marginBottom: 16,
  },
  imageSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  imageSectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 16,
  },
  addImageButton: {
    borderWidth: 2,
    borderColor: '#1ED760',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  addImageButtonText: {
    color: '#1ED760',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedImagesContainer: {
    marginBottom: 8,
  },
  imagePreviewContainer: {
    marginRight: 12,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: '#f0f0f0',
  },
  primaryImagePreview: {
    borderColor: '#1ED760',
  },
  imagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(30, 215, 96, 0.9)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  primaryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  removeImageButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  setPrimaryButton: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignSelf: 'center',
  },
  setPrimaryButtonText: {
    color: '#333',
    fontSize: 10,
    fontWeight: '600',
  },
  addMoreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 8,
  },
  addMoreButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  positionBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapPlaceholder: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
    alignSelf: 'center',
  },
  mapPlaceholderText: {
    color: '#1ED760',
    fontSize: 11,
    fontWeight: '600',
  },
  mapPreviewContainer: {
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#1ED760',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  mapIcon: {
    marginBottom: 4,
  },
  mapIconText: {
    fontSize: 24,
  },
  mapPreviewText: {
    color: '#1ED760',
    fontSize: 12,
    fontWeight: '600',
  },
  mapRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapRemoveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  mapPositionSection: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  mapPositionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  mapPositionOptions: {
    flexDirection: 'row',
  },
  mapPositionOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  mapPositionOptionActive: {
    borderColor: '#1ED760',
    backgroundColor: '#f0fdf4',
  },
  mapPositionOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  mapPositionOptionTextActive: {
    color: '#1ED760',
    fontWeight: '600',
  },
  existingImageLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 123, 255, 0.9)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  existingImageLabelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  modalButtonDelete: {
    backgroundColor: '#F44336',
  },
  modalButtonTextDelete: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orderList: {
    marginBottom: 12,
  },
  orderItem: {
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orderItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderPosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderPositionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderItemPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  orderItemImage: {
    width: '100%',
    height: '100%',
  },
  primaryBadgeSmall: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(30, 215, 96, 0.9)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  primaryBadgeTextSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  orderItemControls: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  orderControlButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderControlButtonDisabled: {
    backgroundColor: '#ccc',
  },
  orderControlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderControlButtonTextDisabled: {
    color: '#999',
  },
  orderItemRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemRemoveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  addMapButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1ED760',
  },
  addMapButtonText: {
    color: '#1ED760',
    fontSize: 14,
    fontWeight: '600',
  },
  displaySettingsSection: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  displaySettingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  displaySettingsContent: {
    padding: 16,
    paddingTop: 0,
  },
  displaySettingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  displaySettingsRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  displaySettingsLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    minWidth: 60,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#1ED760',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  hiddenText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    fontStyle: 'italic',
  },
  hiddenLabel: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    fontWeight: 'normal',
  },
  sharedBadge: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#1ED760',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  notSharedBadge: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  sharedBadgeText: {
    color: '#1ED760',
    fontSize: 12,
    fontWeight: '600',
  },
  notSharedBadgeText: {
    color: '#F44336',
  },
});

