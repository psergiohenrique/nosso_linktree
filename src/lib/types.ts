export type Theme = 'light' | 'dark' | 'sunset';

export type Profile = {
  id: string;
  slug: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  theme: Theme;
  accent: string;
};

export type LinkItem = {
  id: string;
  profile_id: string;
  kind: 'link' | 'whatsapp';
  title: string;
  url: string;
  position: number;
  is_active: boolean;
};
