import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'

interface Props {
  onBackupSelected: (zipPath: string, workspaceName: string) => void
  onBackupCleared: () => void
}

export function BackupRestoreSection({
  onBackupSelected,
  onBackupCleared
}: Props): React.JSX.Element {
  const [zipPath, setZipPath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')

  const handleSelectFile = async (): Promise<void> => {
    const path = await window.api.backup.selectFile()
    if (!path) return

    setZipPath(path)
    setFileName(path.split('/').pop() ?? path)

    const res = await window.api.backup.readManifest(path)
    if (res.success && res.data) {
      onBackupSelected(path, res.data.workspaceName)
    }
  }

  const handleClear = (): void => {
    setZipPath(null)
    setFileName('')
    onBackupCleared()
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm font-medium mb-2">백업에서 복구</p>
      <div className="flex gap-2">
        <Input
          placeholder="백업 파일을 선택해주세요"
          readOnly
          value={fileName}
          className="flex-1"
        />
        {zipPath ? (
          <Button type="button" variant="outline" size="icon" onClick={handleClear}>
            <X className="size-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={handleSelectFile}>
            <Upload className="size-4 mr-1" />
            선택
          </Button>
        )}
      </div>
      {zipPath && (
        <p className="text-xs text-muted-foreground mt-1">
          백업 파일에서 이름이 자동 입력됩니다. 수정할 수 있습니다.
        </p>
      )}
    </div>
  )
}
