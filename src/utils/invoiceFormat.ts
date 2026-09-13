import { Settings } from '../types';
import { formatMinutesDisplay } from './calculations';

export interface InvoiceDetails {
  clientName: string;
  clientPhone?: string;
  durationMinutes: number;
  totalClientCharge: number;
  settings: Settings;
}

/**
 * Builds the professional British English WhatsApp invoice message:
 * 
 * Hi {ClientName}, here is the invoice for today's service:
 * • Duration: {Hours}h {Mins}m
 * • Total Due: £{Total}
 * 
 * Bank Transfer Details:
 * • Sort Code: {SortCode}
 * • Account: {AccountNumber}
 * • Name: {AccountName}
 * 
 * Thank you!
 */
export function buildWhatsAppInvoiceMessage(details: InvoiceDetails): string {
  const { clientName, durationMinutes, totalClientCharge, settings } = details;
  const durationText = formatMinutesDisplay(durationMinutes);
  const totalFormatted = totalClientCharge.toFixed(2);
  const symbol = settings.currency_symbol || '£';

  const sortCode = settings.bank_sort_code || '00-00-00';
  const accountNum = settings.bank_account_number || '00000000';
  const accountName = settings.bank_account_name || settings.business_name || 'Cleaning Services';

  return `Hi ${clientName}, here is the invoice for today's service:
• Duration: ${durationText}
• Total Due: ${symbol}${totalFormatted}

Bank Transfer Details:
• Sort Code: ${sortCode}
• Account: ${accountNum}
• Name: ${accountName}

Thank you!`;
}
