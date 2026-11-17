CURB FIGHTERS — WHEEL SPIN + FAMILY HORN

This patch is designed to apply to the existing GitHub Desktop repository AFTER the Phil/Kim family-car update. It modifies only anchored lines, so earlier fairness-balancing changes in source/game.js remain intact.

1. In GitHub Desktop: Repository > Show in Finder.
2. Unzip this archive. Copy its tools/ folder CONTENTS into the repository's existing tools/ folder. Do not replace the entire folder or delete existing files.
3. GitHub Desktop: Repository > Open in Terminal.
4. Run:
   python3 tools/apply_wheel_beep_update.py
   python3 tools/build.py
   node --check source/game.js
5. In GitHub Desktop: commit and push to main.
6. Manually run GitHub Actions > Publish Curb Fighters to GoDaddy, then test live.

What changes:
- Two alternating rim frames, every 110 ms, only for Phil's grey VW ID.3 and Kim's turquoise Qashqai.
- The generic traffic sprites remain identical.
- The uploaded 0.7-second beep.wav is included as sfx-family-beep.mp3, unchanged in amplitude by encoding; the game applies a 0.3 gain relative to the source, followed by the normal SFX master control.
- The sampled horn plays once per family-car pass near the center of the street, not on generic traffic.
- The original driving-eligibility logic is untouched.

No automatic GoDaddy deployment occurs on git push.
