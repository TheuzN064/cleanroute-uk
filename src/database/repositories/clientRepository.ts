import { getDatabase } from '../db';
import { Client } from '../../types';

export async function getAllClients(): Promise<Client[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Client>(
    'SELECT * FROM clients ORDER BY name ASC'
  );
  return rows;
}

export async function getClientById(id: number): Promise<Client | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Client>(
    'SELECT * FROM clients WHERE id = ?',
    [id]
  );
  return row || null;
}

export async function createClient(
  client: Omit<Client, 'id' | 'created_at'>
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO clients (name, phone, address, postcode, hourly_rate, default_billed_people, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      client.name.trim(),
      client.phone?.trim() || null,
      client.address?.trim() || null,
      client.postcode.trim().toUpperCase(),
      Number(client.hourly_rate),
      Math.max(1, Number(client.default_billed_people || 1)),
      client.notes?.trim() || null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateClient(client: Client): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE clients 
     SET name = ?, phone = ?, address = ?, postcode = ?, hourly_rate = ?, default_billed_people = ?, notes = ?
     WHERE id = ?`,
    [
      client.name.trim(),
      client.phone?.trim() || null,
      client.address?.trim() || null,
      client.postcode.trim().toUpperCase(),
      Number(client.hourly_rate),
      Math.max(1, Number(client.default_billed_people || 1)),
      client.notes?.trim() || null,
      client.id,
    ]
  );
}

export async function deleteClient(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM clients WHERE id = ?', [id]);
}

export async function searchClients(query: string): Promise<Client[]> {
  const db = await getDatabase();
  const term = `%${query.trim()}%`;
  const rows = await db.getAllAsync<Client>(
    `SELECT * FROM clients 
     WHERE name LIKE ? OR postcode LIKE ? OR address LIKE ?
     ORDER BY name ASC`,
    [term, term, term]
  );
  return rows;
}
