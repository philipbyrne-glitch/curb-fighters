CURB FIGHTERS — SHAY & KIM MOUTH POSITION TUNE

This update changes only the mouth Y coordinate array:
   BEFORE: [39, 34, 41, 40]
   AFTER:  [39, 29, 41, 30]
Avatar sprite order: Phil, Shay, Rose, Kim.

Phil and Rose remain completely unchanged.
Shay moves 5 source pixels up.
Kim moves 10 source pixels up.

No changes to X positions, mouth widths/heights, the neck seam, shadows,
hidden pinkys shortcut, sound, animation timing, or gameplay.

INSTALL
1. Unzip and MERGE (do not replace) the tools and .github folders into
   your existing repository.
2. Commit and Push origin in GitHub Desktop.
3. Run GitHub Actions > "Tune Shay and Kim eating mouths" on main.
4. After green, run "Publish Curb Fighters to GoDaddy" separately.

The workflow refuses to overwrite different/newer mouth coordinates.
