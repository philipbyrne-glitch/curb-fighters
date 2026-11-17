PINKY'S RACE POLISH — CURB FIGHTERS

Changes:
- Family car horn volume from 0.30 to 0.26 (about 13% quieter).
- Four distinct, runtime-cached mouth-open pixel frames based on the original
  character heads, used for each bite.
- Head stays at its original neck anchor; instead the ice cream moves up
  slightly on each chomp, eliminating the transparent neck gap.
- 1.2 seconds to read an instruction prompt; then a big 3–2–1 countdown.
- Three low starting-line beeps; NOM! and a longer high beep as the race starts.
- No changes to race fairness, score thresholds, or keyboard controls.

INSTALL:
1. Merge the ZIP's `tools` and `.github` folders into your existing cloned repo.
   Do NOT replace folders or delete other files.
2. Commit and Push origin using GitHub Desktop.
3. GitHub > Actions > 'Polish Pinky's ice cream race' > Run workflow (main).
4. Wait until green. This commits the finished game to main.
5. Check the new commit and then manually run 'Publish Curb Fighters to GoDaddy'.

No Python dependencies are required on your Mac. The workflow runs the
small standard-library patch script and builds the game on GitHub.
