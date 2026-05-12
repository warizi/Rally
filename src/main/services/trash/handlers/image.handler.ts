import { imageFileRepository } from '../../../repositories/image-file'
import { createFileHandler } from './file-handler.factory'

/** image — workspace/path/{relativePath}.{png,jpg,...} → trash/batchId/.../{relativePath} */
export const imageHandler = createFileHandler('image', imageFileRepository)
