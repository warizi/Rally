import { csvFileRepository } from '../../../repositories/csv-file'
import { createFileHandler } from './file-handler.factory'

/** csv — workspace/path/{relativePath}.csv → trash/batchId/{relativePath}.csv */
export const csvHandler = createFileHandler('csv', csvFileRepository)
