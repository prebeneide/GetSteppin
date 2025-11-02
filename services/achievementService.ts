import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

interface AchievementType {
  id: string;
  emoji: string;
  name: string;
  requirement_value: number | null;
  category: string;
}

/**
 * Award an achievement to a user or device
 */
const awardAchievement = async (
  userId: string | null,
  deviceId: string | null,
  achievementTypeId: string,
  metadata?: any
): Promise<{ error: any }> => {
  try {
    if (!userId && !deviceId) {
      return { error: { message: 'Either userId or deviceId required' } };
    }

    // Check if achievement already exists
    let query = supabase
      .from('user_achievements')
      .select('id, count')
      .eq('achievement_type_id', achievementTypeId);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('device_id', deviceId!).is('user_id', null);
    }

    const { data: existing, error: checkError } = await query.single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking existing achievement:', checkError);
      return { error: checkError };
    }

    if (existing) {
      // Update existing achievement - increment count
      const { error: updateError } = await supabase
        .from('user_achievements')
        .update({
          count: existing.count + 1,
          last_earned_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating achievement:', updateError);
        return { error: updateError };
      }
    } else {
      // Insert new achievement
      const insertData: any = {
        achievement_type_id: achievementTypeId,
        count: 1,
      };

      if (userId) {
        insertData.user_id = userId;
      } else {
        insertData.device_id = deviceId;
        insertData.user_id = null;
      }

      const { error: insertError } = await supabase
        .from('user_achievements')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting achievement:', insertError);
        return { error: insertError };
      }
    }

    // Log achievement in achievement_log
    const logData: any = {
      achievement_type_id: achievementTypeId,
      metadata: metadata || {},
    };

    if (userId) {
      logData.user_id = userId;
    } else {
      logData.device_id = deviceId;
      logData.user_id = null;
    }

    const { error: logError } = await supabase
      .from('achievement_log')
      .insert(logData);

    if (logError) {
      console.error('Error logging achievement:', logError);
      // Don't fail if logging fails
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in awardAchievement:', err);
    return { error: err };
  }
};

/**
 * Get achievement type by emoji or name
 */
const getAchievementType = async (
  emoji?: string,
  name?: string
): Promise<AchievementType | null> => {
  try {
    let query = supabase.from('achievement_types').select('id, emoji, name, requirement_value, category');

    if (emoji) {
      query = query.eq('emoji', emoji);
    } else if (name) {
      query = query.eq('name', name);
    } else {
      return null;
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('Error getting achievement type:', error);
      return null;
    }

    return data as AchievementType | null;
  } catch (err) {
    console.error('Error in getAchievementType:', err);
    return null;
  }
};

/**
 * Get total lifetime distance for a user or device
 */
const getTotalDistance = async (
  userId: string | null,
  deviceId?: string | null
): Promise<number> => {
  try {
    let query = supabase
      .from('step_data')
      .select('distance_meters');

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (deviceId) {
      query = query.eq('device_id', deviceId).is('user_id', null);
    } else {
      return 0;
    }

    const { data, error } = await query;

    if (error || !data) {
      return 0;
    }

    return data.reduce((sum, entry) => sum + (entry.distance_meters || 0), 0);
  } catch (err) {
    console.error('Error in getTotalDistance:', err);
    return 0;
  }
};

/**
 * Check and award step-based achievements (🍒, 🍑, 🎯)
 * Awards based on current day's steps for 🍒 and 🍑
 * Awards based on total lifetime distance for 🎯 milestones
 */
