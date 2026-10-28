import { Link } from "react-router";
import { Upload, HelpCircle, ArrowUpRight } from "lucide-react";
export function ForgeHeader({
  onImport,
  onGuide,
}: {
  onImport?: () => void;
  onGuide?: () => void;
}) {
  return (
    <header className="vf-header">
      <Link className="vf-wordmark" aria-label="VELORI home" to="/home">
        velori<span>✳</span>
      </Link>
      <span className="vf-divider" />
      <Link className="vf-studio-link" to="/forge">
        Forge AI <small>BETA</small>
      </Link>
      <nav aria-label="Studio navigation">
        <Link to="/forge/pricing" aria-label="FORGE pricing">
          <span>Pricing</span>
        </Link>
        <Link to="/forge/rewards" aria-label="FORGE rewards">
          <span>Rewards</span>
        </Link>
        <Link to="/forge/account/subscription" aria-label="FORGE account billing">
          <span>Billing</span>
        </Link>
        <Link to="/forge-docs" title="Forge documentation" aria-label="Forge documentation">
          <HelpCircle size={18} />
          <span>Guide</span>
        </Link>
        {onImport && (
          <button aria-label="Import project JSON" title="Import project JSON" onClick={onImport}>
            <Upload size={17} />
            <span>Import</span>
          </button>
        )}
        {onGuide && (
          <button aria-label="Studio guide" title="Studio guide" onClick={onGuide}>
            <HelpCircle size={18} />
          </button>
        )}
        <Link className="vf-back" to="/home" aria-label="Back to the VELORI social platform">
          Back to VELORI <ArrowUpRight size={15} />
        </Link>
      </nav>
    </header>
  );
}
