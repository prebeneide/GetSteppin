import { supabase } from '../lib/supabase';
import { Walk } from './walkService';

export interface Post {
  id: string;
  user_id: string;
  walk_id: string | null;
  content: string | null;
  image_url: string | null;
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
  created_at: string;
  updated_at: string;
  username: string;
  avatar_url: string | null;
}

/**
 * Create a post from a walk (called after walk is saved)
 */
export const createPostFromWalk = async (
  walkId: string,
  userId: string,
  content: string | null = null,
  imageUrl: string | null = null
): Promise<{ data: Post | null; error: any }> => {
  try {
    // Check if post already exists for this walk
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('walk_id', walkId)
      .single();

    if (existingPost) {
      // Post already exists, update it
      const { data, error } = await supabase
        .from('posts')
        .update({
          content: content || null,
          image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
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
      image_url: imageUrl || null,
    };

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
      // Fallback to popular posts
      return getPopularPosts(limit, offset);
    }

    // Transform RPC response to PostWithDetails format
    const transformedPosts: PostWithDetails[] = (friendPosts || []).map((post: any) => ({
      id: post.id,
      user_id: post.user_id,
      walk_id: post.walk_id,
      content: post.content,
      image_url: post.image_url,
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

    // If not enough posts, add popular posts
    if (transformedPosts.length < limit) {
      const { data: popularPosts } = await getPopularPosts(
        limit - transformedPosts.length,
        offset
      );
      
      const combined = [
        ...transformedPosts,
        ...(popularPosts.data || []),
      ];

      // Remove duplicates
      const unique = combined.filter((post, index, self) =>
        index === self.findIndex(p => p.id === post.id)
      );

      return { data: unique.slice(0, limit) as PostWithDetails[], error: null };
    }

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
    const posts: PostWithDetails[] = (data || []).map((post: any) => ({
      id: post.id,
      user_id: post.user_id,
      walk_id: post.walk_id,
      content: post.content,
      image_url: post.image_url,
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
      image_url: post.image_url,
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
 * Get comments for a post
 */
export const getPostComments = async (
  postId: string,
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

    // Transform data
    const comments: PostComment[] = (data || []).map((comment: any) => ({
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      username: comment.user?.username || 'Ukjent',
      avatar_url: comment.user?.avatar_url || null,
    }));

    return { data: comments, error: null };
  } catch (err) {
    console.error('Error in getPostComments:', err);
    return { data: [], error: err };
  }
};

/**
 * Add a comment to a post
 */
export const addComment = async (
  postId: string,
  userId: string,
  content: string
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
      created_at: data.created_at,
      updated_at: data.updated_at,
      username: data.user?.username || 'Ukjent',
      avatar_url: data.user?.avatar_url || null,
    };

    return { data: comment, error: null };
  } catch (err) {
    console.error('Error in addComment:', err);
    return { data: null, error: err };
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


