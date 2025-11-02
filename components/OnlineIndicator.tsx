import React from 'react';
import { View, StyleSheet } from 'react-native';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Online indicator component - shows a green dot if user has been online recently
 */
export default function OnlineIndicator({ isOnline, size = 'medium' }: OnlineIndicatorProps) {
  if (!isOnline) return null;

  const sizeMap = {
    small: 8,
    medium: 12,
    large: 16,
  };

  const dotSize = sizeMap[size];

  return (
    <View
      style={[
        styles.onlineDot,
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  onlineDot: {
    backgroundColor: '#1ED760',
    borderWidth: 2,
    borderColor: '#fff',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});

