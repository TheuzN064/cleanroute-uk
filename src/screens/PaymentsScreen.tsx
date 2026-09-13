import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Shadows } from '../theme';
import { useApp } from '../context/AppContext';
import {
  FinancialOverview,
  ClientInvoiceItem,
  HelperPayoutItem,
  getFinancialOverview,
  getClientInvoices,
  getStaffPayoutSummary,
  toggleJobPaymentStatus,
} from '../database/repositories/paymentsRepository';
import { formatCurrency, formatMinutesDisplay } from '../utils/calculations';

export const PaymentsScreen: React.FC = () => {
  const { settings, sendJobInvoiceWhatsApp, colors, t, themeMode } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'clients' | 'helpers'>('clients');
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<FinancialOverview>({
    totalPending: 0,
    totalReceived: 0,
    totalStaffWages: 0,
    totalNetProfit: 0,
    pendingCount: 0,
    paidCount: 0,
  });

  const [invoices, setInvoices] = useState<ClientInvoiceItem[]>([]);
  const [helperPayouts, setHelperPayouts] = useState<HelperPayoutItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [ov, invs, helpers] = await Promise.all([
        getFinancialOverview(),
        getClientInvoices(invoiceFilter),
        getStaffPayoutSummary(),
      ]);
      setOverview(ov);
      setInvoices(invs);
      setHelperPayouts(helpers);
    } catch (err) {
      console.error('Error loading payments data:', err);
    }
  }, [invoiceFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggleStatus = async (item: ClientInvoiceItem) => {
    const nextStatus = item.payment_status === 'PAID' ? 'PENDING' : 'PAID';
    await toggleJobPaymentStatus(item.id, nextStatus);
    await loadData();
  };

  const handleSendInvoice = async (item: ClientInvoiceItem) => {
    await sendJobInvoiceWhatsApp({
      id: item.id,
      client_id: item.client_id,
      client_name: item.client_name,
      client_phone: item.client_phone,
      total_client_charge: item.total_client_charge,
      manual_duration_minutes: item.duration_minutes,
      billed_people_count: item.billed_people_count,
      total_helpers_cost: item.total_helpers_cost,
      net_profit: item.net_profit,
      payment_status: item.payment_status,
      status: 'COMPLETED',
      date: item.date,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Scrollable KPI Overview */}
      <View
        style={[
          styles.overviewContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.overviewTitleRow}>
          <Text style={[styles.overviewHeading, { color: colors.text }]}>
            {t('payDashboardTitle')}
          </Text>
          <Text
            style={[
              styles.currencyBadge,
              { color: colors.accentDark, backgroundColor: colors.accentLight },
            ]}
          >
            {settings.currency_symbol} GBP
          </Text>
        </View>

        {/* 2x2 Metric Grid */}
        <View style={styles.kpiGrid}>
          {/* A Receber (Pending) */}
          <View
            style={[
              styles.kpiCard,
              {
                borderColor: themeMode === 'dark' ? '#78350F' : '#FDE68A',
                backgroundColor: themeMode === 'dark' ? '#271904' : '#FFFBEB',
              },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiTitle, { color: themeMode === 'dark' ? '#FDE68A' : '#B45309' }]}>
                {t('payToReceive')}
              </Text>
              <Ionicons name="time-outline" size={16} color="#D97706" />
            </View>
            <Text style={[styles.kpiAmount, { color: themeMode === 'dark' ? '#FDE68A' : '#B45309' }]}>
              {formatCurrency(overview.totalPending, settings.currency_symbol)}
            </Text>
            <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>
              {overview.pendingCount}{' '}
              {overview.pendingCount === 1
                ? t('payPendingInvoiceSingular')
                : t('payPendingInvoices')}
            </Text>
          </View>

          {/* Já Recebido (Paid) */}
          <View
            style={[
              styles.kpiCard,
              {
                borderColor: themeMode === 'dark' ? '#065F46' : '#A7F3D0',
                backgroundColor: themeMode === 'dark' ? '#03261C' : '#ECFDF5',
              },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiTitle, { color: themeMode === 'dark' ? '#6EE7B7' : '#065F46' }]}>
                {t('payCollected')}
              </Text>
              <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
            </View>
            <Text style={[styles.kpiAmount, { color: themeMode === 'dark' ? '#6EE7B7' : '#065F46' }]}>
              {formatCurrency(overview.totalReceived, settings.currency_symbol)}
            </Text>
            <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>
              {overview.paidCount}{' '}
              {overview.paidCount === 1
                ? t('payPaidInvoiceSingular')
                : t('payPaidInvoices')}
            </Text>
          </View>

          {/* A Pagar Equipe (Staff Costs) */}
          <View
            style={[
              styles.kpiCard,
              {
                borderColor: themeMode === 'dark' ? '#881337' : '#FECDD3',
                backgroundColor: themeMode === 'dark' ? '#2E0610' : '#FFF1F2',
              },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiTitle, { color: themeMode === 'dark' ? '#FDA4AF' : '#BE123C' }]}>
                {t('payStaffWages')}
              </Text>
              <Ionicons name="people-outline" size={16} color="#E11D48" />
            </View>
            <Text style={[styles.kpiAmount, { color: themeMode === 'dark' ? '#FDA4AF' : '#BE123C' }]}>
              {formatCurrency(overview.totalStaffWages, settings.currency_symbol)}
            </Text>
            <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>
              {t('payAccumulatedWages')}
            </Text>
          </View>

          {/* Lucro Líquido (Net Margin) */}
          <View
            style={[
              styles.kpiCard,
              {
                borderColor: themeMode === 'dark' ? '#0C4A6E' : '#BAE6FD',
                backgroundColor: themeMode === 'dark' ? '#051E2E' : '#F0F9FF',
              },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiTitle, { color: themeMode === 'dark' ? '#7DD3FC' : '#0369A1' }]}>
                {t('payNetProfit')}
              </Text>
              <Ionicons name="trending-up" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.kpiAmount, { color: themeMode === 'dark' ? '#7DD3FC' : '#0369A1' }]}>
              {formatCurrency(overview.totalNetProfit, settings.currency_symbol)}
            </Text>
            <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>
              {t('payBusinessMargin')}
            </Text>
          </View>
        </View>
      </View>

      {/* Sub-tab Navigation */}
      <View
        style={[
          styles.subTabNav,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.subTabBtn,
            activeSubTab === 'clients' && [styles.subTabBtnActive, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveSubTab('clients')}
        >
          <Ionicons
            name="receipt-outline"
            size={18}
            color={activeSubTab === 'clients' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.subTabText,
              { color: activeSubTab === 'clients' ? colors.accent : colors.textMuted },
              activeSubTab === 'clients' && styles.subTabTextActive,
            ]}
          >
            {t('payClientInvoicesTab')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabBtn,
            activeSubTab === 'helpers' && [styles.subTabBtnActive, { borderBottomColor: colors.accent }],
          ]}
          onPress={() => setActiveSubTab('helpers')}
        >
          <Ionicons
            name="wallet-outline"
            size={18}
            color={activeSubTab === 'helpers' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.subTabText,
              { color: activeSubTab === 'helpers' ? colors.accent : colors.textMuted },
              activeSubTab === 'helpers' && styles.subTabTextActive,
            ]}
          >
            {t('payStaffPayoutsTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'clients' ? (
        /* View 1: Client Invoices */
        <View style={{ flex: 1 }}>
          {/* Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[
                styles.pill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                invoiceFilter === 'ALL' && [styles.pillActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
              ]}
              onPress={() => setInvoiceFilter('ALL')}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  invoiceFilter === 'ALL' && styles.pillTextActive,
                ]}
              >
                {t('payAll')} ({invoices.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                invoiceFilter === 'PENDING' && [
                  styles.pillActive,
                  { backgroundColor: themeMode === 'dark' ? '#382503' : '#FEF3C7', borderColor: '#F59E0B' },
                ],
              ]}
              onPress={() => setInvoiceFilter('PENDING')}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  invoiceFilter === 'PENDING' && { color: '#B45309', fontWeight: '800' },
                ]}
              >
                {t('payPending')} ({overview.pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.pill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                invoiceFilter === 'PAID' && [
                  styles.pillActive,
                  { backgroundColor: themeMode === 'dark' ? '#043826' : '#D1FAE5', borderColor: '#10B981' },
                ],
              ]}
              onPress={() => setInvoiceFilter('PAID')}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  invoiceFilter === 'PAID' && { color: '#047857', fontWeight: '800' },
                ]}
              >
                {t('payPaid')} ({overview.paidCount})
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={invoices}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => {
              const isPaid = item.payment_status === 'PAID';
              return (
                <View
                  style={[
                    styles.invoiceCard,
                    { backgroundColor: colors.surface },
                    isPaid
                      ? { borderColor: themeMode === 'dark' ? '#065F46' : '#A7F3D0' }
                      : { borderColor: themeMode === 'dark' ? '#78350F' : '#FDE68A' },
                  ]}
                >
                  <View style={styles.invoiceHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clientName, { color: colors.text }]}>
                        {item.client_name}
                      </Text>
                      <Text style={[styles.dateText, { color: colors.textMuted }]}>
                        {item.date} • {item.client_postcode}
                      </Text>
                    </View>

                    <View style={styles.amountContainer}>
                      <Text
                        style={[
                          styles.invoiceAmount,
                          { color: isPaid ? colors.success : colors.warning },
                        ]}
                      >
                        {formatCurrency(item.total_client_charge, settings.currency_symbol)}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.statusToggleBadge,
                          {
                            backgroundColor: isPaid
                              ? themeMode === 'dark' ? '#064E3B' : '#D1FAE5'
                              : themeMode === 'dark' ? '#451A03' : '#FEF3C7',
                          },
                        ]}
                        onPress={() => handleToggleStatus(item)}
                      >
                        <Ionicons
                          name={isPaid ? 'checkmark-circle' : 'time'}
                          size={12}
                          color={isPaid ? '#047857' : '#B45309'}
                        />
                        <Text
                          style={[
                            styles.statusToggleText,
                            { color: isPaid ? '#047857' : '#B45309' },
                          ]}
                        >
                          {isPaid ? t('payStatusPaid') : t('payStatusPending')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.invoiceMetaRow}>
                    <Text style={[styles.metaItem, { color: colors.textSecondary }]}>
                      {t('payDuration')}: {formatMinutesDisplay(item.duration_minutes)}
                    </Text>
                    <Text style={[styles.metaItem, { color: colors.textSecondary }]}>
                      • {t('payBilledCount')}: {item.billed_people_count}
                    </Text>
                    <Text style={[styles.metaItem, { color: colors.success, fontWeight: '700' }]}>
                      • {t('payProfit')}: {formatCurrency(item.net_profit, settings.currency_symbol)}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={[styles.invoiceActionRow, { borderTopColor: colors.borderLight }]}>
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        { backgroundColor: isPaid ? colors.surfaceSubtle : (themeMode === 'dark' ? '#064E3B' : '#ECFDF5') },
                      ]}
                      onPress={() => handleToggleStatus(item)}
                    >
                      <Ionicons
                        name={isPaid ? 'arrow-undo' : 'checkmark'}
                        size={15}
                        color={isPaid ? colors.textSecondary : colors.success}
                      />
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: isPaid ? colors.textSecondary : colors.success },
                        ]}
                      >
                        {isPaid ? t('payMarkAsPending') : t('payMarkAsPaid')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.whatsAppBtn}
                      onPress={() => handleSendInvoice(item)}
                    >
                      <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
                      <Text style={styles.whatsAppBtnText}>{t('payWhatsAppBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
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
      ) : (
        /* View 2: Staff Payouts */
        <FlatList
          data={helperPayouts}
          keyExtractor={(item) => item.helper_id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.helperCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.helperHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                  <Text style={[styles.avatarText, { color: colors.accentDark }]}>
                    {item.helper_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.helperName, { color: colors.text }]}>
                    {item.helper_name}
                  </Text>
                  <Text style={[styles.helperRate, { color: colors.textSecondary }]}>
                    {t('payRatePerHour')}: {formatCurrency(item.hourly_rate, settings.currency_symbol)}/h
                  </Text>
                </View>
                <View style={styles.helperEarningsContainer}>
                  <Text style={[styles.helperEarningsLabel, { color: colors.textMuted }]}>
                    {t('payTotalToPay')}
                  </Text>
                  <Text style={[styles.helperEarningsAmount, { color: colors.danger }]}>
                    {formatCurrency(item.total_earnings, settings.currency_symbol)}
                  </Text>
                </View>
              </View>

              <View style={[styles.helperStatsRow, { backgroundColor: colors.surfaceSubtle }]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {item.job_count}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('payJobsDone')}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {formatMinutesDisplay(item.total_minutes)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('payHoursWorked')}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: colors.danger }]}>
                    {formatCurrency(item.total_earnings, settings.currency_symbol)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    {t('payTotalOwed')}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('payNoStaffWithBalanceTitle')}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {t('payNoStaffWithBalanceSub')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overviewContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  overviewHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  currencyBadge: {
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    width: '48.5%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiAmount: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 11,
  },
  subTabNav: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabBtnActive: {
    borderBottomWidth: 2,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subTabTextActive: {
    fontWeight: '800',
  },
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillActive: {
    borderColor: 'transparent',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  invoiceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientName: {
    fontSize: 17,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statusToggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  statusToggleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  metaItem: {
    fontSize: 12,
  },
  invoiceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  whatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  whatsAppBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  helperCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  helperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
  helperName: {
    fontSize: 16,
    fontWeight: '800',
  },
  helperRate: {
    fontSize: 13,
    marginTop: 2,
  },
  helperEarningsContainer: {
    alignItems: 'flex-end',
  },
  helperEarningsLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  helperEarningsAmount: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  helperStatsRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: Spacing.md,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
});
