/** Branded loading state. Never delays the operation being represented. */
export function VeloriLoop() {
  return (
    <span className="velori-loading-loop" aria-hidden="true">
      <span className="velori-loading-orbit">
        <i />
        <i />
        <i />
      </span>
      <b>v</b>
      <span className="velori-loading-dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
