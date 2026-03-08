import { useEffect } from 'react'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'

const LAST_VERSION_KEY = 'lastAppVersion'

export function UpdateChecker(): null {
  const openTab = useTabStore((s) => s.openTab)

  useEffect(() => {
    // 세션 복원 완료 후 실행되도록 지연
    const timer = setTimeout(() => {
      window.api.appInfo.getVersion().then((res) => {
        if (!res.success || !res.data) return
        const currentVersion = res.data
        const lastVersion = localStorage.getItem(LAST_VERSION_KEY)

        const isUpdate = lastVersion
          ? lastVersion !== currentVersion
          : currentVersion !== '1.0.0'

        if (isUpdate) {
          openTab({
            type: 'changelog',
            pathname: ROUTES.CHANGELOG,
            title: '업데이트 내역'
          })
        }

        localStorage.setItem(LAST_VERSION_KEY, currentVersion)
      })
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
