/**
 * Migration Service
 * Overfører anonym brukerdata (device_id) til brukerkonto (user_id)
 * når brukeren logger inn eller registrerer seg
 */

import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

/**
 * Migrerer anonym brukerdata til brukerkonto
 * Overfører: profilbilde, daglig mål, skrittdata, achievements
 */
export const migrateAnonymousDataToUser = async (userId: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const deviceId = await getDeviceId();
    
    if (!deviceId) {
      console.log('No device ID found, skipping migration');
      return { success: true }; // Not an error, just no data to migrate
    }

    console.log('Starting migration for device:', deviceId, 'to user:', userId);

    // 1. Migrer profilinnstillinger (bilde, daglig mål)
    // Wrap i try-catch for å ikke stoppe migreringen hvis dette feiler
    try {
      await migrateProfileSettings(deviceId, userId);
    } catch (error) {
      console.warn('Error migrating profile settings (continuing):', error);
    }

    // 2. Migrer skrittdata
    // Wrap i try-catch for å ikke stoppe migreringen hvis dette feiler
    try {
      await migrateStepData(deviceId, userId);
    } catch (error) {
      console.warn('Error migrating step data (continuing):', error);
    }

    // 3. Migrer achievements
    // Wrap i try-catch for å ikke stoppe migreringen hvis dette feiler
    try {
      await migrateAchievements(deviceId, userId);
    } catch (error) {
      console.warn('Error migrating achievements (continuing):', error);
    }

    console.log('Migration completed (some parts may have failed, but migration process finished)');
    return { success: true }; // Return success even if some parts failed
  } catch (error) {
    console.error('Critical error during migration:', error);
    // Return success:true anyway - we don't want to block the user if migration fails
    return { success: true, error };
  }
};

/**
 * Migrer profilinnstillinger (avatar_url, daily_step_goal) fra device_settings til user_profiles
 * Kopierer også bildet fra anonymous/ mappen til userId/ mappen i Storage
 */
