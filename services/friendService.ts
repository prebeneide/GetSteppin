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
}

export interface FriendRequest {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  friendship_id: string;
  created_at: string;
}

/**
 * Søk etter brukere etter brukernavn
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

    // Søk etter brukere med lignende brukernavn
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .ilike('username', `%${searchQuery}%`)
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
    const usersWithFriendshipStatus = (data || []).map(user => {
      const friendship = friendships?.find(
        f =>
          (f.requester_id === currentUserId && f.addressee_id === user.id) ||
          (f.addressee_id === currentUserId && f.requester_id === user.id)
      );

      return {
        id: user.id,
        username: user.username,
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

    // Kombiner friendship og profile data
    const friends: Friend[] = (profiles || []).map(profile => {
      const friendship = friendships.find(
        f =>
          (f.requester_id === userId && f.addressee_id === profile.id) ||
          (f.addressee_id === userId && f.requester_id === profile.id)
      );

      return {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        friendship_id: friendship?.id || '',
        status: 'accepted',
        is_requester: friendship?.requester_id === userId || false,
        created_at: friendship?.created_at || '',
      };
    });

    return { data: friends, error: null };
  } catch (err: any) {
    console.error('Error in getFriends:', err);
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

    // Kombiner data
    const requests: FriendRequest[] = (profiles || []).map(profile => {
      const friendship = friendships.find(f => f.requester_id === profile.id);

      return {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        friendship_id: friendship?.id || '',
        created_at: friendship?.created_at || '',
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
    const requests: FriendRequest[] = (profiles || []).map(profile => {
      const friendship = friendships.find(f => f.addressee_id === profile.id);

      return {
        id: profile.id,
        username: profile.username,
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

