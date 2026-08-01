import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2, Search, ChevronRight, ArrowLeft, SlidersHorizontal, Calculator } from "lucide-react";
import { getCategoryData, getFamilyData, isExpenseActive } from "../../api/expensesApi";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import EmojiField from "../../components/EmojiField";

export default function Expenses() {
  useDocumentTitle("Expenses");
  // Shared editor state lives in EditorShell so the "Save to GitHub" button
  // persists the edits made here.
  const { payload: rawData, setPayload: setRawData } = useOutletContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("list");

  // Calculator state for Advanced single payment spreading over X months
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcAmount, setCalcAmount] = useState("");
  const [calcMonths, setCalcMonths] = useState(1);

  const categories = useMemo(() => getCategoryData(rawData || {}), [rawData]);
  const family = useMemo(() => getFamilyData(rawData || {}), [rawData]);
  const expenses = rawData?.expenses || [];

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.name?.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [expenses, searchTerm]);

  // Active expenses are shown first; expired ones (past their expected end
  // date) are grouped below and shaded, but stay editable/deletable here —
  // only the dashboard hides them entirely.
  const activeFilteredExpenses = useMemo(
    () => filteredExpenses.filter((e) => isExpenseActive(e)),
    [filteredExpenses]
  );
  const expiredFilteredExpenses = useMemo(
    () => filteredExpenses.filter((e) => !isExpenseActive(e)),
    [filteredExpenses]
  );

  useEffect(() => {
    if (expenses.length > 0 && selectedIndex === null) {
      setSelectedIndex(0);
    }
  }, [expenses, selectedIndex]);

  const activeExpense = selectedIndex !== null && expenses[selectedIndex] ? expenses[selectedIndex] : expenses[0];

  // How much of the monthly cost is still unassigned across contributors —
  // surfaced next to the total so it's obvious the split doesn't add up yet.
  const totalPaid = Object.values(activeExpense?.paidBy || {}).reduce(
    (sum, amount) => sum + Number(amount || 0),
    0
  );
  const remainingToSplit = Number(activeExpense?.monthlyCost || 0) - totalPaid;

  const handleSelectExpense = (index) => {
    setSelectedIndex(index);
    setActiveView("edit");
    setShowCalculator(false);
  };

  const handleBackToList = () => {
    setActiveView("list");
  };

  const updateActiveExpense = (field, value) => {
    if (selectedIndex === null || !activeExpense) return;
    const updatedExpenses = [...expenses];
    updatedExpenses[selectedIndex] = {
      ...updatedExpenses[selectedIndex],
      [field]: value,
    };
    setRawData({ ...rawData, expenses: updatedExpenses });
  };

  const updatePayerAmount = (payerId, amount) => {
    if (selectedIndex === null || !activeExpense) return;
    const currentPaidBy = { ...(activeExpense.paidBy || {}) };
    currentPaidBy[payerId] = parseFloat(amount) || 0;
    updateActiveExpense("paidBy", currentPaidBy);
  };

  const toggleChild = (childId) => {
    if (selectedIndex === null || !activeExpense) return;
    const currentChildren = activeExpense.children || [];
    const exists = currentChildren.includes(childId);
    const updated = exists
      ? currentChildren.filter((id) => id !== childId)
      : [...currentChildren, childId];
    updateActiveExpense("children", updated);
  };

  const handleSplitEvenly = () => {
    if (selectedIndex === null || !activeExpense || !family.payers.length) return;
    const total = parseFloat(activeExpense.monthlyCost) || 0;
    const perPerson = Number((total / family.payers.length).toFixed(2));
    const newPaidBy = {};
    family.payers.forEach((p) => {
      newPaidBy[p.id] = perPerson;
    });
    updateActiveExpense("paidBy", newPaidBy);
  };

  const handlePayerPaysAll = (payerId) => {
    if (selectedIndex === null || !activeExpense) return;
    const total = parseFloat(activeExpense.monthlyCost) || 0;
    const newPaidBy = {};
    family.payers.forEach((p) => {
      newPaidBy[p.id] = p.id === payerId ? total : 0;
    });
    updateActiveExpense("paidBy", newPaidBy);
  };

  const handleAddExpense = () => {
    const newExpense = {
      name: "New Expense",
      emoji: "💳",
      children: [],
      category: categories[0]?.name || "Other",
      monthlyCost: 0,
      paidBy: {},
      entries: [],
    };
    const updated = [...expenses, newExpense];
    setRawData({ ...rawData, expenses: updated });
    setSelectedIndex(updated.length - 1);
    setActiveView("edit");
    setShowCalculator(false);
  };

  const handleDeleteExpense = () => {
    if (selectedIndex === null || !activeExpense) return;
    const updated = expenses.filter((_, idx) => idx !== selectedIndex);
    setRawData({ ...rawData, expenses: updated });
    
    if (updated.length > 0) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else {
      setSelectedIndex(null);
    }
    setActiveView("list");
  };

  // Calculator logic for spreading one-off costs
  const calculatedMonthlySplit = useMemo(() => {
    const amt = parseFloat(calcAmount) || 0;
    const m = parseInt(calcMonths, 10) || 1;
    if (m <= 0) return 0;
    return Number((amt / m).toFixed(2));
  }, [calcAmount, calcMonths]);

  // Applies the calculated split as the ongoing monthly cost, and logs the
  // actual lump sum paid as a payment entry so there's a record of it.
  const handleApplyCalculatedCost = () => {
    if (selectedIndex === null || !activeExpense) return;
    const oneOffAmount = parseFloat(calcAmount) || 0;
    const months = parseInt(calcMonths, 10) || 1;
    const currentEntries = Array.isArray(activeExpense.entries) ? activeExpense.entries : [];
    const updatedExpenses = [...expenses];
    updatedExpenses[selectedIndex] = {
      ...updatedExpenses[selectedIndex],
      monthlyCost: calculatedMonthlySplit,
      entries: [
        ...currentEntries,
        {
          date: new Date().toISOString().slice(0, 10),
          description: `One-off payment (spread over ${months} month${months === 1 ? "" : "s"})`,
          amount: oneOffAmount,
        },
      ],
    };
    setRawData({ ...rawData, expenses: updatedExpenses });
    setCalcAmount("");
    setCalcMonths(1);
    setShowCalculator(false);
  };

  const renderExpenseCard = (exp, { expired = false } = {}) => {
    const originalIndex = expenses.indexOf(exp);
    // Only show as "selected" once actually open in the edit pane — on mobile
    // the list is its own full-screen view, and highlighting index 0 there
    // by default made it look picked before the user had tapped anything.
    const isSelected = activeView === "edit" && originalIndex === selectedIndex;

    const assignedChildrenNames = (exp.children || [])
      .map((childId) => family.children.find((c) => c.id === childId)?.name)
      .filter(Boolean);

    return (
      <div
        key={`${exp.name}-${originalIndex}`}
        onClick={() => handleSelectExpense(originalIndex)}
        className={`card p-3 border rounded-3 transition-all ${
          isSelected
            ? "border-primary bg-primary bg-opacity-10 shadow-sm"
            : "border-light bg-light"
        }`}
        style={{ cursor: "pointer", opacity: expired && !isSelected ? 0.6 : 1 }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <span className="fs-3 bg-white p-2 rounded-3 border shadow-sm">{exp.emoji || "📦"}</span>
            <div>
              <strong className="d-block text-dark small fw-bold">{exp.name}</strong>
              <div className="d-flex flex-wrap gap-1 mt-1">
                {assignedChildrenNames.map((name, i) => (
                  <span key={i} className="badge bg-white text-secondary border fw-normal" style={{ fontSize: "0.65rem" }}>
                    {name}
                  </span>
                ))}
                <span className="badge bg-white text-success border fw-normal" style={{ fontSize: "0.65rem" }}>
                  {exp.category}
                </span>
                {expired && (
                  <span className="badge bg-white text-muted border fw-normal" style={{ fontSize: "0.65rem" }}>
                    Ended {exp.endDate}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="text-end">
              <strong className="d-block text-dark small">£{Number(exp.monthlyCost || 0).toFixed(2)}</strong>
              <small className="text-muted" style={{ fontSize: "0.65rem" }}>/ month</small>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid p-0">
      {/* Top Header Row */}
      <div className="d-flex align-items-center justify-content-between mb-3 mb-md-4">
        <div>
          <h1 className="h3 fw-bold mb-1 text-dark">Expenses</h1>
          <p className="text-muted small mb-0">Add, edit and manage your monthly costs.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-dark btn-sm d-flex align-items-center gap-1 px-3 py-2 fw-semibold rounded-3 shadow-sm"
            onClick={handleAddExpense}
          >
            <Plus size={16} />
            <span>Add expense</span>
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Expenses List View */}
        <div
          className={`col-12 col-xl-5 ${
            activeView === "edit" ? "d-none d-xl-block" : "d-block"
          }`}
        >
          <div className="card border-0 shadow-sm p-3 rounded-4 bg-white">
            <div className="d-flex align-items-center gap-2 mb-3">
              <div className="input-group input-group-sm bg-light rounded-3 border px-2 py-1 align-items-center">
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="form-control form-control-sm border-0 bg-transparent shadow-none p-0"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-light bg-light border btn-sm p-2 rounded-3 text-muted">
                <SlidersHorizontal size={14} />
              </button>
            </div>

            <div className="d-flex flex-column gap-2 pe-1">
              {activeFilteredExpenses.map((exp) => renderExpenseCard(exp))}

              {expiredFilteredExpenses.length > 0 && (
                <>
                  <div className="d-flex align-items-center gap-2 mt-2 mb-1 px-1">
                    <span
                      className="text-uppercase text-muted fw-bold"
                      style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}
                    >
                      Ended
                    </span>
                    <div className="flex-grow-1 border-top" />
                  </div>
                  {expiredFilteredExpenses.map((exp) => renderExpenseCard(exp, { expired: true }))}
                </>
              )}
            </div>
            <div className="small text-muted pt-3 px-1">{expenses.length} expenses</div>
          </div>
        </div>

        {/* Right Column: Edit Expense Details View */}
        <div
          className={`col-12 col-xl-7 ${
            activeView === "list" ? "d-none d-xl-block" : "d-block"
          }`}
        >
          <div className="d-xl-none mb-3">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 fw-semibold px-3 py-2 rounded-3"
              onClick={handleBackToList}
            >
              <ArrowLeft size={16} />
              <span>Back to Expenses</span>
            </button>
          </div>

          {activeExpense ? (
            <div className="card border-0 shadow-sm p-4 rounded-4 bg-white">
              <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between pb-3 border-bottom mb-4 gap-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="fs-1 bg-light p-2 rounded-3 border">{activeExpense.emoji || "📦"}</span>
                  <div>
                    <h4 className="fw-bold mb-1 text-dark">{activeExpense.name}</h4>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 fw-semibold px-2 py-1">
                        £{Number(activeExpense.monthlyCost || 0).toFixed(2)} / month
                      </span>
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 fw-semibold px-2 py-1">
                        {activeExpense.category}
                      </span>
                      {(activeExpense.children || []).map((childId) => {
                        const childObj = family.children.find(c => c.id === childId);
                        return childObj ? (
                          <span key={childId} className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 fw-semibold px-2 py-1">
                            {childObj.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm d-flex align-items-center justify-content-center gap-1 px-3 py-2 fw-semibold rounded-3 w-auto"
                  onClick={handleDeleteExpense}
                >
                  <Trash2 size={14} />
                  <span>Delete expense</span>
                </button>
              </div>

              <form className="d-flex flex-column gap-4" onSubmit={(e) => e.preventDefault()}>
                {/* General Info Section */}
                <div className="bg-light p-3 rounded-4 border">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="text-secondary">📋</span>
                    <h6 className="fw-bold small text-dark mb-0">General</h6>
                  </div>
                  <p className="text-muted small mb-3" style={{ fontSize: "0.75rem" }}>Basic information about this expense.</p>
                  
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold text-muted">Expense name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-white"
                        value={activeExpense.name || ""}
                        onChange={(e) => updateActiveExpense("name", e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-muted">Category</label>
                      <select
                        className="form-select form-select-sm bg-white"
                        value={activeExpense.category || ""}
                        onChange={(e) => updateActiveExpense("category", e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>{c.emoji || "📌"} {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-2">
                      <label className="form-label small fw-semibold text-muted d-block">Icon</label>
                      <EmojiField
                        value={activeExpense.emoji || "📦"}
                        onSelect={(emoji) => updateActiveExpense("emoji", emoji)}
                        size={38}
                        ariaLabel="Choose expense icon"
                      />
                    </div>
                  </div>
                </div>

                {/* Who is this for? */}
                <div className="bg-light p-3 rounded-4 border">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="text-secondary">👤</span>
                    <h6 className="fw-bold small text-dark mb-0">Who is this for?</h6>
                  </div>
                  <p className="text-muted small mb-3" style={{ fontSize: "0.75rem" }}>Select the children this expense is for.</p>

                  <div className="d-flex flex-wrap gap-2">
                    {family.children.map((child) => {
                      const isChecked = activeExpense.children?.includes(child.id);
                      const cColor = child.color || "#2563eb";
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => toggleChild(child.id)}
                          aria-pressed={!!isChecked}
                          className="btn fw-semibold px-3 py-2"
                          style={{
                            backgroundColor: isChecked ? cColor : "transparent",
                            borderColor: cColor,
                            borderWidth: "2px",
                            color: isChecked ? "#fff" : cColor,
                          }}
                        >
                          {child.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly Cost */}
                <div className="bg-light p-3 rounded-4 border">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="text-secondary">💷</span>
                    <h6 className="fw-bold small text-dark mb-0">Monthly cost</h6>
                  </div>
                  <p className="text-muted small mb-2" style={{ fontSize: "0.75rem" }}>How much does this cost each month?</p>
                  
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white">£</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control bg-white"
                      value={activeExpense.monthlyCost || 0}
                      onChange={(e) => updateActiveExpense("monthlyCost", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Expected End Date */}
                <div className="bg-light p-3 rounded-4 border">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="text-secondary">🗓️</span>
                    <h6 className="fw-bold small text-dark mb-0">Expected end date</h6>
                  </div>
                  <p className="text-muted small mb-2" style={{ fontSize: "0.75rem" }}>
                    Optional. Once this date passes, the expense is hidden from the dashboard automatically.
                  </p>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="date"
                      className="form-control form-control-sm bg-white"
                      style={{ maxWidth: "220px" }}
                      value={activeExpense.endDate || ""}
                      onChange={(e) => updateActiveExpense("endDate", e.target.value || undefined)}
                    />
                    {activeExpense.endDate && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => updateActiveExpense("endDate", undefined)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Contributors Breakdown */}
                <div className="bg-light p-3 rounded-4 border">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-secondary">👥</span>
                      <h6 className="fw-bold small text-dark mb-0">Contributors</h6>
                    </div>
                    <small className="fw-bold text-muted text-end" style={{ fontSize: "0.75rem" }}>
                      Total: £{Number(activeExpense.monthlyCost || 0).toFixed(2)}/month
                      {Math.abs(remainingToSplit) > 0.004 && (
                        <span className={remainingToSplit > 0 ? "text-warning" : "text-danger"}>
                          {" "}
                          ({remainingToSplit > 0
                            ? `£${remainingToSplit.toFixed(2)} remaining`
                            : `£${Math.abs(remainingToSplit).toFixed(2)} over`})
                        </span>
                      )}
                    </small>
                  </div>
                  <p className="text-muted small mb-3" style={{ fontSize: "0.75rem" }}>How is this paid between you?</p>

                  <div className="row g-2 mb-3">
                    {family.payers.map((payer) => {
                      const amountPaid = activeExpense.paidBy?.[payer.id] || 0;
                      const percentage = activeExpense.monthlyCost > 0 
                        ? Math.round((amountPaid / activeExpense.monthlyCost) * 100) 
                        : 0;

                      return (
                        <div key={payer.id} className="col-12 col-sm-6 col-md-3">
                          <div className="p-2 border rounded-3 bg-white shadow-sm">
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <span
                                className="badge rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                                style={{ width: "22px", height: "22px", backgroundColor: payer.color || "#2563eb", fontSize: "0.7rem" }}
                              >
                                {payer.initial || payer.name?.[0]}
                              </span>
                              <span className="small fw-bold text-dark">{payer.name}</span>
                            </div>
                            <div className="input-group input-group-sm mb-2">
                              <span className="input-group-text bg-light px-2">£</span>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control px-2"
                                value={amountPaid}
                                onChange={(e) => updatePayerAmount(payer.id, e.target.value)}
                              />
                            </div>
                            <div className="d-flex align-items-center justify-content-between">
                              <div className="progress flex-grow-1 me-2 bg-light" style={{ height: "4px" }}>
                                <div 
                                  className="progress-bar rounded" 
                                  style={{ width: `${percentage}%`, backgroundColor: payer.color || "#2563eb" }} 
                                />
                              </div>
                              <small className="text-muted fw-semibold" style={{ fontSize: "0.65rem" }}>{percentage}%</small>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Payer action buttons: a consistent-size button group. Every
                      button is forced to a single line (with ellipsis as a
                      fallback for long names) so they're always the same
                      height, whichever row they wrap to on mobile. */}
                  <div className="row g-2">
                    <div className="col-6 col-lg">
                      <button
                        type="button"
                        className="btn btn-outline-secondary bg-white fw-semibold w-100 py-2 text-truncate"
                        onClick={handleSplitEvenly}
                      >
                        Split evenly
                      </button>
                    </div>
                    {family.payers.map((p) => {
                      const pColor = p.color || "#2563eb";
                      return (
                        <div key={p.id} className="col-6 col-lg">
                          <button
                            type="button"
                            className="btn text-white fw-semibold w-100 py-2 text-truncate"
                            style={{ backgroundColor: pColor, borderColor: pColor }}
                            onClick={() => handlePayerPaysAll(p.id)}
                          >
                            {p.name} pays all
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Single Payment Calculator Section */}
                <div className="bg-light p-3 rounded-4 border">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <Calculator size={16} className="text-secondary" />
                      <div>
                        <h6 className="fw-bold small text-dark mb-0">One-off payment</h6>
                        <p className="text-muted mb-0" style={{ fontSize: "0.75rem" }}>
                          Spread a single payment across months, and log it as paid.
                        </p>
                      </div>
                    </div>
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input cursor-pointer"
                        type="checkbox"
                        checked={showCalculator}
                        onChange={(e) => setShowCalculator(e.target.checked)}
                      />
                    </div>
                  </div>

                  {showCalculator && (
                    <div className="card bg-white border p-3 mt-3 rounded-3 shadow-sm">
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-sm-6">
                          <label className="form-label small text-muted mb-1">Total Single Payment Amount</label>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">£</span>
                            <input
                              type="number"
                              step="0.01"
                              className="form-control"
                              placeholder="e.g. 1200"
                              value={calcAmount}
                              onChange={(e) => setCalcAmount(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label small text-muted mb-1">Number of Months</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm"
                            value={calcMonths}
                            onChange={(e) => setCalcMonths(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="d-flex align-items-center justify-content-between mt-3 pt-2 border-top">
                        <div className="small text-muted">
                          Resulting Monthly Cost: <strong className="text-primary">£{calculatedMonthlySplit}</strong>/mo
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm px-3 fw-semibold"
                          disabled={!(parseFloat(calcAmount) > 0)}
                          onClick={handleApplyCalculatedCost}
                        >
                          Apply &amp; log payment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <div className="card border-0 shadow-sm p-4 text-center text-muted rounded-4 bg-white">
              Select an expense from the list to view or edit details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}