import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import { PDF_EXTERNAL_CHANGED_EVENT } from '@entities/pdf-file'
import { useQueryClient } from '@tanstack/react-query'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  pdfId: string
  pdfData: ArrayBuffer
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export function PdfViewer({ pdfId, pdfData }: PdfViewerProps): JSX.Element {
  const [numPages, setNumPages] = useState<number>(0)
  const [zoomIndex, setZoomIndex] = useState(2) // 기본: 1x
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const queryClient = useQueryClient()

  const scale = ZOOM_STEPS[zoomIndex]

  // 외부 변경 시 React Query 재로드
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent).detail
      if (detail?.pdfId === pdfId) {
        queryClient.invalidateQueries({ queryKey: ['pdf', 'content', pdfId] })
      }
    }
    window.addEventListener(PDF_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(PDF_EXTERNAL_CHANGED_EVENT, handler)
  }, [pdfId, queryClient])

  // 컨테이너 너비 추적
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0))
  }, [])

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360)
  }, [])

  // 마우스 드래그 패닝
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = scrollRef.current
      if (!el) return
      // 텍스트 선택이나 링크 클릭은 무시
      if ((e.target as HTMLElement).closest('a, button, input')) return
      isDragging.current = true
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop
      }
      el.setPointerCapture(e.pointerId)
    },
    []
  )

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const el = scrollRef.current
    if (!el) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    el.scrollLeft = dragStart.current.scrollLeft - dx
    el.scrollTop = dragStart.current.scrollTop - dy
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const fileData = useMemo(() => ({ data: new Uint8Array(pdfData) }), [pdfData])

  // 컨테이너 기준 페이지 너비 (1x 기준 = 컨테이너에 맞춤)
  const baseWidth = Math.max(containerWidth - 48, 200)
  const pageWidth = baseWidth * scale

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-sm text-muted-foreground">
          {numPages > 0 ? `${numPages}페이지` : ''}
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleZoomOut}
                disabled={zoomIndex === 0}
              >
                <ZoomOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>축소</TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleZoomIn}
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
              >
                <ZoomIn className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>확대</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" onClick={handleRotate}>
                <RotateCw className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>회전</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* PDF 페이지 렌더링 — 확대 시 좌우 스크롤 + 드래그 패닝 */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="flex flex-col items-center gap-4 py-4 px-6"
          style={{ minWidth: pageWidth > baseWidth ? pageWidth + 48 : undefined }}
        >
          <Document
            file={fileData}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={
              <div className="text-sm text-muted-foreground py-8">PDF를 불러오는 중...</div>
            }
            error={
              <div className="text-sm text-destructive py-8">PDF를 불러올 수 없습니다.</div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                key={`page-${i + 1}`}
                pageNumber={i + 1}
                width={pageWidth}
                rotate={rotation}
                className="shadow-md"
              />
            ))}
          </Document>
        </div>
      </div>
    </div>
  )
}
