import { defineConfig } from 'prisma/config'

// The Prisma CLI (migrate deploy) uses the direct, unpooled Neon connection.
// The app itself connects through the pooled DATABASE_URL in src/lib/db.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
})
