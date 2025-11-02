/**
 * Chat Service
 * Håndterer alle chat-operasjoner: send melding, hent meldinger, markere som lest
 */

import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatConversation {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  last_message: Message | null;
  unread_count: number;
}

/**
 * Send en melding til en venn
 */
export const sendMessage = async (
  senderId: string,
  receiverId: string,
  content: string
): Promise<{ data: Message | null; error: any }> => {
  try {
    if (!content.trim()) {
      return { data: null, error: { message: 'Melding kan ikke være tom' } };
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return { data: null, error };
    }

    return { data: data as Message, error: null };
  } catch (err: any) {
    console.error('Error in sendMessage:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent alle meldinger mellom to brukere
 */
export const getMessages = async (
  userId: string,
  friendId: string,
  limit: number = 50
): Promise<{ data: Message[] | null; error: any }> => {
  try {
    // Use two separate queries and combine them - simpler and more reliable
    // Query 1: Messages where user is sender and friend is receiver
    const { data: sentMessages, error: sentError } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', userId)
      .eq('receiver_id', friendId)
      .order('created_at', { ascending: true });

    if (sentError) {
      console.error('Error fetching sent messages:', sentError);
      return { data: null, error: sentError };
    }

    // Query 2: Messages where friend is sender and user is receiver
    const { data: receivedMessages, error: receivedError } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', friendId)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: true });

    if (receivedError) {
      console.error('Error fetching received messages:', receivedError);
      return { data: null, error: receivedError };
    }

    // Combine and sort all messages
    const allMessages = [
      ...(sentMessages || []),
      ...(receivedMessages || []),
    ] as Message[];

    // Sort by created_at
    allMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Limit results
    const limitedMessages = allMessages.slice(0, limit);

    return { data: limitedMessages, error: null };
  } catch (err: any) {
    console.error('Error in getMessages:', err);
    return { data: null, error: err };
  }
};

/**
 * Hent alle samtaler (chat-liste) for en bruker
 */
export const getConversations = async (
  userId: string
): Promise<{ data: ChatConversation[] | null; error: any }> => {
  try {
    // Hent alle meldinger hvor brukeren er sender eller receiver
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Error fetching messages for conversations:', messagesError);
      return { data: null, error: messagesError };
    }

    if (!messages || messages.length === 0) {
      return { data: [], error: null };
    }

    // Grupper meldinger per samtale (per venn)
    const conversationsMap = new Map<string, {
      user_id: string;
      messages: Message[];
      unread_count: number;
    }>();

    (messages as Message[]).forEach(message => {
      const otherUserId = message.sender_id === userId 
        ? message.receiver_id 
        : message.sender_id;

      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          user_id: otherUserId,
          messages: [],
          unread_count: 0,
        });
      }

      const conversation = conversationsMap.get(otherUserId)!;
      conversation.messages.push(message);

      // Tell uleste meldinger
      if (message.receiver_id === userId && !message.read_at) {
        conversation.unread_count++;
      }
    });

    // Hent profilinfo for alle deltakere
    const otherUserIds = Array.from(conversationsMap.keys());

    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', otherUserIds);

    if (profilesError) {
      console.error('Error fetching profiles for conversations:', profilesError);
      return { data: null, error: profilesError };
    }

    // Kombiner meldinger med profilinfo
    const conversations: ChatConversation[] = Array.from(conversationsMap.entries()).map(
      ([otherUserId, conversationData]) => {
        const profile = profiles?.find(p => p.id === otherUserId);

        // Finn siste melding
        const sortedMessages = conversationData.messages.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastMessage = sortedMessages.length > 0 ? sortedMessages[0] : null;

        return {
          user_id: otherUserId,
          username: profile?.username || 'Ukjent',
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          last_message: lastMessage,
          unread_count: conversationData.unread_count,
        };
      }
    );

    // Sorter etter siste melding (nyest først)
    conversations.sort((a, b) => {
      if (!a.last_message && !b.last_message) return 0;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
    });

    return { data: conversations, error: null };
  } catch (err: any) {
    console.error('Error in getConversations:', err);
    return { data: null, error: err };
  }
};

/**
 * Marker meldinger som lest
 */
export const markMessagesAsRead = async (
  userId: string,
  friendId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', userId)
      .eq('sender_id', friendId)
      .is('read_at', null);

    if (error) {
      console.error('Error marking messages as read:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in markMessagesAsRead:', err);
    return { error: err };
  }
};

/**
 * Subscribe til nye meldinger i real-time
 */
export const subscribeToMessages = (
  userId: string,
  friendId: string,
  callback: (message: Message) => void
): RealtimeChannel => {
  const channel = supabase
    .channel(`messages:${userId}:${friendId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const message = payload.new as Message;
        // Only call callback if message is between these two users
        if (
          (message.sender_id === userId && message.receiver_id === friendId) ||
          (message.sender_id === friendId && message.receiver_id === userId)
        ) {
          callback(message);
        }
      }
    )
    .subscribe();

  return channel;
};

/**
 * Unsubscribe fra meldinger
 */
export const unsubscribeFromMessages = (channel: RealtimeChannel): void => {
  supabase.removeChannel(channel);
};

