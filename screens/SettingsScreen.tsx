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

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { user } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('Feil');
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
      const { data, error } = await supabase
        .from('user_profiles')
        .select('enable_walk_tracking, auto_share_walks, home_area_radius_meters, home_latitude, home_longitude, min_walk_distance_meters, min_walk_speed_kmh, max_walk_speed_kmh, pause_tolerance_minutes, pause_radius_meters')
        .eq('id', user!.id)
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
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke laste innstillinger');
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
              setAlertTitle('Lokasjonstilgang nødvendig');
              setAlertMessage('For å spore turer trenger appen tilgang til din lokasjon. Du kan gi tilgang i innstillinger.');
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
        setAlertTitle('Info');
        setAlertMessage('Expo Go støtter ikke alle iOS-permissions. GPS-sporing vil fungere når appen er åpen (foreground tracking). For full funksjonalitet, bygg en development build.');
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
        setAlertTitle('Suksess');
        setAlertMessage('GPS-sporing er aktivert! Appen vil nå spore turer når du går utenfor hjemområdet ditt.');
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Error updating walk tracking:', err);
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke oppdatere innstilling');
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
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke oppdatere innstilling');
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
        setAlertTitle('Suksess');
        setAlertMessage('Innstillinger lagret!');
        setAlertVisible(true);
      }
      return true;
    } catch (err) {
      console.error('Error updating home area settings:', err);
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke oppdatere innstillinger');
      setAlertVisible(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setCurrentLocationAsHome = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAlertTitle('Feil');
        setAlertMessage('Lokasjonstilgang er nødvendig for å sette hjemområdet');
        setAlertVisible(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setHomeLatitude(location.coords.latitude);
      setHomeLongitude(location.coords.longitude);
      
      // Auto-save after setting location
      const success = await updateHomeAreaSettings(false);
      if (success) {
        setAlertTitle('Suksess');
        setAlertMessage('Hjemområde satt til nåværende lokasjon!');
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Error getting location:', err);
      setAlertTitle('Feil');
      setAlertMessage('Kunne ikke hente nåværende lokasjon');
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
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Innstillinger</Text>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('GoalSettings')}
            >
              <Text style={styles.settingsButtonText}>🎯 Daglig mål</Text>
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
                <Text style={styles.settingsButtonText}>🔒 Endre passord</Text>
                <Text style={styles.settingsButtonArrow}>→</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Walk Tracking Settings */}
          {user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Turdeling</Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#1ED760" />
                </View>
              ) : (
                <>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <Text style={styles.toggleLabel}>Aktiver GPS-sporing</Text>
                      <Text style={styles.toggleDescription}>
                        Automatisk spore og registrere turer når du går eller løper utenfor hjemområdet ditt
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
                        Automatisk deling i feed
                      </Text>
                      <Text style={[styles.toggleDescription, !enableWalkTracking && styles.disabledText]}>
                        {enableWalkTracking 
                          ? 'Del turer automatisk som innlegg i feeden når de oppfyller kriteriene'
                          : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                        <Text style={[styles.homeAreaTitle, !enableWalkTracking && styles.disabledText]}>Hjemområde</Text>
                        <Text style={[styles.homeAreaDescription, !enableWalkTracking && styles.disabledText]}>
                          {enableWalkTracking 
                            ? 'Turer trackes kun når du går utenfor hjemområdet ditt. Dette forhindrer at turer registreres når du går rundt inne i huset ditt.'
                            : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
                        </Text>

                        {/* Set Home Location Button */}
                        <TouchableOpacity
                          style={[styles.setLocationButton, !enableWalkTracking && styles.disabledButton]}
                          onPress={setCurrentLocationAsHome}
                          disabled={saving || !enableWalkTracking}
                        >
                          <Text style={[styles.setLocationButtonText, !enableWalkTracking && styles.disabledButtonText]}>
                            📍 Sett nåværende lokasjon som hjem
                          </Text>
                        </TouchableOpacity>

                        {homeLatitude && homeLongitude && (
                          <Text style={styles.locationStatus}>
                            Hjemområde satt: {homeLatitude.toFixed(6)}, {homeLongitude.toFixed(6)}
                          </Text>
                        )}

                        {/* Home Area Radius */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            Hjemområde radius: {homeAreaRadius}m (diameter: {homeAreaRadius * 2}m)
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? 'Størrelsen på området rundt hjemmet ditt hvor turer ikke trackes. Jo større radius, jo lenger må du gå før tracking starter.'
                              : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                        <Text style={[styles.homeAreaTitle, !enableWalkTracking && styles.disabledText]}>Kriterier for tur</Text>
                        <Text style={[styles.homeAreaDescription, !enableWalkTracking && styles.disabledText]}>
                          {enableWalkTracking 
                            ? 'Disse innstillingene bestemmer når en bevegelse skal registreres som en tur.'
                            : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
                        </Text>

                        {/* Minimum Walk Distance */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            Minimum strekning: {minWalkDistance}m
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? 'Den korteste strekningen en tur må være for å bli registrert. Turer kortere enn dette vil ikke bli lagret.'
                              : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                            Minimum hastighet for å starte: {minWalkSpeed.toFixed(1)} km/h
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? 'Den laveste hastigheten du må gå for at tracking skal starte. Når tracking har startet, kan du gå sakte eller stoppe (f.eks. for å la hunden lukte) uten at tracking stopper. Eksempel: 3 km/h = normal gangfart.'
                              : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                            Maksimal hastighet: {maxWalkSpeed.toFixed(1)} km/h
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? 'Hvis hastigheten overstiger denne verdien UTEN at du har gått steg (f.eks. i bil eller på løpehjul), blir tracking avbrutt. Hvis du løper (med steg), fortsetter tracking uansett hastighet. Eksempel: 15 km/h = rask løping, men filtrerer ut bil/buss/sykkel/løpehjul.'
                              : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                        <Text style={[styles.homeAreaTitle, !enableWalkTracking && styles.disabledText]}>Pause-deteksjon</Text>
                        <Text style={[styles.homeAreaDescription, !enableWalkTracking && styles.disabledText]}>
                          {enableWalkTracking 
                            ? 'Disse innstillingene bestemmer når en lang pause skal avbryte tracking. Brukes for å filtrere ut kjøpesenter-gående, men tillater pauser i parker/hundeparker.'
                            : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
                        </Text>

                        {/* Pause Tolerance */}
                        <View style={styles.sliderContainer}>
                          <Text style={[styles.sliderLabel, !enableWalkTracking && styles.disabledText]}>
                            Pause-toleranse: {pauseTolerance} minutter
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? 'Hvis du stopper lenger enn denne tiden innenfor pause-radius, blir tracking avbrutt. Hvis du har beveget deg mye før pausen (f.eks. i hundepark), blir turen lagret. Hvis du har beveget deg lite (f.eks. kjøpesenter), blir turen ikke registrert. Eksempel: 15 minutter = lunsj eller langt stopp.'
                              : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                            Pause-radius: {pauseRadius}m
                          </Text>
                          <Text style={[styles.sliderDescription, !enableWalkTracking && styles.disabledText]}>
                            {enableWalkTracking 
                              ? 'Hvis du stopper lenger enn pause-toleranse innenfor denne radiusen, blir tracking avbrutt. Jo mindre radius, jo mer bevegelse tillates før pausen registreres. Eksempel: 10m = omtrent et lite rom, 20m = større område.'
                              : 'Aktiver GPS-sporing først for å bruke denne innstillingen'}
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
                              setAlertTitle('Suksess');
                              setAlertMessage('Innstillinger lagret!');
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
                            Lagre innstillinger
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
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
          alertTitle === 'Lokasjonstilgang nødvendig' || alertTitle === 'Bakgrunnstilgang nødvendig'
            ? [
                {
                  text: 'Avbryt',
                  onPress: () => setAlertVisible(false),
                  style: 'cancel',
                },
                {
                  text: 'Åpne innstillinger',
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
});

