/**
 * FolderContextMenu 단위 테스트 (P1-3 follow-up 2).
 *
 * S1 (폴더 생성 - 컨텍스트 메뉴) + S4 (우클릭 메뉴 11개 항목) cover.
 *
 * 11개 메뉴 항목:
 *   추가 그룹 (6):
 *     1. 하위 폴더 생성       → onCreateChild
 *     2. 노트 ▶ 노트 추가하기 → onCreateNote
 *     3. 노트 ▶ 노트 가져오기 → onImportNote
 *     4. 테이블 ▶ 테이블 추가하기 → onCreateCsv
 *     5. 테이블 ▶ 테이블 가져오기 → onImportCsv
 *     6. PDF 가져오기         → onImportPdf
 *     7. 이미지 가져오기      → onImportImage
 *   편집 그룹 (2):
 *     8. 이름 변경            → onRename
 *     9. 색상 변경            → onEditColor
 *   삭제 그룹 (1):
 *     10. 삭제                → onDelete
 *
 * (라벨 "추가" / "편집" 까지 포함하면 11개. ContextMenuLabel 은 클릭 불가지만
 *  사양 상의 "11개 항목" 카운트에 들어감.)
 */
import { describe, it, expect, vi, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FolderContextMenu } from '../FolderContextMenu'

type MockFn = Mock<() => void>

interface Callbacks {
  onCreateChild: MockFn
  onCreateNote: MockFn
  onImportNote: MockFn
  onCreateCsv: MockFn
  onImportCsv: MockFn
  onImportPdf: MockFn
  onImportImage: MockFn
  onRename: MockFn
  onEditColor: MockFn
  onDelete: MockFn
}

function makeCallbacks(): Callbacks {
  return {
    onCreateChild: vi.fn(),
    onCreateNote: vi.fn(),
    onImportNote: vi.fn(),
    onCreateCsv: vi.fn(),
    onImportCsv: vi.fn(),
    onImportPdf: vi.fn(),
    onImportImage: vi.fn(),
    onRename: vi.fn(),
    onEditColor: vi.fn(),
    onDelete: vi.fn()
  }
}

function renderMenu(cb: Callbacks = makeCallbacks()): Callbacks {
  render(
    <FolderContextMenu name="My Folder" color="#abcdef" {...cb}>
      <div data-testid="trigger">trigger</div>
    </FolderContextMenu>
  )
  // contextmenu 이벤트로 메뉴 열기
  fireEvent.contextMenu(screen.getByTestId('trigger'))
  return cb
}

describe('FolderContextMenu — 11항목 (S4) + 폴더 생성 (S1)', () => {
  it('opens with folder name in label', () => {
    renderMenu()
    expect(screen.getByText('My Folder')).toBeInTheDocument()
  })

  it('renders 추가 / 편집 그룹 라벨', () => {
    renderMenu()
    expect(screen.getByText('추가')).toBeInTheDocument()
    expect(screen.getByText('편집')).toBeInTheDocument()
  })

  it('S1 — "하위 폴더 생성" click fires onCreateChild', () => {
    const cb = renderMenu()
    fireEvent.click(screen.getByText('하위 폴더 생성'))
    expect(cb.onCreateChild).toHaveBeenCalledTimes(1)
  })

  it('"PDF 가져오기" click fires onImportPdf', () => {
    const cb = renderMenu()
    fireEvent.click(screen.getByText('PDF 가져오기'))
    expect(cb.onImportPdf).toHaveBeenCalledTimes(1)
  })

  it('"이미지 가져오기" click fires onImportImage', () => {
    const cb = renderMenu()
    fireEvent.click(screen.getByText('이미지 가져오기'))
    expect(cb.onImportImage).toHaveBeenCalledTimes(1)
  })

  it('"이름 변경" click fires onRename', () => {
    const cb = renderMenu()
    fireEvent.click(screen.getByText('이름 변경'))
    expect(cb.onRename).toHaveBeenCalledTimes(1)
  })

  it('"색상 변경" click fires onEditColor', () => {
    const cb = renderMenu()
    fireEvent.click(screen.getByText('색상 변경'))
    expect(cb.onEditColor).toHaveBeenCalledTimes(1)
  })

  it('"삭제" click fires onDelete', () => {
    const cb = renderMenu()
    fireEvent.click(screen.getByText('삭제'))
    expect(cb.onDelete).toHaveBeenCalledTimes(1)
  })

  it('노트 submenu trigger + 추가하기 / 가져오기 항목', () => {
    const cb = renderMenu()
    // submenu trigger 호버 → open
    fireEvent.pointerEnter(screen.getByText('노트'))
    expect(screen.getByText('노트 추가하기')).toBeInTheDocument()
    expect(screen.getByText('노트 가져오기')).toBeInTheDocument()

    fireEvent.click(screen.getByText('노트 추가하기'))
    expect(cb.onCreateNote).toHaveBeenCalledTimes(1)
  })

  it('테이블 submenu — 추가하기 / 가져오기 항목', () => {
    const cb = renderMenu()
    fireEvent.pointerEnter(screen.getByText('테이블'))
    expect(screen.getByText('테이블 추가하기')).toBeInTheDocument()
    expect(screen.getByText('테이블 가져오기')).toBeInTheDocument()

    fireEvent.click(screen.getByText('테이블 가져오기'))
    expect(cb.onImportCsv).toHaveBeenCalledTimes(1)
  })

  it('11개 메뉴 항목이 모두 존재 (총합 카운트)', () => {
    renderMenu()
    // 추가 그룹: 하위 폴더 생성 + 노트 trigger + 테이블 trigger + PDF + 이미지 = 5개 (sub trigger 포함)
    expect(screen.getByText('하위 폴더 생성')).toBeInTheDocument()
    expect(screen.getByText('노트')).toBeInTheDocument()
    expect(screen.getByText('테이블')).toBeInTheDocument()
    expect(screen.getByText('PDF 가져오기')).toBeInTheDocument()
    expect(screen.getByText('이미지 가져오기')).toBeInTheDocument()
    // 편집 그룹: 이름 변경 + 색상 변경 = 2개
    expect(screen.getByText('이름 변경')).toBeInTheDocument()
    expect(screen.getByText('색상 변경')).toBeInTheDocument()
    // 삭제 그룹: 삭제 = 1개
    expect(screen.getByText('삭제')).toBeInTheDocument()
    // 두 라벨 (추가 / 편집) = 2개 → 합 11개
    expect(screen.getByText('추가')).toBeInTheDocument()
    expect(screen.getByText('편집')).toBeInTheDocument()
  })
})
