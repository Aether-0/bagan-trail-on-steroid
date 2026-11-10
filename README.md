<p align="center">
  <img src="assets/logo.svg" alt="Bagan-Trail on Steroid — Made with love by Aether" width="420">
</p>

<h1 align="center">Bagan-Trail on Steroid</h1>

<p align="center">A draggable Chrome control panel for the BaganTrail horse ride.</p>

This unpacked Manifest V3 extension adds adjustable speed, gallop, stamina, flight, and wall-pass controls to the BaganTrail play page. It is made with love by Aether.

## Features

- Set a target horse speed from normal game pace up to 100 m/s.
- Force gallop and keep stamina full.
- Fly and adjust the flight height.
- Pass through walls while mounted.
- Drag the panel anywhere on screen, collapse it, or use `Alt+M` to hide and show it.
- Use **Stop boost and land** to return to normal pace and turn off gallop, flight, and wall pass.

## Install in Chrome

1. Download this repository with **Code → Download ZIP**, or clone it:

   ```sh
   git clone https://github.com/Aether-0/bagan-trail-on-steroid.git
   ```

2. Extract the ZIP if needed.
3. Open `chrome://extensions` in Chrome or Chromium.
4. Turn on **Developer mode**.
5. Choose **Load unpacked** and select the repository folder containing `manifest.json`.
6. Open the game: <https://bagantrail.com/play>
7. Click the **Bagan-Trail on Steroid** extension icon and choose **Enable and reload**.
8. After the page reloads, start a horse ride. The control panel appears in the top-right corner.

Chrome may show a permission notice for `debugger`. The extension needs that permission to intercept and patch the game bundle in the selected tab. Chrome’s toolbar icon is registered separately from the SVG logo because manifest icons need raster image files. See [Chrome extension icons](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons) and the [`chrome.debugger` API](https://developer.chrome.com/docs/extensions/reference/api/debugger).

## Controls

| Control | What it does |
| --- | --- |
| **Target speed** | Sets the horse’s target speed. `0` returns to normal game pace; the slider maximum is `100 m/s`. The display also shows km/h. |
| **Gallop** | Keeps gallop requested while enabled. |
| **Full stamina** | Restores stamina and prevents stamina drain while enabled. |
| **Fly** | Enables flight. The height slider appears while flight is on and ranges from 2 to 100 m. |
| **Pass walls** | Skips the game’s movement collision handling while mounted. Turn it off to restore normal collisions. |
| **Stop boost and land** | Resets target speed to normal pace, disables gallop, flight, and wall pass, and asks the horse to stop. The full-stamina setting is left as selected. |
| **Drag the header** | Moves the panel. It stays within the visible browser window. |
| **Alt+M** | Collapses or expands the panel. |

Very high speeds can make steering difficult. Set the speed slider to `0` or use **Stop boost and land** to regain control.

## Disable or remove

- To turn off the mod for the current tab, open the extension popup and choose **Disable and restore**. This detaches the debugger and reloads the page without the patch.
- To remove the extension, first disable it, then open `chrome://extensions` and choose **Remove**.

## Update

After downloading newer files or pulling changes, open `chrome://extensions` and click **Reload** on this extension. Then return to the game and choose **Enable and reload** again. Enabling reloads the game tab.

## Troubleshooting

### The control panel does not appear

- Confirm the address starts with `https://bagantrail.com/play`.
- Open the extension popup and confirm it is enabled for that tab.
- Start a ride; the menu reports when it detects the horse.
- If the panel was hidden, press `Alt+M` or click **Show** in its header.

### The popup says it is waiting for the game bundle hook

The patcher relies on names and code patterns in BaganTrail’s current JavaScript bundle. If the game changes its bundle structure, the hook may stop matching. Reload the extension and game once; if the message remains, the patcher needs an update for the new bundle.

### The toolbar still shows Chrome’s generic icon

Reload the extension from `chrome://extensions`. The manifest now includes the toolbar and management-page icon files. If you edited the assets yourself, reload the extension again so Chrome refreshes them.

### Wall pass still collides

Make sure the extension was reloaded after updating and turn **Pass walls** on while mounted. The patch bypasses the current movement collision path; a future game bundle change may require updating the patcher.

## Permissions and privacy

The extension declares these permissions:

- `debugger` — intercepts and rewrites the game bundle response in the selected tab.
- `scripting` — registers the in-game menu content script while the mod is enabled.
- `storage` — remembers which tab currently has the mod enabled for this browser session.
- `activeTab` and the `https://bagantrail.com/*` host permission — allow the popup and extension to operate on the game page.

The extension has no analytics or third-party service integration. Its enabled-tab state is kept in `chrome.storage.session`. The modified game bundle is applied in the browser; this repository does not include or redistribute BaganTrail’s game files.

## Project files

```text
assets/
  brand-mark.svg          Horse mark used in the in-game menu
  logo.svg                Full SVG logo shown above
  icons/                  Menu SVG controls and PNG Chrome extension icons
manifest.json             Extension metadata and permissions
service-worker.js         Tab attachment and game-bundle interception
patcher.js                Game-bundle hooks for movement and horse controls
menu.js                   In-game control panel behavior
menu.css                  In-game control panel styling
popup.html / popup.css    Extension popup
popup.js                  Enable/disable controls
```

There is no build step or package installation. Load the repository folder directly as an unpacked extension.

## Contributing

Contributions are welcome. Open an issue to report a bug or suggest an improvement, or submit a pull request with a clear description of the change. Please keep pull requests focused and include steps to reproduce or verify behavior when relevant.

By contributing, you agree that your contributions are licensed under the MIT License in this repository.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.
