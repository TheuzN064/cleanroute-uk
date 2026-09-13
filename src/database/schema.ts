export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  postcode TEXT NOT NULL,
  hourly_rate REAL NOT NULL,
  default_billed_people INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS helpers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hourly_rate REAL NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS job_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  start_time TEXT,
  end_time TEXT,
  manual_duration_minutes INTEGER,
  billed_people_count INTEGER DEFAULT 1,
  total_client_charge REAL DEFAULT 0,
  total_helpers_cost REAL DEFAULT 0,
  net_profit REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'PAID')),
  status TEXT DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')),
  notes TEXT,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_helpers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  helper_id INTEGER NOT NULL REFERENCES helpers(id),
  helper_rate_snapshot REAL NOT NULL,
  helper_earnings REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  business_name TEXT,
  bank_sort_code TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  currency_symbol TEXT DEFAULT '£',
  language TEXT DEFAULT 'pt',
  theme_mode TEXT DEFAULT 'light'
);
`;

export const INITIAL_SETTINGS_SQL = `
INSERT OR IGNORE INTO settings (id, business_name, bank_sort_code, bank_account_number, bank_account_name, currency_symbol, language, theme_mode)
VALUES (1, 'CleanRoute Services', '20-00-00', '12345678', 'CleanRoute Ltd', '£', 'pt', 'light');
`;
