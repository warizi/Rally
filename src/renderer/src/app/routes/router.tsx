import { createHashRouter } from 'react-router-dom'
import MainLayout from '../layout/MainLayout'

// 탭 시스템이 네비게이션을 담당하므로 라우터는 MainLayout만 렌더링
export const DefaultRouter = createHashRouter([
  {
    path: '/',
    element: <MainLayout />
  }
])
