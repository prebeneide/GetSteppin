import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string | null;
  category: string;
  count: number;
  first_earned_at: string;
  last_earned_at: string;
}

interface AchievementsViewProps {
  userId: string | null;
  isLoggedIn: boolean;
}

export default function AchievementsView({ userId, isLoggedIn }: AchievementsViewProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAchievements();
  }, [userId, isLoggedIn]);

  const loadAchievements = async () => {
    setLoading(true);
    setError(null);
    
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
        }));
        
        setAchievements(transformed);
      }
    } catch (err) {
      console.error('Error in loadAchievements:', err);
      setError('Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      distance: 'Distanse',
      goal: 'Mål',
      competition: 'Konkurranse',
      streak: 'Strek',
      social: 'Sosialt',
    };
    return categoryNames[category] || category;
  };

  const groupByCategory = () => {
    const grouped: { [key: string]: Achievement[] } = {};
    
    achievements.forEach(achievement => {
      const category = achievement.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(achievement);
    });
    
    return grouped;
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Prestasjoner</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Prestasjoner</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const groupedAchievements = groupByCategory();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prestasjoner</Text>
      
      {achievements.length === 0 ? (
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
              {achievements.length} {achievements.length === 1 ? 'prestasjon' : 'prestasjoner'}
            </Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {achievements.map((achievement) => (
              <View key={achievement.id} style={styles.achievementCard}>
                <Text style={styles.achievementEmoji}>{achievement.emoji}</Text>
                <Text style={styles.achievementName} numberOfLines={2}>
                  {achievement.name}
                </Text>
                {achievement.count > 1 && (
                  <Text style={styles.achievementCount}>x{achievement.count}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Grouped by category */}
          <View style={styles.categoriesContainer}>
            {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>
                  {getCategoryName(category)}
                </Text>
                <View style={styles.categoryAchievements}>
                  {categoryAchievements.map((achievement) => (
                    <View key={achievement.id} style={styles.achievementItem}>
                      <Text style={styles.achievementEmojiSmall}>{achievement.emoji}</Text>
                      <View style={styles.achievementInfo}>
                        <Text style={styles.achievementNameSmall}>{achievement.name}</Text>
                        {achievement.description && (
                          <Text style={styles.achievementDescription}>
                            {achievement.description}
                          </Text>
                        )}
                        {achievement.count > 1 && (
                          <Text style={styles.achievementCountText}>
                            Oppnådd {achievement.count} ganger
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
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
    color: '#4CAF50',
    fontWeight: '600',
  },
  categoriesContainer: {
    marginTop: 10,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoryAchievements: {
    gap: 10,
  },
  achievementItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  achievementEmojiSmall: {
    fontSize: 32,
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementNameSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  achievementCountText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

