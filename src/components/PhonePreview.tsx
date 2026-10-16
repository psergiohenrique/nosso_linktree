import PageView, { type PageViewLink, type PageViewProfile } from "./PageView";

/** Prévia da página pública dentro de um celular (painel). */
export default function PhonePreview({ profile, links }: { profile: PageViewProfile; links: PageViewLink[] }) {
  return (
    <div className="preview-col">
      <p className="eyebrow">Prévia</p>
      <div className="phone phone-live">
        <div className="phone-live-screen">
          <PageView profile={profile} links={links} tracked={false} preview />
        </div>
      </div>
    </div>
  );
}
