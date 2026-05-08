/**
 * Standalone TypeORM DataSource — used exclusively by the TypeORM CLI for migrations.
 *
 * Runtime DI (queries, repositories) goes through `database.module.ts`, which builds
 * its own DataSource via `TypeOrmModule.forRootAsync`. They share the same connection
 * config (read from DATABASE_URL) but live in different processes:
 *   - This file:  `npm run typeorm migration:*` (CLI, outside Nest context)
 *   - DatabaseModule: `npm run start` (Nest runtime)
 *
 * Per PR-1 decisions:
 *   - synchronize:    false  ALWAYS (schema only via migrations)
 *   - migrationsRun:  false  in production (run via CLI step)
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Format: postgresql://user:pass@host:port/db',
  );
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: databaseUrl,
  entities: ['src/**/*.entity.ts', 'dist/**/*.entity.js'],
  migrations: ['src/database/migrations/*.ts', 'dist/database/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  migrationsRun: false,
  logging: process.env.DB_LOGGING === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
