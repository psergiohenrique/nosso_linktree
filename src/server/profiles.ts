import "server-only";
import { cache } from "react";
import type { LinkItem, Profile } from "@/lib/types";
import { query, queryOne } from "./db";

const PROFILE_COLUMNS = `id, slug, display_name, bio, avatar_id, bg_type, bg_color, bg_color2,
  text_color, button_color, button_text_color, button_style, font`;

export const getProfileByUser = cache((userId: string) =>
  queryOne<Profile>(`select ${PROFILE_COLUMNS} from profiles where id = $1`, [userId]),
);

export function getLinksByProfile(profileId: string) {
  return query<LinkItem>(
    `select id, profile_id, kind, title, url, thumbnail_id, position, is_active
       from links where profile_id = $1 order by position`,
    [profileId],
  );
}

/** Página pública: perfil + links ativos. */
export const getPublicPage = cache(async (slug: string) => {
  const profile = await queryOne<Profile>(`select ${PROFILE_COLUMNS} from profiles where slug = $1`, [
    slug.toLowerCase(),
  ]);
  if (!profile) return null;
  const links = await query<LinkItem>(
    `select id, profile_id, kind, title, url, thumbnail_id, position, is_active
       from links where profile_id = $1 and is_active order by position`,
    [profile.id],
  );
  return { profile, links };
});
