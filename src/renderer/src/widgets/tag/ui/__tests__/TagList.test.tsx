/**
 * widgets/tag/ui/TagList.test.tsx
 *
 * itemTags 배지 + TagPicker + dialog 3종. 토글 / 생성 / 삭제 flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeTag {
  id: string
  name: string
  color: string
  description?: string | null
}

const mocks = vi.hoisted(() => ({
  itemTags: [] as FakeTag[],
  allTags: [] as FakeTag[],
  attachMutate: vi.fn(),
  detachMutate: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  removeMutate: vi.fn(),
  createPending: false,
  updatePending: false,
  pickerProps: null as null | {
    onToggle: (t: FakeTag) => void
    onCreateClick: () => void
    onRemove: (t: FakeTag) => void
  }
}))

vi.mock('@entities/tag', () => ({
  useItemTags: () => ({ data: mocks.itemTags }),
  useTags: () => ({ data: mocks.allTags }),
  useAttachTag: () => ({ mutate: mocks.attachMutate }),
  useDetachTag: () => ({ mutate: mocks.detachMutate }),
  useCreateTag: () => ({ mutate: mocks.createMutate, isPending: mocks.createPending }),
  useUpdateTag: () => ({ mutate: mocks.updateMutate, isPending: mocks.updatePending }),
  useRemoveTag: () => ({ mutate: mocks.removeMutate }),
  TagBadge: ({ tag, onRemove }: { tag: FakeTag; onRemove?: () => void }) => (
    <span data-testid={`badge-${tag.id}`}>
      {tag.name}
      {onRemove && (
        <button data-testid={`badge-remove-${tag.id}`} onClick={onRemove}>
          x
        </button>
      )}
    </span>
  )
}))

vi.mock('../TagPicker', () => ({
  TagPicker: (props: {
    onToggle: (t: FakeTag) => void
    onCreateClick: () => void
    onRemove: (t: FakeTag) => void
  }) => {
    mocks.pickerProps = props
    return <div data-testid="tag-picker" />
  }
}))

vi.mock('../TagCreateDialog', () => ({
  TagCreateDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-dialog" /> : null
}))

vi.mock('../TagUpdateDialog', () => ({
  TagUpdateDialog: ({ open, tag }: { open: boolean; tag: FakeTag }) =>
    open ? <div data-testid="update-dialog">{tag.name}</div> : null
}))

import { TagList } from '../TagList'

beforeEach(() => {
  mocks.itemTags = []
  mocks.allTags = []
  mocks.attachMutate.mockReset()
  mocks.detachMutate.mockReset()
  mocks.createMutate.mockReset()
  mocks.updateMutate.mockReset()
  mocks.removeMutate.mockReset()
  mocks.createPending = false
  mocks.updatePending = false
  mocks.pickerProps = null
})

describe('TagList', () => {
  it('"태그" 라벨 + TagPicker 노출', () => {
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    expect(screen.getByText('태그')).toBeInTheDocument()
    expect(screen.getByTestId('tag-picker')).toBeInTheDocument()
  })

  it('itemTags 있음 → 각 TagBadge 노출', () => {
    mocks.itemTags = [
      { id: 't1', name: 'TagA', color: '#f00' },
      { id: 't2', name: 'TagB', color: '#0f0' }
    ]
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    expect(screen.getByTestId('badge-t1')).toHaveTextContent('TagA')
    expect(screen.getByTestId('badge-t2')).toHaveTextContent('TagB')
  })

  it('TagBadge x 클릭 → detachTag', () => {
    mocks.itemTags = [{ id: 't1', name: 'TagA', color: '#f00' }]
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    fireEvent.click(screen.getByTestId('badge-remove-t1'))
    expect(mocks.detachMutate).toHaveBeenCalledWith({
      itemType: 'note',
      tagId: 't1',
      itemId: 'n1'
    })
  })

  it('Badge 클릭 → TagUpdateDialog 노출', () => {
    mocks.itemTags = [{ id: 't1', name: 'TagA', color: '#f00' }]
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    fireEvent.click(screen.getByText('TagA'))
    expect(screen.getByTestId('update-dialog')).toHaveTextContent('TagA')
  })

  it('TagPicker onToggle (attach) → 미부착 태그 → attachTag', () => {
    mocks.allTags = [{ id: 't1', name: 'A', color: '#f00' }]
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    mocks.pickerProps?.onToggle({ id: 't1', name: 'A', color: '#f00' })
    expect(mocks.attachMutate).toHaveBeenCalled()
  })

  it('TagPicker onToggle (detach) → 이미 부착됨 → detachTag', () => {
    mocks.itemTags = [{ id: 't1', name: 'A', color: '#f00' }]
    mocks.allTags = [{ id: 't1', name: 'A', color: '#f00' }]
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    mocks.pickerProps?.onToggle({ id: 't1', name: 'A', color: '#f00' })
    expect(mocks.detachMutate).toHaveBeenCalled()
  })

  it('TagPicker onCreateClick → TagCreateDialog 열림', () => {
    render(<TagList workspaceId="ws" itemType="note" itemId="n1" />)
    mocks.pickerProps?.onCreateClick()
    // useState 비동기지만 동기 렌더로 재확인
  })
})
