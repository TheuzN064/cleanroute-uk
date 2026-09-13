import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, INITIAL_SETTINGS_SQL } from './schema';
import { seedDatabase } from './seed';

let databaseInstance: SQLite.SQLiteDatabase | null = null;

async function runSafeMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Check settings table columns
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(settings);');
    const cols = tableInfo.map((c) => c.name);

    if (!cols.includes('language')) {
      await db.execAsync("ALTER TABLE settings ADD COLUMN language TEXT DEFAULT 'pt';");
    }
    if (!cols.includes('theme_mode')) {
      await db.execAsync("ALTER TABLE settings ADD COLUMN theme_mode TEXT DEFAULT 'light';");
    }

    // Ensure non-null values
    await db.execAsync("UPDATE settings SET language = 'pt' WHERE language IS NULL;");
    await db.execAsync("UPDATE settings SET theme_mode = 'light' WHERE theme_mode IS NULL;");
  } catch (e) {
    console.warn('Migration warning on settings:', e);
  }

  // Check job_sessions table columns
  try {
    const jobCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(job_sessions);');
    const jobColNames = jobCols.map((c) => c.name);

    if (!jobColNames.includes('payment_status')) {
      await db.execAsync("ALTER TABLE job_sessions ADD COLUMN payment_status TEXT DEFAULT 'PENDING';");
    }
  } catch (e) {
    console.warn('Migration warning on job_sessions:', e);
  }

  // Check clients table columns
  try {
    const clientCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(clients);');
    const clientColNames = clientCols.map((c) => c.name);

    if (!clientColNames.includes('default_billed_people')) {
      await db.execAsync('ALTER TABLE clients ADD COLUMN default_billed_people INTEGER DEFAULT 1;');
    }
  } catch (e) {
    console.warn('Migration warning on clients:', e);
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  const db = await SQLite.openDatabaseAsync('cleanroute.db');
  
  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');
  
  // 1. Create tables if they do not exist
  await db.execAsync(CREATE_TABLES_SQL);

  // 2. Safe migrations for existing databases before running any inserts/queries
  await runSafeMigrations(db);

  // 3. Ensure initial settings row exists
  try {
    await db.execAsync(INITIAL_SETTINGS_SQL);
  } catch (e) {
    console.warn('Initial settings query warning:', e);
  }
  
  // 4. Seed sample UK records if empty
  await seedDatabase(db);

  databaseInstance = db;
  return db;
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS job_helpers;
    DROP TABLE IF EXISTS job_sessions;
    DROP TABLE IF EXISTS helpers;
    DROP TABLE IF EXISTS clients;
    DROP TABLE IF EXISTS settings;
  `);
  databaseInstance = null;
  await getDatabase();
}

