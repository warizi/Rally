/**
 * entities/pdf-file/model/own-write-tracker.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markAsOwnWrite, isOwnWrite } from '../own-write-tracker'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pdf-file own-write-tracker', () => {
  it('markAsOwnWrite → isOwnWrite=true', () => {
    markAsOwnWrite('pdf-1')
    expect(isOwnWrite('pdf-1')).toBe(true)
  })

  it('timeout 후 → 자동 만료', () => {
    markAsOwnWrite('pdf-2')
    vi.advanceTimersByTime(5000)
    expect(isOwnWrite('pdf-2')).toBe(false)
  })
})
