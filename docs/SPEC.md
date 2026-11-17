# Curb Fighters: design brief and decisions

The first part is the original brief the game was built from. Its hosting notes refer to an earlier host; the game now ships as `index.html` on GitHub Pages. The second part records every decision taken since, which overrides the brief where they differ.

---

## The brief

Build **Curb Fighters**, a polished, mobile-friendly browser arcade game using Sites. It’s a personal family version of the street game “curbs,” starring Phil, Kim, Rose and Shay.

Treat this as a playable game, with a consistent pixel-art world and minimal arcade UI. Use the supplied references and approved artwork. Preserve the family’s character and humour throughout.

### Game rules

Two players stand behind opposite curbs and take turns throwing a round football overhead towards the opposite curb. First to reach or pass **100 points** wins.

- **Miss:** no points; turn passes to the opponent.
- **Full-distance curb hit:** the ball strikes the opposite curb’s corner and rebounds into the road. Score **10 points**, then move to halfway.
- **Halfway hit:** score **5 points** and throw again from halfway. Continue until a miss.
- **Double Trouble:** a rare, precisely powered full-distance throw strikes the opposite curb and rebounds all the way onto the thrower’s own curb. Score **30 points total**, then move to halfway.

Show outcomes only when the relevant impact happens. For Double Trouble, keep the surprise until the ball hits the returning curb. Never reveal results through early text, sound, scores or celebrations.

### Visual direction

Create a bright, charming **SNES-era pixel-art arcade game**.

Characters should have large expressive heads, small bodies, bright clothes and chunky outlines, inspired by the proportions of classic Mega Man sprites. Everything in the world must share that sprite-based style: players, ball, cars, dog walker, ice cream van and background people.

Use crisp pixels, nearest-neighbour scaling and consistent apparent resolution. Avoid vector-looking characters, smooth illustrations, blurred sprites and mismatched asset styles.

Use a three-dimensional isometric playfield with upright character sprites. The camera swings around when the turn changes, keeping the active player in the foreground. Halfway throws use a smooth **1.5× zoom** of the same scene and sprites.

### Characters

Use the supplied photos and approved sprites:

- **Phil:** bald white man, black glasses, white T-shirt and blue trousers.
- **Shay:** blond boy, yellow-and-white striped T-shirt, teal shorts and red trainers.
- **Rose:** blond girl, sunglasses on her head, purple sporty top and dark trousers.
- **Kim:** dark brown hair, coral top, dark trousers and gold earrings. Her hair must read as brown.

Give each character:

- A subtle standing animation with feet anchored to the ground.
- Holding, throwing and catching poses.
- A small air-punch celebration and a bigger jumping celebration.
- A disappointed or annoyed expression after a miss.
- Expressive head portraits that mirror their current mood.

### Location

Recreate the supplied estate reference without buildings:

- Grey road, raised pale curbs and paved paths.
- Grass and a tree line along one side.
- A river behind the trees.
- A single dark green metal fence between the trees and river, matching the reference: narrow vertical bars with rounded loop tops.
- Dense, irregular riverside vegetation, reeds and low shrubs.

Maintain correct curb geometry, visible faces and lighting from both camera directions. Use consistent soft shadows for players, ball, vehicles and incidental characters.

### Startup flow

**Intro screen**

Show the supplied yellow football spinning, followed by large pixel lettering for **CURB FIGHTERS** zooming into place. Display “HIT ANY KEY TO START,” or a touch equivalent.

Include compact, separate **Music** and **SFX** volume sliders. Save preferences locally. Default music to a quiet **12%**, and SFX to **55%**. Provide an Enable Audio button when browser autoplay restrictions require a gesture.

**Choose Your Champion**

Create a full-screen arcade character selector:

- Player 1 on the left; Player 2 on the right.
- All four characters arranged in an animated circular carousel on each side.
- The front, highlighted character is larger.
- Player 2’s sprites face left towards Player 1.
- Support tapping characters, large white pixel arrows, mobile swiping and desktop click-dragging.
- Put each selected character’s name between the arrows. No boxes or emoji arrows.
- No name-entry fields.

Above Player 2’s carousel, show **FRIEND / CPU** in large arcade text, with a bobbing arrow over the selected option.

In CPU mode, all four Player 2 characters become dark silhouettes with gold question marks, and their carousel rotates continuously. Choose a random opponent different from Player 1 when the match starts. Friend mode restores manual selection.

