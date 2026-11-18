CURB FIGHTERS — SECOND EDITION (index2.html)

Creates a second edition of Curb Fighters with:
- Phil, Shay and Rose in character selection (three-way carousel)
- Kim excluded from CPU matchmaking
- Kim excluded from the victory/celebration crowd
- Kim's Qashqai STILL in passing traffic, as explicitly requested
- Existing original index.html UNCHANGED

The source code remains shared: each time the new workflow runs, it builds
index2.html from the latest source/game.js and the existing assets, modifying
the second edition in memory only. Future game fixes carry across automatically
whenever you republish the second edition.

HOW TO INSTALL AND PUBLISH
1. Unzip. MERGE tools and .github with your existing cloned repository.
   Do NOT replace the directories.
2. Commit + Push origin in GitHub Desktop.
3. GitHub Actions > "Build and publish Curb Fighters index2" > Run workflow.
4. After green, visit:
   https://customereducation.expert/curbs/curb-fighters/index2.html

Note: The normal "Publish Curb Fighters to GoDaddy" action only publishes
index.html. This new workflow independently publishes index2.html, without
touching index.html.

The second edition shares sounds, graphics, mechanics and Pinky's sequence.
