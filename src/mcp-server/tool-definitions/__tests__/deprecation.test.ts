/**
 * MCP v2 Foundation — deprecation 인프라 테스트.
 * - description prefix
 * - 응답 메타 주입
 * - non-deprecated tool 은 identity 패스스루
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { buildDescription, wrapHandlerWithDeprecation } from '../index'
import type { ToolDefinition, ToolSchema } from '../types'

function makeJsonResult(payload: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

function makeTool(overrides: Partial<ToolDefinition>): ToolDefinition {
  const baseHandler = (() =>
    makeJsonResult({
      _workspace: { id: 'w1', name: 'rally' },
      result: 'ok'
    })) as unknown as ToolDefinition['handler']
  return {
    name: 'test_tool',
    description: 'Original description',
    schema: { q: z.string() } as ToolSchema,
    handler: baseHandler,
    ...overrides
  }
}

describe('buildDescription', () => {
  it('deprecated 미설정 시 description 그대로 반환', () => {
    const tool = makeTool({})
    expect(buildDescription(tool)).toBe('Original description')
  })

  it('deprecated 설정 시 [DEPRECATED] banner prefix + 원본 보존', () => {
    const tool = makeTool({ deprecated: { replacedBy: 'v2_tool' } })
    const desc = buildDescription(tool)
    expect(desc.startsWith('[DEPRECATED: use `v2_tool` instead]')).toBe(true)
    expect(desc).toContain('Original description')
    expect(desc.indexOf('Original description')).toBeGreaterThan(0) // banner 이후
  })

  it('since / reason 포함', () => {
    const tool = makeTool({
      deprecated: { replacedBy: 'v2_tool', since: 'v2.0', reason: 'merged into v2_tool' }
    })
    const desc = buildDescription(tool)
    expect(desc).toContain('(since v2.0)')
    expect(desc).toContain('— merged into v2_tool')
  })
})

describe('wrapHandlerWithDeprecation', () => {
  it('deprecated 미설정 시 원본 handler 동일 참조 반환 (no wrap)', () => {
    const tool = makeTool({})
    expect(wrapHandlerWithDeprecation(tool)).toBe(tool.handler)
  })

  it('deprecated 설정 시 응답 JSON 에 _deprecation 메타 주입', async () => {
    const tool = makeTool({ deprecated: { replacedBy: 'v2_tool' } })
    const wrapped = wrapHandlerWithDeprecation(tool)
    // ToolCallback 시그니처는 SDK 내부 타입 — 테스트에선 임의 인자 전달
    const result = (await (wrapped as unknown as (a: unknown, e: unknown) => Promise<CallToolResult>)(
      {},
      {}
    )) as CallToolResult
    const text = (result.content[0] as { text: string }).text
    const parsed = JSON.parse(text) as Record<string, unknown>
    expect(parsed._deprecation).toEqual({ tool: 'test_tool', replacedBy: 'v2_tool' })
  })

  it('_workspace 가 _deprecation 보다 먼저, payload 는 그 뒤 순서 유지', async () => {
    const tool = makeTool({ deprecated: { replacedBy: 'v2_tool' } })
    const wrapped = wrapHandlerWithDeprecation(tool)
    const result = (await (wrapped as unknown as (a: unknown, e: unknown) => Promise<CallToolResult>)(
      {},
      {}
    )) as CallToolResult
    const text = (result.content[0] as { text: string }).text
    const keys = Object.keys(JSON.parse(text) as Record<string, unknown>)
    expect(keys[0]).toBe('_workspace')
    expect(keys[1]).toBe('_deprecation')
    expect(keys[2]).toBe('result')
  })

  it('since / reason 도 메타에 포함', async () => {
    const tool = makeTool({
      deprecated: { replacedBy: 'v2_tool', since: 'v2.0', reason: 'merged' }
    })
    const wrapped = wrapHandlerWithDeprecation(tool)
    const result = (await (wrapped as unknown as (a: unknown, e: unknown) => Promise<CallToolResult>)(
      {},
      {}
    )) as CallToolResult
    const parsed = JSON.parse((result.content[0] as { text: string }).text) as Record<
      string,
      unknown
    >
    expect(parsed._deprecation).toEqual({
      tool: 'test_tool',
      replacedBy: 'v2_tool',
      since: 'v2.0',
      reason: 'merged'
    })
  })

  it('비-JSON 응답은 그대로 통과 (isError 포함)', async () => {
    const tool = makeTool({
      deprecated: { replacedBy: 'v2_tool' },
      handler: (() => ({
        content: [{ type: 'text', text: 'plain string not json' }],
        isError: true
      })) as unknown as ToolDefinition['handler']
    })
    const wrapped = wrapHandlerWithDeprecation(tool)
    const result = (await (wrapped as unknown as (a: unknown, e: unknown) => Promise<CallToolResult>)(
      {},
      {}
    )) as CallToolResult
    expect((result.content[0] as { text: string }).text).toBe('plain string not json')
    expect(result.isError).toBe(true)
  })

  it('content[0].type 이 text 가 아니면 그대로 통과', async () => {
    const tool = makeTool({
      deprecated: { replacedBy: 'v2_tool' },
      handler: (() => ({
        content: [{ type: 'image', data: 'base64...', mimeType: 'image/png' }]
      })) as unknown as ToolDefinition['handler']
    })
    const wrapped = wrapHandlerWithDeprecation(tool)
    const result = (await (wrapped as unknown as (a: unknown, e: unknown) => Promise<CallToolResult>)(
      {},
      {}
    )) as CallToolResult
    expect(result.content[0]).toEqual({ type: 'image', data: 'base64...', mimeType: 'image/png' })
  })

  it('이미 _deprecation 키가 있는 경우 덮어쓰기 (도구 정의가 truth)', async () => {
    const tool = makeTool({
      deprecated: { replacedBy: 'v2_tool' },
      handler: (() =>
        makeJsonResult({
          _workspace: { id: 'w1', name: 'rally' },
          _deprecation: { tool: 'wrong', replacedBy: 'wrong' },
          result: 'ok'
        })) as unknown as ToolDefinition['handler']
    })
    const wrapped = wrapHandlerWithDeprecation(tool)
    const result = (await (wrapped as unknown as (a: unknown, e: unknown) => Promise<CallToolResult>)(
      {},
      {}
    )) as CallToolResult
    const parsed = JSON.parse((result.content[0] as { text: string }).text) as Record<
      string,
      unknown
    >
    expect(parsed._deprecation).toEqual({ tool: 'test_tool', replacedBy: 'v2_tool' })
  })
})
