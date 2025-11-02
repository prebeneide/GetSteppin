import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export default function CircularProgress({
  progress,
  size = 200,
  strokeWidth = 16,
  color = '#1ED760',
  backgroundColor = '#e8e8e8',
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  // Exact Spotify green
  const spotifyGreen = '#1ED760';
  const filterId = 'glow';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Glow filter for futuristic effect */}
          <Filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <FeMerge>
              <FeMergeNode in="coloredBlur"/>
              <FeMergeNode in="SourceGraphic"/>
            </FeMerge>
          </Filter>
        </Defs>

        {/* Background circle - clean and simple */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Main progress circle with glow effect */}
        {progress > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={spotifyGreen}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            filter={`url(#${filterId})`}
          />
        )}
      </Svg>
      
      {/* Glow effect using View with shadow - creates smooth glow around circle */}
      {progress > 0 && (
        <View 
          style={[
            styles.glowEffect,
            { 
              width: size + 20, 
              height: size + 20, 
              borderRadius: (size + 20) / 2,
              left: -10,
              top: -10,
            }
          ]}
        />
      )}
      
      {/* Content in center */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  content: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    zIndex: 10,
  },
  glowEffect: {
    position: 'absolute',
    backgroundColor: '#1ED760',
    opacity: 0.15,
    ...Platform.select({
      ios: {
        shadowColor: '#1ED760',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 25,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 0 50px rgba(30, 215, 96, 0.6), 0 0 100px rgba(30, 215, 96, 0.3)',
        filter: 'blur(15px)',
      },
    }),
  },
});

