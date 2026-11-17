CURB FIGHTERS — FAIRNESS UPDATE

Adds:
1. Halfway 5-point sweet spots shrink by 15% of their original width after each successful 5-point shot in an uninterrupted turn (minimum 40% of original). Both power and aim zones shrink, plus yellow fringes. The first 5-point shot after a 10-point hit is unchanged; a miss or new curb hit resets the penalty. The CPU is affected too.
2. If Pinky's arrives with one player leading by 20+ points, the leader's bites count for 0.7 units versus 1.0 for the other player. Determined when Pinky arrives, including post-match visits and CPU games.

APPLY (Mac)
1. Unzip this file.
2. In GitHub Desktop: Repository > Show in Finder.
3. Copy this ZIP's tools/apply_balance_update.py into your repo's tools folder.
4. In GitHub Desktop: Repository > Open in Terminal.
5. Run: python3 tools/apply_balance_update.py
6. GitHub Desktop should show modifications to source/game.js and docs/SPEC.md, and the new script file.
7. Commit as "Add halfway streak and Pinky catch-up balancing" and Push origin.
8. Run the GoDaddy publish workflow manually in GitHub Actions. Don't delete your existing game folders.

The script patches the current game source in place and leaves the car artwork, asset atlases, and existing GoDaddy workflow unchanged. It intentionally refuses to run twice.
