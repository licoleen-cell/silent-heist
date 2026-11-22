[![make.fun bounty](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/licoleen-cell/silent-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/licoleen-cell/silent-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# Silent Heist

A top-down stealth heist in a plain canvas, played with a keyboard and a mouse. You are a thief
in the Meridian Museum after closing. The Moonfall Diamond is in the strongroom at the east end
of the building, five guards walk their rounds, five cameras sweep the walls, and one alarm meter
decides whether the night ends with a clean exit or a hand on your shoulder.

No build step, no library, no network request: `game/` is static files and `game/index.html`
opens and plays in desktop Chrome.

## Play it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open <http://localhost:8080> and press **Enter**.

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | move |
| `Shift` | sprint (fast, loud) |
| `Ctrl` or `C` | crouch (slow, silent, harder to see) |
| hold `E` | lift the loot you are standing at |
| `1` `2` `3` `4` | smoke canister, decoy coin, EMP spike, signal jammer |
| mouse | aim where a thrown tool lands |
| `P` / `Esc` | pause |
| `R` | restart the night |

## The rules of the house

- **Vision cones.** Each guard carries a cone that walls and display cases cut short. Walk into
  one and his suspicion climbs; hold there and he chases, and a guard who reaches you shoves you
  off and spikes the alarm. Crouching shrinks the range at which you are spotted.
- **Cameras.** Five wall cameras sweep a fixed arc. A camera that holds you for a moment locks on
  and calls the nearest guard to your position. The EMP darkens every camera in its ring.
- **The alarm meter.** It climbs while you are seen, by a guard or a camera, and falls again when
  you break line of sight. Past *suspicious* guards start looking; past *lockdown* every guard on
  the floor converges on you; at 100 the night is over. The jammer holds the meter still.
- **The loot.** Seven pieces sit on plinths, each worth its own money. The diamond is the job:
  the loading bay will not let you out without it. Everything else is score.
- **The way out.** The gap in the west wall is the loading bay. Reach it with the diamond and the
  night ends clean; the score adds a time bonus, a ghost bonus if no one ever saw you, and
  subtracts for the alarm you left behind.

## What is in the box

```
main.ts                  copies game/ and screenshots/ to the output dir, writes dossier.json
serve.ts                 a tiny static server for game/, for local play
vendor/makefun-game.ts   the kit's library, unchanged (buildDossier)
game/index.html          the page
game/src/config.js       tuning constants, palette, tool catalogue
game/src/level.js        the floor plan: rooms, walls, cover, loot, patrols, cameras
game/src/geometry.js     ray casting, vision cones, circle-vs-solid collision
game/src/sim.js          the heist: thief, guards, cameras, alarm, loot, tools, scoring
game/src/render.js       the museum: floors, walls, cones, people, cameras, effects
game/src/hud.js          alarm meter, clock, take, tool belt, manifest, briefing, results
game/src/main.js         canvas, input, fixed-step loop, staged screenshot scenes
screenshots/             three renders of the running game, the first the cover
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json` with
`buildDossier` from `vendor/makefun-game.ts`. Inside the grader the output directory is `/output`.

Screenshots are the game's own renders, staged by `?shot=<name>` in `game/src/main.js`: `play`
(the Long Gallery mid-job), `vault` (the strongroom with the diamond in reach) and `end` (the
result screen after a clean exit). Each stage steps the real simulation and then freezes it, so
the guards, cones, cameras and meter in a screenshot are a real state of the game.

## Licence

MIT. See `LICENSE`.
