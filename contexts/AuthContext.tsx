import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { migrateAnonymousDataToUser } from '../services/migrationService';
import { getDeviceId } from '../lib/deviceId';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Migrer anonym data når bruker logger inn (SIGNED_IN event)
      if (event === 'SIGNED_IN' && session?.user) {
        migrateAnonymousDataToUser(session.user.id).catch(err => {
          console.error('Error migrating anonymous data on sign in:', err);
          // Ikke feil hvis migrering feiler - brukeren er fortsatt innlogget
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (emailOrUsername: string, password: string) => {
    let email = emailOrUsername.trim().toLowerCase();

      // Check if input is username (doesn't contain @)
      if (!emailOrUsername.includes('@')) {
        // Use RPC function to get email by username (bypasses RLS)
        const { data: emailData, error: rpcError } = await supabase
          .rpc('get_email_by_username', {
            username_input: emailOrUsername.toLowerCase().trim()
          });

      if (rpcError) {
        if (__DEV__) {
          console.error('RPC lookup error:', rpcError);
        }
        return { 
          error: { 
            message: 'Brukernavn eller passord er feil',
            status: 400,
            originalError: rpcError
          } 
        };
      }

      // RPC function now returns TEXT directly (not TABLE)
      // So emailData will be a string or null
      const foundEmail = emailData as string | null;

      if (!foundEmail || foundEmail.trim() === '') {
        if (__DEV__) {
          console.error('No email found for username:', emailOrUsername);
        }
        return { 
          error: { 
            message: 'Brukernavn eller passord er feil',
            status: 400
          } 
        };
      }

      email = foundEmail.trim().toLowerCase();
    }

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Improve error message for user
    if (error) {
      if (error.message?.includes('Invalid login credentials') || 
          error.message?.includes('Invalid email') ||
          error.message?.includes('Email not confirmed')) {
        return { 
          error: { 
            ...error,
            message: 'Brukernavn/e-post eller passord er feil',
          } 
        };
      }
      return { error };
    }

    // Migrer anonym data til brukerkonto når innlogging er vellykket
    if (data.user) {
      migrateAnonymousDataToUser(data.user.id).catch(err => {
        console.error('Error migrating anonymous data:', err);
        // Ikke feil hvis migrering feiler - brukeren er fortsatt innlogget
      });
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, username: string) => {
    // First create auth user
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error('Sign up auth error:', authError);
      return { error: authError };
    }

    if (!data.user) {
      return { error: { message: 'Kunne ikke opprette bruker' } };
    }

    // Wait a moment for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Then update user profile with username and email
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ username, email: email.toLowerCase() })
      .eq('id', data.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Don't fail if profile update fails - user is still created
      // They can update username later
    }

    // Migrer anonym data til brukerkonto når registrering er vellykket
    migrateAnonymousDataToUser(data.user.id).catch(err => {
      console.error('Error migrating anonymous data:', err);
      // Ikke feil hvis migrering feiler - brukeren er fortsatt opprettet
    });

    return { error: null };
  };

  const signOut = async () => {
    // Før logg ut: sørg for at device_settings har samme preferanser som user_profiles
    // Dette sikrer at samme innstillinger (avatar, språk, avstandsenhet) vises uavhengig av innloggingsstatus
    const currentUser = user;
    if (currentUser) {
      try {
        // Hent brukerens preferanser
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('avatar_url, language, distance_unit')
          .eq('id', currentUser.id)
          .single();

        if (userProfile) {
          // Oppdater device_settings til å ha samme preferanser
          const deviceId = await getDeviceId();
          
          // Sjekk om device_settings eksisterer
          const { data: existing } = await supabase
            .from('device_settings')
            .select('id')
            .eq('device_id', deviceId)
            .single();

          const updateData: any = {};
          if (userProfile.avatar_url) {
            updateData.avatar_url = userProfile.avatar_url;
          }
          if (userProfile.language) {
            updateData.language = userProfile.language;
          }
          if (userProfile.distance_unit) {
            updateData.distance_unit = userProfile.distance_unit;
          }

          if (Object.keys(updateData).length > 0) {
            if (existing) {
              // Oppdater eksisterende - vente på at oppdateringen er fullført
              const { error: updateError } = await supabase
                .from('device_settings')
                .update(updateData)
                .eq('device_id', deviceId);
              
              if (updateError) {
                console.warn('[AuthContext] Error updating device_settings on sign out:', updateError);
              } else {
                console.log('[AuthContext] ✅ Synced preferences to device_settings:', updateData);
                // Verifiser at oppdateringen var vellykket ved å hente dataen igjen
                const { data: verifyData } = await supabase
                  .from('device_settings')
                  .select('language, distance_unit')
                  .eq('device_id', deviceId)
                  .single();
                console.log('[AuthContext] Verified device_settings after sync:', verifyData);
              }
            } else {
              // Opprett ny entry - vente på at insert er fullført
              const { error: insertError } = await supabase
                .from('device_settings')
                .insert({
                  device_id: deviceId,
                  ...updateData,
                });
              
              if (insertError) {
                console.warn('[AuthContext] Error inserting device_settings on sign out:', insertError);
              } else {
                console.log('[AuthContext] ✅ Created device_settings with preferences:', updateData);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error syncing preferences on sign out:', err);
        // Fortsett med logg ut selv om dette feiler
      }
    }

    // Vent litt for å sikre at database-oppdateringen er fullført før vi logger ut
    // Dette gir LanguageProvider tid til å laste språket fra device_settings
    console.log('[AuthContext] Waiting before sign out to ensure sync is complete...');
    await new Promise(resolve => setTimeout(resolve, 300)); // Increased delay to 300ms
    
    console.log('[AuthContext] Signing out...');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