async function migrateProfileSettings(deviceId: string, userId: string): Promise<void> {
  try {
    // Hent device_settings
    const { data: deviceSettings, error: deviceError } = await supabase
      .from('device_settings')
      .select('avatar_url, daily_step_goal')
      .eq('device_id', deviceId)
      .single();

    if (deviceError && deviceError.code !== 'PGRST116') {
      console.error('Error fetching device settings:', deviceError);
      return;
    }

    if (!deviceSettings) {
      console.log('No device settings found to migrate');
      return;
    }

    // Hent eksisterende user_profiles for å se hva som allerede finnes
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('avatar_url, daily_step_goal')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return;
    }

    // Bygg oppdateringsobjekt - bare overfør hvis brukeren ikke allerede har det
    const updates: { avatar_url?: string; daily_step_goal?: number | null } = {};

    // Håndter avatar_url - kopier filen fra anonymous/ til userId/ hvis nødvendig
    // Hvis device har nyere bilde enn bruker, kopier det
    const shouldMigrateAvatar = () => {
      if (!deviceSettings.avatar_url) return false;
      
      // Hvis bruker ikke har bilde, alltid migrer
      if (!userProfile?.avatar_url) return true;
      
      // Hvis device har bilde i anonymous/ og bruker har bilde, sjekk timestamp
      if (deviceSettings.avatar_url.includes('/anonymous/')) {
        // Hent timestamp fra filnavnet (format: deviceId_timestamp.ext)
        const deviceFileName = deviceSettings.avatar_url.split('/').pop()?.split('?')[0] || '';
        const deviceTimestamp = parseInt(deviceFileName.split('_')[1]?.split('.')[0] || '0');
        
        // Hent timestamp fra brukerens filnavn (format: userId_timestamp.ext)
        const userFileName = userProfile.avatar_url.split('/').pop()?.split('?')[0] || '';
        const userTimestamp = parseInt(userFileName.split('_')[1]?.split('.')[0] || '0');
        
        // Hvis device-bildet er nyere (høyere timestamp), migrer det
        if (deviceTimestamp > userTimestamp) {
          console.log(`Device avatar is newer (${deviceTimestamp} > ${userTimestamp}), migrating...`);
          return true;
        }
      }
      
      return false;
    };

    if (shouldMigrateAvatar()) {
      // Sjekk om bildet ligger i anonymous/ mappen
      if (deviceSettings.avatar_url.includes('/anonymous/')) {
        try {
          // Hent filnavnet fra URL-en
          const urlParts = deviceSettings.avatar_url.split('/');
          const sourceFileName = urlParts[urlParts.length - 1].split('?')[0]; // Fjern cache-busting query param
          const sourcePath = `anonymous/${sourceFileName}`;
          
          // Bruk ny timestamp for target fil for å unngå konflikter og sikre at det er det nyeste bildet
          const fileExt = sourceFileName.split('.').pop() || 'jpg';
          const newTimestamp = Date.now();
          const targetFileName = `${userId}_${newTimestamp}.${fileExt}`;
          const targetPath = `${userId}/${targetFileName}`;

          // Alltid kopier bildet fra anonymous/ til userId/ (ikke sjekk etter eksisterende filer)
          // Dette sikrer at det nyeste bildet fra anonym bruker blir brukt
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('avatars')
            .download(sourcePath);

          if (!downloadError && imageData) {
            // Konverter blob til ArrayBuffer for React Native
            const arrayBuffer = await imageData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Last opp til userId/ mappen (overskriver eventuelt eksisterende med samme navn)
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(targetPath, uint8Array, {
                contentType: 'image/jpeg', // Default, kan hentes fra metadata
                upsert: true,
              });

            if (!uploadError && uploadData) {
              // Få ny public URL
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(targetPath);

              updates.avatar_url = urlData.publicUrl;
              console.log('Copied avatar from anonymous/ to userId/');
              
              // Oppdater også device_settings til å peke på samme fil for konsistens
              await supabase
                .from('device_settings')
                .update({ avatar_url: urlData.publicUrl })
                .eq('device_id', deviceId);
            } else {
              // Hvis opplasting feiler, bruk original URL
              updates.avatar_url = deviceSettings.avatar_url;
            }
          } else {
            // Hvis nedlasting feiler, bruk original URL
            updates.avatar_url = deviceSettings.avatar_url;
          }
        } catch (avatarError) {
          console.warn('Error copying avatar file (using original URL):', avatarError);
          // Fallback: bruk original URL
          updates.avatar_url = deviceSettings.avatar_url;
        }
      } else {
        // URL peker ikke til anonymous/, så bruk den direkte
        updates.avatar_url = deviceSettings.avatar_url;
      }
    } else if (deviceSettings.avatar_url && userProfile?.avatar_url) {
      // Begge har avatar_url - sjekk hvilket som er nyest basert på timestamp
      let deviceTimestamp = 0;
      let userTimestamp = 0;
      
      // Hent timestamp fra device bilde hvis det er i anonymous/
      if (deviceSettings.avatar_url.includes('/anonymous/')) {
        const deviceFileName = deviceSettings.avatar_url.split('/').pop()?.split('?')[0] || '';
        deviceTimestamp = parseInt(deviceFileName.split('_')[1]?.split('.')[0] || '0');
      }
      
      // Hent timestamp fra user bilde hvis det er i userId/
      if (userProfile.avatar_url.includes(`/${userId}/`)) {
        const userFileName = userProfile.avatar_url.split('/').pop()?.split('?')[0] || '';
        userTimestamp = parseInt(userFileName.split('_')[1]?.split('.')[0] || '0');
      }
      
      // Hvis device-bildet er nyere, kopier det til userId/ og oppdater begge
      if (deviceTimestamp > userTimestamp && deviceSettings.avatar_url.includes('/anonymous/')) {
        try {
          const urlParts = deviceSettings.avatar_url.split('/');
          const sourceFileName = urlParts[urlParts.length - 1].split('?')[0];
          const sourcePath = `anonymous/${sourceFileName}`;
          
          // Bruk ny timestamp for target fil for å unngå konflikter
          const fileExt = sourceFileName.split('.').pop() || 'jpg';
          const newTimestamp = Date.now();
          const targetFileName = `${userId}_${newTimestamp}.${fileExt}`;
          const targetPath = `${userId}/${targetFileName}`;

          const { data: imageData, error: downloadError } = await supabase.storage
            .from('avatars')
            .download(sourcePath);

          if (!downloadError && imageData) {
            const arrayBuffer = await imageData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(targetPath, uint8Array, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(targetPath);

              // Oppdater begge til å peke på ny fil
              await supabase
                .from('user_profiles')
                .update({ avatar_url: urlData.publicUrl })
                .eq('id', userId);

              await supabase
                .from('device_settings')
                .update({ avatar_url: urlData.publicUrl })
                .eq('device_id', deviceId);
              
              console.log(`Migrated newer avatar from anonymous/ (${deviceTimestamp} > ${userTimestamp})`);
            }
          }
        } catch (copyError) {
          console.warn('Error copying newer avatar:', copyError);
        }
      } else if (userTimestamp >= deviceTimestamp || userProfile.avatar_url.includes(`/${userId}/`)) {
        // Bruker-bildet er nyere eller lik, synkroniser device_settings til å peke på samme fil
        await supabase
          .from('device_settings')
          .update({ avatar_url: userProfile.avatar_url })
          .eq('device_id', deviceId);
        console.log('Synced device_settings to use user_profiles avatar');
      } else if (userProfile.avatar_url === deviceSettings.avatar_url) {
        // De peker allerede på samme fil - perfekt!
        console.log('Avatars already in sync');
      }
    }

    // Overfør daily_step_goal hvis device har det og bruker ikke har det
    if (deviceSettings.daily_step_goal !== null && deviceSettings.daily_step_goal !== undefined) {
      if (userProfile?.daily_step_goal === null || userProfile?.daily_step_goal === undefined) {
        updates.daily_step_goal = deviceSettings.daily_step_goal;
      }
    }

    // Oppdater brukerprofil hvis det er noe å oppdatere
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user profile:', updateError);
      } else {
        console.log('Migrated profile settings:', updates);
      }
    }
  } catch (error) {
    console.error('Error in migrateProfileSettings:', error);
  }
}

