"""Apply the two game balance rules to an existing Curb Fighters checkout."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
p = root / 'source' / 'game.js'
if not p.is_file() or not (root / 'docs' / 'SPEC.md').exists():
    raise SystemExit('Run from an existing Curb Fighters repository (tools/ folder).')
s = p.read_text()
if 'PINKY_LEADER_BITE_VALUE' in s or 'halfwayScale:' in s:
    raise SystemExit('Balance update already appears to be applied; no files changed.')
def rep(a,b):
    global s
    count = s.count(a)
    if count != 1:
        raise RuntimeError('Unexpected source near: ' + a[:65] + ' (matches: ' + str(count) + ')')
    s = s.replace(a,b)

# Number of successful halfway 5-point shots in the current uninterrupted scoring streak.
# The first 5-point ATTEMPT keeps existing dimensions; each scored 5 tightens the *next* shot.
rep('  green: (halfway) => halfway ? { power: [.42, .64], aim: [.41, .59] } : { power: [.50, .84], aim: [.36, .64] },', '''  // A successful 5-pointer makes the next halfway attempt tougher: 15% of the
  // original width per extra shot, capped at 40% to keep a realistic sweet spot.
  halfwayScale: (fiveStreak = 0) => Math.max(.4, 1 - .15 * Math.max(0, fiveStreak)),
  green: (halfway, fiveStreak = 0) => {
    const base = halfway ? { power: [.42, .64], aim: [.41, .59] } : { power: [.50, .84], aim: [.36, .64] };
    if (!halfway || fiveStreak === 0) return base;
    const scale = Rules.halfwayScale(fiveStreak);
    const shrink = ([lo, hi]) => { const mid = (lo + hi) / 2, half = (hi - lo) * scale / 2; return [mid - half, mid + half]; };
    return { power: shrink(base.power), aim: shrink(base.aim) };
  },''')
rep('  fringe: (halfway) => halfway ? .03 : .04,', '''  fringe: (halfway, fiveStreak = 0) => halfway ? .03 * Rules.halfwayScale(fiveStreak) : .04,''')
rep('  judge(power, aim, halfway, boosted, roll = Math.random()) {\n    const g = Rules.green(halfway), fr = Rules.fringe(halfway);', '''  judge(power, aim, halfway, boosted, roll = Math.random(), fiveStreak = 0) {
    const g = Rules.green(halfway, fiveStreak), fr = Rules.fringe(halfway, fiveStreak);''')
rep('  cpuPlan(halfway, rng = Math.random) {\n    const z = Rules.green(halfway), success = rng() < (halfway ? .53 : .65);\n    let power = z.power[0] + .02 + rng() * (z.power[1] - z.power[0] - .04);\n    let aim = z.aim[0] + .025 + rng() * (z.aim[1] - z.aim[0] - .05);', '''  cpuPlan(halfway, rng = Math.random, fiveStreak = 0) {
    const z = Rules.green(halfway, fiveStreak), success = rng() < (halfway ? .53 : .65);
    // Keep the CPU's aiming margins proportional to the increasingly tight zone.
    const pMargin = (z.power[1] - z.power[0]) * .09;
    const aMargin = (z.aim[1] - z.aim[0]) * .14;
    let power = z.power[0] + pMargin + rng() * (z.power[1] - z.power[0] - 2 * pMargin);
    let aim = z.aim[0] + aMargin + rng() * (z.aim[1] - z.aim[0] - 2 * aMargin);''')
rep('  match: { player: 0, scores: [0, 0], halfway: false, winner: null },', '  match: { player: 0, scores: [0, 0], halfway: false, fiveStreak: 0, winner: null },')
rep('  m.player = 0; m.scores = [0, 0]; m.halfway = false; m.winner = null;', '  m.player = 0; m.scores = [0, 0]; m.halfway = false; m.fiveStreak = 0; m.winner = null;')
rep('  if (G.boost[p] && m.halfway) m.halfway = false; // a 99 BOOST throw always starts from the curb', '''  if (G.boost[p] && m.halfway) { m.halfway = false; m.fiveStreak = 0; } // 99 BOOST always starts a fresh curb streak''')
rep('  const outcome = Rules.judge(G.power, G.aim, m.halfway, boosted);', '  const outcome = Rules.judge(G.power, G.aim, m.halfway, boosted, Math.random(), m.fiveStreak);')
rep('  if (o && o.points) m.halfway = true; else { m.player = 1 - m.player; m.halfway = false; }', '''  if (o && o.points) {
    // 10/30-pointer resets the difficulty; consecutive 5s progressively tighten it.
    m.fiveStreak = o.points === 5 ? m.fiveStreak + 1 : 0;
    m.halfway = true;
  } else {
    m.player = 1 - m.player; m.halfway = false; m.fiveStreak = 0;
  }''')
rep('  const g = Rules.green(m.halfway), fr = Rules.fringe(m.halfway), d = Rules.gold(boosted);', '  const g = Rules.green(m.halfway, m.fiveStreak), fr = Rules.fringe(m.halfway, m.fiveStreak), d = Rules.gold(boosted);')
rep('G.cpuPlan = Rules.cpuPlan(G.match.halfway);', 'G.cpuPlan = Rules.cpuPlan(G.match.halfway, Math.random, G.match.fiveStreak);')

# Pinky handicap: determine once when race begins, based on score at van arrival.
rep('const PINKY_BITES = 24;', '''const PINKY_BITES = 24;
const PINKY_LEADER_BITE_VALUE = .7; // 30% slower eating when leading by >=20 points''')
rep('  G.pinky = { stage: \'heard\', stageStart: G.clock, bites: [0, 0], lastTap: [-1e9, -1e9], winner: null, wonAt: null, post };', '''  const scores = G.match.scores;
  const handicapped = Math.abs(scores[0] - scores[1]) >= 20 ? (scores[0] > scores[1] ? 0 : 1) : null;
  G.pinky = { stage: 'heard', stageStart: G.clock, bites: [0, 0], lastTap: [-1e9, -1e9], handicapped, winner: null, wonAt: null, post };''')
rep('  e.lastTap[p] = G.clock; e.bites[p]++;', '''  e.lastTap[p] = G.clock;
  // Keep fractional progress for the score bar, cone animation and winner check.
  e.bites[p] = Math.min(PINKY_BITES, e.bites[p] + (e.handicapped === p ? PINKY_LEADER_BITE_VALUE : 1));''')


p.write_text(s)
spec = root / 'docs' / 'SPEC.md'
spec_text = spec.read_text()
append = """
**Fairness — long halfway streaks.** Following a 10-point curb hit, the first halfway 5-point shot uses the original power and aim sweet spots. Every successful 5-point shot in that uninterrupted turn narrows both green zones (and their yellow fringes) for the following attempt by 15 percentage points of their original width, down to a minimum of 40%. The difficulty resets on a miss, a new 10/30-point curb hit, a new match, or a Pinky boost that sends the thrower back to their own curb. CPU opponents follow the same zones.

**Fairness — Pinky's catch-up.** At the moment Pinky's van arrives, a score gap of 20 or more handicaps the *leading* player only: each of their bites advances the ice cream race by 0.7 rather than 1. The trailing player's bites remain at 1. The same rule applies to the CPU, and the race bars, cone animation and winner check use fractional progress. Equal scores or a smaller gap use normal bites for both.
"""
if '**Fairness — long halfway streaks.**' not in spec_text:
    spec.write_text(spec_text.rstrip() + '\n' + append)
print('Balance update applied to source/game.js and docs/SPEC.md. Commit and push from GitHub Desktop.')
