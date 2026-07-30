import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import brandIcon from "../assets/favicon.svg";
import {
  CreditCard,
  Tag,
  Users,
  FileJson,
  CheckCircle2,
  CloudUpload,
  LogOut
} from "lucide-react";
import { getExpenses, getFamilyDisplayNames } from "../api/expensesApi";

export default function EditorShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (location.state?.payload) {
      setPayload(location.state.payload);
    } else {
      async function loadPayload() {
        try {
          const data = await getExpenses();
          setPayload(data);
        } catch {
          setPayload(null);
        }
      }
      loadPayload();
    }
  }, [location.state]);

  const familyNames = getFamilyDisplayNames(payload || {});

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
    }, 600);
  };

  const handleExit = () => {
    navigate("/", { state: { payload } });
  };

  return (
    <div className="container-fluid bg-light px-0">
      <div className="row g-0">

        {/* MOBILE TOP HEADER (< lg) - Mirrors dashboard header layout */}
        <div className="col-12 bg-dark text-white p-3 d-flex align-items-center justify-content-between d-lg-none flex-shrink-0 shadow-sm">
          <div className="d-flex align-items-center gap-2 text-truncate pe-2">
            <img src={brandIcon} alt="" width="38" height="38" className="flex-shrink-0" />
            <div className="text-truncate">
              <span className="d-block fw-bold text-truncate" style={{ fontSize: "0.9rem", lineHeight: "1.1" }}>Our Family Money</span>
              <small className="text-white-50 text-truncate d-block" style={{ fontSize: "0.7rem" }}>{familyNames || "Family"}</small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="btn btn-outline-light btn-sm px-2 py-1"
              style={{ fontSize: "0.75rem" }}
              onClick={handleExit}
            >
              Exit
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm px-3 py-1 fw-semibold rounded-2 border-0 shadow-sm"
              style={{ fontSize: "0.75rem" }}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* 2. MOBILE NAVIGATION PILL BAR (< lg) - Hidden on Desktop */}
        <div className="col-12 d-lg-none bg-white border-bottom px-3 py-2 d-flex justify-content-around align-items-center flex-shrink-0 shadow-sm">
          <NavLink
            to="/editor/expenses"
            state={{ payload }}
            className={({ isActive }) => `btn btn-sm rounded-pill px-3 py-1 fw-semibold text-decoration-none ${isActive ? "btn-primary" : "btn-light text-muted"}`}
            style={{ fontSize: "0.75rem" }}
          >
            Expenses
          </NavLink>
          <NavLink
            to="/editor/categories"
            state={{ payload }}
            className={({ isActive }) => `btn btn-sm rounded-pill px-3 py-1 fw-semibold text-decoration-none ${isActive ? "btn-primary" : "btn-light text-muted"}`}
            style={{ fontSize: "0.75rem" }}
          >
            Categories
          </NavLink>
          <NavLink
            to="/editor/family"
            state={{ payload }}
            className={({ isActive }) => `btn btn-sm rounded-pill px-3 py-1 fw-semibold text-decoration-none ${isActive ? "btn-primary" : "btn-light text-muted"}`}
            style={{ fontSize: "0.75rem" }}
          >
            Family
          </NavLink>
          <NavLink
            to="/editor/json"
            state={{ payload }}
            className={({ isActive }) => `btn btn-sm rounded-pill px-3 py-1 fw-semibold text-decoration-none ${isActive ? "btn-primary" : "btn-light text-muted"}`}
            style={{ fontSize: "0.75rem" }}
          >
            JSON
          </NavLink>
        </div>

        {/* 3. DESKTOP SIDEBAR - Fixed height block using sticky positioning so items never push down */}
        <aside
          className="col-lg-3 col-xl-2 bg-dark text-white p-3 d-none d-lg-flex flex-column justify-content-between"
          style={{ height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}
        >
          <div>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div className="d-flex align-items-center gap-2 text-white text-decoration-none">
                <img src={brandIcon} alt="" width="38" height="38" />
                <span>
                  <strong className="d-block">Our Family Money</strong>
                  <small className="text-white-50">{familyNames || "Family"}</small>
                </span>
              </div>
            </div>

            <div className="text-uppercase text-white-50 fw-bold px-2 mb-2" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
              Edit Centre
            </div>

            <ul className="nav nav-pills flex-column gap-1 mb-auto">
              <li>
                <NavLink
                  to="/editor/expenses"
                  state={{ payload }}
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center rounded-3 fw-semibold text-decoration-none ${isActive ? "text-white bg-primary shadow-sm" : "text-white-50"
                    }`
                  }
                >
                  <div className="d-flex align-items-center gap-2">
                    <CreditCard size={18} />
                    <span>Expenses</span>
                  </div>
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/editor/categories"
                  state={{ payload }}
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center rounded-3 fw-semibold text-decoration-none ${isActive ? "text-white bg-primary shadow-sm" : "text-white-50"
                    }`
                  }
                >
                  <div className="d-flex align-items-center gap-2">
                    <Tag size={18} />
                    <span>Categories</span>
                  </div>
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/editor/family"
                  state={{ payload }}
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center rounded-3 fw-semibold text-decoration-none ${isActive ? "text-white bg-primary shadow-sm" : "text-white-50"
                    }`
                  }
                >
                  <div className="d-flex align-items-center gap-2">
                    <Users size={18} />
                    <span>Family</span>
                  </div>
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/editor/json"
                  state={{ payload }}
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center rounded-3 fw-semibold text-decoration-none ${isActive ? "text-white bg-primary shadow-sm" : "text-white-50"
                    }`
                  }
                >
                  <div className="d-flex align-items-center gap-2">
                    <FileJson size={18} />
                    <span>JSON</span>
                  </div>
                </NavLink>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2 flex-shrink-0">
            <div className="d-flex align-items-center gap-2 px-2 text-muted small">
              <CheckCircle2 size={16} className="text-success flex-shrink-0" />
              <div>
                <div className="text-white small fw-semibold" style={{ fontSize: "0.8rem" }}>All changes saved</div>
                <div style={{ fontSize: "0.70rem", color: "#6c757d" }}>Just now</div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold shadow-sm border-0"
              onClick={handleSave}
              disabled={isSaving}
            >
              <CloudUpload size={16} />
              <span>{isSaving ? "Saving..." : "Save to GitHub"}</span>
            </button>

            <button
              type="button"
              className="btn btn-dark btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-2 border border-secondary border-opacity-50 text-light bg-transparent"
              onClick={handleExit}
            >
              <LogOut size={16} />
              <span>Cancel</span>
            </button>
          </div>
        </aside>

        {/* 4. MAIN CONTENT AREA */}
        <main className="col-12 col-lg p-3 p-lg-4 overflow-hidden">
          <Outlet />
        </main>

      </div>
    </div>
  );
}