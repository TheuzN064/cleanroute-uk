import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../theme';

interface BadgeProps {
  label: string;
  variant?: 'scheduled' | 'in_progress' | 'completed' | 'paid' | 'pending' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', size = 'sm' }) => {
  const getColors = () => {
    switch (variant) {
      case 'in_progress':
        return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' }; // Amber
      case 'completed':
        return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' }; // Sky
      case 'paid':
        return { bg: '#D1FAE5', text: '#047857', border: '#A7F3D0' }; // Emerald
      case 'pending':
        return { bg: '#FFE4E6', text: '#BE123C', border: '#FECDD3' }; // Rose
      case 'scheduled':
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' }; // Slate
      default:
        return { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
    }
  };

  const styleColors = getColors();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: styleColors.bg,
          borderColor: styleColors.border,
          paddingVertical: isSm ? 3 : 5,
          paddingHorizontal: isSm ? 8 : 12,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: styleColors.text,
            fontSize: isSm ? 11 : 13,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
