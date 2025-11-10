import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import { getPreliminaryAchievements } from '../services/achievementService';
import { useTranslation, t as translate, Language } from '../lib/i18n';

interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string | null;
  category: string;
  count: number;
  first_earned_at: string;
  last_earned_at: string;
  isPreliminary?: boolean; // For foreløpige prestasjoner
}

interface AchievementsViewProps {
  userId: string | null;
  isLoggedIn: boolean;
  showTitle?: boolean; // Optional: show title (default: true)
}

export default function AchievementsView({ userId, isLoggedIn, showTitle = true }: AchievementsViewProps) {
  const { t, language } = useTranslation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);

  // Load achievements function - uses translate() directly with current language
  // This ensures translations are always correct regardless of when the function is called
  // We don't use emojiNameMap/emojiDescMap anymore - we translate directly based on current language
  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    console.log('[AchievementsView] loadAchievements called - isLoggedIn:', isLoggedIn, 'userId:', userId);
    
    try {
      let query = supabase
        .from('user_achievements')
        .select(`
          id,
          count,
          first_earned_at,
          last_earned_at,
          achievement_types (
            id,
            emoji,
            name,
            description,
            category
          )
        `);

      if (isLoggedIn && userId) {
        // Logged in user - filter by user_id
        query = query.eq('user_id', userId);
      } else {
        // Anonymous user - filter by device_id
        const deviceId = await getDeviceId();
        query = query.eq('device_id', deviceId).is('user_id', null);
      }

      const { data, error: fetchError } = await query.order('last_earned_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching achievements:', fetchError);
        setError(translate('screens.achievements.couldNotLoad', language));
      } else {
        // Transform the data to flatten achievement_types
        const transformed = (data || []).map((item: any) => {
          const emoji: string = item.achievement_types?.emoji || '';
          const lastEarnedAt = item.last_earned_at as string;
          const earnedDate = lastEarnedAt ? new Date(lastEarnedAt) : null;

          // ALWAYS use translation - never show database name directly
          // Strategy: Always use database name mapping as primary source for translation
          // This ensures that even if emoji doesn't match, we still get the correct translation
          let name = '';
          const dbName = item.achievement_types?.name || '';
          
          // First, try to find translation by database name (most reliable)
          if (dbName) {
            const nameKeyMap: { [key: string]: string } = {
              'Kirsebær': 'cherry',
              'Fersken': 'peach',
              'Milestone': 'milestone',
              'Dagens Mål': 'dailyGoal',
              'Pokal': 'weeklyWinner',
              'Ukesvinner': 'weeklyWinner',
              'Topp 5%': 'top5Percent',
              'Streak': 'streak',
              'Teamplayer': 'teamplayer',
              'Rakett': 'rocket',
              'Hundre': 'hundred',
              'Fest': 'party',
              'Nattugle': 'nightOwl',
              'Morgenfugl': 'earlyBird',
              'Overraskelse': 'surprise',
              '5 km løpt': 'run5km',
              '10 km løpt': 'run10km',
              'Halvmaraton løpt': 'halfMarathon',
              'Maraton løpt': 'marathon',
              'Dagens gull': 'dailyGoldPermanent',
              'Dagens sølv': 'dailySilverPermanent',
              'Dagens bronse': 'dailyBronzePermanent',
            };
            const key = nameKeyMap[dbName];
            if (key) {
              const translationKey = `screens.achievements.${key}`;
              name = translate(translationKey, language);
            } else {
              // If database name not found, try emoji map as fallback - use translate directly with current language
              const normalizedEmoji = emoji.trim();
              // Map emoji to translation key and translate directly
              const emojiToKey: { [key: string]: string } = {
                '🥇': 'screens.achievements.dailyGoldPermanent',
                '🥈': 'screens.achievements.dailySilverPermanent',
                '🥉': 'screens.achievements.dailyBronzePermanent',
                '🏆': 'screens.achievements.weeklyWinner',
                '👑': 'screens.achievements.monthlyWinner',
                '🍒': 'screens.achievements.cherry',
                '🍑': 'screens.achievements.peach',
                '🎯': 'screens.achievements.milestone',
                '✅': 'screens.achievements.dailyGoal',
                '⭐': 'screens.achievements.top5Percent',
                '🔥': 'screens.achievements.streak',
                '🤝': 'screens.achievements.teamplayer',
                '🚀': 'screens.achievements.rocket',
                '💯': 'screens.achievements.hundred',
                '🎊': 'screens.achievements.party',
                '🌙': 'screens.achievements.nightOwl',
                '🌅': 'screens.achievements.earlyBird',
                '🎁': 'screens.achievements.surprise',
                '🏃': 'screens.achievements.run5km',
                '🏃‍♀️': 'screens.achievements.run10km',
                '🏁': 'screens.achievements.halfMarathon',
                '🏃‍♂️': 'screens.achievements.marathon',
              };
              const translationKey = emojiToKey[normalizedEmoji] || emojiToKey[emoji];
              if (translationKey) {
                name = translate(translationKey, language);
              } else {
                console.error('[AchievementsView] Translation not found for achievement name:', dbName, 'emoji:', emoji);
                name = dbName; // Fallback to database name if no translation found
              }
            }
          } else {
            // If no database name, try emoji map - use translate directly with current language
            const normalizedEmoji = emoji.trim();
            const emojiToKey: { [key: string]: string } = {
              '🥇': 'screens.achievements.dailyGoldPermanent',
              '🥈': 'screens.achievements.dailySilverPermanent',
              '🥉': 'screens.achievements.dailyBronzePermanent',
              '🏆': 'screens.achievements.weeklyWinner',
              '👑': 'screens.achievements.monthlyWinner',
              '🍒': 'screens.achievements.cherry',
              '🍑': 'screens.achievements.peach',
              '🎯': 'screens.achievements.milestone',
              '✅': 'screens.achievements.dailyGoal',
              '⭐': 'screens.achievements.top5Percent',
              '🔥': 'screens.achievements.streak',
              '🤝': 'screens.achievements.teamplayer',
              '🚀': 'screens.achievements.rocket',
              '💯': 'screens.achievements.hundred',
              '🎊': 'screens.achievements.party',
              '🌙': 'screens.achievements.nightOwl',
              '🌅': 'screens.achievements.earlyBird',
              '🎁': 'screens.achievements.surprise',
              '🏃': 'screens.achievements.run5km',
              '🏃‍♀️': 'screens.achievements.run10km',
              '🏁': 'screens.achievements.halfMarathon',
              '🏃‍♂️': 'screens.achievements.marathon',
            };
            const translationKey = emojiToKey[normalizedEmoji] || emojiToKey[emoji];
            if (translationKey) {
              name = translate(translationKey, language);
            } else {
              name = '';
            }
          }
          
          // ALWAYS use translation - never show database description directly
          // Strategy: Always use database description mapping as primary source for translation
          let baseDesc: string | null = null;
          const dbDesc = item.achievement_types?.description || '';
          
          // First, try to find translation by database description (most reliable)
          if (dbDesc) {
            const descKeyMap: { [key: string]: string } = {
              'Gått 1000 skritt': 'cherryDescription',
              'Gått 10000 skritt': 'peachDescription',
              'Når større milepæler (50km, 100km, 500km osv)': 'milestoneDescription',
              'Klart dagens skrittmål': 'dailyGoalDescription',
              'Vunnet over alle venner i dag': 'firstPlaceLastWeek',
              '1. plass blant venner i dag': 'firstPlaceTodayPreliminary',
              '2. plass blant venner i dag': 'secondPlaceTodayPreliminary',
              '3. plass blant venner i dag': 'thirdPlaceTodayPreliminary',
              '1. plass blant venner i går': 'firstPlaceYesterday',
              '2. plass blant venner i går': 'secondPlaceYesterday',
              '3. plass blant venner i går': 'thirdPlaceYesterday',
              '1. plass blant venner forrige uke': 'firstPlaceLastWeek',
              '1. plass blant venner forrige måned': 'firstPlaceLastMonth',
              'Topp ukesvinner': 'firstPlaceLastWeek',
              'Topp 5% av alle brukere': 'top5PercentDescription',
              'Daglig strek på rad': 'streakDescription',
              'Oppmuntret venner': 'teamplayerDescription',
              'Over 20000 skritt på én dag': 'rocketDescription',
              'Nøyaktig 100 skritt': 'hundredDescription',
              '10 000 skritt på én dag': 'partyDescription',
              'Over 1000 skritt etter kl 22': 'nightOwlDescription',
              'Over 5000 skritt før kl 10': 'earlyBirdDescription',
              '10 000 skritt før lunsj': 'surpriseDescription',
              'Løpt/jogget 5 km på én dag': 'run5kmDescription',
              'Løpt/jogget 10 km på én dag': 'run10kmDescription',
              'Løpt halvmaraton (21,1 km) på én dag': 'halfMarathonDescription',
              'Løpt maraton (42,2 km) på én dag': 'marathonDescription',
            };
            const key = descKeyMap[dbDesc];
            if (key) {
              const translationKey = `screens.achievements.${key}`;
              baseDesc = translate(translationKey, language);
            } else {
              // If database description not found, try emoji map as fallback - use translate directly with current language
              const normalizedEmoji = emoji.trim();
              const emojiToDescKey: { [key: string]: string } = {
                '🥇': 'screens.achievements.firstPlaceYesterday',
                '🥈': 'screens.achievements.secondPlaceYesterday',
                '🥉': 'screens.achievements.thirdPlaceYesterday',
                '🏆': 'screens.achievements.firstPlaceLastWeek',
                '👑': 'screens.achievements.firstPlaceLastMonth',
                '🍒': 'screens.achievements.cherryDescription',
                '🍑': 'screens.achievements.peachDescription',
                '🎯': 'screens.achievements.milestoneDescription',
                '✅': 'screens.achievements.dailyGoalDescription',
                '⭐': 'screens.achievements.top5PercentDescription',
                '🔥': 'screens.achievements.streakDescription',
                '🤝': 'screens.achievements.teamplayerDescription',
                '🚀': 'screens.achievements.rocketDescription',
                '💯': 'screens.achievements.hundredDescription',
                '🎊': 'screens.achievements.partyDescription',
                '🌙': 'screens.achievements.nightOwlDescription',
                '🌅': 'screens.achievements.earlyBirdDescription',
                '🎁': 'screens.achievements.surpriseDescription',
                '🏃': 'screens.achievements.run5kmDescription',
                '🏃‍♀️': 'screens.achievements.run10kmDescription',
                '🏁': 'screens.achievements.halfMarathonDescription',
                '🏃‍♂️': 'screens.achievements.marathonDescription',
              };
              const translationKey = emojiToDescKey[normalizedEmoji] || emojiToDescKey[emoji];
              if (translationKey) {
                baseDesc = translate(translationKey, language);
              } else {
                console.error('[AchievementsView] Translation not found for achievement description:', dbDesc, 'emoji:', emoji);
                baseDesc = dbDesc; // Fallback to database description if no translation found
              }
            }
          } else {
            // If no database description, try emoji map - use translate directly with current language
            const normalizedEmoji = emoji.trim();
            const emojiToDescKey: { [key: string]: string } = {
              '🥇': 'screens.achievements.firstPlaceYesterday',
              '🥈': 'screens.achievements.secondPlaceYesterday',
              '🥉': 'screens.achievements.thirdPlaceYesterday',
              '🏆': 'screens.achievements.firstPlaceLastWeek',
              '👑': 'screens.achievements.firstPlaceLastMonth',
              '🍒': 'screens.achievements.cherryDescription',
              '🍑': 'screens.achievements.peachDescription',
              '🎯': 'screens.achievements.milestoneDescription',
              '✅': 'screens.achievements.dailyGoalDescription',
              '⭐': 'screens.achievements.top5PercentDescription',
              '🔥': 'screens.achievements.streakDescription',
              '🤝': 'screens.achievements.teamplayerDescription',
              '🚀': 'screens.achievements.rocketDescription',
              '💯': 'screens.achievements.hundredDescription',
              '🎊': 'screens.achievements.partyDescription',
              '🌙': 'screens.achievements.nightOwlDescription',
              '🌅': 'screens.achievements.earlyBirdDescription',
              '🎁': 'screens.achievements.surpriseDescription',
              '🏃': 'screens.achievements.run5kmDescription',
              '🏃‍♀️': 'screens.achievements.run10kmDescription',
              '🏁': 'screens.achievements.halfMarathonDescription',
              '🏃‍♂️': 'screens.achievements.marathonDescription',
            };
            const translationKey = emojiToDescKey[normalizedEmoji] || emojiToDescKey[emoji];
            if (translationKey) {
              baseDesc = translate(translationKey, language);
            } else {
              baseDesc = null;
            }
          }
          const description = earnedDate
            ? `${baseDesc || ''}${baseDesc ? ' • ' : ''}${translate('screens.achievements.lastEarned', language)}: ${earnedDate.toLocaleDateString(language === 'en' ? 'en-US' : 'no-NO')}`
            : baseDesc;

          return {
            id: item.id,
            emoji,
            name,
            description,
            category: item.achievement_types?.category || '',
            count: item.count || 1,
            first_earned_at: item.first_earned_at,
            last_earned_at: item.last_earned_at,
            isPreliminary: false, // Permanente prestasjoner
          } as Achievement;
        });

        console.log('[AchievementsView] Loaded permanent achievements:', transformed.length);

        // Hent foreløpige prestasjoner (kun for innloggede brukere med venner)
        let preliminaryAchievements: Achievement[] = [];
        console.log('[AchievementsView] Checking if should load preliminary - isLoggedIn:', isLoggedIn, 'userId:', userId);
        
        if (isLoggedIn && userId) {
          try {
            console.log('[AchievementsView] ✅ Fetching preliminary achievements for userId:', userId);
            
            // Hent kun daglige foreløpige prestasjoner (for å unngå duplikater)
            // Brukere kan ha samme rank for day/week/month, som vil gi samme emoji flere ganger
            const dailyPreliminary = await getPreliminaryAchievements(userId, 'day');

            console.log('[AchievementsView] ✅ Preliminary achievements received:', {
              daily: dailyPreliminary,
            });

            // Bruk kun daglige foreløpige prestasjoner og dedupliser
            const allPreliminaryEmojis = Array.isArray(dailyPreliminary) 
              ? dailyPreliminary
                  .filter((emoji): emoji is string => {
                    const isValid = typeof emoji === 'string' && emoji.trim() !== '' && emoji.length > 0;
                    if (!isValid) {
                      console.log('[AchievementsView] Filtered out invalid emoji:', emoji, 'Type:', typeof emoji);
                    }
                    return isValid;
                  })
                  // Dedupliser: bare beholde første forekomst av hver emoji
                  .filter((emoji, index, array) => array.indexOf(emoji) === index)
              : []; // Filtrer ut tomme strenger og ugyldige verdier

            console.log('[AchievementsView] ✅ All preliminary emojis (filtered and deduplicated):', allPreliminaryEmojis, 'Count:', allPreliminaryEmojis.length);

            // Hent achievement types for foreløpige prestasjoner
            const emojiToName: { [key: string]: string } = {
              '🥇': translate('screens.achievements.dailyGold', language),
              '🥈': translate('screens.achievements.dailySilver', language),
              '🥉': translate('screens.achievements.dailyBronze', language),
              '🏆': translate('screens.achievements.weeklyWinner', language),
              '👑': translate('screens.achievements.monthlyWinner', language),
            };

            const emojiToDescription: { [key: string]: string } = {
              '🥇': translate('screens.achievements.firstPlaceTodayPreliminary', language),
              '🥈': translate('screens.achievements.secondPlaceTodayPreliminary', language),
              '🥉': translate('screens.achievements.thirdPlaceTodayPreliminary', language),
              '🏆': translate('screens.achievements.firstPlaceThisWeekPreliminary', language),
              '👑': translate('screens.achievements.firstPlaceThisMonthPreliminary', language),
            };

            // Lag foreløpige prestasjoner
            // VIKTIG: Foreløpige prestasjoner skal vises basert på nåværende ranking,
            // selv om brukeren allerede har fått permanente prestasjoner fra tidligere perioder.
            // De skal vises med "foreløpig" styling for å indikere at de kan mistes.
            
            console.log('[AchievementsView] Creating preliminary achievements - will show ALL regardless of permanent achievements');
            
            preliminaryAchievements = allPreliminaryEmojis.map((emoji, index) => {
              const achievement = {
                id: `preliminary_${emoji}_${Date.now()}_${index}`,
                emoji: emoji,
                name: emojiToName[emoji] || translate('screens.achievements.preliminaryAchievement', language),
                description: emojiToDescription[emoji] || null,
                category: 'competition',
                count: 1,
                first_earned_at: new Date().toISOString(),
                last_earned_at: new Date().toISOString(),
                isPreliminary: true, // Marker som foreløpig
              };
              console.log('[AchievementsView] Created preliminary achievement:', achievement);
              return achievement;
            });
            
            console.log('[AchievementsView] ✅ Final preliminary achievements:', preliminaryAchievements, 'Count:', preliminaryAchievements.length);
          } catch (err) {
            console.error('[AchievementsView] ❌ Error loading preliminary achievements:', err);
            console.error('[AchievementsView] Error stack:', err instanceof Error ? err.stack : 'No stack');
            // Fortsett med permanente prestasjoner selv om foreløpige feiler
          }
        } else {
          console.log('[AchievementsView] ⚠️ Skipping preliminary achievements - isLoggedIn:', isLoggedIn, 'userId:', userId);
        }

        // Kombiner permanente og foreløpige prestasjoner
        const allAchievements = [...transformed, ...preliminaryAchievements];
        console.log('[AchievementsView] ✅ Setting achievements - total:', allAchievements.length, 'permanent:', transformed.length, 'preliminary:', preliminaryAchievements.length);
        setAchievements(allAchievements);
      }
    } catch (err) {
      console.error('[AchievementsView] ❌ Error in loadAchievements:', err);
      console.error('[AchievementsView] Error stack:', err instanceof Error ? err.stack : 'No stack');
      setError(translate('common.error', language));
    } finally {
      setLoading(false);
    }
  }, [userId, isLoggedIn, language]); // Only depend on language, not on maps (we use translate directly)

  // Load achievements when dependencies change
  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  // Oppdater foreløpige prestasjoner hvert 30. sekund for å vise nåværende ranking
  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    const interval = setInterval(() => {
      loadAchievements(); // Reload for å oppdatere foreløpige prestasjoner
    }, 30000); // Hvert 30. sekund

    return () => clearInterval(interval);
  }, [userId, isLoggedIn, loadAchievements]);

  // Filtrer prestasjoner for visning (foreløpige har prioritet over permanente med samme emoji)
  const getDisplayedAchievements = () => {
    return achievements.filter(achievement => {
      // For foreløpige prestasjoner, vis dem alltid
      if (achievement.isPreliminary) {
        return true;
      }
      // For permanente prestasjoner, vis dem kun hvis det ikke finnes en foreløpig med samme emoji
      const hasPreliminary = achievements.some(a => 
        a.isPreliminary && a.emoji === achievement.emoji
      );
      return !hasPreliminary;
    });
  };

  // Alle prestasjoner for modal (uten kategorifiltrering)
  const getAllAchievementsForModal = () => {
    return achievements.filter(achievement => {
      // For foreløpige prestasjoner, vis dem alltid
      if (achievement.isPreliminary) {
        return true;
      }
      // For permanente prestasjoner, vis dem kun hvis det ikke finnes en foreløpig med samme emoji
      const hasPreliminary = achievements.some(a => 
        a.isPreliminary && a.emoji === achievement.emoji
      );
      return !hasPreliminary;
    });
  };


  if (loading) {
    return (
      <View style={styles.container}>
        {showTitle && <Text style={styles.title}>{t('screens.achievements.title')}</Text>}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {showTitle && <Text style={styles.title}>{t('screens.achievements.title')}</Text>}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const displayedAchievements = getDisplayedAchievements();

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.title}>{t('screens.achievements.title')}</Text>}
      
      {displayedAchievements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyText}>
            {t('screens.achievements.noAchievementsYet')}
          </Text>
          <Text style={styles.emptySubtext}>
            {t('screens.achievements.goOutAndWalk')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {displayedAchievements.length} {displayedAchievements.length === 1 ? t('screens.achievements.achievement') : t('screens.achievements.achievements')}
            </Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {displayedAchievements.map((achievement) => (
              <TouchableOpacity
                key={achievement.id}
                onPress={() => setShowAllModal(true)}
                activeOpacity={0.7}
              >
                <View 
                  style={[
                    styles.achievementCard,
                    achievement.isPreliminary && styles.achievementCardPreliminary
                  ]}
                >
                  <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                  <Text style={styles.achievementName} numberOfLines={2}>
                    {achievement.name}
                  </Text>
                  {achievement.isPreliminary && (
                    <Text style={styles.preliminaryBadge}>{t('screens.achievements.preliminary')}</Text>
                  )}
                  {!achievement.isPreliminary && achievement.count > 1 && (
                    <Text style={styles.achievementCount}>x{achievement.count}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Modal for å vise alle prestasjoner */}
      <Modal
        visible={showAllModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAllModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('screens.achievements.allAchievements')}</Text>
              <TouchableOpacity
                onPress={() => setShowAllModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Delt opp i I DAG (foreløpige) og TIDLIGERE (permanente) - translated below */}
            <ScrollView contentContainerStyle={styles.modalListContent}>
              {/* I dag */}
              <Text style={styles.sectionHeader}>{t('screens.achievements.today')}</Text>
              {achievements.filter(a => a.isPreliminary).length === 0 ? (
                <Text style={styles.sectionEmpty}>{t('screens.achievements.noPreliminaryYet')}</Text>
              ) : (
                achievements
                  .filter(a => a.isPreliminary)
                  .map(item => (
                    <View
                      key={item.id}
                      style={[
                        styles.modalAchievementItem,
                        item.isPreliminary && styles.modalAchievementItemPreliminary,
                      ]}
                    >
                      <Text style={styles.modalAchievementEmoji}>{item.emoji}</Text>
                      <View style={styles.modalAchievementInfo}>
                        <View style={styles.modalAchievementHeader}>
                          <Text style={styles.modalAchievementName}>{item.name}</Text>
                          <Text style={styles.modalPreliminaryBadge}>{t('screens.achievements.preliminary')}</Text>
                        </View>
                        {item.description && (
                          <Text style={styles.modalAchievementDescription}>{item.description}</Text>
                        )}
                      </View>
                    </View>
                  ))
              )}

              {/* Tidligere */}
              <Text style={[styles.sectionHeader, { marginTop: 16 }]}>{t('screens.achievements.previous')}</Text>
              {achievements.filter(a => !a.isPreliminary).length === 0 ? (
                <Text style={styles.sectionEmpty}>{t('screens.achievements.noAchievementsYet')}</Text>
              ) : (
                achievements
                  .filter(a => !a.isPreliminary)
                  .map(item => (
                    <View
                      key={item.id}
                      style={styles.modalAchievementItem}
                    >
                      <Text style={styles.modalAchievementEmoji}>{item.emoji}</Text>
                      <View style={styles.modalAchievementInfo}>
                        <View style={styles.modalAchievementHeader}>
                          <Text style={styles.modalAchievementName}>{item.name}</Text>
                        </View>
                        {item.description && (
                          <Text style={styles.modalAchievementDescription}>{item.description}</Text>
                        )}
                        {item.count > 1 && (
                          <Text style={styles.modalAchievementCountText}>{t('screens.achievements.earned')} {item.count} {t('screens.achievements.times')}</Text>
                        )}
                      </View>
                    </View>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  summaryContainer: {
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  scrollView: {
    marginBottom: 20,
  },
  scrollContent: {
    paddingRight: 20,
  },
  achievementCard: {
    width: 100,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  achievementCardPreliminary: {
    opacity: 0.7,
    borderColor: '#1ED760',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  achievementEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementCount: {
    fontSize: 10,
    color: '#1ED760',
    fontWeight: '600',
  },
  preliminaryBadge: {
    fontSize: 8,
    color: '#1ED760',
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  modalListContent: {
    padding: 20,
  },
  modalAchievementItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalAchievementItemPreliminary: {
    opacity: 0.7,
    borderColor: '#1ED760',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  modalAchievementEmoji: {
    fontSize: 32,
    marginRight: 15,
  },
  modalAchievementInfo: {
    flex: 1,
  },
  modalAchievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalAchievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalPreliminaryBadge: {
    fontSize: 10,
    color: '#1ED760',
    fontWeight: '600',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  modalAchievementDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalAchievementCountText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  // Sections in modal
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    opacity: 0.8,
  },
  sectionEmpty: {
    fontSize: 13,
    color: '#777',
    marginBottom: 8,
  },
});

