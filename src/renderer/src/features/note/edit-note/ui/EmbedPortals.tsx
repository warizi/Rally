/**
 * 등록된 임베드 host DOM 각각에 React EmbedView 를 portal mount.
 *
 * 단순한 구독 패턴 — store 변화마다 모든 host 에 createPortal.
 */
import { createPortal } from 'react-dom'
import { useEmbedPortalStore } from '../model/embed-portal-store'
import { EmbedView } from './EmbedView'

export function EmbedPortals(): React.JSX.Element {
  const entries = useEmbedPortalStore((s) => s.entries)
  return (
    <>
      {Object.values(entries).map((e) =>
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
