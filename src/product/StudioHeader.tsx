import type { ReactNode } from "react";
export function StudioHeader({
  back,
  title,
  status,
  actions,
  className = "",
}: {
  back: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <header className={"v-studio-header " + className}>
      <div className="v-studio-header-identity">
        {back}
        <span className="v-studio-monogram" aria-hidden="true">
          <img src="/velori-wing-mark.png" alt="" />
        </span>
        <div className="v-studio-heading">
          <span>VELORI STUDIO</span>
          {title}
        </div>
      </div>
      <div className="v-studio-header-status">{status}</div>
      <div className="v-studio-header-actions">{actions}</div>
    </header>
  );
}
