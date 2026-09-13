import { Helper, JobCalculationResult } from '../types';

/**
 * Converts minutes to decimal hours rounded to 2 decimal places or precise floating point.
 */
export function minutesToDecimalHours(minutes: number): number {
  if (!minutes || minutes <= 0) return 0;
  return minutes / 60;
}

/**
 * Formats minutes into human-readable British format: e.g. "2h 30m" or "45m"
 */
export function formatMinutesDisplay(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Formats a currency amount with the British pound symbol e.g. £80.00
 */
export function formatCurrency(amount: number, symbol = '£'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `${symbol}${safeAmount.toFixed(2)}`;
}

/**
 * Computes all financial breakdowns for a job:
 * - Gross = Decimal Hours * Client Rate * Billed People
 * - Helpers Cost = sum(Decimal Hours * Helper Rate)
 * - Net Profit = Gross - Helpers Cost
 */
export function calculateJobFinancials(
  durationMinutes: number,
  clientHourlyRate: number,
  billedPeopleCount: number,
  selectedHelpers: { id: number; name: string; hourly_rate: number }[]
): JobCalculationResult {
  const durationHours = minutesToDecimalHours(durationMinutes);
  const safeBilledPeople = Math.max(1, billedPeopleCount || 1);
  const safeClientRate = Math.max(0, clientHourlyRate || 0);

  // Client Gross Charge: Duração em horas * Taxa/Hora do Cliente * Quantidade de pessoas cobradas
  const totalClientCharge = Number((durationHours * safeClientRate * safeBilledPeople).toFixed(2));

  // Helper Costs: Duração em horas * Taxa/Hora do ajudante
  let totalHelpersCost = 0;
  const helperBreakdowns = selectedHelpers.map((helper) => {
    const rate = Math.max(0, helper.hourly_rate || 0);
    const earnings = Number((durationHours * rate).toFixed(2));
    totalHelpersCost += earnings;
    return {
      helperId: helper.id,
      helperName: helper.name,
      rateSnapshot: rate,
      earnings,
    };
  });

  totalHelpersCost = Number(totalHelpersCost.toFixed(2));
  const netProfit = Number((totalClientCharge - totalHelpersCost).toFixed(2));

  return {
    durationMinutes,
    durationHours,
    totalClientCharge,
    totalHelpersCost,
    netProfit,
    helperBreakdowns,
  };
}
