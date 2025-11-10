/**
 * Simple i18n implementation for GetSteppin
 * Supports Norwegian (nb) and English (en)
 */

import React from 'react';
import { getUserPreferences } from './userPreferences';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// Import translations dynamically to avoid JSON import issues
const nbTranslations = require('../locales/nb/translations.json');
const enTranslations = require('../locales/en/translations.json');

export type Language = 'nb' | 'en';

export interface Translations {
  common: {
    back: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    loading: string;
      error: string;
      success: string;
      permissionRequired: string;
      imagePermissionMessage: string;
    };
  settings: {
    title: string;
    dailyGoal: string;
    changePassword: string;
    display: string;
    distanceUnit: string;
    distanceUnitDescription: string;
    language: string;
    languageDescription: string;
    walkSharing: string;
    enableWalkTracking: string;
    enableWalkTrackingDescription: string;
    autoShareWalks: string;
    autoShareWalksDescription: string;
    enableGPSFirst: string;
    homeArea: string;
    homeAreaDescription: string;
    setCurrentLocation: string;
    homeAreaSet: string;
    homeAreaRadius: string;
    homeAreaRadiusDescription: string;
    diameter: string;
    walkCriteria: string;
    walkCriteriaDescription: string;
    minimumDistance: string;
    minimumDistanceDescription: string;
    minimumSpeed: string;
    minimumSpeedDescription: string;
    maximumSpeed: string;
    maximumSpeedDescription: string;
    pauseDetection: string;
    pauseDetectionDescription: string;
    pauseTolerance: string;
    pauseToleranceDescription: string;
    minutes: string;
    pauseRadius: string;
    pauseRadiusDescription: string;
    saveSettings: string;
    settingsSaved: string;
    couldNotLoadSettings: string;
    couldNotUpdateSettings: string;
    couldNotUpdateSettingsPlural: string;
    couldNotUpdateLanguage: string;
    languageChangedToNorwegian: string;
    languageChangedToEnglish: string;
    couldNotUpdateDistanceUnit: string;
    distanceUnitChangedToKm: string;
    distanceUnitChangedToMiles: string;
    locationAccessRequired: string;
    locationAccessRequiredMessage: string;
    locationAccessRequiredForHome: string;
    homeAreaSetToCurrentLocation: string;
    couldNotGetCurrentLocation: string;
    gpsTrackingActivated: string;
    expoGoInfo: string;
    expoGoMessage: string;
    cancel: string;
    openSettings: string;
    backgroundAccessRequired: string;
  };
  distance: {
    km: string;
    mi: string;
    total: string;
  };
  walk: {
    distance: string;
    duration: string;
    averageSpeed: string;
    maxSpeed: string;
    steps: string;
    walk: string;
    shared: string;
    notShared: string;
  };
  navigation: {
    home: string;
    myWalks: string;
    feed: string;
    messages: string;
    friends: string;
  };
  screens: {
    feed: {
      title: string;
      empty: string;
      emptySubtext: string;
      loginPrompt: string;
      now: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
    };
    myWalks: {
      title: string;
      empty: string;
      emptySubtext: string;
    };
    friends: {
      title: string;
      empty: string;
      emptySubtext: string;
      addFriend: string;
      friendRequests: string;
      noRequests: string;
      couldNotAccept: string;
      couldNotDecline: string;
      somethingWentWrong: string;
    };
    messages: {
      title: string;
      empty: string;
      emptySubtext: string;
      loginPrompt: string;
    };
    notifications: {
      title: string;
      empty: string;
      emptySubtext: string;
      markAllRead: string;
      loginPrompt: string;
      commentedOnYourComment: string;
      likedYourComment: string;
      now: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
      liked: string;
      commentedOn: string;
      yourPost: string;
      someone: string;
      and: string;
      others: string;
    };
    home: {
      title: string;
      welcome: string;
      today: string;
      goal: string;
      noGoal: string;
      setGoal: string;
      steps: string;
      distance: string;
      total: string;
      statistics: string;
      achievements: string;
      friendsActivity: string;
      trackingActive: string;
      trackingWaiting: string;
      trackingPermission: string;
      gpsNotActivated: string;
      starting: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
      completed: string;
      remaining: string;
      saving: string;
      startingStepCounter: string;
      login: string;
      createAccount: string;
    };
    profile: {
      title: string;
      editProfile: string;
      totalDistance: string;
      totalSteps: string;
      friends: string;
      achievements: string;
      userInfo: string;
      username: string;
      fullName: string;
      email: string;
      dailyGoal: string;
      notSet: string;
      notLoggedIn: string;
      profilePicture: string;
      uploaded: string;
      uploading: string;
      changePhoto: string;
      uploadPhoto: string;
      bio: string;
      edit: string;
      bioPlaceholder: string;
      bioEmpty: string;
      charCount: string;
      cancel: string;
      save: string;
      logout: string;
    };
    walkDetail: {
      title: string;
      edit: string;
      editPost: string;
      shareWalk: string;
      delete: string;
      deleteConfirm: string;
      date: string;
      startTime: string;
      endTime: string;
      route: string;
      information: string;
      images: string;
      imagesSubtitle: string;
      map: string;
      primaryImage: string;
      addImages: string;
      addMoreImages: string;
      addMap: string;
      descriptionPlaceholder: string;
      displaySettings: string;
      duration: string;
      averageSpeed: string;
      maxSpeed: string;
      postPublic: string;
      save: string;
      share: string;
      cancel: string;
      yes: string;
      no: string;
      hidden: string;
      uploadingImages: string;
      postUpdated: string;
      walkShared: string;
    };
    postDetail: {
      title: string;
      couldNotLoadPost: string;
      comments: string;
      writeComment: string;
      noComments: string;
      deleteComment: string;
      deleteCommentConfirm: string;
      reply: string;
      couldNotAddComment: string;
      couldNotDeleteComment: string;
      couldNotLikeComment: string;
      personLiked: string;
      peopleLiked: string;
      now: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
    };
    chat: {
      typeMessage: string;
      loginPrompt: string;
    };
    friendProfile: {
      title: string;
      totalDistance: string;
      friends: string;
      addFriend: string;
      removeFriend: string;
      sendMessage: string;
      compare: string;
    };
    login: {
      title: string;
      email: string;
      password: string;
      loginButton: string;
      signUpPrompt: string;
      signUpLink: string;
    };
    signUp: {
      title: string;
      subtitle: string;
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
      signUpButton: string;
      loginPrompt: string;
      loginLink: string;
      usernameRequired: string;
      usernameMinLength: string;
      usernameInvalid: string;
      emailRequired: string;
      emailInvalid: string;
      passwordRequired: string;
      passwordMinLength: string;
    };
    addFriend: {
      title: string;
      search: string;
      searchButton: string;
      noResults: string;
      searchPrompt: string;
      loginPrompt: string;
      sendRequest: string;
      requestSent: string;
      waitingForResponse: string;
      alreadyFriends: string;
    };
    goalSettings: {
      title: string;
      setYourGoal: string;
      howManySteps: string;
      example: string;
      stepsPerDay: string;
      quickSelection: string;
      saving: string;
      saveGoal: string;
      couldNotSave: string;
      goalUpdated: string;
      somethingWentWrong: string;
      pleaseEnterNumber: string;
      minimum1000: string;
      maximum100000: string;
    };
    passwordSettings: {
      title: string;
      setNewPassword: string;
      enterCurrentAndNew: string;
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
      changing: string;
      changePassword: string;
      mustBeLoggedIn: string;
      couldNotGetUserInfo: string;
      currentPasswordWrong: string;
      couldNotChangePassword: string;
      passwordUpdated: string;
      passwordRequired: string;
      passwordMinLength: string;
      confirmPasswordRequired: string;
      passwordsDoNotMatch: string;
    };
    statistics: {
      title: string;
      yesterday: string;
      today: string;
      monthlyOverview: string;
      dailyOverview: string;
      noDataAvailable: string;
      lastWeek: string;
      thisWeek: string;
      week: string;
      month: string;
      year: string;
      total: string;
      average: string;
      maximum: string;
      steps: string;
      stepsPerDay: string;
      noDataForPeriod: string;
    };
    likesModal: {
      title: string;
      now: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
      noLikesYet: string;
    };
    achievements: {
      dailyGold: string;
      dailyGoldPermanent: string;
      dailySilver: string;
      dailySilverPermanent: string;
      dailyBronze: string;
      dailyBronzePermanent: string;
      weeklyWinner: string;
      monthlyWinner: string;
      firstPlaceYesterday: string;
      secondPlaceYesterday: string;
      thirdPlaceYesterday: string;
      firstPlaceLastWeek: string;
      firstPlaceLastMonth: string;
      firstPlaceTodayPreliminary: string;
      secondPlaceTodayPreliminary: string;
      thirdPlaceTodayPreliminary: string;
      firstPlaceThisWeekPreliminary: string;
      firstPlaceThisMonthPreliminary: string;
      lastEarned: string;
      preliminaryAchievement: string;
      title: string;
      couldNotLoad: string;
      noAchievementsYet: string;
      goOutAndWalk: string;
      achievement: string;
      achievements: string;
      allAchievements: string;
      today: string;
      noPreliminaryYet: string;
      previous: string;
      preliminary: string;
      earned: string;
      times: string;
      cherry: string;
      cherryDescription: string;
      peach: string;
      peachDescription: string;
      milestone: string;
      milestoneDescription: string;
      dailyGoal: string;
      dailyGoalDescription: string;
      top5Percent: string;
      top5PercentDescription: string;
      streak: string;
      streakDescription: string;
      teamplayer: string;
      teamplayerDescription: string;
      rocket: string;
      rocketDescription: string;
      hundred: string;
      hundredDescription: string;
      party: string;
      partyDescription: string;
      nightOwl: string;
      nightOwlDescription: string;
      earlyBird: string;
      earlyBirdDescription: string;
      surprise: string;
      surpriseDescription: string;
      run5km: string;
      run5kmDescription: string;
      run10km: string;
      run10kmDescription: string;
      halfMarathon: string;
      halfMarathonDescription: string;
      marathon: string;
      marathonDescription: string;
    };
    friendsSteps: {
      title: string;
      friendsSteps: string;
      friendsStepsToday: string;
      today: string;
      thisWeek: string;
      couldNotLoad: string;
      addFriendsToSee: string;
      youAreIn: string;
      place: string;
      day: string;
      week: string;
      month: string;
      year: string;
      you: string;
    };
    onboarding: {
      welcomeTitle: string;
      welcomeText: string;
      motivationText: string;
      goalQuestion: string;
      goalHint: string;
      example: string;
      stepsPerDay: string;
      quickSelection: string;
      saving: string;
      startJourney: string;
      skipForNow: string;
      couldNotSave: string;
      somethingWentWrong: string;
      pleaseEnterNumber: string;
      minimum1000: string;
      maximum100000: string;
    };
  };
}

