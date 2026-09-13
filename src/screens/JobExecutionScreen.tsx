import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Shadows } from '../theme';
import { useApp } from '../context/AppContext';
import { TimerDisplay } from '../components/TimerDisplay';
import { FinancialSummaryCard } from '../components/FinancialSummaryCard';
import { Button } from '../components/Button';
import { calculateJobFinancials, formatCurrency, formatMinutesDisplay } from '../utils/calculations';
import { Helper, JobSession } from '../types';

interface JobExecutionScreenProps {
  onJobFinished?: () => void;
}

export const JobExecutionScreen: React.FC<JobExecutionScreenProps> = ({ onJobFinished }) => {
  const {
    activeJob,
    activeClient,
    helpers,
    selectedHelpers,
    elapsedSeconds,
    isTimerRunning,
    isTimerPaused,
    isManualDuration,
    manualMinutes,
    billedPeopleCount,

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
    settings,
    colors,
    t,
    themeMode,
  } = useApp();

  const [notesInput, setNotesInput] = useState('');
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualHoursInput, setManualHoursInput] = useState('1');
  const [manualMinsInput, setManualMinsInput] = useState('30');
  const [completedJobModal, setCompletedJobModal] = useState<JobSession | null>(null);

  if (!activeJob) {
    return (
      <View style={[styles.noActiveContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.noActiveCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="timer-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.noActiveTitle, { color: colors.text }]}>
            {t('timerNoActiveTitle')}
          </Text>
          <Text style={[styles.noActiveSub, { color: colors.textSecondary }]}>
            {t('timerNoActiveSub')}
          </Text>
        </View>
      </View>
    );
  }

  const currentMinutes = isManualDuration
    ? manualMinutes
    : Math.max(1, Math.round(elapsedSeconds / 60));

  const clientRate = activeClient?.hourly_rate || activeJob.client_hourly_rate || 20;

  const financials = calculateJobFinancials(
    currentMinutes,
    clientRate,
    billedPeopleCount,
    selectedHelpers
  );

  const handleApplyManualTime = () => {
    const hours = parseFloat(manualHoursInput) || 0;
    const mins = parseFloat(manualMinsInput) || 0;
    const total = Math.round(hours * 60 + mins);
    if (total <= 0) {
      Alert.alert('Invalid Duration', 'Please enter at least 1 minute.');
      return;
    }
    setManualMinutesOverride(total);
    setManualModalVisible(false);
  };

  const handleFinishJob = () => {
    Alert.alert(
      t('timerFinishBtn'),
      `${formatMinutesDisplay(currentMinutes)} • ${formatCurrency(financials.totalClientCharge, settings.currency_symbol)}`,
      [
        { text: t('timerCancel'), style: 'cancel' },
        {
          text: t('timerFinishBtn'),
          style: 'default',
          onPress: async () => {
            const res = await finishCurrentJob(notesInput);
            if (res.success && res.job) {
              setCompletedJobModal(res.job);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      t('timerDiscardBtn'),
      'Are you sure you want to discard this session?',
      [
        { text: 'Keep Working', style: 'cancel' },
        {
          text: t('timerDiscardBtn'),
          style: 'destructive',
          onPress: async () => {
            await cancelActiveJob();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Client Quick Info Banner */}
      <View
        style={[
          styles.clientBanner,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.clientBannerLeft}>
          <Text style={[styles.clientName, { color: colors.text }]}>
            {activeClient?.name || activeJob.client_name}
          </Text>
          <TouchableOpacity
            style={styles.locationLink}
            onPress={() =>
              openPostcodeInMaps(
                activeClient?.postcode || activeJob.client_postcode || '',
                activeClient?.name
              )
            }
          >
            <Ionicons name="location-sharp" size={15} color={colors.accent} />
            <Text style={[styles.postcode, { color: colors.accent }]}>
              {activeClient?.postcode || activeJob.client_postcode}
            </Text>
            <Text style={[styles.navLabel, { color: colors.textMuted }]}>
              • Tap to Navigate
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.rateBadge, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.rateText, { color: colors.accentDark }]}>
            {formatCurrency(clientRate)}/h
          </Text>
        </View>
      </View>

      {/* Resilient Stopwatch Display */}
      <TimerDisplay
        elapsedSeconds={elapsedSeconds}
        isRunning={isTimerRunning}
        isPaused={isTimerPaused}
        isManual={isManualDuration}
      />

      {/* Timer Controls */}
      <View style={styles.timerControls}>
        {isTimerPaused ? (
          <Button
            title={t('timerResumeBtn')}
            variant="success"
            size="md"
            icon={<Ionicons name="play" size={18} color="#FFFFFF" />}
            onPress={resumeTimer}
            style={styles.controlBtn}
          />
        ) : (
          <Button
            title={t('timerPauseBtn')}
            variant="warning"
            size="md"
            icon={<Ionicons name="pause" size={18} color="#FFFFFF" />}
            onPress={pauseTimer}
            style={styles.controlBtn}
          />
        )}

        <Button
          title={isManualDuration ? t('timerLiveTimerBtn') : t('timerManualAdjustBtn')}
          variant="outline"
          size="md"
          icon={<Ionicons name="create-outline" size={18} color={colors.accent} />}
          onPress={() => {
            if (isManualDuration) {
              resetTimerToLive();
            } else {
              setManualModalVisible(true);
            }
          }}
          style={styles.controlBtn}
        />
      </View>

      {/* Live Financial Metrics */}
      <FinancialSummaryCard
        grossCharge={financials.totalClientCharge}
        helpersCost={financials.totalHelpersCost}
        netProfit={financials.netProfit}
        currencySymbol={settings.currency_symbol}
        billedPeopleCount={billedPeopleCount}
        helperCount={selectedHelpers.length}
      />

      {/* Billed People Count Stepper */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('timerPeopleBilled')}
            </Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              {t('timerPeopleMultiplier')}
            </Text>
          </View>
          <View style={[styles.stepperContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: colors.surface }]}
              onPress={() => setBilledPeople(Math.max(1, billedPeopleCount - 1))}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.stepperValue, { color: colors.text }]}>
              {billedPeopleCount}
            </Text>
            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: colors.surface }]}
              onPress={() => setBilledPeople(billedPeopleCount + 1)}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Assigned Helpers Multi-select */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('timerStaffPresent')}
            </Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              {t('timerTapToggleStaff')}
            </Text>
          </View>
          <Text style={[styles.helperCountText, { color: colors.accent }]}>
            {selectedHelpers.length} {t('timerStaffActive')}
          </Text>
        </View>

        <View style={styles.helpersList}>
          {helpers.map((helper) => {
            const isSelected = selectedHelpers.some((h) => h.id === helper.id);
            return (
              <TouchableOpacity
                key={helper.id}
                style={[
                  styles.helperChip,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                  isSelected && {
                    borderColor: colors.accent,
                    backgroundColor: themeMode === 'dark' ? '#0C2A4A' : '#F0F9FF',
                  },
                ]}
                onPress={() => toggleHelperSelection(helper)}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={isSelected ? colors.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.helperChipName,
                    { color: colors.text },
                    isSelected && { color: colors.accentDark },
                  ]}
                >
                  {helper.name}
                </Text>
                <Text style={[styles.helperChipRate, { color: colors.textSecondary }]}>
                  ({formatCurrency(helper.hourly_rate)}/h)
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {financials.helperBreakdowns.length > 0 && (
          <View style={[styles.breakdownBox, { borderTopColor: colors.border }]}>
            <Text style={[styles.breakdownHeader, { color: colors.textSecondary }]}>
              {t('timerCostBreakdown')} ({formatMinutesDisplay(currentMinutes)}):
            </Text>
            {financials.helperBreakdowns.map((b) => (
              <View key={b.helperId} style={styles.breakdownRow}>
                <Text style={[styles.breakdownName, { color: colors.textSecondary }]}>
                  {b.helperName}
                </Text>
                <Text style={[styles.breakdownValue, { color: colors.danger }]}>
                  {formatCurrency(b.earnings, settings.currency_symbol)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Job Notes */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('timerServiceNotes')}
        </Text>
        <TextInput
          style={[
            styles.notesInput,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
          ]}
          multiline
          placeholder="e.g. Cleaned oven, customer requested extra attention"
          placeholderTextColor={colors.textMuted}
          value={notesInput}
          onChangeText={setNotesInput}
        />
      </View>

      {/* Final Action Buttons */}
      <View style={styles.bottomActions}>
        <Button
          title={t('timerFinishBtn')}
          variant="success"
          size="lg"
          icon={<Ionicons name="checkmark-done" size={20} color="#FFFFFF" />}
          onPress={handleFinishJob}
        />
        <Button
          title={t('timerDiscardBtn')}
          variant="ghost"
          size="sm"
          onPress={handleCancel}
          style={{ marginTop: Spacing.sm }}
        />
      </View>

      {/* Manual Duration Modal */}
      <Modal visible={manualModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('timerManualModalTitle')}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {t('timerManualModalSub')}
            </Text>

            <View style={styles.manualInputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('timerHours')}
                </Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                  ]}
                  keyboardType="numeric"
                  value={manualHoursInput}
                  onChangeText={setManualHoursInput}
                />
              </View>
              <Text style={[styles.inputColon, { color: colors.textMuted }]}>:</Text>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('timerMinutes')}
                </Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                  ]}
                  keyboardType="numeric"
                  value={manualMinsInput}
                  onChangeText={setManualMinsInput}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                title={t('timerCancel')}
                variant="secondary"
                size="md"
                onPress={() => setManualModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={t('timerApply')}
                variant="primary"
                size="md"
                onPress={handleApplyManualTime}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Completed Job & WhatsApp Invoicing Modal */}
      <Modal visible={completedJobModal !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={54} color={colors.success} />
            </View>

            <Text style={[styles.modalSuccessTitle, { color: colors.text }]}>
              {t('timerSuccessTitle')}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {t('timerSuccessSub')}
            </Text>

            <View
              style={[
                styles.invoiceSummaryBox,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('timerTotalDuration')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatMinutesDisplay(completedJobModal?.manual_duration_minutes || currentMinutes)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('timerTotalDue')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.success, fontSize: 18 }]}>
                  {formatCurrency(completedJobModal?.total_client_charge || financials.totalClientCharge, settings.currency_symbol)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('timerBankSortCode')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{settings.bank_sort_code}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('timerAccountNumber')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{settings.bank_account_number}</Text>
              </View>
            </View>

            <Button
              title={t('timerSendWhatsAppNow')}
              variant="success"
              size="lg"
              icon={<Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />}
              onPress={async () => {
                if (completedJobModal) {
                  await sendJobInvoiceWhatsApp(completedJobModal);
                }
                setCompletedJobModal(null);
                if (onJobFinished) onJobFinished();
              }}
              style={{ marginBottom: Spacing.sm }}
            />

            <Button
              title={t('timerCloseAndReturn')}
              variant="secondary"
              size="md"
              onPress={() => {
                setCompletedJobModal(null);
                if (onJobFinished) onJobFinished();
              }}
            />
          </View>
        </View>
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
    paddingBottom: 60,
  },
  noActiveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  noActiveCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    ...Shadows.card,
  },
  noActiveTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  noActiveSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  clientBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    ...Shadows.card,
  },
  clientBannerLeft: {
    flex: 1,
  },
  clientName: {
    fontSize: 20,
    fontWeight: '800',
  },
  locationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  postcode: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  navLabel: {
    fontSize: 12,
    marginLeft: 4,
  },
  rateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  rateText: {
    fontSize: 14,
    fontWeight: '800',
  },
  timerControls: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  controlBtn: {
    flex: 1,
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
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  helperCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 14,
  },
  helpersList: {
    gap: Spacing.sm,
  },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  helperChipName: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
  },
  helperChipRate: {
    fontSize: 13,
    marginLeft: 6,
  },
  breakdownBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  breakdownHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownName: {
    fontSize: 13,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 14,
    marginTop: Spacing.sm,
    height: 70,
  },
  bottomActions: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.elevated,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSuccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: Spacing.lg,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  timeInput: {
    width: 75,
    height: 60,
    borderRadius: BorderRadius.md,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
  },
  inputColon: {
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: Spacing.md,
    marginTop: 20,
  },
  modalActions: {
    flexDirection: 'row',
  },
  invoiceSummaryBox: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.lg,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
