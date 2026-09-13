import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns';
import { Spacing, BorderRadius, Shadows } from '../theme';
import { useApp } from '../context/AppContext';
import { JobSession, Helper } from '../types';
import * as jobRepo from '../database/repositories/jobRepository';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { formatCurrency } from '../utils/calculations';

interface RouteScreenProps {
  onNavigateToJob: () => void;
}

export const RouteScreen: React.FC<RouteScreenProps> = ({ onNavigateToJob }) => {
  const {
    clients,
    helpers,
    activeJob,
    startJob,
    openPostcodeInMaps,
    sendJobInvoiceWhatsApp,
    settings,
    colors,
    t,
    language,
    themeMode,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [jobs, setJobs] = useState<JobSession[]>([]);
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Month Calendar Modal
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Schedule Job Modal State
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [scheduleHelperIds, setScheduleHelperIds] = useState<number[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'single' | 'repeat'>('single');
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([1]); // 1 = Seg, 2 = Ter, etc.
  const [repeatWeeksCount, setRepeatWeeksCount] = useState<number>(4);
  const [billedPeopleInput, setBilledPeopleInput] = useState('1');
  const [jobNotesInput, setJobNotesInput] = useState('');

  // Quick Staff Assignment Modal (from Job card)
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [jobToAssign, setJobToAssign] = useState<JobSession | null>(null);
  const [assignHelperIds, setAssignHelperIds] = useState<number[]>([]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedToday = isToday(selectedDate);

  // Weekdays header labels
  const weekdayNames = useMemo(() => {
    return language === 'pt'
      ? [t('routeDayMon'), t('routeDayTue'), t('routeDayWed'), t('routeDayThu'), t('routeDayFri'), t('routeDaySat'), t('routeDaySun')]
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }, [language, t]);

  // Current 7 days of the active week
  const currentWeekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [selectedDate]);

  // Load jobs for selected date and load calendar dots
  const loadJobsAndCounts = useCallback(async () => {
    try {
      const data = await jobRepo.getJobsByDate(dateStr);
      setJobs(data);

      // Load counts for current visible month +/- 1 month
      const startRange = format(subMonths(startOfMonth(selectedDate), 1), 'yyyy-MM-dd');
      const endRange = format(addMonths(endOfMonth(selectedDate), 1), 'yyyy-MM-dd');
      const counts = await jobRepo.getJobDatesWithCount(startRange, endRange);
      setJobCounts(counts);
    } catch (err) {
      console.error('Error loading jobs/counts for date:', err);
    }
  }, [dateStr, selectedDate]);

  useEffect(() => {
    loadJobsAndCounts();
  }, [loadJobsAndCounts, activeJob]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobsAndCounts();
    setRefreshing(false);
  };

  // Week navigation
  const handlePrevWeek = () => setSelectedDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setSelectedDate((prev) => addWeeks(prev, 1));
  const handleGoToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setCalendarMonth(now);
  };

  // Month navigation in Modal
  const handlePrevMonth = () => setCalendarMonth((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCalendarMonth((prev) => addMonths(prev, 1));

  // Calendar grid days for Month Modal
  const monthCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  // Quick Staff Assignment handler
  const handleOpenAssignModal = (job: JobSession) => {
    setJobToAssign(job);
    const currentIds = job.assigned_helper_ids
      ? job.assigned_helper_ids
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter(Boolean)
      : [];
    setAssignHelperIds(currentIds);
    setAssignModalVisible(true);
  };

  const handleSaveStaffAssignment = async () => {
    if (!jobToAssign) return;
    await jobRepo.assignHelpersToJob(jobToAssign.id, assignHelperIds);
    setAssignModalVisible(false);
    setJobToAssign(null);
    await loadJobsAndCounts();
  };

  // Create Job(s) handler
  const handleCreateJob = async () => {
    if (!selectedClientId) {
      Alert.alert(
        language === 'pt' ? 'Seleção Obrigatória' : 'Selection Required',
        language === 'pt' ? 'Selecione um cliente para agendar.' : 'Please select a client to schedule.'
      );
      return;
    }
    const count = parseInt(billedPeopleInput, 10) || 1;

    if (scheduleMode === 'single') {
      await jobRepo.createJobSession({
        clientId: selectedClientId,
        date: dateStr,
        billedPeopleCount: count,
        notes: jobNotesInput,
        status: 'SCHEDULED',
        helperIds: scheduleHelperIds,
      });
    } else {
      // Repeat Mode: create batch across selected weekdays for repeatWeeksCount weeks
      if (repeatWeekdays.length === 0) {
        Alert.alert(
          language === 'pt' ? 'Atenção' : 'Warning',
          language === 'pt'
            ? 'Selecione pelo menos um dia da semana para repetir.'
            : 'Please select at least one weekday to repeat.'
        );
        return;
      }

      const datesToSchedule: string[] = [];
      const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

      for (let w = 0; w < repeatWeeksCount; w++) {
        const weekBase = addWeeks(currentWeekStart, w);
        for (const weekdayIdx of repeatWeekdays) {
          // weekdayIdx: 1 = Mon, 2 = Tue, ..., 7 = Sun
          const targetDay = addDays(weekBase, weekdayIdx - 1);
          datesToSchedule.push(format(targetDay, 'yyyy-MM-dd'));
        }
      }

      const uniqueDates = Array.from(new Set(datesToSchedule)).sort();
      await jobRepo.createBatchJobSessions({
        clientId: selectedClientId,
        dates: uniqueDates,
        billedPeopleCount: count,
        notes: jobNotesInput,
        helperIds: scheduleHelperIds,
      });

      Alert.alert(
        language === 'pt' ? 'Sucesso!' : 'Success!',
        `${uniqueDates.length} ${t('routeBatchSuccess')}`
      );
    }

    setScheduleModalVisible(false);
    setSelectedClientId(null);
    setScheduleHelperIds([]);
    setJobNotesInput('');
    setBilledPeopleInput('1');
    setScheduleMode('single');
    await loadJobsAndCounts();
  };

  const handleStartJob = async (job: JobSession) => {
    if (activeJob && activeJob.id !== job.id) {
      Alert.alert(
        language === 'pt' ? 'Outro Job em Andamento' : 'Job Already Active',
        language === 'pt'
          ? 'Você já tem outro serviço em andamento. Conclua ou cancele-o antes de iniciar um novo.'
          : 'You have another job currently in progress. Finish or cancel it before starting a new one.'
      );
      return;
    }
    await startJob(job);
    onNavigateToJob();
  };

  const handleTogglePayment = async (job: JobSession) => {
    const nextStatus = job.payment_status === 'PAID' ? 'PENDING' : 'PAID';
    await jobRepo.updatePaymentStatus(job.id, nextStatus);
    await loadJobsAndCounts();
  };

  const handleDeleteJob = (jobId: number) => {
    Alert.alert(
      language === 'pt' ? 'Excluir Serviço' : 'Delete Job',
      language === 'pt'
        ? 'Tem certeza de que deseja remover este serviço agendado?'
        : 'Are you sure you want to remove this scheduled job?',
      [
        { text: language === 'pt' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: language === 'pt' ? 'Excluir' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await jobRepo.deleteJobSession(jobId);
            await loadJobsAndCounts();
          },
        },
      ]
    );
  };

  const totalRevenue = jobs.reduce((acc, j) => acc + (j.total_client_charge || 0), 0);
  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length;

  const renderJobCard = ({ item }: { item: JobSession }) => {
    const isCurrentActive = activeJob?.id === item.id;
    const isCompleted = item.status === 'COMPLETED';

    return (
      <View
        style={[
          styles.jobCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isCurrentActive && { borderColor: colors.warning, borderWidth: 2 },
        ]}
      >
        {/* Top bar: Client Name & Status */}
        <View style={styles.cardHeader}>
          <View style={styles.clientInfo}>
            <Text style={[styles.clientName, { color: colors.text }]}>
              {item.client_name}
            </Text>
            <View style={styles.badgeRow}>
              <Badge
                label={item.status.replace('_', ' ')}
                variant={
                  item.status === 'IN_PROGRESS'
                    ? 'in_progress'
                    : item.status === 'COMPLETED'
                    ? 'completed'
                    : 'scheduled'
                }
              />
              {isCompleted && (
                <TouchableOpacity onPress={() => handleTogglePayment(item)}>
                  <Badge
                    label={item.payment_status}
                    variant={item.payment_status === 'PAID' ? 'paid' : 'pending'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.deleteIcon}
            onPress={() => handleDeleteJob(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Location and Postcode */}
        <View style={styles.locationContainer}>
          <Ionicons name="location-sharp" size={16} color={colors.accent} />
          <Text style={[styles.postcodeText, { color: colors.accent }]}>
            {item.client_postcode}
          </Text>
          {item.client_address ? (
            <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={1}>
              • {item.client_address}
            </Text>
          ) : null}
        </View>

        {/* ASSIGNED STAFF / QUEM VAI FAZER ROW */}
        <TouchableOpacity
          style={[styles.staffRow, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderLight }]}
          activeOpacity={0.7}
          onPress={() => handleOpenAssignModal(item)}
        >
          <View style={styles.staffLeft}>
            <Ionicons
              name={item.assigned_helpers ? 'people' : 'person-add-outline'}
              size={17}
              color={item.assigned_helpers ? colors.accent : colors.textMuted}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={[styles.staffLabel, { color: colors.textMuted }]}>
                {t('routeAssignedStaff')}
              </Text>
              <Text
                style={[
                  styles.staffNames,
                  { color: item.assigned_helpers ? colors.text : colors.accent },
                ]}
                numberOfLines={1}
              >
                {item.assigned_helpers || t('routeNoStaffAssigned')}
              </Text>
            </View>
          </View>
          <View style={styles.staffEditBadge}>
            <Text style={[styles.staffEditText, { color: colors.accent }]}>
              {item.assigned_helpers ? t('routeChangeStaff') : '+ Atribuir'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </TouchableOpacity>

        {/* Job Details & Pricing */}
        <View style={[styles.metaRow, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              {t('routeAgreedRate')}
            </Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {formatCurrency(item.client_hourly_rate || 0)}/h
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
              {t('routeBilledTeam')}
            </Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {item.billed_people_count} {item.billed_people_count === 1 ? t('routePerson') : t('routePeople')}
            </Text>
          </View>
          {isCompleted && (
            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>
                {t('routeCharged')}
              </Text>
              <Text style={[styles.metaValue, { color: colors.success }]}>
                {formatCurrency(item.total_client_charge)}
              </Text>
            </View>
          )}
        </View>

        {item.notes ? (
          <View
            style={[
              styles.notesBox,
              { backgroundColor: themeMode === 'dark' ? '#3B2904' : '#FEF3C7' },
            ]}
          >
            <Text style={[styles.notesText, { color: themeMode === 'dark' ? '#FDE68A' : '#92400E' }]}>
              {item.notes}
            </Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <Button
            title={t('routeOpenRoute')}
            variant="outline"
            size="sm"
            icon={<Ionicons name="navigate" size={15} color={colors.accent} />}
            onPress={() => openPostcodeInMaps(item.client_postcode || '', item.client_name)}
            style={styles.actionBtn}
          />

          {!isCompleted ? (
            <Button
              title={isCurrentActive ? t('routeViewTimer') : t('routeStartJob')}
              variant={isCurrentActive ? 'warning' : 'primary'}
              size="sm"
              icon={
                <Ionicons
                  name={isCurrentActive ? 'timer' : 'play'}
                  size={15}
                  color="#FFFFFF"
                />
              }
              onPress={() => {
                if (isCurrentActive) {
                  onNavigateToJob();
                } else {
                  handleStartJob(item);
                }
              }}
              style={styles.actionBtn}
            />
          ) : (
            <Button
              title={t('routeSendInvoice')}
              variant="success"
              size="sm"
              icon={<Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />}
              onPress={() => sendJobInvoiceWhatsApp(item)}
              style={styles.actionBtn}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. DYNAMIC TOP BAR: MONTH TITLE, FULL CALENDAR MODAL TRIGGER & TODAY BUTTON */}
      <View
        style={[
          styles.headerBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.monthSelectorBtn}
            onPress={() => {
              setCalendarMonth(selectedDate);
              setMonthModalVisible(true);
            }}
          >
            <Ionicons name="calendar" size={19} color={colors.accent} />
            <Text style={[styles.monthSelectorText, { color: colors.text }]}>
              {format(selectedDate, 'MMMM yyyy')}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          {!isSelectedToday && (
            <TouchableOpacity
              onPress={handleGoToday}
              style={[styles.todayPill, { backgroundColor: colors.accentLight }]}
            >
              <Text style={[styles.todayPillText, { color: colors.accent }]}>
                {language === 'pt' ? 'Hoje' : 'Today'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.weekNavArrows}>
            <TouchableOpacity onPress={handlePrevWeek} style={styles.arrowBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextWeek} style={styles.arrowBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. INTERACTIVE WEEK STRIP (7 DAYS - 1 TAP SWITCHING & SCHEDULE DOTS) */}
      <View
        style={[
          styles.weekStripContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {currentWeekDays.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isDayToday = isToday(day);
          const dayDateStr = format(day, 'yyyy-MM-dd');
          const dayJobCount = jobCounts[dayDateStr] || 0;

          return (
            <TouchableOpacity
              key={dayDateStr}
              style={[
                styles.dayCard,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderLight },
                isDayToday && { borderColor: colors.accent, borderWidth: 1.5 },
                isSelected && {
                  backgroundColor: colors.accent,
                  borderColor: colors.accent,
                  ...Shadows.card,
                },
              ]}
              onPress={() => setSelectedDate(day)}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: colors.textMuted },
                  isSelected && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                {weekdayNames[idx]}
              </Text>

              <Text
                style={[
                  styles.dayNumber,
                  { color: colors.text },
                  isSelected && { color: '#FFFFFF' },
                  isDayToday && !isSelected && { color: colors.accent },
                ]}
              >
                {format(day, 'd')}
              </Text>

              {/* Scheduled Jobs Dot / Badge */}
              <View style={styles.dotContainer}>
                {dayJobCount > 0 ? (
                  <View
                    style={[
                      styles.jobCountDot,
                      { backgroundColor: isSelected ? '#FFFFFF' : colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.jobCountText,
                        { color: isSelected ? colors.accent : '#FFFFFF' },
                      ]}
                    >
                      {dayJobCount}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyDot} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. DAILY SUMMARY METRICS */}
      <View
        style={[
          styles.kpiContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiNumber, { color: colors.text }]}>{jobs.length}</Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
            {t('routeTotalJobs')}
          </Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiNumber, { color: colors.accent }]}>
            {completedCount}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
            {t('routeCompleted')}
          </Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiNumber, { color: colors.success }]}>
            {formatCurrency(totalRevenue, settings.currency_symbol)}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>
            {t('routeProjectedRevenue')}
          </Text>
        </View>
      </View>

      {/* 4. JOBS LIST FOR SELECTED DAY */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderJobCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={46} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('routeNoJobsTitle')}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {isSelectedToday
                ? t('routeNoJobsSub')
                : `${language === 'pt' ? 'Nenhum serviço planejado para' : 'No jobs planned for'} ${format(selectedDate, 'd MMMM')}.`}
            </Text>
            <Button
              title={t('routeScheduleBtn')}
              variant="primary"
              size="md"
              icon={<Ionicons name="add" size={18} color="#FFFFFF" />}
              onPress={() => setScheduleModalVisible(true)}
              style={styles.emptyAddBtn}
            />
          </View>
        }
      />

      {/* Floating Add Job Button */}
      {jobs.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={() => setScheduleModalVisible(true)}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ============================================================ */}
      {/* 5. MONTH CALENDAR MODAL (VIEW WHOLE MONTH AT A GLANCE)         */}
      {/* ============================================================ */}
      <Modal visible={monthModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.monthModalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.monthNavHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.monthNavTitle, { color: colors.text }]}>
                {format(calendarMonth, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday letters */}
            <View style={styles.monthWeekdayRow}>
              {weekdayNames.map((name, i) => (
                <Text key={i} style={[styles.monthWeekdayText, { color: colors.textMuted }]}>
                  {name}
                </Text>
              ))}
            </View>

            {/* Grid of days */}
            <View style={styles.monthGrid}>
              {monthCalendarDays.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, calendarMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isDayToday = isToday(day);
                const count = jobCounts[dayStr] || 0;

                return (
                  <TouchableOpacity
                    key={dayStr}
                    style={[
                      styles.monthCell,
                      isSelected && { backgroundColor: colors.accent, borderRadius: 10 },
                      isDayToday && !isSelected && { borderWidth: 1, borderColor: colors.accent, borderRadius: 10 },
                    ]}
                    onPress={() => {
                      setSelectedDate(day);
                      setMonthModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        { color: isCurrentMonth ? colors.text : colors.textMuted },
                        isSelected && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                    {count > 0 && (
                      <View
                        style={[
                          styles.monthJobDot,
                          { backgroundColor: isSelected ? '#FFFFFF' : colors.accent },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.monthModalFooter}>
              <Button
                title={language === 'pt' ? 'Ir para Hoje' : 'Go to Today'}
                variant="outline"
                size="sm"
                onPress={() => {
                  handleGoToday();
                  setMonthModalVisible(false);
                }}
              />
              <Button
                title={t('routeCloseCalendar')}
                variant="secondary"
                size="sm"
                onPress={() => setMonthModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 6. QUICK STAFF ASSIGNMENT MODAL (TAP FROM ANY JOB CARD)       */}
      {/* ============================================================ */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('routeAssignStaffTitle')}
                </Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  {jobToAssign?.client_name} ({jobToAssign?.date})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {t('routeSelectStaffPrompt')}
            </Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {helpers.map((h) => {
                const isSelected = assignHelperIds.includes(h.id);
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[
                      styles.helperOptionCard,
                      { borderColor: colors.borderLight, backgroundColor: colors.surfaceSubtle },
                      isSelected && { borderColor: colors.accent, backgroundColor: colors.accentLight },
                    ]}
                    onPress={() => {
                      setAssignHelperIds((prev) =>
                        prev.includes(h.id) ? prev.filter((id) => id !== h.id) : [...prev, h.id]
                      );
                    }}
                  >
                    <View style={styles.helperOptionInfo}>
                      <View style={[styles.helperAvatar, { backgroundColor: colors.accent }]}>
                        <Text style={styles.helperAvatarText}>{h.name.charAt(0)}</Text>
                      </View>
                      <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.helperOptionName, { color: colors.text }]}>
                          {h.name}
                        </Text>
                        <Text style={[styles.helperOptionRate, { color: colors.textMuted }]}>
                          £{h.hourly_rate.toFixed(2)}/h
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Button
              title={t('routeSaveAssignment')}
              variant="primary"
              size="lg"
              onPress={handleSaveStaffAssignment}
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 7. SCHEDULE JOB MODAL (WITH HELPER SELECTION & BATCH REPEAT)  */}
      {/* ============================================================ */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('routeModalTitle')}
              </Text>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '82%' }}>
              {/* PASSO 1: CLIENTE */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('routeSelectClient')} *
              </Text>
              <ScrollView
                style={[styles.clientPicker, { borderColor: colors.border }]}
                nestedScrollEnabled
              >
                {clients.map((c) => {
                  const isSelected = selectedClientId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clientPickerItem,
                        { borderBottomColor: colors.borderLight },
                        isSelected && { backgroundColor: colors.accentLight },
                      ]}
                      onPress={() => {
                        setSelectedClientId(c.id);
                        setBilledPeopleInput(c.default_billed_people.toString());
                      }}
                    >
                      <View>
                        <Text
                          style={[
                            styles.clientPickerName,
                            { color: colors.text },
                            isSelected && { color: colors.accentDark, fontWeight: '800' },
                          ]}
                        >
                          {c.name}
                        </Text>
                        <Text style={[styles.clientPickerPostcode, { color: colors.textMuted }]}>
                          {c.postcode} • £{c.hourly_rate}/h
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* PASSO 2: QUEM VAI FAZER (SELEÇÃO DE EQUIPE / HELPERS) */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('routeAssignedStaff')} (Equipe)
              </Text>
              <View style={styles.helpersWrap}>
                {helpers.map((h) => {
                  const isSelected = scheduleHelperIds.includes(h.id);
                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[
                        styles.helperChip,
                        { borderColor: colors.borderLight, backgroundColor: colors.surfaceSubtle },
                        isSelected && { borderColor: colors.accent, backgroundColor: colors.accentLight },
                      ]}
                      onPress={() => {
                        setScheduleHelperIds((prev) =>
                          prev.includes(h.id) ? prev.filter((id) => id !== h.id) : [...prev, h.id]
                        );
                      }}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'person-outline'}
                        size={15}
                        color={isSelected ? colors.accent : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.helperChipText,
                          { color: colors.text },
                          isSelected && { color: colors.accentDark, fontWeight: '800' },
                        ]}
                      >
                        {h.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* PASSO 3: MODO DE AGENDAMENTO (DATA ÚNICA VS RECORRÊNCIA / MÚLTIPLOS DIAS) */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Programação de Datas
              </Text>
              <View style={[styles.scheduleModeTabs, { backgroundColor: colors.surfaceSubtle }]}>
                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    scheduleMode === 'single' && { backgroundColor: colors.surface, ...Shadows.card },
                  ]}
                  onPress={() => setScheduleMode('single')}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: colors.textSecondary },
                      scheduleMode === 'single' && { color: colors.text, fontWeight: '800' },
                    ]}
                  >
                    {t('routeScheduleModeSingle')} ({format(selectedDate, 'd MMM')})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    scheduleMode === 'repeat' && { backgroundColor: colors.surface, ...Shadows.card },
                  ]}
                  onPress={() => setScheduleMode('repeat')}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: colors.textSecondary },
                      scheduleMode === 'repeat' && { color: colors.accent, fontWeight: '800' },
                    ]}
                  >
                    {t('routeScheduleModeRepeat')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SELEÇÃO DE DIAS DA SEMANA E QUANTIDADE DE SEMANAS (SE RECORRÊNCIA ATIVADA) */}
              {scheduleMode === 'repeat' && (
                <View
                  style={[
                    styles.repeatBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderLight },
                  ]}
                >
                  <Text style={[styles.repeatSubTitle, { color: colors.textSecondary }]}>
                    {t('routeSelectWeekdays')}
                  </Text>
                  <View style={styles.weekdayPillRow}>
                    {weekdayNames.map((name, i) => {
                      const dayVal = i + 1; // 1 = Mon, 7 = Sun
                      const isChecked = repeatWeekdays.includes(dayVal);
                      return (
                        <TouchableOpacity
                          key={dayVal}
                          style={[
                            styles.weekdayPill,
                            { borderColor: colors.borderLight, backgroundColor: colors.surface },
                            isChecked && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                          onPress={() => {
                            setRepeatWeekdays((prev) =>
                              prev.includes(dayVal)
                                ? prev.filter((d) => d !== dayVal)
                                : [...prev, dayVal]
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.weekdayPillText,
                              { color: colors.text },
                              isChecked && { color: '#FFFFFF', fontWeight: '800' },
                            ]}
                          >
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.repeatSubTitle, { color: colors.textSecondary, marginTop: 12 }]}>
                    {t('routeSelectWeeksCount')}
                  </Text>
                  <View style={styles.weeksRow}>
                    {[2, 4, 8].map((w) => {
                      const isSelectedWeeks = repeatWeeksCount === w;
                      return (
                        <TouchableOpacity
                          key={w}
                          style={[
                            styles.weekCountBtn,
                            { borderColor: colors.borderLight, backgroundColor: colors.surface },
                            isSelectedWeeks && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                          onPress={() => setRepeatWeeksCount(w)}
                        >
                          <Text
                            style={[
                              styles.weekCountBtnText,
                              { color: colors.text },
                              isSelectedWeeks && { color: '#FFFFFF', fontWeight: '800' },
                            ]}
                          >
                            {w} {t('routeWeeks')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.batchPreviewNote, { color: colors.accent }]}>
                    💡 {repeatWeekdays.length * repeatWeeksCount} {t('routePreviewBatch')}
                  </Text>
                </View>
              )}

              {/* PASSO 4: MULTIPLICADOR DE PESSOAS */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('routeBilledPeopleLabel')}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                keyboardType="numeric"
                value={billedPeopleInput}
                onChangeText={setBilledPeopleInput}
                placeholder="e.g. 2"
                placeholderTextColor={colors.textMuted}
              />

              {/* PASSO 5: OBSERVAÇÕES */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('routeNotesLabel')}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { height: 60, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
                ]}
                multiline
                value={jobNotesInput}
                onChangeText={setJobNotesInput}
                placeholder="e.g. Bring extra vacuum bags, key code 1234"
                placeholderTextColor={colors.textMuted}
              />

              <Button
                title={t('routeConfirmSchedule')}
                variant="primary"
                size="lg"
                onPress={handleCreateJob}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
  },
  monthSelectorText: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  todayPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  weekNavArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowBtn: {
    padding: 6,
  },
  weekStripContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  dayCard: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  dotContainer: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  jobCountDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobCountText: {
    fontSize: 9,
    fontWeight: '800',
  },
  emptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: 90,
  },
  jobCard: {
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
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  deleteIcon: {
    padding: Spacing.xs,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  postcodeText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  addressText: {
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginVertical: Spacing.xs,
  },
  staffLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  staffLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  staffNames: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  staffEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  staffEditText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  metaCol: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  notesBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: Spacing.lg,
  },
  emptyAddBtn: {
    minWidth: 220,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.elevated,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 13,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  clientPicker: {
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  clientPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  clientPickerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  clientPickerPostcode: {
    fontSize: 12,
    marginTop: 2,
  },
  helpersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  helperChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleModeTabs: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: 3,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  repeatBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  repeatSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  weekdayPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekdayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  weekdayPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  weeksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekCountBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  weekCountBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  batchPreviewNote: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  helperOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  helperOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helperAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  helperOptionName: {
    fontSize: 15,
    fontWeight: '700',
  },
  helperOptionRate: {
    fontSize: 12,
  },
  monthModalCard: {
    margin: 20,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.elevated,
  },
  monthNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  monthNavTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  monthWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  monthWeekdayText: {
    fontSize: 12,
    fontWeight: '700',
    width: 38,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  monthCell: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthJobDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  monthModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: 10,
  },
});
