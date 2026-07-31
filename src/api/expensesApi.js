import localExpensesData from "../data/expenses.json";
import { isDemoMode } from "../config/appMode";

// Demo deployments never touch the server or GitHub. Edits are kept in
// sessionStorage so they survive navigation and refresh, then clear when the
// browser session ends.
const DEMO_STORAGE_KEY = "family-expenses-demo-data";

function readDemoSession() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDemoSession(data) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / private-mode write failures — demo data is non-critical.
  }
}

export async function getExpenses() {
  // In demo mode, prefer any edits the visitor has made this session.
  if (isDemoMode()) {
    const stored = readDemoSession();
    if (stored) return parseImportedExpensesPayload(stored);
  }

  try {
    const response = await fetch("/api/expenses", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load expenses");
    return parseImportedExpensesPayload(await response.json());
  } catch {
    return parseImportedExpensesPayload(localExpensesData);
  }
}

export async function saveExpenses(data) {
  // Demo mode: persist to the browser session only, never to the server/GitHub.
  if (isDemoMode()) {
    const nextData = parseImportedExpensesPayload(data);
    writeDemoSession(nextData);
    return { saved: true, demo: true, message: "Saved for this demo session." };
  }

  const response = await fetch("/api/expenses", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not save expenses");
  return result;
}

export function parseImportedExpensesPayload(payload) {
  let nextPayload = payload;

  if (typeof nextPayload === "string") {
    try {
      nextPayload = JSON.parse(nextPayload);
    } catch {
      throw new Error("The selected file is not valid JSON.");
    }
  }

  if (!nextPayload || typeof nextPayload !== "object" || Array.isArray(nextPayload)) {
    return {
      expenses: [],
      family: { children: [], payers: [] },
      categories: [],
    };
  }

  if (!Array.isArray(nextPayload.expenses)) {
    nextPayload.expenses = [];
  }

  if (!nextPayload.family || typeof nextPayload.family !== "object") {
    nextPayload.family = { children: [], payers: [] };
  }

  if (!Array.isArray(nextPayload.categories)) {
    nextPayload.categories = [];
  }

  return nextPayload;
}

export function getFamilyData(payload) {
  const data = parseImportedExpensesPayload(payload);
  return {
    children: (data.family?.children || []).map((child) => ({
      id: child?.id || "",
      name: child?.name || "",
      initial: child?.initial || "",
      color: child?.color || "",
    })),
    payers: (data.family?.payers || []).map((payer) => ({
      id: payer?.id || "",
      name: payer?.name || "",
      initial: payer?.initial || "",
      color: payer?.color || "",
    })),
  };
}

export function getCategoryData(payload) {
  const data = parseImportedExpensesPayload(payload);
  return (data.categories || []).map((category) => ({
    name: category?.name || "",
    emoji: category?.emoji || "📌",
    color: category?.color || "",
  }));
}

export function getExpenseData(payload) {
  const data = parseImportedExpensesPayload(payload);
  return (data.expenses || []).map((expense) => ({
    name: expense?.name || "",
    emoji: expense?.emoji || "",
    children: (expense?.children || []).map((child) => String(child || "").trim()),
    category: expense?.category || "",
    monthlyCost: Number(expense?.monthlyCost || 0),
    paidBy: Object.fromEntries(
      Object.entries(expense?.paidBy || {}).map(([payerId, amount]) => [payerId, Number(amount) || 0])
    ),
    entries: (expense?.entries || []).map((entry) => ({
      date: entry?.date || "",
      description: entry?.description || "",
      amount: Number(entry?.amount || 0),
    })),
  }));
}

export function GetPayeeTotalsWithNames(payload) {
  const { payers } = getFamilyData(payload);
  const expenses = getExpenseData(payload);

  // Map payer details by ID for quick lookup
  const payerMap = new Map(payers.map((p) => [p.id, p]));
  const totals = {};

  // Accumulate amounts
  expenses.forEach((expense) => {
    Object.entries(expense.paidBy).forEach(([payerId, amount]) => {
      totals[payerId] = (totals[payerId] || 0) + amount;
    });
  });

  // Format into a clean record set
  return Object.entries(totals).map(([payerId, totalAmount]) => {
    const payer = payerMap.get(payerId);
    return {
      payerId,
      name: payer?.name || "Unknown Payer",
      totalAmount,
      payerInitial: payer?.initial || "",
      payerColor: payer?.color || "",
    };
  });
}

export function GetChildTotalsWithNames(payload) {
  const { children } = getFamilyData(payload);
  const expenses = getExpenseData(payload);

  const childMap = new Map(children.map((c) => [c.id, c]));
  const totals = {};

  // Ensure all registered children are initialized in the totals map
  children.forEach((child) => {
    totals[child.id] = 0;
  });

  expenses.forEach((expense) => {
    const attachedChildren = expense.children || [];
    if (attachedChildren.length === 0) return;

    // Divide expense monthlyCost evenly among attached children
    const costPerChild = (expense.monthlyCost || 0) / attachedChildren.length;

    attachedChildren.forEach((childId) => {
      totals[childId] = (totals[childId] || 0) + costPerChild;
    });
  });

  return Object.entries(totals).map(([childId, totalAmount]) => {
    const child = childMap.get(childId);
    return {
      childId,
      name: child?.name || "Unknown Child", // Fixed typo: child instead of children
      totalAmount,
      childInitial: child?.initial || "",
      childColor: child?.color || "",
    };
  });
}

export function getFamilyDisplayNames(payload) {
  const family = getFamilyData(payload);
  return family.children.map((child) => child.name).filter(Boolean).join(" + ");
}

export async function importExpensesData(payload) {
  const nextData = parseImportedExpensesPayload(payload);
  return saveExpenses(nextData);
}