/**
 * Friend Service
 * Håndterer alle venneoperasjoner: søk, send forespørsel, akseptere, avslå, liste venner
 */

import { supabase } from '../lib/supabase';

export interface Friend {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  friendship_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  is_requester: boolean; // true hvis du sendte forespørselen
  created_at: string;
  last_active?: string | null; // Timestamp for when user last updated step data
}

export interface FriendRequest {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  friendship_id: string;
  created_at?: string;
  last_active?: string | null; // Timestamp for when user last updated step data
}

/**
 * Søk etter brukere etter brukernavn eller e-post
 * Returnerer alltid brukernavn for visning (ikke e-post)
 */
export const searchUsers = async (
  query: string,
  currentUserId: string
): Promise<{ data: Friend[] | null; error: any }> => {
  try {
    if (!query || query.trim().length < 2) {
      return { data: [], error: null };
    }

    const searchQuery = query.trim().toLowerCase();

    // Søk etter brukere med lignende brukernavn ELLER e-post
    // Men vi returnerer alltid brukernavn for visning
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, avatar_url, email')
      .or(`username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .neq('id', currentUserId) // Ekskluder deg selv
      .limit(20);

    if (error) {
      console.error('Error searching users:', error);
      return { data: null, error };
    }

    // Sjekk om det allerede finnes et vennskap med hver bruker
    const userIds = (data || []).map(u => u.id);
    
    if (userIds.length === 0) {
      return { data: [], error: null };
    }

    // Hent eksisterende vennskap hvor brukeren er involvert med noen av de søkte brukerne
    // Bruk en enklere query med separate conditions
    let friendshipQuery = supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(
        userIds.map(id => `and(requester_id.eq.${currentUserId},addressee_id.eq.${id}),and(addressee_id.eq.${currentUserId},requester_id.eq.${id})`).join(',')
      );

    const { data: friendships, error: friendshipError } = await friendshipQuery;

    if (friendshipError) {
      console.error('Error fetching friendships:', friendshipError);
      // Fortsett uten friendship info
    }

    // Kombiner brukerdata med friendship status
    // FILTRER UT brukere uten brukernavn (null eller tomt) ELLER hvor brukernavn er en email
    // VI VIL ALDRI VISE E-POST I STEDET FOR BRUKERNAVN
    const usersWithFriendshipStatus = (data || [])
      .filter(user => {
        const username = user.username?.trim() || '';
        // Filtrer ut hvis: tomt, null, eller inneholder @ (indikerer email)
        return username !== '' && !username.includes('@');
      })
      .map(user => {
        const friendship = friendships?.find(
          f =>
            (f.requester_id === currentUserId && f.addressee_id === user.id) ||
            (f.addressee_id === currentUserId && f.requester_id === user.id)
        );

        return {
          id: user.id,
          username: user.username.trim(), // Sikre at vi bruker brukernavn (ikke email)
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          friendship_id: friendship?.id || null,
          status: friendship?.status || null,
          is_requester: friendship?.requester_id === currentUserId || false,
        } as Friend;
      });

    return { data: usersWithFriendshipStatus, error: null };
  } catch (err: any) {
    console.error('Error in searchUsers:', err);
    return { data: null, error: err };
  }
};

/**
 * Send venneforespørsel
 */
export const sendFriendRequest = async (
  requesterId: string,
  addresseeId: string
): Promise<{ data: any; error: any }> => {
  try {
    // Sjekk om det allerede finnes et vennskap (uavhengig av hvem som sendte)
    const { data: existing, error: checkError } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing friendship:', checkError);
      return { data: null, error: checkError };
    }

    if (existing) {
      if (existing.status === 'accepted') {
        return { data: null, error: { message: 'Dere er allerede venner' } };
      } else if (existing.status === 'pending') {
        return { data: null, error: { message: 'Venneforespørsel allerede sendt' } };
      } else if (existing.status === 'blocked') {
        return { data: null, error: { message: 'Denne brukeren er blokkert' } };
      }
    }

    // Opprett ny venneforespørsel
    const { data, error } = await supabase
      .from('friendships')
      .insert({
        requester_id: requesterId,
        addressee_id: addresseeId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending friend request:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error in sendFriendRequest:', err);
    return { data: null, error: err };
  }
};

/**
 * Aksepter venneforespørsel
 */
export const acceptFriendRequest = async (
  friendshipId: string,
  userId: string
): Promise<{ data: any; error: any }> => {
  try {
    // Oppdater status til accepted
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
      .eq('addressee_id', userId) // Bare addressee kan akseptere
      .select()
      .single();

    if (error) {
      console.error('Error accepting friend request:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Error in acceptFriendRequest:', err);
    return { data: null, error: err };
  }
};

/**
 * Avslå/ta bort venneforespørsel
 */
export const declineFriendRequest = async (
  friendshipId: string,
  userId: string
): Promise<{ data: any; error: any }> => {
  try {
    // Slett venneforespørselen
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`); // Bare involverte kan slette

    if (error) {
      console.error('Error declining friend request:', error);
      return { data: null, error };
    }

    return { data: { success: true }, error: null };
  } catch (err: any) {
    console.error('Error in declineFriendRequest:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent alle venner (accepted friendships)
 */
export const getFriends = async (
  userId: string
): Promise<{ data: Friend[] | null; error: any }> => {
  try {
    // Hent alle accepterte vennskap hvor brukeren er involvert
    const { data: friendships, error: friendshipError } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (friendshipError) {
      console.error('Error fetching friendships:', friendshipError);
      return { data: null, error: friendshipError };
    }

    if (!friendships || friendships.length === 0) {
      return { data: [], error: null };
    }

    // Hent profilinfo for vennene
    const friendIds = friendships.map(f =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', friendIds);

    if (profileError) {
      console.error('Error fetching friend profiles:', profileError);
      return { data: null, error: profileError };
    }

    // Hent siste aktivitet (last_active) fra step_data for hver venn
    const { data: stepData, error: stepDataError } = await supabase
      .from('step_data')
      .select('user_id, updated_at')
      .in('user_id', friendIds)
      .order('updated_at', { ascending: false });

    // Opprett et map for rask oppslag av siste aktivitet
    const lastActiveMap = new Map<string, string>();
    if (!stepDataError && stepData) {
      stepData.forEach(entry => {
        if (!lastActiveMap.has(entry.user_id) && entry.updated_at) {
          lastActiveMap.set(entry.user_id, entry.updated_at);
        }
      });
    }

    // Kombiner friendship og profile data
    // FILTRER UT brukere uten brukernavn (null eller tomt) ELLER hvor brukernavn er en email
    // VI VIL ALDRI VISE E-POST I STEDET FOR BRUKERNAVN
    const friends: Friend[] = (profiles || [])
      .filter(profile => {
        const username = profile.username?.trim() || '';
        // Filtrer ut hvis: tomt, null, eller inneholder @ (indikerer email)
        return username !== '' && !username.includes('@');
      })
      .map(profile => {
        const friendship = friendships.find(
          f =>
            (f.requester_id === userId && f.addressee_id === profile.id) ||
            (f.addressee_id === userId && f.requester_id === profile.id)
        );

        return {
          id: profile.id,
          username: profile.username.trim(), // Sikre at vi bruker brukernavn (ikke email)
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          friendship_id: friendship?.id || '',
          status: 'accepted',
          is_requester: friendship?.requester_id === userId || false,
          created_at: friendship?.created_at || '',
          last_active: lastActiveMap.get(profile.id) || null,
        };
      });

    return { data: friends, error: null };
  } catch (err: any) {
    console.error('Error in getFriends:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent antall venner for en bruker
 */
export const getFriendCount = async (
  userId: string
): Promise<{ data: number | null; error: any }> => {
  try {
    // Hent alle accepterte vennskap hvor brukeren er involvert
    const { data: friendships, error: friendshipError } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (friendshipError) {
      console.error('Error fetching friend count:', friendshipError);
      return { data: null, error: friendshipError };
    }

    // Supabase returnerer count i metadata når man bruker count: 'exact'
    // Men vi må faktisk telle rader for å få riktig antall
    // La oss bruke en mer direkte query
    const { count, error: countError } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (countError) {
      console.error('Error counting friends:', countError);
      return { data: null, error: countError };
    }

    return { data: count || 0, error: null };
  } catch (err: any) {
    console.error('Error in getFriendCount:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent mottatte venneforespørsler (pending requests where user is addressee)
 */
export const getReceivedFriendRequests = async (
  userId: string
): Promise<{ data: FriendRequest[] | null; error: any }> => {
  try {
    const { data: friendships, error: friendshipError } = await supabase
      .from('friendships')
      .select('id, requester_id, created_at')
      .eq('status', 'pending')
      .eq('addressee_id', userId); // Mottatte forespørsler

    if (friendshipError) {
      console.error('Error fetching received friend requests:', friendshipError);
      return { data: null, error: friendshipError };
    }

    if (!friendships || friendships.length === 0) {
      return { data: [], error: null };
    }

    // Hent profilinfo for de som sendte forespørslene
    const requesterIds = friendships.map(f => f.requester_id);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', requesterIds);

    if (profileError) {
      console.error('Error fetching requester profiles:', profileError);
      return { data: null, error: profileError };
    }

    // Hent siste aktivitet (last_active) fra step_data for hver forespørsel
    const { data: stepData } = await supabase
      .from('step_data')
      .select('user_id, updated_at')
      .in('user_id', requesterIds)
      .order('updated_at', { ascending: false });

    // Opprett et map for rask oppslag av siste aktivitet
    const lastActiveMap = new Map<string, string>();
    if (stepData) {
      stepData.forEach(entry => {
        if (!lastActiveMap.has(entry.user_id) && entry.updated_at) {
          lastActiveMap.set(entry.user_id, entry.updated_at);
        }
      });
    }

    // Kombiner data
    // FILTRER UT brukere uten brukernavn (null eller tomt) ELLER hvor brukernavn er en email
    // VI VIL ALDRI VISE E-POST I STEDET FOR BRUKERNAVN
    const requests: FriendRequest[] = (profiles || [])
      .filter(profile => {
        const username = profile.username?.trim() || '';
        // Filtrer ut hvis: tomt, null, eller inneholder @ (indikerer email)
        return username !== '' && !username.includes('@');
      })
      .map(profile => {
        const friendship = friendships.find(f => f.requester_id === profile.id);

        return {
          id: profile.id,
          username: profile.username.trim(), // Sikre at vi bruker brukernavn (ikke email)
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          friendship_id: friendship?.id || '',
          created_at: friendship?.created_at || '',
          last_active: lastActiveMap.get(profile.id) || null,
        };
      });

    return { data: requests, error: null };
  } catch (err: any) {
    console.error('Error in getReceivedFriendRequests:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent sendte venneforespørsler (pending requests where user is requester)
 */
export const getSentFriendRequests = async (
  userId: string
): Promise<{ data: FriendRequest[] | null; error: any }> => {
  try {
    const { data: friendships, error: friendshipError } = await supabase
      .from('friendships')
      .select('id, addressee_id, created_at')
      .eq('status', 'pending')
      .eq('requester_id', userId); // Sendte forespørsler

    if (friendshipError) {
      console.error('Error fetching sent friend requests:', friendshipError);
      return { data: null, error: friendshipError };
    }

    if (!friendships || friendships.length === 0) {
      return { data: [], error: null };
    }

    // Hent profilinfo for de som mottok forespørslene
    const addresseeIds = friendships.map(f => f.addressee_id);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', addresseeIds);

    if (profileError) {
      console.error('Error fetching addressee profiles:', profileError);
      return { data: null, error: profileError };
    }

    // Kombiner data
    // FILTRER UT brukere uten brukernavn (null eller tomt) ELLER hvor brukernavn er en email
    // VI VIL ALDRI VISE E-POST I STEDET FOR BRUKERNAVN
    const requests: FriendRequest[] = (profiles || [])
      .filter(profile => {
        const username = profile.username?.trim() || '';
        // Filtrer ut hvis: tomt, null, eller inneholder @ (indikerer email)
        return username !== '' && !username.includes('@');
      })
      .map(profile => {
        const friendship = friendships.find(f => f.addressee_id === profile.id);

        return {
          id: profile.id,
          username: profile.username.trim(), // Sikre at vi bruker brukernavn (ikke email)
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          friendship_id: friendship?.id || '',
          created_at: friendship?.created_at || '',
        };
      });

    return { data: requests, error: null };
  } catch (err: any) {
    console.error('Error in getSentFriendRequests:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent vennskapsforhold mellom to brukere
 */
export const getFriendshipBetween = async (
  userId: string,
  otherUserId: string
): Promise<{ data: { id: string; status: string; is_requester: boolean } | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`
      )
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    return {
      data: {
        id: data.id,
        status: data.status,
        is_requester: data.requester_id === userId,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err };
  }
};

/**
 * Blokker en bruker
 */
export const blockUser = async (
  blockerId: string,
  blockedId: string
): Promise<{ error: any }> => {
  try {
    // Sjekk om det finnes et eksisterende vennskap
    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(requester_id.eq.${blockerId},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${blockerId})`
      )
      .maybeSingle();

    if (existing) {
      // Oppdater til blokkert — sett blokkøren som requester
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', existing.id);
      if (error) return { error };
    }

    // Opprett nytt vennskap med status 'blocked' der blokkøren er requester
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: blockerId, addressee_id: blockedId, status: 'blocked' });

    return { error: error || null };
  } catch (err: any) {
    return { error: err };
  }
};

/**
 * Opphev blokkering
 */
export const unblockUser = async (
  blockerId: string,
  blockedId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', blockerId)
      .eq('addressee_id', blockedId)
      .eq('status', 'blocked');

    return { error: error || null };
  } catch (err: any) {
    return { error: err };
  }
};

/**
 * Fjern venn (slett vennskap)
 */
export const removeFriend = async (
  friendshipId: string,
  userId: string
): Promise<{ data: any; error: any }> => {
  try {
    // Slett vennskapet
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`); // Bare involverte kan slette

    if (error) {
      console.error('Error removing friend:', error);
      return { data: null, error };
    }

    return { data: { success: true }, error: null };
  } catch (err: any) {
    console.error('Error in removeFriend:', err);
    return { data: null, error: err };
  }
};

export interface FriendStepData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  steps: number;
  distance_meters: number;
  rank: number; // Position among all friends
  last_active?: string | null; // Timestamp for when user last updated step data
  previous_update_time?: string | null; // Timestamp for previous update (for speed calculation)
  previous_steps?: number; // Steps count at previous update
  previous_distance?: number; // Distance at previous update
}

/**
 * Hent skritt-data for alle venner (inkludert brukeren selv) for en gitt periode
 * Sortert etter antall skritt (høyest først)
 */
export const getFriendsStepsForPeriod = async (
  userId: string,
  startDate: string,
  endDate: string,
  includeCurrentUser: boolean = true
): Promise<{ data: FriendStepData[] | null; error: any }> => {
  try {
    // Hent alle venner
    const { data: friends, error: friendsError } = await getFriends(userId);
    
    if (friendsError) {
      console.error('Error fetching friends:', friendsError);
      return { data: null, error: friendsError };
    }

    const friendIds = friends?.map(f => f.id) || [];
    
    // Hent skritt-data for alle venner i perioden
    // Henter også created_at for å kunne beregne hastighet basert på tid
    let stepDataQuery = supabase
      .from('step_data')
      .select('user_id, steps, distance_meters, updated_at, date, created_at')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('updated_at', { ascending: false });

    if (friendIds.length > 0) {
      stepDataQuery = stepDataQuery.in('user_id', friendIds);
    } else {
      // Hvis ingen venner, returner tom liste (eller kun brukeren selv)
      stepDataQuery = stepDataQuery.eq('user_id', ''); // This won't match anything
    }

    const { data: friendsStepData, error: stepDataError } = await stepDataQuery;

    if (stepDataError) {
      console.error('Error fetching friends step data:', stepDataError);
      return { data: null, error: stepDataError };
    }

    // Hent brukerens egen skritt-data for perioden hvis inkludert
    let currentUserSteps = 0;
    let currentUserDistance = 0;
    let userStepDataList: Array<{ steps: number; distance_meters: number; updated_at: string | null; date: string; created_at: string | null }> | null = null;
    
    if (includeCurrentUser) {
      const { data: userData, error: userStepError } = await supabase
        .from('step_data')
        .select('steps, distance_meters, updated_at, date, created_at')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (!userStepError && userData) {
        userStepDataList = userData;
        // Summer alle skritt og distanse i perioden
        currentUserSteps = userStepDataList.reduce((sum: number, entry: any) => sum + (entry.steps || 0), 0);
        currentUserDistance = userStepDataList.reduce((sum: number, entry: any) => sum + (entry.distance_meters || 0), 0);
      }
    }

    // Kombiner venn-data med skritt-data
    const friendsWithSteps: FriendStepData[] = [];
    
    // Hent dagens data for aktivitetstype-beregning
    const today = new Date().toISOString().split('T')[0];
    
    // Legg til venner med skritt-data (summer alle dager i perioden)
    friends?.forEach(friend => {
      const friendStepDataList = friendsStepData?.filter(sd => sd.user_id === friend.id) || [];
      const totalSteps = friendStepDataList.reduce((sum, entry) => sum + (entry.steps || 0), 0);
      const totalDistance = friendStepDataList.reduce((sum, entry) => sum + (entry.distance_meters || 0), 0);
      
      // Finn dagens data for aktivitetstype-beregning
      const todayData = friendStepDataList.find(sd => {
        // Sjekk om datoen er i dag
        const entryDate = sd.date || '';
        return entryDate === today;
      });
      
      // Finn siste oppdatering (siste updated_at)
      const lastActive = friendStepDataList.length > 0
        ? friendStepDataList
            .map(e => e.updated_at ? new Date(e.updated_at).getTime() : 0)
            .reduce((latest, time) => Math.max(latest, time), 0)
        : null;
      
      // For hastighetsberegning: finn siste to oppdateringer for dagens data
      const todayDataList = friendStepDataList
        .filter(sd => sd.date === today)
        .sort((a, b) => {
          const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return timeB - timeA; // Nyest først
        });
      
      const previousUpdate = todayDataList[1]; // Forrige oppdatering
      
      friendsWithSteps.push({
        id: friend.id,
        username: friend.username,
        full_name: friend.full_name,
        avatar_url: friend.avatar_url,
        steps: totalSteps,
        distance_meters: totalDistance,
        rank: 0, // Vil bli satt etter sortering
        last_active: lastActive ? new Date(lastActive).toISOString() : null,
        previous_update_time: previousUpdate?.updated_at || previousUpdate?.created_at || null,
        previous_steps: previousUpdate?.steps || 0,
        previous_distance: previousUpdate?.distance_meters || 0,
      });
    });

    // Legg til brukeren selv hvis inkludert
    if (includeCurrentUser) {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('username, full_name, avatar_url')
        .eq('id', userId)
        .single();

      // VI VIL ALDRI VISE E-POST I STEDET FOR BRUKERNAVN
      // Sjekk at brukernavn eksisterer, ikke er tomt, og ikke er en email
      const username = userProfile?.username?.trim() || '';
      if (userProfile && username !== '' && !username.includes('@')) {
        // Finn siste oppdatering for brukeren selv
        const lastActive = userStepDataList && userStepDataList.length > 0
          ? userStepDataList
              .map((e: any) => e.updated_at ? new Date(e.updated_at).getTime() : 0)
              .reduce((latest: number, time: number) => Math.max(latest, time), 0)
          : null;
        
        // For hastighetsberegning: finn siste to oppdateringer for dagens data
        const today = new Date().toISOString().split('T')[0];
        const todayUserDataList = (userStepDataList || [])
          .filter((sd: any) => sd.date === today)
          .sort((a: any, b: any) => {
            const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return timeB - timeA; // Nyest først
          });
        
        const previousUserUpdate = todayUserDataList[1];
        
        friendsWithSteps.push({
          id: userId,
          username: userProfile.username.trim(), // Sikre at vi bruker brukernavn (ikke email)
          full_name: userProfile.full_name,
          avatar_url: userProfile.avatar_url,
          steps: currentUserSteps,
          distance_meters: currentUserDistance,
          rank: 0, // Vil bli satt etter sortering
          last_active: lastActive ? new Date(lastActive).toISOString() : null,
          previous_update_time: previousUserUpdate?.updated_at || previousUserUpdate?.created_at || null,
          previous_steps: previousUserUpdate?.steps || 0,
          previous_distance: previousUserUpdate?.distance_meters || 0,
        });
      }
    }

    // Sorter etter antall skritt (høyest først) og sett rank
    friendsWithSteps.sort((a, b) => b.steps - a.steps);
    friendsWithSteps.forEach((friend, index) => {
      friend.rank = index + 1;
    });

    return { data: friendsWithSteps, error: null };
  } catch (err: any) {
    console.error('Error in getFriendsStepsForPeriod:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent dagens skritt-data for alle venner (inkludert brukeren selv)
 * Sortert etter antall skritt (høyest først)
 * (Wrapper for getFriendsStepsForPeriod for bakoverkompatibilitet)
 */
export const getFriendsTodaySteps = async (
  userId: string,
  includeCurrentUser: boolean = true
): Promise<{ data: FriendStepData[] | null; error: any }> => {
  const today = new Date().toISOString().split('T')[0];
  return getFriendsStepsForPeriod(userId, today, today, includeCurrentUser);
};

