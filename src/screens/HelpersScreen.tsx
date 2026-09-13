import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfWeek, endOfWeek, format, subWeeks, addWeeks } from 'date-fns';
import { Spacing, BorderRadius, Shadows } from '../theme';
import { useApp } from '../context/AppContext';
import { Helper, HelperWeeklySummary } from '../types';
import * as helperRepo from '../database/repositories/helperRepository';
import { Button } from '../components/Button';
import { formatCurrency, formatMinutesDisplay } from '../utils/calculations';

export const HelpersScreen: React.FC = () => {
  const { helpers, refreshHelpers, settings, colors, t, themeMode } = useApp();

  const [activeTab, setActiveTab] = useState<'roster' | 'payroll'>('roster');
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(new Date());
  const [weeklySummaries, setWeeklySummaries] = useState<HelperWeeklySummary[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHelper, setEditingHelper] = useState<Helper | null>(null);
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('12.50');
  const [isActive, setIsActive] = useState(true);

  // Compute week range (Monday to Sunday)
  const weekStart = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeekDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const loadWeeklyData = useCallback(async () => {
    try {
      const data = await helperRepo.getHelperWeeklyStatements(weekStartStr, weekEndStr);
      setWeeklySummaries(data);
    } catch (err) {
      console.error('Error loading helper statements:', err);
    }
  }, [weekStartStr, weekEndStr]);

  useEffect(() => {
    if (activeTab === 'payroll') {
      loadWeeklyData();
    }
  }, [activeTab, loadWeeklyData]);

  const openCreateModal = () => {
    setEditingHelper(null);
    setName('');
    setHourlyRate('12.50');
    setIsActive(true);
    setModalVisible(true);
  };

  const openEditModal = (helper: Helper) => {
    setEditingHelper(helper);
    setName(helper.name);
    setHourlyRate(helper.hourly_rate.toString());
    setIsActive(helper.is_active === 1);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Helper name is required.');
      return;
    }
    const rate = parseFloat(hourlyRate) || 12;

    try {
      if (editingHelper) {
        await helperRepo.updateHelper(editingHelper.id, name.trim(), rate, isActive);
      } else {
        await helperRepo.createHelper(name.trim(), rate);
      }

      await refreshHelpers();
      if (activeTab === 'payroll') {
        await loadWeeklyData();
      }
      setModalVisible(false);
    } catch (err) {
      console.error('Error saving helper:', err);
      Alert.alert('Error', 'Failed to save staff member.');
    }
  };

  const handleDelete = (helper: Helper) => {
    Alert.alert(
      'Delete Staff Member',
      `Are you sure you want to remove ${helper.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await helperRepo.deleteHelper(helper.id);
            await refreshHelpers();
            if (activeTab === 'payroll') await loadWeeklyData();
          },
        },
      ]
    );
  };

  const totalWeeklyPayroll = weeklySummaries.reduce((acc, h) => acc + h.totalEarnings, 0);
  const totalHoursWorked = weeklySummaries.reduce((acc, h) => acc + h.totalHours, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Tab Switcher */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'roster' && [styles.tabBtnActive, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab('roster')}
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'roster' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'roster' ? colors.accent : colors.textMuted },
              activeTab === 'roster' && styles.tabTextActive,
            ]}
          >
            {t('staffRosterTab')} ({helpers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'payroll' && [styles.tabBtnActive, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveTab('payroll')}
        >
          <Ionicons
            name="receipt"
            size={18}
            color={activeTab === 'payroll' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'payroll' ? colors.accent : colors.textMuted },
              activeTab === 'payroll' && styles.tabTextActive,
            ]}
          >
            {t('staffWeeklyPayrollTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Roster View */}
      {activeTab === 'roster' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.subHeader}>
            <Text style={[styles.subHeaderText, { color: colors.textSecondary }]}>
              {t('staffActiveStaffDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={openCreateModal}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={helpers}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.helperCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.helperInfo}>
                  <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.avatarText, { color: colors.accentDark }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.nameContainer}>
                    <Text style={[styles.helperName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <View style={styles.rateBadge}>
                      <Text style={[styles.rateText, { color: colors.textSecondary }]}>
                        {t('staffPayRate')}: {formatCurrency(item.hourly_rate)}/h
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <View
                    style={[
                      styles.statusIndicator,
                      {
                        backgroundColor:
                          item.is_active === 1
                            ? (themeMode === 'dark' ? '#064E3B' : '#D1FAE5')
                            : colors.surfaceSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            item.is_active === 1
                              ? (themeMode === 'dark' ? '#6EE7B7' : '#047857')
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {item.is_active === 1 ? t('staffActive') : t('staffInactive')}
                    </Text>
                  </View>

                  <View style={styles.actionIcons}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => openEditModal(item)}
                    >
                      <Ionicons name="pencil" size={18} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => handleDelete(item)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.danger}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="person-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t('staffNoHelpersTitle')}
                </Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {t('staffNoHelpersSub')}
                </Text>
              </View>
            }
          />
        </View>
      ) : (
        /* Payroll & Statement View */
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.weekSelector,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.weekArrow}
              onPress={() => setSelectedWeekDate((prev) => subWeeks(prev, 1))}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.weekCenter}>
              <Text style={[styles.weekTitle, { color: colors.text }]}>
                {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
              </Text>
              <Text style={[styles.weekSub, { color: colors.textMuted }]}>
                {t('staffWeeklyPayrollTab')}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.weekArrow}
              onPress={() => setSelectedWeekDate((prev) => addWeeks(prev, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekly Summary KPIs */}
          <View
            style={[
              styles.kpiContainer,
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.text }]}>
                {totalHoursWorked.toFixed(1)}h
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
                {t('payHoursWorked')}
              </Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.danger }]}>
                {formatCurrency(totalWeeklyPayroll, settings.currency_symbol)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
                {t('payTotalToPay')}
              </Text>
            </View>
          </View>

          <FlatList
            data={weeklySummaries}
            keyExtractor={(item) => item.helperId.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.payrollCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.payrollHeader}>
                  <Text style={[styles.payrollName, { color: colors.text }]}>
                    {item.helperName}
                  </Text>
                  <Text style={[styles.payrollTotal, { color: colors.danger }]}>
                    {formatCurrency(item.totalEarnings, settings.currency_symbol)}
                  </Text>
                </View>

                <View style={styles.payrollMeta}>
                  <Text style={[styles.payrollMetaItem, { color: colors.textSecondary }]}>
                    {t('payRatePerHour')}: {formatCurrency(item.hourlyRate)}/h
                  </Text>
                  <Text style={[styles.payrollMetaItem, { color: colors.textSecondary }]}>
                    • {item.jobCount} {t('payJobsDone')}
                  </Text>
                  <Text style={[styles.payrollMetaItem, { color: colors.textSecondary }]}>
                    • {formatMinutesDisplay(item.totalMinutes)}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t('payNoInvoicesTitle')}
                </Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {t('payNoInvoicesSub')}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Add / Edit Helper Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingHelper ? t('staffEditTitle') : t('staffAddTitle')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t('staffNameField')}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
              ]}
              placeholder="e.g. Maria Santos"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t('staffHourlyRateField')}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
              ]}
              placeholder="12.50"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={hourlyRate}
              onChangeText={setHourlyRate}
            />

            {editingHelper && (
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>
                  {t('staffActiveOnRoster')}
                </Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ true: colors.success, false: colors.border }}
                />
              </View>
            )}

            <Button
              title={editingHelper ? t('staffUpdateBtn') : t('staffAddBtn')}
              variant="primary"
              size="lg"
              onPress={handleSave}
              style={{ marginTop: Spacing.xl }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '800',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  subHeaderText: {
    fontSize: 13,
    flex: 1,
    paddingRight: Spacing.md,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  helperCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    ...Shadows.card,
  },
  helperInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  nameContainer: {
    flex: 1,
  },
  helperName: {
    fontSize: 16,
    fontWeight: '800',
  },
  rateBadge: {
    marginTop: 3,
  },
  rateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    padding: 4,
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  weekArrow: {
    padding: Spacing.sm,
  },
  weekCenter: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  weekSub: {
    fontSize: 11,
    marginTop: 2,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    marginVertical: Spacing.sm,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
  },
  kpiItem: {
    alignItems: 'center',
    flex: 1,
  },
  kpiDivider: {
    width: 1,
    height: 36,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  payrollCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  payrollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  payrollName: {
    fontSize: 17,
    fontWeight: '800',
  },
  payrollTotal: {
    fontSize: 18,
    fontWeight: '800',
  },
  payrollMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payrollMetaItem: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
