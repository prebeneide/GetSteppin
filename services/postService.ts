import { supabase } from '../lib/supabase';
import { createLikeNotification, createCommentNotification, createReplyNotification, createCommentLikeNotification } from './notificationService';
import { Walk } from './walkService';

export interface PostImage {
  url: string;
  index: number;
}

export interface PostDisplaySettings {
  show_start_time?: boolean;
  show_end_time?: boolean;
  show_date?: boolean;
  show_max_speed?: boolean;
  show_avg_speed?: boolean;
  show_duration?: boolean;
  is_public?: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  walk_id: string | null;
  content: string | null;
  image_url: string | null; // Legacy - keep for backward compatibility
  images: PostImage[] | null; // New: array of images
  primary_image_index: number; // Index of primary image to display first
  map_position: number; // Position in media slider where map appears (-1 = end, 0+ = after image index)
  display_settings?: PostDisplaySettings | null; // Visibility settings for post information
  created_at: string;
  updated_at: string;
}

export interface PostWithDetails extends Post {
  username: string;
  avatar_url: string | null;
  walk: Walk | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  has_user_liked: boolean; // Alias for is_liked
}

/**
 * Helper to get primary image URL (supports both legacy image_url and new images array)
 */
export const getPrimaryImageUrl = (post: Post): string | null => {
  if (post.images && post.images.length > 0) {
    const primaryIndex = post.primary_image_index || 0;
    const primaryImage = post.images.find(img => img.index === primaryIndex) || post.images[0];
    return primaryImage?.url || null;
  }
  // Fallback to legacy image_url
  return post.image_url || null;
};

/**
 * Helper to get all image URLs
 */
export const getAllImageUrls = (post: Post): string[] => {
  if (post.images && post.images.length > 0) {
    return post.images
      .sort((a, b) => a.index - b.index)
      .map(img => img.url);
  }
  // Fallback to legacy image_url
  return post.image_url ? [post.image_url] : [];
};

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  username: string;
  avatar_url: string | null;
  likes_count?: number;
  is_liked?: boolean;
}

/**
 * Create a post from a walk (called after walk is saved)
 * Supports multiple images with primary image selection
 */
export const createPostFromWalk = async (
  walkId: string,
  userId: string,
  content: string | null = null,
  images: Array<{ url: string; index: number }> | null = null,
  primaryImageIndex: number = 0,
  mapPosition: number = -1, // -1 = end, 0+ = after image index
  displaySettings: PostDisplaySettings | null = null // Visibility settings
): Promise<{ data: Post | null; error: any }> => {
  try {
    // Check if post already exists for this walk
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('walk_id', walkId)
      .single();

    // Prepare images data
    const imagesData = images && images.length > 0 ? images : null;
    
    // Keep legacy image_url for backward compatibility (use primary image if exists)
    const legacyImageUrl = imagesData && imagesData.length > 0
      ? imagesData.find(img => img.index === primaryImageIndex)?.url || imagesData[0]?.url || null
      : null;

    if (existingPost) {
      // Post already exists, update it
      const updateData: any = {
        content: content || null,
        updated_at: new Date().toISOString(),
      };

      if (imagesData) {
        updateData.images = imagesData;
        updateData.primary_image_index = primaryImageIndex;
        updateData.map_position = mapPosition;
        // Keep legacy image_url for backward compatibility
        updateData.image_url = legacyImageUrl;
      } else {
        updateData.map_position = mapPosition;
      }
      
      // Update display settings if provided
      if (displaySettings) {
        updateData.display_settings = displaySettings;
      }

      const { data, error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', existingPost.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating post:', error);
        return { data: null, error };
      }

      // Update walk to mark as shared
      await supabase
        .from('walks')
        .update({ is_shared: true })
        .eq('id', walkId);

      return { data: data as Post, error: null };
    }

    // Create new post
    const insertData: any = {
      user_id: userId,
      walk_id: walkId,
      content: content || null,
    };

    if (imagesData) {
      insertData.images = imagesData;
      insertData.primary_image_index = primaryImageIndex;
      insertData.map_position = mapPosition;
      insertData.image_url = legacyImageUrl; // Backward compatibility
    } else {
      insertData.map_position = mapPosition;
    }
    
    // Add display settings (default to all visible if not provided)
    if (displaySettings) {
      insertData.display_settings = displaySettings;
    } else {
      // Default: all visible, public
      insertData.display_settings = {
        show_start_time: true,
        show_end_time: true,
        show_date: true,
        show_max_speed: true,
        show_avg_speed: true,
        show_duration: true,
        is_public: true,
      };
    }

    const { data, error } = await supabase
      .from('posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return { data: null, error };
    }

    // Update walk to mark as shared
    await supabase
      .from('walks')
      .update({ is_shared: true })
      .eq('id', walkId);

    return { data: data as Post, error: null };
  } catch (err) {
    console.error('Error in createPostFromWalk:', err);
    return { data: null, error: err };
  }
};

