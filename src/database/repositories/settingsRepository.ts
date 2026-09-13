import { getDatabase } from '../db';
import { Settings } from '../../types';

export async function getSettings(): Promise<Settings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  if (row) {
    return {
      ...row,
      language: row.language || 'pt',
      theme_mode: row.theme_mode || 'light',
    };
  }
  // Fallback defaults
  return {
    id: 1,
    business_name: 'CleanRoute Services',
    bank_sort_code: '20-00-00',
    bank_account_number: '12345678',
    bank_account_name: 'CleanRoute Ltd',
    currency_symbol: '£',
    language: 'pt',
    theme_mode: 'light',
  };
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE settings 
     SET business_name = COALESCE(?, business_name),
         bank_sort_code = COALESCE(?, bank_sort_code),
         bank_account_number = COALESCE(?, bank_account_number),
         bank_account_name = COALESCE(?, bank_account_name),
         currency_symbol = COALESCE(?, currency_symbol),
         language = COALESCE(?, language),
         theme_mode = COALESCE(?, theme_mode)
     WHERE id = 1`,
    [
      settings.business_name || null,
      settings.bank_sort_code || null,
      settings.bank_account_number || null,
      settings.bank_account_name || null,
      settings.currency_symbol || null,
      settings.language || null,
      settings.theme_mode || null,
    ]
  );
}
