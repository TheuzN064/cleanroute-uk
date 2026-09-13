import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Spacing, BorderRadius, Shadows } from '../theme';
import { useApp } from '../context/AppContext';
import { Client } from '../types';
import * as clientRepo from '../database/repositories/clientRepository';
import { Button } from '../components/Button';
import { formatCurrency } from '../utils/calculations';

export const ClientsScreen: React.FC = () => {
  const { clients, refreshClients, openPostcodeInMaps, colors, t, themeMode } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [address, setAddress] = useState('');
  const [hourlyRate, setHourlyRate] = useState('20.00');
  const [defaultBilledPeople, setDefaultBilledPeople] = useState('1');
  const [notes, setNotes] = useState('');

  const filteredClients = clients.filter((c) => {
    const term = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.postcode.toLowerCase().includes(term) ||
      (c.address && c.address.toLowerCase().includes(term))
    );
  });

  const openCreateModal = () => {
    setEditingClient(null);
    setName('');
    setPhone('');
    setPostcode('');
    setAddress('');
    setHourlyRate('22.00');
    setDefaultBilledPeople('1');
    setNotes('');
    setModalVisible(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone || '');
    setPostcode(client.postcode);
    setAddress(client.address || '');
    setHourlyRate(client.hourly_rate.toString());
    setDefaultBilledPeople(client.default_billed_people.toString());
    setNotes(client.notes || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Client name is required.');
      return;
    }
    if (!postcode.trim()) {
      Alert.alert('Validation', 'UK Postcode is required.');
      return;
    }

    const rate = parseFloat(hourlyRate) || 20;
    const people = parseInt(defaultBilledPeople, 10) || 1;

    try {
      if (editingClient) {
        await clientRepo.updateClient({
          ...editingClient,
          name: name.trim(),
          phone: phone.trim() || undefined,
          postcode: postcode.trim().toUpperCase(),
          address: address.trim() || undefined,
          hourly_rate: rate,
          default_billed_people: people,
          notes: notes.trim() || undefined,
        });
      } else {
        await clientRepo.createClient({
          name: name.trim(),
          phone: phone.trim() || undefined,
          postcode: postcode.trim().toUpperCase(),
          address: address.trim() || undefined,
          hourly_rate: rate,
          default_billed_people: people,
          notes: notes.trim() || undefined,
        });
      }

      await refreshClients();
      setModalVisible(false);
    } catch (err) {
      console.error('Error saving client:', err);
      Alert.alert('Error', 'Failed to save client details.');
    }
  };

  const handleDelete = (client: Client) => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to remove ${client.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await clientRepo.deleteClient(client.id);
            await refreshClients();
          },
        },
      ]
    );
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search & Add Bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('clientsSearchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openCreateModal}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Clients List */}
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.clientCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.nameContainer}>
                <Text style={[styles.clientName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.rateBadge, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.rateBadgeText, { color: colors.accentDark }]}>
                      {formatCurrency(item.hourly_rate)}/h
                    </Text>
                  </View>
                  <View style={[styles.peopleBadge, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={[styles.peopleBadgeText, { color: colors.textSecondary }]}>
                      {item.default_billed_people}{' '}
                      {item.default_billed_people === 1 ? t('routePerson') : t('routePeople')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionsMenu}>
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
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Address & Postcode */}
            <View style={styles.detailsRow}>
              <TouchableOpacity
                style={[
                  styles.postcodeButton,
                  {
                    backgroundColor: themeMode === 'dark' ? '#064E3B' : '#F0FDF4',
                    borderColor: colors.success,
                  },
                ]}
                onPress={() => openPostcodeInMaps(item.postcode, item.name)}
              >
                <Ionicons name="navigate-circle" size={18} color={colors.success} />
                <Text
                  style={[
                    styles.postcodeText,
                    { color: themeMode === 'dark' ? '#A7F3D0' : '#166534' },
                  ]}
                >
                  {item.postcode}
                </Text>
              </TouchableOpacity>
              {item.address ? (
                <Text
                  style={[styles.addressText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.address}
                </Text>
              ) : null}
            </View>

            {/* Phone & Notes */}
            <View style={[styles.footerRow, { borderTopColor: colors.borderLight }]}>
              {item.phone ? (
                <TouchableOpacity
                  style={styles.phoneLink}
                  onPress={() => handleCall(item.phone)}
                >
                  <Ionicons name="call" size={14} color={colors.success} />
                  <Text style={[styles.phoneText, { color: colors.success }]}>
                    {item.phone}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.noPhoneText, { color: colors.textMuted }]}>
                  {t('clientsNoPhone')}
                </Text>
              )}

              {item.notes ? (
                <Text
                  style={[styles.notesText, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  "{item.notes}"
                </Text>
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('clientsNoClientsTitle')}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {searchQuery
                ? 'Try a different keyword.'
                : t('clientsNoClientsSub')}
            </Text>
          </View>
        }
      />

      {/* Add / Edit Client Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingClient ? t('clientsEditTitle') : t('clientsAddTitle')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('clientsNameField')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                placeholder="e.g. Lady Eleanor Vance"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('clientsPostcodeField')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                placeholder="e.g. SW1A 1AA or W8 5HH"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                value={postcode}
                onChangeText={setPostcode}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('clientsAddressField')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                placeholder="e.g. 14 Kensington Square"
                placeholderTextColor={colors.textMuted}
                value={address}
                onChangeText={setAddress}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('clientsPhoneField')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                placeholder="e.g. 07700900123"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <View style={styles.rateRow}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {t('clientsRateField')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                    ]}
                    placeholder="22.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {t('clientsDefaultPeopleField')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                    ]}
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={defaultBilledPeople}
                    onChangeText={setDefaultBilledPeople}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('clientsNotesField')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { height: 75, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                multiline
                placeholder="e.g. Key in lockbox code 4912, watch out for dog"
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                title={editingClient ? t('clientsUpdateBtn') : t('clientsSaveBtn')}
                variant="primary"
                size="lg"
                onPress={handleSave}
                style={{ marginTop: Spacing.lg, marginBottom: Spacing.xl }}
              />
            </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  clientCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  nameContainer: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  rateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  rateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  peopleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  peopleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsMenu: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  postcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  postcodeText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 4,
  },
  addressText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  noPhoneText: {
    fontSize: 12,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    maxWidth: '55%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
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
    maxHeight: '90%',
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
  rateRow: {
    flexDirection: 'row',
  },
});
