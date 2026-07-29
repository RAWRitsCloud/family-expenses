const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const syncDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const syncTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const palette = ["#2563eb", "#7c3aed", "#0891b2", "#10b981", "#f59e0b", "#e11d48"];
const demoSessionKey = "family-expenses-demo-session-v1";
const defaultCategories = [
  { name: "School", emoji: "🎒", color: "#2563eb" },
  { name: "Club", emoji: "⚜️", color: "#7c3aed" },
  { name: "Health", emoji: "👓", color: "#0891b2" },
  { name: "Phone", emoji: "📱", color: "#f59e0b" },
  { name: "Other", emoji: "📌", color: "#e11d48" }
];
const defaultFamily = {
  children: [
    { id: "callum", name: "Callum", initial: "C", color: "#2563eb" },
    { id: "conaire", name: "Conaire", initial: "C", color: "#7c3aed" }
  ],
  payers: [
    { id: "james", name: "James", initial: "J", color: "#2563eb" },
    { id: "donal", name: "Dónal", initial: "D", color: "#7c3aed" }
  ]
};
let data = { expenses: [] };
let draft = { expenses: [] };
let tableSort = { key: "expense", direction: "asc" };
let lastResumeSyncAt = 0;
let activeEmojiTarget = null;
const isEditorPage = document.body.dataset.page === "editor";
const appMode = window.FAMILY_EXPENSES_APP_MODE === "demo" ? "demo" : "live";
const isDemoMode = appMode === "demo";

