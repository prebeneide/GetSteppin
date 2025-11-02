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

    const { data: existing, error: checkError } = await query.maybeSingle();

    if (checkError) {
      // Error checking - log but continue (might be a race condition)
      console.error('Error checking existing achievement:', checkError);
      // Don't return error - try to handle gracefully below
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
        // If it's a duplicate key error, the achievement was likely just inserted by another concurrent call
        // Try to update it instead
        if (insertError.code === '23505') {
          // Unique constraint violation - achievement already exists
          // Fetch it and update instead
          const { data: existingAfterInsert, error: fetchError } = await query.maybeSingle();
          
          if (!fetchError && existingAfterInsert) {
            const { error: updateError } = await supabase
              .from('user_achievements')
              .update({
                count: existingAfterInsert.count + 1,
                last_earned_at: new Date().toISOString(),
              })
              .eq('id', existingAfterInsert.id);

            if (updateError) {
              console.error('Error updating achievement after duplicate insert:', updateError);
              return { error: updateError };
            }
            // Successfully handled the race condition
          } else {
            console.error('Error inserting achievement:', insertError);
            return { error: insertError };
          }
        } else {
          console.error('Error inserting achievement:', insertError);
          return { error: insertError };
        }
      }
    }

    // Log achievement in achievement_log
    const logData: any = {
      achievement_type_id: achievementTypeId,
    };

    if (metadata) {
      logData.metadata = metadata;
    }

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
    // Only award once per 10000 steps increment today
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
 * Check and award goal achievement (🎊)
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

    // 🎊 Dagens Mål - completed daily goal
    const goalType = await getAchievementType('🎊');
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
 * Dette gir KUN permanente prestasjoner ved periodens slutt, ikke foreløpige.
 * For daglige prestasjoner: sjekk I GÅR (ikke i dag), for å kun gi prestasjon ved periodens slutt.
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

    // For daglige prestasjoner: sjekk I GÅR (ikke i dag), for å kun gi prestasjon ved periodens slutt
    // For uke/måned: sjekk forrige periode (ikke nåværende)
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'day': {
        // Sjekk i går (forrige dag) for å gi prestasjon ved periodens slutt
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        startDate = yesterday;
        endDate = yesterday;
        break;
      }
      case 'week': {
        // Sjekk forrige uke (ikke nåværende uke)
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - daysFromMonday - 7); // Forrige uke
        lastMonday.setHours(0, 0, 0, 0);
        startDate = lastMonday;
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        lastSunday.setHours(23, 59, 59, 999);
        endDate = lastSunday;
        break;
      }
      case 'month': {
        // Sjekk forrige måned (ikke nåværende måned)
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        lastMonth.setHours(0, 0, 0, 0);
        startDate = lastMonth;
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);
        endDate = lastMonthEnd;
        break;
      }
      case 'year': {
        // Sjekk forrige år (ikke nåværende år)
        const lastYear = new Date(today.getFullYear() - 1, 0, 1);
        lastYear.setHours(0, 0, 0, 0);
        startDate = lastYear;
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        lastYearEnd.setHours(23, 59, 59, 999);
        endDate = lastYearEnd;
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
      if (rank === 1) achievementEmoji = '🏆'; // Ukesvinner
      else if (rank === 2) achievementEmoji = '🥈';
      else achievementEmoji = '🥉';
    } else if (period === 'month') {
      if (rank === 1) achievementEmoji = '👑'; // Månedens vinner
      else if (rank === 2) achievementEmoji = '🥈';
      else achievementEmoji = '🥉';
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

    // Sjekk om allerede gitt for denne perioden (via metadata)
    const periodKey = `${period}_${startDateStr}_${endDateStr}`;
    
    let checkQuery = supabase
      .from('achievement_log')
      .select('id, metadata')
      .eq('achievement_type_id', achievementType.id)
      .eq('user_id', userId);

    const { data: logs } = await checkQuery;

    // Sjekk om denne perioden allerede er gitt
    const existing = logs?.find(log => 
      log.metadata && 
      typeof log.metadata === 'object' && 
      'period' in log.metadata &&
      (log.metadata as any).period === periodKey
    );

    if (existing) {
      return; // Allerede gitt for denne perioden
    }

    // Award the achievement (kun én gang per periode)
    await awardAchievement(userId, null, achievementType.id, {
      period: periodKey,
      rank: rank,
      startDate: startDateStr,
      endDate: endDateStr,
      is_permanent: true, // Marker som permanent prestasjon
    });
  } catch (err) {
    console.error('Error in checkCompetitionAchievements:', err);
  }
};

