/**
 * 등록된 임베드 host DOM 각각에 React EmbedView 를 portal mount.
 *
 * 한 페이지에 NoteEditor 가 여러 개 mount 되어 있을 때 (탭 + 캔버스 안
 * 노트 등) 각 EmbedPortals 가 자기 editorId 에 매칭되는 entry 만 골라
 * portal 한다 — 안 그러면 호스트 element 1 개에 여러 EmbedView 가
 * createPortal 되어 임베드 컨텐츠가 중복 렌더된다.
 */
import { createPortal } from 'react-dom'
import { useEmbedPortalStore } from '../model/embed-portal-store'
import { EmbedView } from './EmbedView'

interface Props {
  editorId: string
}

export function EmbedPortals({ editorId }: Props): React.JSX.Element {
  const entries = useEmbedPortalStore((s) => s.entries)
  return (
    <>
      {Object.values(entries)
        .filter((e) => e.editorId === editorId)
        .map((e) =>
          createPortal(
            <EmbedView
              domain={e.domain}
              entityId={e.entityId}
              height={e.height}
              onHeightChange={e.onHeightChange}
            />,
            e.host,
            e.portalId
          )
        )}
    </>
  )
}
