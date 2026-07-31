import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Heart, Users } from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const generateId = (name) =>
  name.toLowerCase().trim().replace(/\s+/g, "_") || `item_${Date.now()}`;

const generateInitial = (name) =>
  (name.trim().charAt(0) || "?").toUpperCase();

export default function Family() {
  useDocumentTitle("Family");
  // Shared editor state lives in EditorShell so edits are included when saving.
  const { payload: rawData, setPayload: setRawData } = useOutletContext();

  const family = rawData?.family || { children: [], payers: [] };

  // Display alphabetically while keeping each person's original index so edit and
  // delete still target the right item in the underlying data.
  const orderedChildren = (family.children || [])
    .map((child, index) => ({ child, index }))
    .sort((a, b) => (a.child.name || "").localeCompare(b.child.name || ""));
  const orderedPayers = (family.payers || [])
    .map((payer, index) => ({ payer, index }))
    .sort((a, b) => (a.payer.name || "").localeCompare(b.payer.name || ""));

  const updateChildName = (index, newName) => {
    const updatedChildren = [...family.children];
    const current = updatedChildren[index];
    updatedChildren[index] = {
      ...current,
      name: newName,
      id: generateId(newName),
      initial: current.initial || generateInitial(newName),
    };
    setRawData({
      ...rawData,
      family: { ...family, children: updatedChildren },
    });
  };

  const updateChildInitial = (index, newInitial) => {
    const updatedChildren = [...family.children];
    updatedChildren[index] = { ...updatedChildren[index], initial: newInitial };
    setRawData({
      ...rawData,
      family: { ...family, children: updatedChildren },
    });
  };

  const updateChildColor = (index, color) => {
    const updatedChildren = [...family.children];
    updatedChildren[index] = { ...updatedChildren[index], color };
    setRawData({
      ...rawData,
      family: { ...family, children: updatedChildren },
    });
  };

  const handleAddChild = () => {
    const defaultName = "New Child";
    const newChild = {
      id: generateId(defaultName),
      name: defaultName,
      initial: generateInitial(defaultName),
      color: "#2563eb",
    };
    setRawData({
      ...rawData,
      family: { ...family, children: [...family.children, newChild] },
    });
  };

  const handleDeleteChild = (index) => {
    const updated = family.children.filter((_, i) => i !== index);
    setRawData({
      ...rawData,
      family: { ...family, children: updated },
    });
  };

  const updatePayerName = (index, newName) => {
    const updatedPayers = [...family.payers];
    const current = updatedPayers[index];
    updatedPayers[index] = {
      ...current,
      name: newName,
      id: generateId(newName),
      initial: current.initial || generateInitial(newName),
    };
    setRawData({
      ...rawData,
      family: { ...family, payers: updatedPayers },
    });
  };

  const updatePayerInitial = (index, newInitial) => {
    const updatedPayers = [...family.payers];
    updatedPayers[index] = { ...updatedPayers[index], initial: newInitial };
    setRawData({
      ...rawData,
      family: { ...family, payers: updatedPayers },
    });
  };

  const updatePayerColor = (index, color) => {
    const updatedPayers = [...family.payers];
    updatedPayers[index] = { ...updatedPayers[index], color };
    setRawData({
      ...rawData,
      family: { ...family, payers: updatedPayers },
    });
  };

  const handleAddPayer = () => {
    const defaultName = "New Payer";
    const newPayer = {
      id: generateId(defaultName),
      name: defaultName,
      initial: generateInitial(defaultName),
      color: "#10b981",
    };
    setRawData({
      ...rawData,
      family: { ...family, payers: [...family.payers, newPayer] },
    });
  };

  const handleDeletePayer = (index) => {
    const updated = family.payers.filter((_, i) => i !== index);
    setRawData({
      ...rawData,
      family: { ...family, payers: updated },
    });
  };

  return (
    <div className="container-fluid px-0 w-100" style={{ maxWidth: "100%", width: "100%" }}>
      {/* Top Header Row */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <span>Family Hub</span>
            <Heart size={20} className="text-danger fill-danger" />
          </h1>
          <p className="text-muted small mb-0">Manage household members, kids, and contributors.</p>
        </div>
      </div>

      <div className="row g-4">
        {/* Children Section */}
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm p-4 rounded-4 bg-white h-100">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="p-2 bg-primary bg-opacity-10 text-primary rounded-3">👶</span>
                <h2 className="h6 fw-bold mb-0 text-dark">Children</h2>
              </div>
              <button
                type="button"
                className="btn btn-dark btn-sm d-flex align-items-center justify-content-center gap-1 px-3 py-2 fw-semibold rounded-3 shadow-sm"
                onClick={handleAddChild}
              >
                <Plus size={16} />
                <span>Add child</span>
              </button>
            </div>

            <p className="text-muted small mb-3" style={{ fontSize: "0.75rem" }}>Configure household dependents linked to specific expenses.</p>

            <div className="d-flex flex-column gap-3">
              {orderedChildren.map(({ child, index }) => (
                <div key={child.id || index} className="p-3 rounded-4 border bg-light shadow-sm">
                  <div className="row g-2 align-items-center">
                    <div className="col-auto">
                      <input
                        type="color"
                        className="form-control form-control-color form-control-sm cursor-pointer bg-white border"
                        value={child.color || "#2563eb"}
                        onChange={(e) => updateChildColor(index, e.target.value)}
                        title="Choose badge color"
                      />
                    </div>
                    <div className="col-auto">
                      <input
                        type="text"
                        maxLength={2}
                        className="form-control form-control-sm text-center fw-bold bg-white"
                        style={{ width: "45px" }}
                        value={child.initial || generateInitial(child.name || "")}
                        onChange={(e) => updateChildInitial(index, e.target.value)}
                        title="Edit initial"
                      />
                    </div>
                    <div className="col">
                      <input
                        type="text"
                        className="form-control form-control-sm fw-semibold bg-white"
                        placeholder="Child Name"
                        value={child.name || ""}
                        onChange={(e) => updateChildName(index, e.target.value)}
                      />
                    </div>
                    <div className="col-auto">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm p-2 rounded-3"
                        onClick={() => handleDeleteChild(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payers / Contributors Section */}
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm p-4 rounded-4 bg-white h-100">
            <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="p-2 bg-success bg-opacity-10 text-success rounded-3">
                  <Users size={16} />
                </span>
                <h2 className="h6 fw-bold mb-0 text-dark">Payers / Contributors</h2>
              </div>
              <button
                type="button"
                className="btn btn-dark btn-sm d-flex align-items-center justify-content-center gap-1 px-3 py-2 fw-semibold rounded-3 shadow-sm"
                onClick={handleAddPayer}
              >
                <Plus size={16} />
                <span>Add Payer</span>
              </button>
            </div>

            <p className="text-muted small mb-3" style={{ fontSize: "0.75rem" }}>Manage individuals responsible for covering household costs.</p>

            <div className="d-flex flex-column gap-3">
              {orderedPayers.map(({ payer, index }) => (
                <div key={payer.id || index} className="p-3 rounded-4 border bg-light shadow-sm">
                  <div className="row g-2 align-items-center">
                    <div className="col-auto">
                      <input
                        type="color"
                        className="form-control form-control-color form-control-sm cursor-pointer bg-white border"
                        value={payer.color || "#10b981"}
                        onChange={(e) => updatePayerColor(index, e.target.value)}
                        title="Choose badge color"
                      />
                    </div>
                    <div className="col-auto">
                      <input
                        type="text"
                        maxLength={2}
                        className="form-control form-control-sm text-center fw-bold bg-white"
                        style={{ width: "45px" }}
                        value={payer.initial || generateInitial(payer.name || "")}
                        onChange={(e) => updatePayerInitial(index, e.target.value)}
                        title="Edit initial"
                      />
                    </div>
                    <div className="col">
                      <input
                        type="text"
                        className="form-control form-control-sm fw-semibold bg-white"
                        placeholder="Payer Name"
                        value={payer.name || ""}
                        onChange={(e) => updatePayerName(index, e.target.value)}
                      />
                    </div>
                    <div className="col-auto">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm p-2 rounded-3"
                        onClick={() => handleDeletePayer(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}