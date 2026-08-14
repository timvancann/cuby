# Cuby

A fast, offline-first OLL trainer for speedcubers. Built for one job:
making last-layer recognition automatic.

**Use it: https://timvancann.github.io/cuby/** (add to home screen, works
fully offline)

## Why

I built Cuby while learning full OLL. What I wanted was simple and didn't
exist in one place: drill exactly the cases I've learned so far, see my
recognition time separately from my execution time, and do it one-handed
with a cube in the other hand. So this is that app, and nothing else.

## Standing on shoulders

Three resources shaped this app more than anything else, and they deserve
the biggest thanks:

- **[CubeHead](https://www.youtube.com/@CubeHead)** — the case content,
  groups, and learning order come straight from the excellent "How to Learn
  OLL in One Month" guide. If you're learning OLL, start there.
- **[Cube Academy](https://www.cube.academy/)** — the gold standard for how
  cube algorithms and notation should be presented. Its clarity was the
  benchmark for every reference screen in this app.
- **[Best Site Ever](https://bestsiteever.net/oll/)** — the original
  inspiration for actually training and drilling OLL, and proof that
  scramble-based case drilling works. Cuby is my attempt to give that idea
  a modern, phone-first feel.

## What it does

- **Train** — verified scrambles for your selected OLL cases, with separate
  recognition and solve timings. A dry mode shows the case on a 3D cube or
  as a symbol for pure recognition practice, at any angle.
- **Timer** — a proper speedcube timer with WCA random-state scrambles,
  plus a CFOP mode that splits Cross, F2L, OLL and PLL with editable phases.
- **Cases** — all 57 OLL cases grouped by shape. Long-press any case for a
  step-through 3D animation of its algorithm, and override algorithms with
  your own (validated: they must actually solve the case).
- **Stats** — ao5 through ao100 with csTimer-style trimming, per-case
  recognition and solve breakdowns, and full export/import of your history.

## How it's built

Svelte 5, TypeScript, Vite, Dexie. Every scramble and every algorithm in
the app is verified in CI against a from-scratch cube model: a typo in the
data fails the build before it can teach you anything wrong.

## Develop

    npm install
    npm run dev      # dev server
    npm test         # unit tests
    npm run verify   # re-verify all case data and scramble pools
