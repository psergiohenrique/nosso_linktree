// Runner contra um Postgres de verdade. Só roda com TEST_DATABASE_URL (`npm run test:db`).
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acquireMigrationLock,
  checksumOf,
  releaseMigrationLock,
  runMigrations,
} from "../scripts/migrations.mjs";

const adminUrl = process.env.TEST_DATABASE_URL;

const migration = (name: string, sql: string) => ({ name, sql, checksum: checksumOf(Buffer.from(sql)) });

describe.skipIf(!adminUrl)("banco: runner de migrações", () => {
  const admin = new pg.Client({ connectionString: adminUrl });

  beforeAll(async () => {
    await admin.connect();
  });

  afterAll(async () => {
    await admin.end().catch(() => {});
  });

  async function withDatabase(fn: (client: pg.Client) => Promise<void>) {
    const dbName = `migrate_${randomUUID().replace(/-/g, "")}`;
    if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error("nome de banco inválido");
    await admin.query(`create database ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: url.toString() });
    try {
      await client.connect();
      await fn(client);
    } finally {
      await client.end().catch(() => {});
      await admin.query(`drop database if exists ${dbName} with (force)`);
    }
  }

  it("aplica em ordem, não repete e desfaz a transação que falha", async () => {
    await withDatabase(async (client) => {
      const query = (sql: string, params?: unknown[]) =>
        params === undefined ? client.query(sql) : client.query(sql, params);
      const first = migration("0001_first.sql", "create table first_table (id int);");
      const second = migration("0002_second.sql", "create table second_table (id int);");
      await runMigrations({ query, files: [second, first], mode: "apply" });

      const tables = await client.query(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('first_table', 'second_table') order by 1",
      );
      expect(tables.rows.map((row: { table_name: string }) => row.table_name)).toEqual(["first_table", "second_table"]);

      await runMigrations({ query, files: [first, second], mode: "apply" });
      const tracked = await client.query("select name, checksum from schema_migrations order by name");
      expect(tracked.rows).toEqual([
        { name: first.name, checksum: first.checksum },
        { name: second.name, checksum: second.checksum },
      ]);

      const broken = migration("0003_broken.sql", "create table rolled_back (id int); select * from missing_relation;");
      const later = migration("0004_later.sql", "create table later_table (id int);");
      await expect(runMigrations({ query, files: [first, second, broken, later], mode: "apply" })).rejects.toThrow(
        /falha em 0003_broken.sql/,
      );
      const leftover = await client.query(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('rolled_back', 'later_table')",
      );
      expect(leftover.rows).toEqual([]);
      const names = await client.query("select name from schema_migrations order by name");
      expect(names.rows.map((row: { name: string }) => row.name)).toEqual([first.name, second.name]);
    });
  });

  it("recusa checksum alterado e não aplica a migração seguinte", async () => {
    await withDatabase(async (client) => {
      const query = (sql: string, params?: unknown[]) =>
        params === undefined ? client.query(sql) : client.query(sql, params);
      const first = migration("0001_first.sql", "create table first_table (id int);");
      const second = migration("0002_second.sql", "create table second_table (id int);");
      await runMigrations({ query, files: [first, second], mode: "apply" });
      await client.query("update schema_migrations set checksum = $1 where name = '0001_first.sql'", ["ab".repeat(32)]);
      const third = migration("0005_third.sql", "create table third_table (id int);");
      await expect(runMigrations({ query, files: [first, second, third], mode: "apply" })).rejects.toThrow(
        /checksum divergente em 0001_first.sql/,
      );
      const thirdTable = await client.query(
        "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'third_table'",
      );
      expect(thirdTable.rowCount).toBe(0);
    });
  });

  it("baseline reconhece users e não executa o SQL do arquivo", async () => {
    await withDatabase(async (client) => {
      const query = (sql: string, params?: unknown[]) =>
        params === undefined ? client.query(sql) : client.query(sql, params);
      await client.query("create table users (id int)");
      const init = migration("0001_init.sql", "create table should_not_exist (id int);");
      const layout = migration("0002_link_layout_size.sql", "create table should_not_exist_either (id int);");
      const result = await runMigrations({ query, files: [layout, init], mode: "baseline" });
      expect(result.baselined).toEqual([init.name]);
      expect(result.pending).toEqual([layout.name]);
      const ghost = await client.query(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name like 'should_not_exist%'",
      );
      expect(ghost.rows).toEqual([]);
      const row = await client.query("select checksum from schema_migrations where name = '0001_init.sql'");
      expect(row.rows[0].checksum).toBe(init.checksum);
    });
  });

  it("o lock de sessão é exclusivo entre conexões", async () => {
    await withDatabase(async (client) => {
      const current = await client.query<{ current: string }>("select current_database() as current");
      const peerUrl = new URL(adminUrl!);
      peerUrl.pathname = `/${current.rows[0].current}`;
      const peer = new pg.Client({ connectionString: peerUrl.toString() });
      await peer.connect();
      try {
        const hold = (sql: string, params?: unknown[]) =>
          params === undefined ? peer.query(sql) : peer.query(sql, params);
        const query = (sql: string, params?: unknown[]) =>
          params === undefined ? client.query(sql) : client.query(sql, params);
        await acquireMigrationLock(hold, { attempts: 1 });
        await expect(acquireMigrationLock(query, { attempts: 1, delayMs: 0, sleep: async () => {} })).rejects.toThrow(
          /lock/,
        );
        expect(await releaseMigrationLock(hold)).toBe(true);
        await acquireMigrationLock(query, { attempts: 1 });
        expect(await releaseMigrationLock(query)).toBe(true);
      } finally {
        await peer.end().catch(() => {});
      }
    });
  });
});
