/**
 * 임베딩 모델(bge-m3)을 GitHub Release용 zip으로 패키징.
 *
 * zip 루트 구조: Xenova/bge-m3/{config.json, tokenizer.json, tokenizer_config.json, onnx/model_quantized.onnx}
 * → 앱(model-bootstrap.ts)이 받아서 userData/models 에 풀면 그대로 로컬 로드됨.
 *
 * 사용:
 *   1) dev에서 한 번 임베딩을 돌려 모델을 캐시 (userData/models/Xenova/bge-m3),
 *      또는 MODEL_SRC 환경변수로 모델 디렉터리 직접 지정
 *   2) node scripts/package-model.mjs [출력파일=bge-m3.zip]
 *   3) GitHub Release에 업로드 (앱 버전과 분리된 고정 태그 'models' 권장):
 *        gh release create models --title "Rally embedding models" --notes "bge-m3" || true
 *        gh release upload models bge-m3.zip --clobber
 *      (MODEL_DOWNLOAD_URL 의 owner/repo/tag/파일명과 일치해야 함)
 */
import AdmZip from 'adm-zip'
import os from 'os'
import path from 'path'
import fs from 'fs'

const DEFAULT_SRC = path.join(
  os.homedir(),
  'Library/Application Support/rally/models/Xenova/bge-m3'
)
const src = process.env.MODEL_SRC || DEFAULT_SRC
const out = process.argv[2] || 'bge-m3.zip'

if (!fs.existsSync(path.join(src, 'onnx', 'model_quantized.onnx'))) {
  console.error(`[package-model] 모델을 찾을 수 없습니다: ${src}`)
  console.error('  → dev에서 임베딩을 한 번 실행해 모델을 캐시하거나 MODEL_SRC로 경로를 지정하세요.')
  process.exit(1)
}

console.log(`[package-model] src=${src}`)
const zip = new AdmZip()
zip.addLocalFolder(src, 'Xenova/bge-m3')
zip.writeZip(out)
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1)
console.log(`[package-model] 생성 완료: ${out} (${mb} MB)`)
console.log('[package-model] 업로드: gh release upload models ' + out + ' --clobber')
