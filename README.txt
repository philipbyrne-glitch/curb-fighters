PINKY'S VAN — STREET SCENE SHADOW ONLY

Uses your uploaded six-point polygon (opacity 0.22, tint #21233b, no feathering).
The JSON metadata has been intentionally restricted to ice-cream-race.

IMPORTANT: The victory CELEBRATION scene ellipse is deliberately unchanged.
The patch targets the drawRaceScene() function only and asserts the separate
celebration ellipse is still present afterwards.

INSTALL
1. Unzip, then MERGE .github and tools into your cloned curb-fighters repo.
   Do not replace either existing folder.
2. Commit + Push origin in GitHub Desktop.
3. GitHub > Actions > "Apply Pinky's street shadow" > Run workflow (main).
4. Wait for green. This creates a new game commit and rebuilds index.html.
5. Run the separate "Publish Curb Fighters to GoDaddy" workflow to go live.

No Python packages required.
