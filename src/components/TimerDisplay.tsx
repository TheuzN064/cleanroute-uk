import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '../theme';
import { formatStopwatchTime } from '../utils/timer';
import { formatMinutesDisplay } from '../utils/calculations';

interface TimerDisplayProps {
  elapsedSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  isManual?: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  elapsedSeconds,
  isRunning,
  isPaused,
  isManual = false,
}) => {
  const formattedTime = formatStopwatchTime(elapsedSeconds);
  const minutes = Math.floor(elapsedSeconds / 60);

  const getStatusText = () => {
    if (isManual) return 'MANUAL DURATION';
    if (isRunning) return 'RECORDING TIME';
    if (isPaused) return 'PAUSED';
    return 'STANDBY';
  };

  const getStatusColor = () => {
    if (isManual) return '#38BDF8';
    if (isRunning) return '#10B981';
    if (isPaused) return '#F59E0B';
    return '#94A3B8';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      <Text style={styles.timeText}>{formattedTime}</Text>

      <View style={styles.detailsRow}>
        <Text style={styles.subtext}>
          Total: {formatMinutesDisplay(minutes)} ({(minutes / 60).toFixed(2)}h)
        </Text>
        {isManual && (
          <View style={styles.manualTag}>
            <Text style={styles.manualTagText}>EDITED</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B1329',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    ...Shadows.elevated,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  timeText: {
    fontSize: 52,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: '#F8FAFC',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtext: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  manualTag: {
    marginLeft: Spacing.sm,
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
