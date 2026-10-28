import { ConsoleScreen } from "../frame";
import { CreatorManager } from "../../../components/creator-manager/CreatorManager";
import type { CreatorSection } from "../../../components/creator-manager/CreatorManager.types";

function Screen({ initialSection = "overview" }: { initialSection?: CreatorSection }) {
  return (
    <ConsoleScreen anyOf={["motion.read"]}>
      <CreatorManager initialSection={initialSection} />
    </ConsoleScreen>
  );
}

export function CreatorManagerScreen() {
  return <Screen />;
}
export function CreatorManagerMusicScreen() {
  return <Screen initialSection="music" />;
}
export function CreatorManagerStickerScreen() {
  return <Screen initialSection="stickers" />;
}