/**
 * Get preliminary achievements based on current ranking (not saved to database)
 * Brukes for å vise foreløpige prestasjoner i løpet av dagen/perioden.
 * Disse kan mistes hvis noen går forbi deg, og lagres IKKE i databasen.
 */
export const getPreliminaryAchievements = async (
  userId: string | null,
  period: 'day' | 'week' | 'month' | 'year' = 'day'
): Promise<string[]> => {
  try {
    if (!userId) {
      return []; // Only logged-in users can have friends and compete
    }

    // Get date range for the current period (not past period)
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
    
    // Get friends' steps for the current period (includes current user)
    const { data: friendsSteps, error } = await getFriendsStepsForPeriod(
      userId,
      startDateStr,
      endDateStr,
      true
    );

    console.log(`[getPreliminaryAchievements] Period: ${period}, startDate: ${startDateStr}, endDate: ${endDateStr}`);
    console.log(`[getPreliminaryAchievements] Friends steps:`, friendsSteps);
    console.log(`[getPreliminaryAchievements] Error:`, error);

    if (error) {
      console.error(`[getPreliminaryAchievements] Error fetching friends steps:`, error);
      return []; // Error fetching data
    }

    if (!friendsSteps || friendsSteps.length === 0) {
      console.log(`[getPreliminaryAchievements] No friends steps found (no friends or no data for period)`);
      return []; // No friends or error
    }

    // Find current user's rank
    const currentUserData = friendsSteps.find(f => f.id === userId);
    console.log(`[getPreliminaryAchievements] Current user data:`, currentUserData);
    
    if (!currentUserData) {
      console.log(`[getPreliminaryAchievements] User not found in rankings`);
      return []; // User not found in rankings
    }

    const rank = typeof currentUserData.rank === 'number' ? currentUserData.rank : parseInt(currentUserData.rank, 10);
    console.log(`[getPreliminaryAchievements] User rank: ${rank}, type: ${typeof rank}, raw value: ${currentUserData.rank}`);
    
    if (isNaN(rank) || rank > 3) {
      console.log(`[getPreliminaryAchievements] Rank ${rank} is invalid or > 3, not returning achievements`);
      return []; // Only return achievements for top 3
    }

    // Determine achievement emoji based on period and rank (foreløpige prestasjoner)
    const preliminaryAchievements: string[] = [];
    
    console.log(`[getPreliminaryAchievements] Determining emoji for period: ${period}, rank: ${rank} (type: ${typeof rank})`);
    
    if (period === 'day') {
      if (rank === 1) {
        preliminaryAchievements.push('🥇');
        console.log(`[getPreliminaryAchievements] Added 🥇 for rank 1 (day)`);
      } else if (rank === 2) {
        preliminaryAchievements.push('🥈');
        console.log(`[getPreliminaryAchievements] Added 🥈 for rank 2 (day)`);
      } else if (rank === 3) {
        preliminaryAchievements.push('🥉');
        console.log(`[getPreliminaryAchievements] Added 🥉 for rank 3 (day)`);
      } else {
        console.log(`[getPreliminaryAchievements] No achievement for rank ${rank} (day)`);
      }
    } else if (period === 'week') {
      if (rank === 1) {
        preliminaryAchievements.push('🏆'); // Foreløpig ukesvinner
        console.log(`[getPreliminaryAchievements] Added 🏆 for rank 1 (week)`);
      } else if (rank === 2) {
        preliminaryAchievements.push('🥈');
        console.log(`[getPreliminaryAchievements] Added 🥈 for rank 2 (week)`);
      } else if (rank === 3) {
        preliminaryAchievements.push('🥉');
        console.log(`[getPreliminaryAchievements] Added 🥉 for rank 3 (week)`);
      } else {
        console.log(`[getPreliminaryAchievements] No achievement for rank ${rank} (week)`);
      }
    } else if (period === 'month') {
      if (rank === 1) {
        preliminaryAchievements.push('👑'); // Foreløpig månedens vinner
        console.log(`[getPreliminaryAchievements] Added 👑 for rank 1 (month)`);
      } else if (rank === 2) {
        preliminaryAchievements.push('🥈');
        console.log(`[getPreliminaryAchievements] Added 🥈 for rank 2 (month)`);
      } else if (rank === 3) {
        preliminaryAchievements.push('🥉');
        console.log(`[getPreliminaryAchievements] Added 🥉 for rank 3 (month)`);
      } else {
        console.log(`[getPreliminaryAchievements] No achievement for rank ${rank} (month)`);
      }
    } else { // year
      if (rank === 1) {
        preliminaryAchievements.push('⭐');
        console.log(`[getPreliminaryAchievements] Added ⭐ for rank 1 (year)`);
      } else if (rank === 2) {
        preliminaryAchievements.push('🌟');
        console.log(`[getPreliminaryAchievements] Added 🌟 for rank 2 (year)`);
      } else if (rank === 3) {
        preliminaryAchievements.push('✨');
        console.log(`[getPreliminaryAchievements] Added ✨ for rank 3 (year)`);
      }
    }

    console.log(`[getPreliminaryAchievements] FINAL RETURN for ${period}:`, preliminaryAchievements);
    return preliminaryAchievements;
  } catch (err) {
    console.error('Error in getPreliminaryAchievements:', err);
    return [];
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
 * Check global top percentage achievements (💎 Topp 5%, 🏅 Topp 10%, 🏵️ Topp 25%)
 * These are based on ranking among ALL users in the app, not just friends
 * Only checks for logged-in users (user_id required)
 * Checks for YESTERDAY (permanent achievement at end of day)
 */
export const checkTopPercentageAchievements = async (
  userId: string | null
): Promise<void> => {
  try {
    if (!userId) {
      return; // Only logged-in users can get global rankings
    }

    // Check for YESTERDAY (not today) - permanent achievement at end of day
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get all users' step data for yesterday using RPC function
    // This bypasses RLS to get global ranking
    const { data: allUsersData, error: stepError } = await supabase
      .rpc('get_global_step_ranking', { target_date: yesterdayStr });

    if (stepError) {
      console.error('Error fetching global step data:', stepError);
      return;
    }

    if (!allUsersData || allUsersData.length === 0) {
      return; // No users with data yesterday
    }

    // Minimum 20 users required for meaningful percentages
    // This ensures at least 1 user is in top 5% (20 * 0.05 = 1)
    if (allUsersData.length < 20) {
      console.log('Not enough users for top percentage achievements:', allUsersData.length);
      return;
    }

    // Find current user's rank
    const userData = allUsersData?.find((d: { user_id: string; steps: number }) => d.user_id === userId);
    if (!userData) {
      return; // User has no data for yesterday
    }

    // Find rank (position in sorted list, 1-indexed)
    // The list is already sorted by steps descending, so we find the index
    const userIndex = allUsersData.findIndex((d: { user_id: string; steps: number }) => d.user_id === userId);
    if (userIndex === -1) {
      return; // User not found (shouldn't happen)
    }
    
    // Rank is 1-indexed
    const rank = userIndex + 1;

    const totalUsers = allUsersData.length;
    const percentage = (rank / totalUsers) * 100;

    // Check which achievements user qualifies for (only award highest one)
    let achievementEmoji: string | null = null;
    
    if (percentage <= 5) {
      achievementEmoji = '💎'; // Topp 5%
    } else if (percentage <= 10) {
      achievementEmoji = '🏅'; // Topp 10%
    } else if (percentage <= 25) {
      achievementEmoji = '🏵️'; // Topp 25%
    }

    if (!achievementEmoji) {
      return; // User doesn't qualify for any top percentage achievement
    }

    // Get achievement type
    const achievementType = await getAchievementType(achievementEmoji);
    if (!achievementType) {
      console.error('Could not find top percentage achievement type:', achievementEmoji);
      return;
    }

    // Check if already awarded for yesterday
    const todayDate = yesterdayStr;
    let checkQuery = supabase
      .from('achievement_log')
      .select('id, metadata')
      .eq('achievement_type_id', achievementType.id)
      .eq('user_id', userId)
      .gte('earned_at', `${todayDate}T00:00:00`)
      .lt('earned_at', `${todayDate}T23:59:59`);

    const { data: logs } = await checkQuery;

    // Check if already awarded for yesterday (via metadata)
    const existing = logs?.find(log => 
      log.metadata && 
      typeof log.metadata === 'object' && 
      'date' in log.metadata &&
      (log.metadata as any).date === yesterdayStr &&
      'type' in log.metadata &&
      (log.metadata as any).type === 'global_top_percentage'
    );

    if (existing) {
      return; // Already awarded for yesterday
    }

    // Award the achievement
    await awardAchievement(userId, null, achievementType.id, {
      date: yesterdayStr,
      rank: rank,
      total_users: totalUsers,
      percentage: percentage.toFixed(2),
      type: 'global_top_percentage',
    });

    console.log(`Awarded ${achievementEmoji} (rank ${rank}/${totalUsers}, ${percentage.toFixed(2)}%)`);
  } catch (err) {
    console.error('Error in checkTopPercentageAchievements:', err);
  }
};

/**
 * Check running achievements (🏃 5km, 🏃‍♀️ 10km, 🏁 21,1km, 🏃‍♂️ 42,2km)
 * These are based on accumulated running distance (>= 8 km/h) for the day
 * Only works when app is active (requires continuous updates to calculate speed)
 */
export const checkRunningAchievements = async (
  userId: string | null,
  deviceId?: string | null
): Promise<void> => {
  try {
    if (!userId && !deviceId) {
      return; // Need user or device ID
    }

    // Get device ID if not provided
    if (!deviceId && !userId) {
      deviceId = await getDeviceId();
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's step data including running_distance_meters
    let query = supabase
      .from('step_data')
      .select('running_distance_meters')
      .eq('date', today);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('device_id', deviceId!).is('user_id', null);
    }

    const { data: stepData, error: stepError } = await query.single();

    if (stepError || !stepData) {
      // No data for today, or error
      return;
    }

    const runningDistance = stepData.running_distance_meters || 0;

    // Define milestones (in meters)
    const milestones = [
      { distance: 5000, emoji: '🏃', name: '5 km løpt' }, // 5 km
      { distance: 10000, emoji: '🏃‍♀️', name: '10 km løpt' }, // 10 km
      { distance: 21100, emoji: '🏁', name: 'Halvmaraton løpt' }, // 21,1 km (halvmaraton)
      { distance: 42200, emoji: '🏃‍♂️', name: 'Maraton løpt' }, // 42,2 km (maraton)
    ];

    // Check each milestone
    for (const milestone of milestones) {
      if (runningDistance >= milestone.distance) {
        // Get achievement type
        const achievementType = await getAchievementType(milestone.emoji);
        if (!achievementType) {
          console.error(`Could not find running achievement type: ${milestone.emoji}`);
          continue;
        }

        // Check if already awarded today
        const todayDate = today;
        let checkQuery = supabase
          .from('achievement_log')
          .select('id')
          .eq('achievement_type_id', achievementType.id)
          .gte('earned_at', `${todayDate}T00:00:00`)
          .lt('earned_at', `${todayDate}T23:59:59`);

        if (userId) {
          checkQuery = checkQuery.eq('user_id', userId);
        } else {
          checkQuery = checkQuery.eq('device_id', deviceId!).is('user_id', null);
        }

        const { data: logs } = await checkQuery;

        // Only award once per day per milestone
        if (!logs || logs.length === 0) {
          // Award the achievement
          await awardAchievement(userId, deviceId || null, achievementType.id, {
            distance: milestone.distance,
            running_distance: runningDistance,
            date: today,
            type: 'running',
          });

          console.log(`Awarded ${milestone.emoji} ${milestone.name} (${(runningDistance / 1000).toFixed(2)} km løpt)`);
        }
      }
    }
  } catch (err) {
    console.error('Error in checkRunningAchievements:', err);
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

    // Check running achievements (works for both logged-in and anonymous users)
    // Only works when app is active (requires continuous updates to calculate speed)
    await checkRunningAchievements(userId, deviceId || undefined);

    // Check competition achievements (only for logged-in users with friends)
    if (userId) {
      await checkCompetitionAchievements(userId, 'day', deviceId || undefined);
    }

    // Check global top percentage achievements (only for logged-in users)
    // Checks for yesterday (permanent achievement at end of day)
    if (userId) {
      await checkTopPercentageAchievements(userId);
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

