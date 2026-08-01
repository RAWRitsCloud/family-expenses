import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { PencilRuler, LogOut, ChevronDown, Receipt, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  getExpenses,
  saveExpenses,
  getFamilyDisplayNames,
  getCategoryData,
  getExpenseData,
  getActiveExpensesPayload,
  GetPayeeTotalsWithNames,
  GetChildTotalsWithNames,
} from "../api/expensesApi";
import brandIcon from "../assets/favicon.svg";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar } from "react-chartjs-2";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import LoadingSpinner from "../components/LoadingSpinner";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function safeString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return val.name || val.payee || val.label || JSON.stringify(val);
  return String(val);
}

function getIndividualPayments(expense) {
  let target = expense.paidBy || expense.payments || expense.payee;

  if (typeof target === "string" && target.trim().startsWith("{")) {
    try {
      target = JSON.parse(target);
    } catch {
      // Ignore parse failure
    }
  }

  if (typeof target === "object" && target !== null && !Array.isArray(target)) {
    return Object.entries(target)
      .map(([key, val]) => ({
        payee: safeString(key),
        amount: Number(val || 0),
      }))
      .filter((p) => p.amount > 0);
  }

  if (Array.isArray(target) && target.length > 0) {
    return target
      .map((p) => ({
        payee: safeString(p.payee || p.name || p.payer || "Unknown"),
        amount: Number(p.amount || p.cost || 0),
      }))
      .filter((p) => p.amount > 0);
  }

  if (target) {
    return [
      {
        payee: safeString(target),
        amount: Number(expense.monthlyCost || 0),
      },
    ];
  }

  return [];
}

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [showAllEntries, setShowAllEntries] = useState(() => new Set());
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState(null);
  const [sortBy, setSortBy] = useState({ key: "name", dir: "asc" });
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingDeleteTimer = useRef(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadPayload() {
      try {
        const data = await getExpenses();
        if (!ignore) setPayload(data);
      } catch {
        if (!ignore) setPayload(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadPayload();
    return () => {
      ignore = true;
    };
  }, []);

  // Expired expenses (past their expected end date) are excluded from the whole
  // dashboard — the table, totals, chart, and payer/child splits — so the
  // numbers on screen always match what's actually listed. They remain fully
  // visible/editable in the Expenses editor.
  const activePayload = useMemo(() => getActiveExpensesPayload(payload || {}), [payload]);

  const categories = useMemo(() => getCategoryData(payload || {}), [payload]);
  const expenses = useMemo(() => getExpenseData(activePayload), [activePayload]);
  const familyNames = getFamilyDisplayNames(payload || {});

  const payeeTotals = useMemo(() => {
    if (!payload) return [];
    return GetPayeeTotalsWithNames(activePayload);
  }, [payload, activePayload]);

  const childTotals = useMemo(() => {
    if (!payload) return [];
    return GetChildTotalsWithNames(activePayload);
  }, [payload, activePayload]);

  const totalMonthlyCost = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.monthlyCost || 0), 0),
    [expenses]
  );

  const totalYearlyCost = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.monthlyCost || 0) * 12, 0),
    [expenses]
  );

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      map[cat.name] = {
        color: cat.color || "#4f46e5",
        emoji: cat.emoji || "📌",
      };
    });
    return map;
  }, [categories]);

  const childLookupMap = useMemo(() => {
    const map = {};
    childTotals.forEach((child) => {
      const color = child.childColor || child.color || child.hexColor || "#2563eb";
      const displayName = safeString(child.name || child.displayName || child.childName);
      const id = safeString(child.childId || child.id || displayName);

      const entry = { name: displayName, color };

      if (id) map[id.toLowerCase().trim()] = entry;
      if (displayName) map[displayName.toLowerCase().trim()] = entry;
    });
    return map;
  }, [childTotals]);

  const payeeLookupMap = useMemo(() => {
    const map = {};
    payeeTotals.forEach((p) => {
      const color = p.payerColor || p.color || p.hexColor || "#0d6efd";
      const displayName = safeString(p.name || p.displayName || p.payerName || p.payee);
      const id = safeString(p.payerId || p.payeeId || p.id || displayName);

      const entry = { name: displayName, color };

      if (id) map[id.toLowerCase().trim()] = entry;
      if (displayName) map[displayName.toLowerCase().trim()] = entry;
    });
    return map;
  }, [payeeTotals]);

  const resolveChild = (key) => {
    const normalizedKey = safeString(key).toLowerCase().trim();
    const found = childLookupMap[normalizedKey];
    return {
      name: found?.name || safeString(key),
      color: found?.color || "#2563eb",
    };
  };

  const resolvePayee = (key) => {
    const normalizedKey = safeString(key).toLowerCase().trim();
    const found = payeeLookupMap[normalizedKey];

    let fallbackName = safeString(key);
    if (fallbackName && fallbackName === fallbackName.toLowerCase()) {
      fallbackName = fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);
    }

    return {
      name: found?.name || fallbackName,
      color: found?.color || "#0d6efd",
    };
  };

  const categoryBreakdown = useMemo(() => {
    const totals = {};
    const labels = [];

    categories.forEach((category) => {
      const name = category.name || "Uncategorised";
      totals[name] = 0;
      labels.push(name);
    });

    expenses.forEach((expense) => {
      const categoryName = expense.category || "Uncategorised";
      totals[categoryName] = (totals[categoryName] || 0) + Number(expense.monthlyCost || 0);
      if (!labels.includes(categoryName)) {
        labels.push(categoryName);
      }
    });

    return {
      labels: labels.map((name) => {
        const cat = categoryMap[name];
        return `${cat?.emoji || "📌"} ${name}`;
      }),
      datasets: [
        {
          label: "Monthly cost",
          data: labels.map((name) => totals[name] || 0),
          backgroundColor: labels.map((name) => categoryMap[name]?.color || "#4f46e5"),
          borderRadius: 6,
        },
      ],
    };
  }, [categories, expenses, categoryMap]);

  const chartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => formatCurrency(context.parsed.x),
        },
      },
      datalabels: {
        display: true,
        anchor: "end",
        align: "right",
        clamp: true,
        clip: false,
        formatter: (value) => formatCurrency(value),
        color: "#374151",
        font: { weight: "600", size: 12 },
      },
    },
    scales: {
      x: { beginAtZero: true, display: false },
      y: {
        grid: { display: false },
        ticks: { padding: 6, font: { size: 12 } },
      },
    },
    layout: {
      padding: { left: 8, right: 50, top: 4, bottom: 4 },
    },
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const childMatch =
        selectedChild === "all" ||
        (exp.children &&
          exp.children.some((c) => {
            const resolved = resolveChild(c);
            return (
              safeString(c).toLowerCase().trim() === selectedChild.toLowerCase().trim() ||
              resolved.name.toLowerCase().trim() === selectedChild.toLowerCase().trim()
            );
          }));
      const categoryMatch =
        selectedCategory === "all" || exp.category === selectedCategory;
      return childMatch && categoryMatch;
    });
  }, [expenses, selectedChild, selectedCategory, childLookupMap]);

  const handleLogout = () => {
    window.location.href = `/.auth/logout`;
  };

  // Pre-compute a view model per visible expense so the desktop table and the
  // mobile cards can share the same data (entries, category info, etc.).
  const expenseRows = useMemo(() => {
    const rawExpenses = payload?.expenses || [];
    return filteredExpenses.map((expense, idx) => {
      // Map back to the raw payload expense so entry edits mutate the real data.
      const rawIndex = rawExpenses.findIndex((e) => e.name === expense.name);
      const rawEntries =
        rawIndex >= 0 && Array.isArray(rawExpenses[rawIndex].entries)
          ? rawExpenses[rawIndex].entries
          : [];
      // Spread keeps element references intact so delete-by-reference works.
      const sortedEntries = [...rawEntries].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
      const catInfo = categoryMap[expense.category] || { emoji: "📌", color: "#6c757d" };
      return { expense, idx, rawIndex, rowKey: `${expense.name}-${idx}`, sortedEntries, catInfo };
    });
  }, [filteredExpenses, categoryMap, payload]);

  // Sorted view of the expense rows (drives both desktop table and mobile cards).
  // Default: expense name A→Z. Payment entries within each row stay date-desc.
  const sortedExpenseRows = useMemo(() => {
    const rows = [...expenseRows];
    const mult = sortBy.dir === "asc" ? 1 : -1;
    const childNames = (row) =>
      (row.expense.children || []).map((c) => resolveChild(c).name).sort().join(", ");
    rows.sort((a, b) => {
      if (sortBy.key === "monthly") {
        return (Number(a.expense.monthlyCost || 0) - Number(b.expense.monthlyCost || 0)) * mult;
      }
      let av;
      let bv;
      if (sortBy.key === "category") {
        av = a.expense.category || "";
        bv = b.expense.category || "";
      } else if (sortBy.key === "for") {
        av = childNames(a);
        bv = childNames(b);
      } else {
        av = a.expense.name || "";
        bv = b.expense.name || "";
      }
      return String(av).localeCompare(String(bv)) * mult;
    });
    return rows;
  }, [expenseRows, sortBy, childLookupMap]);

  const toggleSort = (key) =>
    setSortBy((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );

  const sortHeader = (label, key, thClass = "") => {
    const active = sortBy.key === key;
    return (
      <th
        className={thClass}
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => toggleSort(key)}
        aria-sort={active ? (sortBy.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className="d-inline-flex align-items-center gap-1">
          {label}
          <span style={{ fontSize: "0.7rem", opacity: active ? 1 : 0.35 }}>
            {active ? (sortBy.dir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </span>
      </th>
    );
  };

  const toggleRow = (key) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleShowAll = (key) =>
    setShowAllEntries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Parse "YYYY-MM-DD" locally (avoids the UTC off-by-one from new Date(str)).
  const formatEntryDate = (value) => {
    if (!value) return "—";
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return String(value);
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const today = () => new Date().toISOString().slice(0, 10);

  // Persist a mutated payload: update local state immediately, then save
  // (GitHub in live mode, sessionStorage in demo — handled by saveExpenses).
  const persistPayload = async (nextPayload) => {
    setPayload(nextPayload);
    setEntrySaving(true);
    setEntryError(null);
    try {
      const result = await saveExpenses(nextPayload);
      if (result && result.saved === false) {
        setEntryError(
          result.message ||
            "Saved locally, but not committed to GitHub (server not configured)."
        );
      }
    } catch (err) {
      setEntryError(err.message || "Could not save payment entry.");
    } finally {
      setEntrySaving(false);
    }
  };

  const mutateEntries = (rawIndex, updater) => {
    if (!payload || rawIndex < 0) return;
    const rawExpenses = payload.expenses || [];
    const target = rawExpenses[rawIndex];
    if (!target) return;
    const nextEntries = updater(Array.isArray(target.entries) ? target.entries : []);
    const nextExpenses = rawExpenses.map((e, i) =>
      i === rawIndex ? { ...e, entries: nextEntries } : e
    );
    persistPayload({ ...payload, expenses: nextExpenses });
  };

  // Inline two-step delete: first click arms ("Confirm?"), second click removes.
  // Auto-disarms after a few seconds so it never gets stuck.
  const handleDeleteClick = (rawIndex, entry) => {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    if (pendingDelete === entry) {
      setPendingDelete(null);
      mutateEntries(rawIndex, (entries) => entries.filter((e) => e !== entry));
    } else {
      setPendingDelete(entry);
      pendingDeleteTimer.current = setTimeout(() => setPendingDelete(null), 3500);
    }
  };

  // Inline add/edit: one shared form. `entry: null` means adding a new payment;
  // otherwise it's editing that specific entry. Only one add/edit is active at a time.
  const startEdit = (rowKey, rawIndex, entry) =>
    setEditing({
      rowKey,
      rawIndex,
      entry,
      date: entry.date || today(),
      description: entry.description || "",
      amount: String(entry.amount ?? ""),
    });
  const startAdd = (rowKey, rawIndex) =>
    setEditing({ rowKey, rawIndex, entry: null, date: today(), description: "", amount: "" });
  const cancelEdit = () => setEditing(null);
  const updateEditing = (field, value) => setEditing((prev) => ({ ...prev, [field]: value }));
  const editingValid = (e) =>
    Boolean(e) &&
    Boolean(e.description.trim()) &&
    Number.isFinite(Number(e.amount)) &&
    Number(e.amount) >= 0;
  const saveEdit = () => {
    if (!editingValid(editing)) return;
    const { entry, rawIndex } = editing;
    const payloadEntry = {
      date: editing.date || today(),
      description: editing.description.trim(),
      amount: Number(editing.amount),
    };
    if (entry) {
      mutateEntries(rawIndex, (entries) => entries.map((e) => (e === entry ? payloadEntry : e)));
    } else {
      mutateEntries(rawIndex, (entries) => [...entries, payloadEntry]);
    }
    setEditing(null);
  };
  const isEditing = (entry) => Boolean(editing) && editing.entry === entry;
  const isAdding = (rowKey) => Boolean(editing) && editing.entry === null && editing.rowKey === rowKey;

  // Desktop: the shared add/edit inputs rendered as a table row.
  const renderEditableRow = (key) => (
    <tr key={key} onClick={(e) => e.stopPropagation()}>
      <td>
        <input
          type="date"
          className="form-control form-control-sm"
          value={editing.date}
          onChange={(e) => updateEditing("date", e.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Description"
          value={editing.description}
          onChange={(e) => updateEditing("description", e.target.value)}
        />
      </td>
      <td>
        <div className="input-group input-group-sm">
          <span className="input-group-text">£</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            value={editing.amount}
            onChange={(e) => updateEditing("amount", e.target.value)}
          />
        </div>
      </td>
      <td className="text-end">
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-success p-1 lh-1 d-inline-flex"
            aria-label="Save payment"
            disabled={!editingValid(editing) || entrySaving}
            onClick={saveEdit}
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-light border p-1 lh-1 d-inline-flex"
            aria-label="Cancel"
            onClick={cancelEdit}
          >
            <X size={15} />
          </button>
        </div>
      </td>
    </tr>
  );

  // Mobile: the shared add/edit inputs rendered as a card.
  const renderEditableCard = (key) => (
    <div key={key} className="bg-light border rounded-3 p-2" onClick={(e) => e.stopPropagation()}>
      <div className="d-flex flex-column gap-2">
        <input
          type="date"
          className="form-control form-control-sm"
          value={editing.date}
          onChange={(e) => updateEditing("date", e.target.value)}
        />
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Description"
          value={editing.description}
          onChange={(e) => updateEditing("description", e.target.value)}
        />
        <div className="input-group input-group-sm">
          <span className="input-group-text">£</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control"
            value={editing.amount}
            onChange={(e) => updateEditing("amount", e.target.value)}
          />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1"
            aria-label="Cancel"
            onClick={cancelEdit}
          >
            <X size={15} /> Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
            aria-label="Save payment"
            disabled={!editingValid(editing) || entrySaving}
            onClick={saveEdit}
          >
            <Check size={15} /> {entrySaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderRecordButton = (rowKey, rawIndex, className = "") => (
    <button
      type="button"
      className={`btn btn-outline-primary btn-sm d-inline-flex align-items-center justify-content-center gap-1 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        startAdd(rowKey, rawIndex);
      }}
    >
      <Plus size={15} /> Record payment
    </button>
  );

  const renderEntryError = () =>
    entryError ? (
      <div className="alert alert-warning py-1 px-2 small mb-0 mt-2">{entryError}</div>
    ) : null;

  const renderViewAll = (rowKey, total) =>
    total > 3 ? (
      <button
        type="button"
        className="btn btn-link btn-sm px-0 mt-2 text-decoration-none fw-semibold"
        onClick={(e) => {
          e.stopPropagation();
          toggleShowAll(rowKey);
        }}
      >
        {showAllEntries.has(rowKey) ? "Show fewer" : `View all ${total} entries`}
      </button>
    ) : null;

  // Desktop: entries rendered as a compact table inside the expanded row.
  const renderEntriesTable = (rowKey, rawIndex, sortedEntries) => {
    const showAll = showAllEntries.has(rowKey);
    const visible = showAll ? sortedEntries : sortedEntries.slice(0, 3);
    return (
      <div className="p-3 p-lg-4">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <span
              className="d-inline-flex align-items-center justify-content-center rounded-3 bg-primary bg-opacity-10 text-primary flex-shrink-0"
              style={{ width: "34px", height: "34px" }}
            >
              <Receipt size={18} />
            </span>
            <div>
              <h6 className="fw-bold mb-0">Payment entries</h6>
              <small className="text-muted">
                A record of payments made. These do not change the estimated monthly cost.
              </small>
            </div>
          </div>
          {!isAdding(rowKey) && renderRecordButton(rowKey, rawIndex, "flex-shrink-0")}
        </div>

        {sortedEntries.length > 0 || isAdding(rowKey) ? (
          <>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 bg-white rounded-3">
                <thead>
                  <tr className="text-uppercase text-muted" style={{ fontSize: "0.7rem" }}>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="text-end">Amount</th>
                    <th style={{ width: "96px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {isAdding(rowKey) && renderEditableRow("new")}
                  {visible.map((entry, i) =>
                    isEditing(entry) ? (
                      renderEditableRow(i)
                    ) : (
                      <tr key={i}>
                        <td className="text-nowrap">{formatEntryDate(entry.date)}</td>
                        <td>{entry.description || "—"}</td>
                        <td className="text-end fw-semibold">{formatCurrency(entry.amount)}</td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end align-items-center gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-secondary p-0"
                              aria-label="Edit payment"
                              disabled={entrySaving}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(rowKey, rawIndex, entry);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            {pendingDelete === entry ? (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm py-0 px-2"
                                style={{ fontSize: "0.7rem" }}
                                aria-label="Confirm delete payment"
                                disabled={entrySaving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(rawIndex, entry);
                                }}
                              >
                                Confirm?
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                aria-label="Delete payment"
                                disabled={entrySaving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(rawIndex, entry);
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            {renderViewAll(rowKey, sortedEntries.length)}
          </>
        ) : (
          <div className="text-muted small py-2">No payments recorded yet.</div>
        )}

        {renderEntryError()}
      </div>
    );
  };

  // Mobile: entries rendered as a light stacked list inside the expanded card.
  const renderEntriesList = (rowKey, rawIndex, sortedEntries) => {
    const showAll = showAllEntries.has(rowKey);
    const visible = showAll ? sortedEntries : sortedEntries.slice(0, 3);
    return (
      <div className="d-flex flex-column gap-2">
        {isAdding(rowKey) && renderEditableCard("new")}
        {sortedEntries.length > 0
          ? (
            <>
              {visible.map((entry, i) =>
                isEditing(entry) ? (
                  renderEditableCard(i)
                ) : (
                  <div
                    key={i}
                    className="d-flex align-items-center justify-content-between gap-2 bg-light border rounded-3 p-2"
                  >
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-3 bg-primary bg-opacity-10 text-primary flex-shrink-0"
                        style={{ width: "32px", height: "32px" }}
                      >
                        <Receipt size={15} />
                      </span>
                      <div className="overflow-hidden">
                        <div className="fw-semibold small text-truncate">{formatEntryDate(entry.date)}</div>
                        <div className="text-muted text-truncate" style={{ fontSize: "0.75rem" }}>
                          {entry.description || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      <span className="fw-bold small text-nowrap">{formatCurrency(entry.amount)}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary p-0"
                        aria-label="Edit payment"
                        disabled={entrySaving}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(rowKey, rawIndex, entry);
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      {pendingDelete === entry ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm py-0 px-2"
                          style={{ fontSize: "0.7rem" }}
                          aria-label="Confirm delete payment"
                          disabled={entrySaving}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(rawIndex, entry);
                          }}
                        >
                          Confirm?
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0"
                          aria-label="Delete payment"
                          disabled={entrySaving}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(rawIndex, entry);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
              {renderViewAll(rowKey, sortedEntries.length)}
            </>
          )
          : !isAdding(rowKey) && <div className="text-muted small">No payments recorded yet.</div>}

        {!isAdding(rowKey) && renderRecordButton(rowKey, rawIndex, "mt-1")}
        {renderEntryError()}
      </div>
    );
  };

  return (
    <div className="container-fluid bg-light min-vh-100">
      <div className="row min-vh-100">

        {/* SIDEBAR / TOP NAVIGATION */}
        <aside className="col-lg-3 col-xl-2 bg-dark text-white p-3 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-lg-4">
              <Link className="d-flex align-items-center gap-2 text-white text-decoration-none" to="/Dashboard">
                <img src={brandIcon} alt="" width="38" height="38" />
                <span>
                  <strong className="d-block">Our Family Money</strong>
                  <small className="text-white-50">{familyNames || "Family"}</small>
                </span>
              </Link>

              <div className="gap-1 d-flex d-lg-none">
                {/* Add/Edit Button inside top bar on mobile */}
                <Link to="/editor" className="btn btn-primary btn-sm d-flex align-items-center gap-1">
                  <PencilRuler size={16} />
                  <span>Add/Edit</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-danger btn-sm d-flex align-items-center gap-1"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {/* Total Monthly Card - Desktop Only */}
            <div className="card text-dark mb-3 d-none d-lg-block">
              <div className="card-body p-3">
                <h5 className="card-subtitle mb-2 text-body-secondary small">Monthly</h5>
                {loading ? (
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">Loading…</span>
                  </div>
                ) : (
                  <>
                    <h1 className="card-title fs-2 mb-1">{formatCurrency(totalMonthlyCost)}</h1>
                    <h6 className="card-subtitle text-body-secondary small">{formatCurrency(totalYearlyCost)} per year</h6>
                  </>
                )}
              </div>
            </div>

            {/* Kids Cards - Desktop Sidebar Only */}
            <div className="row g-2 g-lg-3 d-none d-lg-flex">
              {!loading && childTotals.map((child) => {
                const { name: displayName, color: childColor } = resolveChild(child.name || child.childId);

                return (
                  <div key={child.childId || displayName} className="col-12">
                    <div className="card bg-secondary bg-opacity-25 text-white border-0 p-2 p-lg-3">
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                          style={{
                            width: "36px",
                            height: "36px",
                            backgroundColor: childColor,
                            fontSize: "0.9rem",
                          }}
                        >
                          {child.childInitial || displayName.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <small
                            className="text-uppercase text-white-50 fw-bold d-block text-truncate"
                            style={{ fontSize: "0.7rem" }}
                          >
                            {displayName}
                          </small>
                          <span className="fw-bold fs-6 fs-lg-5">
                            {formatCurrency(child.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="col p-3 p-lg-4">

          {/* Add/Edit button for Desktop top corner */}
          <div className="d-none d-lg-flex justify-content-end mb-3 gap-2">
            <Link to="/editor" className="btn btn-primary btn-sm d-flex align-items-center gap-1">
              <PencilRuler size={16} />
              <span>Add/Edit</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-danger btn-sm d-flex align-items-center gap-1"
            >
              <LogOut size={16} />
            </button>
          </div>

          {loading ? (
            <div className="min-vh-100 d-flex align-items-center justify-content-center">
              <LoadingSpinner />
            </div>
          ) : (
          <>
          {/* MOBILE ONLY: KIDS SUMMARY CARDS ABOVE CATEGORIES GRAPH */}
          <div className="d-lg-none mb-4">
            <h6 className="text-uppercase fw-bold text-muted mb-2" style={{ fontSize: "0.75rem" }}>
              Children Breakdown
            </h6>
            <div className="row g-2">
              {childTotals.map((child) => {
                const { name: displayName, color: childColor } = resolveChild(child.name || child.childId);

                return (
                  <div key={child.childId || displayName} className="col-6 col-md-4">
                    <div className="card border-0 shadow-sm h-100 p-2">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                          style={{
                            width: "34px",
                            height: "34px",
                            backgroundColor: childColor,
                            fontSize: "0.85rem",
                          }}
                        >
                          {child.childInitial || displayName.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <small
                            className="text-uppercase text-muted fw-bold d-block text-truncate"
                            style={{ fontSize: "0.65rem" }}
                          >
                            {displayName}
                          </small>
                          <span className="fw-bold fs-6 text-dark">
                            {formatCurrency(child.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOP SECTION: CHART + CONTRIBUTORS */}
          <div className="row g-4 mb-4 align-items-stretch">
            {/* Categories Chart */}
            <div className="col-12 col-lg-6 d-flex">
              <div className="card w-100 border-0 shadow-sm">
                <div className="card-body d-flex flex-column">
                  <h5 className="card-subtitle mb-2 text-body-secondary">Categories</h5>
                  <h2 className="mb-3">Where it goes</h2>
                  <div className="position-relative flex-grow-1" style={{ height: "320px" }}>
                    <Bar data={categoryBreakdown} options={chartOptions} />
                  </div>
                </div>
              </div>
            </div>

            {/* Contributors Cards */}
            <div className="col-12 col-lg-6 d-flex">
              <div className="card w-100 border-0 shadow-sm">
                <div className="card-body d-flex flex-column">
                  <h5 className="card-subtitle mb-2 text-body-secondary">Contributors</h5>
                  <h2 className="mb-3">Monthly Split</h2>

                  <div className="row g-3 flex-grow-1 align-content-start overflow-y-auto" style={{ maxHeight: "320px" }}>
                    {payeeTotals.map((payee) => {
                      const percentage =
                        totalMonthlyCost > 0
                          ? Math.round((payee.totalAmount / totalMonthlyCost) * 100)
                          : 0;
                      const { name: payeeName, color: payeeColor } = resolvePayee(payee.name || payee.payerId);

                      return (
                        <div key={payee.payerId || payeeName} className="col-6">
                          <div className="card h-100 border">
                            <div className="card-body p-3">
                              <div className="d-flex align-items-center gap-2 mb-2">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    backgroundColor: payeeColor,
                                    fontSize: "1rem",
                                  }}
                                >
                                  {payee.payerInitial || payee.initial || payeeName.charAt(0)}
                                </div>

                                <div className="overflow-hidden">
                                  <div className="fw-semibold text-truncate small">
                                    {payeeName}
                                  </div>
                                  <div className="fw-bold fs-6">
                                    {formatCurrency(payee.totalAmount)}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="d-flex justify-content-between text-muted mb-1" style={{ fontSize: "0.75rem" }}>
                                  <span>Share</span>
                                  <span className="fw-bold">{percentage}%</span>
                                </div>
                                <div className="progress" style={{ height: "5px" }}>
                                  <div
                                    className="progress-bar"
                                    role="progressbar"
                                    style={{
                                      width: `${percentage}%`,
                                      backgroundColor: payeeColor,
                                    }}
                                    aria-valuenow={percentage}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LOWER SECTION: EXPENSES TABLE */}
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">

              {/* Table Controls */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                  <small className="text-uppercase fw-bold text-muted" style={{ fontSize: "0.75rem" }}>
                    EXPENSES
                  </small>
                  <h3 className="fw-bold mb-0">Monthly costs</h3>
                  <small className="text-muted">Filter, review or edit the items.</small>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted fw-bold mb-0" style={{ fontSize: "0.65rem" }}>
                      FOR CHILD
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={selectedChild}
                      onChange={(e) => setSelectedChild(e.target.value)}
                    >
                      <option value="all">All children</option>
                      {childTotals.map((c) => {
                        const { name } = resolveChild(c.name || c.childId);
                        return (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <label className="small text-muted fw-bold mb-0" style={{ fontSize: "0.65rem" }}>
                      WHAT SORT?
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {categories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                    onClick={() => {
                      setSelectedChild("all");
                      setSelectedCategory("all");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* DESKTOP: expenses table with expandable payment entries (lg and up) */}
              <div className="table-responsive d-none d-lg-block">
                <table className="table align-middle">
                  <thead>
                    <tr className="text-uppercase text-muted border-bottom small" style={{ fontSize: "0.7rem" }}>
                      {sortHeader("Expense", "name")}
                      {sortHeader("For", "for")}
                      {sortHeader("Category", "category")}
                      {sortHeader("Monthly", "monthly")}
                      <th className="text-end">Paid By</th>
                      <th style={{ width: "48px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpenseRows.map(({ expense, rowKey, rawIndex, sortedEntries, catInfo }) => {
                      const paymentPills = getIndividualPayments(expense);
                      const isExpanded = expandedRows.has(rowKey);

                      return (
                        <Fragment key={rowKey}>
                          <tr onClick={() => toggleRow(rowKey)} style={{ cursor: "pointer" }}>
                            {/* Name + Emoji */}
                            <td className="fw-bold text-dark">
                              <span className="me-2">{expense.emoji || catInfo.emoji || "📦"}</span>
                              {expense.name}
                            </td>

                            {/* Children Pills */}
                            <td>
                              <div className="d-flex gap-1 flex-wrap">
                                {expense.children && expense.children.length > 0 ? (
                                  expense.children.map((childKey) => {
                                    const { name: childName, color: cColor } = resolveChild(childKey);

                                    return (
                                      <span
                                        key={childName}
                                        className="badge rounded-pill fw-semibold px-2 py-1"
                                        style={{
                                          backgroundColor: `${cColor}20`,
                                          color: cColor,
                                          border: `1px solid ${cColor}40`,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        {childName}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="text-muted small">-</span>
                                )}
                              </div>
                            </td>

                            {/* Category Badge */}
                            <td>
                              <span
                                className="badge rounded-pill fw-semibold px-2 py-1"
                                style={{
                                  backgroundColor: `${catInfo.color}20`,
                                  color: catInfo.color,
                                  border: `1px solid ${catInfo.color}40`,
                                  fontSize: "0.75rem",
                                }}
                              >
                                <span className="me-1">{catInfo.emoji}</span>
                                {expense.category}
                              </span>
                            </td>

                            {/* Cost */}
                            <td className="fw-semibold text-dark">
                              {formatCurrency(expense.monthlyCost)}
                            </td>

                            {/* Paid By Individual Pills */}
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1 flex-wrap">
                                {paymentPills.map((p, pIdx) => {
                                  const { name: payeeName, color: pColor } = resolvePayee(p.payee);

                                  return (
                                    <span
                                      key={`${payeeName}-${pIdx}`}
                                      className="badge rounded-pill px-2 py-1 fw-normal"
                                      style={{
                                        backgroundColor: `${pColor}18`,
                                        color: pColor,
                                        border: `1px solid ${pColor}40`,
                                        fontSize: "0.75rem",
                                      }}
                                    >
                                      <strong className="me-1">{payeeName}</strong>
                                      {formatCurrency(p.amount)}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Expand toggle */}
                            <td className="text-end">
                              <div className="d-flex align-items-center justify-content-end gap-2">
                                {sortedEntries.length > 0 && (
                                  <span className="badge rounded-pill text-bg-light border text-muted fw-semibold">
                                    {sortedEntries.length}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light border-0 p-1 d-inline-flex"
                                  aria-expanded={isExpanded}
                                  aria-label="Toggle payment entries"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRow(rowKey);
                                  }}
                                >
                                  <ChevronDown
                                    size={16}
                                    className="text-muted"
                                    style={{
                                      transition: "transform .15s",
                                      transform: isExpanded ? "rotate(180deg)" : "none",
                                    }}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="p-0 border-0 bg-light">
                                {renderEntriesTable(rowKey, rawIndex, sortedEntries)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE: expense cards with expandable payment entries (below lg) */}
              <div className="d-lg-none d-flex flex-column gap-3">
                {sortedExpenseRows.map(({ expense, rowKey, rawIndex, sortedEntries, catInfo }) => {
                  const paymentPills = getIndividualPayments(expense);
                  const isExpanded = expandedRows.has(rowKey);
                  const entryCount = sortedEntries.length;

                  return (
                    <div key={rowKey} className="card border-0 shadow-sm rounded-4">
                      <div className="card-body p-3">
                        {/* Header: emoji + name + estimated monthly */}
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="d-flex align-items-center gap-2 overflow-hidden">
                            <span className="fs-4 flex-shrink-0">
                              {expense.emoji || catInfo.emoji || "📦"}
                            </span>
                            <h5 className="fw-bold mb-0 text-truncate">{expense.name}</h5>
                          </div>
                          <div className="text-end flex-shrink-0">
                            <div className="fw-bold">{formatCurrency(expense.monthlyCost)}</div>
                            <small className="text-muted lh-1 d-block" style={{ fontSize: "0.7rem" }}>
                              estimated
                              <br />
                              monthly
                            </small>
                          </div>
                        </div>

                        {/* Children + category badges */}
                        <div className="d-flex flex-wrap gap-1 mt-2">
                          {(expense.children || []).map((childKey) => {
                            const { name: childName, color: cColor } = resolveChild(childKey);
                            return (
                              <span
                                key={childName}
                                className="badge rounded-pill fw-semibold px-2 py-1"
                                style={{
                                  backgroundColor: `${cColor}20`,
                                  color: cColor,
                                  border: `1px solid ${cColor}40`,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {childName}
                              </span>
                            );
                          })}
                          <span
                            className="badge rounded-pill fw-semibold px-2 py-1"
                            style={{
                              backgroundColor: `${catInfo.color}20`,
                              color: catInfo.color,
                              border: `1px solid ${catInfo.color}40`,
                              fontSize: "0.75rem",
                            }}
                          >
                            <span className="me-1">{catInfo.emoji}</span>
                            {expense.category}
                          </span>
                        </div>

                        {/* Paid by */}
                        {paymentPills.length > 0 && (
                          <div className="mt-3">
                            <small className="text-muted d-block mb-1" style={{ fontSize: "0.7rem" }}>
                              Paid by
                            </small>
                            <div className="d-flex flex-wrap gap-2">
                              {paymentPills.map((p, pIdx) => {
                                const { name: payeeName, color: pColor } = resolvePayee(p.payee);
                                return (
                                  <div key={`${payeeName}-${pIdx}`} className="d-flex align-items-center gap-1">
                                    <span
                                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                                      style={{
                                        width: "26px",
                                        height: "26px",
                                        backgroundColor: pColor,
                                        fontSize: "0.7rem",
                                      }}
                                    >
                                      {payeeName.charAt(0)}
                                    </span>
                                    <span className="small fw-semibold">{formatCurrency(p.amount)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Payment entries expander */}
                        <div className="border-top mt-3 pt-1">
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-decoration-none d-flex align-items-center justify-content-between w-100 px-0"
                            onClick={() => toggleRow(rowKey)}
                            aria-expanded={isExpanded}
                          >
                            <span className="d-flex align-items-center gap-2 fw-semibold">
                              <Receipt size={16} />
                              {entryCount} payment {entryCount === 1 ? "entry" : "entries"}
                            </span>
                            <ChevronDown
                              size={16}
                              style={{
                                transition: "transform .15s",
                                transform: isExpanded ? "rotate(180deg)" : "none",
                              }}
                            />
                          </button>
                          {isExpanded && <div className="pt-2">{renderEntriesList(rowKey, rawIndex, sortedEntries)}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
          </>
          )}

        </main>
      </div>
    </div>
  );
}