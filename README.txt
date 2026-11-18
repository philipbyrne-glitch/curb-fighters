PINKY'S ISOMETRIC SHADOW — ACTUAL GAMEPLAY VAN

Uses the exact five-vertex shadow exported from the isometric Sprite Lab.
Vertices are in source pixels relative to the van's ground anchor (123,205).
No ad hoc projection or guessing: the game simply multiplies each vertex by
view.zoom and offsets it by the existing projected van anchor.

Shadow colour: #21233b, opacity: 0.22, feather: zero.

The ice-cream eating competition and victory celebration scenes stay AS IS.
This update ONLY changes the main gameplay street van-shadow helper.

INSTALL
1. Unzip and MERGE tools and .github into your current cloned curb-fighters
   repository. Do not replace the directories.
2. Commit and Push origin in GitHub Desktop.
3. Run the GitHub Action "Apply Pinky's isometric street shadow" on main.
4. After green, separately run "Publish Curb Fighters to GoDaddy."

NOTE: As of the repo check, the earlier mouth +5 reset and hidden "pinkys"
keyboard shortcut had NOT been pushed. This patch deliberately does not
change either; those are separate pending installations.
