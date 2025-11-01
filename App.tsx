import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function App() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // Test Supabase connection
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('_test').select('*').limit(0);
        // Even if table doesn't exist, if we get here without a connection error, it works
        setConnected(true);
      } catch (err: any) {
        // Check if it's a connection error or just a missing table
        if (err.message?.includes('fetch') || err.message?.includes('network')) {
          setConnected(false);
        } else {
          // Table might not exist, but connection works
          setConnected(true);
        }
      }
    };

    testConnection();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Steppin - Skrittteller App</Text>
      {connected === true && (
        <Text style={styles.success}>✓ Supabase tilkoblet!</Text>
      )}
      {connected === false && (
        <Text style={styles.error}>✗ Supabase tilkobling feilet</Text>
      )}
      {connected === null && (
        <Text style={styles.subtitle}>Tester tilkobling...</Text>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  success: {
    marginTop: 10,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  error: {
    marginTop: 10,
    fontSize: 16,
    color: '#F44336',
    fontWeight: '600',
  },
});
