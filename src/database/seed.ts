import { SQLiteDatabase } from 'expo-sqlite';
import { format } from 'date-fns';

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  // Check if clients already exist
  const existingClients = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM clients');
  if (existingClients && existingClients[0] && existingClients[0].count > 0) {
    return; // Already seeded
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Insert Clients with realistic UK postcodes & addresses
  await db.runAsync(`
    INSERT INTO clients (name, phone, address, postcode, hourly_rate, default_billed_people, notes) VALUES
    ('Lady Eleanor Vance', '07700900123', '14 Kensington Square, London', 'W8 5HH', 22.50, 2, 'Key in keybox (code 4821). Needs thorough dusting in study.'),
    ('Dr. Alistair Finch', '07700900456', '8 Richmond Green, Richmond', 'TW9 1NQ', 20.00, 1, 'Two friendly labradors. Ironing required.'),
    ('Harrington & Sons Offices', '07700900789', '25 King Street, Covent Garden', 'WC2E 8HN', 25.00, 3, 'Commercial office cleaning after 5 PM.'),
    ('Sophie Montgomery', '07700900999', '42 Kings Road, Chelsea', 'SW3 4UD', 24.00, 2, 'Bi-weekly deep clean, focus on marble bathrooms.')
  `);

  // Insert Helpers
  await db.runAsync(`
    INSERT INTO helpers (name, hourly_rate, is_active) VALUES
    ('Maria Santos', 12.50, 1),
    ('Elena Rossi', 12.00, 1),
    ('Pawel Kowalski', 13.00, 1)
  `);

  // Insert sample scheduled jobs for Today
  const clients = await db.getAllAsync<{ id: number; hourly_rate: number; default_billed_people: number }>('SELECT id, hourly_rate, default_billed_people FROM clients ORDER BY id ASC');

  if (clients.length >= 2) {
    // Job 1: Scheduled for today
    await db.runAsync(`
      INSERT INTO job_sessions (
        client_id, billed_people_count, total_client_charge, total_helpers_cost, net_profit, payment_status, status, notes, date
      ) VALUES (?, ?, 0, 0, 0, 'PENDING', 'SCHEDULED', 'Standard morning service', ?)
    `, [clients[0].id, clients[0].default_billed_people, todayStr]);

    // Job 2: Completed earlier with helpers
    const durationMins = 120; // 2 hours
    const durationHours = 2;
    const clientRate = clients[1].hourly_rate;
    const billedPeople = clients[1].default_billed_people;
    const clientCharge = durationHours * clientRate * billedPeople;
    const helperRate = 12.50;
    const helperCost = durationHours * helperRate;
    const netProfit = clientCharge - helperCost;

    const completedResult = await db.runAsync(`
      INSERT INTO job_sessions (
        client_id, manual_duration_minutes, billed_people_count, total_client_charge, total_helpers_cost, net_profit, payment_status, status, notes, date
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 'COMPLETED', 'Cleaned living room and 2 bedrooms', ?)
    `, [clients[1].id, durationMins, billedPeople, clientCharge, helperCost, netProfit, todayStr]);

    const jobId = completedResult.lastInsertRowId;
    const helpers = await db.getAllAsync<{ id: number }>('SELECT id FROM helpers LIMIT 1');
    if (helpers.length > 0) {
      await db.runAsync(`
        INSERT INTO job_helpers (job_id, helper_id, helper_rate_snapshot, helper_earnings)
        VALUES (?, ?, ?, ?)
      `, [jobId, helpers[0].id, helperRate, helperCost]);
    }
  }
}
