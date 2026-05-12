import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  // window.api / electron / shell 잔존 제거 (테스트 간 격리)
  delete (window as unknown as Record<string, unknown>).api
  delete (window as unknown as Record<string, unknown>).electron
  delete (window as unknown as Record<string, unknown>).shell
})