const $ = id => document.getElementById(id);
const setText = (id, text) => { const element = $(id); if (element) element.textContent = text; };
const on = (id, event, handler) => { const element = $(id); if (element) element.addEventListener(event, handler); };
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const sum = (items, key) => items.reduce((n, item) => n + Number(item[key] || 0), 0);
const pct = (part, total) => total ? Math.round(part / total * 100) : 0;
const expenseNameSorter = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en-GB", { sensitivity: "base", numeric: true });
const categoryNameSorter = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en-GB", { sensitivity: "base", numeric: true });
const categoryKey = name => String(name || "").trim().toLowerCase();
const familyChildren = (source = data) => Array.isArray(source.family?.children) ? source.family.children : [];
const familyPayers = (source = data) => Array.isArray(source.family?.payers) ? source.family.payers : [];
const personById = (people, id) => people.find(person => person.id === id);
const childById = (id, source = data) => personById(familyChildren(source), id);
const payerById = (id, source = data) => personById(familyPayers(source), id);
const personLabel = person => person?.name || "Unknown";
const personInitial = person => person?.initial || person?.name?.trim()?.[0] || "?";
const derivePersonInitial = name => String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
const personColor = (person, fallback = "#64748b") => person?.color || fallback;
const paidBy = expense => expense.paidBy && typeof expense.paidBy === "object" ? expense.paidBy : {};
const payerAmount = (expense, payerId) => Number(paidBy(expense)[payerId] || 0);
const totalPaid = expense => Object.values(paidBy(expense)).reduce((total, value) => total + Number(value || 0), 0);
const payerText = expense => familyPayers().filter(payer => payerAmount(expense, payer.id)).map(payer => payer.name).join(" + ") || "—";
const tableSortValue = (expense, key) => ({
  expense: expense.name || "",
  children: editorChildren(expense).map(id => personLabel(childById(id))).join(" "),
  category: expense.category || "",
  monthly: Number(expense.monthlyCost || 0),
  paid: payerText(expense)
}[key] ?? expense.name ?? "");
const compareTableSortValues = (a, b, key) => {
  const aValue = tableSortValue(a, key);
  const bValue = tableSortValue(b, key);
  if (typeof aValue === "number" && typeof bValue === "number") return aValue - bValue;
  return String(aValue).localeCompare(String(bValue), "en-GB", { sensitivity: "base", numeric: true });
};
const sortExpensesForTable = items => [...items].sort((a, b) => {
  const result = compareTableSortValues(a, b, tableSort.key);
  const sorted = tableSort.direction === "asc" ? result : -result;
  return sorted || expenseNameSorter(a, b);
});
const defaultCategoryFor = category => defaultCategories.find(item => categoryKey(item.name) === categoryKey(category));
const categoryFrom = (category, source = data) => {
  const exact = source?.categories?.find(item => categoryKey(item.name) === categoryKey(category));
  return exact || defaultCategoryFor(category);
};
const categoryEmoji = (category, source = data) => categoryFrom(category, source)?.emoji || "📌";
const escapedCategoryEmoji = (category, source = data) => escapeHtml(categoryEmoji(category, source));
const categoryColor = (category, index = 0, source = data) => categoryFrom(category, source)?.color || palette[index % palette.length];
const categoryPill = category => `<span class="pill pill-category" style="--category-color:${escapeHtml(categoryColor(category))}"><span aria-hidden="true">${escapedCategoryEmoji(category)}</span>${escapeHtml(category)}</span>`;
const expenseEmojiForCategory = (category, expenses = data.expenses || []) => {
  const categoryExpenses = [...expenses]
    .filter(expense => categoryKey(expense.category) === categoryKey(category) && expense.emoji)
    .sort((a, b) => Number(b.monthlyCost || 0) - Number(a.monthlyCost || 0));
  return categoryExpenses[0]?.emoji || defaultCategoryFor(category)?.emoji || "📌";
};
const safeCategoryColor = (color, index, category) => {
  const value = String(color || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  return defaultCategoryFor(category)?.color || palette[index % palette.length];
};
const safePersonColor = (color, fallback) => {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
};
const slugifyId = value => String(value || "person").trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "person";
const validatePeople = (people, label, defaults) => {
  if (!Array.isArray(people) || !people.length) throw new Error(`Family ${label} must be a non-empty array.`);
  const seen = new Set();
  people.forEach((person, i) => {
    if (!String(person.id || "").trim()) throw new Error(`${label} ${i+1}: id is required.`);
    if (!String(person.name || "").trim()) throw new Error(`${label} ${i+1}: name is required.`);
    person.id = String(person.id).trim();
    const key = categoryKey(person.id);
    if (seen.has(key)) throw new Error(`${label} ${i+1}: id must be unique.`);
    seen.add(key);
    person.name = String(person.name).trim();
    person.initial = String(person.initial || person.name[0] || "?").trim().slice(0, 2);
    person.color = safePersonColor(person.color, defaults[i % defaults.length]?.color || palette[i % palette.length]);
  });
};
const normaliseCategories = payload => {
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const seen = new Set();
  const categories = [];
  const add = (category, { override = false } = {}) => {
    const name = String(category?.name || category || "").trim();
    const key = categoryKey(name);
    if (!key) return;
    if (seen.has(key)) {
      if (override && category && typeof category === "object") {
        const existing = categories.find(item => categoryKey(item.name) === key);
        if (existing) {
          existing.name = name;
          existing.emoji = String(category.emoji || existing.emoji || expenseEmojiForCategory(name, expenses)).trim() || "📌";
          existing.color = safeCategoryColor(category.color || existing.color, categories.indexOf(existing), name);
        }
      }
      return;
    }
    seen.add(key);
    const index = categories.length;
    categories.push({
      name,
      emoji: String(category?.emoji || expenseEmojiForCategory(name, expenses)).trim() || "📌",
      color: safeCategoryColor(category?.color, index, name)
    });
  };

  const hasManagedCategories = Array.isArray(payload.categories);
  if (!hasManagedCategories) defaultCategories.forEach(add);
  else payload.categories.forEach(category => add(category, { override: true }));
  expenses.map(expense => expense.category).forEach(add);
  payload.categories = categories;
  return payload;
};
const expenseEmoji = expense => {
  if (expense.emoji) return expense.emoji;
  const text = `${expense.name} ${expense.category}`.toLowerCase();
  if (text.includes("swim")) return "🏊";
  if (text.includes("lunch")) return "🍽️";
  if (text.includes("train")) return "🚆";
  if (text.includes("music")) return "🎵";
  if (text.includes("tutor")) return "📚";
  if (text.includes("phone")) return "📱";
  if (text.includes("hair")) return "✂️";
  if (text.includes("vision") || text.includes("health")) return "👓";
  if (text.includes("scout") || text.includes("cub")) return "⚜️";
  if (text.includes("residential")) return "🏕️";
  return categoryEmoji(expense.category);
};
const escapedExpenseEmoji = expense => escapeHtml(expenseEmoji(expense));

let authenticationPromise = null;

const signedOutUrl = () => `${location.origin}/auth/signed-out.html`;
const appLogoutUrl = () => `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(signedOutUrl())}`;
const returnUrl = () => `${location.pathname}${location.search}${location.hash}` || "/";
const loginPageUrl = () => `/auth/login.html?return=${encodeURIComponent(returnUrl())}`;
const accessDeniedPageUrl = () => `/auth/access-denied.html?return=${encodeURIComponent(returnUrl())}`;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function revealApp() {
  if ($("app")) $("app").hidden = false;
  if ($("appLoading")) $("appLoading").hidden = true;
  document.body.classList.remove("no-scroll");
}

function readDemoSessionData() {
  try {
    const raw = sessionStorage.getItem(demoSessionKey);
    return raw ? validate(JSON.parse(raw)) : null;
  } catch {
    sessionStorage.removeItem(demoSessionKey);
    return null;
  }
}

function writeDemoSessionData(next) {
  try {
    sessionStorage.setItem(demoSessionKey, JSON.stringify(validate(structuredClone(next))));
  } catch {}
}

async function readPrincipal() {
  const response = await fetch(`/.auth/me?_=${Date.now()}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" }
  });

  if (!response.ok) throw new Error(`Auth check failed (${response.status})`);
  const payload = await response.json();
  return payload.clientPrincipal ?? null;
}

function setSignedInUser(principal) {
  const name = principal?.userDetails || principal?.identityProvider || "";
  if (name) setText("signedInUser", name.split("@")[0]);
}

async function hydrateSignedInUser() {
  try {
    setSignedInUser(await readPrincipal());
  } catch {}
}

async function readFamilyPrincipal() {
  const delays = [0, 500, 1200, 2500];
  let lastPrincipal = null;

  for (const delay of delays) {
    if (delay) await wait(delay);
    const principal = await readPrincipal();
    if (!principal) return null;

    lastPrincipal = principal;
    const roles = Array.isArray(principal.userRoles) ? principal.userRoles : [];
    if (roles.includes("family")) return principal;
  }

  return lastPrincipal;
}

async function authenticate({ force = false } = {}) {
  if (authenticationPromise && !force) return authenticationPromise;

  authenticationPromise = (async () => {
    if ($("logoutLink")) $("logoutLink").href = appLogoutUrl();

    try {
      const principal = await readFamilyPrincipal();
      if (!principal) {
        location.replace(loginPageUrl());
        return false;
      }

      const roles = Array.isArray(principal.userRoles) ? principal.userRoles : [];
      if (!roles.includes("family")) {
        location.replace(accessDeniedPageUrl());
        return false;
      }

      setSignedInUser(principal);
      revealApp();
      return true;
    } catch {
      if (["localhost", "127.0.0.1", ""].includes(location.hostname)) {
        setText("signedInUser", "local preview");
        if ($("logoutLink")) $("logoutLink").hidden = true;
        revealApp();
        return true;
      }
      location.replace(loginPageUrl());
      return false;
    } finally {
      authenticationPromise = null;
    }
  })();

  return authenticationPromise;
}

async function recoverAuthentication() {
  const ok = await authenticate({ force: true });
  if (ok) await load();
  return ok;
}

function validate(payload) {
  if (!payload || !Array.isArray(payload.expenses)) throw new Error('Data must contain an "expenses" array.');
  if (!payload.family || typeof payload.family !== "object") throw new Error('Data must contain a "family" object.');
  validatePeople(payload.family.children, "children", defaultFamily.children);
  validatePeople(payload.family.payers, "payers", defaultFamily.payers);
  const childIds = new Set(payload.family.children.map(child => child.id));
  const payerIds = new Set(payload.family.payers.map(payer => payer.id));
  normaliseCategories(payload);
  payload.categories.forEach((category, i) => {
    if (!String(category.name || "").trim()) throw new Error(`Category ${i+1}: name is required.`);
    category.name = String(category.name).trim();
    category.emoji = String(category.emoji || "📌").trim() || "📌";
    category.color = safeCategoryColor(category.color, i, category.name);
  });
  payload.expenses.forEach((e, i) => {
    if ("james" in e || "donal" in e) throw new Error(`Expense ${i+1}: use paidBy instead of james/donal fields.`);
    ["name", "category"].forEach(k => {
      if (!String(e[k] || "").trim()) throw new Error(`Expense ${i+1}: ${k} is required.`);
    });
    if (!Array.isArray(e.children) || !e.children.length) throw new Error(`Expense ${i+1}: children are required.`);
    const children = e.children;
    e.children = [...new Set(children.map(child => String(child || "").trim()).filter(Boolean))];
    if (!e.children.length) throw new Error(`Expense ${i+1}: children are required.`);
    e.children.forEach(child => {
      if (!childIds.has(child)) throw new Error(`Expense ${i+1}: child "${child}" is not in family.children.`);
    });
    if (!e.paidBy || typeof e.paidBy !== "object" || Array.isArray(e.paidBy)) throw new Error(`Expense ${i+1}: paidBy is required.`);
    if (!Number.isFinite(Number(e.monthlyCost)) || Number(e.monthlyCost) < 0) throw new Error(`Expense ${i+1}: monthlyCost must be zero or more.`);
    e.monthlyCost = Number(e.monthlyCost);
    Object.keys(e.paidBy).forEach(payerId => {
      if (!payerIds.has(payerId)) throw new Error(`Expense ${i+1}: payer "${payerId}" is not in family.payers.`);
    });
    payload.family.payers.forEach(payer => {
      const amount = Number(e.paidBy[payer.id] || 0);
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`Expense ${i+1}: paidBy.${payer.id} must be zero or more.`);
      e.paidBy[payer.id] = amount;
    });
    if (!Array.isArray(e.entries)) e.entries = [];
    e.entries.forEach((entry, j) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || ""))) throw new Error(`Expense ${i+1}, entry ${j+1}: date is required.`);
      if (!String(entry.description || "").trim()) throw new Error(`Expense ${i+1}, entry ${j+1}: description is required.`);
      if (!Number.isFinite(Number(entry.amount)) || Number(entry.amount) < 0) throw new Error(`Expense ${i+1}, entry ${j+1}: amount must be zero or more.`);
      entry.description = String(entry.description).trim();
      entry.amount = Number(entry.amount);
    });
  });
  return payload;
}

function filtered() {
  return sortExpensesForTable(data.expenses.filter(e => {
    const children = editorChildren(e);
    return ($("childFilter").value === "All" || children.includes($("childFilter").value)) && ($("categoryFilter").value === "All" || e.category === $("categoryFilter").value);
  }));
}
function group(items, key) {
  return items.reduce((groups, expense) => {
    groups[expense[key]] = (groups[expense[key]] || 0) + expense.monthlyCost;
    return groups;
  }, {});
}

function populate(select, values, label) {
  const old = select.value;
  select.innerHTML = `<option value="All">${label}</option>`;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  select.value = values.includes(old) ? old : "All";
}
function populatePeople(select, people, label) {
  const old = select.value;
  select.innerHTML = `<option value="All">${label}</option>`;
  people.forEach(person => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    select.append(option);
  });
  select.value = people.some(person => person.id === old) ? old : "All";
}
function familyNameText(source = data) {
  return familyChildren(source).map(child => child.name).join(" + ") || "Family expenses";
}
function renderChildCards(items) {
  const card = child => {
    const childExpenses = items.filter(expense => editorChildren(expense).includes(child.id));
    const style = `style="--person-color:${escapeHtml(personColor(child))}"`;
    return `<div class="sidebar-card child-card" ${style}>
      <div class="child-avatar">${escapeHtml(personInitial(child))}</div>
      <div><small>${escapeHtml(child.name)}</small><strong>${money.format(sum(childExpenses, "monthlyCost"))}</strong><span>${childExpenses.length} cost${childExpenses.length === 1 ? "" : "s"}</span></div>
    </div>`;
  };
  const cards = familyChildren().map(card).join("");
  $("sidebarChildren").innerHTML = cards;
  $("mobileChildren").innerHTML = cards;
  setText("sidebarFamilyNames", familyNameText());
  setText("mobileFamilyNames", familyNameText());
}
function renderContributors(payerTotals) {
  const totalPaid = Object.values(payerTotals).reduce((n, value) => n + Number(value || 0), 0);
  const payerSummaryCards = familyPayers().map(payer => {
    const value = payerTotals[payer.id] || 0;
    const percent = totalPaid ? Math.round((value / totalPaid) * 100) : 0;
    return `<div class="contributor-card" style="--person-color:${escapeHtml(personColor(payer))}">
      <span class="contributor-avatar">${escapeHtml(personInitial(payer))}</span>
      <span class="contributor-copy"><b>${escapeHtml(payer.name)}</b><strong>${money.format(value)}</strong><small>${percent}% of monthly contributions</small></span>
    </div>`;
  }).join("");
  if ($("contributorCards")) $("contributorCards").innerHTML = payerSummaryCards;
}

function render() {
  const items = filtered();
  const total = sum(items, "monthlyCost");
  const payerTotals = Object.fromEntries(familyPayers().map(payer => [payer.id, items.reduce((n, expense) => n + payerAmount(expense, payer.id), 0)]));
  const monthlyText = money.format(total);
  const annualText = `${money.format(total * 12)} per year`;
  setText("totalMonthly", monthlyText);
  setText("annualTotal", annualText);
  setText("mobileTotalMonthly", monthlyText);
  setText("mobileAnnualTotal", annualText);
  renderChildCards(items);
  $("visibleCount").textContent = `${items.length} expense${items.length===1?"":"s"}`;
  const categories = Object.entries(group(items, "category")).sort((a, b) => b[1] - a[1]);
  renderContributors(payerTotals);
  renderTable(items);
  renderMobileExpenses(items);
  renderCategories(categories);
  updateSortButtons();
}
function updateSortButtons() {
  document.querySelectorAll("[data-sort]").forEach(button => {
    const active = button.dataset.sort === tableSort.key;
    const directionLabel = tableSort.direction === "asc" ? "ascending" : "descending";
    button.classList.toggle("active", active);
    button.closest("th")?.setAttribute("aria-sort", active ? directionLabel : "none");
    const indicator = button.querySelector(".sort-indicator");
    if (indicator) indicator.textContent = active ? (tableSort.direction === "asc" ? "↑" : "↓") : "";
  });
}
function paidByHtml(e) {
  return familyPayers().map(payer => {
    const amount = payerAmount(e, payer.id);
    return amount ? `<span class="payer-pill" style="--person-color:${escapeHtml(personColor(payer))}"><b>${escapeHtml(payer.name)}</b> ${money.format(amount)}</span>` : "";
  }).filter(Boolean).join("") || `<span class="payer-pill">—</span>`;
}
function childrenPills(expense) {
  return editorChildren(expense).map(childId => {
    const child = childById(childId);
    return `<span class="pill pill-child" style="--person-color:${escapeHtml(personColor(child))}">${escapeHtml(personLabel(child))}</span>`;
  }).join(" ");
}
function renderTable(items) {
  if (!items.length) {
    $("expenseRows").innerHTML = `<tr><td colspan="5"><div class="empty">No expenses match these filters.</div></td></tr>`;
    return;
  }

  $("expenseRows").innerHTML = items.map(e => {
    const index = data.expenses.indexOf(e);
    const entries = [...(e.entries || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const paidBy = paidByHtml(e);
    const children = childrenPills(e);
    const category = categoryPill(e.category);
    const entryRows = entries.length ? entries.map(entry => {
      const originalIndex = e.entries.indexOf(entry);
      const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${entry.date}T12:00:00`));
      return `<div class="entry-row"><time datetime="${escapeHtml(entry.date)}">${date}</time><span>${escapeHtml(entry.description)}</span><strong>${money.format(entry.amount)}</strong><button class="entry-delete" data-expense-index="${index}" data-entry-index="${originalIndex}" aria-label="Delete ${escapeHtml(entry.description)}" title="Delete entry">×</button></div>`;
    }).join("") : `<div class="entry-empty">Nothing logged yet.</div>`;

    return `<tr class="expense-main-row" data-expense-index="${index}">
      <td data-label="Expense"><span class="expense-title"><span class="expense-emoji" aria-hidden="true">${escapedExpenseEmoji(e)}</span>${escapeHtml(e.name)}</span></td>
      <td data-label="For">${children}</td>
      <td data-label="Category">${category}</td>
      <td data-label="Monthly">${money.format(e.monthlyCost)}</td>
      <td data-label="Paid by" class="expense-last-cell"><span class="paid-by">${paidBy}</span><button class="entry-toggle" data-toggle-entry="${index}" aria-expanded="false" aria-controls="entries-${index}" title="Show logged items"><span aria-hidden="true">＋</span>${entries.length ? `<small>${entries.length}</small>` : ""}</button></td>
    </tr>
    <tr class="entry-detail-row" id="entries-${index}" hidden><td colspan="5"><div class="entry-panel">${entryRows}<button class="entry-add" data-add-entry="${index}" title="Add an entry" aria-label="Add an entry to ${escapeHtml(e.name)}">＋</button></div></td></tr>`;
  }).join("");
}
function renderMobileExpenses(items) {
  if (!$("mobileExpenseRows")) return;
  if (!items.length) {
    $("mobileExpenseRows").innerHTML = `<div class="empty">No expenses match these filters.</div>`;
    return;
  }

  $("mobileExpenseRows").innerHTML = items.map(e => {
    const index = data.expenses.indexOf(e);
    const entries = [...(e.entries || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const children = childrenPills(e);
    const category = categoryPill(e.category);
    const entryRows = entries.length ? entries.map(entry => {
      const originalIndex = e.entries.indexOf(entry);
      const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${entry.date}T12:00:00`));
      return `<div class="mobile-log-entry"><div class="mobile-log-copy"><time datetime="${escapeHtml(entry.date)}">${date}</time><span>${escapeHtml(entry.description)}</span></div><strong>${money.format(entry.amount)}</strong><button class="entry-delete" data-expense-index="${index}" data-entry-index="${originalIndex}" aria-label="Delete ${escapeHtml(entry.description)}" title="Delete entry">×</button></div>`;
    }).join("") : `<div class="entry-empty">Nothing logged yet.</div>`;

    return `<article class="mobile-expense-card">
      <div class="mobile-expense-summary">
        <span class="mobile-expense-emoji" aria-hidden="true">${escapedExpenseEmoji(e)}</span>
        <div class="mobile-expense-main">
          <div class="mobile-expense-top"><strong>${escapeHtml(e.name)}</strong><span>${money.format(e.monthlyCost)}</span></div>
          <div class="mobile-expense-chips">${children}${category}</div>
          <div class="mobile-paid-by">${paidByHtml(e)}</div>
        </div>
      </div>
      <div class="mobile-expense-actions"><button class="entry-toggle mobile-entry-toggle" data-toggle-entry="${index}" aria-expanded="false" aria-controls="mobile-entries-${index}" title="Show logged items"><span aria-hidden="true">＋</span>${entries.length ? `<small>${entries.length}</small>` : ""}</button></div>
      <div class="mobile-entry-panel" id="mobile-entries-${index}" hidden>${entryRows}<button class="entry-add" data-add-entry="${index}" title="Add an entry" aria-label="Add an entry to ${escapeHtml(e.name)}">＋</button></div>
    </article>`;
  }).join("");
}
function renderCategories(entries) {
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const chart = $("categoryBars");
  const longestLabel = Math.max(...entries.map(([name]) => name.length), 6);
  chart.style.setProperty("--category-label-width", `${Math.min(Math.max(longestLabel + 4, 9), 20)}ch`);
  chart.innerHTML = entries.map(([name, value], index) => {
    const width = value / max * 100;
    const rank = index < 3 ? `<span class="bar-rank rank-${index + 1}">${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"}</span>` : "";
    return `<div class="bar-row"><span class="bar-label"><span aria-hidden="true">${escapedCategoryEmoji(name)}</span>${escapeHtml(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${escapeHtml(categoryColor(name, index))}"></div></div><span class="bar-value">${money.format(value)}</span>${rank}</div>`;
  }).join("") || `<div class="empty">No chart data.</div>`;
}
function apply(next) {
  data = validate(next);
  draft = structuredClone(data);
  revealApp();
  if ($("childFilter")) populatePeople($("childFilter"), familyChildren(), "All children");
  if ($("categoryFilter")) populate($("categoryFilter"), [...new Set(data.categories.map(category => category.name))].sort(), "All categories");
  if ($("jsonEditor")) $("jsonEditor").value = JSON.stringify(data, null, 2);
  if (isEditorPage) {
    draft = structuredClone(data);
    renderEditor();
    return;
  }
  render();
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function liveExpensesRequest() {
  return fetchWithTimeout(`/api/expenses?_=${Date.now()}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" }
  });
}

async function loadDeployedData() {
  const deployed = await fetch(`/data/expenses.json?_=${Date.now()}`, { cache: "no-store" });
  if (deployed.status === 401 || deployed.status === 403) {
    await authenticate({ force: true });
    return null;
  }
  if (!deployed.ok) throw new Error(`Local data returned ${deployed.status}.`);
  return deployed.json();
}

function formatSyncTime(date = new Date()) {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? `Today at ${syncTime.format(date)}` : syncDate.format(date);
}

function setLastSyncTime(date = new Date()) {
  const element = $("syncTime");
  if (!element) return;
  element.hidden = false;
  element.textContent = `Last synced ${formatSyncTime(date)}`;
}

function setSyncError(message = "") {
  const details = $("syncError");
  const text = $("syncErrorText");
  if (!details || !text) return;
  details.hidden = !message;
  if (!message) details.open = false;
  text.textContent = message;
}

async function syncErrorMessage(response) {
  const body = await response.text().catch(() => "");
  if (!body) return `Endpoint returned ${response.status}.`;
  try {
    return JSON.parse(body).error || `Endpoint returned ${response.status}: ${body.slice(0, 240)}`;
  } catch {
    return `Endpoint returned ${response.status}: ${body.slice(0, 240)}`;
  }
}

async function requestLiveExpensesWithRetry(initialRequest) {
  try {
    const first = initialRequest ? await initialRequest : await liveExpensesRequest();
    if (first.ok || first.status === 401 || first.status === 403 || (first.status < 500 && first.status !== 408 && first.status !== 429)) return first;
  } catch {}

  await wait(700);
  return liveExpensesRequest();
}

async function syncFromGitHub(request = liveExpensesRequest()) {
  const button = $("syncNow");
  lastResumeSyncAt = Date.now();
  if (button) button.disabled = true;
  setText("syncText", isDemoMode ? "Loading demo data…" : "Syncing with GitHub…");
  setSyncError();
  try {
    if (isDemoMode) {
      const sessionData = readDemoSessionData();
      apply(sessionData || await loadDeployedData());
      setText("syncText", sessionData ? "Demo session restored" : "Demo data loaded");
      setStatus("Ready");
      return true;
    }

    const live = await requestLiveExpensesWithRetry(request);
    if (live.status === 401 || live.status === 403) {
      setStatus("Refreshing access…");
      await authenticate({ force: true });
      return false;
    }

    if (!live.ok) throw new Error(await syncErrorMessage(live));
    const mode = live.headers.get("X-Expenses-Mode");
    const liveData = await live.json();
    const sessionData = mode === "local" ? readDemoSessionData() : null;
    apply(sessionData || liveData);
    if (mode === "local") {
      setText("syncText", sessionData ? "Demo session restored" : "Demo data loaded");
    } else {
      setText("syncText", "Synced with GitHub");
      setLastSyncTime();
    }
    setStatus("Ready");
    return true;
  } catch (error) {
    setText("syncText", "Local copy used");
    const message = error.name === "AbortError"
      ? "GitHub sync timed out after 10 seconds. The site is still using the local deployed copy."
      : error.message || "GitHub sync failed. The site is still using the local deployed copy.";
    setSyncError(message);
    setStatus(data.expenses.length ? "Using local copy while GitHub catches up." : "No expense data could be loaded.", !data.expenses.length);
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

async function load() {
  setStatus("Loading saved expenses…");
  const sessionData = readDemoSessionData();
  if (sessionData) {
    apply(sessionData);
    setText("syncText", "Demo session restored");
    setStatus("Ready");
    return;
  }

  if (isDemoMode) {
    try {
      apply(await loadDeployedData());
      setText("syncText", "Demo data loaded");
      setStatus("Ready");
    } catch (error) {
      setSyncError(error.message || "Demo data could not be loaded.");
      setStatus("No expense data could be loaded.", true);
    }
    return;
  }

  const synced = await syncFromGitHub();
  if (synced) return;

  try {
    const deployedData = await loadDeployedData();
    if (!deployedData) return;
    apply(deployedData);
    setText("syncText", "Local copy used");
    setStatus("Ready");
  } catch (error) {
    setSyncError(error.message || "Local data could not be loaded.");
    setStatus("No expense data could be loaded.", true);
  }
}

async function refreshAfterPageResume() {
  if ($("app")?.hidden) {
    await recoverAuthentication();
    return;
  }

  const now = Date.now();
  if (now - lastResumeSyncAt < 30000) return;
  setText("syncText", "Checking GitHub…");
  await syncFromGitHub();
}

let activeEntryExpense = null;

function openEntryDialog(expenseIndex) {
  activeEntryExpense = Number(expenseIndex);
  const expense = data.expenses[activeEntryExpense];
  if (!expense) return;
  $("entryDialogTitle").textContent = expense.name;
  $("entryDate").value = new Date().toISOString().slice(0, 10);
  $("entryDescription").value = "";
  $("entryAmount").value = "";
  $("entryDialogStatus").textContent = "";
  $("entryDialog").showModal();
  setTimeout(() => $("entryDescription").focus(), 50);
}

async function persist(next, successText = "Synced with GitHub") {
  const validated = validate(structuredClone(next));
  if (isDemoMode) {
    writeDemoSessionData(validated);
    apply(validated);
    setText("syncText", "Demo changes saved for this session");
    return;
  }

  const r = await fetch("/api/expenses", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(validated)
  });
  const result = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) {
    await authenticate({ force: true });
    throw new Error("Your access was refreshed. Please try again.");
  }
  if (!r.ok) throw new Error(result.error || `Save failed (${r.status}).`);
  if (result.mode === "local") writeDemoSessionData(validated);
  apply(validated);
  if (result.mode === "local") {
    setText("syncText", result.message || "Demo changes saved for this session");
  } else {
    setText("syncText", successText);
    setLastSyncTime();
  }
}

async function addEntry(event) {
  event.preventDefault();
  const expense = data.expenses[activeEntryExpense];
  if (!expense) return;
  const entry = {
    date: $("entryDate").value,
    description: $("entryDescription").value.trim(),
    amount: Number($("entryAmount").value)
  };
  try {
    $("entryDialogStatus").textContent = "Saving…";
    $("saveEntry").disabled = true;
    const next = structuredClone(data);
    next.expenses[activeEntryExpense].entries.push(entry);
    await persist(next);
    $("entryDialog").close();
    requestAnimationFrame(() => {
      const toggle = document.querySelector(`[data-toggle-entry="${activeEntryExpense}"]`);
      if (toggle) toggle.click();
    });
  } catch (error) {
    $("entryDialogStatus").textContent = error.message;
  } finally {
    $("saveEntry").disabled = false;
  }
}

async function deleteEntry(expenseIndex, entryIndex) {
  const expense = data.expenses[expenseIndex];
  const entry = expense?.entries?.[entryIndex];
  if (!entry || !confirm(`Delete “${entry.description}”?`)) return;
  try {
    const next = structuredClone(data);
    next.expenses[expenseIndex].entries.splice(entryIndex, 1);
    await persist(next);
  } catch (error) {
    alert(error.message);
  }
}

let activeEditorIndex = -1;
const editorChildren = expense => {
  return Array.isArray(expense.children) && expense.children.length ? expense.children : [familyChildren(draft)[0]?.id || familyChildren()[0]?.id].filter(Boolean);
};
const selectedExpense = () => draft.expenses[activeEditorIndex] || null;
const roundMoney = value => Math.round(Number(value || 0) * 100) / 100;

function setEmojiValue(emoji) {
  const value = emoji || "📌";
  $("detailEmoji").value = value;
  setText("detailEmojiPreview", value);
  setText("detailHeroEmoji", value);
}

function closeEmojiPicker() {
  const popover = $("emojiPopover");
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  document.querySelectorAll("[data-emoji-target]").forEach(button => button.setAttribute("aria-expanded", "false"));
  activeEmojiTarget = null;
}

function parkEmojiPicker() {
  const popover = $("emojiPopover");
  const home = $("detailEmojiButton")?.closest(".emoji-field") || document.querySelector(".editor-page-emoji-home");
  if (popover && home && popover.parentElement !== home) home.append(popover);
}

function emojiFromPickerEvent(event) {
  return event.detail?.unicode || event.detail?.emoji?.unicode || event.detail?.emoji?.native || "";
}

function closeDrawer() {
  if (isEditorPage) {
    location.href = "/";
    return;
  }
  if ($("editorDrawer")) {
    $("editorDrawer").classList.remove("open");
    $("editorDrawer").setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("no-scroll");
}

function renderEditor() {
  normaliseCategories(draft);
  const expenseList = $("expenseEditorList");
  if (expenseList) {
    const query = $("expenseSearch")?.value?.trim().toLowerCase() || "";
    const matches = draft.expenses
      .map((expense, index) => ({ expense, index }))
      .filter(({ expense }) => !query || `${expense.name} ${editorChildren(expense).join(" ")} ${expense.category}`.toLowerCase().includes(query))
      .sort((a, b) => expenseNameSorter(a.expense, b.expense));

    if (activeEditorIndex !== -1 && !draft.expenses[activeEditorIndex]) activeEditorIndex = -1;
    expenseList.innerHTML = matches.length ? matches.map(({ expense, index }) => {
      const children = editorChildren(expense).map(childId => `<span class="mini-chip">${escapeHtml(personLabel(childById(childId, draft)))}</span>`).join("");
      return `<button class="expense-pick ${index === activeEditorIndex ? "active" : ""}" type="button" data-index="${index}">
        <span class="expense-pick-emoji" aria-hidden="true">${escapeHtml(expense.emoji || expenseEmoji(expense))}</span>
        <span class="expense-pick-main"><b>${escapeHtml(expense.name)}</b><small>${children}<span class="mini-chip category">${escapedCategoryEmoji(expense.category, draft)} ${escapeHtml(expense.category)}</span></small></span>
        <strong>${money.format(Number(expense.monthlyCost || 0))}<small>/ month</small></strong>
      </button>`;
    }).join("") : `<div class="empty">No expenses match that search.</div>`;
    renderExpenseDetail();
  }

  renderCategoryEditor();
  renderFamilyEditor();
  if ($("jsonEditor")) $("jsonEditor").value = JSON.stringify(draft, null, 2);
}
function categoryUsage(name) {
  return draft.expenses.filter(expense => categoryKey(expense.category) === categoryKey(name)).length;
}
function renderCategoryEditor() {
  const list = $("categoryEditorList");
  if (!list) return;
  list.innerHTML = [...draft.categories].map((category, index) => ({ category, index })).sort((a, b) => categoryNameSorter(a.category, b.category)).map(({ category, index }) => {
    const used = categoryUsage(category.name);
    const key = escapeHtml(category.name);
    return `<div class="category-edit-row" data-category-name="${key}">
      <div class="emoji-field category-emoji-field">
        <button class="emoji-trigger category-emoji-trigger" type="button" aria-haspopup="dialog" aria-expanded="false" data-emoji-target="category" data-category-index="${index}" aria-label="Choose emoji for ${key}" title="Choose emoji">
          <span aria-hidden="true">${escapeHtml(category.emoji)}</span>
        </button>
      </div>
      <input class="category-name-input" data-category-field="name" value="${key}" aria-label="Category name">
      <input class="category-color-input" data-category-field="color" type="color" value="${escapeHtml(category.color)}" aria-label="${key} colour">
      <button class="category-remove" type="button" data-remove-category="${key}" ${used ? "disabled" : ""} title="${used ? "This category is used by expenses" : "Remove category"}">×</button>
    </div>`;
  }).join("");
}
function renderExpenseDetail() {
  if (!$("expenseDetailForm")) return;
  const expense = selectedExpense();
  $("expenseDetailForm").classList.toggle("editing", Boolean(expense));
  $("expenseDetailEmpty").hidden = Boolean(expense);
  $("expenseDetailFields").hidden = !expense;
  if (!expense) return;

  $("detailExpenseTitle").textContent = expense.name || "Expense";
  $("detailName").value = expense.name || "";
  setEmojiValue(expense.emoji || expenseEmoji(expense));
  setText("detailHeroEmoji", expense.emoji || expenseEmoji(expense));
  setText("detailMonthlySummary", money.format(Number(expense.monthlyCost || 0)));
  const categories = [...draft.categories].sort(categoryNameSorter).map(category => category.name);
  $("detailCategory").innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapedCategoryEmoji(category, draft)} ${escapeHtml(category)}</option>`).join("");
  $("detailCategory").value = categories.includes(expense.category) ? expense.category : "Other";
  $("detailMonthlyCost").value = Number(expense.monthlyCost || 0);
  $("detailPayers").innerHTML = familyPayers(draft).map(payer => `<label style="--person-color:${escapeHtml(personColor(payer))}"><span>${escapeHtml(payer.name)}</span><div class="money-input payer-money"><b>£</b><input data-payer="${escapeHtml(payer.id)}" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(payerAmount(expense, payer.id) || 0)}"></div></label>`).join("");
  $("splitButtons").innerHTML = `<button type="button" data-split="even">Split evenly</button>${familyPayers(draft).map(payer => `<button type="button" data-split-payer="${escapeHtml(payer.id)}" style="--person-color:${escapeHtml(personColor(payer))}">${escapeHtml(payer.name)} contributes all</button>`).join("")}`;
  resetOneOffHelper();
  const children = editorChildren(expense);
  $("detailChildren").innerHTML = familyChildren(draft).map(child => `<button type="button" data-child="${escapeHtml(child.id)}" class="${children.includes(child.id) ? "active" : ""}" style="--person-color:${escapeHtml(personColor(child))}">${escapeHtml(child.name)}</button>`).join("");
  updateSplitCheck();
}

function scrollExpenseDetailIntoView() {
  if (!isEditorPage) return;
  const detail = $("expenseDetailForm");
  if (!detail) return;
  requestAnimationFrame(() => {
    const rect = detail.getBoundingClientRect();
    const needsScroll = window.matchMedia("(max-width: 980px)").matches || rect.top < 0 || rect.bottom > window.innerHeight;
    if (needsScroll) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function pullForm() {
  const expense = selectedExpense();
  if (!expense || !$("detailName")) return;
  expense.name = $("detailName").value.trim() || "Untitled expense";
  expense.emoji = $("detailEmoji").value || expenseEmoji(expense);
  expense.category = $("detailCategory").value || "Other";
  const children = [...document.querySelectorAll("#detailChildren [data-child].active")].map(button => button.dataset.child);
  expense.children = children.length ? children : [familyChildren(draft)[0]?.id].filter(Boolean);
  expense.monthlyCost = Number($("detailMonthlyCost").value || 0);
  setText("detailMonthlySummary", money.format(expense.monthlyCost));
  expense.paidBy = {};
  document.querySelectorAll("#detailPayers [data-payer]").forEach(input => {
    expense.paidBy[input.dataset.payer] = Number(input.value || 0);
  });
  $("detailExpenseTitle").textContent = expense.name;
  setText("detailHeroEmoji", expense.emoji || expenseEmoji(expense));
}

function addCategory() {
  pullForm();
  normaliseCategories(draft);
  const existing = new Set(draft.categories.map(category => categoryKey(category.name)));
  let name = "New category";
  let suffix = 2;
  while (existing.has(categoryKey(name))) {
    name = `New category ${suffix}`;
    suffix += 1;
  }
  draft.categories.push({ name, emoji: "📌", color: palette[draft.categories.length % palette.length] });
  renderEditor();
  const input = [...document.querySelectorAll(".category-name-input")].find(item => item.value === name);
  if (input) input.focus();
}

function handleCategoryEditorInput(event) {
  const field = event.target.closest("[data-category-field]");
  if (!field || field.dataset.categoryField === "name") return;
  const row = field.closest("[data-category-name]");
  const category = draft.categories.find(item => item.name === row?.dataset.categoryName);
  if (!category) return;
  category[field.dataset.categoryField] = field.value;
}

function handleCategoryEditorChange(event) {
  const field = event.target.closest("[data-category-field]");
  if (!field) return;
  pullForm();
  normaliseCategories(draft);
  const row = field.closest("[data-category-name]");
  const oldName = row?.dataset.categoryName;
  const category = draft.categories.find(item => item.name === oldName);
  if (!category) return;

  if (field.dataset.categoryField === "name") {
    const nextName = field.value.trim();
    if (!nextName) {
      setStatus("Category needs a name.", true);
      field.value = oldName;
      return;
    }
    const duplicate = draft.categories.some(item => item !== category && categoryKey(item.name) === categoryKey(nextName));
    if (duplicate) {
      setStatus("That category already exists.", true);
      field.value = oldName;
      return;
    }
    draft.expenses.forEach(expense => {
      if (categoryKey(expense.category) === categoryKey(oldName)) expense.category = nextName;
    });
    category.name = nextName;
  } else {
    category[field.dataset.categoryField] = field.value;
  }

  setStatus("Category updated");
  renderEditor();
}

function handleCategoryEditorClick(event) {
  const remove = event.target.closest("[data-remove-category]");
  if (!remove) return;
  pullForm();
  const name = remove.dataset.removeCategory;
  if (categoryUsage(name)) return;
  draft.categories = draft.categories.filter(category => category.name !== name);
  setStatus("Category removed");
  renderEditor();
}

function personUsage(type, id) {
  if (type === "children") return draft.expenses.filter(expense => editorChildren(expense).includes(id)).length;
  return draft.expenses.filter(expense => Number(payerAmount(expense, id) || 0) > 0).length;
}

function renderPeopleEditor(type, listId) {
  const people = type === "children" ? familyChildren(draft) : familyPayers(draft);
  const list = $(listId);
  if (!list) return;
  list.innerHTML = people.map((person, index) => {
    const used = personUsage(type, person.id);
    const locked = used || people.length === 1;
    const typeLabel = type === "children" ? "child" : "payer";
    return `<div class="person-edit-row" data-person-type="${type}" data-person-id="${escapeHtml(person.id)}">
      <label><span>Name</span><input data-person-field="name" value="${escapeHtml(person.name)}" aria-label="${escapeHtml(typeLabel)} name"></label>
      <label><span>Initials</span><input data-person-field="initial" value="${escapeHtml(personInitial(person))}" maxlength="2" aria-label="${escapeHtml(typeLabel)} initials"></label>
      <label><span>Colour</span><input data-person-field="color" type="color" value="${escapeHtml(person.color)}" aria-label="${escapeHtml(typeLabel)} colour"></label>
      <button class="category-remove person-remove" type="button" data-remove-person="${escapeHtml(person.id)}" data-person-type="${type}" ${locked ? "disabled" : ""} title="${used ? "This person is used by expenses" : people.length === 1 ? `At least one ${typeLabel} is needed` : `Remove ${typeLabel}`}">×</button>
    </div>`;
  }).join("");
}

function renderFamilyEditor() {
  renderPeopleEditor("children", "childEditorList");
  renderPeopleEditor("payers", "payerEditorList");
}

function uniquePersonId(type, base, ignoreId = "") {
  const people = type === "children" ? familyChildren(draft) : familyPayers(draft);
  const existing = new Set(people.filter(person => person.id !== ignoreId).map(person => categoryKey(person.id)));
  const root = slugifyId(base);
  let id = root;
  let suffix = 2;
  while (existing.has(categoryKey(id))) {
    id = `${root}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function addPerson(type) {
  pullForm();
  const collection = type === "children" ? draft.family.children : draft.family.payers;
  const label = type === "children" ? "New child" : "New payer";
  const id = uniquePersonId(type, label);
  collection.push({ id, name: label, initial: derivePersonInitial(label), color: palette[collection.length % palette.length] });
  if (type === "payers") draft.expenses.forEach(expense => { expense.paidBy[id] = 0; });
  renderEditor();
}

function changePersonId(type, oldId, nextId) {
  if (oldId === nextId) return;
  if (type === "children") {
    draft.expenses.forEach(expense => {
      expense.children = editorChildren(expense).map(childId => childId === oldId ? nextId : childId);
    });
    return;
  }
  draft.expenses.forEach(expense => {
    const amount = Number(expense.paidBy?.[oldId] || 0);
    delete expense.paidBy[oldId];
    expense.paidBy[nextId] = Number(expense.paidBy[nextId] || 0) + amount;
  });
}

function handlePersonEditorChange(event) {
  const field = event.target.closest("[data-person-field]");
  if (!field) return;
  pullForm();
  const row = field.closest("[data-person-type][data-person-id]");
  const type = row?.dataset.personType;
  const oldId = row?.dataset.personId;
  const people = type === "children" ? familyChildren(draft) : familyPayers(draft);
  const person = people.find(item => item.id === oldId);
  if (!person) return;

  if (field.dataset.personField === "name") {
    const nextName = field.value.trim() || "Unnamed";
    const nextId = uniquePersonId(type, nextName, oldId);
    changePersonId(type, oldId, nextId);
    person.id = nextId;
    person.name = nextName;
    if (!String(person.initial || "").trim() || person.initial === derivePersonInitial(field.defaultValue)) {
      person.initial = derivePersonInitial(nextName);
    }
  } else if (field.dataset.personField === "color") {
    person.color = safePersonColor(field.value, person.color);
  } else if (field.dataset.personField === "initial") {
    person.initial = field.value.trim().slice(0, 2).toUpperCase() || derivePersonInitial(person.name);
  } else {
    person[field.dataset.personField] = field.value.trim() || "Unnamed";
  }

  setStatus("Family updated");
  renderEditor();
}

function handlePersonEditorClick(event) {
  const remove = event.target.closest("[data-remove-person]");
  if (!remove) return;
  pullForm();
  const type = remove.dataset.personType;
  const id = remove.dataset.removePerson;
  if (personUsage(type, id)) return;
  if (type === "children") draft.family.children = draft.family.children.filter(person => person.id !== id);
  else {
    draft.family.payers = draft.family.payers.filter(person => person.id !== id);
    draft.expenses.forEach(expense => { delete expense.paidBy[id]; });
  }
  setStatus("Family updated");
  renderEditor();
}

function resetOneOffHelper() {
  if (!$("oneOffAmount")) return;
  $("oneOffAmount").value = "";
  $("oneOffMonths").value = "1";
  $("oneOffDate").value = new Date().toISOString().slice(0, 10);
  $("oneOffDescription").value = "";
  updateOneOffPreview();
}

function oneOffMonthlyAverage() {
  const amount = Number($("oneOffAmount").value || 0);
  const months = Number($("oneOffMonths").value || 0);
  return amount > 0 && months >= 1 ? roundMoney(amount / months) : 0;
}

function updateOneOffPreview() {
  if (!$("oneOffPreview")) return;
  const monthly = oneOffMonthlyAverage();
  $("oneOffPreview").textContent = monthly
    ? `This becomes ${money.format(monthly)} per month, with the full payment logged below.`
    : "Work out the monthly average and log the payment.";
}

function setMonthlyCostKeepingSplit(monthlyCost) {
  const inputs = [...document.querySelectorAll("#detailPayers [data-payer]")];
  const previousAmounts = inputs.map(input => Number(input.value || 0));
  const previousTotal = previousAmounts.reduce((n, value) => n + value, 0);
  $("detailMonthlyCost").value = monthlyCost.toFixed(2);
  inputs.forEach((input, index) => {
    const share = previousTotal ? previousAmounts[index] / previousTotal : (index === 0 ? 1 : 0);
    const amount = index === inputs.length - 1
      ? roundMoney(monthlyCost - inputs.slice(0, -1).reduce((n, other) => n + Number(other.value || 0), 0))
      : roundMoney(monthlyCost * share);
    input.value = amount.toFixed(2);
  });
}

function applyOneOffSpread() {
  const expense = selectedExpense();
  const amount = Number($("oneOffAmount").value || 0);
  const months = Number($("oneOffMonths").value || 0);
  const description = $("oneOffDescription").value.trim();
  const date = $("oneOffDate").value;
  const monthly = oneOffMonthlyAverage();
  if (!expense || !monthly || !date || !description || months < 1) {
    setStatus("Add an amount, months, date and description for the one-off payment.", true);
    return;
  }

  setMonthlyCostKeepingSplit(monthly);
  pullForm();
  if (!Array.isArray(expense.entries)) expense.entries = [];
  const duplicate = expense.entries.some(entry =>
    entry.date === date &&
    entry.description === description &&
    Number(entry.amount) === amount
  );
  if (!duplicate) expense.entries.push({ date, description, amount });
  setStatus(`${money.format(amount)} spread over ${months} month${months === 1 ? "" : "s"} and logged.`);
  renderEditor();
}

function updateSplitCheck() {
  const total = Number($("detailMonthlyCost").value || 0);
  const paid = [...document.querySelectorAll("#detailPayers [data-payer]")].reduce((n, input) => n + Number(input.value || 0), 0);
  const diff = Math.abs(total - paid);
  const ok = diff < 0.005;
  $("splitCheckText").textContent = ok
    ? `Balanced: ${money.format(paid)} allocated`
    : `Paid amounts should match monthly cost (${money.format(total - paid)} difference).`;
  $("splitCheckText").classList.toggle("error", !ok);
}
function setStatus(text, error = false) {
  const status = $("status");
  if (!status) return;
  status.textContent = text;
  status.classList.toggle("error", error);
  status.classList.toggle("is-idle", !error && text === "Ready");
}

async function save() {
  try {
    const jsonMode = Boolean($("jsonEditor"));
    const next = jsonMode ? validate(JSON.parse($("jsonEditor").value)) : (pullForm(), validate(draft));
    setStatus("Saving to GitHub…");
    $("saveExpenses").disabled = true;
    await persist(next);
    setStatus("Saved successfully");
    setTimeout(() => {
      if (isEditorPage) location.href = "/";
      else closeDrawer();
    }, 450);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    $("saveExpenses").disabled = false;
  }
}

function handleExpenseAction(event) {
  const toggle = event.target.closest("[data-toggle-entry]");
  if (toggle) {
    const detail = $(toggle.getAttribute("aria-controls")) || $(`entries-${toggle.dataset.toggleEntry}`);
    const opening = detail.hidden;
    detail.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    toggle.querySelector("span").textContent = opening ? "−" : "＋";
    return;
  }
  const add = event.target.closest("[data-add-entry]");
  if (add) return openEntryDialog(add.dataset.addEntry);
  const remove = event.target.closest(".entry-delete");
  if (remove) deleteEntry(Number(remove.dataset.expenseIndex), Number(remove.dataset.entryIndex));
}

function addNewExpense() {
  pullForm();
  draft.expenses.unshift({
    name: "New expense",
    emoji: "📌",
    children: [familyChildren(draft)[0]?.id].filter(Boolean),
    category: "Other",
    monthlyCost: 0,
    paidBy: Object.fromEntries(familyPayers(draft).map(payer => [payer.id, 0])),
    entries: []
  });
  activeEditorIndex = 0;
  $("expenseSearch").value = "";
  renderEditor();
  scrollExpenseDetailIntoView();
  $("detailName").focus();
}

function handleExpenseDetailEmptyClick(event) {
  if (event.target.closest("[data-add-expense]")) addNewExpense();
}

function handleExpensePick(event) {
  const item = event.target.closest("[data-index]");
  if (!item) return;
  pullForm();
  activeEditorIndex = Number(item.dataset.index);
  renderEditor();
  scrollExpenseDetailIntoView();
}

function closeExpenseDetail() {
  pullForm();
  activeEditorIndex = -1;
  renderEditor();
}

function handleExpenseDetailInput(event) {
  if (event.target.matches("input,select")) {
    pullForm();
    updateSplitCheck();
  }
  if (event.target.closest(".one-off-helper")) updateOneOffPreview();
}

function toggleEmojiPicker(button = $("detailEmojiButton")) {
  const popover = $("emojiPopover");
  const opening = popover.hidden || activeEmojiTarget?.button !== button;
  if (opening) {
    const field = button.closest(".emoji-field");
    if (field && popover.parentElement !== field) field.append(popover);
    activeEmojiTarget = {
      button,
      type: button.dataset.emojiTarget,
      index: button.dataset.categoryIndex ? Number(button.dataset.categoryIndex) : null
    };
  }
  popover.hidden = !opening;
  document.querySelectorAll("[data-emoji-target]").forEach(item => item.setAttribute("aria-expanded", String(opening && item === button)));
}

function handleEmojiPick(event) {
  const emoji = emojiFromPickerEvent(event);
  if (activeEmojiTarget?.type === "category") {
    const category = draft.categories[activeEmojiTarget.index];
    if (category) category.emoji = emoji || "📌";
    setStatus("Category updated");
    closeEmojiPicker();
    parkEmojiPicker();
    renderEditor();
    return;
  } else {
    setEmojiValue(emoji);
    pullForm();
  }
  renderEditor();
  closeEmojiPicker();
}

function handleDocumentClick(event) {
  if (!event.target.closest(".emoji-field")) closeEmojiPicker();
}

function handleChildToggle(event) {
  const button = event.target.closest("[data-child]");
  if (!button) return;
  const activeCount = document.querySelectorAll("#detailChildren [data-child].active").length;
  if (button.classList.contains("active") && activeCount === 1) return;
  button.classList.toggle("active");
  pullForm();
}

function handleSplitClick(event) {
  const even = event.target.closest("[data-split]");
  if (even) return applySplit(even.dataset.split);
  const payer = event.target.closest("[data-split-payer]");
  if (payer) return applySplit("payer", payer.dataset.splitPayer);
}

function removeSelectedExpense() {
  const expense = selectedExpense();
  if (!expense || !confirm(`Remove “${expense.name}”?`)) return;
  draft.expenses.splice(activeEditorIndex, 1);
  activeEditorIndex = -1;
  renderEditor();
}

function applySplit(split, payerId = "") {
  const total = Number($("detailMonthlyCost").value || 0);
  const inputs = [...document.querySelectorAll("#detailPayers [data-payer]")];
  if (split === "even") {
    inputs.forEach((input, index) => {
      const even = roundMoney(total / Math.max(inputs.length, 1));
      input.value = (index === inputs.length - 1 ? roundMoney(total - even * (inputs.length - 1)) : even).toFixed(2);
    });
  }
  if (split === "payer") {
    inputs.forEach(input => {
      input.value = input.dataset.payer === payerId ? total.toFixed(2) : "0.00";
    });
  }
  pullForm();
  updateSplitCheck();
}

function formatJsonEditor() {
  try {
    if (!$("jsonEditor")) return;
    $("jsonEditor").value = JSON.stringify(JSON.parse($("jsonEditor").value), null, 2);
    setStatus("JSON formatted");
  } catch {
    setStatus("JSON is invalid", true);
  }
}

function resetFilters() {
  $("childFilter").value = "All";
  $("categoryFilter").value = "All";
  render();
}

function bindEvents() {
  on("expenseRows", "click", handleExpenseAction);
  on("mobileExpenseRows", "click", handleExpenseAction);
  on("entryForm", "submit", addEntry);
  on("cancelEntry", "click", () => $("entryDialog").close());

  on("openEditor", "click", event => { event.preventDefault(); location.href = "/editor/expenses.html"; });
  on("mobileOpenEditor", "click", event => { event.preventDefault(); location.href = "/editor/expenses.html"; });
  on("closeEditor", "click", closeDrawer);
  on("cancelEditor", "click", closeDrawer);
  on("saveExpenses", "click", save);
  on("addExpense", "click", addNewExpense);
  on("expenseDetailEmpty", "click", handleExpenseDetailEmptyClick);
  on("expenseSearch", "input", renderEditor);
  on("expenseEditorList", "click", handleExpensePick);
  on("categoryEditorList", "input", handleCategoryEditorInput);
  on("categoryEditorList", "change", handleCategoryEditorChange);
  on("categoryEditorList", "click", handleCategoryEditorClick);
  on("addCategory", "click", addCategory);
  on("childEditorList", "change", handlePersonEditorChange);
  on("payerEditorList", "change", handlePersonEditorChange);
  on("childEditorList", "click", handlePersonEditorClick);
  on("payerEditorList", "click", handlePersonEditorClick);
  on("addChild", "click", () => addPerson("children"));
  on("addPayer", "click", () => addPerson("payers"));
  on("closeExpenseDetail", "click", closeExpenseDetail);
  on("expenseDetailForm", "input", handleExpenseDetailInput);
  on("applyOneOffSpread", "click", applyOneOffSpread);
  on("editorDrawer", "click", event => {
    const button = event.target.closest("[data-emoji-target]");
    if (button) toggleEmojiPicker(button);
  });
  on("emojiPicker", "emoji-click", handleEmojiPick);
  on("detailChildren", "click", handleChildToggle);
  on("removeSelectedExpense", "click", removeSelectedExpense);

  on("splitButtons", "click", handleSplitClick);
  document.querySelectorAll("[data-sort]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      tableSort = tableSort.key === key
        ? { key, direction: tableSort.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "monthly" ? "desc" : "asc" };
      render();
    });
  });

  on("formatJson", "click", formatJsonEditor);
  on("childFilter", "change", render);
  on("categoryFilter", "change", render);
  on("resetFilters", "click", resetFilters);
  on("printReport", "click", () => print());
  on("mobilePrintReport", "click", () => print());
  on("syncNow", "click", () => syncFromGitHub());

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && isEditorPage) closeDrawer(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshAfterPageResume(); });
  window.addEventListener("pageshow", event => { if (event.persisted) refreshAfterPageResume(); });
}

bindEvents();
hydrateSignedInUser();
load();
