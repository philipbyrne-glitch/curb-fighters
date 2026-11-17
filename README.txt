Curb Fighters — recorded audio correction

Exactly two new recorded announcements, taken from Archive SFX.zip:
- tools/voice-cues/wins.mp3
- tools/voice-cues/double_trouble.mp3

No other recordings are changed.

INSTALL
1. Copy the included .github and tools directories into the matching folders
   in your existing curb-fighters checkout. MERGE; do not replace entire folders.
2. Commit and push through GitHub Desktop.
3. On GitHub Actions, run "Install missing victory voice cues" on main.
4. The workflow adds the MP3s to assets/built, wires the announcement cues,
   builds index.html, syntax-checks the game, and commits the result to main.
5. Only after checking the prepared commit, manually run the existing
   "Publish Curb Fighters to GoDaddy" workflow.

Do not re-run the Mac pip installation. The workflow needs no external Python packages.
