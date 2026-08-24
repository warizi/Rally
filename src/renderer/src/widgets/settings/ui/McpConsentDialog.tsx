/**
 * MCP 등록 전 고지·동의 다이얼로그 (보안 감사 P-1).
 *
 * MCP 등록은 단순한 "연동 켜기"가 아니다 — 연결된 AI 클라이언트에게 이 워크스페이스의
 * 모든 개인 데이터를 읽고 쓸 권한을 주고, 대화 과정에서 그 내용이 클라이언트 제공사
 * 서버(국외)로 전송될 수 있는 통로를 여는 행위다.
 *
 * 기존 안내는 "등록 후 Claude에서 노트·할 일·캔버스를 자유롭게 다룰 수 있어요"가 전부여서
 * 데이터가 어디로 나가는지 알 수 없었다. 개인정보보호법 제17조(제3자 제공)·제28조의8
 * (국외 이전)의 취지에 맞춰, 등록 전에 범위와 전송 가능성을 알리고 명시적으로 확인받는다.
 *
 * 표시 시점: "아직 등록되지 않은" 클라이언트를 등록할 때만. 경로 갱신(재등록)과 제거는
 * 이미 동의한 연동의 유지·해제라 다시 묻지 않는다.
 */
import type React from 'react'
import { ShieldAlertIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/shared/ui/alert-dialog'

interface McpConsentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 등록 대상 클라이언트 표시명 (예: 'Claude Desktop') */
  clientName: string
  /** 사용자가 동의했을 때 실행할 등록 동작 */
  onConfirm: () => void
  busy?: boolean
}

export function McpConsentDialog({
  open,
  onOpenChange,
  clientName,
  onConfirm,
  busy = false
}: McpConsentDialogProps): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlertIcon className="size-4 text-amber-500 shrink-0" />
            {clientName}에 이 워크스페이스를 연결할까요?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>연결하면 다음과 같이 동작합니다. 계속하기 전에 확인해 주세요.</p>

              <ul className="space-y-2 list-disc pl-5 marker:text-muted-foreground">
                <li>
                  {clientName}가 이 워크스페이스의{' '}
                  <strong>모든 노트·할 일·일정·캔버스를 읽고 수정</strong>할 수 있게 됩니다.
                </li>
                <li>
                  대화 과정에서 그 내용이 <strong>해당 서비스 제공사의 서버로 전송</strong>될 수
                  있습니다. 서버는 국외에 있을 수 있습니다.
                </li>
                <li>
                  연결은 언제든 이 화면의 <strong>&lsquo;제거&rsquo;</strong>로 끊을 수 있습니다.
                </li>
              </ul>

              <p className="text-xs text-muted-foreground">
                노트에 일기·건강 기록·계약 정보·타인의 연락처처럼 민감한 내용이 있다면, 연결 전에
                해당 항목을 다른 워크스페이스로 옮기는 것을 권합니다.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={onConfirm}>
            {busy ? '연결 중…' : '확인했습니다, 연결'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
