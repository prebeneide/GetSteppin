import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

interface StepDataEntry {
  date: string;
  steps: number;
  distance_meters: number;
}

interface StatisticsViewProps {
  userId?: string | null;
  isLoggedIn: boolean;
}

type Period = 'week' | 'month' | 'year';

export default function StatisticsView({ userId, isLoggedIn }: StatisticsViewProps) {
  const [period, setPeriod] = useState<Period>('week');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc.
  const [monthOffset, setMonthOffset] = useState(0); // 0 = this month, -1 = last month, etc.
  const [yearOffset, setYearOffset] = useState(0); // 0 = this year, -1 = last year, etc.
  const [stepData, setStepData] = useState<StepDataEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatistics();
  }, [period, userId, isLoggedIn, weekOffset, monthOffset, yearOffset]);

  const getDateRange = (periodType: Period) => {
    const today = new Date();
    const endDate = new Date();
    const startDate = new Date();
    
    switch (periodType) {
      case 'week': {
        // Get Monday of the current week
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Monday = 1, Sunday = 0
        
        // Calculate start (Monday) and end (Sunday) of the week
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday + (weekOffset * 7));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        startDate.setTime(monday.getTime());
        endDate.setTime(sunday.getTime());
        break;
      }
      case 'month': {
        // Get start and end of the month (with offset)
        const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
        
        startDate.setTime(targetMonth.getTime());
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setFullYear(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0); // Last day of month
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'year': {
        // Get start and end of the year (with offset)
        const targetYear = today.getFullYear() + yearOffset;
        
        startDate.setFullYear(targetYear, 0, 1); // January 1
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setFullYear(targetYear, 11, 31); // December 31
        endDate.setHours(23, 59, 59, 999);
        break;
      }
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  const loadStatistics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { start, end } = getDateRange(period);
      
      let query = supabase
        .from('step_data')
        .select('date, steps, distance_meters')
        .gte('date', start)
        .lte('date', end);

      if (isLoggedIn && userId) {
        // Logged in user - filter by user_id
        query = query.eq('user_id', userId);
      } else {
        // Anonymous user - filter by device_id
        const deviceId = await getDeviceId();
        query = query.eq('device_id', deviceId);
      }

      const { data, error: fetchError } = await query.order('date', { ascending: true });

      if (fetchError) {
        console.error('Error fetching statistics:', fetchError);
        setError('Kunne ikke laste statistikk');
      } else {
        setStepData(data || []);
      }
    } catch (err) {
      console.error('Error in loadStatistics:', err);
      setError('Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
      return 'I dag';
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      return 'I går';
    } else {
      if (period === 'week') {
        return date.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric' });
      } else if (period === 'month') {
        return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
      } else {
        return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
      }
    }
  };

  const getPeriodLabel = () => {
    const { start } = getDateRange(period);
    const startDate = new Date(start);
    
    if (period === 'week') {
      if (weekOffset === 0) {
        return 'Denne uken';
      } else if (weekOffset === -1) {
        return 'Forrige uke';
      } else {
        // Format: "Uke 1-7 jan"
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        return `${startDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`;
      }
    } else if (period === 'month') {
      return startDate.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
    } else {
      return startDate.getFullYear().toString();
    }
  };

  const calculateTotal = () => {
    return stepData.reduce((sum, entry) => sum + entry.steps, 0);
  };

  const calculateAverage = () => {
    if (stepData.length === 0) return 0;
    return Math.round(calculateTotal() / stepData.length);
  };

  const getMaxSteps = () => {
    if (stepData.length === 0) return 0;
    return Math.max(...stepData.map(e => e.steps));
  };

  // Group data by month for year view
  const groupByMonth = () => {
    const grouped: { [key: string]: { steps: number; distance: number; count: number } } = {};
    
    stepData.forEach(entry => {
      const date = new Date(entry.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = { steps: 0, distance: 0, count: 0 };
      }
      
      grouped[monthKey].steps += entry.steps;
      grouped[monthKey].distance += entry.distance_meters;
      grouped[monthKey].count += 1;
    });
    
    return Object.entries(grouped).map(([monthKey, data]) => ({
      month: monthKey,
      steps: data.steps,
      distance_meters: data.distance,
      averageSteps: Math.round(data.steps / data.count),
      count: data.count,
    })).sort((a, b) => a.month.localeCompare(b.month));
  };

  const renderBarChart = () => {
    if (stepData.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            Ingen data for denne perioden
          </Text>
        </View>
      );
    }

    // For year view, show monthly aggregates
    if (period === 'year') {
      const monthlyData = groupByMonth();
      const maxSteps = 30000; // Fast maksverdi for bedre visuell sammenligning
      const chartHeight = 150;

      return (
        <View style={styles.chartContainer}>
          {monthlyData.map((monthData) => {
            const barHeight = maxSteps > 0 ? (monthData.steps / maxSteps) * chartHeight : 0;
            const [year, month] = monthData.month.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('nb-NO', { month: 'short' });
            
            return (
              <View key={monthData.month} style={[styles.barWrapper, styles.barWrapperMonth]}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      styles.barMonth,
                      { height: barHeight },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {monthName}
                </Text>
                <Text style={styles.barValue}>{monthData.steps.toLocaleString()}</Text>
                <Text style={styles.barSubValue}>
                  {monthData.averageSteps.toLocaleString()} /dag
                </Text>
              </View>
            );
          })}
        </View>
      );
    }

    // For week and month, show daily data (smaller bars for month)
    const maxSteps = 30000; // Fast maksverdi for bedre visuell sammenligning
    const chartHeight = 150;
    const isMonthView = period === 'month';

    return (
      <View style={styles.chartContainer}>
        {stepData.map((entry, index) => {
          const barHeight = maxSteps > 0 ? (entry.steps / maxSteps) * chartHeight : 0;
          const isToday = entry.date === new Date().toISOString().split('T')[0];
          
          return (
            <View key={entry.date} style={[
              styles.barWrapper,
              isMonthView && styles.barWrapperMonth
            ]}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    isMonthView && styles.barMonth,
                    { height: barHeight },
                    isToday && styles.barToday,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isMonthView && styles.barLabelMonth]} numberOfLines={1}>
                {formatDate(entry.date)}
              </Text>
              {!isMonthView && (
                <Text style={styles.barValue}>{entry.steps.toLocaleString()}</Text>
              )}
              {isMonthView && (
                <Text style={[styles.barValue, styles.barValueMonth]} numberOfLines={1}>
                  {entry.steps.toLocaleString()}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Statistikk</Text>
        
        {/* Period Navigation */}
        <View style={styles.periodNavigation}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => {
              if (period === 'week') {
                setWeekOffset(weekOffset - 1);
              } else if (period === 'month') {
                setMonthOffset(monthOffset - 1);
              } else {
                setYearOffset(yearOffset - 1);
              }
            }}
            disabled={loading}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          
          <Text style={styles.periodLabel}>{getPeriodLabel()}</Text>
          
          <TouchableOpacity
            style={[styles.navButton, (period === 'week' && weekOffset >= 0) || 
                                     (period === 'month' && monthOffset >= 0) ||
                                     (period === 'year' && yearOffset >= 0) ? styles.navButtonDisabled : null]}
            onPress={() => {
              if (period === 'week') {
                if (weekOffset < 0) setWeekOffset(weekOffset + 1);
              } else if (period === 'month') {
                if (monthOffset < 0) setMonthOffset(monthOffset + 1);
              } else {
                if (yearOffset < 0) setYearOffset(yearOffset + 1);
              }
            }}
            disabled={loading || (period === 'week' && weekOffset >= 0) || 
                                 (period === 'month' && monthOffset >= 0) ||
                                 (period === 'year' && yearOffset >= 0)}
          >
            <Text style={[styles.navButtonText, (period === 'week' && weekOffset >= 0) || 
                                                   (period === 'month' && monthOffset >= 0) ||
                                                   (period === 'year' && yearOffset >= 0) ? styles.navButtonTextDisabled : null]}>
              →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Period Type Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('week');
              setWeekOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}>
              Uke
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('month');
              setMonthOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
              Måned
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('year');
              setYearOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'year' && styles.periodButtonTextActive]}>
              År
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Totalt</Text>
              <Text style={styles.summaryValue}>
                {calculateTotal().toLocaleString()}
              </Text>
              <Text style={styles.summaryUnit}>skritt</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Gjennomsnitt</Text>
              <Text style={styles.summaryValue}>
                {calculateAverage().toLocaleString()}
              </Text>
              <Text style={styles.summaryUnit}>skritt/dag</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Maksimum</Text>
              <Text style={styles.summaryValue}>
                {getMaxSteps().toLocaleString()}
              </Text>
              <Text style={styles.summaryUnit}>skritt</Text>
            </View>
          </View>

          {/* Bar Chart */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
            {renderBarChart()}
          </ScrollView>

          {/* Daily/Monthly List */}
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>
              {period === 'year' ? 'Månedlig oversikt' : 'Daglig oversikt'}
            </Text>
            {stepData.length === 0 ? (
              <Text style={styles.noDataText}>Ingen data tilgjengelig</Text>
            ) : period === 'year' ? (
              // Show monthly data for year view
              groupByMonth().map((monthData) => {
                const [year, month] = monthData.month.split('-');
                const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
                return (
                  <View key={monthData.month} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemDate}>{monthName}</Text>
                      <Text style={styles.listItemDistance}>
                        {(monthData.distance_meters / 1000).toFixed(2)} km totalt
                      </Text>
                      <Text style={styles.listItemDistance}>
                        Gjennomsnitt: {monthData.averageSteps.toLocaleString()} skritt/dag
                      </Text>
                    </View>
                    <Text style={styles.listItemSteps}>
                      {monthData.steps.toLocaleString()} skritt
                    </Text>
                  </View>
                );
              })
            ) : (
              // Show daily data for week and month views
              stepData.map((entry) => (
                <View key={entry.date} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemDate}>{formatDate(entry.date)}</Text>
                    <Text style={styles.listItemDistance}>
                      {(entry.distance_meters / 1000).toFixed(2)} km
                    </Text>
                  </View>
                  <Text style={styles.listItemSteps}>
                    {entry.steps.toLocaleString()} skritt
                  </Text>
                </View>
              ))
            )}
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
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    minHeight: 100, // Ensure it has some height
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  periodNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#1ED760',
    borderColor: '#1ED760',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  summaryContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1ED760',
    marginBottom: 2,
  },
  summaryUnit: {
    fontSize: 10,
    color: '#999',
  },
  scrollView: {
    marginBottom: 20,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    paddingHorizontal: 10,
    gap: 8,
  },
  barWrapper: {
    alignItems: 'center',
    minWidth: 50,
  },
  barWrapperMonth: {
    minWidth: 35, // Smaller for month view
  },
  barContainer: {
    height: 150,
    width: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 30,
    backgroundColor: '#1ED760',
    borderRadius: 4,
    minHeight: 2,
  },
  barMonth: {
    width: 20, // Narrower bars for month/year view
  },
  barToday: {
    backgroundColor: '#2196F3',
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  barLabelMonth: {
    fontSize: 8, // Smaller text for month view
  },
  barValue: {
    fontSize: 9,
    color: '#333',
    fontWeight: '600',
    marginTop: 2,
  },
  barValueMonth: {
    fontSize: 8, // Smaller text for month view
  },
  barSubValue: {
    fontSize: 7,
    color: '#999',
    marginTop: 1,
    textAlign: 'center',
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    color: '#999',
    fontSize: 14,
  },
  listContainer: {
    marginTop: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  listItemLeft: {
    flex: 1,
  },
  listItemDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  listItemDistance: {
    fontSize: 12,
    color: '#666',
  },
  listItemSteps: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1ED760',
  },
});

