import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  minutesToDecimalHours,
  formatMinutesDisplay,
  formatCurrency,
  calculateJobFinancials,
} from '../utils/calculations';
import { buildWhatsAppInvoiceMessage } from '../utils/invoiceFormat';
import { calculateLiveElapsedSeconds, formatStopwatchTime } from '../utils/timer';

describe('CleanRoute UK - Business Logic & Calculations', () => {
  it('correctly converts minutes to decimal hours and formatted display', () => {
    assert.strictEqual(minutesToDecimalHours(60), 1);
    assert.strictEqual(minutesToDecimalHours(120), 2);
    assert.strictEqual(minutesToDecimalHours(90), 1.5);
    assert.strictEqual(formatMinutesDisplay(150), '2h 30m');
    assert.strictEqual(formatMinutesDisplay(45), '45m');
    assert.strictEqual(formatMinutesDisplay(120), '2h');
  });

  it('calculates gross client charge, helper costs, and net profit with multiple helpers and billed people', () => {
    // Example from user prompt:
    // 2 hours of work with team of 3 helpers, but client agreed to pay for 2 people at £20/h
    // Gross: 2h * £20 * 2 = £80
    // Helpers: Helper 1 (£12/h), Helper 2 (£12/h) -> £24 + £24 = £48
    // Net profit: £80 - £48 = £32
    const durationMinutes = 120;
    const clientRate = 20.0;
    const billedPeople = 2;
    const helpers = [
      { id: 1, name: 'Maria Santos', hourly_rate: 12.0 },
      { id: 2, name: 'Elena Rossi', hourly_rate: 12.0 },
    ];

    const result = calculateJobFinancials(durationMinutes, clientRate, billedPeople, helpers);

    assert.strictEqual(result.durationHours, 2);
    assert.strictEqual(result.totalClientCharge, 80.0);
    assert.strictEqual(result.totalHelpersCost, 48.0);
    assert.strictEqual(result.netProfit, 32.0);
    assert.strictEqual(result.helperBreakdowns.length, 2);
    assert.strictEqual(result.helperBreakdowns[0].earnings, 24.0);
    assert.strictEqual(result.helperBreakdowns[1].earnings, 24.0);
  });

  it('formats digital stopwatch accurately in HH:MM:SS', () => {
    assert.strictEqual(formatStopwatchTime(0), '00:00:00');
    assert.strictEqual(formatStopwatchTime(65), '00:01:05');
    assert.strictEqual(formatStopwatchTime(3665), '01:01:05');
  });

  it('resiliently computes live elapsed seconds from SQLite ISO timestamp', () => {
    const twoMinutesAgoIso = new Date(Date.now() - 120 * 1000).toISOString();
    const elapsed = calculateLiveElapsedSeconds(twoMinutesAgoIso, 0);
    // Should be approximately 120 seconds
    assert.ok(elapsed >= 119 && elapsed <= 122, `Expected ~120s, got ${elapsed}`);

    // With 30 seconds of pause time, elapsed should be ~90s
    const withPause = calculateLiveElapsedSeconds(twoMinutesAgoIso, 30);
    assert.ok(withPause >= 89 && withPause <= 92, `Expected ~90s, got ${withPause}`);
  });

  it('builds professional British English WhatsApp invoice matching exact requirements', () => {
    const message = buildWhatsAppInvoiceMessage({
      clientName: 'Lady Eleanor Vance',
      durationMinutes: 150, // 2h 30m
      totalClientCharge: 85.5,
      settings: {
        id: 1,
        business_name: 'CleanRoute Services',
        bank_sort_code: '20-00-00',
        bank_account_number: '12345678',
        bank_account_name: 'CleanRoute Ltd',
        currency_symbol: '£',
      },
    });

    assert.ok(message.includes("Hi Lady Eleanor Vance, here is the invoice for today's service:"));
    assert.ok(message.includes('• Duration: 2h 30m'));
    assert.ok(message.includes('• Total Due: £85.50'));
    assert.ok(message.includes('• Sort Code: 20-00-00'));
    assert.ok(message.includes('• Account: 12345678'));
    assert.ok(message.includes('• Name: CleanRoute Ltd'));
    assert.ok(message.includes('Thank you!'));
  });
});
