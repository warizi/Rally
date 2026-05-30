/**
 * features/file-watcher/manage-watchers/model/watchers.test.tsx
 *
 * 3개 watcher (csv/pdf/image) — useFileWatcher 에 전달되는 config 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  useFileWatcher: vi.fn(),
  csvIsOwnWrite: vi.fn(() => false),
  pdfIsOwnWrite: vi.fn(() => false),
  imageIsOwnWrite: vi.fn(() => false)
}))

vi.mock('../../lib/use-file-watcher', () => ({
  useFileWatcher: mocks.useFileWatcher
}))

vi.mock('@entities/csv-file', () => ({
  isOwnWrite: mocks.csvIsOwnWrite,
  CSV_EXTERNAL_CHANGED_EVENT: 'csv:external-changed'
}))

vi.mock('@entities/pdf-file', () => ({
  isOwnWrite: mocks.pdfIsOwnWrite,
  PDF_EXTERNAL_CHANGED_EVENT: 'pdf:external-changed'
}))

vi.mock('@entities/image-file', () => ({
  isOwnWrite: mocks.imageIsOwnWrite,
  IMAGE_EXTERNAL_CHANGED_EVENT: 'image:external-changed'
}))

beforeEach(() => {
  mocks.useFileWatcher.mockReset()
  ;(window as unknown as Record<string, unknown>).api = {
    csv: { onChanged: vi.fn() },
    pdf: { onChanged: vi.fn() },
    image: { onChanged: vi.fn() }
  }
})

describe('useCsvWatcher', () => {
  it('csv config 로 useFileWatcher 호출', async () => {
    const { useCsvWatcher } = await import('../use-csv-watcher')
    renderHook(() => useCsvWatcher())
    expect(mocks.useFileWatcher).toHaveBeenCalledTimes(1)
    const config = mocks.useFileWatcher.mock.calls[0][0]
    expect(config.queryKeyPrefix).toBe('csv')
    expect(config.idField).toBe('csvId')
    expect(config.externalChangedEvent).toBe('csv:external-changed')
    expect(config.buildTabOptions({ id: 'c1', title: 'T', relativePath: 'a.csv' }).type).toBe('csv')
    expect(
      config.buildTabOptions({ id: 'c1', title: 'T', relativePath: 'a.csv' }).pathname
    ).toContain('c1')
  })
})

describe('usePdfWatcher', () => {
  it('pdf config 로 useFileWatcher 호출', async () => {
    const { usePdfWatcher } = await import('../use-pdf-watcher')
    renderHook(() => usePdfWatcher())
    expect(mocks.useFileWatcher).toHaveBeenCalledTimes(1)
    const config = mocks.useFileWatcher.mock.calls[0][0]
    expect(config.queryKeyPrefix).toBe('pdf')
    expect(config.idField).toBe('pdfId')
    expect(config.externalChangedEvent).toBe('pdf:external-changed')
    expect(config.buildTabOptions({ id: 'p1', title: 'T', relativePath: 'a.pdf' }).type).toBe('pdf')
  })
})

describe('useImageWatcher', () => {
  it('image config 로 useFileWatcher 호출', async () => {
    const { useImageWatcher } = await import('../use-image-watcher')
    renderHook(() => useImageWatcher())
    expect(mocks.useFileWatcher).toHaveBeenCalledTimes(1)
    const config = mocks.useFileWatcher.mock.calls[0][0]
    expect(config.queryKeyPrefix).toBe('image')
    expect(config.idField).toBe('imageId')
    expect(config.externalChangedEvent).toBe('image:external-changed')
    expect(config.buildTabOptions({ id: 'i1', title: 'T', relativePath: 'a.png' }).type).toBe(
      'image'
    )
  })
})
