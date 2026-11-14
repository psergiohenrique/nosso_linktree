// Integração com o Postgres: só roda com TEST_DATABASE_URL (veja `npm run test:db`).
// O bloco Pix não conta como link ativo para a indexação nem gasta vaga do plano Grátis.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userId: "" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: mocks.userId, email: "x@exemplo.com", verified: true }),
}));
vi.mock("@/server/posthog-logs", () => ({ emitPostHogLog: vi.fn() }));
vi.mock("@/server/weekly-report", () => ({ setWeeklyReport: vi.fn() }));

import { addLink } from "@/app/dashboard/actions";
import { FREE_LINK_LIMIT } from "@/lib/billing";
import { countIndexableLinks, INDEXABLE_SQL } from "@/lib/seo";
import { pool, query, queryOne } from "@/server/db";

const PIX_CONFIG = JSON.stringify({ merchantName: "FULANO", merchantCity: "BRASILIA" });

describe("countIndexableLinks", () => {
  it("não conta o bloco Pix", () => {
    expect(countIndexableLinks([{ kind: "pix" }])).toBe(0);
    expect(countIndexableLinks([{ kind: "pix" }, { kind: "link" }, { kind: "whatsapp" }])).toBe(2);
    expect(countIndexableLinks([{}])).toBe(1);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("banco: link Pix na indexação e no limite do Grátis", () => {
  const created: string[] = [];

  beforeAll(() => {
    process.env.BILLING_ENABLED = "true";
  });

  afterAll(async () => {
    for (const id of created) await query("delete from users where id = $1", [id]);
    await pool.end();
  });

  async function account() {
    const row = await queryOne<{ id: string }>(
      "insert into users (email, password_hash, email_verified_at) values ($1, 'scrypt$x$y', now()) returning id",
      [`pix-${randomUUID()}@exemplo.com`],
    );
    const id = row!.id;
    created.push(id);
    await query("insert into profiles (id, slug, display_name) values ($1, $2, 'Loja') ", [id, `pix-${id.slice(0, 12)}`]);
    return id;
  }

  const addRow = (profileId: string, kind: string, active = true) =>
    query(
      "insert into links (profile_id, kind, title, url, config, position, is_active) values ($1, $2, 'L', $3, $4::jsonb, $5, $6)",
      [
        profileId,
        kind,
        kind === "pix" ? "123e4567-e12b-12d1-a456-426655440000" : "https://exemplo.com",
        kind === "pix" ? PIX_CONFIG : null,
        Math.floor(Math.random() * 1e6),
        active,
      ],
    );

  const indexable = async (id: string) =>
    (await queryOne(`select 1 from profiles p where p.id = $1 and ${INDEXABLE_SQL}`, [id])) !== null;

  it("INDEXABLE_SQL: página só com link Pix não é indexável; com um link comum, é", async () => {
    const id = await account();
    await addRow(id, "pix");
    expect(await indexable(id)).toBe(false);

    await addRow(id, "link", false); // link comum inativo também não vale
    expect(await indexable(id)).toBe(false);

    await addRow(id, "link");
    expect(await indexable(id)).toBe(true);
  });

  it("addLink no Grátis: o Pix já salvo não gasta vaga", async () => {
    const id = await account();
    mocks.userId = id;
    await addRow(id, "pix");
    for (let i = 0; i < FREE_LINK_LIMIT - 1; i++) await addRow(id, "link");

    const form = (title: string) => {
      const data = new FormData();
      data.set("kind", "link");
      data.set("title", title);
      data.set("url", "https://exemplo.com/novo");
      return data;
    };

    // 1 Pix + 4 links comuns: ainda cabe o quinto.
    await addLink(form("quinto"));
    expect((await queryOne<{ n: string }>("select count(*) n from links where profile_id = $1 and kind = 'link'", [id]))!.n).toBe(
      String(FREE_LINK_LIMIT),
    );

    // Agora são 5 comuns: o sexto é recusado.
    await expect(addLink(form("sexto"))).rejects.toThrow(/REDIRECT \/dashboard\?error=.*5%20links/);
    expect((await queryOne<{ n: string }>("select count(*) n from links where profile_id = $1", [id]))!.n).toBe(
      String(FREE_LINK_LIMIT + 1),
    );
  });
});
