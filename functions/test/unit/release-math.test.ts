import { describe, expect, it } from 'vitest';

import {
  dailyReleaseAmountForKey,
  enumerateDayKeysInTz,
  startOfDayInTz,
} from '../../src/services/release';

describe('startOfDayInTz', () => {
  it('renders the previous calendar day for western timezones around UTC midnight', () => {
    // 00:30 UTC on Jan 7 is still Jan 6 in Los Angeles (UTC-8 in winter).
    const d = new Date('2026-01-07T00:30:00Z');
    expect(startOfDayInTz(d, 'America/Los_Angeles')).toBe('2026-01-06');
  });

  it('renders the next calendar day for eastern timezones before UTC midnight', () => {
    // 23:30 UTC on Jan 6 is already Jan 7 in Tokyo (UTC+9).
    const d = new Date('2026-01-06T23:30:00Z');
    expect(startOfDayInTz(d, 'Asia/Tokyo')).toBe('2026-01-07');
  });

  it('matches UTC for the UTC zone', () => {
    const d = new Date('2026-01-07T00:30:00Z');
    expect(startOfDayInTz(d, 'UTC')).toBe('2026-01-07');
  });

  it('falls back to UTC when the timezone is invalid', () => {
    const d = new Date('2026-01-07T12:00:00Z');
    expect(startOfDayInTz(d, 'Not/AZone')).toBe('2026-01-07');
  });

  it('produces chronologically comparable strings', () => {
    const early = startOfDayInTz(new Date('2026-01-09T12:00:00Z'), 'UTC');
    const late = startOfDayInTz(new Date('2026-01-10T12:00:00Z'), 'UTC');
    expect(early < late).toBe(true);
  });
});

describe('enumerateDayKeysInTz', () => {
  it('walks an inclusive UTC range', () => {
    const keys = enumerateDayKeysInTz(
      new Date('2026-06-01T12:00:00Z'),
      new Date('2026-06-03T12:00:00Z'),
      'UTC',
    );
    expect(keys).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('returns a single key when start and end share a day', () => {
    const keys = enumerateDayKeysInTz(
      new Date('2026-06-01T08:00:00Z'),
      new Date('2026-06-01T20:00:00Z'),
      'UTC',
    );
    expect(keys).toEqual(['2026-06-01']);
  });

  it('returns [] when the window is inverted', () => {
    const keys = enumerateDayKeysInTz(
      new Date('2026-06-03T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'),
      'UTC',
    );
    expect(keys).toEqual([]);
  });

  it('does not skip or duplicate days across a DST spring-forward', () => {
    // US DST starts 2026-03-08 (America/Los_Angeles).
    const keys = enumerateDayKeysInTz(
      new Date('2026-03-07T12:00:00Z'),
      new Date('2026-03-09T12:00:00Z'),
      'America/Los_Angeles',
    );
    expect(keys).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
  });

  it('keys follow the bounty timezone, not UTC', () => {
    // Tokyo midnight 2026-07-06 is 15:00 UTC on 07-05. A UTC walk would
    // include 07-05; the Tokyo walk must start at 07-06.
    const keys = enumerateDayKeysInTz(
      new Date('2026-07-05T15:00:00Z'),
      new Date('2026-07-10T14:59:00Z'),
      'Asia/Tokyo',
    );
    expect(keys[0]).toBe('2026-07-06');
    expect(keys[keys.length - 1]).toBe('2026-07-10');
    expect(keys).toHaveLength(5);
  });
});

describe('dailyReleaseAmountForKey', () => {
  it('pays the base rate on weekdays', () => {
    // 2026-06-10 is a Wednesday.
    expect(dailyReleaseAmountForKey('2026-06-10')).toBe(5);
  });

  it('pays the weekend multiplier on Saturday and Sunday', () => {
    // 2026-06-13 Sat, 2026-06-14 Sun.
    expect(dailyReleaseAmountForKey('2026-06-13')).toBe(10);
    expect(dailyReleaseAmountForKey('2026-06-14')).toBe(10);
  });

  it('is keyed off the calendar date alone (no timezone ambiguity)', () => {
    // Same key always yields the same amount.
    expect(dailyReleaseAmountForKey('2026-06-13')).toBe(
      dailyReleaseAmountForKey('2026-06-13'),
    );
  });
});
