const MAX_COLORS = 8;
const MIN_AREA = 24;
const PICKER_ROOT_ID = "__color_pipette_picker__";
const PICKER_TOAST_ID = "__color_pipette_toast__";

function rgbToHex(rgbString) {
  const matches = rgbString?.match(/\d+(\.\d+)?/g);
  if (!matches || matches.length < 3) {
    return null;
  }

  const [r, g, b, alpha = "1"] = matches.map(Number);
  if (alpha === 0) {
    return null;
  }

  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function hasVisibleColor(value) {
  const matches = value?.match(/\d+(\.\d+)?/g);
  if (!matches || matches.length < 3) {
    return false;
  }

  const alpha = matches.length >= 4 ? Number(matches[3]) : 1;
  return alpha > 0;
}

function isVisible(element, style) {
  if (!element || !style) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    rect.width >= MIN_AREA &&
    rect.height >= MIN_AREA &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    Number(style.opacity) > 0
  );
}

function addColor(store, value, role) {
  const hex = rgbToHex(value);
  if (!hex) {
    return;
  }

  const item = store.get(hex) ?? {
    hex,
    count: 0,
    roles: new Set()
  };

  item.count += 1;
  item.roles.add(role);
  store.set(hex, item);
}

function getDominantRole(roles) {
  if (roles.has("Background")) {
    return "Background";
  }

  if (roles.has("Text")) {
    return "Text";
  }

  if (roles.has("Border")) {
    return "Border";
  }

  return "Color";
}

function collectPageColors() {
  const store = new Map();
  const elements = Array.from(document.body?.querySelectorAll("*") ?? []);

  const bodyStyle = window.getComputedStyle(document.body);
  addColor(store, bodyStyle.backgroundColor, "Background");
  addColor(store, bodyStyle.color, "Text");

  elements.forEach((element) => {
    const style = window.getComputedStyle(element);

    if (!isVisible(element, style)) {
      return;
    }

    addColor(store, style.backgroundColor, "Background");
    addColor(store, style.color, "Text");
    addColor(store, style.borderTopColor, "Border");
    addColor(store, style.borderRightColor, "Border");
    addColor(store, style.borderBottomColor, "Border");
    addColor(store, style.borderLeftColor, "Border");
  });

  return Array.from(store.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, MAX_COLORS)
    .map((item) => ({
      hex: item.hex,
      count: item.count,
      role: getDominantRole(item.roles)
    }));
}

function removePickerOverlay() {
  document.getElementById(PICKER_ROOT_ID)?.remove();
  document.removeEventListener("click", handlePickerClick, true);
  document.removeEventListener("keydown", handlePickerEscape, true);
}

function showPickerToast(color) {
  document.getElementById(PICKER_TOAST_ID)?.remove();

  const toast = document.createElement("div");
  toast.id = PICKER_TOAST_ID;
  toast.style.position = "fixed";
  toast.style.top = "18px";
  toast.style.right = "18px";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "10px";
  toast.style.padding = "12px 14px";
  toast.style.borderRadius = "16px";
  toast.style.background = "rgba(17,20,23,0.92)";
  toast.style.color = "#fff8f2";
  toast.style.boxShadow = "0 18px 40px rgba(0,0,0,0.25)";
  toast.style.font = "600 13px/1.3 'Segoe UI', sans-serif";
  toast.style.letterSpacing = "0.01em";
  toast.style.zIndex = "2147483647";
  toast.innerHTML = `
    <span style="
      width:20px;
      height:20px;
      border-radius:999px;
      background:${color};
      border:1px solid rgba(255,255,255,0.28);
      flex:none;
    "></span>
    <span>Copied ${color}</span>
  `;

  document.documentElement.append(toast);
  window.setTimeout(() => toast.remove(), 1500);
}

function handlePickerEscape(event) {
  if (event.key === "Escape") {
    removePickerOverlay();
  }
}

function findColorFromElement(target) {
  let node = target;
  let fallbackTextColor = null;

  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const style = window.getComputedStyle(node);

    if (hasVisibleColor(style.backgroundColor)) {
      return rgbToHex(style.backgroundColor);
    }

    if (
      style.borderTopStyle !== "none" &&
      parseFloat(style.borderTopWidth) > 0 &&
      hasVisibleColor(style.borderTopColor)
    ) {
      return rgbToHex(style.borderTopColor);
    }

    if (!fallbackTextColor && hasVisibleColor(style.color)) {
      fallbackTextColor = rgbToHex(style.color);
    }

    node = node.parentElement;
  }

  return fallbackTextColor || "#000000";
}

function handlePickerClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const overlay = document.getElementById(PICKER_ROOT_ID);

  if (!overlay) {
    return;
  }

  overlay.style.visibility = "hidden";
  const targets = document.elementsFromPoint(event.clientX, event.clientY);
  overlay.style.visibility = "visible";

  const target = targets.find((element) => {
    return (
      element &&
      element.id !== PICKER_ROOT_ID &&
      element.id !== PICKER_TOAST_ID &&
      !overlay.contains(element)
    );
  });

  if (!target || target === document.documentElement || target === document.body) {
    return;
  }

  const color = findColorFromElement(target);
  navigator.clipboard.writeText(color).catch(() => {});
  removePickerOverlay();
  showPickerToast(color);
}

function startColorPicker() {
  removePickerOverlay();

  const overlay = document.createElement("div");
  overlay.id = PICKER_ROOT_ID;
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "2147483647";
  overlay.style.cursor = "crosshair";
  overlay.style.background = "rgba(17, 20, 23, 0.08)";
  overlay.style.backdropFilter = "grayscale(0.2)";
  overlay.innerHTML = `
    <div style="
      position:absolute;
      top:18px;
      right:18px;
      max-width:260px;
      padding:12px 14px;
      border-radius:16px;
      color:#fff8f2;
      background:rgba(17,20,23,0.88);
      box-shadow:0 18px 40px rgba(0,0,0,0.25);
      font:600 13px/1.4 'Segoe UI', sans-serif;
      letter-spacing:0.01em;
    ">
      Click any page element to copy its color. Press Esc to cancel.
    </div>
  `;

  document.documentElement.append(overlay);
  document.addEventListener("click", handlePickerClick, true);
  document.addEventListener("keydown", handlePickerEscape, true);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING_COLOR_PIPETTE") {
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "COLLECT_PAGE_COLORS") {
    if (!document.body) {
      sendResponse({ ok: false, error: "Page is still loading." });
      return true;
    }

    sendResponse({ ok: true, colors: collectPageColors() });
    return true;
  }

  if (message?.type === "START_COLOR_PICKER") {
    startColorPicker();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
