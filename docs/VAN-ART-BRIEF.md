# Art brief: Pinky's van at the street's angle

The game currently uses Pinky's van exactly as first drawn. That art is a low three-quarter view (the side panel runs at about 11°), but the street is pixel isometric (about 27°), so the van sits slightly across the road. Shearing it and re-projecting it in 3D both warped it, so the fix is new art drawn at the street's angle.

## What to make

One transparent PNG, 1254 × 1254, holding three drawings of the same van, none touching:

1. **Driving.** Top half, left. The van on its own, with the serving window showing the shop inside (ice-cream tubs on the counter, as now).
2. **Serving.** Top half, right. The same van in exactly the same pose and size, with Pinky leaning out of the serving window holding a 99 with a flake. Everything except Pinky must match frame 1 pixel for pixel.
3. **Side-on.** Bottom half. The van seen straight from the side (wheels as circles, roof flat along the top), with Pinky leaning out. This one is for the front-on scenes (the ice cream race and the celebration).

## Angle

Match `assets/original/cars.png`, the red car on the left: those cars already sit perfectly on the road.

- **Pixel isometric (2:1).** Edges along the road drop 1 pixel for every 2 across.
- **Long side down-right.** The van's long side runs from upper left down to lower right.
- **Front corner.** The bonnet and windscreen are at the lower-right end, and the front face angles up and away to the right.
- **Facing the viewer.** The visible long side, with the serving window and the PINKY'S sign, faces us at the lower left.

## Keep the design

Use `assets/original/pinky-sprites.png` as the model:

- the pink body with the cream stripe
- the PINKY'S sign above the serving window
- the small pink roof light
- the rounded van front with a big windscreen, orange indicators and a pale bumper
- Pinky himself: grey-white curly hair, big friendly face, white shirt

## Style

Match the family sprites (`family-sprites.png`):

- SNES-era pixel art with chunky dark outlines (about 4 px at this canvas size)
- flat shading in two or three tones per colour, lit from the upper left
- no gradients, no blur, no anti-aliased soft edges
- a fully transparent background

## A prompt to start from

> Pixel art sprite sheet, transparent background, 1254×1254. A cute pink ice cream van called "PINKY'S" in SNES-era 16-bit style with chunky dark outlines and flat two-tone shading, lit from the upper left. Top row: the same van twice in true 2:1 pixel isometric view, long side running from upper left to lower right, front bumper and windscreen at the lower right, serving-window side facing the viewer. Left: serving window open showing ice cream tubs inside. Right: identical van with a cheerful cartoon ice cream man with grey curly hair and a white shirt leaning out of the window holding a 99 cone with a chocolate flake. Bottom row: the same van in a flat side view with round wheels and the ice cream man leaning out. Cream stripe along the body, oval PINKY'S sign above the window, small pink roof light, orange indicators. No background, no shadows, nothing overlapping.

When it's ready, save it as `assets/original/pinky-van-iso.png` and ask for it to be cut in.