/**
 * Get feed posts (friends + popular)
 */
export const getFeedPosts = async (
  userId: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<{ data: PostWithDetails[]; error: any }> => {
  try {
    if (!userId) {
      // For anonymous users, just show popular posts
      return getPopularPosts(limit, offset);
    }

    // Get posts from friends
    const { data: friendPosts, error: friendError } = await supabase
      .rpc('get_friend_posts', {
        user_id_param: userId,
        limit_param: limit,
        offset_param: offset,
      });

    if (friendError) {
      console.error('Error fetching friend posts:', friendError);
      // Return empty array instead of falling back to popular posts
      return { data: [], error: friendError };
    }

    // Transform RPC response to PostWithDetails format
    // Filter out private posts (is_public === false) for other users
    const transformedPosts: PostWithDetails[] = (friendPosts || [])
      .filter((post: any) => {
        // Only show public posts (is_public !== false) or posts from the current user
        const isPublic = post.display_settings?.is_public !== false;
        const isOwnPost = post.user_id === userId;
        return isPublic || isOwnPost;
      })
      .map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        walk_id: post.walk_id,
        content: post.content,
        image_url: post.image_url || null,
        images: post.images || null,
        primary_image_index: post.primary_image_index || 0,
        map_position: post.map_position !== undefined ? post.map_position : -1,
        display_settings: post.display_settings || null,
        created_at: post.created_at,
        updated_at: post.updated_at,
        username: post.username || 'Ukjent',
        avatar_url: post.avatar_url || null,
        walk: post.walk || null,
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        is_liked: post.is_liked || false,
        has_user_liked: post.is_liked || false,
      }));

    // Only return friend posts - no popular posts
    return { data: transformedPosts, error: null };
  } catch (err) {
    console.error('Error in getFeedPosts:', err);
    return { data: [], error: err };
  }
};

/**
 * Get popular posts (most likes)
 */
export const getPopularPosts = async (
  limit: number = 20,
  offset: number = 0
): Promise<{ data: PostWithDetails[]; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:user_profiles!posts_user_id_fkey(username, avatar_url),
        walk:walks(*),
        likes:post_likes(count),
        comments:post_comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching popular posts:', error);
      return { data: [], error };
    }

    // Transform data
    // Filter out private posts (is_public === false)
    const posts: PostWithDetails[] = (data || [])
      .filter((post: any) => {
        // Only show public posts (is_public !== false)
        return post.display_settings?.is_public !== false;
      })
      .map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        walk_id: post.walk_id,
        content: post.content,
        image_url: post.image_url || null,
        images: post.images || null,
        primary_image_index: post.primary_image_index || 0,
        map_position: post.map_position !== undefined ? post.map_position : -1,
        display_settings: post.display_settings || null,
        created_at: post.created_at,
        updated_at: post.updated_at,
        username: post.user?.username || 'Ukjent',
        avatar_url: post.user?.avatar_url || null,
        walk: post.walk || null,
        likes_count: post.likes?.length || 0,
        comments_count: post.comments?.length || 0,
        is_liked: false, // Will be set by checking user likes
        has_user_liked: false,
      }));

    return { data: posts, error: null };
  } catch (err) {
    console.error('Error in getPopularPosts:', err);
    return { data: [], error: err };
  }
};

/**
 * Get user's posts
 */
export const getUserPosts = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ data: PostWithDetails[]; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:user_profiles!posts_user_id_fkey(username, avatar_url),
        walk:walks(*),
        likes:post_likes(count),
        comments:post_comments(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching user posts:', error);
      return { data: [], error };
    }

    // Transform data
    const posts: PostWithDetails[] = (data || []).map((post: any) => ({
      id: post.id,
      user_id: post.user_id,
      walk_id: post.walk_id,
      content: post.content,
      image_url: post.image_url || null,
      images: post.images || null,
      primary_image_index: post.primary_image_index || 0,
      map_position: post.map_position !== undefined ? post.map_position : -1,
      created_at: post.created_at,
      updated_at: post.updated_at,
      username: post.user?.username || 'Ukjent',
      avatar_url: post.user?.avatar_url || null,
      walk: post.walk || null,
      likes_count: post.likes?.length || 0,
      comments_count: post.comments?.length || 0,
      is_liked: false,
      has_user_liked: false,
    }));

    return { data: posts, error: null };
  } catch (err) {
    console.error('Error in getUserPosts:', err);
    return { data: [], error: err };
  }
};

