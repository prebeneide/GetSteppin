import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface ImageUploadResult {
  url: string;
  index: number;
}

/**
 * Pick images from device (supports multiple)
 * Note: allowsMultipleSelection requires iOS 14+ / Android 11+
 * For older devices, we'll allow multiple picks in sequence
 */
export const pickImages = async (
  maxImages: number = 5
): Promise<string[]> => {
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Bildetilgang ikke gitt');
    }

    // Try multiple selection first (iOS 14+, Android 11+)
    // If not supported, fall back to single selection loop
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxImages,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      return result.assets.map(asset => asset.uri);
    } catch (multipleSelectionError) {
      // Fallback: allow user to pick images one by one
      console.log('Multiple selection not supported, using fallback');
      
      const selectedUris: string[] = [];
      let continuePicking = true;

      while (continuePicking && selectedUris.length < maxImages) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          continuePicking = false;
          break;
        }

        selectedUris.push(result.assets[0].uri);

        // If not at max, ask if user wants to add more
        if (selectedUris.length < maxImages) {
          // For now, just continue picking until max or user cancels
          // In a real app, you might show a dialog asking "Add more images?"
        }
      }

      return selectedUris;
    }
  } catch (err: any) {
    console.error('Error picking images:', err);
    throw new Error(err.message || 'Kunne ikke velge bilder');
  }
};

/**
 * Upload a single image to Supabase Storage
 */
export const uploadImage = async (
  imageUri: string,
  userId: string,
  postId: string | null = null
): Promise<string> => {
  try {
    // Get file extension
    const uriParts = imageUri.split('.');
    const fileExt = uriParts[uriParts.length - 1]?.toLowerCase() || 'jpg';
    
    // Determine content type
    const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    // Load image as ArrayBuffer (using XMLHttpRequest for React Native compatibility)
    const loadImageAsArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Failed to load image: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error loading image'));
        xhr.send();
      });
    };

    const imageData = await loadImageAsArrayBuffer(imageUri);

    // Create unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${userId}_${timestamp}_${randomId}.${fileExt}`;
    
    // Use post-specific folder if postId is provided, otherwise use user folder
    const folderPath = postId ? `posts/${postId}` : `posts/${userId}`;
    const filePath = `${folderPath}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('posts') // We'll create this bucket
      .upload(filePath, imageData, {
        contentType: contentType,
        upsert: false, // Don't overwrite
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw new Error(uploadError.message || 'Kunne ikke laste opp bilde');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('posts')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Kunne ikke hente bildets URL');
    }

    return urlData.publicUrl;
  } catch (err) {
    console.error('Error in uploadImage:', err);
    throw err;
  }
};

/**
 * Upload multiple images for a post
 */
export const uploadPostImages = async (
  imageUris: string[],
  userId: string,
  postId: string | null = null
): Promise<ImageUploadResult[]> => {
  try {
    const uploadPromises = imageUris.map(async (uri, index) => {
      const url = await uploadImage(uri, userId, postId);
      return { url, index };
    });

    const results = await Promise.all(uploadPromises);
    return results;
  } catch (err) {
    console.error('Error uploading post images:', err);
    throw err;
  }
};

/**
 * Delete images from Supabase Storage
 */
export const deleteImages = async (
  imageUrls: string[]
): Promise<void> => {
  try {
    // Extract file paths from URLs
    const filePaths = imageUrls.map(url => {
      // URL format: https://[project].supabase.co/storage/v1/object/public/posts/[path]
      const parts = url.split('/posts/');
      if (parts.length < 2) {
        return null;
      }
      return parts[1];
    }).filter(path => path !== null) as string[];

    if (filePaths.length === 0) {
      return;
    }

    // Delete from storage
    const { error } = await supabase.storage
      .from('posts')
      .remove(filePaths);

    if (error) {
      console.error('Error deleting images:', error);
      // Don't throw - just log the error
    }
  } catch (err) {
    console.error('Error in deleteImages:', err);
    // Don't throw - just log
  }
};

