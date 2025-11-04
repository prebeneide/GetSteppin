import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface ImageGalleryProps {
  images: string[];
  primaryImageIndex?: number;
  height?: number;
}

export default function ImageGallery({ 
  images, 
  primaryImageIndex = 0,
  height = 300 
}: ImageGalleryProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0); // Always start at 0 since primary is moved to first

  if (!images || images.length === 0) {
    return null;
  }

  // Sort images: primary first, then rest
  const sortedImages = [...images];
  if (primaryImageIndex >= 0 && primaryImageIndex < sortedImages.length && primaryImageIndex !== 0) {
    const primary = sortedImages[primaryImageIndex];
    sortedImages.splice(primaryImageIndex, 1);
    sortedImages.unshift(primary);
  }

  const screenWidth = Dimensions.get('window').width;

  return (
    <>
      <View style={[styles.container, { height }]}>
        {/* Horizontal scrollable image gallery */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.imageScrollView}
          contentContainerStyle={styles.imageScrollContent}
          snapToInterval={screenWidth}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / screenWidth
            );
            setSelectedIndex(index);
          }}
        >
          {sortedImages.map((image, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              onPress={() => {
                setSelectedIndex(index);
                setModalVisible(true);
              }}
              style={styles.imageSlideContainer}
            >
              <ExpoImage
                source={{ uri: image }}
                style={styles.imageSlide}
                contentFit="cover"
                transition={200}
              />
              
              {/* Image counter overlay */}
              {sortedImages.length > 1 && (
                <View style={styles.imageCounterOverlay}>
                  <Text style={styles.imageCounterText}>
                    {index + 1} / {sortedImages.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Dots indicator for multiple images */}
        {sortedImages.length > 1 && (
          <View style={styles.dotsIndicator}>
            {sortedImages.map((_, index) => (
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
            {sortedImages.map((image, index) => (
              <View key={index} style={{ width: screenWidth }}>
                <ExpoImage
                  source={{ uri: image }}
                  style={styles.fullscreenImage}
                  contentFit="contain"
                />
              </View>
            ))}
          </ScrollView>

          {/* Image counter */}
          <View style={styles.imageCounter}>
            <View style={styles.counterContent}>
              {sortedImages.map((_, index) => (
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
  },
  imageScrollView: {
    width: '100%',
    height: '100%',
  },
  imageScrollContent: {
    alignItems: 'center',
  },
  imageSlideContainer: {
    width: Dimensions.get('window').width,
    height: '100%',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  imageSlide: {
    width: '100%',
    height: '100%',
  },
  imageCounterOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  imageCounterText: {
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
  },
  closeButtonLine1: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  closeButtonLine2: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '-45deg' }],
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
});