export const checkDistanceAchievements = async (
  userId: string | null,
  steps: number,
  distanceMeters: number,
  deviceId?: string | null
): Promise<void> => {
  try {
    // Get device ID if not provided
    if (!deviceId && !userId) {
      deviceId = await getDeviceId();
    }

    // 🍒 Kirsebær - for every 1000 steps in current day
    // Only award once per 1000 steps increment today
    const cherriesForToday = Math.floor(steps / 1000);
    if (cherriesForToday > 0) {
      const cherryType = await getAchievementType('🍒');
      if (cherryType) {
        // Check how many cherries already awarded today
        const today = new Date().toISOString().split('T')[0];
        let logQuery = supabase
          .from('achievement_log')
          .select('id, metadata')
          .eq('achievement_type_id', cherryType.id)
          .gte('earned_at', `${today}T00:00:00`)
          .lt('earned_at', `${today}T23:59:59`);

        if (userId) {
          logQuery = logQuery.eq('user_id', userId);
        } else {
          logQuery = logQuery.eq('device_id', deviceId!).is('user_id', null);
        }

        const { data: todayLogs } = await logQuery;
        const alreadyAwardedToday = todayLogs?.length || 0;

        // Award remaining cherries
        const toAward = cherriesForToday - alreadyAwardedToday;
        for (let i = 0; i < toAward; i++) {
          await awardAchievement(userId, deviceId || null, cherryType.id, {
            steps: steps,
            block: alreadyAwardedToday + i + 1,
            date: today,
          });
        }
      }
    }

    // 🍑 Fersken - for every 10000 steps in current day
    const peachesForToday = Math.floor(steps / 10000);
    if (peachesForToday > 0) {
      const peachType = await getAchievementType('🍑');
      if (peachType) {
        // Check how many peaches already awarded today
        const today = new Date().toISOString().split('T')[0];
        let logQuery = supabase
          .from('achievement_log')
          .select('id, metadata')
          .eq('achievement_type_id', peachType.id)
          .gte('earned_at', `${today}T00:00:00`)
          .lt('earned_at', `${today}T23:59:59`);

        if (userId) {
          logQuery = logQuery.eq('user_id', userId);
        } else {
          logQuery = logQuery.eq('device_id', deviceId!).is('user_id', null);
        }

        const { data: todayLogs } = await logQuery;
        const alreadyAwardedToday = todayLogs?.length || 0;

        // Award remaining peaches
        const toAward = peachesForToday - alreadyAwardedToday;
        for (let i = 0; i < toAward; i++) {
          await awardAchievement(userId, deviceId || null, peachType.id, {
            steps: steps,
            block: alreadyAwardedToday + i + 1,
            date: today,
          });
        }
      }
    }

    // 🎯 Milestone - for major lifetime milestones (50km, 100km, 500km, 1000km)
    const totalDistance = await getTotalDistance(userId, deviceId || undefined);
    const milestones = [50000, 100000, 500000, 1000000]; // 50km, 100km, 500km, 1000km
    
    for (const milestone of milestones) {
      // Check if we just crossed this milestone (within last 1000m of progress)
      if (totalDistance >= milestone && totalDistance < milestone + 1000) {
        // Check if this milestone was already awarded
        const milestoneType = await getAchievementType('🎯');
        if (milestoneType) {
          let checkQuery = supabase
            .from('achievement_log')
            .select('id')
            .eq('achievement_type_id', milestoneType.id)
            .eq('metadata->>milestone', milestone.toString());

          if (userId) {
            checkQuery = checkQuery.eq('user_id', userId);
          } else {
            checkQuery = checkQuery.eq('device_id', deviceId!).is('user_id', null);
          }

          const { data: existing } = await checkQuery.limit(1);

          if (!existing || existing.length === 0) {
            // Milestone not awarded yet
            await awardAchievement(userId, deviceId || null, milestoneType.id, {
              distance: totalDistance,
              milestone: milestone,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in checkDistanceAchievements:', err);
  }
};

/**
 * Check and award goal achievement (✅)
 */
export const checkGoalAchievement = async (
  userId: string | null,
  steps: number,
  dailyGoal: number | null,
  deviceId?: string | null
): Promise<void> => {
  try {
    console.log('Checking goal achievement:', { userId, steps, dailyGoal, deviceId });
    
    if (!dailyGoal || dailyGoal <= 0) {
      console.log('No daily goal set or goal is 0');
      return; // No goal set
    }

    if (steps < dailyGoal) {
      console.log('Goal not reached yet:', { steps, dailyGoal });
      return; // Goal not reached
    }

    // Get device ID if not provided
    if (!deviceId && !userId) {
      deviceId = await getDeviceId();
    }

    // ✅ Dagens Mål - completed daily goal
    const goalType = await getAchievementType('✅');
    if (!goalType) {
      console.error('Could not find goal achievement type');
      return;
    }

    console.log('Goal type found:', goalType);

    // Only award once per day - check if already awarded today
    const today = new Date().toISOString().split('T')[0];
    
    let query = supabase
      .from('achievement_log')
      .select('id')
      .eq('achievement_type_id', goalType.id)
      .gte('earned_at', `${today}T00:00:00`)
      .lt('earned_at', `${today}T23:59:59`);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('device_id', deviceId!).is('user_id', null);
    }

    const { data: existing, error: queryError } = await query.limit(1);

    if (queryError) {
      console.error('Error checking existing goal achievement:', queryError);
    }

    if (!existing || existing.length === 0) {
      // Haven't awarded today yet
      console.log('Awarding goal achievement');
      const result = await awardAchievement(userId, deviceId || null, goalType.id, {
        steps,
        goal: dailyGoal,
        date: today,
      });
      
      if (result.error) {
        console.error('Error awarding goal achievement:', result.error);
      } else {
        console.log('Goal achievement awarded successfully!');
      }
    } else {
      console.log('Goal achievement already awarded today');
    }
  } catch (err) {
    console.error('Error in checkGoalAchievement:', err);
  }
};

/**
 * Check and award streak achievement (🔥)
 * Note: This requires checking consecutive days, so it needs to query step_data
 */
export const checkStreakAchievement = async (
  userId: string | null,
  deviceId?: string | null
): Promise<void> => {
  try {
    // Get device ID if not provided
    if (!deviceId && !userId) {
      deviceId = await getDeviceId();
    }

    // Check last 7 days to see if there's a streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let query = supabase
      .from('step_data')
      .select('date, steps')
      .gte('date', new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('date', today.toISOString().split('T')[0])
      .gt('steps', 0) // Only count days with steps
      .order('date', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('device_id', deviceId!).is('user_id', null);
    }

    const { data: stepData, error } = await query;

    if (error || !stepData || stepData.length === 0) {
      return;
    }

    // Calculate consecutive days from today backwards
    let streak = 0;
    const dates = new Set(stepData.map(d => d.date));
    
    for (let i = 0; i < 365; i++) { // Check up to 365 days
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (dates.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    // Award streak achievements for milestones (3, 7, 14, 30, 100 days)
    if (streak >= 3) {
      const streakType = await getAchievementType('🔥');
      if (streakType) {
        const milestones = [3, 7, 14, 30, 100];
        
        for (const milestone of milestones) {
          // Check if we just reached this milestone
          if (streak === milestone || (streak > milestone && streak <= milestone + 1)) {
            // Check if this milestone was already awarded
            let checkQuery = supabase
              .from('achievement_log')
              .select('id')
              .eq('achievement_type_id', streakType.id)
              .eq('metadata->>milestone', milestone.toString());

            if (userId) {
              checkQuery = checkQuery.eq('user_id', userId);
            } else {
              checkQuery = checkQuery.eq('device_id', deviceId!).is('user_id', null);
            }

            const { data: existing } = await checkQuery.limit(1);

            if (!existing || existing.length === 0) {
              await awardAchievement(userId, deviceId || null, streakType.id, {
                streak,
                milestone,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in checkStreakAchievement:', err);
  }
};

/**
 * Check rank-based competition achievements (daily, weekly, monthly, yearly)
 */
export const checkCompetitionAchievements = async (
  userId: string | null,
  period: 'day' | 'week' | 'month' | 'year',
  deviceId?: string | null
): Promise<void> => {
  try {
    if (!userId) {
      return; // Only logged-in users can have friends and compete
    }

    // Get device ID if not provided
    if (!deviceId && !userId) {
      deviceId = await getDeviceId();
    }

    // Get date range for the period
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'day': {
        startDate = new Date(today);
        endDate = new Date(today);
        break;
      }
      case 'week': {
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);
        startDate = monday;
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        endDate = sunday;
        break;
      }
      case 'month': {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'year': {
        startDate = new Date(today.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Import getFriendsStepsForPeriod
    const { getFriendsStepsForPeriod } = await import('./friendService');
    
    // Get friends' steps for the period (includes current user)
    const { data: friendsSteps, error } = await getFriendsStepsForPeriod(
      userId,
      startDateStr,
      endDateStr,
      true
    );

    if (error || !friendsSteps || friendsSteps.length === 0) {
      return; // No friends or error
    }

    // Find current user's rank
    const currentUserData = friendsSteps.find(f => f.id === userId);
    if (!currentUserData) {
      return; // User not found in rankings
    }

    const rank = currentUserData.rank;
    if (rank > 3) {
      return; // Only award for top 3
    }

    // Determine achievement emoji based on period and rank
    let achievementEmoji: string;
    if (period === 'day') {
      if (rank === 1) achievementEmoji = '🥇';
      else if (rank === 2) achievementEmoji = '🥈';
      else achievementEmoji = '🥉';
    } else if (period === 'week') {
      if (rank === 1) achievementEmoji = '🏆';
      else if (rank === 2) achievementEmoji = '🥈';
      else achievementEmoji = '🥉';
    } else if (period === 'month') {
      if (rank === 1) achievementEmoji = '👑';
      else if (rank === 2) achievementEmoji = '💍';
      else achievementEmoji = '💎';
    } else { // year
      if (rank === 1) achievementEmoji = '⭐';
      else if (rank === 2) achievementEmoji = '🌟';
      else achievementEmoji = '✨';
    }

    // Get achievement type
    const achievementType = await getAchievementType(achievementEmoji);
    if (!achievementType) {
      return;
    }

    // Check if already awarded for this period
    const periodKey = `${period}_${startDateStr}_${endDateStr}`;
    let checkQuery = supabase
      .from('achievement_log')
      .select('id, metadata')
      .eq('achievement_type_id', achievementType.id)
      .eq('user_id', userId);

    const { data: logs } = await checkQuery;

    // Check if this period was already awarded (check metadata.period)
    const existing = logs?.find(log => 
      log.metadata && 
      typeof log.metadata === 'object' && 
      'period' in log.metadata &&
      (log.metadata as any).period === periodKey
    );

    if (!existing) {
      // Award the achievement
      await awardAchievement(userId, null, achievementType.id, {
        period: periodKey,
        rank: rank,
        startDate: startDateStr,
        endDate: endDateStr,
      });
    }
  } catch (err) {
    console.error('Error in checkCompetitionAchievements:', err);
  }
};

/**
 * Check fun/milestone achievements
 */
export const checkFunAchievements = async (
  userId: string | null,
  steps: number,
  dailyGoal: number | null,
  deviceId?: string | null
): Promise<void> => {
  try {
    if (!userId && !deviceId) {
      deviceId = await getDeviceId();
    }

    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    // 🚀 Rakett - Over 20000 skritt på én dag
    if (steps >= 20000) {
      const rocketType = await getAchievementType('🚀');
      if (rocketType) {
        let checkQuery = supabase
          .from('achievement_log')
          .select('id')
          .eq('achievement_type_id', rocketType.id)
          .gte('earned_at', `${today}T00:00:00`)
          .lt('earned_at', `${today}T23:59:59`);

        if (userId) {
          checkQuery = checkQuery.eq('user_id', userId);
        } else {
          checkQuery = checkQuery.eq('device_id', deviceId!).is('user_id', null);
        }

        const { data: existing } = await checkQuery.limit(1);
        if (!existing || existing.length === 0) {
          await awardAchievement(userId, deviceId || null, rocketType.id, {
            steps,
            date: today,
          });
        }
      }
    }

    // 💯 Hundre - Nøyaktig 100 skritt (fun achievement)
    if (steps === 100) {
      const hundredType = await getAchievementType('💯');
      if (hundredType) {
        let checkQuery = supabase
          .from('achievement_log')
          .select('id')
          .eq('achievement_type_id', hundredType.id)
          .gte('earned_at', `${today}T00:00:00`)
          .lt('earned_at', `${today}T23:59:59`);

        if (userId) {
          checkQuery = checkQuery.eq('user_id', userId);
        } else {
          checkQuery = checkQuery.eq('device_id', deviceId!).is('user_id', null);
        }

        const { data: existing } = await checkQuery.limit(1);
        if (!existing || existing.length === 0) {
          await awardAchievement(userId, deviceId || null, hundredType.id, {
            steps,
            date: today,
          });
        }
      }
    }

    // 🎯 Bullseye - Nøyaktig dagens mål
    if (dailyGoal && steps === dailyGoal) {
      const bullseyeType = await getAchievementType('🎯');
      if (bullseyeType) {
        let checkQuery = supabase
          .from('achievement_log')
          .select('id')
          .eq('achievement_type_id', bullseyeType.id)
          .gte('earned_at', `${today}T00:00:00`)
          .lt('earned_at', `${today}T23:59:59`);

        if (userId) {
          checkQuery = checkQuery.eq('user_id', userId);
        } else {
          checkQuery = checkQuery.eq('device_id', deviceId!).is('user_id', null);
        }

        const { data: existing } = await checkQuery.limit(1);
        if (!existing || existing.length === 0) {
          await awardAchievement(userId, deviceId || null, bullseyeType.id, {
            steps,
            goal: dailyGoal,
            date: today,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error in checkFunAchievements:', err);
  }
};

/**
 * Check all achievements based on current step data
 */
export const checkAllAchievements = async (
  userId: string | null,
  steps: number,
  distanceMeters: number,
  dailyGoal: number | null,
  deviceId?: string | null
): Promise<void> => {
  try {
    // Get device ID if not provided
    if (!deviceId && !userId) {
      deviceId = await getDeviceId();
    }

    // Check step-based achievements (🍒, 🍑, 🎯)
    await checkDistanceAchievements(userId, steps, distanceMeters, deviceId || undefined);

    // Check goal achievement
    await checkGoalAchievement(userId, steps, dailyGoal, deviceId || undefined);

    // Check fun achievements
    await checkFunAchievements(userId, steps, dailyGoal, deviceId || undefined);

    // Check competition achievements (only for logged-in users with friends)
    if (userId) {
      await checkCompetitionAchievements(userId, 'day', deviceId || undefined);
    }

    // Check streak achievement (runs less frequently, but we'll check daily)
    // We'll only check this once per day to avoid too many queries
    const today = new Date().toISOString().split('T')[0];
    const lastCheckKey = userId ? `streak_check_${userId}` : `streak_check_device_${deviceId}`;
    
    // In a real app, you'd want to check localStorage/AsyncStorage for last check
    // For now, we'll check it every time but optimize later
    await checkStreakAchievement(userId, deviceId || undefined);
  } catch (err) {
    console.error('Error in checkAllAchievements:', err);
  }
};

