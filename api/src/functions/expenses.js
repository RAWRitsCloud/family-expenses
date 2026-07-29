const { app } = require("@azure/functions");
const fs = require("fs/promises");
const path = require("path");

const REQUIRED_SETTINGS = [
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO"
];

function settings() {
  const missing = REQUIRED_SETTINGS.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing application settings: ${missing.join(", ")}`);
  }

  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || "main",
    path: process.env.GITHUB_DATA_PATH || "data/expenses.json"
  };
}

function githubSettings() {
  const missing = REQUIRED_SETTINGS.filter((name) => !process.env[name]);
  if (missing.length) return null;
  return settings();
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "child-expenses-static-web-app"
  };
}

function repositoryFileUrl(config) {
  const path = config.path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
}

const defaultCategories = [
  { name: "School", emoji: "🎒", color: "#2563eb" },
  { name: "Club", emoji: "⚜️", color: "#7c3aed" },
  { name: "Health", emoji: "👓", color: "#0891b2" },
  { name: "Phone", emoji: "📱", color: "#f59e0b" },
  { name: "Other", emoji: "📌", color: "#e11d48" }
];

const palette = ["#2563eb", "#7c3aed", "#0891b2", "#10b981", "#f59e0b", "#e11d48"];

const categoryKey = (name) => String(name || "").trim().toLowerCase();
const defaultCategoryFor = (name) => defaultCategories.find((category) => categoryKey(category.name) === categoryKey(name));
const safeCategoryColor = (color, index, name) => {
  const value = String(color || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  return defaultCategoryFor(name)?.color || palette[index % palette.length];
};
const safePersonColor = (color, index) => {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : palette[index % palette.length];
};
const expenseEmojiForCategory = (name, expenses) => {
  const match = [...expenses]
    .filter((expense) => categoryKey(expense.category) === categoryKey(name) && expense.emoji)
    .sort((a, b) => Number(b.monthlyCost || 0) - Number(a.monthlyCost || 0))[0];
  return match?.emoji || defaultCategoryFor(name)?.emoji || "📌";
};

function normaliseCategories(value) {
  const seen = new Set();
  const categories = [];
  const expenses = Array.isArray(value.expenses) ? value.expenses : [];
  const add = (category, { override = false } = {}) => {
    const name = String(category?.name || category || "").trim();
    const key = categoryKey(name);
    if (!key) return;
    if (seen.has(key)) {
      if (override && category && typeof category === "object") {
        const existing = categories.find((item) => categoryKey(item.name) === key);
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

  const hasManagedCategories = Array.isArray(value.categories);
  if (!hasManagedCategories) defaultCategories.forEach(add);
  else value.categories.forEach((category) => add(category, { override: true }));
  expenses.map((expense) => expense.category).forEach(add);
  value.categories = categories;
}

function validatePeople(people, label) {
  if (!Array.isArray(people) || !people.length) {
    throw new Error(`Family ${label} must be a non-empty array.`);
  }

  const seen = new Set();
  people.forEach((person, index) => {
    if (typeof person.id !== "string" || !person.id.trim()) throw new Error(`${label} ${index + 1}: id must be non-empty text.`);
    if (typeof person.name !== "string" || !person.name.trim()) throw new Error(`${label} ${index + 1}: name must be non-empty text.`);
    person.id = person.id.trim();
    const key = categoryKey(person.id);
    if (seen.has(key)) throw new Error(`${label} ${index + 1}: id must be unique.`);
    seen.add(key);
    person.name = person.name.trim();
    person.initial = String(person.initial || person.name[0] || "?").trim().slice(0, 2);
    person.color = safePersonColor(person.color, index);
  });
}

function getClientPrincipal(request) {
  const encoded = request.headers.get("x-ms-client-principal");
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function authoriseFamily(request) {
  const principal = getClientPrincipal(request);
  if (!principal) return { status: 401, jsonBody: { error: "Authentication required." } };
  const roles = Array.isArray(principal.userRoles) ? principal.userRoles : [];
  if (!roles.includes("family")) return { status: 403, jsonBody: { error: "Family role required." } };
  return null;
}

function validatePayload(value) {
  if (!value || !Array.isArray(value.expenses)) {
    throw new Error('JSON must contain an "expenses" array.');
  }

  if (!value.family || typeof value.family !== "object") {
    throw new Error('JSON must contain a "family" object.');
  }
  validatePeople(value.family.children, "children");
  validatePeople(value.family.payers, "payers");
  const childIds = new Set(value.family.children.map((child) => child.id));
  const payerIds = new Set(value.family.payers.map((payer) => payer.id));

  normaliseCategories(value);
  value.categories.forEach((category, index) => {
    if (typeof category.name !== "string" || !category.name.trim()) {
      throw new Error(`Category ${index + 1}: name must be non-empty text.`);
    }
    category.name = category.name.trim();
    category.emoji = String(category.emoji || "📌").trim() || "📌";
    category.color = safeCategoryColor(category.color, index, category.name);
  });

  value.expenses.forEach((expense, index) => {
    if ("james" in expense || "donal" in expense) {
      throw new Error(`Expense ${index + 1}: use paidBy instead of james/donal fields.`);
    }
    for (const key of ["name", "category"]) {
      if (typeof expense[key] !== "string" || !expense[key].trim()) {
        throw new Error(`Expense ${index + 1}: ${key} must be non-empty text.`);
      }
    }

    if (!Array.isArray(expense.children) || !expense.children.length) {
      throw new Error(`Expense ${index + 1}: children must be supplied.`);
    }

    const children = expense.children
      .map((child) => String(child || "").trim())
      .filter(Boolean);
    if (!children.length) throw new Error(`Expense ${index + 1}: children must include at least one child.`);
    expense.children = [...new Set(children)];
    expense.children.forEach((child) => {
      if (!childIds.has(child)) throw new Error(`Expense ${index + 1}: child "${child}" is not in family.children.`);
    });

    if (expense.emoji !== undefined && typeof expense.emoji !== "string") {
      throw new Error(`Expense ${index + 1}: emoji must be text.`);
    }

    if (typeof expense.monthlyCost !== "number" || !Number.isFinite(expense.monthlyCost) || expense.monthlyCost < 0) {
      throw new Error(`Expense ${index + 1}: monthlyCost must be zero or a positive number.`);
    }
    if (!expense.paidBy || typeof expense.paidBy !== "object" || Array.isArray(expense.paidBy)) {
      throw new Error(`Expense ${index + 1}: paidBy must be supplied.`);
    }
    for (const payerId of Object.keys(expense.paidBy)) {
      if (!payerIds.has(payerId)) throw new Error(`Expense ${index + 1}: payer "${payerId}" is not in family.payers.`);
    }
    value.family.payers.forEach((payer) => {
      const amount = Number(expense.paidBy[payer.id] || 0);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Expense ${index + 1}: paidBy.${payer.id} must be zero or a positive number.`);
      }
      expense.paidBy[payer.id] = amount;
    });

    if (!Array.isArray(expense.entries)) expense.entries = [];
    expense.entries.forEach((entry, entryIndex) => {
      if (typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        throw new Error(`Expense ${index + 1}, entry ${entryIndex + 1}: date must be YYYY-MM-DD.`);
      }
      if (typeof entry.description !== "string" || !entry.description.trim()) {
        throw new Error(`Expense ${index + 1}, entry ${entryIndex + 1}: description must be non-empty text.`);
      }
      if (typeof entry.amount !== "number" || !Number.isFinite(entry.amount) || entry.amount < 0) {
        throw new Error(`Expense ${index + 1}, entry ${entryIndex + 1}: amount must be zero or positive.`);
      }
    });
  });
}

