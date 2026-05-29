/**
 * shared/constants/tab-url.test.ts
 *
 * ROUTES / TAB_ICON / sidebar_items 모두 정의되어 있는지 + key 일관성.
 */
import { describe, it, expect } from 'vitest'
import { ROUTES, TAB_ICON, AppUrls, sidebar_items, system_sidebar_items } from '../tab-url'

describe('tab-url', () => {
  it('ROUTES — 모든 path 가 / 로 시작', () => {
    for (const [key, value] of Object.entries(ROUTES)) {
      expect(value.startsWith('/'), `${key} → ${value}`).toBe(true)
    }
  })

  it('AppUrls === ROUTES (하위호환)', () => {
    expect(AppUrls).toBe(ROUTES)
  })

  it('TAB_ICON — 모든 TabType 키에 icon 정의', () => {
    const expectedKeys = [
      'dashboard',
      'todo',
      'todo-detail',
      'folder',
      'note',
      'csv',
      'pdf',
      'image',
      'calendar',
      'canvas',
      'canvas-detail',
      'terminal',
      'changelog',
      'history',
      'timer',
      'trash'
    ]
    for (const key of expectedKeys) {
      expect(TAB_ICON[key as keyof typeof TAB_ICON]).toBeDefined()
    }
  })

  it('sidebar_items — 7개 메뉴 (dashboard, todo, folder, calendar, canvas, history, timer)', () => {
    expect(sidebar_items).toHaveLength(7)
    expect(sidebar_items.map((s) => s.tabType)).toEqual([
      'dashboard',
      'todo',
      'folder',
      'calendar',
      'canvas',
      'history',
      'timer'
    ])
  })

  it('system_sidebar_items — 변경 내역 + 휴지통', () => {
    expect(system_sidebar_items.map((s) => s.tabType)).toContain('changelog')
    expect(system_sidebar_items.map((s) => s.tabType)).toContain('trash')
  })

  it('각 sidebar 항목 title 한글', () => {
    for (const item of sidebar_items) {
      expect(item.title.length).toBeGreaterThan(0)
      expect(item.pathname.startsWith('/')).toBe(true)
      expect(item.icon).toBeDefined()
    }
  })
})
