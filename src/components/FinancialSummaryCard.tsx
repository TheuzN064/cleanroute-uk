import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Spacing, Shadows } from '../theme';
import { formatCurrency } from '../utils/calculations';
import { useApp } from '../context/AppContext';

interface FinancialSummaryCardProps {
  grossCharge: number;
  helpersCost: number;
  netProfit: number;
  currencySymbol?: string;
  billedPeopleCount?: number;
  helperCount?: number;
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  grossCharge,
  helpersCost,
  netProfit,
  currencySymbol = '£',
  billedPeopleCount,
  helperCount,
}) => {
  const { colors, language } = useApp();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>
          {language === 'pt' ? 'MÉTRICAS FINANCEIRAS' : 'LIVE FINANCIALS'}
        </Text>
        <View style={styles.badges}>
          {billedPeopleCount !== undefined && (
            <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.badgeText, { color: colors.accentDark }]}>
                {billedPeopleCount} {language === 'pt' ? (billedPeopleCount === 1 ? 'pessoa' : 'pessoas') : (billedPeopleCount === 1 ? 'person billed' : 'people billed')}
              </Text>
            </View>
          )}
          {helperCount !== undefined && (
            <View style={[styles.badge, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                {helperCount} {language === 'pt' ? (helperCount === 1 ? 'ajudante' : 'ajudantes') : (helperCount === 1 ? 'helper' : 'helpers')}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.metricsGrid}>
        {/* Gross Charge */}
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {language === 'pt' ? 'Total Cliente' : 'Client Total'}
          </Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {formatCurrency(grossCharge, currencySymbol)}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            {language === 'pt' ? 'Bruto' : 'Gross revenue'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Helpers Cost */}
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {language === 'pt' ? 'Custo Equipe' : 'Team Wages'}
          </Text>
          <Text style={[styles.metricValue, { color: colors.danger }]}>
            -{formatCurrency(helpersCost, currencySymbol)}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            {language === 'pt' ? 'Salários' : 'Staff cost'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Net Profit */}
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
            {language === 'pt' ? 'Lucro Líquido' : 'Net Profit'}
          </Text>
          <Text style={[styles.metricValue, { color: colors.success }]}>
            {formatCurrency(netProfit, currencySymbol)}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            {language === 'pt' ? 'Sua margem' : 'Your margin'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 36,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  metricSub: {
    fontSize: 10,
    marginTop: 2,
  },
});
