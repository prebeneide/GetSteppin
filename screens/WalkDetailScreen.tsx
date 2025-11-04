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
import { supabase } from '../lib/supabase';
import { Walk, WalkCoordinate } from '../services/walkService';
import { createPostFromWalk, getPostByWalkId, deletePost, getAllImageUrls } from '../services/postService';
import { Post } from '../services/postService';
import { pickImages, uploadPostImages, ImageUploadResult } from '../services/imageService';
import AlertModal from '../components/AlertModal';
import WalkMapView from '../components/WalkMapView';
import { Image as ExpoImage } from 'expo-image';

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
  const [alertTitle, setAlertTitle] = useState('Feil');
  const [alertMessage, setAlertMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [mapPosition, setMapPosition] = useState(-1); // -1 = end, 0+ = after image index
  const [existingPost, setExistingPost] = useState<Post | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  useEffect(() => {
    loadWalk();
  }, [walkId]);

  useEffect(() => {
    if (walk?.is_shared) {
      loadExistingPost();
    } else {
      setExistingPost(null);
      setExistingImageUrls([]);
    }
  }, [walk?.is_shared, walkId]);

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
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke laste tur');
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
      }
    } catch (err) {
      console.error('Error loading existing post:', err);
    }
  };

  const handlePickImages = async () => {
    try {
      const imageUris = await pickImages(5); // Max 5 images
      if (imageUris.length > 0) {
        setSelectedImages(imageUris);
        setPrimaryImageIndex(0); // Reset to first image
      }
    } catch (err: any) {
      console.error('Error picking images:', err);
      setAlertTitle('Feil');
      setAlertMessage(err.message || 'Kunne ikke velge bilder');
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
            setAlertTitle('Feil');
            setAlertMessage('Kunne ikke laste opp bilder: ' + (uploadErr.message || 'Ukjent feil'));
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
            setAlertTitle('Feil');
            setAlertMessage('Kunne ikke laste opp bilder: ' + (uploadErr.message || 'Ukjent feil'));
            setAlertVisible(true);
            setUploadingImages(false);
            setSharing(false);
            return;
          }
        }
      }

      // Determine final primary_image_index based on combined image list
      // If we have existing images, primaryImageIndex refers to existing + new combined
      // But we need to map it to the final combined array
      let finalPrimaryIndex = 0;
      if (allImages && allImages.length > 0) {
        // primaryImageIndex is already based on the combined list (existing + new)
        // Make sure it's within bounds
        finalPrimaryIndex = Math.min(primaryImageIndex, allImages.length - 1);
        finalPrimaryIndex = Math.max(0, finalPrimaryIndex);
      }

      // Create or update post with images
      const { error } = await createPostFromWalk(
        walk.id,
        user.id,
        shareContent.trim() || null,
        allImages,
        finalPrimaryIndex,
        mapPosition
      );

      if (error) throw error;

      setAlertTitle('Suksess');
      setAlertMessage(existingPost ? 'Innlegg oppdatert!' : 'Tur delt!');
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
      setAlertMessage('Kunne ikke dele tur: ' + (err.message || 'Ukjent feil'));
      setAlertVisible(true);
    } finally {
      setSharing(false);
      setUploadingImages(false);
    }
  };

  const handleUnshare = async () => {
    if (!user || !walk || !existingPost) return;

    setSharing(true);
    try {
      const { error } = await deletePost(existingPost.id, walk.id);
      
      if (error) throw error;

      setAlertTitle('Suksess');
      setAlertMessage('Deling fjernet');
      setAlertVisible(true);
      setShowShareModal(false);
      setShareContent('');
      setSelectedImages([]);
      setExistingPost(null);
      setExistingImageUrls([]);
      setPrimaryImageIndex(0);
      setMapPosition(-1);
      
      // Reload walk to update is_shared
      await loadWalk();
    } catch (err: any) {
      console.error('Error unsharing walk:', err);
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke fjerne deling: ' + (err.message || 'Ukjent feil'));
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
        {/* Route Map */}
        {coordinates.length >= 2 && (
          <View style={styles.routeContainer}>
            <Text style={styles.routeTitle}>📍 Rute</Text>
            <WalkMapView
              coordinates={coordinates}
              height={300}
              showOpenButton={true}
            />
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
                setPrimaryImageIndex(existingPost.primary_image_index || 0);
                setMapPosition(existingPost.map_position !== undefined ? existingPost.map_position : -1);
              } else {
                // Reset for new post
                setShareContent('');
                setSelectedImages([]);
                setExistingImageUrls([]);
                setPrimaryImageIndex(0);
                setMapPosition(-1); // Map at end by default
              }
              setShowShareModal(true);
            }}
            disabled={sharing}
          >
            <Text style={styles.shareButtonText}>
              {walk.is_shared ? '✏️ Rediger innlegg' : 'Del som innlegg'}
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
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {walk?.is_shared ? 'Rediger innlegg' : 'Del tur'}
            </Text>
            
            {/* Image Selection */}
            <View style={styles.imageSection}>
              <Text style={styles.imageSectionTitle}>Bilder (valgfritt)</Text>
              
              {/* Map Position Selector */}
              {walk?.route_coordinates && walk.route_coordinates.length >= 2 && (
                <View style={styles.mapPositionSection}>
                  <Text style={styles.mapPositionTitle}>Kartets posisjon i slideren</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.mapPositionOptions}
                  >
                    <TouchableOpacity
                      style={[
                        styles.mapPositionOption,
                        mapPosition === -1 && styles.mapPositionOptionActive
                      ]}
                      onPress={() => setMapPosition(-1)}
                      disabled={uploadingImages || sharing}
                    >
                      <Text style={[
                        styles.mapPositionOptionText,
                        mapPosition === -1 && styles.mapPositionOptionTextActive
                      ]}>
                        På slutten
                      </Text>
                    </TouchableOpacity>
                    {(selectedImages.length > 0 || existingImageUrls.length > 0) && (
                      Array.from({ length: selectedImages.length + existingImageUrls.length }, (_, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.mapPositionOption,
                            mapPosition === i && styles.mapPositionOptionActive
                          ]}
                          onPress={() => setMapPosition(i)}
                          disabled={uploadingImages || sharing}
                        >
                          <Text style={[
                            styles.mapPositionOptionText,
                            mapPosition === i && styles.mapPositionOptionTextActive
                          ]}>
                            Etter bilde {i + 1}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
              
              {/* Show existing images if any */}
              {existingImageUrls.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectedImagesContainer}
                >
                  {existingImageUrls.map((imageUrl, index) => (
                    <View key={`existing-${index}`} style={styles.imagePreviewContainer}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          // Existing images are at indices 0 to existingImageUrls.length - 1
                          setPrimaryImageIndex(index);
                        }}
                        style={[
                          styles.imagePreview,
                          index === primaryImageIndex && existingImageUrls.length > 0 && styles.primaryImagePreview
                        ]}
                      >
                        <ExpoImage
                          source={{ uri: imageUrl }}
                          style={styles.imagePreviewImage}
                          contentFit="cover"
                        />
                        {index === primaryImageIndex && existingImageUrls.length > 0 && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Hovedbilde</Text>
                          </View>
                        )}
                        <View style={styles.existingImageLabel}>
                          <Text style={styles.existingImageLabelText}>Eksisterende</Text>
                        </View>
                      </TouchableOpacity>
                      {index !== primaryImageIndex && (
                        <TouchableOpacity
                          style={styles.setPrimaryButton}
                          onPress={() => setPrimaryImageIndex(index)}
                          disabled={uploadingImages || sharing}
                        >
                          <Text style={styles.setPrimaryButtonText}>Sett som hovedbilde</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
              
              {selectedImages.length === 0 && existingImageUrls.length === 0 ? (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handlePickImages}
                  disabled={uploadingImages || sharing}
                >
                  <Text style={styles.addImageButtonText}>+ Legg til bilder</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectedImagesContainer}
                >
                  {selectedImages.map((imageUri, index) => {
                    // New images start after existing images
                    const totalIndex = existingImageUrls.length + index;
                    return (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setPrimaryImageIndex(totalIndex)}
                          style={[
                            styles.imagePreview,
                            totalIndex === primaryImageIndex && styles.primaryImagePreview
                          ]}
                        >
                          <ExpoImage
                            source={{ uri: imageUri }}
                            style={styles.imagePreviewImage}
                            contentFit="cover"
                          />
                          {totalIndex === primaryImageIndex && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Hovedbilde</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => handleRemoveImage(index)}
                          disabled={uploadingImages || sharing}
                        >
                          <Text style={styles.removeImageButtonText}>×</Text>
                        </TouchableOpacity>
                        {totalIndex !== primaryImageIndex && (
                          <TouchableOpacity
                            style={styles.setPrimaryButton}
                            onPress={() => setPrimaryImageIndex(totalIndex)}
                            disabled={uploadingImages || sharing}
                          >
                            <Text style={styles.setPrimaryButtonText}>Sett som hovedbilde</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              
              {(selectedImages.length > 0 || existingImageUrls.length > 0) && 
               (selectedImages.length + existingImageUrls.length < 5) && (
                <TouchableOpacity
                  style={styles.addMoreImagesButton}
                  onPress={handlePickImages}
                  disabled={uploadingImages || sharing}
                >
                  <Text style={styles.addMoreImagesButtonText}>+ Legg til flere</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Legg til en beskrivelse (valgfritt)..."
              value={shareContent}
              onChangeText={setShareContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            
            {uploadingImages && (
              <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="small" color="#1ED760" />
                <Text style={styles.uploadingText}>Laster opp bilder...</Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              {walk?.is_shared && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonUnshare]}
                  onPress={handleUnshare}
                  disabled={sharing || uploadingImages}
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonTextUnshare}>Fjern deling</Text>
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
                <Text style={styles.modalButtonTextCancel}>Avbryt</Text>
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
                    {walk?.is_shared ? 'Lagre' : 'Del'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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
    margin: 20,
    marginBottom: 20,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '90%',
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
  imageSection: {
    marginBottom: 16,
  },
  imageSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  addMoreImagesButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 8,
  },
  addMoreImagesButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
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
  modalButtonUnshare: {
    backgroundColor: '#F44336',
  },
  modalButtonTextUnshare: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

