import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function JsonEditor() {
  // Shared editor state lives in EditorShell so JSON edits are included when saving.
  const { payload, setPayload } = useOutletContext();
  const [jsonText, setJsonText] = useState("{}");
  const [error, setError] = useState(null);
  const hydrated = useRef(false);

  // Seed the textarea from the shared payload once it's available. We guard with
  // a ref so typing (which pushes parsed JSON back into the shared payload) doesn't
  // cause the payload change to overwrite what the user is editing.
  useEffect(() => {
    if (!hydrated.current && payload) {
      setJsonText(JSON.stringify(payload, null, 2));
      hydrated.current = true;
    }
  }, [payload]);

  const handleChange = (e) => {
    const value = e.target.value;
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      setError(null);
      setPayload(parsed);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setPayload(parsed);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container-fluid p-0">
      {/* Top Header Row */}
      <div className="d-flex align-items-center justify-content-between mb-3 mb-md-4">
        <div>
          <h1 className="h3 fw-bold mb-1 text-dark">JSON Editor</h1>
          <p className="text-muted small mb-0">Direct access to underlying database structure.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-dark btn-sm d-flex align-items-center gap-1 px-3 py-2 fw-semibold rounded-3 shadow-sm"
            onClick={handleFormatJson}
          >
            <Sparkles size={16} />
            <span>Format JSON</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger p-2 small mb-3">
          <strong>Invalid JSON syntax:</strong> {error}
        </div>
      )}

      <textarea
        className="form-control font-monospace p-3 bg-white border rounded-4 shadow-sm w-100"
        value={jsonText}
        onChange={handleChange}
        style={{ fontSize: "0.85rem", tabSize: 2, height: "60vh" }}
        spellCheck={false}
      />
    </div>
  );
}