async function readGitHubFile(config) {
  const response = await fetch(`${repositoryFileUrl(config)}?ref=${encodeURIComponent(config.branch)}`, {
    headers: githubHeaders(config.token)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub read failed (${response.status}): ${text}`);
  }

  const file = await response.json();
  const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { data: JSON.parse(content), sha: file.sha };
}

async function readLocalDemoFile() {
  const configuredPath = process.env.DEMO_DATA_PATH;
  const candidates = [
    configuredPath,
    path.resolve(process.cwd(), "data/expenses.json"),
    path.resolve(process.cwd(), "../data/expenses.json"),
    path.resolve(__dirname, "../../../data/expenses.json"),
    path.resolve(__dirname, "../../../../data/expenses.json")
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, "utf8"));
    } catch {}
  }

  throw new Error("Demo data file was not available to the API. The static bundled data route can still be used.");
}

app.http("expenses", {
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  route: "expenses",
  handler: async (request, context) => {
    try {
      const config = githubSettings();
      if (config) {
        const authError = authoriseFamily(request);
        if (authError) return authError;
      }

      if (request.method === "GET") {
        if (!config) {
          const localData = await readLocalDemoFile();
          validatePayload(localData);
          return {
            status: 200,
            jsonBody: localData,
            headers: {
              "Cache-Control": "no-store",
              "X-Expenses-Mode": "local"
            }
          };
        }

        const current = await readGitHubFile(config);
        validatePayload(current.data);
        return {
          status: 200,
          jsonBody: current.data,
          headers: { "Cache-Control": "no-store" }
        };
      }

      const nextData = await request.json();
      validatePayload(nextData);
      if (!config) {
        context.log("Accepted demo expense save without GitHub persistence.");
        return {
          status: 200,
          jsonBody: {
            saved: false,
            mode: "local",
            message: "Demo changes saved for this session."
          },
          headers: {
            "Cache-Control": "no-store",
            "X-Expenses-Mode": "local"
          }
        };
      }

      const current = await readGitHubFile(config);
      const body = {
        message: `Update child expenses (${new Date().toISOString()})`,
        content: Buffer.from(`${JSON.stringify(nextData, null, 2)}\n`, "utf8").toString("base64"),
        sha: current.sha,
        branch: config.branch
      };

      const response = await fetch(repositoryFileUrl(config), {
        method: "PUT",
        headers: {
          ...githubHeaders(config.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        const message = response.status === 409
          ? "The expense file changed while you were editing. Refresh and try again."
          : `GitHub save failed (${response.status}): ${text}`;
        return { status: response.status === 409 ? 409 : 502, jsonBody: { error: message } };
      }

      const result = await response.json();
      context.log(`Saved ${config.path} at commit ${result.commit?.sha || "unknown"}`);
      return {
        status: 200,
        jsonBody: { saved: true, commit: result.commit?.sha || null },
        headers: { "Cache-Control": "no-store" }
      };
    } catch (error) {
      context.error(error);
      const status = error instanceof SyntaxError ? 400 : 500;
      return { status, jsonBody: { error: error.message || "Unexpected server error." } };
    }
  }
});
