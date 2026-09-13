import { getDatabase } from '../db';
import { Helper, HelperWeeklySummary } from '../../types';

export async function getAllHelpers(activeOnly: boolean = false): Promise<Helper[]> {
  const db = await getDatabase();
  if (activeOnly) {
    return await db.getAllAsync<Helper>(
      'SELECT * FROM helpers WHERE is_active = 1 ORDER BY name ASC'
    );
  }
  return await db.getAllAsync<Helper>(
    'SELECT * FROM helpers ORDER BY is_active DESC, name ASC'
  );
}

export async function getHelperById(id: number): Promise<Helper | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Helper>(
    'SELECT * FROM helpers WHERE id = ?',
    [id]
  );
  return row || null;
}

export async function createHelper(name: string, hourlyRate: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO helpers (name, hourly_rate, is_active) VALUES (?, ?, 1)',
    [name.trim(), Number(hourlyRate)]
  );
  return result.lastInsertRowId;
}

export async function updateHelper(
  id: number,
  name: string,
  hourlyRate: number,
  isActive: boolean
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE helpers SET name = ?, hourly_rate = ?, is_active = ? WHERE id = ?',
    [name.trim(), Number(hourlyRate), isActive ? 1 : 0, id]
  );
}

export async function deleteHelper(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM helpers WHERE id = ?', [id]);
}

/**
 * Returns weekly breakdown for each helper:
 * total hours worked, total earnings, and job count between start and end dates.
 */
export async function getHelperWeeklyStatements(
  startDate: string,
  endDate: string
): Promise<HelperWeeklySummary[]> {
  const db = await getDatabase();
  
  // Query helpers and their earnings within the date window
  const query = `
    SELECT 
      h.id as helperId,
      h.name as helperName,
      h.hourly_rate as hourlyRate,
      COALESCE(SUM(
        CASE 
          WHEN js.manual_duration_minutes IS NOT NULL AND js.manual_duration_minutes > 0 
          THEN js.manual_duration_minutes
          WHEN js.start_time IS NOT NULL AND js.end_time IS NOT NULL 
          THEN (strftime('%s', js.end_time) - strftime('%s', js.start_time)) / 60
          ELSE 0
        END
      ), 0) as totalMinutes,
      COALESCE(SUM(jh.helper_earnings), 0) as totalEarnings,
      COUNT(DISTINCT js.id) as jobCount
    FROM helpers h
    LEFT JOIN job_helpers jh ON jh.helper_id = h.id
    LEFT JOIN job_sessions js ON js.id = jh.job_id 
      AND js.date >= ? AND js.date <= ? 
      AND js.status = 'COMPLETED'
    GROUP BY h.id, h.name, h.hourly_rate
    ORDER BY totalEarnings DESC, h.name ASC
  `;

  const rows = await db.getAllAsync<{
    helperId: number;
    helperName: string;
    hourlyRate: number;
    totalMinutes: number;
    totalEarnings: number;
    jobCount: number;
  }>(query, [startDate, endDate]);

  return rows.map((r) => ({
    helperId: r.helperId,
    helperName: r.helperName,
    hourlyRate: r.hourlyRate,
    totalMinutes: Math.round(r.totalMinutes),
    totalHours: Number((r.totalMinutes / 60).toFixed(2)),
    totalEarnings: Number(r.totalEarnings.toFixed(2)),
    jobCount: r.jobCount,
  }));
}
