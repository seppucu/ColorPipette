# ColorPipette Import for Figma

This plugin imports the palette JSON copied from the `Export to Figma` button in the Chrome extension.

## What it does

- creates local color styles in Figma
- creates a palette board with swatches and labels on the current page
- keeps source page metadata in the style description when available

## How to run it in Figma

1. Open Figma desktop app.
2. Go to `Plugins` -> `Development` -> `Import plugin from manifest...`.
3. Choose `figma-plugin/manifest.json` from this repo.
4. Run the plugin from `Plugins` -> `Development` -> `ColorPipette Import`.

## How to use it with the extension

1. Open the Chrome extension popup on any page.
2. Click `Export to Figma`.
3. Open the Figma plugin.
4. Paste the JSON into the plugin UI or use `Paste clipboard`.
5. Click `Import colors`.
