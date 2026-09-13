import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { Client, Helper, JobSession, Settings, Language, ThemeMode } from '../types';
import { getDatabase, resetDatabase } from '../database/db';
import * as clientRepo from '../database/repositories/clientRepository';
import * as helperRepo from '../database/repositories/helperRepository';
import * as jobRepo from '../database/repositories/jobRepository';
import * as settingsRepo from '../database/repositories/settingsRepository';
import { calculateJobFinancials } from '../utils/calculations';
import { calculateLiveElapsedSeconds } from '../utils/timer';
import { sendWhatsAppInvoice } from '../utils/messaging';
import { openMapsRoute } from '../utils/navigation';
import { translations, TranslationKey } from '../i18n/translations';
import { getThemeColors, ThemeColors } from '../theme';

interface AppContextType {
  isReady: boolean;
  clients: Client[];
  helpers: Helper[];
  settings: Settings;
  refreshClients: () => Promise<void>;
  refreshHelpers: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;

  // Language & Theme
  language: Language;
  themeMode: ThemeMode;
  colors: ThemeColors;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;

  // Active Job & Timer
  activeJob: JobSession | null;
  activeClient: Client | null;
  selectedHelpers: Helper[];
  elapsedSeconds: number;
  isTimerRunning: boolean;
  isTimerPaused: boolean;
  isManualDuration: boolean;
  manualMinutes: number;
  billedPeopleCount: number;

  // Active Job Actions
  startJob: (job: JobSession, initialHelperIds?: number[]) => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  setBilledPeople: (count: number) => void;
  toggleHelperSelection: (helper: Helper) => void;
  setManualMinutesOverride: (minutes: number) => void;
  resetTimerToLive: () => void;
  finishCurrentJob: (notes?: string) => Promise<{ success: boolean; job?: JobSession }>;
  cancelActiveJob: () => Promise<void>;

  // Navigation & Communication
  openPostcodeInMaps: (postcode: string, name?: string) => Promise<void>;
  sendJobInvoiceWhatsApp: (job: JobSession) => Promise<boolean>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [settings, setSettings] = useState<Settings>({
    id: 1,
    business_name: 'CleanRoute Services',
    bank_sort_code: '20-00-00',
    bank_account_number: '12345678',
    bank_account_name: 'CleanRoute Ltd',
    currency_symbol: '£',
    language: 'pt',
    theme_mode: 'light',
  });

  // Language & Theme state
  const [language, setLanguageState] = useState<Language>('pt');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  // Active Job State
  const [activeJob, setActiveJob] = useState<JobSession | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [selectedHelpers, setSelectedHelpers] = useState<Helper[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isManualDuration, setIsManualDuration] = useState(false);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [billedPeopleCount, setBilledPeopleCount] = useState(1);

  // Time tracking refs
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedSecondsRef = useRef<number>(0);
  const pauseStartMsRef = useRef<number | null>(null);

  // Derived theme colors
  const colors = getThemeColors(themeMode);

  // Translation helper
  const t = useCallback(
    (key: TranslationKey): string => {
      const langDict = translations[language] || translations.pt;
      return langDict[key] || translations.pt[key] || (key as string);
    },
    [language]
  );

  // Synchronizes timer with wall-clock time
  const syncTimer = useCallback(() => {
    if (!activeJob?.start_time || isManualDuration) return;

    let totalPaused = pausedSecondsRef.current;
    if (isTimerPaused && pauseStartMsRef.current) {
      totalPaused += Math.floor((Date.now() - pauseStartMsRef.current) / 1000);
    }

    const live = calculateLiveElapsedSeconds(activeJob.start_time, totalPaused);
    setElapsedSeconds(live);
  }, [activeJob?.start_time, isManualDuration, isTimerPaused]);