/**
 * Like a post
 */
export const likePost = async (
  postId: string,
  userId: string
): Promise<{ data: PostLike | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      // Might be duplicate like
      if (error.code === '23505') {
        // Already liked, just return success
        const { data: existing } = await supabase
          .from('post_likes')
          .select()
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single();
        
        return { data: existing as PostLike, error: null };
      }
      console.error('Error liking post:', error);
      return { data: null, error };
    }

    // Create notification for the post owner
    try {
      const { data: postData } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();
      
      if (postData && postData.user_id) {
        await createLikeNotification(postId, postData.user_id, userId);
      }
    } catch (notifErr) {
      // Don't fail the like if notification creation fails
      console.error('Error creating like notification:', notifErr);
    }

    return { data: data as PostLike, error: null };
  } catch (err) {
    console.error('Error in likePost:', err);
    return { data: null, error: err };
  }
};

/**
 * Unlike a post
 */
export const unlikePost = async (
  postId: string,
  userId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error unliking post:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Error in unlikePost:', err);
    return { error: err };
  }
};

/**
 * Get all users who liked a post
 */
export const getPostLikes = async (
  postId: string
): Promise<{ data: Array<{ user_id: string; username: string; avatar_url: string | null; full_name: string | null; created_at: string }>; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select(`
        user_id,
        created_at,
        user:user_profiles!post_likes_user_id_fkey(username, avatar_url, full_name)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching post likes:', error);
      return { data: [], error };
    }

    // Transform data
    const likes = (data || []).map((like: any) => ({
      user_id: like.user_id,
      username: like.user?.username || 'Ukjent',
      avatar_url: like.user?.avatar_url || null,
      full_name: like.user?.full_name || null,
      created_at: like.created_at,
    }));

    return { data: likes, error: null };
  } catch (err) {
    console.error('Error in getPostLikes:', err);
    return { data: [], error: err };
  }
};

/**
 * Get comments for a post
 */
export const getPostComments = async (
  postId: string,
  userId: string | null = null,
  limit: number = 50
): Promise<{ data: PostComment[]; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        user:user_profiles!post_comments_user_id_fkey(username, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching comments:', error);
      return { data: [], error };
    }

    // Get likes count and user's like status for each comment
    const commentIds = (data || []).map((c: any) => c.id);
    let userLikes: Set<string> = new Set();
    
    if (userId && commentIds.length > 0) {
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds);
      
      if (likesData) {
        userLikes = new Set(likesData.map((l: any) => l.comment_id));
      }
    }

    // Get actual likes count for each comment
    const likesCounts: Map<string, number> = new Map();
    if (commentIds.length > 0) {
      const { data: likesCountData, error: countError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds);
      
      // Count likes per comment
      if (likesCountData && !countError) {
        likesCountData.forEach((item: any) => {
          const count = likesCounts.get(item.comment_id) || 0;
          likesCounts.set(item.comment_id, count + 1);
        });
      }
    }

    // Transform data
    const comments: PostComment[] = (data || []).map((comment: any) => ({
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      content: comment.content,
      parent_comment_id: comment.parent_comment_id || null,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      username: comment.user?.username || 'Ukjent',
      avatar_url: comment.user?.avatar_url || null,
      likes_count: likesCounts.get(comment.id) || 0,
      is_liked: userLikes.has(comment.id),
    }));

    return { data: comments, error: null };
  } catch (err) {
    console.error('Error in getPostComments:', err);
    return { data: [], error: err };
  }
};

/**
 * Get post by walk_id
 */
export const getPostByWalkId = async (
  walkId: string
): Promise<{ data: Post | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('walk_id', walkId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No post found
        return { data: null, error: null };
      }
      return { data: null, error };
    }

    return { data: data as Post, error: null };
  } catch (err) {
    console.error('Error in getPostByWalkId:', err);
    return { data: null, error: err };
  }
};

/**
 * Delete a post and unshare the walk
 */
export const deletePost = async (
  postId: string,
  walkId: string
): Promise<{ error: any }> => {
  try {
    // Get post images before deleting
    const { data: postData } = await supabase
      .from('posts')
      .select('images')
      .eq('id', postId)
      .single();

    // Delete post
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      return { error: deleteError };
    }

    // Also delete related likes and comments (if cascading isn't set up)
    await supabase.from('post_likes').delete().eq('post_id', postId);
    await supabase.from('post_comments').delete().eq('post_id', postId);

    // Unshare the walk
    await supabase
      .from('walks')
      .update({ is_shared: false })
      .eq('id', walkId);

    // Note: We could also delete images from storage here if needed
    // For now, we'll keep them in case user wants to reuse them

    return { error: null };
  } catch (err) {
    console.error('Error in deletePost:', err);
    return { error: err };
  }
};

/**
 * Add a comment to a post (or a reply to a comment)
 */
export const addComment = async (
  postId: string,
  userId: string,
  content: string,
  parentCommentId?: string | null
): Promise<{ data: PostComment | null; error: any }> => {
  try {
    if (!content.trim()) {
      return { data: null, error: { message: 'Comment cannot be empty' } };
    }

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        parent_comment_id: parentCommentId || null,
      })
      .select(`
        *,
        user:user_profiles!post_comments_user_id_fkey(username, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return { data: null, error };
    }

    // Transform data
    const comment: PostComment = {
      id: data.id,
      post_id: data.post_id,
      user_id: data.user_id,
      content: data.content,
      parent_comment_id: data.parent_comment_id || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      username: data.user?.username || 'Ukjent',
      avatar_url: data.user?.avatar_url || null,
    };

    // Create notification
    try {
      const { data: postData } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();
      
      if (postData && postData.user_id) {
        if (parentCommentId) {
          // This is a reply - notify the comment owner
          // Get the parent comment to find its owner
          const { data: parentComment } = await supabase
            .from('post_comments')
            .select('user_id')
            .eq('id', parentCommentId)
            .single();
          
          if (parentComment && parentComment.user_id && parentComment.user_id !== userId) {
            await createReplyNotification(postId, parentComment.user_id, userId, parentCommentId);
          }
        } else {
          // This is a top-level comment - notify the post owner
          if (postData.user_id !== userId) {
            await createCommentNotification(postId, postData.user_id, userId);
          }
        }
      }
    } catch (notifErr) {
      // Don't fail the comment if notification creation fails
      console.error('Error creating comment notification:', notifErr);
    }

    return { data: comment, error: null };
  } catch (err) {
    console.error('Error in addComment:', err);
    return { data: null, error: err };
  }
};