Use a front-elevation pixel-art view of the location as the background, with road, grass, trees, river and fence. Keep the carousel characters’ feet out of the river. Animate the pixel clouds in two parallax layers, passing behind the trees.

Place a large football sprite between the two sides, towards the bottom, with **“LET’S GO!”** centred on it in the arcade font. This is the start button.

### Throw controls

Offer two selectable control modes.

**Timing mode**

The player performs three actions: start the power meter, lock power, then lock aim and throw.

- Player 1 taps the left half of the screen or presses **Q**.
- Player 2 taps the right half or presses **P**.
- Space can act for the appropriate player.
- Only the correct player’s input should advance the throw.
- Do not add a separate Start Throw or Lock Power button.

Use clearly visible power and aim meters:

- Generous green zones guarantee a curb hit when both inputs qualify.
- Yellow fringes extend slightly beyond green. If either or both inputs land in yellow, give the throw **one 50% chance** of succeeding.
- Outside yellow is a miss.
- A narrow gold power zone combined with precise aim produces Double Trouble.
- Halfway throws have smaller, harder zones.

**Drag mode**

Pull back from the active player, move sideways to aim, and release to throw. Show a dotted curved trajectory preview that fades out before reaching the opposite curb. Support mouse and touch without scrolling the page.

### Ball animation and contact

Use the supplied yellow football with black, pink and purple markings.

Full-distance throws use an overhead arc. Halfway throws are low, gentle and considered:

- Before a halfway throw, the player bounces the ball three times to get the feel for it.
- The ball stays in front of the player and travels between the ground and their hands.
- Play a 16-bit bop exactly at each ground contact.
- After a successful halfway hit, the ball rebounds into the player’s hands.
- Draw the catching hand in front of the ball.
- During release, mask the ball appropriately behind the throwing arm or sprite so it does not cover the face.
- Use the same poses and ball artwork at every zoom level.
- Spin the ball while moving; stop its rotation when it rests.

### Minimal, mobile-friendly HUD

Maximise the visible playfield. Support landscape phones and tablets, with a rotate prompt in portrait and safe-area spacing.

- Top left: **TIMING / DRAG TO THROW**, in the arcade font.
- Top right: compact sound, fullscreen, help and restart controls.
- Bottom corners: each player’s cropped sprite head and score. Player 2’s head faces left.
- Above each score box: a noticeable **NOODLES!** button in the arcade font, showing remaining uses.
- Bottom centre: larger power and aim meters when relevant, with a compact contextual tap hint.

Avoid marketing headers, introductory cards, large instruction panels, sidebars and full-width action bars. Keep instructions in Help. Touch controls need generous hit areas without oversized visible chrome.

### NOODLES!

Each player has **two NOODLES! uses per game**.

The non-throwing player can activate one while their opponent sets power or aim:

- Player 1 uses **X** or their NOODLES button.
- Player 2 uses **N** or their NOODLES button.
- Aim becomes faster and wobblier; drag-mode aim sways.
- Show a large **“NOODLES!” speech bubble originating from the caller’s head**.
- The targeted player briefly shakes and pulls an annoyed face, while retaining the ball and throwing pose.
- Play a retro negative buzz.
- Their score portrait mirrors the annoyed expression.

Keep the reaction brief and preserve the underlying throw.

### Neighbourhood interruptions

**Cars**

Occasional sprite cars drive slowly through the estate. They should be infrequent—roughly every seven to ten throws after an initial delay.

Never introduce a car during a throw or a halfway streak. Wait for a safe gap.

Show a large arcade **“CAR!”** announcement, pause play, and keep both players safely on the pavement until the car passes. Use a quiet retro engine sound.

After about two seconds of waiting, choose a character-specific animation:

- Phil: folded arms, yo-yo, standing nap with Zzzs, or phone scrolling.
- Rose: bubble gum or scrolling a pink phone.
- Shay: thigh drumming or moonwalking.
- Kim: phone scrolling or dancing.

**Dog walker**

Occasionally show a pixel-art person walking a small fluffy apricot cavapoo or goldendoodle. The cute dog briefly makes aiming harder.

**Conker collectors**

Infrequently show people wearing golf visors, carrying white refuse sacks and using long grabber sticks to collect conkers. These are background details.

### Pinky’s ice cream van

Use the supplied photos to create a matching pink pixel-art ice cream van and a big-headed vendor in the same style as the family sprites.

Pinky may randomly appear once combined scores exceed **50**, but must visit **at least once per completed game**:

- If either player reaches **85 or more** and he has not visited, force a visit before the next throw.
- Handle a winning throw that skips past that threshold so the visit cannot be missed.
- Never interrupt a ball in flight.
- Visit no more than once per game.