  // Initialization
  const initialize = useCallback(async () => {
    try {
      await getDatabase(); // Ensure DB is opened and migrated
      const [loadedClients, loadedHelpers, loadedSettings, loadedActiveJob] = await Promise.all([
        clientRepo.getAllClients(),
        helperRepo.getAllHelpers(false),
        settingsRepo.getSettings(),
        jobRepo.getActiveJobSession(),
      ]);

      setClients(loadedClients);
      setHelpers(loadedHelpers);
      setSettings(loadedSettings);
      setLanguageState(loadedSettings.language || 'pt');
      setThemeModeState(loadedSettings.theme_mode || 'light');

      if (loadedActiveJob) {
        setActiveJob(loadedActiveJob);
        setBilledPeopleCount(loadedActiveJob.billed_people_count || 1);

        const client = loadedClients.find((c) => c.id === loadedActiveJob.client_id) || null;
        setActiveClient(client);

        // Resume resilient timer from SQLite start_time using wall-clock diff
        if (loadedActiveJob.start_time) {
          pausedSecondsRef.current = 0;
          pauseStartMsRef.current = null;
          const liveSeconds = calculateLiveElapsedSeconds(loadedActiveJob.start_time, 0);
          setElapsedSeconds(liveSeconds);
          setIsTimerRunning(true);
          setIsTimerPaused(false);
        }
      }

      setIsReady(true);
    } catch (err) {
      console.error('Failed to initialize AppContext:', err);
      Alert.alert('Database Error', 'Could not initialize offline database.');
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // AppState Listener: Resynchronize timer immediately when iPhone screen turns back on or app foregrounds!
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        syncTimer();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [syncTimer]);

  // Timer Tick Engine: ticks every second and recalculates from wall-clock time
  useEffect(() => {
    if (isTimerRunning && !isTimerPaused && !isManualDuration) {
      syncTimer();

      timerIntervalRef.current = setInterval(() => {
        syncTimer();
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, isTimerPaused, isManualDuration, syncTimer]);

  // Reload helpers & clients
  const refreshClients = async () => {
    const data = await clientRepo.getAllClients();
    setClients(data);
  };

  const refreshHelpers = async () => {
    const data = await helperRepo.getAllHelpers(false);
    setHelpers(data);
  };

  const refreshSettings = async () => {
    const data = await settingsRepo.getSettings();
    setSettings(data);
    setLanguageState(data.language || 'pt');
    setThemeModeState(data.theme_mode || 'light');
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    await settingsRepo.updateSettings(newSettings);
    await refreshSettings();
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await settingsRepo.updateSettings({ language: lang });
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await settingsRepo.updateSettings({ theme_mode: mode });
  };

  const toggleTheme = async () => {
    const nextMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    await setThemeMode(nextMode);
  };

  // Job Actions
  const startJob = async (job: JobSession, initialHelperIds: number[] = []) => {
    await jobRepo.startJobSession(job.id);
    const updated = await jobRepo.getJobById(job.id);
    if (!updated) return;

    setActiveJob(updated.job);
    const client = clients.find((c) => c.id === updated.job.client_id) || null;
    setActiveClient(client);

    // Initial helpers: if passed explicitly use them, otherwise use assigned helpers from job
    let helperIdsToSelect = initialHelperIds;
    if (helperIdsToSelect.length === 0 && updated.helpers && updated.helpers.length > 0) {
      helperIdsToSelect = updated.helpers.map((h) => h.helper_id);
    } else if (helperIdsToSelect.length === 0 && job.assigned_helper_ids) {
      helperIdsToSelect = job.assigned_helper_ids
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter(Boolean);
    }
    const assignedHelpers = helpers.filter((h) => helperIdsToSelect.includes(h.id));
    setSelectedHelpers(assignedHelpers);
    setBilledPeopleCount(updated.job.billed_people_count || client?.default_billed_people || 1);

    // Reset paused durations and start fresh
    pausedSecondsRef.current = 0;
    pauseStartMsRef.current = null;
    setElapsedSeconds(0);
    setIsTimerRunning(true);
    setIsTimerPaused(false);
    setIsManualDuration(false);
  };

  const pauseTimer = () => {
    setIsTimerPaused(true);
    pauseStartMsRef.current = Date.now();
  };

  const resumeTimer = () => {
    if (pauseStartMsRef.current) {
      const pausedDiff = Math.floor((Date.now() - pauseStartMsRef.current) / 1000);
      pausedSecondsRef.current += Math.max(0, pausedDiff);
      pauseStartMsRef.current = null;
    }
    setIsTimerPaused(false);
    // Instant wall-clock resync
    if (activeJob?.start_time) {
      const live = calculateLiveElapsedSeconds(activeJob.start_time, pausedSecondsRef.current);
      setElapsedSeconds(live);
    }
  };

  const setBilledPeople = (count: number) => {
    setBilledPeopleCount(Math.max(1, count));
  };

  const toggleHelperSelection = (helper: Helper) => {
    setSelectedHelpers((prev) => {
      const exists = prev.some((h) => h.id === helper.id);
      if (exists) {
        return prev.filter((h) => h.id !== helper.id);
      } else {
        return [...prev, helper];
      }
    });
  };

  const setManualMinutesOverride = (minutes: number) => {
    setIsManualDuration(true);
    setManualMinutes(Math.max(1, minutes));
    setElapsedSeconds(minutes * 60);
  };

  const resetTimerToLive = () => {
    setIsManualDuration(false);
    if (activeJob?.start_time) {
      let totalPaused = pausedSecondsRef.current;
      if (isTimerPaused && pauseStartMsRef.current) {
        totalPaused += Math.floor((Date.now() - pauseStartMsRef.current) / 1000);
      }
      const live = calculateLiveElapsedSeconds(activeJob.start_time, totalPaused);
      setElapsedSeconds(live);
    }
  };

  const finishCurrentJob = async (notes?: string): Promise<{ success: boolean; job?: JobSession }> => {
    if (!activeJob) return { success: false };

    const durationMinutes = isManualDuration
      ? manualMinutes
      : Math.max(1, Math.round(elapsedSeconds / 60));

    const clientRate = activeClient?.hourly_rate || activeJob.client_hourly_rate || 20;

    const calc = calculateJobFinancials(
      durationMinutes,
      clientRate,
      billedPeopleCount,
      selectedHelpers
    );

    const endTimeIso = new Date().toISOString();

    await jobRepo.completeJobSession({
      jobId: activeJob.id,
      endTimeIso,
      durationMinutes,
      billedPeopleCount,
      totalClientCharge: calc.totalClientCharge,
      totalHelpersCost: calc.totalHelpersCost,
      netProfit: calc.netProfit,
      notes: notes || activeJob.notes,
      helperSnapshots: calc.helperBreakdowns.map((h) => ({
        helperId: h.helperId,
        rateSnapshot: h.rateSnapshot,
        earnings: h.earnings,
      })),
    });

    const completed = await jobRepo.getJobById(activeJob.id);

    // Reset active job state
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setIsManualDuration(false);
    setActiveJob(null);
    setActiveClient(null);
    setSelectedHelpers([]);
    setElapsedSeconds(0);
    pausedSecondsRef.current = 0;
    pauseStartMsRef.current = null;

    return {
      success: true,
      job: completed?.job,
    };
  };

  const cancelActiveJob = async () => {
    if (!activeJob) return;
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setIsManualDuration(false);
    setActiveJob(null);
    setActiveClient(null);
    setSelectedHelpers([]);
    setElapsedSeconds(0);
    pausedSecondsRef.current = 0;
    pauseStartMsRef.current = null;
  };

  const openPostcodeInMaps = async (postcode: string, name?: string) => {
    await openMapsRoute(postcode, name);
  };

  const sendJobInvoiceWhatsApp = async (job: JobSession): Promise<boolean> => {
    const client = clients.find((c) => c.id === job.client_id);
    const clientName = client?.name || job.client_name || 'Valued Client';
    const clientPhone = client?.phone || job.client_phone;

    const durationMinutes = job.manual_duration_minutes || 0;

    return await sendWhatsAppInvoice({
      clientName,
      clientPhone,
      durationMinutes,
      totalClientCharge: job.total_client_charge,
      settings,
    });
  };

  const resetAllData = async () => {
    await resetDatabase();
    await initialize();
  };

  return (
    <AppContext.Provider
      value={{
        isReady,
        clients,
        helpers,
        settings,
        refreshClients,
        refreshHelpers,
        refreshSettings,
        updateSettings,

        language,
        themeMode,
        colors,
        t,
        setLanguage,
        setThemeMode,
        toggleTheme,

        activeJob,
        activeClient,
        selectedHelpers,
        elapsedSeconds,
        isTimerRunning,
        isTimerPaused,
        isManualDuration,
        manualMinutes,
        billedPeopleCount,

        startJob,
        pauseTimer,
        resumeTimer,
        setBilledPeople,
        toggleHelperSelection,
        setManualMinutesOverride,
        resetTimerToLive,
        finishCurrentJob,
        cancelActiveJob,

        openPostcodeInMaps,
        sendJobInvoiceWhatsApp,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
