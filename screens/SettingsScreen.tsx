import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { user } = useAuth();
  
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
        </View>
      </ScrollView>
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
});

