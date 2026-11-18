CURB FIGHTERS — SHADOW SWAP + MOUTH ALIGNMENT

This corrects two problems in the current game:

1) MAIN GAMEPLAY STREET: Use your six-point calibrated polygon for Pinky's
   moving/parked isometric van shadow, scaled as a street-floor footprint.
2) ICE-CREAM EATING CHALLENGE: Restore the ORIGINAL elliptical shadow
   (centre 418,372, radii 150,9).
   VICTORY CELEBRATION: The existing elliptical shadow is NOT changed.
3) MOUTHS: Use your exported mouth calibrations for all four avatars,
   correctly mapped Phil / Shay / Rose / Kim, and shift 5 source pixels
   further downward based on the green/pink lines in your screenshot.

Your two source JSON files are included with corrected shadow scope.
The patch does not change the gameplay balance, audio or countdown.

INSTALL
1. Unzip and MERGE .github and tools into your existing cloned repository.
   Do NOT replace the entire directories.
2. Commit and push from GitHub Desktop.
3. On GitHub Actions, run "Correct van shadows and mouth alignment" on main.
4. Once green, run "Publish Curb Fighters to GoDaddy" separately.

No additional Python packages required.