const translations: Record<Language, Translations> = {
  nb: nbTranslations as Translations,
  en: enTranslations as Translations,
};

let currentLanguage: Language = 'nb';

/**
 * Get translation for a key path
 * @param key - Translation key path (e.g., "common.back", "settings.title")
 * @param lang - Language code (optional, uses current language if not provided)
 * @returns Translated string or key if not found
 */
export const t = (key: string, lang?: Language): string => {
  const language = lang || currentLanguage;
  const keys = key.split('.');
  let value: any = translations[language];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k as keyof typeof value];
    } else {
      // Fallback to Norwegian if key not found
      value = translations.nb;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey as keyof typeof value];
        } else {
          return key; // Return key if not found even in fallback
        }
      }
      break;
    }
  }

  return typeof value === 'string' ? value : key;
};

/**
 * Set current language
 */
export const setLanguage = (lang: Language): void => {
  currentLanguage = lang;
};

/**
 * Get current language
 */
export const getLanguage = (): Language => {
  return currentLanguage;
};

// Language Context for sharing language state across all components
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  initialized: boolean;
  reloadLanguage: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Language Provider component
 * Manages language state globally and loads from user preferences
 */
export const LanguageProvider = ({ children, user }: { children: ReactNode; user: any }) => {
  const [language, setLanguageState] = useState<Language>('nb');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        // Always load language, whether user is logged in or not
        // For logged out users, this will load from device_settings
        // Add a delay when user becomes null to ensure device_settings is synced
        if (!user) {
          console.log('[LanguageProvider] User is null, waiting for device_settings sync...');
          await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay to 500ms
        }
        
        const preferences = await getUserPreferences(user?.id || null);
        const lang = (preferences.language || 'nb') as Language;
        console.log('[LanguageProvider] Loading language:', lang, 'user:', user?.id || 'null', 'preferences:', preferences);
        setLanguage(lang); // Update global currentLanguage
        setLanguageState(lang);
        setInitialized(true);
      } catch (err) {
        console.error('[LanguageProvider] Error loading language:', err);
        setInitialized(true);
      }
    };

    loadLanguage();
  }, [user]);
  
  // Reload language when it changes in database (e.g., from Settings screen)
  // This effect checks the database when user changes (including logout)
  useEffect(() => {
    if (!initialized) return; // Don't check until initial load is complete
    
    const checkLanguage = async () => {
      try {
        // Always check language, whether user is logged in or not
        const preferences = await getUserPreferences(user?.id || null);
        const lang = (preferences.language || 'nb') as Language;
        console.log('[LanguageProvider] Checking language:', lang, 'current:', language, 'user:', user?.id || 'null');
        if (lang !== language) {
          console.log('[LanguageProvider] Language changed from', language, 'to', lang);
          setLanguage(lang); // Update global currentLanguage
          setLanguageState(lang);
        }
      } catch (err) {
        console.error('[LanguageProvider] Error checking language:', err);
      }
    };
    
    // Check language when user changes (e.g., after login/logout)
    // This ensures that when user logs out, we reload language from device_settings
    checkLanguage();
  }, [user, initialized, language]);

  const updateLanguage = async (lang: Language) => {
    setLanguage(lang); // Update global currentLanguage
    setLanguageState(lang);
    // Update in database will be handled by SettingsScreen
  };
  
  // Update global currentLanguage whenever language state changes
  useEffect(() => {
    setLanguage(language);
  }, [language]);

  // Reload language function that can be called from SettingsScreen
  const reloadLanguage = async () => {
    try {
      const preferences = await getUserPreferences(user?.id || null);
      const lang = (preferences.language || 'nb') as Language;
      if (lang !== language) {
        setLanguage(lang); // Update global currentLanguage
        setLanguageState(lang);
      }
    } catch (err) {
      console.error('Error reloading language:', err);
    }
  };

  return React.createElement(
    LanguageContext.Provider,
    { value: { language, setLanguage: updateLanguage, initialized, reloadLanguage } },
    children
  );
};

/**
 * Hook to get translations and current language
 * Automatically loads user preferences
 * Note: This hook must be used inside a LanguageProvider
 */
export const useTranslation = () => {
  const context = useContext(LanguageContext);
  
  if (!context) {
    // Fallback for components outside LanguageProvider (shouldn't happen)
    const [language] = useState<Language>('nb');
    return {
      t: (key: string) => t(key, language),
      language,
      setLanguage: async (lang: Language) => {
        setLanguage(lang);
      },
      initialized: true,
      reloadLanguage: async () => {},
    };
  }

  const { language, setLanguage: updateLanguage, initialized, reloadLanguage } = context;

  return {
    t: (key: string) => t(key, language),
    language,
    setLanguage: updateLanguage,
    initialized,
    reloadLanguage,
  };
};

