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

  /** type 미지정 시 모든 종류. UI는 type 분기로만 호출하지만 MCP는 통합 조회를 선호. */
  listAll(workspaceId: string, type?: TemplateType): TemplateItem[] {
    if (type) return templateRepository.findByWorkspaceAndType(workspaceId, type).map(toItem)
    return templateRepository.findByWorkspace(workspaceId).map(toItem)
  },

  findById(id: string): TemplateItem {
    const row = templateRepository.findById(id)
    if (!row) throw new NotFoundError('템플릿을 찾을 수 없습니다')
    return toItem(row)
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
