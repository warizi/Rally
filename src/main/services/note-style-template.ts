import { nanoid } from 'nanoid'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors'
import { noteStyleTemplateRepository } from '../repositories/note-style-template'
import { toDate } from './_shared/date'

export interface NoteStyleTemplateItem {
  id: string
  name: string
  settingsJson: string
  createdAt: Date
}

function toItem(row: {
  id: string
  name: string
  settingsJson: string
  createdAt: Date | number
}): NoteStyleTemplateItem {
  return {
    ...row,
    createdAt: toDate(row.createdAt)
  }
}

export interface CreateNoteStyleTemplateInput {
  name: string
  settingsJson: string
}

const NAME_MAX_LENGTH = 60

function validateInput(input: CreateNoteStyleTemplateInput): void {
  const name = input.name.trim()
  if (!name) {
    throw new ValidationError('템플릿 이름은 비워둘 수 없습니다.')
  }
  if (name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`템플릿 이름은 ${NAME_MAX_LENGTH}자 이하여야 합니다.`)
  }
  try {
    JSON.parse(input.settingsJson)
  } catch {
    throw new ValidationError('settingsJson 이 유효한 JSON 이 아닙니다.')
  }
}

export const noteStyleTemplateService = {
  list(): NoteStyleTemplateItem[] {
    return noteStyleTemplateRepository.findAll().map(toItem)
  },

  create(input: CreateNoteStyleTemplateInput): NoteStyleTemplateItem {
    validateInput(input)
    const name = input.name.trim()

    // 동일 이름 중복 방지
    const existing = noteStyleTemplateRepository.findAll().find((t) => t.name === name)
    if (existing) {
      throw new ConflictError(`이미 같은 이름의 템플릿이 있습니다: ${name}`)
    }

    const row = noteStyleTemplateRepository.create({
      id: nanoid(),
      name,
      settingsJson: input.settingsJson,
      createdAt: new Date()
    })
    return toItem(row)
  },

  remove(id: string): void {
    const template = noteStyleTemplateRepository.findById(id)
    if (!template) {
      throw new NotFoundError(`Template not found: ${id}`)
    }
    noteStyleTemplateRepository.delete(id)
  }
}
