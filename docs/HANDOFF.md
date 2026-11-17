# Handoff: Curb Fighters

You're picking up **Curb Fighters**, Phil's personal family game. It's a two-player, SNES-style pixel-art browser version of the street game "curbs", starring Phil, Kim, Rose and Shay. It's finished, tested in a headless browser, and played by Phil. Your job is to keep improving it with him, in the same spirit, without breaking what already works.

Read this whole brief before changing anything. Then read `CLAUDE.md` and `docs/SPEC.md` in the repo. The spec holds the original design brief plus every decision taken since, and it overrides the brief where they differ.

---

## 1. Where things are

- **Repo:** Phil's personal GitHub, `curb-fighters`. GitHub Pages serves `index.html` from the root of `main`. If Phil has set a custom domain, GitHub commits a `CNAME` file; leave it in place.
- **Live game:** `https://<his-username>.github.io/curb-fighters/` (or his custom domain).
- **The game is one self-contained file.** `index.html` (about 6 MB) carries every image, the four music tracks and both fonts inline. It needs no server, works offline and loads nothing else, except Google Fonts as a fallback.
- **The page is `noindex`** because it carries pixel likenesses of the family. Keep it that way unless Phil says otherwise.

### Layout

| Path | What it is |
|---|---|
| `index.html` | **Build output.** Never hand-edit it, because the next build overwrites it. |
| `source/index.html` | Page template, with placeholders `/*CSS*/`, `<!--DATA-->` and `/*JS*/`. |
| `source/style.css` | All styling. |
| `source/game.js` | All game logic, in numbered sections (see §4). |
| `tools/build.py` | Inlines the source, the built assets (as base64) and the fonts into `index.html`. |
| `tools/prep_assets.py` | First asset pass: character cells, ball, props, tiles, backdrop layers, clouds, music. |
| `tools/prep_extra.py` | Second pass: darker road, the van's anchors and front-on version, head portraits, eating pose, bitten cones, golden trophy, ball icons, palette quantisation. |
| `tools/ballgen.py` | Clean small balls (area-averaged, snapped to the ball's own colours, navy outline). |
| `tools/smoke_test.py` | Plays a match plus a Pinky visit in headless Chromium; exits non-zero on any script error. |
| `assets/original/` | Phil's supplied art, frame JSONs and music. Treat these as the source of truth. Recordings go in `assets/original/audio/` (its README lists the names). |
| `assets/built/` | Game-ready art, `meta.json`, compact MP3s, fonts and OFL licences. All regenerable. |

### Commands

```
pip install -r tools/requirements.txt          # Pillow, numpy, scipy, playwright
python3 -m playwright install chromium         # once, for the smoke test
python3 tools/build.py                          # after ANY change to source/ or assets/built/
python3 tools/prep_assets.py && python3 tools/prep_extra.py   # only when artwork changes
python3 tools/smoke_test.py                     # before every push
```

The pipeline is deterministic. Rebuilding from `assets/original/` gives a byte-identical `index.html`, so you can always regenerate safely. `prep_extra.py` takes a minute or two because of the head-alignment search. Music is only re-encoded (ffmpeg, mono, 80 kbps) when a track is missing from `assets/built/`.

---

## 2. The rules you must hold

These matter most to Phil. Each one was asked for explicitly or fixed after he spotted a problem.

1. **Outcomes are judged once, at release, and revealed only at the deciding contact.** `Rules.judge()` decides the throw. `makeShot`/`ballAt` animate it. `onImpact()` fires at the curb or ground contact, and `onFlightEnd()` fires at the end. Never leak a result early through text, sound, score, celebration or pose.
2. **Double Trouble is a surprise.** At the first curb contact it looks exactly like a normal hit (+10, air-punch, the same curb sound). The +20, the big jump and the DOUBLE TROUBLE! banner come only when the ball lands on the thrower's own curb. If that throw also wins, it shows as one message ("DOUBLE TROUBLE! +30" above "PHIL WINS!"), never two banners.
3. **One pixel world.** Every sprite is pre-rendered by `tools/` at the size the game draws it (characters in 128×112 cells, body height 72 px, feet at (64,100)). Everything is drawn with smoothing off. The halfway zoom (1.5×) enlarges those same pixels; it never resamples finer art. To add art, render it in the asset scripts at its in-game size; don't draw a big source image small at runtime. Quarter-turn ball rotation keeps pixels square. Never rotate pixel art. Shearing and 3D re-projection were both tried on the van and rejected: Phil saw them as "skewed" and "warped". When art sits at the wrong angle, the fix is new art drawn at the street's angle (see `docs/VAN-ART-BRIEF.md`), not a transform.
4. **Minimal HUD, maximum street.** Small corner chrome only. Announcements sit high (top ~7%) so they never cover the players or their celebrations. No marketing headers, sidebars or full-width bars. Instructions live in Help.
5. **Tap anywhere on your half.** On touch, any tap on a player's half counts as theirs. Live buttons keep their taps; disabled ones use `pointer-events: none` so taps fall through. In CPU mode the whole screen belongs to Player 1.
6. **Pinky visits every completed game,** at most once, and never interrupts a ball in flight.
7. **Cars never arrive during a throw or a halfway streak.**

---

## 3. What the game does today

### Flow

Title (spinning ball, CURB FIGHTERS zooms in, HIT ANY KEY / TAP TO START, Music 12% and SFX 55% sliders, ENABLE AUDIO when the browser blocks sound) → Choose Your Champion → match → in-game win moment (crown, confetti, fanfare, winning music) → (Pinky's post-match visit if he hasn't been) → the celebration screen → (tap or key) → Choose Your Champion.

### Rules and tuning (in `Rules` and the constants near `G`)

- First to 100. Curb hit +10 then halfway. Halfway hit +5, keep throwing until a miss. Double Trouble +30 then halfway. A miss passes the turn and returns the thrower to the curb.
- **Zones.**

  | Throw | Power green | Aim green | Fringe (yellow) |
  |---|---|---|---|
  | Curb | .50–.84 | .36–.64 | .04 |
  | Halfway | .42–.64 | .41–.59 | .03 |

  If either input lands in the yellow fringe, the whole throw gets one 50% roll.
- **Double Trouble gold.** Power .735–.755 and aim .475–.525, curb throws only.
- **99 BOOST.** Gold widens to .52–.82 power and .38–.62 aim. The throw is forced from the curb, and the boost is consumed by that one throw.
- **Meters.** Cosine sweep, power period 950 ms, aim 850 ms. Distractions affect aim: NOODLES! makes it 1.7× faster with ±.065 wobble, the dog 1.35× faster with ±.04.
- **Flights.** Curb throws take 2600 ms and Double Trouble 3700 ms, with contact at 57%. Halfway throws take 1250 ms with contact at 42% (about half a second), easing out of the hand fast (`s.contact` per shot). The ball squashes (`squash`) whenever it meets the ground in flight.
- **Result pause.** Miss 1500 ms, hit 1000 ms, Double Trouble 2600 ms.
- **Halfway.** A 2400 ms practice-bounce routine, with a bop at each ground contact (400, 1200 and 2000 ms), which the thrower can cut short. The bounce follows a parabola (sharp at the road, floating at the hand), with a squash at each road contact and a shadow that shrinks as the ball rises.
- **Ground seams.** Each ground zone is underlaid in its tiles' average colour (`tileAvg`) and tiles overlap slightly (32.6 of 32 px), so no grid lines show while zooming or swinging. Keep both if you touch `renderGround`. A successful halfway throw rebounds into the catching hand, drawn in front of the ball.
- **Drag mode.** Pull back anywhere on your half; sideways movement aims. Power = pull ÷ (160 px, or 110 at halfway). Aim = sideways ÷ 220 px. The dotted guide fades before the far curb. Releasing below .08 power cancels the throw.

### Input (`tap()`, `requestStart()`, `act()`)

- **Keys.** Q / left tap is Player 1, P / right tap is Player 2, and Space acts for whoever is up. X and N call NOODLES!. The keys for the CPU's side are ignored in CPU mode.
- **During the result pause.** The next thrower's tap skips the pause *and* starts their throw.
- **During the practice bounces.** The thrower's own tap or key cuts the bounces short and starts the throw; the CPU always bounces all three.
- **Double-tap guard.** Taps within 220 ms of a meter starting are ignored.

### NOODLES!

- Two per player per game, one per throw. The non-throwing player can only call one while the opponent sets power or aim (or is dragging).
- The effect lasts 6.5 s. The speech bubble comes from the caller's head, stays up for 2 s (even through the throw), then breaks into pixel clouds over three frames (`NOODLE_HOLD`, `NOODLE_PUFF`, `puff()`). The target shakes and sulks for 1.1 s while keeping the ball and pose. The caller's score portrait yells for the same 2 s.

### Neighbourhood

- **Cars.** The first comes after 5–7 throws, then every 7–10, only at the start of a curb throw. There's a CAR! banner and play pauses for 9 s. The engine (`updateEngine`) is louder for cars than for Pinky's van and swells as it passes. After about 2 s, each character starts a waiting routine:
  - Phil: folded arms, yo-yo, standing nap or phone
  - Rose: bubble gum or a pink phone
  - Shay: thigh drumming or moonwalking
  - Kim: dancing or phone
- **Dog walker** (apricot fluffy dog). The first comes after 2–4 throws, then every 6–10. He walks the grass behind the far pavement for 12 s, and aim is harder while he's in view.
- **Conker collectors** (golf visors, white sacks, grabbers). The first come after 3–5 throws, then every 6–10, for 24 s; half the time it's a pair. Background only.

### Pinky's van (`Pinky`, `beginPinky`, `updatePinky`, `PD`)

- **When he comes.** He may visit randomly (a 6% roll at each curb ready, once the combined score passes 50). He's forced before the next throw once anyone reaches 85. If a winning throw skips past 85, he comes after the win for a post-match ice cream with no boost.
- **Stages (ms).**

  | heard | arrive | walk | serve | countdown | race | result | return | depart |
  |---|---|---|---|---|---|---|---|---|
  | 3000 | 4200 | 2400 | 2300 | 3000 | until done | 3000 | 2400 | 1500 |

- **The sequence.**
  1. Game music pauses (and later resumes from the same spot). Pinky's tune starts before the van appears.
  2. "!" over both players, a surprise jingle and WAIT, DO YOU HEAR….
  3. The van drives in, both players jump, and PINKY'S!!! appears.
  4. They walk to the window and he serves two 99s.
  5. The race close-up: countdown, then button-bash to 24 bites.
  6. Winner announced and the 99 BOOST awarded. They walk back.
  7. He tears off: tyre screech, a getaway engine through two gear changes, and exhaust puffs from the rear bumper.
- **The van in the street** is Phil's original art, untouched. Both frames are at one scale on one ground point (`meta.pinkyArt.anchors`), so it doesn't jump when serving starts. `meta.pinkyArt.exhaust` is the rear bumper. It sits slightly across the road's angle; new art is briefed in `docs/VAN-ART-BRIEF.md`, and when Phil supplies `assets/original/pinky-van-iso.png`, cut its frames in place of `pinky-sprites` frames 0 and 1 and the front-on van.
- **The race close-up** is a front-on street (the champion-select backdrop and clouds) with the original serving frame parked behind. Pinky leans out of the window while the van rocks on its springs, and his speech bubble cycles GO ON! / CHOMP CHOMP! / NO BRAIN FREEZE! / NEARLY THERE! / WELL DONE …!. On short screens the bubble sits beside the van instead of above the roof.
- **The eaters** use each character's phone-scroll pose with the phone painted out and a 99 in its place. Layers, bottom to top: headless body, head, cone, then only the lower hand (clipped to the wafer). Each bite dips the head 2 cell px with an open-mouth face for 120 ms, sheds crumbs, and steps the cone through 8 bitten stages (`floor(bites / 3)`). The winner switches to the full-body jump; a loser sulks.
- **Race limits.** Human bites need 55 ms between taps. The CPU bites every 125–210 ms. The race ends 2.5 s after the first finisher or when both finish, with a 25 s safety timeout.

### Celebration (`openCelebration`, `renderCelebrate`)

The front-on street again. Pinky's van is parked with him cheering from the window ("WHAT A CHAMP!" / "LEGEND!" / "99s ON ME!"). Conker collectors wave their grabbers and the dog walker and dog hop on the pavement. The three other family members jump and air-punch on the road. The winner lifts the golden ball (`Art.trophy`, built in `prep_extra.py`) with sparkles, under ticker tape that never stops. TAP TO PLAY AGAIN appears under the score after 2.2 s, and taps are accepted after 1.2 s.

### CPU (`updateCPU`, `Rules.cpuPlan`)

- In CPU mode the four Player 2 characters become dark silhouettes with gold "?" on a continuously spinning carousel. A random opponent, different from Player 1, is picked at kick-off.
- It succeeds 65% of the time from the curb and 53% at halfway. It NOODLES! the human on 22% of throws. In drag mode the CPU still throws with the meters, and they're shown.

### Score portraits (`headKey()`, `blitHead()`)

Head-only portraits are cut from every pose (`assets/built/heads*.png`, 52×46). The face matches what the character is doing:

- neutral while idle or aiming
- a grin after a good curb or while eating
- eyes-closed delight for Double Trouble, a win or Pinky's arrival
- a sulk after a miss, when NOODLED or beaten
- a yell for NOODLES!, a gasp at a rival's Double Trouble, or hearing Pinky's tune
- during car waits, their own nap, phone, bubble-gum or dance face

Player 2's portrait faces left.

### Starting a match (`go`, `fadeThrough`, `resetSelect`)

Scrolling only ticks. LET'S BOUNCE! locks the screen (`Select.locked`) and reveals the CPU's pick (`Select.reveal`). The announcer plays `voice-bounce`, Player 1's name, `voice-versus` (with the `#vs` slam), then Player 2's name, each scheduled from `Sound.length()` of the one before plus a short gap, then a stepped fade to black (`#fade`) onto the street.

### Sound panel (`openSound`, `syncAudioControls`)

The in-game speaker opens Music and SFX sliders (shared with the title screen's) plus MUTE ALL. The clock pauses while it's open (`G.soundOpen`); a capturing pointer listener closes it on any outside tap without that tap reaching the game.

### Choose Your Champion (`renderSelect`, `Select`)

- Two circular carousels, with Player 2 facing left. Selection works by tapping, by the big white pixel arrows, or by swipe and drag. On the keyboard: A/D for Player 1, ←/→ for Player 2, Enter to start.
- FRIEND / CPU sits above Player 2, with a bobbing arrow over the selected option.
- The front character is larger with a 1 px gold outline, and does an air-punch when picked.
- Feet are placed by backdrop rows (`rowPct(346 + depth*58)`), so everyone stands on the road on any screen shape. Scale runs from 1.0 at the back to 1.38 at the front.
- The LET'S BOUNCE! football is the start button.

### Audio (`Sound`)

- **Engine.** A single Web Audio graph: master → music bus + SFX bus. Music is decoded from the embedded MP3s and looped sample-accurately, with leading and trailing silence trimmed. Tracks never overlap; each fades out before the next starts.
- **Tracks.** Intro (title), select (Choose Your Champion), game (play), Pinky (his visit), win: the "Curbs – Victory theme", from the winning hit through the celebration, looping.
- **Per-sound levels.** `Sound` keeps a `MIX` table, Phil's balance from the sound desk, applied to every effect, voice, music track and the car and van engines (`Sound.engine`); anything unlisted plays at 1. Player sliders default to 70% Music and 70% SFX, saved under `curb-fighters-audio-v2` (the v2 key reset everyone once onto the balanced defaults). Phil balances them on the temporary sound desk: `tools/mixer.html`, built by `python3 tools/build_mixer.py` with the game's own sound engine lifted from `source/game.js`. It exports JSON (`music`, `sfx` player defaults plus `levels`); paste the `levels` into `MIX` and the two defaults into `Sound.prefs` to make them the game's.
- **Missed shots** play `sfx-miss` (Phil's sound, levelled to −24 dB, half the voices; `SFX_LEVEL` in `prep_assets.py`). `Rules.judge` marks a miss `bad` when it is more than 1.75× the fringe outside the green and not a yellow-edge chance; bad misses show the spurl (`drawSpurl`, `SPURL_MS` = 1800, art from `prep_extra.py`).
- **Recorded samples** (`Sound.say`), all supplied by Phil: `voice-phil/kim/rose/shay` called after LET'S BOUNCE! (never while scrolling), `voice-pinkys` twice (78% through the van's arrival as it slows, and 0.95 s into the getaway), and `voice-noodles` when NOODLES! is called. They duck the music while they play. `say()` returns false when a sample hasn't been supplied, and the caller then plays its synth stand-in. The win theme simply stays silent until it exists (the fanfare still plays).
- **Effects.** All are synthesised 16-bit-style (square and triangle tones, stepped pitch lines, sample-and-hold noise): throw, curb, bounce, practice bop, catch, miss, hit, Double Trouble, fanfare, surprise, horn, NOODLES! buzz, meter locks, munch, countdown, engine, screech, getaway.
- **Behaviour.** Sound suspends when the tab is hidden or in portrait. On iOS it opts into playback mode so the ringer switch doesn't mute it. Preferences persist in `localStorage` under `curb-fighters-audio`, and the control mode under `curb-fighters-control`.

### Layout

- **Court.** The canvas is 960×440, `object-fit: cover`, with an isometric projection in `project()` (29 / 15 / 33 px per unit). The ground is cached per camera, zoom and focus. The camera is 0 for Player 1 (bottom-left, throwing up-right) and π/2 for Player 2 (bottom-right, throwing up-left), so drag controls are never backwards. Pinky's visit forces camera 0. Facing is screen-based (`o.flip`: face the other player). Release points use `worldOffset()`. Anything in front of the thrower is drawn see-through (`veil`).
- **Screens.** Landscape phones and tablets, safe-area insets, and a rotate prompt on portrait phones. Compact HUD rules apply under 520 px tall.
- **Fullscreen** button: hidden where unsupported (iPhone, some embedded viewers).

---

## 4. Finding your way around `source/game.js`

The numbered sections:

0. Utilities
1. Rules
2. Audio
3. Artwork (cells, composites, `poseFrame`, `drawCharacter`, heads, props)
4. Game state (`G`, constants)
5. World renderer (`project`, ground cache, props depth-sort, `actorOptions`, `drawScene`)
6. Throws (`makeShot`, `ballAt`, `onImpact`, `onFlightEnd`, `addPoints`, `beginVictory`)
7. Turn flow (`startMatch`, `ready`, `backToReady`, `tap`, `requestStart`, `act`, `noodle`, `beginTraffic`, `completeMatch`)
8. Pinky (stages, paths, race scene, `drawEater`, `drawChant`)
9. CPU
10. Update loop
11. HUD
12. Input
13. Choose Your Champion (`drawStreetBackdrop`, `renderSelect`, `drawChamp`)
14. Screens, title and main loop

`ready()` is the single place where interruptions are scheduled, in this priority order: Pinky, car, dog, collectors.

`window.CurbFighters` exposes `G`, `Rules`, `view`, `startMatch`, `ready`, `beginPinky`, `launch` and `endTurn`. It's a test hook: the smoke test and screenshot checks force exact states through it (for example `G.phase = "aim"; G.power = .745; G.aim = .5; launch()` for a guaranteed Double Trouble).

`assets/built/meta.json` is the contract between the asset scripts and the game:

| Key | Holds |
|---|---|
| `actors.index` | Cell numbers per pose set: `base0..3`, `wait0..3`, `alt0..3`, `emote0..3`, `walker` |
| `props` | Strip rects for cars, collector, pinky, plants and clouds |
| `heads` | Index and per-cell offsets, plus `eat0..3` |
| `eat` | Per character: cone x, grip and chin rows, head key |
| `cones` | Rects, top rows, crumb colours |
| `pinkyArt` | Ground anchors for both van frames, exhaust point |
| `vanSide` | Size and Pinky's face point |

Cell conventions per character: base poses 0–3 are stand, hold-overhead, throw/extended, jump. Emotes 0–3 are disappointed, air-punch a, air-punch b, phone-scroll. The head cut rows are `CUT = [64, 63, 65, 67]` (Phil, Shay, Rose, Kim).

---

## 5. How to work with Phil

- **He reviews by playing and by screenshots.** For any visual change, take headless screenshots (Playwright, forcing states through `window.CurbFighters`) and look at them yourself before telling him it's done. Check:
  - desktop 1280×720
  - phone landscape 844×390 with touch
  - tablet 1024×768
  - portrait 390×844
- **He gives batches of specific, visual feedback** ("road a little darker", "smoke at the REAR of the van") and cares a lot about pixel consistency, the surprise of reveals, and the family's character and humour. Keep the arcade voice short and cheeky: SO CLOSE!, GET IN!, LAST LICKS!.
- **Be honest about what you couldn't verify.** In particular, you can't hear the audio or feel touch timing from a headless browser. Say so, and ask him to check on a real device.
- **When an asset can't do what he asks** (for example, there's no art of a character looking down with an open mouth), say what you did instead in one line, and offer to go further.
- **Ship.** Edit `source/` (or the asset scripts), run `tools/build.py`, run `tools/smoke_test.py`, check screenshots, then commit and push. Pages updates within a minute or two. Use small, descriptive commits.
- **Late nights.** If it's past 2 am his time and he's deep in a session, he's asked to be nudged: unless it's essential for tomorrow, tell him kindly to get some sleep and pick it up tomorrow.

---

## 6. Known limits and open ideas

These aren't bugs, just honest edges worth knowing:

- **Chomp face.** The bite uses each character's forward-facing open-mouth grin, because no art exists of them looking down with an open mouth. Brand-new frames would make the chomp even better.
- **Pinky's cheering** is the existing leaning-out art plus the speech-bubble chants and the van rocking; there are no new animation frames for him.
- **The cars use their original art.** Each frame happens to match one of the two road diagonals, and `drawCar` picks the frame and mirroring from the direction of travel. If Phil ever finds them off-angle, the fix is new art at the street's angle (as briefed for the van), not a transform.
- **The golden trophy** is the gold ball held aloft, with its stand drawn behind the character (so it peeks out rather than covering faces). Bespoke "lifting a trophy" art would make it grander.
- **All the family's audio is in.** The voices and the victory theme (`assets/original/audio/win-theme.mp3`, levelled to match the game music by a measure-and-correct loop in `prep_assets.py`).
- **The asset index.** `prep_assets.py` merges into `assets/built/meta.json` and `prep_extra.py` adds the rest; `build.py` refuses to run if any key is missing, so a partial regeneration can't ship a broken page.
- **Scaling seams.** The court canvas is CSS-scaled by non-integer factors on most screens, so pixels can be very slightly uneven. A fix would mean integer-scaling with letterboxing, or resizing the canvas to the screen.
- **Mirror matches** (both players picking the same character) are allowed in FRIEND mode.
- **Sound by ear.** The synthesised effects, especially the new screech and getaway, haven't been checked by ear by anyone but Phil. Tune them in `Sound`'s `FX` table if he asks.
- **Size.** The file is about 6 MB, mostly music. If load time ever matters, the tracks could drop to 64 kbps, or move to separate files now that Pages serves a normal site (that would mean changing `Sound.decode` to `fetch`).
- **Things he's floated but not asked for yet:** none outstanding. Everything requested so far is done and in `docs/SPEC.md`'s decisions list.

Start by running the smoke test and a quick screenshot pass to confirm everything works in your environment, then ask Phil what he'd like next.
