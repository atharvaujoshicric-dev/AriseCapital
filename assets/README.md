# Assets Folder

Drop your real image files here and the app will automatically use them
instead of the generated fallbacks — no code changes needed.

| File to add | Used for | If missing |
|---|---|---|
| `logo.png` | ARISE CAPITAL logo — header, watermark, big blank-space watermark in the inventory screen | Falls back to a generated vector approximation (gold triangle + "ARISE / CAPITAL" wordmark) |
| `truston.png` | TRUSTON partner logo in the booking form footer | Hidden (footer just shows the Sales Office text) |
| `beyondwalls.png` | BeyondWalls partner logo in the booking form footer | Hidden |

**Recommended formats:**
- `logo.png` — transparent background PNG or SVG, roughly square or slightly taller than wide (it's used at several sizes, from a small header mark to a large centered watermark)
- `truston.png` / `beyondwalls.png` — transparent background PNG, short and wide (used at ~30px tall in the footer)

You do **not** need to add a QR code file — the MahaRERA QR code is generated live in the browser from the RERA number in `js/config.js`, so it's always accurate and doesn't need an image.

After adding files here, just refresh the page (or re-deploy if hosted) — both the booking form and the main app UI will pick them up automatically.
