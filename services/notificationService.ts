/**
 * Notification Service
 * Handles notifications for likes and comments on posts
 */

import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'reply' | 'comment_like' | 'weekly_average' | 'top_percentage' | 'goal_streak' | 'weekly_goal';
  post_id: string | null; // Null for activity notifications
  comment_id: string | null; // For reply and comment_like notifications
  actor_id: string | null; // Null for activity notifications (system-generated)
  read_at: string | null;
  created_at: string;
  metadata?: any; // JSONB metadata for activity notifications
  // Additional data from joins
  actor_username?: string;
  actor_avatar_url?: string | null;
  post_content?: string | null;
  // Aggregated data for replies
  reply_count?: number; // Number of people who replied
  recent_actors?: Array<{ actor_id: string; actor_username: string; actor_avatar_url: string | null }>; // Recent actors for aggregated display
}

/**
 * Get total count of unread notifications for a user
 */
export const getUnreadNotificationsCount = async (
  userId: string
): Promise<{ data: number; error: any }> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error fetching unread notifications count:', error);
      return { data: 0, error };
    }

    return { data: count || 0, error: null };
  } catch (err: any) {
    console.error('Error in getUnreadNotificationsCount:', err);
    return { data: 0, error: err };
  }
};

/**
 * Get all notifications for a user
 */
export const getNotifications = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ data: Notification[] | null; error: any }> => {
  try {
    // First, get all notifications (not just limited) for aggregation
    const { data: allData, error: allError } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id (
          username,
          avatar_url
        ),
        post:post_id (
          content
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200); // Get more to ensure we can aggregate properly

    if (allError) {
      console.error('Error fetching notifications:', allError);
      return { data: null, error: allError };
    }

    const { data, error } = { data: allData, error: allError };

    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: null, error };
    }

    // Aggregate reply notifications by comment_id
    const replyNotificationsMap = new Map<string, Notification[]>();
    const otherNotifications: Notification[] = [];

    // Separate reply notifications from others
    (data || []).forEach((notif: any) => {
      const notification: Notification = {
        id: notif.id,
        user_id: notif.user_id,
        type: notif.type,
        post_id: notif.post_id || null,
        comment_id: notif.comment_id || null,
        actor_id: notif.actor_id || null,
        read_at: notif.read_at,
        created_at: notif.created_at,
        metadata: notif.metadata || null,
        actor_username: notif.actor?.username || null,
        actor_avatar_url: notif.actor?.avatar_url || null,
        post_content: notif.post?.content || null,
      };

      if (notif.type === 'reply' && notif.comment_id) {
        const key = notif.comment_id;
        if (!replyNotificationsMap.has(key)) {
          replyNotificationsMap.set(key, []);
        }
        replyNotificationsMap.get(key)!.push(notification);
      } else {
        // Include comment_like, activity notifications, and other types in otherNotifications
        otherNotifications.push(notification);
      }
    });

    // Aggregate reply notifications
    const aggregatedReplies: Notification[] = [];
    replyNotificationsMap.forEach((replies, commentId) => {
      // Sort by created_at descending
      replies.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Use the most recent reply as the base notification
      const mostRecent = replies[0];
      
      // Get unique actors (people who replied)
      const uniqueActors = new Map<string, { actor_id: string; actor_username: string; actor_avatar_url: string | null }>();
      replies.forEach(reply => {
        if (reply.actor_username && !uniqueActors.has(reply.actor_id)) {
          uniqueActors.set(reply.actor_id, {
            actor_id: reply.actor_id,
            actor_username: reply.actor_username,
            actor_avatar_url: reply.actor_avatar_url || null,
          });
        }
      });

      // Create aggregated notification
      const aggregated: Notification = {
        ...mostRecent,
        reply_count: uniqueActors.size,
        recent_actors: Array.from(uniqueActors.values()).slice(0, 3), // Top 3 most recent actors
      };

      aggregatedReplies.push(aggregated);
    });

    // Combine aggregated replies with other notifications and sort by created_at
    const allNotifications = [...otherNotifications, ...aggregatedReplies];
    allNotifications.sort((a, b) => {
      // Use the most recent created_at for aggregated replies
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    // Limit results
    const limitedNotifications = allNotifications.slice(0, limit);

    return { data: limitedNotifications, error: null };
  } catch (err: any) {
    console.error('Error in getNotifications:', err);
    return { data: null, error: err };
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (
  notificationId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in markNotificationAsRead:', err);
    return { error: err };
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (
  userId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in markAllNotificationsAsRead:', err);
    return { error: err };
  }
};

/**
 * Create a notification for a like
 */
export const createLikeNotification = async (
  postId: string,
  postOwnerId: string,
  actorId: string
): Promise<{ error: any }> => {
  try {
    // Don't create notification if user likes their own post
    if (postOwnerId === actorId) {
      return { error: null };
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: postOwnerId,
        type: 'like',
        post_id: postId,
        actor_id: actorId,
      });

    if (error) {
      console.error('Error creating like notification:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in createLikeNotification:', err);
    return { error: err };
  }
};

/**
 * Create a notification for a comment
 */
export const createCommentNotification = async (
  postId: string,
  postOwnerId: string,
  actorId: string
): Promise<{ error: any }> => {
  try {
    // Don't create notification if user comments on their own post
    if (postOwnerId === actorId) {
      return { error: null };
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: postOwnerId,
        type: 'comment',
        post_id: postId,
        actor_id: actorId,
        comment_id: null,
      });

    if (error) {
      console.error('Error creating comment notification:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in createCommentNotification:', err);
    return { error: err };
  }
};

/**
 * Create or update a reply notification
 * Aggregates multiple replies to the same comment into one notification
 */
export const createReplyNotification = async (
  postId: string,
  commentOwnerId: string,
  actorId: string,
  commentId: string
): Promise<{ error: any }> => {
  try {
    // Don't create notification if user replies to their own comment
    if (commentOwnerId === actorId) {
      return { error: null };
    }

    // Check if there's already an unread reply notification for this comment
    const { data: existingNotification, error: checkError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', commentOwnerId)
      .eq('type', 'reply')
      .eq('comment_id', commentId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking existing reply notification:', checkError);
    }

    if (existingNotification) {
      // Update existing notification with the new actor
      // Note: We don't update the actor_id, but we'll aggregate on read
      // For now, just update the created_at to show it's recent
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ created_at: new Date().toISOString() })
        .eq('id', existingNotification.id);

      if (updateError) {
        console.error('Error updating reply notification:', updateError);
        return { error: updateError };
      }
    } else {
      // Create new notification
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: commentOwnerId,
          type: 'reply',
          post_id: postId,
          comment_id: commentId,
          actor_id: actorId,
        });

      if (insertError) {
        console.error('Error creating reply notification:', insertError);
        return { error: insertError };
      }
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in createReplyNotification:', err);
    return { error: err };
  }
};

/**
 * Create a notification when someone likes a comment
 */
export const createCommentLikeNotification = async (
  postId: string,
  commentOwnerId: string,
  actorId: string,
  commentId: string
): Promise<{ error: any }> => {
  try {
    // Don't create notification if user likes their own comment
    if (commentOwnerId === actorId) {
      return { error: null };
    }

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: commentOwnerId,
        type: 'comment_like',
        post_id: postId,
        comment_id: commentId,
        actor_id: actorId,
      });

    if (error) {
      console.error('Error creating comment like notification:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in createCommentLikeNotification:', err);
    return { error: err };
  }
};

