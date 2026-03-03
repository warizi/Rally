# Note Image Test Plan

> **Feature**: note-image-test
> **Date**: 2026-03-03
> **Status**: Draft

---

## 1. Overview

note-image 기능(서비스, IPC, 노트 연동)에 대한 단위 테스트 코드 작성.

### 1.1 Test Targets

| Target | File | Methods |
|--------|------|---------|
| noteImageService | `src/main/services/note-image.ts` | saveFromPath, saveFromBuffer, extractImagePaths, deleteImage, cleanupRemovedImages, deleteAllImages, readImage |
| note.ts 연동 | `src/main/services/note.ts` | writeContent (이미지 정리), remove (이미지 전삭제) |

### 1.2 Scope

- noteImageService 7개 메서드 단위 테스트
- note.ts writeContent/remove의 noteImageService 호출 검증 (기존 note.test.ts에 추가)
- IPC 핸들러는 `handle()` 래퍼로 동작하므로 별도 테스트 불필요

---

## 2. Test Cases

### 2.1 noteImageService — `saveFromPath` (6 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 정상 이미지 파일 저장 | `.images/{nanoid}.{ext}` 반환, fs.copyFileSync 호출 |
| 2 | .images/ 폴더 자동 생성 | fs.mkdirSync 호출 확인 |
| 3 | .images/ 폴더 이미 존재 | mkdirSync 미호출 |
| 4 | 존재하지 않는 소스 파일 | NotFoundError throw |
| 5 | 지원하지 않는 확장자 (.txt) | ValidationError throw |
| 6 | 잘못된 workspaceId | NotFoundError throw |

### 2.2 noteImageService — `saveFromBuffer` (4 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 정상 ArrayBuffer 저장 (ext: 'png') | `.images/{nanoid}.png` 반환 |
| 2 | 점 포함 확장자 (ext: '.jpg') | 정규화 후 `.images/{nanoid}.jpg` |
| 3 | 지원하지 않는 확장자 (ext: 'txt') | ValidationError throw |
| 4 | fs.writeFileSync에 Buffer.from(buffer) 전달 확인 | 호출 인자 검증 |

### 2.3 noteImageService — `readImage` (5 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 정상 읽기 (.images/abc.png) | { data: Buffer } 반환 |
| 2 | path traversal: `../secret.txt` | ValidationError throw |
| 3 | 절대 경로: `/etc/passwd` | ValidationError throw |
| 4 | .images/ 외 경로: `photos/img.png` | ValidationError throw |
| 5 | 파일 미존재 | NotFoundError throw |

### 2.4 noteImageService — `extractImagePaths` (4 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 이미지 참조 2개 포함 마크다운 | 2개 경로 배열 반환 |
| 2 | 이미지 참조 없는 마크다운 | 빈 배열 |
| 3 | 외부 URL 이미지 (`http://...`) | 빈 배열 (.images/ 아님) |
| 4 | 빈 문자열 | 빈 배열 |

### 2.5 noteImageService — `deleteImage` (4 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 정상 삭제 (.images/abc.png) | fs.unlinkSync 호출 |
| 2 | path traversal 시도 (../file) | 무시 (no-op) |
| 3 | .images/ 외 경로 | 무시 (no-op) |
| 4 | 이미 삭제된 파일 (ENOENT) | 예외 무시 (no-op) |

### 2.6 noteImageService — `cleanupRemovedImages` (3 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | old에 2개, new에 1개 → 1개 삭제 | deleteImage 1회 호출 |
| 2 | old와 new 동일 | deleteImage 미호출 |
| 3 | old에 이미지 있고 new에 전부 제거 | deleteImage N회 호출 |

### 2.7 noteImageService — `deleteAllImages` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 이미지 3개 참조 마크다운 | deleteImage 3회 호출 |
| 2 | 이미지 없는 마크다운 | deleteImage 미호출 |

### 2.8 note.ts 연동 테스트 (4 cases, 기존 note.test.ts에 추가)

| # | Case | Expected |
|---|------|----------|
| 1 | writeContent: 이미지 제거 시 cleanupRemovedImages 호출 | 호출 인자 검증 |
| 2 | writeContent: 파일 미존재 시 (최초 작성) 에러 없음 | cleanupRemovedImages 미호출 |
| 3 | remove: 노트 삭제 시 deleteAllImages 호출 | content로 호출 확인 |
| 4 | remove: 파일 읽기 실패 시 에러 무시 | throw 없음 |

---

## 3. Test Files

| File | Target | Est. Cases |
|------|--------|:----------:|
| `src/main/services/__tests__/note-image.test.ts` | noteImageService 7개 메서드 | 28 |
| `src/main/services/__tests__/note.test.ts` | writeContent/remove 연동 (기존 파일에 추가) | 4 |
| **Total** | | **32** |

---

## 4. Mocking Strategy

```
vi.mock('fs')                          — fs 전체 모킹
vi.mock('nanoid', () => nanoid: () => 'mock-id')  — 고정 ID
vi.mock('../../repositories/workspace') — findById 모킹
vi.mock('../../lib/fs-utils')          — isImageFile 실제 구현 or 모킹
vi.mock('../note-image')               — note.test.ts에서 noteImageService 모킹
```

---

## 5. Non-Functional Requirements

- 기존 테스트 패턴 (vi.mock, beforeEach clearAllMocks) 준수
- `isImageFile`은 실제 구현 사용 (단순 확장자 체크이므로)
- path.normalize, path.join 등은 실제 구현 사용