/**
 * Migrer skrittdata fra device_id til user_id
 * Oppdaterer eksisterende entries eller lager nye hvis de ikke finnes
 */
async function migrateStepData(deviceId: string, userId: string): Promise<void> {
  try {
    // Hent alle skrittdata for device_id
    const { data: deviceStepData, error: fetchError } = await supabase
      .from('step_data')
      .select('date, steps, distance_meters')
      .eq('device_id', deviceId)
      .is('user_id', null);

    if (fetchError) {
      console.error('Error fetching device step data:', fetchError);
      return;
    }

    if (!deviceStepData || deviceStepData.length === 0) {
      console.log('No step data found to migrate');
      return;
    }

    console.log(`Migrating ${deviceStepData.length} step data entries`);

    // For hver entry, sjekk om det allerede finnes en entry for brukeren på samme dato
    // Hvis ikke, opprett en ny. Hvis ja, ta den med høyest verdi
    for (const deviceEntry of deviceStepData) {
      try {
        // Sjekk om bruker allerede har data for denne datoen
        // Bruk .maybeSingle() for å håndtere både ingen resultater og nettverksfeil bedre
        const { data: userEntry, error: userFetchError } = await supabase
          .from('step_data')
          .select('id, steps, distance_meters')
          .eq('user_id', userId)
          .eq('date', deviceEntry.date)
          .maybeSingle();

        // Håndter nettverksfeil og andre feil
        if (userFetchError) {
          // Hvis det er en nettverksfeil eller annen feil, logg og fortsett med neste entry
          if (userFetchError.code === 'PGRST116') {
            // Ingen entry funnet - det er OK, fortsett med insert
          } else {
            // Nettverksfeil eller annen feil - logg og hopp over denne
            console.warn(`Error checking user step data for ${deviceEntry.date}:`, userFetchError.message || userFetchError);
            continue; // Hopp over denne entry og fortsett med neste
          }
        }

        if (!userEntry) {
          // Bruker har ikke data for denne datoen - opprett ny entry
          const { error: insertError } = await supabase
            .from('step_data')
            .insert({
              user_id: userId,
              date: deviceEntry.date,
              steps: deviceEntry.steps,
              distance_meters: deviceEntry.distance_meters,
            });

          if (insertError) {
            console.warn(`Error inserting step data for ${deviceEntry.date}:`, insertError.message || insertError);
            // Fortsett med neste entry selv om dette feiler
          } else {
            console.log(`Migrated step data for ${deviceEntry.date}`);
          }
        } else {
          // Bruker har allerede data - ta den med høyest verdi
          if (deviceEntry.steps > userEntry.steps) {
            const { error: updateError } = await supabase
              .from('step_data')
              .update({
                steps: deviceEntry.steps,
                distance_meters: deviceEntry.distance_meters,
              })
              .eq('id', userEntry.id);

            if (updateError) {
              console.warn(`Error updating step data for ${deviceEntry.date}:`, updateError.message || updateError);
              // Fortsett med neste entry selv om dette feiler
            } else {
              console.log(`Updated step data for ${deviceEntry.date} with higher value`);
            }
          }
        }
      } catch (entryError) {
        // Fanger opp eventuelle uventede feil (som nettverksfeil)
        console.warn(`Unexpected error migrating step data for ${deviceEntry.date}:`, entryError);
        // Fortsett med neste entry
        continue;
      }
    }

    console.log('Step data migration completed');
  } catch (error) {
    console.error('Error in migrateStepData:', error);
  }
}

/**
 * Migrer achievements fra device_id til user_id
 * Sjekker om brukeren allerede har achievementet, og oppdaterer teller hvis nødvendig
 */
