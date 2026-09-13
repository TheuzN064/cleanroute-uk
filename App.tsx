import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Shadows, BorderRadius } from './src/theme';
import { AppProvider, useApp } from './src/context/AppContext';
import { RouteScreen } from './src/screens/RouteScreen';
import { JobExecutionScreen } from './src/screens/JobExecutionScreen';
import { PaymentsScreen } from './src/screens/PaymentsScreen';
import { ClientsScreen } from './src/screens/ClientsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

type Tab = 'route' | 'timer' | 'payments' | 'clients' | 'settings';

const MainNavigator: React.FC = () => {
  const { isReady, activeJob, themeMode, colors, t, toggleTheme, language } = useApp();
  const [currentTab, setCurrentTab] = useState<Tab>('route');

  if (!isReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {language === 'pt' ? 'Carregando CleanRoute UK...' : 'Loading CleanRoute UK...'}
        </Text>
      </View>
    );
  }

  const renderCurrentScreen = () => {
    switch (currentTab) {
      case 'route':
        return <RouteScreen onNavigateToJob={() => setCurrentTab('timer')} />;
      case 'timer':
        return <JobExecutionScreen onJobFinished={() => setCurrentTab('payments')} />;
      case 'payments':
        return <PaymentsScreen />;
      case 'clients':
        return <ClientsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <RouteScreen onNavigateToJob={() => setCurrentTab('timer')} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBackground }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.headerBackground}
      />

      {/* Top Executive Header with Quick Theme Toggle */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.headerBackground,
            borderBottomColor: colors.headerBorder,
          },
        ]}
      >
        <View style={styles.brandContainer}>
          <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
            <Ionicons name="sparkles" size={17} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: colors.headerText }]}>
              {t('headerTitle')}
            </Text>
            <Text style={styles.brandSubtitle}>
              {t('headerSubtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {/* Active Job Alert Pill */}
          {activeJob && currentTab !== 'timer' && (
            <TouchableOpacity
              style={styles.floatingActiveBanner}
              activeOpacity={0.8}
              onPress={() => setCurrentTab('timer')}
            >
              <View style={styles.pulseDot} />
              <Text style={styles.activeBannerText}>{t('jobRunningBadge')}</Text>
            </TouchableOpacity>
          )}

          {/* Quick 1-Tap Theme Toggle (☀️ / 🌙) */}
          <TouchableOpacity
            style={styles.themeToggleBtn}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={themeMode === 'dark' ? 'sunny' : 'moon'}
              size={18}
              color={themeMode === 'dark' ? '#FBBF24' : '#E2E8F0'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Screen Body */}
      <View style={[styles.screenBody, { backgroundColor: colors.background }]}>
        {renderCurrentScreen()}
      </View>

      {/* Bottom Navigation Tab Bar (5 Tabs) */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.tabBarBackground,
            borderTopColor: colors.tabBarBorder,
          },
        ]}
      >
        {/* Tab 1: Rotas */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('route')}
        >
          <Ionicons
            name={currentTab === 'route' ? 'map' : 'map-outline'}
            size={22}
            color={currentTab === 'route' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'route' ? colors.accent : colors.textMuted },
              currentTab === 'route' && styles.tabLabelActive,
            ]}
          >
            {t('tabRoute')}
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Timer */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('timer')}
        >
          <View>
            <Ionicons
              name={currentTab === 'timer' ? 'timer' : 'timer-outline'}
              size={23}
              color={
                currentTab === 'timer'
                  ? colors.accent
                  : activeJob
                  ? colors.warning
                  : colors.textMuted
              }
            />
            {activeJob && (
              <View style={styles.tabBadge}>
                <View style={[styles.tabBadgeDot, { backgroundColor: colors.warning }]} />
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'timer' ? colors.accent : colors.textMuted },
              currentTab === 'timer' && styles.tabLabelActive,
              activeJob && currentTab !== 'timer' && { color: colors.warning, fontWeight: '700' },
            ]}
          >
            {t('tabTimer')}
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Pagamentos */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('payments')}
        >
          <Ionicons
            name={currentTab === 'payments' ? 'wallet' : 'wallet-outline'}
            size={22}
            color={currentTab === 'payments' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'payments' ? colors.accent : colors.textMuted },
              currentTab === 'payments' && styles.tabLabelActive,
            ]}
          >
            {t('tabPayments')}
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Clientes */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('clients')}
        >
          <Ionicons
            name={currentTab === 'clients' ? 'people' : 'people-outline'}
            size={22}
            color={currentTab === 'clients' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'clients' ? colors.accent : colors.textMuted },
              currentTab === 'clients' && styles.tabLabelActive,
            ]}
          >
            {t('tabClients')}
          </Text>
        </TouchableOpacity>

        {/* Tab 5: Ajustes */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('settings')}
        >
          <Ionicons
            name={currentTab === 'settings' ? 'settings' : 'settings-outline'}
            size={22}
            color={currentTab === 'settings' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentTab === 'settings' ? colors.accent : colors.textMuted },
              currentTab === 'settings' && styles.tabLabelActive,
            ]}
          >
            {t('tabSettings')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    ...Shadows.glowBlue,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 5,
  },
  activeBannerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  screenBody: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 8,
    ...Shadows.card,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
  },
  tabBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
