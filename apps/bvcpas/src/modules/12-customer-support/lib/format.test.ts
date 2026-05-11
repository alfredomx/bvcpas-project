// Tests de helpers de formato (v0.5.0, Bloque A).

import { describe, expect, it } from 'vitest'

import {
  formatAmount,
  formatFollowupStatus,
  formatSilentStreak,
  silentStreakInMonths,
} from './format'

describe('formatAmount', () => {
  it('formats amounts with 2 decimals and thousands separator', () => {
    expect(formatAmount('62600.00')).toBe('$62,600.00')
    expect(formatAmount('1500.00')).toBe('$1,500.00')
  })

  it('formats hundreds with 2 decimals', () => {
    expect(formatAmount('900.00')).toBe('$900.00')
    expect(formatAmount('0.00')).toBe('$0.00')
  })

  it('formats millions with comma separator', () => {
    expect(formatAmount('1500000.00')).toBe('$1,500,000.00')
  })

  it('handles negative amounts', () => {
    expect(formatAmount('-1500.00')).toBe('-$1,500.00')
    expect(formatAmount('-32.5')).toBe('-$32.50')
  })

  it('returns "$0.00" for invalid input', () => {
    expect(formatAmount('not-a-number')).toBe('$0.00')
  })
})

describe('silentStreakInMonths', () => {
  it('returns 0 for less than 30 days', () => {
    expect(silentStreakInMonths(15)).toBe(0)
  })

  it('returns whole months', () => {
    expect(silentStreakInMonths(30)).toBe(1)
    expect(silentStreakInMonths(95)).toBe(3)
  })

  it('returns 0 for negative input', () => {
    expect(silentStreakInMonths(-5)).toBe(0)
  })
})

describe('formatSilentStreak', () => {
  it('returns months suffix when >= 30 days', () => {
    expect(formatSilentStreak(95)).toBe('3mo silent')
    expect(formatSilentStreak(30)).toBe('1mo silent')
  })

  it('returns days when less than 30 days', () => {
    expect(formatSilentStreak(15)).toBe('15d silent')
    expect(formatSilentStreak(0)).toBe('0d silent')
  })
})

describe('formatFollowupStatus', () => {
  it('replaces underscores with spaces', () => {
    expect(formatFollowupStatus('awaiting_reply')).toBe('awaiting reply')
    expect(formatFollowupStatus('partial_reply')).toBe('partial reply')
    expect(formatFollowupStatus('ready_to_send')).toBe('ready to send')
  })

  it('passes single-word statuses untouched', () => {
    expect(formatFollowupStatus('pending')).toBe('pending')
    expect(formatFollowupStatus('sent')).toBe('sent')
    expect(formatFollowupStatus('complete')).toBe('complete')
  })
})
