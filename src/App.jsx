import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Login from "./pages/login";
import AccessDenied from "./pages/access-denied";
import Dashboard from "./pages/dashboard";
import EditorShell from "./layouts/EditorShell";
import Expenses from "./pages/editor/expenses";
import Categories from "./pages/editor/categories";
import Family from "./pages/editor/family";
import JsonEditor from "./pages/editor/json";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Protected Routes (Requires 'family' role) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/editor" element={<EditorShell />}>
              <Route index element={<Navigate to="/editor/expenses" replace />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="categories" element={<Categories />} />
              <Route path="family" element={<Family />} />
              <Route path="json" element={<JsonEditor />} />
            </Route>
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}