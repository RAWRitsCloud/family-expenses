import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export default function Categories() {
  useDocumentTitle("Categories");
  // Shared editor state lives in EditorShell so edits are included when saving.
  const { payload: rawData, setPayload: setRawData } = useOutletContext();

  const categories = rawData?.categories || [];
  const expenses = rawData?.expenses || [];

  // Display alphabetically while keeping each category's original index so edit
  // and delete still target the right item in the underlying data.
  const orderedCategories = categories
    .map((category, index) => ({ category, index }))
    .sort((a, b) => (a.category.name || "").localeCompare(b.category.name || ""));

  const categoryStats = useMemo(() => {
    const stats = {};
    categories.forEach((cat) => {
      stats[cat.name] = { count: 0, total: 0 };
    });

    expenses.forEach((exp) => {
      if (stats[exp.category]) {
        stats[exp.category].count += 1;
        stats[exp.category].total += Number(exp.monthlyCost || 0);
      }
    });

    return stats;
  }, [categories, expenses]);

  const updateCategory = (index, field, value) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], [field]: value };
    setRawData({ ...rawData, categories: updated });
  };

  const handleAddCategory = () => {
    const newCategory = {
      name: `Category ${categories.length + 1}`,
      emoji: "📁",
      color: "#2563eb",
    };
    setRawData({ ...rawData, categories: [...categories, newCategory] });
  };

  const handleDeleteCategory = (index) => {
    const updated = categories.filter((_, i) => i !== index);
    setRawData({ ...rawData, categories: updated });
  };

  return (
    <div className="container-fluid p-0">
      {/* Top Header Row */}
      <div className="d-flex align-items-center justify-content-between mb-3 mb-md-4">
        <div>
          <h1 className="h3 fw-bold mb-1 text-dark">Categories</h1>
          <p className="text-muted small mb-0">Organise expenses into budget groups.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-dark btn-sm d-flex align-items-center gap-1 px-3 py-2 fw-semibold rounded-3 shadow-sm"
            onClick={handleAddCategory}
          >
            <Plus size={16} />
            <span>Add category</span>
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {orderedCategories.map(({ category, index }) => {
          const stat = categoryStats[category.name] || { count: 0, total: 0 };

          return (
            <div key={index} className="col-12 col-md-6 col-xl-4">
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white h-100">
                <div className="card-body p-3 d-flex flex-column justify-content-between">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <input
                      type="text"
                      className="form-control form-control-sm text-center bg-light flex-shrink-0"
                      style={{ width: "48px" }}
                      value={category.emoji || "📌"}
                      onChange={(e) => updateCategory(index, "emoji", e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm fw-bold bg-light flex-grow-1"
                      value={category.name}
                      onChange={(e) => updateCategory(index, "name", e.target.value)}
                    />
                    <input
                      type="color"
                      className="form-control form-control-color form-control-sm cursor-pointer bg-light border flex-shrink-0"
                      value={category.color || "#2563eb"}
                      onChange={(e) => updateCategory(index, "color", e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm p-2 rounded-3 flex-shrink-0"
                      onClick={() => handleDeleteCategory(index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="d-flex align-items-center justify-content-between text-muted small pt-2 border-top">
                    <span>{stat.count} expenses</span>
                    <strong className="text-dark">£{stat.total.toFixed(2)} / month</strong>
                  </div>
                </div>

                <div style={{ height: "4px", backgroundColor: category.color || "#2563eb" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}