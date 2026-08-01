export default function LoadingSpinner({ label = "Loading…", fullScreen = false, className = "" }) {
  return (
    <div
      className={`d-flex flex-column align-items-center justify-content-center gap-3 text-muted ${
        fullScreen ? "min-vh-100" : "py-5"
      } ${className}`}
    >
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{label}</span>
      </div>
      <span className="small fw-semibold">{label}</span>
    </div>
  );
}
