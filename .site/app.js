const els = {
  sourceSummary: document.getElementById("sourceSummary"),
  sourceList: document.getElementById("sourceList"),
  emptyState: document.getElementById("emptyState"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleText: document.getElementById("themeToggleText"),
};

const themeKey = "suricata-rule-index-theme";
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

initTheme();
init();

function initTheme() {
  syncThemeToggle();

  els.themeToggle.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(themeKey, nextTheme);
    applyTheme(nextTheme);
  });

  systemTheme.addEventListener("change", () => {
    if (!localStorage.getItem(themeKey)) {
      applyTheme(systemTheme.matches ? "dark" : "light");
    }
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  syncThemeToggle();
}

function currentTheme() {
  return document.documentElement.dataset.theme || "light";
}

function syncThemeToggle() {
  const nextLabel = currentTheme() === "dark" ? "Light" : "Dark";
  els.themeToggleText.textContent = nextLabel;
  els.themeToggle.setAttribute("aria-label", `Switch to ${nextLabel.toLowerCase()} mode`);
}

async function init() {
  try {
    const response = await fetch("index.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const sources = normalizeSources(data.sources ?? {}).filter((source) => !source.excluded);
    renderSources(sources);
    els.sourceSummary.textContent = `${sources.length} active rulesets indexed`;
  } catch (error) {
    renderError(error);
  }
}

function normalizeSources(rawSources) {
  return Object.entries(rawSources).map(([id, source]) => {
    const publisher = source.vendor || "Unknown";
    const title = normalizeText(source.summary || id);
    const description = normalizeText(source.description || "");
    const homepage = source.homepage || "";
    const subscribeUrl = source["subscribe-url"] || "";
    const feedUrl = source.url || "";
    const placeholders = Array.from(feedUrl.matchAll(/%\(([^)]+)\)s/g), (match) => match[1]);
    const requiresSubscription = Boolean(source.parameters && Object.keys(source.parameters).length) ||
      placeholders.some((name) => name !== "__version__");

    return {
      id,
      title,
      publisher,
      description,
      homepage,
      subscribeUrl,
      requiresSubscription,
      excluded: Boolean(source.deprecated || source.obsolete),
    };
  }).sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

function normalizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function renderSources(sources) {
  els.emptyState.hidden = sources.length !== 0;

  if (!sources.length) {
    els.sourceList.innerHTML = "";
    return;
  }

  els.sourceList.innerHTML = sources.map((source) => `
    <article class="source-card">
      <div class="source-main">
        <div class="source-kicker">
          <code class="source-id">${escapeHtml(source.id)}</code>
          ${source.requiresSubscription ? '<span class="auth-pill">Subscription required</span>' : ""}
        </div>
        <h3>${escapeHtml(source.title)}</h3>
        <p class="ruleset-description">${escapeHtml(source.description || "No additional summary provided.")}</p>
      </div>
      <dl class="source-meta">
        <div>
          <dt>Publisher</dt>
          <dd>${escapeHtml(source.publisher)}</dd>
        </div>
        ${renderHomepage(source.homepage)}
        ${source.requiresSubscription ? renderSubscribe(source.subscribeUrl) : ""}
      </dl>
    </article>
  `).join("");
}

function renderHomepage(homepage) {
  if (!homepage) {
    return "";
  }

  return `
    <div>
      <dt>Home page</dt>
      <dd><a class="source-link" href="${escapeAttr(homepage)}" target="_blank" rel="noopener noreferrer">Home page</a></dd>
    </div>
  `;
}

function renderSubscribe(subscribeUrl) {
  const value = subscribeUrl
    ? `<a class="source-link" href="${escapeAttr(subscribeUrl)}" target="_blank" rel="noopener noreferrer">Subscribe</a>`
    : '<span class="not-listed">Required, URL not listed</span>';

  return `
    <div>
      <dt>Subscribe</dt>
      <dd class="link-stack">${value}</dd>
    </div>
  `;
}

function renderError(error) {
  els.sourceSummary.textContent = "Index data unavailable";
  els.sourceList.innerHTML = `
    <article class="source-card loading-card">Could not load index.json: ${escapeHtml(error.message)}</article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
