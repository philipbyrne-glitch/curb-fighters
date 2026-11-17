"""Install missing spoken win and Double Trouble cues; stdlib only.
Run in the curb-fighters repository. Safe to rerun after installation.
"""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
src = root/'source/game.js'
build = root/'tools/build.py'
assert src.is_file() and build.is_file(), 'Expected curb-fighters repository'
clips = {'voice-wins':'wins.mp3','voice-double-trouble':'double_trouble.mp3'}
for target, original in clips.items():
    audio_file = root/'tools/voice-cues'/original
    assert audio_file.is_file(), f'Missing {audio_file}'
    output = root/'assets/built'/f'{target}.mp3'
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(audio_file, output)

s = build.read_text()
anchor = "'sfx-miss', 'sfx-family-beep', 'voice-bounce', 'voice-versus'"
replacement = "'sfx-miss', 'sfx-family-beep', 'voice-bounce', 'voice-versus', 'voice-wins', 'voice-double-trouble'"
if replacement not in s:
    assert s.count(anchor)==1, 'Cannot safely identify audio manifest'
    s=s.replace(anchor,replacement)
    build.write_text(s)

g = src.read_text()

def replace_once(old, new, marker):
    global g
    if marker in g: return
    assert g.count(old)==1, f'Cannot safely locate {marker} insertion point ({g.count(old)} matches)'
    g=g.replace(old,new)

replace_once("if (name === 'game') { ['pinky', 'win', 'voice-noodles', 'voice-pinkys'].forEach((k) => Sound.decode(k)); hud(); }",
             "if (name === 'game') { ['pinky', 'win', 'voice-noodles', 'voice-pinkys', 'voice-wins', 'voice-double-trouble'].forEach((k) => Sound.decode(k)); hud(); }",
             "'voice-double-trouble'].forEach((k) => Sound.decode(k))")
# Double Trouble recorded call at the decisive second curb, including a winning shot.
replace_once("if (G.victor !== null) $('#winner-sub').textContent = 'DOUBLE TROUBLE! +30'; // one message, not two banners\n    else { showBanner('DOUBLE<br>TROUBLE!', '<b>+30</b>', 'double', 2600); Sound.sfx('double'); }",
             "if (G.victor !== null) $('#winner-sub').textContent = 'DOUBLE TROUBLE! +30'; // one message, not two banners\n    else showBanner('DOUBLE<br>TROUBLE!', '<b>+30</b>', 'double', 2600);\n    // Use the recorded announcement at the reveal, even when it also wins the match.\n    if (!Sound.say('voice-double-trouble', 'double-trouble')) Sound.sfx('double');",
             "if (!Sound.say('voice-double-trouble', 'double-trouble'))")
# Name + WINS, on victory; maintain existing fanfare and music transitions.
replace_once("  $('#winner').hidden = false;\n  Sound.sfx('fanfare');\n}",
             "  $('#winner').hidden = false;\n  Sound.sfx('fanfare');\n  // Spoken win cue: champion's recorded name, then WINS!\n  Sound.say('voice-' + G.names[p].toLowerCase(), 'victory-name');\n  const winningName = G.names[p];\n  setTimeout(() => {\n    if (G.match.winner === p && G.names[p] === winningName) Sound.say('voice-wins', 'victory-wins');\n  }, 950);\n}",
             "const winningName = G.names[p];")
src.write_text(g)
print('Installed voice-wins and voice-double-trouble. Run python3 tools/build.py.')
