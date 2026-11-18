CURB FIGHTERS — VS + VICTORY AUDIO POLISH

Three changes:
1. VS zooms in from the centre on the character-select screen.
2. On winning a shot, ONLY the supplied 1.72s yeah.mp3 plays on the gameplay street.
   Existing synth fanfare and spoken winner name no longer play on the street.
   Win theme begins on the celebration scene.
3. On entering celebration, the recorded winner's name THEN the recorded WINS!
   play strictly sequentially, paced by their real audio sample durations.
   Existing voices are stopped at the transition to avoid overlapping recordings.
   Winning Double Trouble no longer announces over the street 'yeah!'.

No changes to gameplay fairness, mouth positions, Pinky's van shadows,
countdown or the separate victory scene's artwork.

INSTALL
1. Unzip and MERGE .github and tools with the existing repository.
   DO NOT REPLACE those entire folders.
2. Commit + Push origin with GitHub Desktop.
3. Run 'Install VS and victory audio polish' in GitHub Actions on main.
4. When the workflow is green, run 'Publish Curb Fighters to GoDaddy'.

The workflow copies tools/audio/yeah.mp3 into assets/built/sfx-yeah.mp3,
updates the audio manifest and rebuilds standalone index.html.
