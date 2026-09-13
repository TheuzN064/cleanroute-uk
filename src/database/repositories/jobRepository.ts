import { getDatabase } from '../db';
import { JobSession, JobHelper, PaymentStatus, JobStatus } from '../../types';

export async function getJobsByDate(dateStr: string): Promise<JobSession[]> {
  const db = await getDatabase();
  const query = `
    SELECT 
      js.*,
      c.name as client_name,
      c.postcode as client_postcode,
      c.address as client_address,
      c.phone as client_phone,
      c.hourly_rate as client_hourly_rate,
      GROUP_CONCAT(h.name, ', ') as assigned_helpers,
      GROUP_CONCAT(h.id, ',') as assigned_helper_ids
    FROM job_sessions js
    JOIN clients c ON c.id = js.client_id
    LEFT JOIN job_helpers jh ON jh.job_id = js.id
    LEFT JOIN helpers h ON h.id = jh.helper_id
    WHERE js.date = ?
    GROUP BY js.id
    ORDER BY 
      CASE js.status 
        WHEN 'IN_PROGRESS' THEN 1 
        WHEN 'SCHEDULED' THEN 2 
        WHEN 'COMPLETED' THEN 3 
        ELSE 4 
      END,
      js.id ASC
  `;
  return await db.getAllAsync<JobSession>(query, [dateStr]);
}

/**
 * Returns counts of jobs per date in a given range for calendar dots/indicators.
 */
export async function getJobDatesWithCount(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string; count: number }>(
    `SELECT date, COUNT(DISTINCT id) as count 
     FROM job_sessions 
     WHERE date >= ? AND date <= ? 
     GROUP BY date`,
    [startDate, endDate]
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.date] = row.count;
  }
  return result;
}

export async function assignHelpersToJob(jobId: number, helperIds: number[]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM job_helpers WHERE job_id = ?', [jobId]);
  for (const helperId of helperIds) {
    const helper = await db.getFirstAsync<{ hourly_rate: number }>(
      'SELECT hourly_rate FROM helpers WHERE id = ?',
      [helperId]
    );
    const rate = helper?.hourly_rate || 0;
    await db.runAsync(
      `INSERT INTO job_helpers (job_id, helper_id, helper_rate_snapshot, helper_earnings)
       VALUES (?, ?, ?, 0)`,
      [jobId, helperId, rate]
    );
  }
}

export async function getJobById(
  id: number
): Promise<{ job: JobSession; helpers: JobHelper[] } | null> {
  const db = await getDatabase();
  const query = `
    SELECT 
      js.*,
      c.name as client_name,
      c.postcode as client_postcode,
      c.address as client_address,
      c.phone as client_phone,
      c.hourly_rate as client_hourly_rate
    FROM job_sessions js
    JOIN clients c ON c.id = js.client_id
    WHERE js.id = ?
  `;
  const job = await db.getFirstAsync<JobSession>(query, [id]);
  if (!job) return null;

  const helperQuery = `
    SELECT 
      jh.*,
      h.name as helper_name
    FROM job_helpers jh
    JOIN helpers h ON h.id = jh.helper_id
    WHERE jh.job_id = ?
  `;
  const helpers = await db.getAllAsync<JobHelper>(helperQuery, [id]);

  return { job, helpers };
}

export async function getActiveJobSession(): Promise<JobSession | null> {
  const db = await getDatabase();
  const query = `
    SELECT 
      js.*,
      c.name as client_name,
      c.postcode as client_postcode,
      c.address as client_address,
      c.phone as client_phone,
      c.hourly_rate as client_hourly_rate
    FROM job_sessions js
    JOIN clients c ON c.id = js.client_id
    WHERE js.status = 'IN_PROGRESS'
    ORDER BY js.id DESC
    LIMIT 1
  `;
  const row = await db.getFirstAsync<JobSession>(query);
  return row || null;
}

