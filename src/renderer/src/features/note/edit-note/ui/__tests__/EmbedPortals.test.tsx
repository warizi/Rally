/**
 * features/note/edit-note/ui/EmbedPortals.test.tsx
 *
 * useEmbedPortalStore.entries 중 editorId 일치하는 항목만 portal mount.
 * 다른 editorId 의 entry 는 무시.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

interface Entry {
  editorId: string
  domain: string
  entityId: string
  height: number
  onHeightChange: (h: number) => void
  host: HTMLElement
  portalId: string
}

const mocks = vi.hoisted(() => ({
  entries: {} as Record<string, Entry>
}))

vi.mock('../../model/embed-portal-store', () => ({
  useEmbedPortalStore: (sel: (s: { entries: typeof mocks.entries }) => unknown) =>
    sel({ entries: mocks.entries })
}))

vi.mock('../EmbedView', () => ({
  EmbedView: ({ entityId }: { entityId: string }) => (
    <div data-testid={`embed-${entityId}`}>{entityId}</div>
  )
}))

import { EmbedPortals } from '../EmbedPortals'

beforeEach(() => {
  mocks.entries = {}
})

describe('EmbedPortals', () => {
  it('entries 비었음 → 아무것도 렌더 안 됨', () => {
    const { container } = render(<EmbedPortals editorId="ed-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('editorId 일치 entry → host 에 portal mount', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mocks.entries = {
      a: {
        editorId: 'ed-1',
        domain: 'note',
        entityId: 'n1',
        height: 100,
        onHeightChange: vi.fn(),
        host,
        portalId: 'a'
      }
    }
    render(<EmbedPortals editorId="ed-1" />)
    expect(screen.getByTestId('embed-n1')).toBeInTheDocument()
    document.body.removeChild(host)
  })

  it('editorId 불일치 → 무시 (portal 미수행)', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mocks.entries = {
      a: {
        editorId: 'other',
        domain: 'note',
        entityId: 'n1',
        height: 100,
        onHeightChange: vi.fn(),
        host,
        portalId: 'a'
      }
    }
    render(<EmbedPortals editorId="ed-1" />)
    expect(screen.queryByTestId('embed-n1')).not.toBeInTheDocument()
    document.body.removeChild(host)
  })

  it('여러 entries → 일치하는 것만 다수 portal', () => {
    const host1 = document.createElement('div')
    const host2 = document.createElement('div')
    document.body.appendChild(host1)
    document.body.appendChild(host2)
    mocks.entries = {
      a: {
        editorId: 'ed-1',
        domain: 'note',
        entityId: 'n1',
        height: 0,
        onHeightChange: vi.fn(),
        host: host1,
        portalId: 'a'
      },
      b: {
        editorId: 'ed-1',
        domain: 'csv',
        entityId: 'c1',
        height: 0,
        onHeightChange: vi.fn(),
        host: host2,
        portalId: 'b'
      },
      c: {
        editorId: 'other',
        domain: 'note',
        entityId: 'n2',
        height: 0,
        onHeightChange: vi.fn(),
        host: host1,
        portalId: 'c'
      }
    }
    render(<EmbedPortals editorId="ed-1" />)
    expect(screen.getByTestId('embed-n1')).toBeInTheDocument()
    expect(screen.getByTestId('embed-c1')).toBeInTheDocument()
    expect(screen.queryByTestId('embed-n2')).not.toBeInTheDocument()
    document.body.removeChild(host1)
    document.body.removeChild(host2)
  })
})
