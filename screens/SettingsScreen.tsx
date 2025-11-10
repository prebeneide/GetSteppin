import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';
import * as Location from 'expo-location';
import { getDeviceId } from '../lib/deviceId';
import { Linking, Platform } from 'react-native';
import { DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useTranslation, Language } from '../lib/i18n';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { user } = useAuth();
  const { t, language, setLanguage: setLanguagePref, reloadLanguage } = useTranslation();
  const [enableWalkTracking, setEnableWalkTracking] = useState(true);
  const [autoShareWalks, setAutoShareWalks] = useState(true);
  const [homeAreaRadius, setHomeAreaRadius] = useState(50);
  const [minWalkDistance, setMinWalkDistance] = useState(1000);
  const [minWalkSpeed, setMinWalkSpeed] = useState(3.0);
  const [maxWalkSpeed, setMaxWalkSpeed] = useState(15.0);
  const [pauseTolerance, setPauseTolerance] = useState(15);
  const [pauseRadius, setPauseRadius] = useState(10);
  const [homeLatitude, setHomeLatitude] = useState<number | null>(null);
  const [homeLongitude, setHomeLongitude] = useState<number | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [activityNotificationsEnabled, setActivityNotificationsEnabled] = useState(true);
  const [weeklyAverageNotificationsEnabled, setWeeklyAverageNotificationsEnabled] = useState(true);
  const [topPercentageNotificationsEnabled, setTopPercentageNotificationsEnabled] = useState(true);
  const [goalStreakNotificationsEnabled, setGoalStreakNotificationsEnabled] = useState(true);
  const [weeklyGoalNotificationsEnabled, setWeeklyGoalNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState(t('common.error'));
  const [alertMessage, setAlertMessage] = useState('');

  // Load walk tracking settings
  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      // Load user preferences (distance unit, language, etc.)
      const preferences = await getUserPreferences(user?.id || null);
      setDistanceUnit(preferences.distance_unit);
      // Language is loaded by useTranslation hook

      if (user) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('enable_walk_tracking, auto_share_walks, home_area_radius_meters, home_latitude, home_longitude, min_walk_distance_meters, min_walk_speed_kmh, max_walk_speed_kmh, pause_tolerance_minutes, pause_radius_meters, activity_notifications_enabled, weekly_average_notifications_enabled, top_percentage_notifications_enabled, goal_streak_notifications_enabled, weekly_goal_notifications_enabled')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setEnableWalkTracking(data.enable_walk_tracking !== false);
          setAutoShareWalks(data.auto_share_walks !== false);
          setHomeAreaRadius(data.home_area_radius_meters || 50);
          setHomeLatitude(data.home_latitude);
          setHomeLongitude(data.home_longitude);
          setMinWalkDistance(data.min_walk_distance_meters || 1000);
          setMinWalkSpeed(data.min_walk_speed_kmh || 3.0);
          setMaxWalkSpeed(data.max_walk_speed_kmh || 15.0);
          setPauseTolerance(data.pause_tolerance_minutes || 15);
          setPauseRadius(data.pause_radius_meters || 10);
          setActivityNotificationsEnabled(data.activity_notifications_enabled !== false);
          setWeeklyAverageNotificationsEnabled(data.weekly_average_notifications_enabled !== false);
          setTopPercentageNotificationsEnabled(data.top_percentage_notifications_enabled !== false);
          setGoalStreakNotificationsEnabled(data.goal_streak_notifications_enabled !== false);
          setWeeklyGoalNotificationsEnabled(data.weekly_goal_notifications_enabled !== false);
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotLoadSettings'));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const updateWalkTracking = async (value: boolean) => {
    if (!user) return;
    
    // If turning on GPS tracking, request permissions first
    if (value) {
      let permissionError = false;
      let isExpoGoError = false;
      
      try {
        // Check current permissions
        const foregroundStatus = await Location.getForegroundPermissionsAsync();
        const backgroundStatus = await Location.getBackgroundPermissionsAsync();
        
        // Request foreground permission if not granted
        if (!foregroundStatus.granted) {
          try {
            const { status: foregroundRequestStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundRequestStatus !== 'granted') {
              setAlertTitle(t('settings.locationAccessRequired'));
              setAlertMessage(t('settings.locationAccessRequiredMessage'));
              setAlertVisible(true);
              return; // Don't enable tracking if permission not granted
            }
          } catch (permErr: any) {
            // Check if it's the Expo Go Info.plist error
            if (permErr?.message?.includes('NSLocation') || permErr?.message?.includes('Info.plist')) {
              isExpoGoError = true;
              permissionError = true;
              console.log('Expo Go permission error - will allow enabling anyway for foreground tracking');
            } else {
              throw permErr;
            }
          }
        }
        
        // Request background permission if not granted (non-critical)
        if (!backgroundStatus.granted && !isExpoGoError) {
          try {
            const { status: backgroundRequestStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundRequestStatus !== 'granted') {
              // Background permission is optional - just show info
              console.log('Background permission not granted - will use foreground tracking only');
            }
          } catch (bgErr: any) {
            // Background permission errors are non-critical
            console.log('Background permission error (non-critical):', bgErr);
          }
        }
      } catch (err: any) {
        console.error('Error requesting location permissions:', err);
        
        // Check if it's the Info.plist error (Expo Go limitation)
        if (err?.message?.includes('NSLocation') || err?.message?.includes('Info.plist')) {
          isExpoGoError = true;
          permissionError = true;
          console.log('Expo Go permission error - will allow enabling anyway for foreground tracking');
        } else {
          // Other errors - show warning but allow enabling
          permissionError = true;
          console.log('Permission error - will allow enabling anyway');
        }
      }
      
      // If Expo Go error, show info but allow enabling for foreground tracking
      if (isExpoGoError) {
        setAlertTitle(t('settings.expoGoInfo'));
        setAlertMessage(t('settings.expoGoMessage'));
        setAlertVisible(true);
        // Continue to enable tracking anyway
      }
    }
    
    setSaving(true);
    try {
      const updateData: any = { enable_walk_tracking: value };
      
      // If turning off GPS tracking, also turn off auto-share
      if (!value) {
        updateData.auto_share_walks = false;
        setAutoShareWalks(false);
      }
      
      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
      setEnableWalkTracking(value);
      
      if (value) {
        setAlertTitle(t('common.success'));
        setAlertMessage(t('settings.gpsTrackingActivated'));
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Error updating walk tracking:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setEnableWalkTracking(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateAutoShare = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ auto_share_walks: value })
        .eq('id', user.id);

      if (error) throw error;
      setAutoShareWalks(value);
    } catch (err) {
      console.error('Error updating auto share:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setAutoShareWalks(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateHomeAreaSettings = async (showSuccessMessage: boolean = false): Promise<boolean> => {
    if (!user) return false;
    
    setSaving(true);
    try {
          const { error } = await supabase
            .from('user_profiles')
            .update({
              home_area_radius_meters: homeAreaRadius,
              home_latitude: homeLatitude,
              home_longitude: homeLongitude,
              min_walk_distance_meters: minWalkDistance,
              min_walk_speed_kmh: minWalkSpeed,
              max_walk_speed_kmh: maxWalkSpeed,
              pause_tolerance_minutes: pauseTolerance,
              pause_radius_meters: pauseRadius,
            })
            .eq('id', user.id);

      if (error) throw error;
      
      if (showSuccessMessage) {
        setAlertTitle(t('common.success'));
        setAlertMessage(t('settings.settingsSaved'));
        setAlertVisible(true);
      }
      return true;
    } catch (err) {
      console.error('Error updating home area settings:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettingsPlural'));
      setAlertVisible(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateActivityNotifications = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const updateData: any = { activity_notifications_enabled: value };
      
      // If turning off master toggle, also turn off all specific toggles
      if (!value) {
        updateData.weekly_average_notifications_enabled = false;
        updateData.top_percentage_notifications_enabled = false;
        updateData.goal_streak_notifications_enabled = false;
        updateData.weekly_goal_notifications_enabled = false;
        setWeeklyAverageNotificationsEnabled(false);
        setTopPercentageNotificationsEnabled(false);
        setGoalStreakNotificationsEnabled(false);
        setWeeklyGoalNotificationsEnabled(false);
      }
      
      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
      setActivityNotificationsEnabled(value);
    } catch (err) {
      console.error('Error updating activity notifications:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setActivityNotificationsEnabled(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateWeeklyAverageNotifications = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ weekly_average_notifications_enabled: value })
        .eq('id', user.id);

      if (error) throw error;
      setWeeklyAverageNotificationsEnabled(value);
    } catch (err) {
      console.error('Error updating weekly average notifications:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setWeeklyAverageNotificationsEnabled(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateTopPercentageNotifications = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ top_percentage_notifications_enabled: value })
        .eq('id', user.id);

      if (error) throw error;
      setTopPercentageNotificationsEnabled(value);
    } catch (err) {
      console.error('Error updating top percentage notifications:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setTopPercentageNotificationsEnabled(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateGoalStreakNotifications = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ goal_streak_notifications_enabled: value })
        .eq('id', user.id);

      if (error) throw error;
      setGoalStreakNotificationsEnabled(value);
    } catch (err) {
      console.error('Error updating goal streak notifications:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setGoalStreakNotificationsEnabled(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateWeeklyGoalNotifications = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ weekly_goal_notifications_enabled: value })
        .eq('id', user.id);

      if (error) throw error;
      setWeeklyGoalNotificationsEnabled(value);
    } catch (err) {
      console.error('Error updating weekly goal notifications:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateSettings'));
      setAlertVisible(true);
      setWeeklyGoalNotificationsEnabled(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateLanguage = async (lang: Language) => {
    if (!user && !await getDeviceId()) return;
    
    setSaving(true);
    try {
      const deviceId = await getDeviceId();
      
      if (user) {
        // Update user_profiles
        const { error } = await supabase
          .from('user_profiles')
          .update({ language: lang })
          .eq('id', user.id);

        if (error) throw error;
        
        // Also update device_settings to keep them in sync
        // This ensures that when user logs out, device_settings already has the correct language
        const { error: deviceError } = await supabase
          .from('device_settings')
          .upsert({
            device_id: deviceId,
            language: lang,
          }, {
            onConflict: 'device_id'
          });
        
        if (deviceError) {
          console.warn('Error syncing language to device_settings:', deviceError);
          // Don't throw - user_profiles update was successful
        } else {
          console.log('[SettingsScreen] Synced language to device_settings:', lang);
        }
      } else {
        // Update device_settings for anonymous users
        const { error } = await supabase
          .from('device_settings')
          .upsert({
            device_id: deviceId,
            language: lang,
          }, {
            onConflict: 'device_id'
          });

        if (error) throw error;
      }
      
      setLanguagePref(lang);
      // Reload language in all components immediately
      await reloadLanguage();
      setAlertTitle(t('common.success'));
      setAlertMessage(lang === 'nb' ? t('settings.languageChangedToNorwegian') : t('settings.languageChangedToEnglish'));
      setAlertVisible(true);
    } catch (err) {
      console.error('Error updating language:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateLanguage'));
      setAlertVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const updateDistanceUnit = async (unit: DistanceUnit) => {
    if (!user && !await getDeviceId()) return; // Can't update if no user and no device
    
    setSaving(true);
    try {
      const deviceId = await getDeviceId();
      
      if (user) {
        // Update user_profiles
        const { error } = await supabase
          .from('user_profiles')
          .update({ distance_unit: unit })
          .eq('id', user.id);

        if (error) throw error;
      } else {
        // Update device_settings for anonymous users
        const { error } = await supabase
          .from('device_settings')
          .upsert({
            device_id: deviceId,
            distance_unit: unit,
          }, {
            onConflict: 'device_id'
          });

        if (error) throw error;
      }
      
      setDistanceUnit(unit);
      setAlertTitle(t('common.success'));
      setAlertMessage(unit === 'km' ? t('settings.distanceUnitChangedToKm') : t('settings.distanceUnitChangedToMiles'));
      setAlertVisible(true);
    } catch (err) {
      console.error('Error updating distance unit:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotUpdateDistanceUnit'));
      setAlertVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const setCurrentLocationAsHome = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAlertTitle(t('common.error'));
        setAlertMessage(t('settings.locationAccessRequiredForHome'));
        setAlertVisible(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setHomeLatitude(location.coords.latitude);
      setHomeLongitude(location.coords.longitude);
      
      // Auto-save after setting location
      const success = await updateHomeAreaSettings(false);
      if (success) {
        setAlertTitle(t('common.success'));
        setAlertMessage(t('settings.homeAreaSetToCurrentLocation'));
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Error getting location:', err);
      setAlertTitle(t('common.error'));
      setAlertMessage(t('settings.couldNotGetCurrentLocation'));
      setAlertVisible(true);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{t('settings.title')}</Text>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('GoalSettings')}
            >
              <Text style={styles.settingsButtonText}>🎯 {t('settings.dailyGoal')}</Text>
              <Text style={styles.settingsButtonArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Change Password Section - Only for logged in users */}
          {user && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => navigation.navigate('PasswordSettings')}
              >
                <Text style={styles.settingsButtonText}>🔒 {t('settings.changePassword')}</Text>
                <Text style={styles.settingsButtonArrow}>→</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Language and Display Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.display')}</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1ED760" />
              </View>
            ) : (
              <>
                {/* Language Selector */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>{t('settings.language')}</Text>
                    <Text style={styles.toggleDescription}>
                      {t('settings.languageDescription')}
                    </Text>
                  </View>
                  <View style={styles.unitSelector}>
                    <TouchableOpacity
                      style={[
                        styles.unitButton,
                        language === 'nb' && styles.unitButtonActive
                      ]}
                      onPress={() => updateLanguage('nb')}
                      disabled={saving}
                    >
                      <Text style={[
                        styles.unitButtonText,
                        language === 'nb' && styles.unitButtonTextActive
                      ]}>
                        🇳🇴 NO
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitButton,
                        language === 'en' && styles.unitButtonActive
                      ]}
                      onPress={() => updateLanguage('en')}
                      disabled={saving}
                    >
                      <Text style={[
                        styles.unitButtonText,
                        language === 'en' && styles.unitButtonTextActive
                      ]}>
                        🇬🇧 EN
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Distance Unit Selector */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>{t('settings.distanceUnit')}</Text>
                    <Text style={styles.toggleDescription}>
                      {t('settings.distanceUnitDescription')}
                    </Text>
                  </View>
                  <View style={styles.unitSelector}>
                    <TouchableOpacity
                      style={[
                        styles.unitButton,
                        distanceUnit === 'km' && styles.unitButtonActive
                      ]}
                      onPress={() => updateDistanceUnit('km')}
                      disabled={saving}
                    >
                      <Text style={[
                        styles.unitButtonText,
                        distanceUnit === 'km' && styles.unitButtonTextActive
                      ]}>
                      km
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitButton,
                        distanceUnit === 'mi' && styles.unitButtonActive
                      ]}
                      onPress={() => updateDistanceUnit('mi')}
                      disabled={saving}
                    >
                      <Text style={[
                        styles.unitButtonText,
                        distanceUnit === 'mi' && styles.unitButtonTextActive
                      ]}>
                        mi
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Walk Tracking Settings */}
          {user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.walkSharing')}</Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#1ED760" />
                </View>
              ) : (
                <>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <Text style={styles.toggleLabel}>{t('settings.enableWalkTracking')}</Text>
                      <Text style={styles.toggleDescription}>
                        {t('settings.enableWalkTrackingDescription')}
                      </Text>
                    </View>
                    <Switch
                      value={enableWalkTracking}
                      onValueChange={updateWalkTracking}
                      disabled={saving}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.toggleRow, styles.toggleRowIndented, !enableWalkTracking && styles.disabledRow]}>
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, !enableWalkTracking && styles.disabledText]}>
                        {t('settings.autoShareWalks')}
                      </Text>
                      <Text style={[styles.toggleDescription, !enableWalkTracking && styles.disabledText]}>
                        {enableWalkTracking 
                          ? t('settings.autoShareWalksDescription')
                          : t('settings.enableGPSFirst')}
                      </Text>
                    </View>
                    <Switch
                      value={autoShareWalks}
                      onValueChange={updateAutoShare}
                      disabled={saving || !enableWalkTracking}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  {enableWalkTracking && (
                    <>

                      {/* Home Area Settings */}
                      <View style={[styles.homeAreaSection, !enableWalkTracking && styles.disabledSection]}>
                        <Text style={[styles.homeAreaTitle, !enableWalkTracking && styles.disabledText]}>{t('settings.homeArea')}</Text>
                        <Text style={[styles.homeAreaDescription, !enableWalkTracking && styles.disabledText]}>
                          {enableWalkTracking 
                            ? t('settings.homeAreaDescription')
                            : t('settings.enableGPSFirst')}
                        </Text>

                        {/* Set Home Location Button */}
                        <TouchableOpacity
                          style={[styles.setLocationButton, !enableWalkTracking && styles.disabledButton]}
                          onPress={setCurrentLocationAsHome}
                          disabled={saving || !enableWalkTracking}
                        >
                          <Text style={[styles.setLocationButtonText, !enableWalkTracking && styles.disabledButtonText]}>
                            {t('settings.setCurrentLocation')}
                          </Text>
                        </TouchableOpacity>

                        {homeLatitude && homeLongitude && (
                          <Text style={styles.locationStatus}>
                            {t('settings.homeAreaSet')}: {homeLatitude.toFixed(6)}, {homeLongitude.toFixed(6)}
                          </Text>
                        )}

                        {/* Home Area Radius */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            {t('settings.homeAreaRadius')}: {homeAreaRadius}m ({t('settings.diameter')}: {homeAreaRadius * 2}m)
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? t('settings.homeAreaRadiusDescription')
                              : t('settings.enableGPSFirst')}
                          </Text>
                          <View style={[styles.sliderTrack, !enableWalkTracking && styles.disabledTrack]}>
                            <TouchableOpacity
                              style={[styles.sliderThumb, { left: `${(homeAreaRadius / 500) * 100}%` }]}
                              onPress={() => {}}
                              disabled={!enableWalkTracking}
                            />
                          </View>
                          <View style={styles.sliderButtons}>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.max(0, homeAreaRadius - 10);
                                  setHomeAreaRadius(newValue);
                                }
                              }}
                              disabled={homeAreaRadius <= 0 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>-10</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.min(500, homeAreaRadius + 10);
                                  setHomeAreaRadius(newValue);
                                }
                              }}
                              disabled={homeAreaRadius >= 500 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>+10</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Walk Criteria Settings */}
                      <View style={[styles.homeAreaSection, !enableWalkTracking && styles.disabledSection]}>
                        <Text style={[styles.homeAreaTitle, !enableWalkTracking && styles.disabledText]}>{t('settings.walkCriteria')}</Text>
                        <Text style={[styles.homeAreaDescription, !enableWalkTracking && styles.disabledText]}>
                          {enableWalkTracking 
                            ? t('settings.walkCriteriaDescription')
                            : t('settings.enableGPSFirst')}
                        </Text>

                        {/* Minimum Walk Distance */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            {t('settings.minimumDistance')}: {minWalkDistance}m
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? t('settings.minimumDistanceDescription')
                              : t('settings.enableGPSFirst')}
                          </Text>
                          <View style={[styles.sliderTrack, !enableWalkTracking && styles.disabledTrack]}>
                            <TouchableOpacity
                              style={[styles.sliderThumb, { left: `${((minWalkDistance - 100) / 4900) * 100}%` }]}
                              onPress={() => {}}
                              disabled={!enableWalkTracking}
                            />
                          </View>
                          <View style={styles.sliderButtons}>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.max(100, minWalkDistance - 100);
                                  setMinWalkDistance(newValue);
                                }
                              }}
                              disabled={minWalkDistance <= 100 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>-100</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.min(5000, minWalkDistance + 100);
                                  setMinWalkDistance(newValue);
                                }
                              }}
                              disabled={minWalkDistance >= 5000 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>+100</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Minimum Walk Speed */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            {t('settings.minimumSpeed')}: {minWalkSpeed.toFixed(1)} km/h
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? t('settings.minimumSpeedDescription')
                              : t('settings.enableGPSFirst')}
                          </Text>
                          <View style={[styles.sliderTrack, !enableWalkTracking && styles.disabledTrack]}>
                            <TouchableOpacity
                              style={[styles.sliderThumb, { left: `${((minWalkSpeed - 1) / 9) * 100}%` }]}
                              onPress={() => {}}
                              disabled={!enableWalkTracking}
                            />
                          </View>
                          <View style={styles.sliderButtons}>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.max(1, Math.round((minWalkSpeed - 0.5) * 10) / 10);
                                  setMinWalkSpeed(newValue);
                                }
                              }}
                              disabled={minWalkSpeed <= 1 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>-0.5</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.min(10, Math.round((minWalkSpeed + 0.5) * 10) / 10);
                                  setMinWalkSpeed(newValue);
                                }
                              }}
                              disabled={minWalkSpeed >= 10 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>+0.5</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Maximum Walk Speed */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            {t('settings.maximumSpeed')}: {maxWalkSpeed.toFixed(1)} km/h
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? t('settings.maximumSpeedDescription')
                              : t('settings.enableGPSFirst')}
                          </Text>
                          <View style={[styles.sliderTrack, !enableWalkTracking && styles.disabledTrack]}>
                            <TouchableOpacity
                              style={[styles.sliderThumb, { left: `${((maxWalkSpeed - 10) / 20) * 100}%` }]}
                              onPress={() => {}}
                              disabled={!enableWalkTracking}
                            />
                          </View>
                          <View style={styles.sliderButtons}>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.max(10, Math.round((maxWalkSpeed - 1) * 10) / 10);
                                  setMaxWalkSpeed(newValue);
                                }
                              }}
                              disabled={maxWalkSpeed <= 10 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>-1</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.min(30, Math.round((maxWalkSpeed + 1) * 10) / 10);
                                  setMaxWalkSpeed(newValue);
                                }
                              }}
                              disabled={maxWalkSpeed >= 30 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>+1</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Pause Detection Settings */}
                      <View style={[styles.homeAreaSection, !enableWalkTracking && styles.disabledSection]}>
                        <Text style={[styles.homeAreaTitle, !enableWalkTracking && styles.disabledText]}>{t('settings.pauseDetection')}</Text>
                        <Text style={[styles.homeAreaDescription, !enableWalkTracking && styles.disabledText]}>
                          {enableWalkTracking 
                            ? t('settings.pauseDetectionDescription')
                            : t('settings.enableGPSFirst')}
                        </Text>

                        {/* Pause Tolerance */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            {t('settings.pauseTolerance')}: {pauseTolerance} {t('settings.minutes')}
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? t('settings.pauseToleranceDescription')
                              : t('settings.enableGPSFirst')}
                          </Text>
                          <View style={[styles.sliderTrack, !enableWalkTracking && styles.disabledTrack]}>
                            <TouchableOpacity
                              style={[styles.sliderThumb, { left: `${((pauseTolerance - 5) / 25) * 100}%` }]}
                              onPress={() => {}}
                              disabled={!enableWalkTracking}
                            />
                          </View>
                          <View style={styles.sliderButtons}>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.max(5, pauseTolerance - 5);
                                  setPauseTolerance(newValue);
                                }
                              }}
                              disabled={pauseTolerance <= 5 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>-5</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.min(30, pauseTolerance + 5);
                                  setPauseTolerance(newValue);
                                }
                              }}
                              disabled={pauseTolerance >= 30 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>+5</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Pause Radius */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            {t('settings.pauseRadius')}: {pauseRadius}m
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? t('settings.pauseRadiusDescription')
                              : t('settings.enableGPSFirst')}
                          </Text>
                          <View style={[styles.sliderTrack, !enableWalkTracking && styles.disabledTrack]}>
                            <TouchableOpacity
                              style={[styles.sliderThumb, { left: `${((pauseRadius - 5) / 20) * 100}%` }]}
                              onPress={() => {}}
                              disabled={!enableWalkTracking}
                            />
                          </View>
                          <View style={styles.sliderButtons}>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.max(5, pauseRadius - 5);
                                  setPauseRadius(newValue);
                                }
                              }}
                              disabled={pauseRadius <= 5 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>-5</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sliderButton, !enableWalkTracking && styles.disabledButton]}
                              onPress={() => {
                                if (enableWalkTracking) {
                                  const newValue = Math.min(25, pauseRadius + 5);
                                  setPauseRadius(newValue);
                                }
                              }}
                              disabled={pauseRadius >= 25 || !enableWalkTracking}
                            >
                              <Text style={[styles.sliderButtonText, !enableWalkTracking && styles.disabledButtonText]}>+5</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Save Button */}
                      <TouchableOpacity
                        style={[styles.saveButton, !enableWalkTracking && styles.disabledButton]}
                        onPress={async () => {
                          if (enableWalkTracking) {
                            const success = await updateHomeAreaSettings(true);
                            if (success) {
                              setAlertTitle(t('common.success'));
                              setAlertMessage(t('settings.settingsSaved'));
                              setAlertVisible(true);
                            }
                          }
                        }}
                        disabled={saving || !enableWalkTracking}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[styles.saveButtonText, !enableWalkTracking && styles.disabledButtonText]}>
                            {t('settings.saveSettings')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* Activity Notifications Settings */}
          {user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('settings.activityNotifications')}</Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#1ED760" />
                </View>
              ) : (
                <>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <Text style={styles.toggleLabel}>{t('settings.activityNotificationsMaster')}</Text>
                      <Text style={styles.toggleDescription}>
                        {t('settings.activityNotificationsMasterDescription')}
                      </Text>
                    </View>
                    <Switch
                      value={activityNotificationsEnabled}
                      onValueChange={updateActivityNotifications}
                      disabled={saving}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.toggleRow, styles.toggleRowIndented, !activityNotificationsEnabled && styles.disabledRow]}>
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, !activityNotificationsEnabled && styles.disabledText]}>
                        📈 {t('settings.weeklyAverageNotifications')}
                      </Text>
                      <Text style={[styles.toggleDescription, !activityNotificationsEnabled && styles.disabledText]}>
                        {activityNotificationsEnabled 
                          ? t('settings.weeklyAverageNotificationsDescription')
                          : t('settings.enableActivityNotificationsFirst')}
                      </Text>
                    </View>
                    <Switch
                      value={weeklyAverageNotificationsEnabled}
                      onValueChange={updateWeeklyAverageNotifications}
                      disabled={saving || !activityNotificationsEnabled}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.toggleRow, styles.toggleRowIndented, !activityNotificationsEnabled && styles.disabledRow]}>
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, !activityNotificationsEnabled && styles.disabledText]}>
                        🏆 {t('settings.topPercentageNotifications')}
                      </Text>
                      <Text style={[styles.toggleDescription, !activityNotificationsEnabled && styles.disabledText]}>
                        {activityNotificationsEnabled 
                          ? t('settings.topPercentageNotificationsDescription')
                          : t('settings.enableActivityNotificationsFirst')}
                      </Text>
                    </View>
                    <Switch
                      value={topPercentageNotificationsEnabled}
                      onValueChange={updateTopPercentageNotifications}
                      disabled={saving || !activityNotificationsEnabled}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.toggleRow, styles.toggleRowIndented, !activityNotificationsEnabled && styles.disabledRow]}>
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, !activityNotificationsEnabled && styles.disabledText]}>
                        ✅ {t('settings.goalStreakNotifications')}
                      </Text>
                      <Text style={[styles.toggleDescription, !activityNotificationsEnabled && styles.disabledText]}>
                        {activityNotificationsEnabled 
                          ? t('settings.goalStreakNotificationsDescription')
                          : t('settings.enableActivityNotificationsFirst')}
                      </Text>
                    </View>
                    <Switch
                      value={goalStreakNotificationsEnabled}
                      onValueChange={updateGoalStreakNotifications}
                      disabled={saving || !activityNotificationsEnabled}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.toggleRow, styles.toggleRowIndented, !activityNotificationsEnabled && styles.disabledRow]}>
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, !activityNotificationsEnabled && styles.disabledText]}>
                        ✅ {t('settings.weeklyGoalNotifications')}
                      </Text>
                      <Text style={[styles.toggleDescription, !activityNotificationsEnabled && styles.disabledText]}>
                        {activityNotificationsEnabled 
                          ? t('settings.weeklyGoalNotificationsDescription')
                          : t('settings.enableActivityNotificationsFirst')}
                      </Text>
                    </View>
                    <Switch
                      value={weeklyGoalNotificationsEnabled}
                      onValueChange={updateWeeklyGoalNotifications}
                      disabled={saving || !activityNotificationsEnabled}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
        buttons={
          alertTitle === t('settings.locationAccessRequired') || alertTitle === t('settings.backgroundAccessRequired')
            ? [
                {
                  text: t('settings.cancel'),
                  onPress: () => setAlertVisible(false),
                  style: 'cancel',
                },
                {
                  text: t('settings.openSettings'),
                  onPress: () => {
                    setAlertVisible(false);
                    openAppSettings();
                  },
                },
              ]
            : undefined
        }
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
    paddingBottom: 10,
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
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingsButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  settingsButtonArrow: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  toggleRowIndented: {
    marginLeft: 20,
    marginTop: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  homeAreaSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  homeAreaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  homeAreaDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  setLocationButton: {
    backgroundColor: '#1ED760',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  setLocationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationStatus: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sliderDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    position: 'relative',
    marginBottom: 8,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1ED760',
    top: -6,
    marginLeft: -10,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sliderButton: {
    flex: 1,
    backgroundColor: '#1ED760',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  sliderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1ED760',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledRow: {
    opacity: 0.5,
  },
  disabledSection: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#666',
  },
  disabledTrack: {
    opacity: 0.5,
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  unitButtonActive: {
    borderColor: '#1ED760',
    backgroundColor: '#1ED760',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
});

