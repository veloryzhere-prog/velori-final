import { Check, Download, Palette, Type } from "lucide-react";
import { useState } from "react";
import "@/styles/tokens.css";
import "./BrandTab.css";

export interface BrandKitColor {
  name: string;
  hex: string;
}

export interface BrandKitFont {
  name: string;
}

export interface StudioBrandKit {
  colors: BrandKitColor[];
  fonts: BrandKitFont[];
  logoUrl?: string | null;
  logoName?: string;
}

export interface BrandTabProps {
  brandKit: StudioBrandKit;
  onApplyBrand: (brandKit: StudioBrandKit) => void;
}

export default function BrandTab({ brandKit, onApplyBrand }: BrandTabProps) {
  const [toast, setToast] = useState("");
  const [copyError, setCopyError] = useState("");

  const copyColor = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopyError("");
      setToast(`Copied ${hex}`);
      window.setTimeout(() => setToast(""), 1800);
    } catch {
      setToast("");
      setCopyError("Clipboard access is unavailable. Copy the hex value manually.");
    }
  };

  return (
    <section className="studio-brand-tab" aria-label="Brand kit">
      <section className="studio-brand-section" aria-labelledby="studio-brand-colors-title">
        <h2 id="studio-brand-colors-title">
          <Palette size={16} aria-hidden="true" /> Colors
        </h2>
        {brandKit.colors.length ? (
          <div className="studio-brand-colors">
            {brandKit.colors.slice(0, 5).map(({ name, hex }) => (
              <button
                key={`${name}-${hex}`}
                type="button"
                className="studio-brand-color"
                style={{ backgroundColor: hex }}
                aria-label={`Copy ${name} color ${hex}`}
                title={`${name}: ${hex}`}
                onClick={() => void copyColor(hex)}
              >
                <span className="studio-brand-color-label">{name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="studio-brand-empty">No brand colors added</p>
        )}
        {toast && (
          <p className="studio-brand-toast" role="status">
            <Check size={14} /> {toast}
          </p>
        )}
        {copyError && (
          <p className="studio-brand-error" role="alert">
            {copyError}
          </p>
        )}
      </section>

      <section className="studio-brand-section" aria-labelledby="studio-brand-fonts-title">
        <h2 id="studio-brand-fonts-title">
          <Type size={16} aria-hidden="true" /> Fonts
        </h2>
        {brandKit.fonts.length ? (
          <div className="studio-brand-fonts">
            {brandKit.fonts.slice(0, 2).map(({ name }) => (
              <div className="studio-brand-font" key={name}>
                <span>{name}</span>
                <span className="studio-brand-font-sample" style={{ fontFamily: name }}>
                  Aa
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="studio-brand-empty">No brand fonts added</p>
        )}
      </section>

      <section className="studio-brand-section" aria-labelledby="studio-brand-logo-title">
        <h2 id="studio-brand-logo-title">Logo</h2>
        {brandKit.logoUrl ? (
          <a
            className="studio-brand-logo-link"
            href={brandKit.logoUrl}
            download={brandKit.logoName || undefined}
            target="_blank"
            rel="noreferrer"
            aria-label="Download brand logo"
          >
            <img src={brandKit.logoUrl} alt="Brand logo" />
            <span>{brandKit.logoName || "Download logo"}</span>
            <Download size={16} aria-hidden="true" />
          </a>
        ) : (
          <p className="studio-brand-empty">No brand logo added</p>
        )}
      </section>

      <button className="studio-brand-apply" type="button" onClick={() => onApplyBrand(brandKit)}>
        Apply Brand to All
      </button>
    </section>
  );
}
