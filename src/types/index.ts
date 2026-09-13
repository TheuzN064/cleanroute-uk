export type PaymentStatus = 'PENDING' | 'PAID';
export type JobStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
export type Language = 'pt' | 'en';
export type ThemeMode = 'light' | 'dark';

export interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  postcode: string;
  hourly_rate: number;
  default_billed_people: number;
  notes?: string;
  created_at?: string;
}

export interface Helper {
  id: number;
  name: string;
  hourly_rate: number;
  is_active: number; // 1 for true, 0 for false in SQLite
}

export interface JobSession {
  id: number;
  client_id: number;
  start_time?: string; // ISO String
  end_time?: string; // ISO String
  manual_duration_minutes?: number;
  billed_people_count: number;
  total_client_charge: number;
  total_helpers_cost: number;
  net_profit: number;
  payment_status: PaymentStatus;
  status: JobStatus;
  notes?: string;
  date: string; // YYYY-MM-DD
  // Joined client fields for UI convenience
  client_name?: string;
  client_postcode?: string;
  client_address?: string;
  client_phone?: string;
  client_hourly_rate?: number;
  assigned_helpers?: string;
  assigned_helper_ids?: string;
}

export interface JobHelper {
  id: number;
  job_id: number;
  helper_id: number;
  helper_rate_snapshot: number;
  helper_earnings: number;
  // Joined helper name
  helper_name?: string;
}

export interface Settings {
  id: number;
  business_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  bank_account_name: string;
  currency_symbol: string;
  language?: Language;
  theme_mode?: ThemeMode;
}

export interface JobCalculationResult {
  durationMinutes: number;
  durationHours: number;
  totalClientCharge: number;
  totalHelpersCost: number;
  netProfit: number;
  helperBreakdowns: {
    helperId: number;
    helperName: string;
    rateSnapshot: number;
    earnings: number;
  }[];
}

export interface HelperWeeklySummary {
  helperId: number;
  helperName: string;
  hourlyRate: number;
  totalMinutes: number;
  totalHours: number;
  totalEarnings: number;
  jobCount: number;
}
