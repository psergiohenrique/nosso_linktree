"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import AppearanceFields from "./AppearanceFields";
import type { PageViewLink, PageViewProfile } from "./PageView";
import PhonePreview from "./PhonePreview";

type Props = {
  profile: PageViewProfile;
  links: PageViewLink[];
  branding?: boolean;
  action: (formData: FormData) => Promise<void>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Salvando…" : "Salvar aparência"}
    </button>
  );
}

export default function AppearanceEditor({ profile, links, branding = true, action }: Props) {
  const [state, setState] = useState<PageViewProfile>(profile);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    return () => {
      if (localAvatar) URL.revokeObjectURL(localAvatar);
    };
  }, [localAvatar]);

  const avatarUrl = localAvatar ?? (removeAvatar ? null : profile.avatar_url);

  return (
    <div className="dash-grid">
      <form action={action} className="dash-main" data-posthog-event="appearance_saved">
        <div className="dash-head">
          <p className="eyebrow">Aparência</p>
          <h1 className="h2 dash-h1">Sua página, seu jeito</h1>
        </div>

        <AppearanceFields
          state={state}
          setState={setState}
          avatarUrl={avatarUrl}
          onAvatarFile={(file) => {
            setLocalAvatar(file ? URL.createObjectURL(file) : null);
            if (file) setRemoveAvatar(false);
          }}
          onRemoveAvatar={() => {
            setLocalAvatar(null);
            setRemoveAvatar(true);
          }}
        />
        <input type="hidden" name="remove_avatar" value={removeAvatar ? "1" : ""} />

        <div className="save-bar">
          <SaveButton />
        </div>
      </form>

      <PhonePreview profile={{ ...state, avatar_url: avatarUrl }} links={links} branding={branding} />
    </div>
  );
}
