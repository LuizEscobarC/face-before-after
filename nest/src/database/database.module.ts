/**
 * DatabaseModule — wires TypeORM into the Nest runtime.
 *
 * Reads DATABASE_URL from process.env (already loaded via dotenv in main.ts and
 * also via docker-compose env). Mirrors the same hard rules as data-source.ts:
 *   - synchronize:   false ALWAYS
 *   - migrationsRun: false (CLI-driven)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          throw new Error(
            'DATABASE_URL is required at runtime (postgresql://...).',
          );
        }
        return {
          type: 'postgres' as const,
          url,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          logging: process.env.DB_LOGGING === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