export async function createJobSession(params: {
  clientId: number;
  date: string;
  billedPeopleCount: number;
  notes?: string;
  status?: JobStatus;
  startTime?: string;
  helperIds?: number[];
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO job_sessions (
      client_id, date, billed_people_count, notes, status, start_time, payment_status, total_client_charge, total_helpers_cost, net_profit
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, 0, 0)`,
    [
      params.clientId,
      params.date,
      Math.max(1, params.billedPeopleCount),
      params.notes || null,
      params.status || 'SCHEDULED',
      params.startTime || null,
    ]
  );
  const jobId = result.lastInsertRowId;

  if (params.helperIds && params.helperIds.length > 0) {
    for (const helperId of params.helperIds) {
      const helper = await db.getFirstAsync<{ hourly_rate: number }>(
        'SELECT hourly_rate FROM helpers WHERE id = ?',
        [helperId]
      );
      const rate = helper?.hourly_rate || 0;
      await db.runAsync(
        `INSERT INTO job_helpers (job_id, helper_id, helper_rate_snapshot, helper_earnings)
         VALUES (?, ?, ?, 0)`,
        [jobId, helperId, rate]
      );
    }
  }

  return jobId;
}

export async function createBatchJobSessions(params: {
  clientId: number;
  dates: string[];
  billedPeopleCount: number;
  notes?: string;
  helperIds?: number[];
}): Promise<number[]> {
  const createdIds: number[] = [];
  for (const d of params.dates) {
    const id = await createJobSession({
      clientId: params.clientId,
      date: d,
      billedPeopleCount: params.billedPeopleCount,
      notes: params.notes,
      helperIds: params.helperIds,
    });
    createdIds.push(id);
  }
  return createdIds;
}

/**
 * Resilient start: records current ISO timestamp in SQLite so crashes or restarts
 * calculate accurate elapsed duration from SQLite.
 */
export async function startJobSession(jobId: number): Promise<void> {
  const db = await getDatabase();
  const startTimeIso = new Date().toISOString();
  await db.runAsync(
    `UPDATE job_sessions 
     SET status = 'IN_PROGRESS', 
         start_time = COALESCE(start_time, ?)
     WHERE id = ?`,
    [startTimeIso, jobId]
  );
}

/**
 * Completes a job session with all final calculations and writes helper snapshots.
 */
export async function completeJobSession(params: {
  jobId: number;
  endTimeIso: string;
  durationMinutes: number;
  billedPeopleCount: number;
  totalClientCharge: number;
  totalHelpersCost: number;
  netProfit: number;
  notes?: string;
  helperSnapshots: {
    helperId: number;
    rateSnapshot: number;
    earnings: number;
  }[];
}): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE job_sessions
     SET status = 'COMPLETED',
         end_time = ?,
         manual_duration_minutes = ?,
         billed_people_count = ?,
         total_client_charge = ?,
         total_helpers_cost = ?,
         net_profit = ?,
         notes = COALESCE(?, notes)
     WHERE id = ?`,
    [
      params.endTimeIso,
      Math.round(params.durationMinutes),
      Math.max(1, params.billedPeopleCount),
      params.totalClientCharge,
      params.totalHelpersCost,
      params.netProfit,
      params.notes || null,
      params.jobId,
    ]
  );

  // Clear previous helper snapshots for this job if any
  await db.runAsync('DELETE FROM job_helpers WHERE job_id = ?', [params.jobId]);

  // Insert helper earnings snapshots
  for (const h of params.helperSnapshots) {
    await db.runAsync(
      `INSERT INTO job_helpers (job_id, helper_id, helper_rate_snapshot, helper_earnings)
       VALUES (?, ?, ?, ?)`,
      [params.jobId, h.helperId, h.rateSnapshot, h.earnings]
    );
  }
}

export async function updatePaymentStatus(
  jobId: number,
  paymentStatus: PaymentStatus
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE job_sessions SET payment_status = ? WHERE id = ?',
    [paymentStatus, jobId]
  );
}

export async function deleteJobSession(jobId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM job_sessions WHERE id = ?', [jobId]);
}
