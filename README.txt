CURB FIGHTERS — TWO MISSING FIXES ONLY

Verified base repo contains the corrected isometric Pinky's street shadow and
the latest VS/victory audio flow. This update leaves them unchanged.

CHANGES
1) Mouth Y source pixels go UP by 5 for all avatars:
   Phil 44->39, Shay 39->34, Rose 46->41, Kim 45->40.
   X positions and mouth dimensions do not change.

2) In a running match, type P I N K Y S (within 1.2 seconds between letters)
   to invoke Pinky's full normal encounter immediately.
   It's hidden; no on-screen cheat controls. Doesn't work in selection,
   celebration, dialogs or after a winner is declared.
   Note: P is also Player 2's normal action key; the first letter can still
   perform P2's action. The N in the sequence will NOT spend NOODLES.

INSTALL
1. Unzip. MERGE tools and .github folders into your cloned repository.
   Do NOT replace folders wholesale.
2. Commit and Push origin with GitHub Desktop.
3. GitHub > Actions > 'Install calibrated mouths and Pinkys shortcut' > Run workflow.
4. After a green workflow, run 'Publish Curb Fighters to GoDaddy' separately.

No pip packages are required. The action makes a new source/build commit.