Sequence:

1. Pause the normal game music.
2. Play the supplied Pinky tune **before the van becomes visible**.
3. Show exclamation marks above both players, a surprise sound and **“WAIT, DO YOU HEAR…”**.
4. The van enters; both players jump and a large **“PINKY’S!!!”** appears.
5. The van stops, the players approach, and Pinky leans out to serve each a 99 with a chocolate flake.
6. Open a close-up ice cream race with a countdown. Players button-bash Q/P or their touch controls to finish first.
7. The ice creams must visibly be held in their hands, with the hands layered over the cones.
8. Announce the winner, return the players to position, and have Pinky tear off with the same retro engine sound as the cars.
9. Resume the match with scores and turn preserved.

The ice cream winner earns a **99 BOOST**: their next throw starts from the curb, with the gold Double Trouble power zone expanded to almost the full green zone and a much more forgiving aim requirement. Consume the bonus after that one throw and make it clear when it is active.

### Music and sound

Use the supplied tracks:

- “Curbs – Intro – Super Star Jump” for the intro.
- “Curbs – Character Select Screen” for character selection.
- “Curbs – in game music” during play.
- Pinky’s supplied arcade tune for his arrival.

Loop screen music cleanly and switch without overlapping tracks. Pause audio when the page is hidden. Respect separate Music and SFX levels and the master sound toggle.

Use consistent 16-bit effects for throwing, curb impacts, ground bounces, preparation bounces, cars, surprise, NOODLES, celebrations and winning.

### Winning

After the winning ball makes its decisive impact, show a larger jumping celebration, crown, confetti, victory text and fanfare. After a short celebration, automatically return to **Choose Your Champion**.

### Implementation and validation

Use a clear game-state system and keep rules, input, animation, rendering and audio separate enough to maintain. Calculate outcomes once, then reveal them through the animation at the correct contact.

Validate:

- Same-device play and a functional CPU opponent.
- Both camera directions and halfway zoom.
- Desktop, tablet and small landscape-phone layouts.
- Correct turn ownership and input isolation.
- Impact-timed scoring and celebrations.
- Consistent hand/ball/cone positioning and layering.
- Grounded idle animations and stationary-ball rotation.
- Car scheduling and guaranteed Pinky visits.
- One-use bonus behaviour.
- Correct music transitions, volume persistence and mobile audio unlocking.

Build in working stages: core rules and controls; consistent artwork and animation; startup flow and responsive HUD; neighbourhood events and Pinky; audio and polish. Check each stage before adding the next. Make sensible implementation decisions and ask only when a missing detail would materially change the game.

Publish the finished result through Sites as **Curb Fighters**, using the slug **curb-fighters** and preserving the site’s existing access settings.

---

## Decisions since the brief

**Delivery.** One self-contained file: images and fonts as data URIs, music as base64 MP3 decoded through Web Audio (clean loops, separate Music and SFX buses, no media-loading restrictions). Press Start 2P and VT323 are embedded under the SIL OFL, with Google Fonts as a fallback. The page is `noindex` because it carries pixel likenesses of the family.

**Reveals.** A Double Trouble shows +10 and a small air-punch at the first curb contact, exactly like a normal hit, then +20 more, the big jump and the DOUBLE TROUBLE! banner when it lands on the thrower's own curb. A throw that wins is announced only by the win itself (no "+10" float), and a Double Trouble that wins becomes "DOUBLE TROUBLE! +30" above the winner's name.

**Flow.** After a throw the game moves on by itself after a short pause. A tap by the next thrower skips the pause and starts their throw in one go. During the halfway practice bounces, the thrower's own tap or key cuts the bounces short and starts the throw (the CPU always bounces all three). Taps within 220 ms of a meter starting are ignored, so a double tap never locks a meter by accident.

**Input.** A tap anywhere on a player's half counts as theirs; idle buttons let taps through to the half beneath them. In CPU mode the whole screen belongs to Player 1. In drag mode a pull can start anywhere on the thrower's half.

**NOODLES!** One per throw. The speech bubble stays up for 2 seconds, even after the throw is released, then breaks into little pixel clouds over three frames. The caller's score portrait yells for the same 2 seconds.

**Cars** are louder than the brief's "quiet" engine: about 2.3× the original, swelling as they pass the players (Pinky's van engine is unchanged).

**Positions.** Players wait on their own pavement, not the grass. Cars arrive only at the start of a curb throw, never in a halfway streak.

