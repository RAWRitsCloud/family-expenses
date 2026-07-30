import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { getExpenses } from "../../api/expensesApi";

export default function JsonEditor() {
  const location = useLocation();
  const payload = location.state?.payload;
  const [jsonText, setJsonText] = useState("{}");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (payload) {
      setJsonText(JSON.stringify(payload, null, 2));
      return;
    }
    async function loadPayload() {
      try {
        const data = await getExpenses();
        setJsonText(JSON.stringify(data, null, 2));
      } catch {
        setJsonText("{}");
      }
    }
    loadPayload();
  }, [payload]);

  const handleChange = (e) => {
    const value = e.target.value;
    setJsonText(value);
    try {
      JSON.parse(value);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
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