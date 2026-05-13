// Tests de la regla única computeNextFollowupStatus
// (fix-followup-status-transitions).

import { describe, expect, it } from 'vitest'

import { computeNextFollowupStatus } from './followup-status'

const NOW = new Date('2026-05-12T12:00:00Z')

describe('computeNextFollowupStatus', () => {
  it('progress=100 → complete (gana sobre sent_at)', () => {
    expect(
      computeNextFollowupStatus({
        progressPct: 100,
        sentAt: '2026-05-01T00:00:00.000Z',
        now: NOW,
      }),
    ).toBe('complete')
  })

  it('0 < progress < 100 → partial_reply', () => {
    expect(
      computeNextFollowupStatus({ progressPct: 1, sentAt: null, now: NOW }),
    ).toBe('partial_reply')
    expect(
      computeNextFollowupStatus({ progressPct: 50, sentAt: null, now: NOW }),
    ).toBe('partial_reply')
    expect(
      computeNextFollowupStatus({ progressPct: 99, sentAt: null, now: NOW }),
    ).toBe('partial_reply')
  })

  it('progress=0 + sent_at del mismo mes/año → sent', () => {
    expect(
      computeNextFollowupStatus({
        progressPct: 0,
        sentAt: '2026-05-03T08:00:00.000Z',
        now: NOW,
      }),
    ).toBe('sent')
  })

  it('progress=0 + sent_at de mes anterior → ready_to_send', () => {
    expect(
      computeNextFollowupStatus({
        progressPct: 0,
        sentAt: '2026-04-30T23:59:00.000Z',
        now: NOW,
      }),
    ).toBe('ready_to_send')
  })

  it('progress=0 + sent_at de año anterior (mismo mes calendario) → ready_to_send', () => {
    expect(
      computeNextFollowupStatus({
        progressPct: 0,
        sentAt: '2025-05-15T12:00:00.000Z',
        now: NOW,
      }),
    ).toBe('ready_to_send')
  })

  it('progress=0 + sent_at=null → ready_to_send', () => {
    expect(
      computeNextFollowupStatus({ progressPct: 0, sentAt: null, now: NOW }),
    ).toBe('ready_to_send')
  })

  it('progress=0 + sent_at inválido → ready_to_send', () => {
    expect(
      computeNextFollowupStatus({
        progressPct: 0,
        sentAt: 'not-a-date',
        now: NOW,
      }),
    ).toBe('ready_to_send')
  })
})
