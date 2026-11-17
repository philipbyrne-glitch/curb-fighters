# Curb Fighters

A two-player pixel-art browser game of "curbs" starring Phil, Kim, Rose and Shay, played on one device or against a CPU. It ships as one self-contained `index.html` served by GitHub Pages: artwork, music and fonts are embedded, so it needs no server and no network.

## How to think about it

`index.html` at the repo root is a build output. Edit `source/` and rebuild; a hand edit to the root file is silently overwritten by the next build.

Every sprite is pre-rendered by `tools/` at the size the game draws it, and the game scales with smoothing off. That is what keeps the whole world at one apparent pixel resolution. When you add or change art, render it in the asset scripts at its in-game size rather than drawing a large source image small at runtime.

A throw's outcome is judged once, at release (`Rules.judge` in `source/game.js`), then revealed only when the ball makes the contact that decides it. Never show a result early through text, sound, score or pose. A Double Trouble deliberately looks exactly like a normal 10-point hit until the ball reaches the thrower's own curb.

`docs/SPEC.md` is the original design brief followed by every decision taken since. Read it before changing rules, events, controls or the HUD, and add to its decisions list when you make a new one.

## Commands

`python3 tools/build.py` inlines `source/` and `assets/built/` into `index.html`; run it after any change. `python3 tools/prep_assets.py && python3 tools/prep_extra.py` regenerates `assets/built/` from `assets/original/`, and is only needed when artwork changes (install `tools/requirements.txt` first; ffmpeg is needed only if a track in `assets/built/` is missing). `python3 tools/smoke_test.py` plays a match in headless Chromium and fails on any script error; run it before pushing.
