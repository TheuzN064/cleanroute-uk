import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Shadows } from '../theme';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { buildWhatsAppInvoiceMessage } from '../utils/messaging';
import { HelpersScreen } from './HelpersScreen';

export const SettingsScreen: React.FC = () => {
  const {
    settings,
    helpers,
    updateSettings,
    resetAllData,
    language,
    themeMode,
    colors,
    t,
    setLanguage,
    setThemeMode,
  } = useApp();

  const [businessName, setBusinessName] = useState(settings.business_name);
  const [sortCode, setSortCode] = useState(settings.bank_sort_code);
  const [accountNumber, setAccountNumber] = useState(settings.bank_account_number);
  const [accountName, setAccountName] = useState(settings.bank_account_name);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency_symbol || '£');
  const [isSaved, setIsSaved] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);

  const handleSave = async () => {
    await updateSettings({
      business_name: businessName.trim(),
      bank_sort_code: sortCode.trim(),
      bank_account_number: accountNumber.trim(),
      bank_account_name: accountName.trim(),
      currency_symbol: currencySymbol.trim() || '£',
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleResetData = () => {
    Alert.alert(
      language === 'pt' ? 'Restaurar Dados de Exemplo UK' : 'Reset & Reload UK Sample Data',
      language === 'pt'
        ? 'Isso reinicializará o banco local e carregará clientes reais de Londres e ajudantes.'
        : 'This will reset your local database and load realistic London clients and staff.',
      [
        { text: language === 'pt' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: language === 'pt' ? 'Restaurar' : 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetAllData();
            Alert.alert('Success', language === 'pt' ? 'Banco de dados restaurado.' : 'Database restored.');
          },
        },
      ]
    );
  };

  const previewMessage = buildWhatsAppInvoiceMessage({
    clientName: 'Lady Eleanor Vance',
    durationMinutes: 120,
    totalClientCharge: 80.0,
    settings: {
      id: 1,
      business_name: businessName,
      bank_sort_code: sortCode,
      bank_account_number: accountNumber,
      bank_account_name: accountName,
      currency_symbol: currencySymbol,
    },
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Offline Ready Status Banner */}
      <View
        style={[
          styles.offlineBanner,
          { backgroundColor: themeMode === 'dark' ? '#064E3B' : '#ECFDF5', borderColor: colors.success },
        ]}
      >
        <Ionicons name="shield-checkmark" size={22} color={colors.success} />
        <View style={styles.offlineTextContainer}>
          <Text style={[styles.offlineTitle, { color: themeMode === 'dark' ? '#A7F3D0' : '#065F46' }]}>
            {t('settingsOfflineReadyTitle')}
          </Text>
          <Text style={[styles.offlineSub, { color: themeMode === 'dark' ? '#6EE7B7' : '#047857' }]}>
            {t('settingsOfflineReadySub')}
          </Text>
        </View>
      </View>

      {/* App Preferences: Language & Theme */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settingsAppPreferences')}
          </Text>
          <Ionicons name="color-palette-outline" size={20} color={colors.accent} />
        </View>

        {/* Language Selector */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('settingsLanguage')}
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleChip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              language === 'pt' && [styles.toggleChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
            ]}
            onPress={() => setLanguage('pt')}
          >
            <Text
              style={[
                styles.toggleChipText,
                { color: colors.textSecondary },
                language === 'pt' && styles.toggleChipTextActive,
              ]}
            >
              {t('settingsPt')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleChip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              language === 'en' && [styles.toggleChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
            ]}
            onPress={() => setLanguage('en')}
          >
            <Text
              style={[
                styles.toggleChipText,
                { color: colors.textSecondary },
                language === 'en' && styles.toggleChipTextActive,
              ]}
            >
              {t('settingsEn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Theme Selector */}
        <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: Spacing.md }]}>
          {t('settingsTheme')}
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleChip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              themeMode === 'light' && [styles.toggleChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
            ]}
            onPress={() => setThemeMode('light')}
          >
            <Text
              style={[
                styles.toggleChipText,
                { color: colors.textSecondary },
                themeMode === 'light' && styles.toggleChipTextActive,
              ]}
            >
              {t('settingsLight')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleChip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              themeMode === 'dark' && [styles.toggleChipActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
            ]}
            onPress={() => setThemeMode('dark')}
          >
            <Text
              style={[
                styles.toggleChipText,
                { color: colors.textSecondary },
                themeMode === 'dark' && styles.toggleChipTextActive,
              ]}
            >
              {t('settingsDark')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Staff Management Shortcut */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settingsStaffSection')}
          </Text>
          <Ionicons name="people" size={20} color={colors.accent} />
        </View>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          {t('settingsStaffDesc')}
        </Text>

        <TouchableOpacity
          style={[
            styles.staffBtn,
            {
              backgroundColor: themeMode === 'dark' ? '#141D30' : '#F0F9FF',
              borderColor: colors.accent,
            },
          ]}
          onPress={() => setShowStaffModal(true)}
        >
          <View style={styles.staffBtnLeft}>
            <View style={[styles.staffBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.staffBadgeText}>{helpers.length}</Text>
            </View>
            <Text style={[styles.staffBtnText, { color: colors.text }]}>
              {t('settingsManageStaffBtn')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Business Profile */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('settingsBusinessProfile')}
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('settingsBusinessName')}
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
          ]}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Ex: CleanRoute London Ltd"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('settingsCurrencySymbol')}
        </Text>
        <TextInput
          style={[
            styles.input,
            { width: 80, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
          ]}
          value={currencySymbol}
          onChangeText={setCurrencySymbol}
          placeholder="£"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Bank Transfer Details */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settingsBankDetails')}
          </Text>
          <Ionicons name="card-outline" size={20} color={colors.accent} />
        </View>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          {t('settingsBankDesc')}
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('settingsSortCode')}
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
          ]}
          value={sortCode}
          onChangeText={setSortCode}
          placeholder="Ex: 20-00-00"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('settingsAccountNumber')}
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
          ]}
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholder="Ex: 12345678"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('settingsAccountHolder')}
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
          ]}
          value={accountName}
          onChangeText={setAccountName}
          placeholder="Ex: CleanRoute Ltd"
          placeholderTextColor={colors.textMuted}
        />

        <Button
          title={isSaved ? t('settingsSavedSuccess') : t('settingsSaveBankBtn')}
          variant={isSaved ? 'success' : 'primary'}
          size="md"
          icon={
            <Ionicons
              name={isSaved ? 'checkmark' : 'save-outline'}
              size={18}
              color="#FFFFFF"
            />
          }
          onPress={handleSave}
          style={{ marginTop: Spacing.lg }}
        />
      </View>

      {/* WhatsApp Invoice Template Live Preview */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settingsWhatsAppPreview')}
          </Text>
          <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
        </View>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          {t('settingsWhatsAppPreviewDesc')}
        </Text>

        <View
          style={[
            styles.previewBox,
            {
              backgroundColor: themeMode === 'dark' ? '#064E3B' : '#E7FCE8',
              borderColor: colors.success,
            },
          ]}
        >
          <Text
            style={[
              styles.previewText,
              { color: themeMode === 'dark' ? '#A7F3D0' : '#1A365D' },
            ]}
          >
            {previewMessage}
          </Text>
        </View>
      </View>

      {/* Database Management */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('settingsDbManagement')}
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          {t('settingsDbDesc')}
        </Text>

        <Button
          title={t('settingsReloadDataBtn')}
          variant="secondary"
          size="md"
          icon={<Ionicons name="refresh" size={18} color={colors.text} />}
          onPress={handleResetData}
          style={{ marginTop: Spacing.md }}
        />
      </View>

      {/* Staff Management Modal */}
      <Modal visible={showStaffModal} animationType="slide">
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeaderBar,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>
              {t('staffRosterTab')}
            </Text>
            <TouchableOpacity onPress={() => setShowStaffModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <HelpersScreen />
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  offlineTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  offlineTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  offlineSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionDesc: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 6,
  },
  toggleChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  toggleChipActive: {
    borderColor: 'transparent',
  },
  toggleChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  staffBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  staffBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  staffBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  previewBox: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
});
