import { JSX, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { IMAGE_EXTERNAL_CHANGED_EVENT } from '@entities/image-file'
import { ImageToolbar } from './ImageToolbar'

interface ImageViewerProps {
  imageId: string
  imageData: ArrayBuffer
  title: string
}

export function ImageViewer({ imageId, imageData, title }: ImageViewerProps): JSX.Element {
  const queryClient = useQueryClient()
  const [scale, setScale] = useState(1)
  const [objectUrl, setObjectUrl] = useState('')

  // ArrayBuffer → ObjectURL 변환 + 메모리 해제
  useEffect(() => {
    if (!imageData || imageData.byteLength === 0) {
      setObjectUrl('')
      return
    }
    const blob = new Blob([imageData])
    const url = URL.createObjectURL(blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageData])

  // 외부 변경 이벤트 리스닝 → refetch
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.imageId === imageId) {
        queryClient.invalidateQueries({ queryKey: ['image', 'content', imageId] })
      }
    }
    window.addEventListener(IMAGE_EXTERNAL_CHANGED_EVENT, handler)
    return () => window.removeEventListener(IMAGE_EXTERNAL_CHANGED_EVENT, handler)
  }, [imageId, queryClient])

  if (!objectUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        이미지를 불러올 수 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit
        onTransformed={(_ref, state) => setScale(state.scale)}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <ImageToolbar
              scale={scale}
              onZoomIn={() => zoomIn()}
              onZoomOut={() => zoomOut()}
              onReset={() => resetTransform()}
            />
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', flex: 1, minHeight: 0 }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={objectUrl}
                alt={title}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                draggable={false}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