async function migrateAchievements(deviceId: string, userId: string): Promise<void> {
  try {
    // Hent alle achievements for device_id
    const { data: deviceAchievements, error: fetchError } = await supabase
      .from('user_achievements')
      .select('achievement_type_id, count, first_earned_at, last_earned_at')
      .eq('device_id', deviceId)
      .is('user_id', null);

    if (fetchError) {
      console.error('Error fetching device achievements:', fetchError);
      return;
    }

    if (!deviceAchievements || deviceAchievements.length === 0) {
      console.log('No achievements found to migrate');
      return;
    }

    console.log(`Migrating ${deviceAchievements.length} achievements`);

    // For hvert achievement, sjekk om brukeren allerede har det
    for (const deviceAchievement of deviceAchievements) {
      try {
        // Sjekk om bruker allerede har dette achievementet
        const { data: userAchievement, error: userFetchError } = await supabase
          .from('user_achievements')
          .select('id, count, last_earned_at')
          .eq('user_id', userId)
          .eq('achievement_type_id', deviceAchievement.achievement_type_id)
          .maybeSingle();

        // Håndter nettverksfeil og andre feil
        if (userFetchError) {
          if (userFetchError.code === 'PGRST116') {
            // Ingen entry funnet - det er OK, fortsett med insert
          } else {
            // Nettverksfeil eller annen feil - logg og hopp over denne
            console.warn(`Error checking user achievement ${deviceAchievement.achievement_type_id}:`, userFetchError.message || userFetchError);
            continue;
          }
        }

      if (!userAchievement) {
        // Bruker har ikke dette achievementet - opprett ny
        const { error: insertError } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_type_id: deviceAchievement.achievement_type_id,
            count: deviceAchievement.count,
            first_earned_at: deviceAchievement.first_earned_at,
            last_earned_at: deviceAchievement.last_earned_at,
          });

        if (insertError) {
          console.warn(`Error inserting achievement ${deviceAchievement.achievement_type_id}:`, insertError.message || insertError);
          // Fortsett med neste achievement selv om dette feiler
        } else {
          console.log(`Migrated achievement ${deviceAchievement.achievement_type_id}`);
        }
      } else {
        // Bruker har allerede achievementet - ta den med høyest count
        const maxCount = Math.max(userAchievement.count, deviceAchievement.count);
        if (maxCount > userAchievement.count) {
          const { error: updateError } = await supabase
            .from('user_achievements')
            .update({
              count: maxCount,
              last_earned_at: deviceAchievement.last_earned_at > (userAchievement.last_earned_at || '')
                ? deviceAchievement.last_earned_at
                : undefined,
            })
            .eq('id', userAchievement.id);

          if (updateError) {
            console.warn(`Error updating achievement ${deviceAchievement.achievement_type_id}:`, updateError.message || updateError);
            // Fortsett med neste achievement selv om dette feiler
          } else {
            console.log(`Updated achievement ${deviceAchievement.achievement_type_id} with higher count`);
          }
        }
      }
      } catch (entryError) {
        // Fanger opp eventuelle uventede feil (som nettverksfeil)
        console.warn(`Unexpected error migrating achievement ${deviceAchievement.achievement_type_id}:`, entryError);
        // Fortsett med neste achievement
        continue;
      }
    }

    // Migrer også achievement_log entries (for detaljert historikk)
    const { data: deviceLogs, error: logFetchError } = await supabase
      .from('achievement_log')
      .select('achievement_type_id, earned_at, metadata')
      .eq('device_id', deviceId)
      .is('user_id', null);

    if (!logFetchError && deviceLogs && deviceLogs.length > 0) {
      console.log(`Migrating ${deviceLogs.length} achievement log entries`);
      
      // Sjekk hvilke log entries som ikke allerede finnes for brukeren
      for (const logEntry of deviceLogs) {
        // Sjekk om dette allerede eksisterer (basert på achievement_type_id og earned_at)
        const { data: existingLogs, error: checkError } = await supabase
          .from('achievement_log')
          .select('id')
          .eq('user_id', userId)
          .eq('achievement_type_id', logEntry.achievement_type_id)
          .eq('earned_at', logEntry.earned_at)
          .limit(1);

        if (checkError) {
          console.error('Error checking achievement log:', checkError);
          continue;
        }

        if (!existingLogs || existingLogs.length === 0) {
          // Entry finnes ikke - opprett ny
          const { error: insertError } = await supabase
            .from('achievement_log')
            .insert({
              user_id: userId,
              achievement_type_id: logEntry.achievement_type_id,
              earned_at: logEntry.earned_at,
              metadata: logEntry.metadata,
            });

          if (insertError) {
            console.error('Error inserting achievement log:', insertError);
          }
        }
      }
    }

    console.log('Achievements migration completed');
  } catch (error) {
    console.error('Error in migrateAchievements:', error);
  }
}

