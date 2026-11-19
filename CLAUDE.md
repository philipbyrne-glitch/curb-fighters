# Curb Fighters

A two-player pixel-art browser game of "curbs" starring Phil, Kim, Rose and Shay, played on one device or against a CPU. Cloudflare Pages serves the repository as a static site.

## How to think about it

Edit the root `index.html` for markup, `source/style.css` for styling, and `source/game.js` for gameplay. `source/assets.js` maps the runtime asset names to files in `assets/built/`. The static site uses these files directly.

Every sprite is pre-rendered by `tools/` at the size the game draws it, and the game scales with smoothing off. That is what keeps the whole world at one apparent pixel resolution. When you add or change art, render it in the asset scripts at its in-game size rather than drawing a large source image small at runtime.

A throw's outcome is judged once, at release (`Rules.judge` in `source/game.js`), then revealed only when the ball makes the contact that decides it. Never show a result early through text, sound, score or pose. A Double Trouble deliberately looks exactly like a normal 10-point hit until the ball reaches the thrower's own curb.

`docs/SPEC.md` is the original design brief followed by every decision taken since. Read it before changing rules, events, controls or the HUD, and add to its decisions list when you make a new one.

## Commands

`python3 -m http.server 8765` serves the game locally from the repository root. In another terminal, `python3 tools/smoke_test.py` plays a match in headless Chromium. It also accepts a URL for testing a different server or standalone copy.

`python3 tools/build.py` exports a standalone copy to `dist/index.html` for offline play and the manual GoDaddy workflow. It accepts an optional output path.

`python3 tools/prep_assets.py && python3 tools/prep_extra.py` regenerates `assets/built/` from `assets/original/` when the artwork changes. Install `tools/requirements.txt` first. FFmpeg is required if an MP3 needs to be generated.
