import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PencilRuler, LogOut, } from "lucide-react";
import {
  getExpenses,
  getFamilyDisplayNames,
  getCategoryData,
  getExpenseData,
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
  const [payload, setPayload] = useState(null);
  const [selectedChild, setSelectedChild] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    let ignore = false;

    async function loadPayload() {
      try {
        const data = await getExpenses();
        if (!ignore) setPayload(data);
      } catch {
        if (!ignore) setPayload(null);
      }
    }

    loadPayload();
    return () => {
      ignore = true;
    };
  }, []);

  const categories = useMemo(() => getCategoryData(payload || {}), [payload]);
  const expenses = useMemo(() => getExpenseData(payload || {}), [payload]);
  const familyNames = getFamilyDisplayNames(payload || {});

  const payeeTotals = useMemo(() => {
    if (!payload) return [];
    return GetPayeeTotalsWithNames(payload);
  }, [payload]);

  const childTotals = useMemo(() => {
    if (!payload) return [];
    return GetChildTotalsWithNames(payload);
  }, [payload]);

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

  return (
    <div className="container-fluid bg-light min-vh-100">
      <div className="row min-vh-100">

        {/* SIDEBAR / TOP NAVIGATION */}
        <aside className="col-lg-3 col-xl-2 bg-dark text-white p-3 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-lg-4">
              <Link className="d-flex align-items-center gap-2 text-white text-decoration-none" to="/">
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
                <h1 className="card-title fs-2 mb-1">{formatCurrency(totalMonthlyCost)}</h1>
                <h6 className="card-subtitle text-body-secondary small">{formatCurrency(totalYearlyCost)} per year</h6>
              </div>
            </div>

            {/* Kids Cards - Desktop Sidebar Only */}
            <div className="row g-2 g-lg-3 d-none d-lg-flex">
              {childTotals.map((child) => {
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

              {/* Expenses Data Table */}
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr className="text-uppercase text-muted border-bottom small" style={{ fontSize: "0.7rem" }}>
                      <th>Expense ↑</th>
                      <th>For</th>
                      <th>Category</th>
                      <th>Monthly</th>
                      <th className="text-end">Paid By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense, idx) => {
                      const catInfo = categoryMap[expense.category] || {
                        emoji: "📌",
                        color: "#6c757d",
                      };
                      const paymentPills = getIndividualPayments(expense);

                      return (
                        <tr key={`${expense.name}-${idx}`}>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}