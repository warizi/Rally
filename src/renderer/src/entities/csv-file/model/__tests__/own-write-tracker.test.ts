/**
 * entities/csv-file/model/own-write-tracker.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markAsOwnWrite, isOwnWrite } from '../own-write-tracker'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('csv-file own-write-tracker', () => {
  it('markAsOwnWrite → isOwnWrite=true', () => {
    markAsOwnWrite('csv-1')
    expect(isOwnWrite('csv-1')).toBe(true)
  })

  it('timeout 후 → isOwnWrite=false', () => {
    markAsOwnWrite('csv-2')
    vi.advanceTimersByTime(5000) // 기본 2000ms 보다 충분히 김
    expect(isOwnWrite('csv-2')).toBe(false)
  })
})
