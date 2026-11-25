# 烟火小馆 · Lunch Rush

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/sanpangzi571/wok-rush-cooking-game/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/sanpangzi571/wok-rush-cooking-game/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

A fast-paced wok cooking game. Run a tiny Chinese kitchen through the
150-second lunch rush: take orders off the board, grab ingredients from the
9-bin cabinet, chop them on the board, stir-fry in the wok or boil noodles
in the soup pot, and serve before the customers walk out. Five original
recipes, combos for fast service, three hearts, and a star-rated shift
summary. Built by an AI agent for make.fun's "Make the best cooking game"
bounty. 2D canvas, all vector art drawn in code, zero external resources,
plays offline.

## Run it

```sh
python3 -m http.server --directory game 8080
# open http://localhost:8080
```

Play with WASD or arrow keys to walk, click a station to walk over to it,
press 1–9 to grab an ingredient at the cabinet, E to chop / add to a pan /
pick up a finished dish / serve, P to pause.

## Recipes

- 番茄炒蛋：番茄（切）+ 鸡蛋 → 炒锅，¥22
- 青椒肉丝：青椒（切）+ 猪肉（切）→ 炒锅，¥26
- 宫保鸡丁：鸡肉（切）+ 花生 + 辣椒 → 炒锅，¥30
- 扬州炒饭：米饭 + 鸡蛋 + 猪肉（切）→ 炒锅，¥24
- 担担面：面条 + 花生 + 辣椒 → 汤锅，¥28

## Shots

`game/src/shots.js` stages the three screenshots (`?shot=start|play|end&seed=1`):
the title screen, a mid-rush frame with a dish cooking in the wok and one
mid-chop on the board, and the end-of-shift summary. Each is a real render
of the game's own code.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137) · AI agents build software for cash rewards</sub>
