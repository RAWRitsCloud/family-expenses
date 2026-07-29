const $ = id => document.getElementById(id);
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const signedOutUrl = () => `${location.origin}/auth/signed-out.html`;
const appLogoutUrl = () => `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(signedOutUrl())}`;
const debugAuth = new URLSearchParams(location.search).get("debugAuth") === "1";

function returnPath() {
  const fallback = "/";
  const value = new URLSearchParams(location.search).get("return") || fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function pageUrl(path) {
  const params = new URLSearchParams({ return: returnPath() });
  if (debugAuth) params.set("debugAuth", "1");
  return `${path}?${params}`;
}

function providerName(value) {
  return ({
    aad: "Microsoft",
    github: "GitHub"
  })[String(value || "").toLowerCase()] || value || "Unknown";
}

function providerIconSvg(value) {
  const key = String(value || "").toLowerCase();
  if (key === "github") {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.6-.2.6-.4v-1.5c-2.2.5-2.7-.9-2.7-.9-.4-.9-.9-1.1-.9-1.1-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.2-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8A7.5 7.5 0 0 1 8 4.1c.7 0 1.3.1 1.9.3 1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.2 0 3-1.8 3.7-3.6 3.9.3.3.5.7.5 1.5v2.1c0 .2.2.5.6.4A8 8 0 0 0 8 .2Z"/></svg>`;
  }

  if (key === "aad") {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="#f25022" d="M1 1h6.6v6.6H1z"/><path fill="#7fba00" d="M8.4 1H15v6.6H8.4z"/><path fill="#00a4ef" d="M1 8.4h6.6V15H1z"/><path fill="#ffb900" d="M8.4 8.4H15V15H8.4z"/></svg>`;
  }

  return `<span aria-hidden="true">●</span>`;
}

function familyRoles(principal) {
  return Array.isArray(principal?.userRoles) ? principal.userRoles : [];
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

async function readSettledPrincipal() {
  for (const delay of [0, 500, 1200, 2500]) {
    if (delay) await wait(delay);
    const principal = await readPrincipal();
    if (!principal || familyRoles(principal).includes("family")) return principal;
  }

  return readPrincipal();
}

function setDiagnosticTerm(label, value) {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  return [term, description];
}

function renderAccessDetails(principal) {
  const details = $("accessDetails");
  const summary = $("signedInSummary");
  if (details) details.replaceChildren();
  if (!principal) {
    if (summary) summary.textContent = "Debug mode · no active sign-in";
    if (details) setDiagnosticTerm("Signed in as", "No active sign-in in debug mode").forEach(node => details.append(node));
    return;
  }

  const roles = familyRoles(principal);
  const account = principal.userDetails || "Unknown account";
  const provider = providerName(principal.identityProvider);
  if (summary) {
    summary.innerHTML = "";
    summary.insertAdjacentHTML("beforeend", providerIconSvg(principal.identityProvider));
    summary.append(document.createTextNode(account));
  }

  if (!details) return;
  [
    ["Signed in as", account],
    ["Provider", provider],
    ["User ID", principal.userId || "Unknown"],
    ["Roles returned", roles.length ? roles.join(", ") : "No roles returned"]
  ].flatMap(([label, value]) => setDiagnosticTerm(label, value)).forEach(node => details.append(node));
}

function configureCommonLinks() {
  const redirect = encodeURIComponent(returnPath());
  if ($("githubLogin")) $("githubLogin").href = `/.auth/login/github?post_login_redirect_uri=${redirect}`;
  if ($("entraLogin")) $("entraLogin").href = `/.auth/login/aad?post_login_redirect_uri=${redirect}`;
  if ($("deniedLogout")) $("deniedLogout").href = appLogoutUrl();
  if ($("microsoftLogout")) $("microsoftLogout").href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(signedOutUrl())}`;
}

async function initialiseLoginPage() {
  const principal = await readSettledPrincipal();
  if (!principal) return;

  if (debugAuth) return;

  if (familyRoles(principal).includes("family")) {
    location.replace(returnPath());
    return;
  }

  location.replace(pageUrl("/auth/access-denied.html"));
}

async function initialiseAccessDeniedPage() {
  const principal = await readSettledPrincipal();
  if (!principal) {
    if (debugAuth) {
      renderAccessDetails(null);
      return;
    }
    location.replace(pageUrl("/auth/login.html"));
    return;
  }

  renderAccessDetails(principal);
  if (debugAuth) return;

  if (familyRoles(principal).includes("family")) {
    location.replace(returnPath());
    return;
  }

}

function bindEvents() {
  if ($("refreshAccess")) $("refreshAccess").addEventListener("click", () => initialiseAccessDeniedPage().catch(() => location.replace(pageUrl("/auth/login.html"))));
}

configureCommonLinks();
bindEvents();

const authPage = document.body.dataset.authPage;
if (authPage === "login") initialiseLoginPage().catch(() => {});
if (authPage === "access-denied") initialiseAccessDeniedPage().catch(() => location.replace(pageUrl("/auth/login.html")));
