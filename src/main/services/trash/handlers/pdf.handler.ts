import { pdfFileRepository } from '../../../repositories/pdf-file'
import { createFileHandler } from './file-handler.factory'

/** pdf — workspace/path/{relativePath}.pdf → trash/batchId/{relativePath}.pdf */
export const pdfHandler = createFileHandler('pdf', pdfFileRepository)
