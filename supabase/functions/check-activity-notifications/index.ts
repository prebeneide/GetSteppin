// Supabase Edge Function
// Automatically checks and creates activity notifications for all users
// This should be called by a cron job or webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActivityNotificationMetadata {
  weekly_average?: {
    avg_steps: number;
    previous_week_avg: number;
    difference: number;
    week_start: string;
    week_end: string;
  };
  top_percentage?: {
    global_percentage: number;
    country_percentage: number | null;
    steps: number;
    date: string;
    country: string | null;
  };
  goal_streak?: {
    streak_days: number;
    goal: number;
  };
  weekly_goal?: {
    avg_steps: number;
    goal: number;
    difference: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with activity notifications enabled
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, language, activity_notifications_enabled')
      .eq('activity_notifications_enabled', true);

    if (usersError) {
      throw usersError;
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users with activity notifications enabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let totalCreated = 0;
    const errors: string[] = [];

    // Process each user
    for (const user of users) {
      try {
        // Check and create weekly average notification
        const weeklyAvgResult = await checkWeeklyAverageNotification(supabase, user.id);
        if (weeklyAvgResult.created) totalCreated++;

        // Check and create top percentage notification
        const topPercentResult = await checkTopPercentageNotification(supabase, user.id);
        if (topPercentResult.created) totalCreated++;

        // Check and create goal streak notification
        const goalStreakResult = await checkGoalStreakNotification(supabase, user.id);
        if (goalStreakResult.created) totalCreated++;

        // Check and create weekly goal notification
        const weeklyGoalResult = await checkWeeklyGoalNotification(supabase, user.id);
        if (weeklyGoalResult.created) totalCreated++;

      } catch (err) {
        errors.push(`User ${user.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Activity notifications check completed',
        processed: users.length,
        created: totalCreated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper functions (simplified versions of activityNotificationService logic)
async function checkWeeklyAverageNotification(
  supabase: any,
  userId: string
): Promise<{ created: boolean; error: any }> {
  // Implementation would go here - similar to activityNotificationService.ts
  // For now, return placeholder
  return { created: false, error: null };
}

async function checkTopPercentageNotification(
  supabase: any,
  userId: string
): Promise<{ created: boolean; error: any }> {
  // Implementation would go here
  return { created: false, error: null };
}

async function checkGoalStreakNotification(
  supabase: any,
  userId: string
): Promise<{ created: boolean; error: any }> {
  // Implementation would go here
  return { created: false, error: null };
}

async function checkWeeklyGoalNotification(
  supabase: any,
  userId: string
): Promise<{ created: boolean; error: any }> {
  // Implementation would go here
  return { created: false, error: null };
}

