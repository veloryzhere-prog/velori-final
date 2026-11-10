import { ArrowLeft, Search, MessageCircle, Plus } from "lucide-react";
interface Props {
  onBack?: () => void;
  onSearch?: () => void;
  onDM?: () => void;
  onCreate?: () => void;
  visible: boolean;
}
export function ReelsHeader(p: Props) {
  return (
    <header className="rv-header">
      <div>
        <button className="rv-icon-button" onClick={p.onBack} aria-label="Back">
          <ArrowLeft size={21} />
        </button>
        <span className="rv-wordmark">
          velori<span>✳</span>
        </span>
        <span className="rv-header-label">REELS</span>
      </div>
      <span className="rv-header-center">
        <i />A LITTLE MORE ALIVE
      </span>
      <nav aria-label="Reels tools">
        {p.onSearch && (
          <button className="rv-icon-button" onClick={p.onSearch} aria-label="Search">
            <Search size={20} />
          </button>
        )}
        {p.onDM && (
          <button className="rv-icon-button" onClick={p.onDM} aria-label="Messages">
            <MessageCircle size={20} />
          </button>
        )}
        {p.onCreate && (
          <button className="rv-create-button" onClick={p.onCreate}>
            <Plus size={17} />
            <span>Create reel</span>
          </button>
        )}
      </nav>
    </header>
  );
}
