import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { templateRepository } from '../repositories/template'
import type { Template, TemplateType } from '../repositories/template'

export interface TemplateItem {
  id: string
  workspaceId: string
  title: string
  type: TemplateType
  jsonData: string
  createdAt: Date
}

function toItem(t: Template): TemplateItem {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    title: t.title,
    type: t.type as TemplateType,
    jsonData: t.jsonData,
    createdAt: t.createdAt
  }
}

export const templateService = {
  list(workspaceId: string, type: TemplateType): TemplateItem[] {
    return templateRepository.findByWorkspaceAndType(workspaceId, type).map(toItem)
  },

  create(input: {
    workspaceId: string
    title: string
    type: TemplateType
    jsonData: string
  }): TemplateItem {
    const title = input.title.trim()
    if (!title) {
      throw new ValidationError('제목을 입력해주세요')
    }
    if (!input.jsonData || input.jsonData.trim() === '') {
      throw new ValidationError('저장할 내용이 비어있습니다')
    }
    if (input.type !== 'note' && input.type !== 'csv') {
      throw new ValidationError('알 수 없는 템플릿 타입입니다')
    }

    const created = templateRepository.create({
      id: nanoid(),
      workspaceId: input.workspaceId,
      title,
      type: input.type,
      jsonData: input.jsonData,
      createdAt: new Date()
    })
    return toItem(created)
  },

  delete(id: string): void {
    const existing = templateRepository.findById(id)
    if (!existing) {
      throw new NotFoundError('템플릿을 찾을 수 없습니다')
    }
    templateRepository.delete(id)
  }
}