**Pinky.** If the winning throw arrives before he has visited, he comes for a post-match ice cream and the race prize is bragging rights, not a boost. His van art is sheared (columns slid, never rotated) to match the isometric road angle. The race is a front-on street scene with the van parked behind; the eaters use the phone-scroll pose with the phone swapped for the 99, the head dips on each bite, the cone goes through eight bitten stages, and only the lower hand is layered over the wafer so the swirl stays visible.

**Score portraits.** Head-only portraits are cut from every pose. The HUD shows the face matching what the character is doing: neutral, a grin after a good curb, eyes-closed delight for Double Trouble or a win, a sulk after a miss or when NOODLED or beaten, a yell for NOODLES!, and their own nap, phone, bubble-gum or dance face while a car passes.

**Player 2's view.** On Player 2's turns the street turns a quarter, not half, so they stand bottom-right and throw right to left; drag controls pull back towards their own corner. Everyone faces the other player on screen, aim-left always lands screen-left, and anything standing in front of the thrower (trees, passers-by, cars) turns see-through. Car art picks its front or rear frame and mirroring from the direction it drives, so it fits either diagonal.

**Halfway feel.** Practice bounces follow a real bounce curve (quickest at the road, floating at the top), and the ball squashes as it meets the road there and in flight. Halfway throws reach the curb in about half a second (1250 ms total, contact at 42%) and leave the hand quick.

**Meters.** The meter you are not setting dims: aim while powering, power while aiming.

**Pinky's van** uses the supplied art exactly as drawn: both frames at one scale on one ground point, so it doesn't jump when he starts serving, and the serving frame as drawn in the front-on scenes. Shearing it and re-projecting it in 3D were both tried and rejected, because both warp the art. The real fix is new art at the street's angle, briefed in `docs/VAN-ART-BRIEF.md`.

**Winning.** The winning hit swaps the game music for the winning theme. After the in-game moment (and Pinky's post-match visit if needed) comes the celebration: the front-on street with the whole family, the conker collectors, the dog walker and dog, and Pinky cheering from the van, ticker tape that never stops, and the winner lifting a golden version of the ball (its stand peeks out behind them so faces stay clear). It stays until someone taps or presses a key.

**Starting a match.** Scrolling through champions only ticks. Pressing LET'S BOUNCE! (the football button) locks the choice and the announcer takes over: "LET'S BOUNCE!", then Player 1's name, "VERSUS" (a big VS slams onto the screen), then Player 2's name, each timed to the length of its recording so they never overlap. The names light gold and the champions cheer; in CPU mode the CPU's pick steps out of the shadows first. Then a beat, and a stepped fade to black onto the street.

**Misses.** Every miss plays Phil's missed-shot sound, at half the voices' volume. A stinker (clearly past the yellow edges, not a near miss) also floats a pixel-art spurl just clear of the thrower's head: a fuming zigzag scribble tangling down into a corkscrew, in plain ink with no outline, fizzing through three frames for 1.8 s over their sulky face.

**Balance.** Phil balanced every sound on the sound desk: music tracks at 20%, voices at 40%, the missed shot at 35%, and the game's effects lifted (throws, bounces and munches doubled; the curb, catch, horn, car, van and countdown boosted). The player sliders start at 70% Music and 70% SFX. Saved slider positions from before this balance were reset once (storage key `curb-fighters-audio-v2`).

**Sound panel.** In play, the speaker button opens a small panel with the Music and SFX sliders (shared with the title screen) and MUTE ALL. The street pauses while it's open, and a tap outside or Escape closes it without counting as a throw.

**Voices.** The family's recordings: each champion's name is called once the champions are chosen (see Starting a match); the "Pinky's!" chant plays twice, as the van slows to a stop (78% through its arrival) and as it tears off the edge of the screen (0.95 s into the getaway); and the kids shout "NOODLES!" over the buzz. Recordings live in `assets/original/audio/` (names in its README), trimmed and levelled by `prep_assets.py`. Anything missing falls back to a synth stand-in. The victory theme ("Curbs – Victory theme") plays from the winning hit through the celebration, looping while it lingers, levelled to match the game music.

**Icons.** The browser tab and home-screen icons are the yellow ball. On portrait phones, white pixel arrows circle the spinning ball to say "turn me sideways".

**Look.** The in-game road is about a fifth darker than the source tile. On Choose Your Champion, feet are placed by backdrop rows so everyone stands on the road on any screen shape, and the far characters are only slightly smaller than the front one.
