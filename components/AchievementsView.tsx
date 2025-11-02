import React, { useState, useEffect } from 'react';
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
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);

  useEffect(() => {
    loadAchievements();
  }, [userId, isLoggedIn]);

  // Oppdater foreløpige prestasjoner hvert 30. sekund for å vise nåværende ranking
  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    const interval = setInterval(() => {
      loadAchievements(); // Reload for å oppdatere foreløpige prestasjoner
    }, 30000); // Hvert 30. sekund

    return () => clearInterval(interval);
  }, [userId, isLoggedIn]);

  const loadAchievements = async () => {
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
        setError('Kunne ikke laste prestasjoner');
      } else {
        // Transform the data to flatten achievement_types
        const transformed = (data || []).map((item: any) => ({
          id: item.id,
          emoji: item.achievement_types?.emoji || '',
          name: item.achievement_types?.name || '',
          description: item.achievement_types?.description || null,
          category: item.achievement_types?.category || '',
          count: item.count || 1,
          first_earned_at: item.first_earned_at,
          last_earned_at: item.last_earned_at,
          isPreliminary: false, // Permanente prestasjoner
        }));

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
              '🥇': 'Dagens gull',
              '🥈': 'Dagens sølv',
              '🥉': 'Dagens bronse',
              '🏆': 'Ukesvinner',
              '👑': 'Månedens vinner',
            };

            const emojiToDescription: { [key: string]: string } = {
              '🥇': '1. plass blant venner i dag (foreløpig)',
              '🥈': '2. plass blant venner i dag (foreløpig)',
              '🥉': '3. plass blant venner i dag (foreløpig)',
              '🏆': '1. plass blant venner denne uken (foreløpig)',
              '👑': '1. plass blant venner denne måneden (foreløpig)',
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
                name: emojiToName[emoji] || 'Foreløpig prestasjon',
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
      setError('Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

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
        {showTitle && <Text style={styles.title}>Prestasjoner</Text>}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {showTitle && <Text style={styles.title}>Prestasjoner</Text>}
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const displayedAchievements = getDisplayedAchievements();

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.title}>Prestasjoner</Text>}
      
      {displayedAchievements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyText}>
            Du har ikke oppnådd noen prestasjoner ennå
          </Text>
          <Text style={styles.emptySubtext}>
            Gå ut og gå for å samle emojis!
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {displayedAchievements.length} {displayedAchievements.length === 1 ? 'prestasjon' : 'prestasjoner'}
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
                    <Text style={styles.preliminaryBadge}>Foreløpig</Text>
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
              <Text style={styles.modalTitle}>Alle prestasjoner</Text>
              <TouchableOpacity
                onPress={() => setShowAllModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={getAllAchievementsForModal()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View 
                  style={[
                    styles.modalAchievementItem,
                    item.isPreliminary && styles.modalAchievementItemPreliminary
                  ]}
                >
                  <Text style={styles.modalAchievementEmoji}>{item.emoji}</Text>
                  <View style={styles.modalAchievementInfo}>
                    <View style={styles.modalAchievementHeader}>
                      <Text style={styles.modalAchievementName}>{item.name}</Text>
                      {item.isPreliminary && (
                        <Text style={styles.modalPreliminaryBadge}>Foreløpig</Text>
                      )}
                    </View>
                    {item.description && (
                      <Text style={styles.modalAchievementDescription}>
                        {item.description}
                      </Text>
                    )}
                    {!item.isPreliminary && item.count > 1 && (
                      <Text style={styles.modalAchievementCountText}>
                        Oppnådd {item.count} ganger
                      </Text>
                    )}
                  </View>
                </View>
              )}
              contentContainerStyle={styles.modalListContent}
            />
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
});

