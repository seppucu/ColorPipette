figma.showUI(__html__, { width: 420, height: 560 });

function hexToRgb(hex) {
  const normalized = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const value = normalized.toUpperCase();
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255
  };
}

function toPaint(rgb) {
  return {
    type: "SOLID",
    color: rgb
  };
}

function sanitizeStyleName(name, fallback) {
  const trimmed = String(name || "").trim();
  return trimmed || fallback;
}

function createOrUpdatePaintStyle(name, rgb, description) {
  const existing = figma.getLocalPaintStyles().find((style) => style.name === name);
  const style = existing || figma.createPaintStyle();
  style.name = name;
  style.paints = [toPaint(rgb)];

  if (typeof description === "string") {
    style.description = description;
  }

  return style;
}

function buildDescription(payload, color) {
  const lines = [];
  const page = payload && payload.page ? payload.page : null;

  if (page && page.title) {
    lines.push(`Source page: ${page.title}`);
  }

  if (page && page.url) {
    lines.push(page.url);
  }

  if (color.role) {
    lines.push(`Role: ${color.role}`);
  }

  if (typeof color.matches === "number") {
    lines.push(`Matches: ${color.matches}`);
  }

  return lines.join("\n");
}

async function createPaletteBoard(payload) {
  const colors = Array.isArray(payload.colors) ? payload.colors : [];
  const page = payload && payload.page ? payload.page : null;

  if (!colors.length) {
    throw new Error("No colors found in the imported JSON.");
  }

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  const frame = figma.createFrame();
  const title = page && page.title ? `Palette / ${page.title}` : "Palette / ColorPipette";
  const createdAt = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : "Unknown export time";

  frame.name = title;
  frame.layoutMode = "VERTICAL";
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisSizingMode = "AUTO";
  frame.itemSpacing = 16;
  frame.paddingTop = 24;
  frame.paddingRight = 24;
  frame.paddingBottom = 24;
  frame.paddingLeft = 24;
  frame.cornerRadius = 20;
  frame.fills = [{ type: "SOLID", color: { r: 0.9725, g: 0.9725, b: 0.9804 } }];
  frame.strokes = [{ type: "SOLID", color: { r: 0.8549, g: 0.8627, b: 0.902 } }];
  frame.strokeWeight = 1;

  const heading = figma.createText();
  heading.fontName = { family: "Inter", style: "Bold" };
  heading.fontSize = 24;
  heading.characters = title;
  frame.appendChild(heading);

  const meta = figma.createText();
  meta.fontName = { family: "Inter", style: "Regular" };
  meta.fontSize = 12;
  meta.fills = [{ type: "SOLID", color: { r: 0.3686, g: 0.3922, b: 0.4706 } }];
  meta.characters = `Imported from ColorPipette on ${createdAt}`;
  frame.appendChild(meta);

  colors.forEach((entry, index) => {
    const hex = String(entry.hex || "").toUpperCase();
    const rgb = hexToRgb(hex);

    if (!rgb) {
      return;
    }

    const styleName = sanitizeStyleName(entry.name, `ColorPipette/Color/${index + 1}`);
    const styleDescription = buildDescription(payload, entry);
    const paintStyle = createOrUpdatePaintStyle(styleName, rgb, styleDescription);

    const row = figma.createFrame();
    row.name = styleName;
    row.layoutMode = "HORIZONTAL";
    row.counterAxisSizingMode = "AUTO";
    row.primaryAxisSizingMode = "AUTO";
    row.itemSpacing = 14;
    row.paddingTop = 12;
    row.paddingRight = 12;
    row.paddingBottom = 12;
    row.paddingLeft = 12;
    row.cornerRadius = 16;
    row.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    row.strokes = [{ type: "SOLID", color: { r: 0.898, g: 0.9059, b: 0.9333 } }];
    row.strokeWeight = 1;

    const swatch = figma.createRectangle();
    swatch.name = `${styleName} swatch`;
    swatch.resize(72, 72);
    swatch.cornerRadius = 18;
    swatch.fillStyleId = paintStyle.id;

    const copy = figma.createFrame();
    copy.layoutMode = "VERTICAL";
    copy.counterAxisSizingMode = "AUTO";
    copy.primaryAxisSizingMode = "AUTO";
    copy.itemSpacing = 4;
    copy.fills = [];

    const nameText = figma.createText();
    nameText.fontName = { family: "Inter", style: "Medium" };
    nameText.fontSize = 14;
    nameText.characters = styleName;

    const hexText = figma.createText();
    hexText.fontName = { family: "Inter", style: "Bold" };
    hexText.fontSize = 16;
    hexText.characters = hex;

    const roleText = figma.createText();
    roleText.fontName = { family: "Inter", style: "Regular" };
    roleText.fontSize = 12;
    roleText.fills = [{ type: "SOLID", color: { r: 0.3686, g: 0.3922, b: 0.4706 } }];
    roleText.characters = `${entry.role || "Color"} - ${entry.matches || 0} matches`;

    copy.appendChild(nameText);
    copy.appendChild(hexText);
    copy.appendChild(roleText);

    row.appendChild(swatch);
    row.appendChild(copy);
    frame.appendChild(row);
  });

  if (frame.children.length <= 2) {
    frame.remove();
    throw new Error("The JSON was loaded, but none of the colors were valid hex values.");
  }

  figma.currentPage.appendChild(frame);

  const viewportCenter = figma.viewport.center;
  frame.x = viewportCenter.x - frame.width / 2;
  frame.y = viewportCenter.y - frame.height / 2;

  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  return frame;
}

figma.ui.onmessage = async (message) => {
  if (!message || message.type !== "IMPORT_COLORS") {
    return;
  }

  try {
    const payload = JSON.parse(message.payload);
    const frame = await createPaletteBoard(payload);

    figma.ui.postMessage({
      type: "IMPORT_RESULT",
      ok: true,
      message: `Imported ${payload.colors.length} colors into ${frame.name}.`
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "IMPORT_RESULT",
      ok: false,
      message: (error && error.message) || "Import failed."
    });
  }
};
