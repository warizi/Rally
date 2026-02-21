import { defineConfig } from 'drizzle-kit'
import { join } from 'path'

export default defineConfig({
  schema: './src/main/db/schema/index.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: join(process.cwd(), 'rally-dev.db')
  }
})