/**
 * Like a comment
 */
export const likeComment = async (
  commentId: string,
  userId: string
): Promise<{ data: any; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      // If error is due to duplicate like, return success
      if (error.code === '23505') {
        return { data: null, error: null };
      }
      console.error('Error liking comment:', error);
      return { data: null, error };
    }

    // Create notification for the comment owner
    try {
      // Get the comment to find its owner and post_id
      const { data: commentData } = await supabase
        .from('post_comments')
        .select('user_id, post_id')
        .eq('id', commentId)
        .single();
      
      if (commentData && commentData.user_id && commentData.post_id) {
        await createCommentLikeNotification(
          commentData.post_id,
          commentData.user_id,
          userId,
          commentId
        );
      }
    } catch (notifErr) {
      // Don't fail the like if notification creation fails
      console.error('Error creating comment like notification:', notifErr);
    }

    return { data, error: null };
  } catch (err) {
    console.error('Error in likeComment:', err);
    return { data: null, error: err };
  }
};

/**
 * Unlike a comment
 */
export const unlikeComment = async (
  commentId: string,
  userId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error unliking comment:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Error in unlikeComment:', err);
    return { error: err };
  }
};

/**
 * Get all users who liked a comment
 */
export const getCommentLikes = async (
  commentId: string
): Promise<{ data: Array<{ user_id: string; username: string; avatar_url: string | null; full_name: string | null; created_at: string }>; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('comment_likes')
      .select(`
        user_id,
        created_at,
        user:user_profiles!comment_likes_user_id_fkey(username, avatar_url, full_name)
      `)
      .eq('comment_id', commentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comment likes:', error);
      return { data: [], error };
    }

    // Transform data
    const likes = (data || []).map((like: any) => ({
      user_id: like.user_id,
      username: like.user?.username || 'Ukjent',
      avatar_url: like.user?.avatar_url || null,
      full_name: like.user?.full_name || null,
      created_at: like.created_at,
    }));

    return { data: likes, error: null };
  } catch (err) {
    console.error('Error in getCommentLikes:', err);
    return { data: [], error: err };
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (
  commentId: string,
  userId: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting comment:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Error in deleteComment:', err);
    return { error: err };
  }
};


