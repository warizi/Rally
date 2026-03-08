# Design: Note Image 테스트 코드 작성

> 작성일: 2026-03-03
> 기능: note-image-test
> Plan 참조: `docs/01-plan/features/note-image-test.plan.md`

---

## 1. 구현 순서

| 순서 | 파일                                             | 설명                                                  |
| ---- | ------------------------------------------------ | ----------------------------------------------------- |
| 1    | `src/main/services/__tests__/note-image.test.ts` | noteImageService 7개 메서드 단위 테스트 (32 cases)    |
| 2    | `src/main/services/__tests__/note.test.ts`       | writeContent/remove 이미지 연동 테스트 추가 (4 cases) |

환경 설정 변경 없음.

---

## 2. 파일 상세 설계

---

### 파일 1: `src/main/services/__tests__/note-image.test.ts`

> 패턴 참조: `image-file.test.ts` (vi.mock + vi.clearAllMocks)

#### 2.1.1 import & mock & 픽스처

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { noteImageService } from '../note-image'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

// isImageFile은 실제 구현 사용 (단순 확장자 체크)
// fs-utils 모킹하지 않음

const MOCK_WS = {
  id: 'ws-1',
  name: 'T',
  path: '/test/workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  // fs.existsSync 기본: true (파일/폴더 존재)
  vi.mocked(fs.existsSync).mockReturnValue(true)
})
```

**핵심 설계 판단:**

- `fs` 전체 모킹 — `existsSync`, `mkdirSync`, `copyFileSync`, `writeFileSync`, `unlinkSync`, `readFileSync` 모두 제어
- `nanoid` 고정 ID `'mock-id'` — 파일명 예측 가능
- `isImageFile`은 **모킹하지 않음** — `path.extname` + 배열 체크이므로 실제 로직 사용이 적절
- `path` 모킹하지 않음 — 실제 `path.normalize`, `path.join` 동작 필요 (보안 검증)

#### 2.1.2 테스트 케이스

---

**saveFromPath** (6건)

| #   | Case                              | 핵심 assertion                                             |
| --- | --------------------------------- | ---------------------------------------------------------- |
| 1   | 정상 이미지 파일 저장             | 반환값 `'.images/mock-id.png'`, `fs.copyFileSync` 호출     |
| 2   | .images/ 폴더 미존재 시 자동 생성 | `existsSync` false → `mkdirSync` 호출 확인                 |
| 3   | .images/ 폴더 이미 존재           | `existsSync` true → `mkdirSync` 미호출                     |
| 4   | 존재하지 않는 소스 파일           | `existsSync` sourcePath에 false → `NotFoundError`          |
| 5   | 지원하지 않는 확장자 (.txt)       | `ValidationError` throw                                    |
| 6   | 잘못된 workspaceId                | `workspaceRepository.findById` undefined → `NotFoundError` |

```typescript
describe('saveFromPath', () => {
  it('정상 이미지 파일 저장 → .images/{nanoid}.{ext} 반환', () => {
    const result = noteImageService.saveFromPath('ws-1', '/source/photo.png')
    expect(result).toBe('.images/mock-id.png')
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/source/photo.png',
      path.join('/test/workspace', '.images', 'mock-id.png')
    )
  })

  it('.images/ 폴더 미존재 시 mkdirSync 호출', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).endsWith('.images')) return false // 폴더 미존재
      return true // 소스 파일 존재
    })
    noteImageService.saveFromPath('ws-1', '/source/photo.png')
    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/workspace', '.images'), {
      recursive: true
    })
  })

  it('.images/ 폴더 이미 존재 시 mkdirSync 미호출', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    noteImageService.saveFromPath('ws-1', '/source/photo.png')
    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it('소스 파일 미존재 → NotFoundError', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p) === '/source/missing.png') return false
      return true
    })
    expect(() => noteImageService.saveFromPath('ws-1', '/source/missing.png')).toThrow(
      NotFoundError
    )
  })

  it('지원하지 않는 확장자 → ValidationError', () => {
    expect(() => noteImageService.saveFromPath('ws-1', '/source/doc.txt')).toThrow(ValidationError)
  })

  it('잘못된 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteImageService.saveFromPath('bad', '/source/photo.png')).toThrow(NotFoundError)
  })
})
```

---

**saveFromBuffer** (4건)

| #   | Case                                        | 핵심 assertion                  |
| --- | ------------------------------------------- | ------------------------------- |
| 1   | 정상 ArrayBuffer 저장 (ext: 'png')          | 반환값 `'.images/mock-id.png'`  |
| 2   | 점 포함 확장자 (ext: '.jpg')                | 정규화 후 `.images/mock-id.jpg` |
| 3   | 지원하지 않는 확장자 (ext: 'txt')           | `ValidationError` throw         |
| 4   | fs.writeFileSync에 Buffer.from(buffer) 전달 | 호출 인자 검증                  |

```typescript
describe('saveFromBuffer', () => {
  it('정상 ArrayBuffer 저장 → .images/mock-id.png', () => {
    const buf = new ArrayBuffer(8)
    const result = noteImageService.saveFromBuffer('ws-1', buf, 'png')
    expect(result).toBe('.images/mock-id.png')
  })

  it('점 포함 확장자 (.jpg) → 정규화', () => {
    const buf = new ArrayBuffer(8)
    const result = noteImageService.saveFromBuffer('ws-1', buf, '.jpg')
    expect(result).toBe('.images/mock-id.jpg')
  })

  it('지원하지 않는 확장자 → ValidationError', () => {
    const buf = new ArrayBuffer(8)
    expect(() => noteImageService.saveFromBuffer('ws-1', buf, 'txt')).toThrow(ValidationError)
  })

  it('fs.writeFileSync에 Buffer.from(buffer) 전달', () => {
    const buf = new ArrayBuffer(8)
    noteImageService.saveFromBuffer('ws-1', buf, 'png')
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/workspace', '.images', 'mock-id.png'),
      Buffer.from(buf)
    )
  })
})
```

---

**readImage** (6건)

| #   | Case                                                  | 핵심 assertion                                |
| --- | ----------------------------------------------------- | --------------------------------------------- |
| 1   | 정상 읽기 (.images/abc.png)                           | `{ data: Buffer }` 반환                       |
| 2   | path traversal: `../secret.txt`                       | `ValidationError` throw                       |
| 3   | .images/ 내부 path traversal: `.images/../secret.txt` | normalize 후 `secret.txt` → `ValidationError` |
| 4   | 절대 경로: `/etc/passwd`                              | `ValidationError` throw                       |
| 5   | .images/ 외 경로: `photos/img.png`                    | `ValidationError` throw                       |
| 6   | 파일 미존재 (readFileSync throw)                      | `NotFoundError` throw                         |

```typescript
describe('readImage', () => {
  it('정상 읽기 → { data: Buffer } 반환', () => {
    const buf = Buffer.from('fake-image')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)
    const result = noteImageService.readImage('ws-1', '.images/abc.png')
    expect(result.data).toBe(buf)
    expect(fs.readFileSync).toHaveBeenCalledWith(path.join('/test/workspace', '.images', 'abc.png'))
  })

  it('path traversal (../secret.txt) → ValidationError', () => {
    expect(() => noteImageService.readImage('ws-1', '../secret.txt')).toThrow(ValidationError)
  })

  it('.images/ 내부 path traversal (.images/../secret.txt) → ValidationError', () => {
    // path.normalize('.images/../secret.txt') → 'secret.txt' (.. 해소)
    // 'secret.txt'.startsWith('.images') → false → ValidationError
    expect(() => noteImageService.readImage('ws-1', '.images/../secret.txt')).toThrow(
      ValidationError
    )
  })

  it('절대 경로 (/etc/passwd) → ValidationError', () => {
    expect(() => noteImageService.readImage('ws-1', '/etc/passwd')).toThrow(ValidationError)
  })

  it('.images/ 외 경로 (photos/img.png) → ValidationError', () => {
    expect(() => noteImageService.readImage('ws-1', 'photos/img.png')).toThrow(ValidationError)
  })

  it('파일 미존재 → NotFoundError', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => noteImageService.readImage('ws-1', '.images/missing.png')).toThrow(NotFoundError)
  })
})
```

---

**extractImagePaths** (5건)

| #   | Case                      | 핵심 assertion          |
| --- | ------------------------- | ----------------------- |
| 1   | 이미지 참조 2개 포함      | 2개 경로 배열           |
| 2   | 이미지 참조 없는 마크다운 | 빈 배열                 |
| 3   | 외부 URL 이미지           | 빈 배열 (.images/ 아님) |
| 4   | 빈 문자열                 | 빈 배열                 |
| 5   | title 속성 포함 마크다운  | 경로만 추출, title 제외 |

```typescript
describe('extractImagePaths', () => {
  it('이미지 참조 2개 → 2개 경로 반환', () => {
    const md = '![a](.images/a.png) text ![b](.images/b.jpg)'
    const result = noteImageService.extractImagePaths(md)
    expect(result).toEqual(['.images/a.png', '.images/b.jpg'])
  })

  it('이미지 참조 없는 마크다운 → 빈 배열', () => {
    const md = '# Hello\n\nSome text without images'
    expect(noteImageService.extractImagePaths(md)).toEqual([])
  })

  it('외부 URL 이미지 → 빈 배열', () => {
    const md = '![photo](https://example.com/img.png)'
    expect(noteImageService.extractImagePaths(md)).toEqual([])
  })

  it('빈 문자열 → 빈 배열', () => {
    expect(noteImageService.extractImagePaths('')).toEqual([])
  })

  it('title 속성 포함 → 경로만 추출, title 제외', () => {
    // regex [^)"\s]+ 가 공백/따옴표에서 멈추는지 검증
    const md = '![alt](.images/photo.png "title text")'
    const result = noteImageService.extractImagePaths(md)
    expect(result).toEqual(['.images/photo.png'])
  })
})
```

---

**deleteImage** (6건)

| #   | Case                                           | 핵심 assertion            |
| --- | ---------------------------------------------- | ------------------------- |
| 1   | 정상 삭제 (.images/abc.png)                    | `fs.unlinkSync` 호출      |
| 2   | path traversal (../file)                       | no-op (unlinkSync 미호출) |
| 3   | .images/ 내부 path traversal (.images/../file) | normalize 후 탈출 → no-op |
| 4   | 절대 경로 (/etc/passwd)                        | no-op                     |
| 5   | .images/ 외 경로                               | no-op                     |
| 6   | 이미 삭제된 파일 (ENOENT)                      | 예외 무시, throw 없음     |

```typescript
describe('deleteImage', () => {
  it('정상 삭제 → fs.unlinkSync 호출', () => {
    noteImageService.deleteImage('ws-1', '.images/abc.png')
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join('/test/workspace', '.images', 'abc.png'))
  })

  it('path traversal (../file) → no-op', () => {
    noteImageService.deleteImage('ws-1', '../secret.txt')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('.images/ 내부 path traversal (.images/../secret.txt) → no-op', () => {
    // path.normalize('.images/../secret.txt') → 'secret.txt'
    // !startsWith('.images') → return (no-op)
    noteImageService.deleteImage('ws-1', '.images/../secret.txt')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('절대 경로 (/etc/passwd) → no-op', () => {
    noteImageService.deleteImage('ws-1', '/etc/passwd')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('.images/ 외 경로 → no-op', () => {
    noteImageService.deleteImage('ws-1', 'photos/img.png')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('이미 삭제된 파일 (ENOENT) → throw 없음', () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => noteImageService.deleteImage('ws-1', '.images/gone.png')).not.toThrow()
  })
})
```

---

**cleanupRemovedImages** (3건)

| #   | Case                        | 핵심 assertion                       |
| --- | --------------------------- | ------------------------------------ |
| 1   | old 2개, new 1개 → 1개 삭제 | `unlinkSync` 1회 호출, 제거된 경로만 |
| 2   | old와 new 동일              | `unlinkSync` 미호출                  |
| 3   | old에 있고 new에 전부 제거  | `unlinkSync` N회 호출                |

```typescript
describe('cleanupRemovedImages', () => {
  it('old 2개, new 1개 → 제거된 1개만 삭제', () => {
    const old = '![a](.images/a.png) ![b](.images/b.png)'
    const now = '![a](.images/a.png)'
    noteImageService.cleanupRemovedImages('ws-1', old, now)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1)
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join('/test/workspace', '.images', 'b.png'))
  })

  it('old와 new 동일 → unlinkSync 미호출', () => {
    const md = '![a](.images/a.png)'
    noteImageService.cleanupRemovedImages('ws-1', md, md)
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('old에 2개, new에 전부 제거 → unlinkSync 2회', () => {
    const old = '![a](.images/a.png) ![b](.images/b.png)'
    const now = 'no images'
    noteImageService.cleanupRemovedImages('ws-1', old, now)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2)
  })
})
```

---

**deleteAllImages** (2건)

| #   | Case                     | 핵심 assertion        |
| --- | ------------------------ | --------------------- |
| 1   | 이미지 3개 참조 마크다운 | `unlinkSync` 3회 호출 |
| 2   | 이미지 없는 마크다운     | `unlinkSync` 미호출   |

```typescript
describe('deleteAllImages', () => {
  it('이미지 3개 → unlinkSync 3회 호출', () => {
    const md = '![a](.images/a.png) ![b](.images/b.jpg) ![c](.images/c.gif)'
    noteImageService.deleteAllImages('ws-1', md)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(3)
  })

  it('이미지 없는 마크다운 → unlinkSync 미호출', () => {
    noteImageService.deleteAllImages('ws-1', '# No images here')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })
})
```

---

### 파일 2: `src/main/services/__tests__/note.test.ts` (기존 파일에 추가)

> 기존 파일 끝에 2개 describe 블록 추가

#### 2.2.1 추가 mock 선언

기존 mock 선언부에 `noteImageService` mock 추가:

```typescript
vi.mock('../note-image', () => ({
  noteImageService: {
    cleanupRemovedImages: vi.fn(),
    deleteAllImages: vi.fn()
  }
}))
```

그리고 import 추가:

```typescript
import { noteImageService } from '../note-image'
```

#### 2.2.2 테스트 케이스

---

**writeContent — 이미지 정리** (2건, 기존 writeContent describe에 추가)

| #   | Case                                                   | 핵심 assertion              |
| --- | ------------------------------------------------------ | --------------------------- |
| 1   | 이미지 제거 시 cleanupRemovedImages 호출               | old/new content로 호출 확인 |
| 2   | 파일 미존재 시 (최초 작성) cleanupRemovedImages 미호출 | readFileSync throw → 미호출 |

```typescript
// 기존 writeContent describe 내부에 추가
it('이미지 제거 시 cleanupRemovedImages 호출', () => {
  insertTestNote('n1', 'note.md')
  const oldContent = '![img](.images/old.png)'
  const newContent = 'no image'
  vi.mocked(fs.readFileSync).mockReturnValueOnce(oldContent as never)
  noteService.writeContent('ws-1', 'n1', newContent)
  expect(noteImageService.cleanupRemovedImages).toHaveBeenCalledWith('ws-1', oldContent, newContent)
})

it('파일 미존재 시 (최초 작성) cleanupRemovedImages 미호출', () => {
  insertTestNote('n1', 'note.md')
  vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
    throw new Error('ENOENT')
  })
  noteService.writeContent('ws-1', 'n1', 'new content')
  expect(noteImageService.cleanupRemovedImages).not.toHaveBeenCalled()
})
```

---

**remove — 이미지 전삭제** (2건, 기존 remove describe에 추가)

| #   | Case                              | 핵심 assertion                                          |
| --- | --------------------------------- | ------------------------------------------------------- |
| 1   | 노트 삭제 시 deleteAllImages 호출 | content로 호출 확인                                     |
| 2   | 파일 읽기 실패 시 에러 무시       | readFileSync throw → deleteAllImages 미호출, throw 없음 |

```typescript
// 기존 remove describe 내부에 추가
it('노트 삭제 시 deleteAllImages 호출', () => {
  insertTestNote('n1', 'note.md')
  const content = '![img](.images/photo.png)'
  vi.mocked(fs.readFileSync).mockReturnValueOnce(content as never)
  noteService.remove('ws-1', 'n1')
  expect(noteImageService.deleteAllImages).toHaveBeenCalledWith('ws-1', content)
})

it('파일 읽기 실패 시 deleteAllImages 미호출, throw 없음', () => {
  insertTestNote('n1', 'note.md')
  vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
    throw new Error('ENOENT')
  })
  expect(() => noteService.remove('ws-1', 'n1')).not.toThrow()
  expect(noteImageService.deleteAllImages).not.toHaveBeenCalled()
})
```

---

## 3. 테스트 케이스 요약

| 파일               | describe             | cases  |
| ------------------ | -------------------- | :----: |
| note-image.test.ts | saveFromPath         |   6    |
|                    | saveFromBuffer       |   4    |
|                    | readImage            |   6    |
|                    | extractImagePaths    |   5    |
|                    | deleteImage          |   6    |
|                    | cleanupRemovedImages |   3    |
|                    | deleteAllImages      |   2    |
| note.test.ts       | writeContent (추가)  |   2    |
|                    | remove (추가)        |   2    |
| **Total**          |                      | **36** |

---

## 4. 주의사항

- `isImageFile`은 `fs-utils.ts`에서 실제 `path.extname` 사용 → **모킹하지 않고** 실제 로직 그대로 테스트
- `path.normalize`, `path.join`도 실제 구현 사용 — 보안 검증(path traversal 방지)의 정확성 필요
- `note.test.ts`에서 `noteImageService` mock 추가 시 기존 테스트에 영향 없음 확인 (mock은 모듈 레벨, 기존 코드는 `noteImageService` 호출 경로가 try-catch 안에 있음)
- `fs.readFileSync` mock이 `writeContent`/`remove` 테스트에서 기존 케이스와 충돌하지 않도록 `mockReturnValueOnce` 사용
- 기존 `writeContent`/`remove` 테스트에서 `readFileSync` auto-mock은 `undefined` 반환 → mocked `noteImageService`에 `undefined` 전달되나 no-op이므로 영향 없음
- `.images/../` 패턴은 `path.normalize`가 `..` 해소 후 `.images` prefix 검증에서 차단됨 — 이 동작을 `readImage`, `deleteImage` 양쪽에서 명시적으로 테스트
