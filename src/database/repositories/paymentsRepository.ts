import { getDatabase } from '../db';
import { PaymentStatus } from '../../types';

export interface FinancialOverview {
  totalPending: number;     // A Receber (clientes pendentes)
  totalReceived: number;    // Já Recebido (clientes pagos)
  totalStaffWages: number;  // A Pagar para Equipe (ajudantes)
  totalNetProfit: number;   // Lucro Líquido Real
  pendingCount: number;
  paidCount: number;
}

export interface ClientInvoiceItem {
  id: number;
  client_id: number;
  client_name: string;
  client_phone?: string;
  client_postcode: string;
  date: string;
  duration_minutes: number;
  billed_people_count: number;
  total_client_charge: number;
  total_helpers_cost: number;
  net_profit: number;
  payment_status: PaymentStatus;
  notes?: string;
}

export interface HelperPayoutItem {
  helper_id: number;
  helper_name: string;
  hourly_rate: number;
  total_minutes: number;
  total_hours: number;
  total_earnings: number;
  job_count: number;
}

export async function getFinancialOverview(): Promise<FinancialOverview> {
  const db = await getDatabase();

  // Pending client charges
  const pendingRow = await db.getFirstAsync<{ sum: number; count: number }>(`
    SELECT COALESCE(SUM(total_client_charge), 0) as sum, COUNT(*) as count
    FROM job_sessions
    WHERE status = 'COMPLETED' AND payment_status = 'PENDING'
  `);

  // Received client charges
  const receivedRow = await db.getFirstAsync<{ sum: number; count: number }>(`
    SELECT COALESCE(SUM(total_client_charge), 0) as sum, COUNT(*) as count
    FROM job_sessions
    WHERE status = 'COMPLETED' AND payment_status = 'PAID'
  `);

  // Total staff wages across all completed jobs
  const staffRow = await db.getFirstAsync<{ sum: number }>(`
    SELECT COALESCE(SUM(jh.helper_earnings), 0) as sum
    FROM job_helpers jh
    JOIN job_sessions js ON js.id = jh.job_id
    WHERE js.status = 'COMPLETED'
  `);

  const totalPending = Number((pendingRow?.sum || 0).toFixed(2));
  const totalReceived = Number((receivedRow?.sum || 0).toFixed(2));
  const totalStaffWages = Number((staffRow?.sum || 0).toFixed(2));
  const totalNetProfit = Number(((totalReceived + totalPending) - totalStaffWages).toFixed(2));

  return {
    totalPending,
    totalReceived,
    totalStaffWages,
    totalNetProfit,
    pendingCount: pendingRow?.count || 0,
    paidCount: receivedRow?.count || 0,
  };
}

export async function getClientInvoices(
  filter: 'ALL' | 'PENDING' | 'PAID' = 'ALL'
): Promise<ClientInvoiceItem[]> {
  const db = await getDatabase();

  let whereClause = "WHERE js.status = 'COMPLETED'";
  if (filter === 'PENDING') {
    whereClause += " AND js.payment_status = 'PENDING'";
  } else if (filter === 'PAID') {
    whereClause += " AND js.payment_status = 'PAID'";
  }

  const query = `
    SELECT 
      js.id,
      js.client_id,
      c.name as client_name,
      c.phone as client_phone,
      c.postcode as client_postcode,
      js.date,
      COALESCE(js.manual_duration_minutes, 
        CASE 
          WHEN js.start_time IS NOT NULL AND js.end_time IS NOT NULL 
          THEN (strftime('%s', js.end_time) - strftime('%s', js.start_time)) / 60 
          ELSE 0 
        END
      ) as duration_minutes,
      js.billed_people_count,
      js.total_client_charge,
      js.total_helpers_cost,
      js.net_profit,
      js.payment_status,
      js.notes
    FROM job_sessions js
    JOIN clients c ON c.id = js.client_id
    ${whereClause}
    ORDER BY js.date DESC, js.id DESC
  `;

  const rows = await db.getAllAsync<ClientInvoiceItem>(query);
  return rows.map((r) => ({
    ...r,
    duration_minutes: Math.round(r.duration_minutes || 0),
    total_client_charge: Number(r.total_client_charge.toFixed(2)),
    total_helpers_cost: Number(r.total_helpers_cost.toFixed(2)),
    net_profit: Number(r.net_profit.toFixed(2)),
  }));
}

export async function getStaffPayoutSummary(): Promise<HelperPayoutItem[]> {
  const db = await getDatabase();

  const query = `
    SELECT 
      h.id as helper_id,
      h.name as helper_name,
      h.hourly_rate,
      COALESCE(SUM(
        CASE 
          WHEN js.manual_duration_minutes IS NOT NULL AND js.manual_duration_minutes > 0 
          THEN js.manual_duration_minutes
          WHEN js.start_time IS NOT NULL AND js.end_time IS NOT NULL 
          THEN (strftime('%s', js.end_time) - strftime('%s', js.start_time)) / 60 
          ELSE 0 
        END
      ), 0) as total_minutes,
      COALESCE(SUM(jh.helper_earnings), 0) as total_earnings,
      COUNT(DISTINCT js.id) as job_count
    FROM helpers h
    LEFT JOIN job_helpers jh ON jh.helper_id = h.id
    LEFT JOIN job_sessions js ON js.id = jh.job_id AND js.status = 'COMPLETED'
    GROUP BY h.id, h.name, h.hourly_rate
    ORDER BY total_earnings DESC, h.name ASC
  `;

  const rows = await db.getAllAsync<{
    helper_id: number;
    helper_name: string;
    hourly_rate: number;
    total_minutes: number;
    total_earnings: number;
    job_count: number;
  }>(query);

  return rows.map((r) => ({
    helper_id: r.helper_id,
    helper_name: r.helper_name,
    hourly_rate: r.hourly_rate,
    total_minutes: Math.round(r.total_minutes),
    total_hours: Number((r.total_minutes / 60).toFixed(2)),
    total_earnings: Number(r.total_earnings.toFixed(2)),
    job_count: r.job_count,
  }));
}

export async function toggleJobPaymentStatus(
  jobId: number,
  newStatus: PaymentStatus
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE job_sessions SET payment_status = ? WHERE id = ?',
    [newStatus, jobId]
  );
}
