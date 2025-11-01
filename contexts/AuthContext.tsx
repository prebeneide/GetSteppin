import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { migrateAnonymousDataToUser } from '../services/migrationService';

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
      console.log('Attempting login with username:', emailOrUsername);
      
      // Use RPC function to get email by username (bypasses RLS)
      const { data: emailData, error: rpcError } = await supabase
        .rpc('get_email_by_username', {
          username_input: emailOrUsername.toLowerCase().trim()
        });

      console.log('RPC lookup result:', { emailData, rpcError });

      if (rpcError) {
        console.error('RPC lookup error:', rpcError);
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
        console.error('No email found for username:', emailOrUsername, 'Data:', emailData);
        return { 
          error: { 
            message: 'Brukernavn eller passord er feil',
            status: 400
          } 
        };
      }

      email = foundEmail.trim().toLowerCase();
      console.log('Found email for username:', email);
    }

    console.log('Attempting login with email:', email);

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Sign in result:', { data, error });

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

