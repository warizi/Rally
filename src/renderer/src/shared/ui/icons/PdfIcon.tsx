import { forwardRef } from 'react'
import type { LucideProps } from 'lucide-react'

/**
 * Lucide 스타일 커스텀 PDF 아이콘.
 * 문서 모양 + "PDF" 글자가 새겨진 형태.
 */
const PdfIcon = forwardRef<SVGSVGElement, LucideProps>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* 문서 외곽 (접힌 모서리) */}
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a1 1 0 0 0 1 1h4" />
    {/* PDF 글자 */}
    <text
      x="12"
      y="15.5"
      textAnchor="middle"
      fontSize="6"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
      fill="currentColor"
      stroke="none"
      letterSpacing="0.3"
    >
      PDF
    </text>
  </svg>
))

PdfIcon.displayName = 'PdfIcon'

export { PdfIcon }
