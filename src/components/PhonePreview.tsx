import PageView, { type PageViewLink, type PageViewProfile } from "./PageView";
import PreviewPanel from "./PreviewPanel";

/** Prévia da página pública dentro de um celular (painel). */
export default function PhonePreview({
  profile,
  links,
  branding = true,
}: {
  profile: PageViewProfile;
  links: PageViewLink[];
  branding?: boolean;
}) {
  return (
    <PreviewPanel>
      <div className="phone phone-live">
        <div className="phone-live-screen">
          <PageView profile={profile} links={links} tracked={false} preview branding={branding} />
        </div>
      </div>
    </PreviewPanel>
  );
}
