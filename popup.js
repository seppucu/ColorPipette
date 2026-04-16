const figmaExportButton = document.getElementById("figmaExportButton");
const pickerButton = document.getElementById("pickerButton");
const palette = document.getElementById("palette");
const paletteCount = document.getElementById("paletteCount");
const statusText = document.getElementById("statusText");
const toast = document.getElementById("toast");
const cardTemplate = document.getElementById("colorCardTemplate");

let toastTimeoutId = null;
let latestColors = [];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(message) {
  statusText.textContent = message;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 1600);
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
  showToast(`Copied ${value}`);
}

function renderEmptyState(message) {
  latestColors = [];
  palette.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  palette.append(empty);
  paletteCount.textContent = "0 colors";
}

function renderPalette(colors) {
  latestColors = colors;
  palette.replaceChildren();
  paletteCount.textContent = `${colors.length} ${colors.length === 1 ? "color" : "colors"}`;

  if (!colors.length) {
    renderEmptyState("No colors were found on this page.");
    return;
  }

  colors.forEach((entry, index) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".color-card");
    const swatch = fragment.querySelector(".swatch");
    const hex = fragment.querySelector(".color-hex");
    const role = fragment.querySelector(".color-role");

    swatch.style.background = entry.hex;
    hex.textContent = entry.hex;
    role.textContent = `${entry.role} - ${entry.count} matches`;
    button.style.animationDelay = `${index * 45}ms`;
    button.addEventListener("click", async () => {
      try {
        await copyText(entry.hex);
      } catch (error) {
        setStatus("Clipboard access is unavailable in this popup.");
      }
    });

    palette.append(fragment);
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

function buildFigmaExport(colors, tab) {
  return JSON.stringify(
    {
      version: 1,
      source: "ColorPipette Chrome Extension",
      collection: "ColorPipette",
      exportedAt: new Date().toISOString(),
      page: {
        title: tab?.title ?? "Current page",
        url: tab?.url ?? ""
      },
      colors: colors.map((entry, index) => ({
        name: `ColorPipette/${entry.role}/${index + 1}`,
        hex: entry.hex,
        role: entry.role,
        matches: entry.count
      }))
    },
    null,
    2
  );
}

async function scanPage() {
  const tab = await getActiveTab();

  if (!tab?.id) {
    setStatus("Unable to access the current tab.");
    renderEmptyState("Open any webpage and try again.");
    return;
  }

  setStatus("Scanning page colors...");
  const response = await sendRuntimeMessage({ type: "GET_PAGE_COLORS", tabId: tab.id });

  if (!response?.ok) {
    setStatus("This page could not be analyzed.");
    renderEmptyState(response?.error ?? "Try reloading the page or opening a standard website.");
    return;
  }

  renderPalette(response.colors);
  setStatus(`Found ${response.colors.length} key colors on this page.`);
}

async function exportToFigma() {
  const tab = await getActiveTab();

  if (!latestColors.length) {
    await scanPage();
  }

  if (!latestColors.length) {
    setStatus("No colors available to export yet.");
    return;
  }

  try {
    const exportPayload = buildFigmaExport(latestColors, tab);
    await navigator.clipboard.writeText(exportPayload);
    showToast("Figma JSON copied");
    setStatus("Figma export copied as JSON. Paste it into your Figma plugin or workflow.");
  } catch (error) {
    setStatus("Clipboard access is unavailable in this popup.");
  }
}

async function startColorPicker() {
  const tab = await getActiveTab();

  if (!tab?.id) {
    setStatus("Unable to access the current tab.");
    return;
  }

  const response = await sendRuntimeMessage({ type: "OPEN_COLOR_PICKER", tabId: tab.id });

  if (!response?.ok) {
    setStatus(response?.error ?? "Color picker could not start on this page.");
    return;
  }

  setStatus("Color picker is active on the page. Click any visible element.");
  window.close();
}

figmaExportButton.addEventListener("click", () => {
  exportToFigma().catch(() => {
    setStatus("Could not prepare the Figma export.");
  });
});
pickerButton.addEventListener("click", startColorPicker);

renderEmptyState("Palette will appear here automatically after scanning the current page.");
scanPage().catch(() => {
  setStatus("The current tab is not ready yet.");
});
