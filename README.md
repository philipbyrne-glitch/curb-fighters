# Curb Fighters

The Cloudflare Pages site loads directly from the repository. Edit [index.html](index.html) for screen markup, [source/style.css](source/style.css) for styling and title animation, [source/game.js](source/game.js) for gameplay, and [source/assets.js](source/assets.js) for the artwork and audio file mappings.

Run `python3 -m http.server 8765` at the repository root and open <http://127.0.0.1:8765/>. With Playwright and Chromium installed, run `python3 tools/smoke_test.py` in another terminal to play a short match and Pinky’s race.

Run `python3 tools/build.py` to export an optional standalone copy to `dist/index.html`.
