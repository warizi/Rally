import { describe, it, expect, vi, afterEach } from 'vitest'
import { noteStyleTemplateService } from '../note-style-template'
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors'

const sampleSettings = JSON.stringify({
  light: {
    h1: {
      fontSize: '2rem',
      lineHeight: 1.3,
      marginTop: '1rem',
      marginBottom: '0.5rem',
      color: '#000'
    }
  },
  dark: {
    h1: {
      fontSize: '2rem',
      lineHeight: 1.3,
      marginTop: '1rem',
      marginBottom: '0.5rem',
      color: '#fff'
    }
  }
})

describe('noteStyleTemplateService', () => {
  describe('create', () => {
    it('템플릿 생성 후 list 에서 조회 가능', () => {
      const created = noteStyleTemplateService.create({
        name: '미니멀',
        settingsJson: sampleSettings
      })
      expect(created.id).toBeTruthy()
      expect(created.name).toBe('미니멀')
      expect(created.createdAt).toBeInstanceOf(Date)

      const list = noteStyleTemplateService.list()
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('미니멀')
    })

    it('이름 trim 적용 + 빈 이름은 ValidationError', () => {
      expect(() =>
        noteStyleTemplateService.create({ name: '   ', settingsJson: sampleSettings })
      ).toThrow(ValidationError)
    })

    it('60자 초과 이름은 ValidationError', () => {
      expect(() =>
        noteStyleTemplateService.create({ name: 'x'.repeat(61), settingsJson: sampleSettings })
      ).toThrow(ValidationError)
    })

    it('유효하지 않은 JSON 은 ValidationError', () => {
      expect(() =>
        noteStyleTemplateService.create({ name: '잘못된', settingsJson: 'not-json' })
      ).toThrow(ValidationError)
    })

    it('같은 이름 중복은 ConflictError', () => {
      noteStyleTemplateService.create({ name: '중복', settingsJson: sampleSettings })
      expect(() =>
        noteStyleTemplateService.create({ name: '중복', settingsJson: sampleSettings })
      ).toThrow(ConflictError)
    })
  })

  describe('list', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('createdAt 내림차순 정렬', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
      const a = noteStyleTemplateService.create({ name: 'A', settingsJson: sampleSettings })
      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
      const b = noteStyleTemplateService.create({ name: 'B', settingsJson: sampleSettings })

      const list = noteStyleTemplateService.list()
      expect(list[0].id).toBe(b.id)
      expect(list[1].id).toBe(a.id)
    })
  })

  describe('remove', () => {
    it('존재하는 템플릿 삭제', () => {
      const t = noteStyleTemplateService.create({ name: '삭제대상', settingsJson: sampleSettings })
      noteStyleTemplateService.remove(t.id)
      expect(noteStyleTemplateService.list()).toHaveLength(0)
    })

    it('존재하지 않는 id 는 NotFoundError', () => {
      expect(() => noteStyleTemplateService.remove('non-existent-id')).toThrow(NotFoundError)
    })
  })
})
