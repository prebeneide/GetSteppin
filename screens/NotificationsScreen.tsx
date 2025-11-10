import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from '../services/notificationService';
import { useTranslation } from '../lib/i18n';

interface NotificationsScreenProps {
  navigation: any;
}

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadNotifications();
      }
    }, [user])
  );

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await getNotifications(user.id);

      if (error) {
        console.error('Error loading notifications:', error);
      } else {
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Error in loadNotifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.read_at) {
      await markNotificationAsRead(notification.id);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
    }

    // Only navigate to post if it's a social notification (has post_id)
    // Activity notifications don't have post_id, so they don't navigate anywhere
    if (notification.post_id && ['like', 'comment', 'reply', 'comment_like'].includes(notification.type)) {
      navigation.navigate('PostDetail', { postId: notification.post_id });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    const { error } = await markAllNotificationsAsRead(user.id);
    if (error) {
      console.error('Error marking all as read:', error);
    } else {
      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('screens.notifications.now');
    if (diffMins < 60) return `${diffMins}${t('screens.notifications.minutesAgo')}`;
    if (diffHours < 24) return `${diffHours}${t('screens.notifications.hoursAgo')}`;
    if (diffDays < 7) return `${diffDays}${t('screens.notifications.daysAgo')}`;

    const locale = language === 'en' ? 'en-US' : 'nb-NO';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>{t('common.backArrow')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>{t('screens.notifications.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>{t('common.backArrow')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('screens.notifications.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('screens.notifications.title')}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllReadText}>{t('screens.notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={styles.headerSpacer} />}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('screens.notifications.empty')}</Text>
            <Text style={styles.emptySubtext}>
              {t('screens.notifications.emptySubtext')}
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read_at && styles.notificationCardUnread,
              ]}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.notificationContent}>
                {/* Icon for activity notifications, avatar for social notifications */}
                {['weekly_average', 'top_percentage', 'goal_streak', 'weekly_goal'].includes(notification.type) ? (
                  <View style={styles.activityIconContainer}>
                    <Text style={styles.activityIcon}>
                      {notification.type === 'weekly_average' ? '📈' :
                       notification.type === 'top_percentage' ? '🏆' :
                       notification.type === 'goal_streak' ? '✅' :
                       notification.type === 'weekly_goal' ? '✅' : '📊'}
                    </Text>
                  </View>
                ) : notification.actor_avatar_url ? (
                  <Image
                    source={{ uri: notification.actor_avatar_url }}
                    style={styles.actorAvatar}
                  />
                ) : (
                  <View style={styles.actorAvatarPlaceholder}>
                    <Text style={styles.actorAvatarText}>
                      {notification.actor_username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.notificationTextContainer}>
                  <Text style={styles.notificationText}>
                    {/* Activity notifications */}
                    {notification.type === 'weekly_average' && notification.metadata?.weekly_average ? (
                      <>
                        {language === 'en'
                          ? `You walked on avg ${notification.metadata.weekly_average.avg_steps.toLocaleString()} steps per day last week. ${Math.abs(notification.metadata.weekly_average.difference).toLocaleString()} daily steps ${notification.metadata.weekly_average.difference >= 0 ? 'more' : 'less'} than the week before.`
                          : `Du gikk i gjennomsnitt ${notification.metadata.weekly_average.avg_steps.toLocaleString()} skritt per dag forrige uke. ${Math.abs(notification.metadata.weekly_average.difference).toLocaleString()} daglige skritt ${notification.metadata.weekly_average.difference >= 0 ? 'mer' : 'mindre'} enn uken før.`}
                      </>
                    ) : notification.type === 'top_percentage' && notification.metadata?.top_percentage ? (
                      <>
                        {language === 'en'
                          ? `Wow! You were in the top ${notification.metadata.top_percentage.global_percentage}% of all GetSteppin users${notification.metadata.top_percentage.country_percentage ? ` and top ${notification.metadata.top_percentage.country_percentage}% in ${notification.metadata.top_percentage.country || 'your country'}` : ''} with ${notification.metadata.top_percentage.steps.toLocaleString()} steps yesterday!`
                          : `Wow! Du var i topp ${notification.metadata.top_percentage.global_percentage}% av alle GetSteppin-brukere${notification.metadata.top_percentage.country_percentage ? ` og topp ${notification.metadata.top_percentage.country_percentage}% i ${notification.metadata.top_percentage.country || 'ditt land'}` : ''} med ${notification.metadata.top_percentage.steps.toLocaleString()} skritt i går!`}
                      </>
                    ) : notification.type === 'goal_streak' && notification.metadata?.goal_streak ? (
                      <>
                        {language === 'en'
                          ? `Nailed it! You're on a ${notification.metadata.goal_streak.streak_days} day streak for your goal of ${notification.metadata.goal_streak.goal.toLocaleString()} steps!`
                          : `Nailed it! Du er på en ${notification.metadata.goal_streak.streak_days} dagers streak for målet ditt på ${notification.metadata.goal_streak.goal.toLocaleString()} skritt!`}
                      </>
                    ) : notification.type === 'weekly_goal' && notification.metadata?.weekly_goal ? (
                      <>
                        {language === 'en'
                          ? `Nice! You walked on avg ${notification.metadata.weekly_goal.avg_steps.toLocaleString()} steps per day last week. ${notification.metadata.weekly_goal.difference.toLocaleString()} daily steps more than your goal.`
                          : `Nice! Du gikk i gjennomsnitt ${notification.metadata.weekly_goal.avg_steps.toLocaleString()} skritt per dag forrige uke. ${notification.metadata.weekly_goal.difference.toLocaleString()} daglige skritt mer enn målet ditt.`}
                      </>
                    ) : notification.type === 'reply' && notification.reply_count && notification.reply_count > 1 ? (
                      <>
                        <Text style={styles.actorName}>
                          {notification.recent_actors && notification.recent_actors.length > 0
                            ? notification.recent_actors[0].actor_username || t('screens.notifications.someone')
                            : notification.actor_username || t('screens.notifications.someone')}
                        </Text>
                        {notification.reply_count > 2 && notification.recent_actors && notification.recent_actors.length > 1 && (
                          <>
                            {' '}{t('screens.notifications.and')}{' '}
                            <Text style={styles.actorName}>
                              {notification.reply_count - 1} {t('screens.notifications.others')}
                            </Text>
                          </>
                        )}
                        {notification.reply_count === 2 && notification.recent_actors && notification.recent_actors.length > 1 && (
                          <>
                            {' '}{t('screens.notifications.and')}{' '}
                            <Text style={styles.actorName}>
                              {notification.recent_actors[1].actor_username}
                            </Text>
                          </>
                        )}
                        {` ${t('screens.notifications.commentedOnYourComment')}`}
                      </>
                    ) : notification.type === 'reply' ? (
                      <>
                        <Text style={styles.actorName}>
                          {notification.actor_username || t('screens.notifications.someone')}
                        </Text>
                        {` ${t('screens.notifications.commentedOnYourComment')}`}
                      </>
                    ) : notification.type === 'comment_like' ? (
                      <>
                        <Text style={styles.actorName}>
                          {notification.actor_username || t('screens.notifications.someone')}
                        </Text>
                        {` ${t('screens.notifications.likedYourComment')}`}
                      </>
                    ) : (
                      <>
                        <Text style={styles.actorName}>
                          {notification.actor_username || t('screens.notifications.someone')}
                        </Text>
                        {' '}
                        {notification.type === 'like' ? t('screens.notifications.liked') : t('screens.notifications.commentedOn')}
                        {' '}{t('screens.notifications.yourPost')}
                      </>
                    )}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {formatTime(notification.created_at)}
                  </Text>
                </View>
                {!notification.read_at && (
                  <View style={styles.unreadDot} />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButtonText: {
    fontSize: 16,
    color: '#1ED760',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 70,
  },
  markAllReadText: {
    fontSize: 14,
    color: '#1ED760',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  loginPrompt: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  notificationCard: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  notificationCardUnread: {
    backgroundColor: '#f8f9fa',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  actorAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actorAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  activityIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIcon: {
    fontSize: 24,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  actorName: {
    fontWeight: '600',
    color: '#333',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1ED760',
    marginLeft: 8,
  },
});

