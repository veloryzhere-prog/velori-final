import { normalizeMotionPreference } from "./preferences.mjs";
import { useInterfaceMotion } from "./InterfaceMotion";

export function MotionControl() {
  const { preference, setPreference } = useInterfaceMotion();

  return (
    <footer className="motion-preference-footer">
      <label htmlFor="motion">
        Motion
        <select
          id="motion"
          aria-label="Motion preference"
          value={preference}
          onChange={(event) => setPreference(normalizeMotionPreference(event.currentTarget.value))}
        >
          <option value="auto">Device</option>
          <option value="full">Full</option>
          <option value="gentle">Gentle</option>
          <option value="off">Off</option>
        </select>
      </label>
    </footer>
  );
}
