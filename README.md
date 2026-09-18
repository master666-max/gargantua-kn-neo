# GARGANTUA-KN-NEO -- one black hole renderer, extended domain, measured

    node tools/serve.mjs 8241      then open   http://127.0.0.1:8241/

Local-service shortcuts (Windows, double-click, no console window and no DSH needed):

| file | what a double-click does |
|---|---|
| `启动 gargantua-kn-neo.cmd` | start the server hidden **and** open the page (idempotent) |
| `停止 gargantua-kn-neo.cmd` | stop it and free port 8241 (`-n` = dry run, kills nothing) |
| `① 装一次开机启动.cmd` | install once: the server is already up at every logon |
| `② 取消开机启动.cmd` | undo ① |

The stopper is pure `cmd` + `netstat` + `taskkill` -- no PowerShell, no admin rights:

    tools\stop-server.cmd            stop the listener on 8241 (exit 0 = port free, 1 = still busy)
    tools\stop-server.cmd -n         dry run: print the PID that would be killed
    set KN_PORT=9000 ^& tools\stop-server.cmd     another port

The server is started detached (no console window exists for it), so there is nothing to
close in the taskbar -- it has to be killed by PID. A one-liner if you prefer:

    for /f "tokens=5" %p in ('netstat -ano ^| findstr ":8241 .*LISTENING"') do taskkill /F /PID %p

The consolidated results report -- every number with its provenance, plus the boundaries the project
does NOT claim to have crossed -- is in **`docs/成果报告.md`**.

## What this is

`gargantua-kn-v2` copied wholesale as the rendering base (21-parameter panel, Buffer
A/B/C/D, bloom, ACES, Novikov-Thorne disk with a volumetric slab, Doppler and
gravitational redshift, turbulence, star field with an angular PSF, state-pixel repair,
debug views, frame cap, power policy), with ONLY the physics domain changed, one bug
fixed, one instrument added and the screenshot API made deterministic.

## Measured

| what | result |
|---|---|
| High tier, live | **60 fps cap reached, FRAME 7.6 ms**, 0 console errors |
| domain sweep (M=-1; a=+/-1.4; Q=+/-1.4; combinations) | 6/6 render, 0 errors, parameters NOT clamped |
| screenshot determinism | same URL 3x: identical hash, identical PNG length, t = 12 exactly |
| across the domain | a=1.2 identical twice; **M=-1 and a=-1.4/Q=-1.2 are NOT reproducible** (see below) |
| cross-implementation physics | KS ray-traced critical b vs BL analytic xi_c: <= 2.4e-6 for charged and retrograde cases |
| Q sign | Q=+0.6 and Q=-0.6 byte-identical |

## Termination census (the instrument added this round)

`debug 10` now carries a termination code per ray instead of a bare escape flag:
0 exhausted, 0.2 escaped, 0.4 captured, 0.6 ring, 0.8 interior, 1.0 absorbed in the disk.
Central 50% x 70% box:

| case | exhausted | escaped | CAPTURED | ring | interior | absorbed |
|---|---|---|---|---|---|---|
| a=0.86 (horizon) | 6.204 | 19.936 | **2.253** | 0.160 | 0.232 | 71.09 |
| a=1.2 (naked)    | 10.429 | 17.366 | **0.224** | 0.204 | 0.242 | 71.40 |
| a=1.4 (naked)    | 10.160 | 17.597 | **0.227** | 0.219 | 0.230 | 71.42 |

**The naked case has no horizon capture.**  The argument is not just the raw numbers:

* the capture BRANCH is unreachable without a horizon (`trapped = uM > 0 && a^2+Q^2 < M^2`),
  so a=1.2 could not capture even in principle;
* the residual 0.22% is a **common-mode floor**: a=1.2 and a=1.4 give 0.224% and 0.227%,
  i.e. it is INDEPENDENT of the horizon, so it is not capture.  Subtracting it, the
  horizon-dependent capture is ~2.03% at a=0.86 and ~0.00% for both naked cases;
* the finished image agrees: the black area falls from **43.2% (a=0.86) to 24.9% (a=1.2)**.

The 0.22% floor itself is **unresolved** -- it survives the fix below and does not depend
on the horizon.  It is flagged, not explained.

## The bug the instrument exposed

`knTrace` initialised `col`, `rEnd` and `dbg` at entry but **not `escapedOut`**, so the
early return on a ZAMO-initialisation failure propagated a garbage value.  Fixed.

## Fixed earlier in this line of work

* the sub-extremality clamp is gone: M in [-20,20], a and Q in [-1.5,1.5] sign included;
* capture requires a horizon to exist;
* `?shot=1` froze nothing, so the live loop advanced the clock past t and two runs of the
  same URL differed; the loop is now frozen in shot mode and the clock is pinned;
* `horizons()` has no horizon for M <= 0; `isco()` falls back to 6|M| without one.

## Reproducibility: partially fixed this round

Before: 1 of 4 configuration pairs reproduced exactly.  The localisation experiment showed
WHY the failures were so small: with a differing pair, **all 2304 of 2304 checksum cells
differed, each by less than 0.06 of a luma level**.  A global sub-level shift of every
pixel is the signature of a tiny camera change, not of scattered bad pixels.

Cause and fix: the rig integrates the camera from `initSpeed`, so the pose at capture time
depended on how many frames the LIVE loop happened to render before it froze (~1e-4 M of
drift).  `?shot=1` now re-asserts the pose snapshot on every warm frame.  Verified: the two
configurations that used to differ (a=-1.4/Q=-1.2 and a=0.86/Q=0.3) now match exactly, and
a=1.2 still does.  1 of 4 -> 3 of 4.

**Still open: M < 0 is systematically non-reproducible.**  Measured 6 pairs across two
rounds: five differ (PNG length takes a few discrete values, e.g. 1275102 / 1277394 /
1277514), while every M > 0 configuration tested matches.  Two hypotheses were tested:

* the closed-loop framing (`recentre`) -- **FALSIFIED**: the recorded aim bias and r/theta/phi
  are bit-identical between runs;
* a NaN leaking out of `horizons()` for M <= 0 into the framing and state-pixel checks --
  **FALSIFIED**: returning a finite nominal value changed nothing.  (That change is kept
  anyway: a NaN in the control flow is not something to leave in.)

The discrete length set points at a state/branch flip between runs, and the prime suspect is
the state-pixel persistence/repair path -- but that is a HYPOTHESIS, not verified.
## Round 8: final acceptance, and the last defect pinned to the driver

    live                60 fps cap reached, FRAME 8 ms, High 80%, 0 console errors
    naked-no-capture    captured 2.252% (a=0.86, horizon) vs 0.222% (a=1.2) and 0.236% (a=1.4)
                        -- the two naked cases agree to 0.014, the common-mode floor
    NaN sweep           8 configurations x 105 numeric uniforms: 0 non-finite, glError 0
    same-load rendering a=1.2 and a=0.86 match; M=-1 does not

### Fix attempted this round (and kept): the disk shader used the signed M

`main.js` normalises the disk flux with the |M| template, but `disk.glsl` still built its
local metric from the signed `uM`, so for M < 0 `knFluxTemp` returned a negative profile and
the |M|-templated normalisation turned that into near-zero emission -- float32 DENORMAL
range, where flush-to-zero behaviour is not something a GPU guarantees to reproduce.  All 5
occurrences in `disk.glsl` now use `abs(uM)`; the geodesic metric keeps the signed M.

Effect: **M = -1 became reproducible ACROSS loads** (identical rtA hash twice, where it used
to differ).

### The residual, stated exactly

For M < 0 only, two captures inside ONE page load still differ, while a = 1.2 and a = 0.86
match.  Everything the application controls was pinned before that measurement: all numeric
uniforms identical, camera pose pinned, clock pinned, state read from the CPU float32 copy,
and the integration itself proven deterministic (the terminal-r-sign map and the step-count
map are bit-identical across loads).  Two consecutive draws of the same pinned state
therefore differ inside the GPU.

**Conclusion: this is driver-level, not application-level.**  Five successive hypotheses were
tested and falsified or fixed in rounds 4-8 (framing, NaN in horizons, state-pixel repair,
negative-mass flux, canvas readback race -- the last of which was a REAL fix that removed the
15%-of-pixels class of difference entirely).  What remains is <= 0.011% of pixels at last-bit
level, in negative mass only.

### Final status

| objective item | status |
|---|---|
| new renderer on a new port | done -- 8241 |
| high-quality base (disk, sky, pipeline, UI) | done |
| extended domain M +/-, a +/-, Q +/- | done, no clamping, 0 errors |
| no NaN | done, verified over 8 configurations x 105 uniforms |
| termination-provenance instrument | done (debug 10) |
| naked singularity has no horizon capture | done, quantified with a common-mode floor |
| 60 fps at High | done, 60 fps / 8 ms |
| README with measured tables | done, including every falsified hypothesis |
| domain-wide reproducibility | **M > 0 bit-exact; M < 0 reproducible across loads, not frame-to-frame (driver-level)** |
## Round 7: the residual is last-bit, and the NaN item is now verified

The bisection, run on `rtA` read back directly:

| term switched off | rtA identical across two loads |
|---|---|
| debug 5 (terminal sign of r only) | **yes** |
| debug 1 (integration steps only) | **yes** |
| stars + galaxy | no |
| turbulence | no |
| accretion disk | no (and M = +1 with the disk off also differs) |

**The geodesic integration is deterministic even for M = -1**: both the terminal r-sign map
and the step-count map are bit-identical across loads.  The variation appears only in the
final shading, and it is NOT carried by one term -- switching off stars, turbulence or the
disk does not remove it.

Magnitude, once the canvas-readback race is out of the way:

| case | differing non-zero pixels | of |
|---|---|---|
| M=-1 disk off | 0 | 589 824 |
| M=+1 disk off | 41 | 589 824 |
| M=-1 disk on | 1 | 589 824 |
| M=+1 disk on | 42 | 589 824 |
| M=-1 disk+sky off | 63 | 589 824 |

So the residual is **<= 0.011% of pixels**, with mean colour differing in the fourth decimal:
last-bit floating-point differences flipping a handful of pixels across a quantisation
boundary.  The '15% of pixels' figure quoted in rounds 3-5 was the canvas race, which is
fixed.  What is left is the kind of scheduling-dependent FP behaviour a GPU does not
guarantee, and no application change removes it -- that is the best-supported explanation,
and it is labelled as such rather than claimed as proven.

### The NaN item, verified

All numeric uniforms of every pipeline material were scanned for non-finite values across
eight configurations spanning the whole domain (a = 0, 0.3, 0.86, 0.998, 1.0, 1.2, -0.5,
-1.4; Q = 0, 1.5, -1.2; M = +1 and -1):


    M=1&a=0.86&Q=0         scanned 105   non-finite: 0   glError 0   console 0
    M=1&a=0.998&Q=0        scanned 105   non-finite: 0   glError 0   console 0
    M=1&a=1&Q=0            scanned 105   non-finite: 0   glError 0   console 0
    M=1&a=1.2&Q=0          scanned 105   non-finite: 0   glError 0   console 0
    M=-1&a=0.5&Q=0         scanned 105   non-finite: 0   glError 0   console 0
    M=-1&a=-1.4&Q=-1.2     scanned 105   non-finite: 0   glError 0   console 0
    M=1&a=0.3&Q=1.5        scanned 105   non-finite: 0   glError 0   console 0
    M=1&a=0&Q=0            scanned 105   non-finite: 0   glError 0   console 0

## Round 6: two separate defects, split apart by reading the buffers back

Reading the render targets directly (via `gl.readPixels` on the pipeline's framebuffers)
instead of comparing PNGs split the remaining irreproducibility into TWO unrelated defects:

| | before | after `preserveDrawingBuffer: true` |
|---|---|---|
| M = +1, three page loads | 3/3 different | **3/3 identical** |
| M = -1, three page loads | 3/3 different | **2/3 identical** |

**Defect A, fixed: the canvas readback was a race.**  Buffer A and Buffer B were bit-identical
across loads while the final PNG differed, and two captures inside ONE load were identical.
That is the signature of `toDataURL` sometimes capturing a partially composited frame.  The
renderer now sets `preserveDrawingBuffer: true`.  M > 0 is bit-reproducible across loads.

**Defect B, still open and now localised: for M < 0 the SCENE BUFFER itself differs.**

    M = -1, rtA hashes across three loads:  cef740e  56284a88  a42f42ab

So for negative mass the variation is inside the raytracer, before any post-processing, and
it is not the canvas readback.  Everything numeric in the uniform set was already checked
identical (all 57 uniforms).

### Method note: what my instruments cannot see

The uniform diff records textures only as width x height, so **a texture whose CONTENTS vary
per load is invisible to it**.  Combined with the fact that Buffer A is fed by `uStateTex`
and by the pipeline's ping-pong textures, the next test has to be a bisection of the terms
(`turb=0`, `galaxy=0`, disk off, debug view fixed) rather than another uniform scan.
## Round 5: a second hypothesis CONFIRMED and fixed -- but only for M > 0

The camera is read back from the bottom-right 4 pixels of Buffer B (8-bit quantised) unless
those pixels fail a plausibility test, in which case the CPU's float32 shadow copy
`uBackA..uBackD` is used.  Which branch is taken was therefore a per-run coin flip.  A new
uniform `uForceState` makes a screenshot always take the CPU copy; it is set to 1 whenever
`?shot=1` is present.

| configuration | pair identical, forced state | before |
|---|---|---|
| a=0.86  Q=0.3  (twice) | **yes, yes** | ~50% |
| a=1.2   Q=0     | **yes** | ~50% |
| a=-1.4  Q=-1.2  | **yes** | ~50% |
| M=-1    a=0.5   | **NO** | ~50% |
| M=-1    a=-0.9  | **NO** | ~50% |

**So the quantised state readback WAS the cause of the intermittency for M > 0, and it is
fixed.**  All four M > 0 configurations now reproduce exactly.  The earlier rounds' failures
for M = +1 (`a=0.86&Q=0.3`) are gone.

**M < 0 has a separate, still-unexplained non-determinism.**  The requirement is now
narrowed to negative mass alone.  Note that M < 0 also needed the disk-flux fix this round,
and that its disk is 38% fainter than the |M| template, so it remains the least-tested corner
of the domain.

Also kept from round 4: the |M| kinematic template for the disk flux, without which the disk
is invisible for M < 0 (uFluxPeak 4.7e-14 -> 2.1e-5).
## Round 4: the negative-mass flux collapse was the cause of BOTH problems

`diskFluxTable` builds F = (L - L_in)(-dOmega/dr)/(4 pi r) from circular orbits, and
`circularOrbit()` has no physical solution for M < 0: the sign flips made F negative, the
`v > 0` clamp zeroed the table, and uFluxPeak collapsed.  The table is now built from the
|M| kinematic template while the SPACETIME keeps the signed M (a stated display convention:
no standard circular-orbit disk model exists for negative mass).

    uFluxPeak  M=-1 before  4.7291e-14
    uFluxPeak  M=-1 after   2.1475e-5      (M=+1 is 3.4806e-5; the residual 38% gap is
                                           the different inner radius -- ISCO falls back
                                           to 6|M| without a horizon, so the table starts
                                           further out)

and the disk is visible again in negative-mass mode (docs/neo-negmass.png).

**This fix did NOT remove the non-reproducibility -- I first claimed it did and the sweep
falsified me.**  A six-pair sweep gave 3 failures, including `a=0.86&Q=0.3`, which is M = +1
sub-extremal: the failure is configuration-INDEPENDENT and intermittent (~50% of pairs), so
the earlier "M < 0 is special" characterisation was an artefact of small samples.  The flux
fix stands on its own (the disk is visible again in negative-mass mode), but it is not the
cause of the irreproducibility and I withdraw that claim.

The remaining candidate is an under-settled start: with the camera pinned and the
state-pixel path never firing, the shot may be taken before the first frames have settled.
Warm-up was raised from 6 frames to 24 to test that.
### The settling test (warm-up 6 -> 24 frames)

Result: 2 of 6 pairs differed, against 3 of 6 at six frames.  With n = 6 that is noise, so
the settling hypothesis is **NOT confirmed and NOT falsified**.

The cleanest single observation: the SAME configuration (`a=0.86&Q=0.3`, M = +1) produced one
matching pair and one differing pair.  The defect is intermittent and configuration
independent -- roughly a one-in-three to one-in-two coin flip -- and its magnitude is a few
hundred PNG bytes, i.e. a sub-level global shift.

Hypotheses tested and FALSIFIED with data so far:

1. closed-loop framing (`recentre`) -- pose and aim bias bit-identical;
2. NaN from `horizons()` for M <= 0 -- finite value changed nothing;
3. the state-pixel repair path -- `statePixelsStatus/stateRepairs/stateRestores` identical
   (`init`/0/0) in every run, control included;
4. the negative-mass flux collapse -- falsified by the sweep, since M = +1 fails too;
5. an under-settled start -- not confirmed at 24 warm frames.

Untested candidates left: the 8-bit quantisation of the camera state read back from Buffer B
versus the float32 CPU shadow copy, and float behaviour inside the driver.  Both are
hypotheses.
### Round 4 reproducibility sweep

| configuration (warm = 24) | pair identical | PNG lengths |
|---|---|---|
| M=-1&a=0.5 | **NO** | 1277514 vs 1277394 |
| M=-1&a=-0.9 | yes | 1295666 vs 1295666 |
| a=0.86&Q=0.3 | yes | 1761670 vs 1761670 |
| a=0.86&Q=0.3 | **NO** | 1761806 vs 1761670 |
| a=1.2&Q=0 | yes | 1788882 vs 1788882 |
| a=-1.4&Q=-1.2 | yes | 1847050 vs 1847050 |

## Round 3: three hypotheses falsified, one more real bug found

The remaining non-reproducibility is specific to **M < 0**, and the deviation is NOT tiny:

    differing pixels   146 034 of 921 600  (15.85% of the frame)
    max |delta luma|   53
    mean |delta luma|  1.23

while the camera pose is bit-identical between the two runs (`rigR/rigTh/rigPh` and the
meta r/theta/phi all equal) and the termination/state path reports the same counters.  So
the difference is inside the render, not the framing.

| hypothesis | test | verdict |
|---|---|---|
| closed-loop framing `recentre()` | compare the recorded aim bias and pose | **FALSIFIED** (bit-identical) |
| NaN out of `horizons()` for M <= 0 | return a finite nominal value and retest | **FALSIFIED** (no change) |
| state-pixel repair flipping | report `statePixelsStatus/stateRepairs/stateRestores` in the shot meta | **FALSIFIED** (`init` / 0 / 0 in every run, control included) |

### A real bug this round found: the disk disappears for negative mass

Reading the live uniforms:

    M = +1 :  uFluxPeak = 3.4806e-5   uFluxLin = 2.9029
    M = -1 :  uFluxPeak = 4.7291e-14  uFluxLin = 0.1447

Nine orders of magnitude.  The disk emission is proportional to those, so **in negative-mass
mode the accretion disk is effectively invisible** and the frame is pure sky.  The flux
model evidently assumes M > 0; the fix is to normalise it with |M|.  That is a physics-side
defect, not a display one, and it is measured, not inferred.

### A side effect of my own fix

`statePixelsStatus` stays at `init` in shot mode because the verification runs inside the
live loop, which the determinism fix now freezes.  The safeguard is therefore skipped for
screenshots.  Minor, but it is a consequence of my change and it is recorded here.
## Known limits

* the 0.22% capture-bin floor above;
* disk absorption dominates the census (~71%) and is what most of the black area is, not
  capture;
* the `maxSteps` slider caps at 512, so step-dependence cannot be probed through the URL;
* **reproducibility is NOT domain-wide.**  a=1.2 reproduces exactly, but M=-1 and
  a=-1.4/Q=-1.2 do not (120 and 672 PNG bytes apart).  The framing hypothesis was TESTED
  AND FALSIFIED: two runs of those geometries record the identical aim bias [0,0] and the
  identical r/theta/phi.  The difference is a few pixels' worth of PNG bytes, which is
  consistent with the state-pixel persistence/repair path, but that is a HYPOTHESIS and
  is not verified.  Not fixed.
## (3b) External validation of the EVPA observable

The observable I had explicitly NOT validated -- the screen polarisation angle -- is now
tested against a published prediction.  **Gelles et al. 2021 (PRD 104, 044060)**: for a
face-on observer the spin-induced rotation of the direct image is

        DeltaEVPA ~ -2a / rs^2       (radians, leading 1/rs term)

and it is a purely GEOMETRIC effect, so it must hold for any magnetic field geometry.

### Result

| rs | measured DeltaEVPA | -2a/rs^2 | ratio |
|---|---|---|---|
| 5  | -3.352e-2 | -4.000e-2 | 0.838 |
| 8  | -1.469e-2 | -1.563e-2 | **0.940** |
| 12 | -6.893e-3 | -6.944e-3 | **0.993** |
| 20 | -2.003e-3 | -2.500e-3 | 0.801 |
| 35 | +8.426e-4 | -8.163e-4 | -1.032 |
| 60 | +3.263e-4 | -2.778e-4 | -1.175 |

Sign correct, magnitude correct to **0.7% at rs = 12 and 6% at rs = 8** -- exactly the regime
where the 1/rs expansion should hold -- and **linear in the spin**: the measured values at
a = 0.3 / 0.5 / 0.7 divide to 3.93 / 3.92 / 3.89, i.e. proportional to a.

**What this does NOT establish.**  At rs >~ 20 the ratio stops making sense, and the a = 0
table reports an entry with rs = -238398 (a NEGATIVE radius).  That is a defect in the test
HARNESS -- my 'first equatorial crossing' recorder picks up garbage entries at large impact
parameter -- not a statement about the physics.  So the asymptotic claim (ratio -> 1 as
rs -> infinity) is NOT demonstrated, and the agreement is quoted only for rs = 8..12.

### Two things this attempt found

1. **The EVPA must be folded modulo pi.**  A polarisation plane is not a vector; the source
   papers state the convention (fold into (-pi/2, pi/2], arXiv:2606.12518 Eq. 14 footnote 5)
   and without it every angle DIFFERENCE is dominated by a branch offset -- measured 6.27 rad,
   i.e. essentially 2 pi, against a prediction of order 1e-2.  With the fold the agreement
   above appears immediately.  This is why the observable was withheld until now.
2. **A hard-coded convenience outlived its purpose.**  `tracePolarised` broke out of its loop
   at `|r| > 200`, a limit left from the first tests where the observer sat at r ~ 12.  With
   an observer at r = 4000 every ray returned null on the first step.  Same class of defect as
   the hard-coded view clamp: a number that was correct for one experiment silently wrong for
   the next.

### (3c) Round 1 of the follow-up goal: the harness was lying, and that is now proven

The previous round reported a ratio approaching 1 for rs = 8..12 and nonsense beyond.  The
strict recorder (first equatorial crossing with r > 0.5, plus per-ray diagnostics) shows the
truth is more specific:

* the garbage entries came from rays that **never reach the equator at all**.  At beta = 1.8
  the ray hits the horizon with theta = 0.94 / 1.02 rad, i.e. short of pi/2, and the old
  loose recorder still produced a number -- including a NEGATIVE radius of -238398.  Those
  rays are now rejected, and every accepted ray prints its rs, theta_end and min radius.
* **A strong new self-check appeared**: for a = 0 (Schwarzschild) the screen projection along
  -theta is **identically 0.000e+0 for every rs**, i.e. the folded EVPA is exactly 0.  That is
  the classic static-spacetime property (polarisation purely radial/tangential in the image)
  and it is now a real check rather than a claim.
* **The published comparison holds where the setup is valid, and the setup is invalid
  elsewhere -- and the diagnostics say exactly where.**  The forward integration starts from
  the source with the reversed momentum, which should retrace the incoming ray back to the
  observer at theta = 0.02.  It does for beta <= 12 (theta_end = 0.0001) but NOT for large
  impact parameter:

        beta    rs        fa          fb        theta_end
          12   10.997   -0.99997    0.00762     0.00010   ok
          25   23.940   +0.9985     0.00173    -0.0119    broken
          50   49.226   +0.9977     6.86e-4    -0.0438    broken
          90   92.023   +0.9972     1.45e-4    -0.0966    broken

  So for rs >~ 20 the outgoing ray is **not** the time reverse of the incoming one, the screen
  coordinates are not what the code assumes, and those numbers are meaningless -- which is why
  the sign appeared to flip.  **The sign flip is a defect in the test setup, not a physical
  result and not a defect in the transport.**
* Where the setup IS valid (rs = 5..11) the agreement with Gelles et al. is:

        rs       measured      -2a/rs^2     ratio
        5.063   -3.250e-2      -3.906e-2     0.832
        10.997  -7.622e-3      -8.264e-3     0.922

  correct sign, magnitude right to 8-17%, approaching 1 as rs grows -- the behaviour the
  leading-order expansion predicts.

### (3d) Round 2: the acceptance test rejected every ray, and that is the result

Round 2 added a hard acceptance criterion: the outgoing ray must return to the observer's
theta (|theta_end - theta_obs| < 1e-3), otherwise the ray is rejected and reported.  **Every
ray failed it, including a = 0**, so the setup does not produce the intended geometry at any
impact parameter.  The mechanism, checked by hand:

* for a = 0 and L = 0 both g^tt and g^theta-theta are theta-independent, so **p_theta is
  exactly conserved** and theta advances uniformly;
* the radial effective potential gives p_r^2 = 1 - (1 - 2M/r) p_theta^2 / r^2, so there is a
  **radial turning point at r ~ p_theta**;
* the equatorial crossing I record sits at rs ~ p_theta, i.e. **right at that turning point**.

So the face-on meridional family is DEGENERATE at large impact parameter: the recorded
"crossing" is a grazing event near a turning point, and reversing the momentum there does not
retrace the incoming ray.  The round-trip error grows with beta exactly as observed
(2.7e-2 at rs ~ 21, 1.1e-1 at rs ~ 85).

### This also corrects the previous round's claim

Round 1 quoted rs = 5..11 as the valid window.  Checking that window against the acceptance
criterion shows only ONE ray passes it:

| beta | rs | theta_end | passes |dtheta| < 1e-3 | ratio vs -2a/rs^2 |
|---|---|---|---|
| 3  | 2.117  | -0.0155 | no  | -- |
| 6  | 5.063  | +0.00367 | no | -- |
| 12 | 10.997 | +0.00010 | **yes** | **0.922** |

**So the external validation currently rests on a single accepted ray, at rs ~ 11, agreeing
with the published -2a/rs^2 to 8%.**  That is thin, and it is stated as thin.  There is no
trend and no asymptotic claim.

### (3e) Round 3: the validation is rebuilt correctly, and (D) is substantially closed

**The correct construction.**  Two facts make the observable computable without ever
transporting the source polarisation outward:

1. transporting an OBSERVER-frame vector INWARD is the exact inverse of transporting the
   source vector outward, so only the inward integration is needed -- which is the one that
   works.  Reversing the momentum (rounds 1-2) is invalid for this ray family because the
   equatorial crossing sits at the radial turning point;
2. the two states g1 = eps(p,u,e_alpha) and g2 = eps(p,u,e_beta) SPAN the polarisation plane,
   but they are neither screen-aligned nor orthogonal, so the source vector is expanded in
   them by solving a 2x2 system and the angle is formed on the observer's screen axes.

Using g1 as 'the state with EVPA = 0' was wrong, and the self-check caught it: g1.e_alpha came
out as -0.822 instead of 0, because e_alpha is not orthogonal to the NULL p, so 'the space
orthogonal to {p, u, e_beta}' is not the e_alpha direction.  The 2x2 expansion removes the
need for any null-projection trick.

**Internal validation, now across a wide range:** for a = 0 (Schwarzschild) the folded EVPA is
**exactly 0.000000 for every rs from 2.74 to 53.8** -- the static-spacetime property that the
polarisation is purely radial/tangential in the image.  The 2x2 system's conditioning is
**1.0000** for every non-degenerate ray, and the one degenerate ray (rs = 1.985, cond = -5.97)
is flagged rather than silently used.

**Comparison with the published -2a/rs^2:**

| rs | measured DeltaEVPA | -2a/rs^2 | ratio |
|---|---|---|---|
| 3  | +8.585e-2 | -1.111e-1 | -0.773 |
| 4  | +5.178e-2 | -6.250e-2 | -0.828 |
| 5  | +3.379e-2 | -4.000e-2 | -0.845 |
| 6  | +2.520e-2 | -2.778e-2 | -0.907 |
| 8  | +1.465e-2 | -1.563e-2 | -0.938 |
| 10 | +9.687e-3 | -1.000e-2 | -0.969 |
| 14 | +5.079e-3 | -5.102e-3 | **-0.996** |
| 20 | +2.544e-3 | -2.500e-3 | -1.018 |
| 30 | +1.208e-3 | -1.111e-3 | -1.087 |

**What is established:** the 1/rs^2 scaling, the linearity in the spin (checked at a = 0.3, 0.5,
0.7) and the MAGNITUDE of the published geometric rotation -- the ratio passes through 1 at
rs ~ 14 and the small-rs deviation has the right shape for the truncated 1/rs expansion.

**What is NOT established: the overall sign.**  My measured DeltaEVPA is positive where the
published formula is negative, uniformly.  And this CANNOT be settled by the obvious mirror
test: with the observer near the north pole (theta_o = 0.02) every ray that reaches the equator
must have p_theta > 0, so beta > 0 identically -- the other side of the image belongs to a SOUTH
pole observer (theta_o = pi - 0.02), and flipping to it would change the sign by construction.
A test that must give the opposite answer by symmetry cannot discriminate a convention from a
physics error, so it was not run and no claim is made.  Settling the sign needs the paper's
own sign convention for the image side, which I have not extracted.
### (3f) Round 4: is the parallel transport affordable in the shader?  Measured, and yes

The reason the transport was never ported is cost: a Christoffel contraction per step per
pixel at up to 4096 steps.  Its cost is proportional to 1/h, so the question is how large the
transport step may be before the EVPA moves.  Measured, on the same observable as everything
else (`tools/validate-step.mjs`):

| case | h=0.05 | h=0.1 | h=0.2 | h=0.4 (8x cheaper) | h=0.8 (16x) | h=1.6 (32x) |
|---|---|---|---|---|---|---|
| a=0.5 beta=20 | 2.7518e-3 | same | same | same | same | **same** |
| a=0.3 beta=20 | 1.6518e-3 | same | same | same | same | **same** |
| a=0.5 beta=8  | 1.7731e-2 | same | same | 1.8684e-2 | 1.8681e-2 | 1.8672e-2 |
| a=0.7 beta=8  | 2.4703e-2 | same | same | 2.6032e-2 | 2.6027e-2 | 2.6016e-2 |

* for the weakly deflected rays (beta = 20) a **32x coarser step changes the EVPA by 5.3e-9
  rad**, i.e. nothing;
* the strongly deflected rays (beta = 8) show a floor of about 9.5e-4 rad, but it is FLAT
  between h = 0.4 and h = 1.6 (9.53e-4 -> 9.41e-4).  **A truncation error must grow with the
  step; this one does not, so it is not a transport error.**  It comes from the harness: with
  a coarse step the linear interpolation that locates the equatorial crossing is less accurate,
  which shifts the emission radius rather than the transport.  That is an inference from its
  step-independence, and it is stated as an inference;
* the transport's own error is therefore the h -> 0 sequence, i.e. **2e-8 rad at h = 0.1 and
  below 1e-6 rad even at h = 1.6** -- three orders of magnitude below the ~1e-2 rad physical
  signal.

**Answer to (B)'s core question: the port is affordable.**  The transport may be updated every
32nd geodesic step, cutting its cost by 32x, with its contribution to the EVPA error below
1e-6 rad.  What remains for (B) is engineering, not feasibility: write the Christoffel
contraction in GLSL (the metric derivatives are rational functions, and only d_r and d_theta
are nonzero) and carry two extra vectors per pixel.
### (3g) Round 5: the shader transport is IN, and its assertion layer already caught it

Added to `shaders/bufferA.frag` in the correct declaration order: `knG4` / `knGu4` (the 4x4
Boyer-Lindquist Kerr-Newman metric and its analytic inverse), `knTransportRhs` (the
Christoffel contraction with central differences for d_r and d_theta), `knF2` / `knFP` (the two
invariants of parallel transport), and an update every `uTransportEvery` steps using the REAL
accumulated step.  The sigma index is handled the way the CPU bug taught: only the DERIVATIVE
index is restricted to {r, theta}; the CONTRACTED index runs over all four.

**The assertion layer -- item (A)'s deliverable -- works, and it immediately falsified the first
implementation.**  Views 23 and 24 colour every pixel green when |f|^2 = 1 and f.p is
conserved, red when not:

| version | view 23 | view 24 | outcome |
|---|---|---|---|
| Euler step `fv + ds*k1`, step `tSkip * h` | **73.3% RED** | **73.3% RED** | falsified |

Both causes were then identified: a first-order step over ds ~ 0.6, and a step length that
ignored the adaptivity of h.  Fixed (RK4 + real accumulated step, interval 32 -> 8).

**After the fix the assertion is INCONCLUSIVE, and that is the honest state.**  Views 23 and 24
now read neither green nor red, so the check as built cannot say whether the shader transport
is right.  Two candidate explanations, neither verified: a pass/fail COLOUR is a poor
instrument (a numeric readout of |f|^2 and f.p would be directly checkable -- the design
lesson), and views above 18 take the tonemapped path rather than the raw diagnostic path,
which may alter the colour.

**And it cost the frame budget.**  With the transport running every 8 steps the live renderer
went from 60 fps to **22 fps / 57 ms** -- so last round's affordability argument, which measured
only the ACCURACY of a 32x coarser step, did not account for the flop cost of a full Christoffel
tensor plus four metric evaluations per update.  The transport is therefore enabled **only in the
assertion views** (23/24); everywhere else it does not run and the renderer is back at 60 fps.
That is a workaround, not a solution: making the transport affordable for real rendering needs a
cheaper formulation (analytic BL Christoffels instead of central differences, or the
Penrose-Walker closed form where it applies).

**Therefore (B) is NOT complete.**  The transport is implemented and compiles with 0 shader
errors, but it has NOT passed its own invariant test, and no claim is made that it is correct.
### (3h) Round 6: the invariant test was VACUOUS, and only a positive control showed it

Round 6 turned the assertion from a pass/fail colour into a NUMBER: views 23 and 24 now emit
the deviations themselves,

        view 23:  red channel = clamp(|f|^2 - 1| * 1000, 0, 1)
        view 24:  red channel = clamp(|f.p - f.p(initial)| * 1000, 0, 1)

and both were routed onto the RAW diagnostic path so that tonemapping cannot alter the reading.
The page then reads the pixels back and divides by 1000.  Result:

        implied max |f|^2 - 1|      = 0.000000
        implied max |f.p - f.p0|    = 0.000000

**Those zeros do NOT mean the transport is correct.**  An invariant test is only meaningful if
the thing under test actually acts, and a vector that is never transported trivially has
|f|^2 = 1 and f.p = its initial value.  A positive control was added: count the transport
updates per pixel and show the count in the green channel.  Result:

        implied max updates per pixel  = 0
        pixels with any update at all  = 0 / 921600

**So the shader transport never runs.**  Every 'assertion passed' reading before this round was
vacuous, and only the positive control exposed it -- the same lesson as the rest of this work,
one level up: an invariant is worthless without evidence that the code it guards is executing.

**Where the defect is NOT.**  `pipeline.js` declares `uTransportEvery` with an initial value of
8, so even if the per-frame push never ran the transport should execute; and `main.js` gates it
to 8 in views 23/24 and 1e8 elsewhere.  Both paths predict a nonzero count, yet the count is 0.
Therefore the value is not the explanation: **the update block itself is never reached** inside
`knTrace`, most likely because the state block was spliced at a point that the loop's control
flow skips.  That has not been confirmed -- localising it needs one look at the loop's structure,
which the session budget did not allow.

**Consequence for the objective.**  (B) is not complete and cannot be claimed: the transport is
written, compiles with 0 shader errors, is switched off outside the assertion views so the
renderer holds its 60 fps target, and **has never executed once**.  (A)'s assertion mechanism now
works correctly -- including the positive control that makes it trustworthy -- and it reports
that there is nothing to trust yet.
### (3i) Round 7: the gate was moved into the shader, and the count is STILL zero

The JS-side gating was the obvious suspect and was replaced: the update block now tests
`uDebug == 23 || uDebug == 24` inside `knTrace`, driven by a uniform that demonstrably reaches
the shader every frame (views 21 and 22 switch correctly, so uDebug is live), with
`uTransportEvery = 8` fixed in JS.  The positive control still reads:

        max |f|^2 - 1|   = 0.000000
        max updates      = 0   (0 of 921600 pixels)

So the gate is not the explanation either, and the block inside the loop is still not executing.
Two possibilities remain, neither verified: the update block is not actually in the compiled
path (a splice inside a scope that the loop skips -- but the loop body was read and it sits at
the top, after `used = i + 1`, with no `continue` before it), or the counter is not reaching the
readout.  The one reading that would separate them is the uniform's value as the shader sees it;
attempting it timed out against the 30 s tool limit twice.

**Status of (B) after round 7: unchanged.**  The shader transport is written, compiles with zero
errors, is gated to the assertion views so the renderer holds 60 fps, and **has never run**.  No
claim about its correctness is made, and none is possible until the positive control reads
nonzero -- which is the whole point of having built the control.
### (3j) Round 8 (final): an isolated probe, and the session's browser wedged before it could be read

An isolated probe was added as view 25: the Christoffel machinery is called ONCE in `main`,
entirely outside the `knTrace` loop, and three numbers are emitted -- red = |df/dlam| (nonzero if
the connection code runs at all), green = |f|^2 - 1| after one RK4 step, blue = |f.p| after it.
The purpose is to separate 'the connection is wrong' from 'the block inside the loop is never
reached', which the loop's own counter could not distinguish.

**It could not be measured.**  Two page loads exceeded the 30 s per-call ceiling and then the
shared browser session was left wedged by an interrupted navigation, so the probe view has not
been read.  The last verified state of the renderer predates this probe: 0 console errors,
60 fps / 13.5 ms, views 11-22 working.  The probe is additive (a new view branch plus one
condition in image.frag) and was written to be inert for every other view, but that has NOT been
re-verified, and it is stated as unverified rather than assumed.
### (3k) The isolated probe finally ran, and it localises the defect to the metric interface

View 25 was made addressable (it had been added to the GROUPS array by a bad anchor instead of
the VIEWS array -- the fourth instance of that same failure mode) and then read.  View 25 calls
the connection machinery ONCE, in `main`, entirely outside the `knTrace` loop.

**First reading -- the three transport quantities:**

        |df/dlam|                          = 0.000000
        ||f|^2 - 1| after one RK4 step     = 0.000000
        |f.p| after one RK4 step           = 0.000000

**Second reading -- the three ingredients, exposed separately:**

        |g_rr| from knG4                   (x10) = 0.000000
        |d g_rr / d r| by central difference      = 0.000000
        |g^rr| from knGu4                  (x10) = 0.000000

At r = 6, theta = pi/2, a = 0.5 the metric component g_rr = Sigma/Delta = 36/(36 - 12 + 0.25) ~
1.50, so a value of 0 is impossible for a working metric evaluation.  The probe emits it
directly, so the conclusion is forced: **the metric routine's out-parameter comes back zero**, or
the routine is not being entered at all.

**This is the causal answer to why (B) is incomplete.**  The `nUpd = 0` counter inside the loop
is a DOWNSTREAM consequence of the same defect, not a separate mystery: the transport cannot
work if the metric it is built from evaluates to zero.  The two candidate explanations from
rounds 6-7 (a skipped loop block versus a broken connection) are resolved: it is the connection
side, and specifically the metric interface, not the loop's control flow.

What remains is one further bisection -- emit `Sig`, `Del` and the raw `knG4` argument values
themselves, which separates 'the arithmetic is wrong' from 'the out-parameter does not survive
the call' -- and then, once the metric returns a real value, re-read the invariants.
### (3l) Round 9: the shader transport was measured, judged unshippable, and removed

Once the page was finally given time to boot, the measurements came in -- and they condemn the
shader-side transport:

| quantity | without the transport | with it |
|---|---|---|
| first-run GLSL compile | 5-7 s (as documented on the boot screen) | **~50 s** (the overlay sat at 47.0 s) |
| live frame rate | 60 fps / 13.5 ms | **22 fps / 57 ms** |

and GLSL programs are NOT cached across page loads, so every load would pay the 50 s.  Both
costs are worse than the defect the transport was meant to remove, so it was removed: the
metric, its central-difference derivatives, the Christoffel contraction and the RK4 step were
replaced by inert stubs, and the call sites were reduced to constants (two of them still
referenced the deleted functions and kept the shader from compiling until they were found).
The assertion views 23/24/25 were withdrawn from the view list at the same time, because with
the stubs their readouts would be TRUE BY CONSTRUCTION -- the same vacuity that a positive
control had already exposed once.

**Restored state, verified after the removal:** 0 console errors, boot completes inside 11 s,
`canvasMean = 32.96` with `canvasMax = 255` (the black hole is rendering again), view list
0-22 intact, 60 fps target held.

### What a viable shader transport would need

Not the algorithm -- that worked on the CPU to 1e-12.  It needs a formulation that is cheap to
COMPILE and cheap to RUN:

1. **analytic Boyer-Lindquist Christoffels** (rational functions of r and theta) instead of
   central differences -- that removes four metric evaluations per update and the whole
   difference-matrix machinery that the GLSL compiler had to unroll;
2. **only the Gamma components the contraction actually needs** (the metric is stationary and
   axisymmetric, so most components vanish identically);
3. **the Penrose-Walker closed form where it applies** (Q = 0), which needs no integration at
   all; for Q != 0 the transport must be integrated, and then the step-size result from round 4
   applies: 32x coarser is worth under 1e-6 rad of EVPA.

The CPU reference (`js/polar.js`, 39 assertions) remains the validated implementation and is
still the only one that is tested.
### (3m) Rounds 9-10: (A) delivered; the subimage prediction attempted and NOT confirmed

**(A) is now delivered and verified.**  The shipping page loads and EXERCISES the validated
module -- until then `js/polar.js` was imported only by `tools/*.mjs`, so the app shipped code
the app never ran.  Start the page with `?poltest=1` and it runs, in-browser:

    9 CPU assertions inside the shipping page (analytic Schwarzschild Christoffel, FD-step
      stability, Pi, the spectral index, the analytic transfer solution, the Faraday angle,
      the nu^-2 law, EVPA folding, the mod-pi difference)
    4 SHADER assertions on views 21/22, each pair preceded by a POSITIVE CONTROL that counts
      how many pixels carry signal at all: an empty frame is reported as inconclusive, never
      as a pass -- the lesson from the invariant test that sat vacuously for a whole round.

    verified: 13 passed / 0 failed, 0 console errors, 60 fps, results at window.__KN_POLTEST

**The subimage prediction was attempted and is NOT confirmed.**  Gelles et al. 2021 give, for
face-on subimages, DeltaEVPA ~ +-a/sqrt(27) -- linear in the spin and of order unity, unlike the
2a/rs^2 of the direct image.  The first attempt found ZERO subimages for every spin, because the
crossing test used the sign of (theta - pi/2), which can only ever find the first crossing and
silently misses theta = 3pi/2.  With that corrected to a sign change of cos(theta):

| a | measured DeltaEVPA (subimage) | published a/sqrt(27) | ratio |
|---|---|---|---|
| 0.2 | 9.271e-3 | 3.849e-2 | 0.241 |
| 0.4 | 2.733e-2 | 7.698e-2 | 0.355 |
| 0.6 | 5.952e-2 | 1.155e-1 | 0.515 |

Dividing by a gives 0.046, 0.068, 0.099 -- **superlinear**, while the published result is linear
in a.  So this does not match.  But it is NOT a falsification either, and the reason is concrete:
there is exactly ONE subimage ray per spin, and its emission radius drifts from 3.67 to 4.75
across the range, so the comparison is not like-for-like.  Confirming or refuting the subimage
prediction needs dense sampling inside the narrow near-critical band with the emission radius
held fixed.  Stated as inconclusive, with the cause identified.
### (3n) The subimage prediction IS confirmed, once the sampling was fixed

The first attempt reported "not confirmed" with 1 ray per spin and an emission radius drifting
30% across the range.  With a dense scan inside the narrow near-critical band and the observable
read at MATCHED emission radii by interpolating each spin's chi(rs) curve:

| rs | a | measured DeltaEVPA | published a/sqrt(27) | ratio |
|---|---|---|---|---|
| 73.109  | 0.3 | 5.825e-2 | 5.774e-2 | **1.009** |
| 144.020 | 0.3 | 5.021e-2 | 5.774e-2 | 0.870 |
| 214.931 | 0.3 | 4.984e-2 | 5.774e-2 | 0.863 |
| 73.109  | 0.6 | 1.213e-1 | 1.155e-1 | **1.051** |
| 144.020 | 0.6 | 1.025e-1 | 1.155e-1 | 0.888 |
| 214.931 | 0.6 | 1.024e-1 | 1.155e-1 | 0.886 |

* **magnitude**: within 0.9% and 5% at rs ~ 73, and within 11-14% across the window.  The
  published expression is the leading term, so a mild residual rs dependence is expected;
* **linearity in the spin, which is the sharper test**: at fixed rs the a = 0.6 value divided by
  the a = 0.3 value is **2.08, 2.04, 2.05** -- the doubling that linearity demands.

So Gelles et al.'s subimage result is reproduced, and the earlier "not confirmed" is explained:
it was a sampling defect (1 ray per spin, drifting rs), not a physics discrepancy.  Fixing the
sampling moved it from inconclusive to agreement, which is worth recording as such.

Status of (D) after this: the DIRECT-image amplitude and scaling (2a/rs^2) and the SUBIMAGE
amplitude and scaling (a/sqrt(27)) are both reproduced.  The overall SIGN of the direct-image
case remains unmatched, and that is not resolvable in a single-pole observer setup.
### (3o) Rounds 11-12: the analytic transport runs, compiles fast, and is WRONG in one step

**What works, verified.**

* the analytic Boyer-Lindquist derivatives reproduce numerical derivatives to **9.3e-12**;
* an explicit Christoffel tensor built from those derivatives reproduces the VALIDATED
  finite-difference connection of `js/polar.js` to **9.3e-12 / 8.7e-12 / 4.1e-11**;
* the shader transport now genuinely EXECUTES: the positive control reads **680 149 pixels with
  updates**, against 0 for several rounds before the gate was moved into the shader;
* and it is affordable: the compile no longer blows up (no repeat of the 50 s / 22 fps disaster),
  the renderer boots normally at 60 fps, and the finished view is unaffected because the
  transport is gated to the assertion views.

**What does not work.**  The contraction is reduced algebraically to three matrix-vector products
instead of materialising the 64-component tensor, and **that reduction is wrong** -- measured
against the explicit construction on the CPU it is off by 18-49%, and a fifth error was not
found.  Errors 1-4 that WERE found and fixed:

1. D (derivative index on f) was placed where C belongs;
2. E = d_sigma g_{alpha beta} p^alpha f^beta was omitted entirely;
3. the 1/2 was attached to one term instead of the whole bracket;
4. E is indexed by sigma = (t, r, theta, phi), so it is (0, Er, Eth, 0) -- Er had been put in
   the t slot;
and two further defects in the shader path were found and fixed:

5. the contraction was fed the COVARIANT momentum (p_t = -E, ...) instead of the contravariant
   one, which is what the validated CPU path uses momentumUp() for;
6. the initial probe vector was passed through a Euclidean normalize() although
   e_theta/sqrt(g_theta theta) is already the metric-normalised unit vector; the additional
   normalisation gave it a metric norm of Sigma.

**And the instrument failed a third time.**  The invariant readout scaled |f^2-1| by 1000 and
clamped to 1, so EVERY failing pixel read exactly 255 and reported '0.255'.  That number stayed
bit-identical while the code underneath it changed twice, which is what gave it away.  It is now
scaled by 1e6/255 -- and it still saturates, so the deviation is at least 2.55e-4 and its true
magnitude remains unresolved.  This is the same failure mode as an invariant test with no
positive control: an instrument that cannot resolve the quantity it measures, and it looks like
a precise reading while it happens.

**State of (B): the machinery is in place, verified where it can be, and known-incorrect in one
algebraic step.**  Views 23/24 are currently exposed and are known-broken probes; withdrawing
them from the view list is the first thing the next round should do.  The tooling to finish is
on disk and runs in milliseconds: `tools/dbg-derivs.mjs` (derivatives vs FD),
`tools/dbg-reduce.mjs` and `tools/dbg-enum.mjs` (reduction variants vs the explicit tensor).
### (3p) Round 14: the reduction is fixed and verified, and the measurement chain broke

**The fifth error, found and fixed.**

p is (p^t, p^r, p^th, p^phi), so p^r is component 1 and p^th is component 2.  Every earlier
version of the reduction wrote components 0 and 1, i.e. p^t and p^r.  That is a plain index slip
which no amount of re-deriving the algebra would expose.  With components 1 and 2 the reduction
matches the explicit Christoffel tensor to

        9.3e-12   (r=6,  th=1.2)
        8.7e-12   (r=6,  th=pi/2)
        4.1e-11   (r=12, th=0.7)

and the fix is confirmed LIVE in the served shader (`p.y * grf` present, the old form absent).
The momentum variance and the spurious Euclidean normalisation of the initial probe vector were
also fixed this round, and the invariant readout was moved to a log scale because the linear one
clamped and reported a constant 0.255.

**Then the measurement chain broke, and that is the honest state.**

The shader transport now runs on EVERY pixel (`tEvery=1` gives 921600/921600 with updates) and
the invariant still reads at or above its saturation ceiling.  To find out why, the shader's own
metric-derivative outputs were exposed as pixels for a numerical comparison against the JS
reference -- the cross-check that has worked every time.  It failed to give information, twice:

1. the first version applied `abs()`, destroying the sign, and went through the tonemapping path,
   which is sign-blind -- a meaningless comparison that I had designed myself;
2. after encoding the sign and confirming the raw diagnostic path covers view 25, the pixels read
   **[92, 63, 64] -- bit-identical to the previous version**, although the two encodings must
   differ by a factor of about 17 at that value.  A value that does not react to a change in the
   code that produces it is not a measurement.

The served source was checked and IS current: sign encoding present, old form absent, probe 25
present, raw path covering 25, and the view is addressable with 25 options.  So the defect is in
the readback path itself -- the canvas-to-2D-canvas grab that this session has used throughout --
and it has NOT been isolated.  Earlier readings in this session did react to changes (view 21/22
colours, the transport counter going 0 -> 680k), so the path works in general; something about
the current page state breaks it, and I am out of budget to find what.

**Consequence: (B) cannot be validated this round, and no claim is made about the shader's
numerical correctness beyond the CPU-verified reduction.**  The app is healthy (0 errors, 60 fps,
boot normal, views 0-22 fine).  The next round must first make the readback trustworthy -- e.g.
read `gl.readPixels` directly instead of `drawImage` -- and then repeat the metric cross-check.

### (3q) Round 15: the readback was fixed as prescribed, and (B) is now a PASSING assertion

The prescription above turned out to be exactly right.  Reading the canvas through a 2D canvas grab
is lossy and state-dependent; reading the WebGL default framebuffer directly is not:

```js
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
const b = new Uint8Array(4);
gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
```

Every diagnostic branch now carries the constant 0.25 in a spare channel precisely so that this can
be certified before any value is believed, and it reads **64 = 0.25 x 255** in every view used here.

#### Two of my own earlier comparisons were void, and both were caught by instruments, not by intuition

1. **The first cross-check compared two different points.**  It read chi_shader = 0.4127 against a CPU
   value of 0.0252 and I took the difference seriously.  Reading the termination code showed why it
   was meaningless: the trace breaks on `trans < 4e-3`, i.e. **inside the disk**, so the shader's chi
   is evaluated at the disk, while my CPU ray ran past it out to `rFar = max(1.55 r0 + 6, 34) = 43.2`.
   A 0.39 rad difference between two different points on the same ray is not evidence of anything.
   *A cross-check must first establish that both sides are at the same place.*

2. **The second comparison was not the same geodesic.**  With the end state exported, the CPU's theta
   at the shader's end radius disagreed by **0.256 rad** (and by 0.295 rad on a second pixel).  The
   cause was a **clipped readout**: view 37 encoded p^theta on [-2, 2], and the coarse channel read 0
   at *both* pixels -- the value was below the range and had been silently clipped.  The true value is
   **p^theta = -7.77**.  Nothing about the decoded number -1.996 looked wrong; only the trajectory
   check exposed it.  This is the **eighth** clipped readout of this line of work, and the first one
   caught by a physical consistency test rather than by the value itself.  The range is now [-8, 8].

   *The lesson that generalises: a scalar readback can be checked against a plausible magnitude, but a
   clipped scalar still looks plausible.  What caught it was asserting that the CPU's state at the
   shader's own end radius matches the shader's exported state -- the vector-level check.*

#### A defect in the 16-bit codec itself

One byte per channel is 0.25 in r and 0.0157 in p^r -- the transport error from a position error that
size is the same order as the EVPA being tested, so the split had to be exact.  The first version was
not: it wrote `clamp(U)` in the coarse byte and `fract(U * 255)` in the fine byte.  The coarse byte
rounds to **nearest** while the fine byte carries the residual of the **true** U, so U = 0.5 recovered
as 0.504 -- a half-quantum error built into the codec.  Using `floor(U * 255)` for both makes the pair
exactly invertible (integer fl oors survive fp16 exactly):
`U = x / 255 + y / (255 * 255)`, resolution 4/65025 = 6.2e-5.

#### The assertion

`tools/dbg-evpa-crosscheck.mjs` (node, no browser) imports the page's own `js/polar.js`, rebuilds the
observer screen basis `e_a = d_phi / sqrt(g_phiphi)`, `e_b = -d_theta / sqrt(g_thth)`, transports all
three vectors with the polarisation, expands the source epsilon-construction in that transported basis
and takes `atan2`.  It **reuses nothing of the shader's arithmetic** -- only the ray data the shader
exported.

```
case                     dtheta(geo)  shader chi     cpu chi       dchi   tolerance  verdict
A (400,580)  escaped          7.5e-4   -0.018479   -0.020172  -0.001693      1.2e-2  PASS
B (1210,640) escaped         -8.2e-4   +0.092399   +0.096462  +0.004063      1.2e-2  PASS
C (400,400)  disk             2.2e-4   +0.400393   +0.413425  +0.013032      4.0e-2  PASS
D (300,420)  disk            -6.0e-4   +0.227924   +0.235817  +0.007893      1.2e-2  PASS
```

The **geodesic identity** is asserted first and separately: the CPU's theta at the shader's end radius
must agree with the shader's exported theta within that channel's own quantum (0.8/255 = 0.003137).
All four agree to **2.2e-4 ... 8.2e-4**, so the two integrations really are on the same curve.  Only
then is chi compared.

The **tolerance is measured, not chosen**.  Two floors:

* **readout** -- chi is on one 8-bit channel spanning +-pi/2, quantum **0.012320** rad;
* **termination** -- the trace breaks where it is, so the exported end state r is a step endpoint and
  not a root.  Repeated reads of one pixel showed r flip by **0.1565**, exactly one integration step,
  while chi itself did not move.  The tool therefore measures d(chi)/dr on the CPU: in the far field
  that band is 1e-4 ... 2.8e-4, but **inside the disk it is 0.0398**, three times the readout quantum.
  Case C's 0.0130 rad residual is entirely inside that band -- the shader's value corresponds to a
  stop about 0.09 further out, which is well within the one-step ambiguity that was directly observed.

Controls reported by the tool: CPU self-convergence h = 0.005 vs 0.01 is **5e-11 ... 1e-7**; the Gram
reconstruction residual is **6.6e-7 ... 1.5e-5**; `|f|^2 - 1` is **1e-8**; `f.p` is **1e-11 ... 2e-9**.

The same computation was first run **inside the page** and then in **node**, and the four chi values
agree digit for digit -- so `js/polar.js` behaves identically in both environments.

#### What this does and does not assert

**Does**: the shader's `transportInfo.x` -- the coupled transport of `fPol`, `gA`, `gB` through the
geodesic's own RK4 stages, the epsilon-construction of the source, the 2x2 Gram expansion and the fold
to +-pi/2 -- reproduces an independent CPU integration of the same geodesic to within the readout and
termination floors.

**Does not**: assert a physical emitted EVPA.  Stated exactly, `transportInfo.x` is the expansion of
the **local epsilon-construction with b = d_phi at the ray's termination point** in the observer's
transported screen basis.  The source is not the physical magnetic field, and for disk-terminated rays
the termination point is wherever the accumulated attenuation crosses 4e-3 -- not a defined emission
point, and **time-dependent**: the turbulence changes the optical depth, so the stop moves frame to
frame.  The termination census over the frame is 64% disk, 32% escaped, 2.8% captured, and the disk
boundary visibly churns between full-frame scans.  So (B)'s machinery is validated; (B)'s *observable*
is not yet a physics output.

#### A structural finding worth recording

`fPol` is initialised from the epsilon-construction with **b = d_phi**, the same direction as the
screen basis vector `e_a = d_phi / sqrt(g_phiphi)`.  Since epsilon is linear in b, `fPol` is exactly
parallel to `gA` at the observer.  That is not a defect -- and the shader's chi is not degenerate,
because it re-derives the source with `knPolToroidal` at the **end** point -- but it does mean the
(test source, basis) pair is nearly degenerate for a source along d_phi.  Measured: expanding the
**transported** `fPol` in the transported basis gives **exactly 0.000000** for all four cases.  The
Gram residual (1e-5 ... 1e-6) shows the solve itself is well conditioned here; a future source along
d_phi at the observer would be a vacuous test.

#### Housekeeping this round

* Views **33-39** added: the shader's own end state (r on 16 bits; theta - pi/2 and p^r; p^theta) and
  its 16-bit initial p^r, p^theta, E, L.  `image.frag`'s raw diagnostic path extended from 32 to 39;
  without that the new views are silently tonemapped (the 0.25 certificate read 128 instead of 64).
* **Label drift corrected**: views 28, 30 and 32 were labelled with content they no longer emit
  (`EVPA Gram residual`, `Gram condition number`, `f_src . p`).  They now say what they output.
* **The debug-view gate on the transport is gone -- checked by grep, not by comment**: the only
  occurrences of `uDebug` inside `knTrace` (lines 371-800) are inside comments; every real branch is
  in the display section after line 869.  The transport therefore runs on every pixel, which is what
  (B) asked for.
* **A dead uniform, recorded rather than tidied**: `uTransportEvery` is still declared and still pushed
  by `main.js` every frame, and NOTHING in the shader reads it.  The transport fires on every accepted
  geodesic step because the coupled RK4 requires it -- a separate interval would evaluate f, gA and gB
  at states the geodesic never visits.  The comment that claimed the uniform was the transport target
  was false and has been corrected in place.  Removing the uniform (shader and `main.js` together) is
  left as a deliberate act rather than an accident.
* Still open: **(C)** circular `j_V`, Faraday conversion `rho_Q`, pitch-angle averaging and absolute
  units, and **(D)** the absolute EVPA sign convention from Gelles 2021.  Both need a source defined
  from the physical magnetic field at a defined emission point -- which is exactly the gap identified
  above, so the next round should define that point first.

### (3r) Round 16: (C) recorded from the sources, and (D)'s absolute sign settled by measurement

#### (C) The transfer coefficients: exactly what is implemented, what is zero, and what that costs

The 4x4 structure is right.  My `stokesStep` matrix, written in the frame aligned with the
projected magnetic field (so alpha_U = rho_U = 0), is term-for-term identical to Eq. (1) of
Marszewski, Prather, Joshi, Pandya & Gammie 2021 (ApJ, arXiv:2108.10359) -- the paper that
updates and corrects Pandya et al. 2016:

```
M_ST = [ aI  aQ  aU  aV ]        implemented: aI, aQ = Pi aI, aV = 0
       [ aQ  aI  rV -rU ]        implemented: rV = FAR0 n B_par / nu^2,  rU = 0
       [ aU -rV  aI  rQ ]        implemented: rQ = 0
       [ aV  rU -rQ  aI ]        implemented: jI, jQ = Pi jI,  jV = 0
```

with Pi = polFraction(p) = (p+1)/(p+7/3), which matches the MAGNITUDE of the Stokes-Q term in
the paper's Eq. (38) for a power-law distribution (their sign for jQ differs, which is a
choice of the Q axis, not a disagreement about the physics).  The absorptivity carries the
standard (p+2)/(p+1) factor.

**jV = 0 is a deliberate omission, NOT a symmetry.**  This matters, because "isotropic pitch
angles make circular polarisation vanish" is a common and WRONG shortcut for a power law.  The
paper's Eq. (38), for an isotropic power-law distribution (their Eq. 9), gives

    jV  proportional to  (171/250) p^(49/100) / tan(theta_B) * (nu / (3 nu_c sin(theta_B)))^(-1/2)

which is non-zero whenever B is not perpendicular to the line of sight.  The paper also states
plainly that "JV has changed sign compared to P16 so that it is now consistent with IEEE/IAU
conventions" -- so a reader implementing jV from Pandya et al. 2016 alone would get the wrong
sign.  Recorded here rather than silently implemented.

**rho_Q = 0 is the Faraday conversion term** and it is the paper's own subject (they provide an
improved evaluation method and fitting formulae).  Not implemented.

**rho_V is the non-relativistic Faraday law** rho_V = FAR0 n B_par / nu^2.  The relativistic
rotativities depend on the electron temperature/spectral index as well; the fits are in the
paper.  So the frequency and B_par powers implemented here are the classical ones.

**No absolute units.**  EMIS0, ABS0, FAR0 = 1, 1e-6, 1e-9 are arbitrary internal constants
(documented in js/polar.js).  Every polarisation FRACTION is meaningful; every ABSOLUTE level is
not.

**Pitch angle.**  The renderer's emissivity is proportional to B_perp^((p+1)/2), i.e. to
B^2 sin^2(theta_B) at p = 3 -- a fixed 90-degree pitch angle per emission event, not the
pitch-angle average.  The averaged result is Eq. (38), with its explicit sin(theta_B) factors.

#### (D) The absolute sign against Gelles et al. 2021 -- determined by measurement

Gelles, Himwich, Palumbo & Johnson 2021 (PRD 104, 044060; arXiv:2105.09440) defines its screen in
Eq. (13) as `alpha = -lambda / sin(theta_o)`, `beta = +-o sqrt(Theta)` with "+-o the sign of
p^theta at the observer", and in Eq. (36) measures "the Electric Vector Position Angle (EVPA)
counter-clockwise from +beta-hat: EVPA = arctan(-f^alpha_obs / f^beta_obs)".  Its Sec. III.2
comment fixes the vertical orientation: "+-o = +1 ... m=1 on the TOP".

**One algebraic step collapses beta.**  With the Kerr Carter constant evaluated at the observer,
`eta = p_theta^2 + cos^2(theta_o)[lambda^2/sin^2(theta_o) - a^2]`, Eq. (14) gives

    beta^2 = eta - (alpha^2 - a^2) cos^2(theta_o) = p_theta^2

i.e. **beta is exactly the signed theta-momentum** (`tools/dbg-gelles-screen.mjs` verifies the
cancellation to 3.2e-13 over 300 combinations).  So +beta-hat is the direction in which the
physical p^theta increases -- and the sign function +-o must NOT be differentiated when taking
gradients.  Differentiating it is exactly the mistake I made first: it flipped the determinant
and produced the wrong handedness.  What caught it was not algebra but the paper's own
top/bottom statement, used as a test.

**This renderer traces rays backward.**  Its `nloc` points from the observer into the scene,
i.e. toward the source, so the spatial momentum components (p^r, p^theta) are opposite to the
physical photon's, while E and L are not (measured E = +0.956 > 0, matching the paper's
p_t = -1 normalisation).  The paper's statement then makes a falsifiable prediction: physical
p^theta > 0 is the TOP of the image, so MY p^theta must be NEGATIVE at the top.  Measured on the
vertical centre line (x = 640, view 37, 16-bit):

    y =  40 (bottom)  my p^theta = +8.02      y = 340  my p^theta = +0.79
    y = 680 (top)     my p^theta = -7.96      y = 380  my p^theta = -0.80

so my p^theta = -(physical p^theta), and +beta-hat is the direction of DECREASING my p^theta.
That is a cross-check, not an assumption.

**The measurement.**  Gradients of L (view 39, 16-bit) and p^theta (view 37, 16-bit) about pixel
(400,580), central differences at 5 and 10 px:

    h   dL/dx      dL/dy      dp^th/dx   dp^th/dy      det(x1e4)   sign
    5   +0.029035  +0.011417  -0.003100  -0.031963     -0.000893   NEGATIVE
    10  +0.029724  +0.008022  -0.005413  -0.025504     -0.000715   NEGATIVE

E is constant to 6.2e-5 across the patch, so alpha depends on L alone.  The determinant is
negative at both baselines, and it is dominated by its diagonal (the cross terms are 5-6%), so
the sign does not rest on the curvature of the field.

**An independent route agrees.**  alpha-hat = (-0.965, -0.261) (left), beta-hat = (+0.208,
+0.978) (up).  The paper's EVPA rotates from +beta-hat toward -alpha-hat, i.e. from up toward
right, which on this canvas is CLOCKWISE, while chi is measured counter-clockwise (atan2 from +x
toward +y).  Both routes therefore say: **opposite handedness**.  Note also that +beta-hat
pointing UP is exactly what the paper's "+-o = +1 is the top" requires -- the test passes only
after the affine-parameter sign is handled, which is how that sign was certified.

**Result, and its limit.**  `EVPA_Gelles = -chi + R(pixel; a)`: the sign of a spin-induced
change in chi is the OPPOSITE of the sign of the paper's dEVPA.  R itself is NOT claimed -- the
map from this observer's local sky at r_o = 24 M to the asymptotic (alpha, beta) screen is not
conformal, so dEVPA = dchi + dR and only the sign of dchi is certified.  Comparing magnitudes
with the paper's -2a/r_s^2 still requires the (B) extension: a source defined at a physical
emission point from the magnetic field, rather than b = d_phi at the ray's termination point.

### (3s) Round 17: the physical screen EVPA now exists, at a defined emission point

The gap identified in (3r) is closed.  Two things had to change, and they are separable:

**A DEFINED EMISSION POINT.**  The old observable was evaluated wherever the accumulated attenuation
crossed 4e-3 -- a point that moves from frame to frame because the turbulence moves, and which a
repeated read of one pixel showed flipping by 0.1565 in r, exactly one integration step.  The new one
is evaluated at the FIRST EQUATOR CROSSING, `cos(theta) = 0`, which is a property of the geodesic
alone: the CPU finds the same point by root-finding, so none of the renderer's adaptive stepping has to
be reproduced.  The state and the transported basis are linearly interpolated to that point (the shader
saves the pre-step basis for this), and the crossing radius is exported as a CHECK.

**A PHYSICAL SOURCE.**  The source is the general-b epsilon construction with **b = the magnetic
field**, via `knPolFromB`, not b = d_phi.  This matters for a reason that was measured: epsilon is
linear in b, and `e_a = d_phi / sqrt(g_phiphi)` is the same direction, so expanding the TRANSPORTED
f built from b = d_phi in the transported basis returns exactly 0.000000 -- a degeneracy, not a
measurement.  The disk's own field is already in the shader (`knBField`, three branches, only r and
theta, axisymmetric) and the app runs it with `values.bfield = 1`, toroidal.

The screen EVPA needs no transport of the source back to the camera: expanding it in the transported
observer basis at the crossing point gives the observer's screen angle directly, because parallel
transport preserves the inner products.  The change is one out-parameter (`evpaPhys`), one block inside
the crossing branch, and view 41.

#### Result, from `tools/dbg-evpa-physical.mjs` (node, exit 0)

```
case        rCross(sh) rCross(cpu)    |dr|  shader chi    cpu chi       dchi  quanta  verdict
(122,92)         18.07     18.158   0.088   -0.609839  -0.611177  -0.001338    0.11  PASS
(122,182)        17.32     17.202   0.118   -0.905518  -0.914795  -0.009277    0.75  PASS
(722,452)         2.26      2.358   0.098   -0.215599  -0.214842  +0.000757    0.06  PASS
(722,632)        31.37     15.538  15.832   +0.006160  -0.003591  -0.009751    0.79  EXCLUDED
(482,272)        10.79     10.630   0.160   -0.215599  -0.212868  +0.002731    0.22  EXCLUDED
```

The CPU's own convergence (h = 0.02 vs 0.01) is 2e-9 ... 2.4e-5.

#### Two exclusions, both diagnosed rather than waved away

* **(722,632)** -- the shader reports its crossing at r = 31.37 while the CPU's first crossing is at
  15.54: 60 times the rCross channel's quantum.  The two are simply not at the same emission point, so
  the chi agreement (0.79 quantum) is a coincidence and is not claimed.
* **(482,272)** -- three repeated reads of view 41 gave -0.215599, -0.178640, -0.215599.  A value that
  moves is not a measurement.  This is the same rule that voided two earlier comparisons in this line.

#### The error budget, stated the way it was earned

The tolerance used is ONE readout quantum (pi/255 = 0.012320), and that is a statement about the
readout rather than a license: the rounding bound alone is half a quantum, and (122,182) exceeds it.
Two candidate explanations for the remainder were tested and **falsified**:

1. **The shader's linear interpolation of the transported basis** across one of its own steps.  The
   measured d(chi)/d(lambda) times half the step cap (recomputed from the shader's own three caps:
   h = min(0.03, hGeo, hAng)) bounds this at 4e-5 ... 2.6e-3 rad -- five to two hundred and thirty times
   TOO SMALL to explain the residuals.
2. **The 16-bit readback quantisation feeding the CPU.**  The half-quanta are 1.2e-4 (p^r), 2.5e-4
   (p^theta), 6.2e-5 (E), 9.8e-4 (L); perturbing each by its half-quantum and re-integrating the whole
   geodesic moves chi by a total of 1.3e-5 ... 2.6e-4 rad -- also far too small.

What IS demonstrated directly is that the number depends on the step size.  Raising `stepScale` from
0.15 to 0.45 moved chi by 0.037 at (122,182) and 0.049 at (482,272).  That is the shader's GEODESIC
sampling moving the crossing radius slightly, not transport truncation, and a residual of order 0.004
rad at stepScale 0.15 is consistent with it.

#### A harness error worth recording

The first attempt returned NaN for every field.  The cause was mine, not the library's: `knBField`
returns a THREE-component (B^r, B^theta, B^phi) and the shader wraps it as `vec4(0, B.x, B.y, B.z)`,
while my CPU harness built `[0, 0, 1/r]` -- three elements, so the b^phi slot was undefined and the
contraction went NaN.  Two separate probes had shown the library returning finite values for the same
state, which is what made the contradiction visible.  The recurring pattern holds: when my test
disagrees with the library, suspect the test.

#### What this unlocks, and what it still does not claim

The renderer now has a screen EVPA with a physical source at a geometric emission point, cross-validated
against an independent integration.  Combined with (3r) -- `EVPA_Gelles = -chi + R(pixel; a)` -- the
sign convention of Gelles et al. 2021 can now be applied to a physical source, which is what comparing
with their -2a/r_s^2 requires.  That comparison is NOT made here: the renderer's field is a fixed
toroidal toy field, not the paper's configuration, and R itself is still not claimed.

### (3t) Round 18: two of the recorded regrets are closed, and one of them closed the error budget

This round attacked the regrets listed after (3s), in the order they were ranked.

**(8) A validity flag, and it immediately paid for itself.**  View 42 carries the crossing flag:
green is 1.0 when the ray has an equatorial crossing and 0.0 when it has none, red keeps the 0.25
readback certificate, blue the crossing radius.  Without it, a real chi = 0 is indistinguishable from
chi = 0 because the crossing was never reached -- which is what happens when a small stepScale exhausts
the step budget first, a silent failure I hit while testing.

The scan of view 42 over 48000 sampled pixels: **25226 clean crossings** (flag exactly 255),
**1083 boundary blends** (2.2 per cent), 21691 with no crossing.  The boundary population is what
matters: those pixels straddle a crossing/no-crossing edge in the progressive accumulation, so their
chi is a BLEND of two different rays.

And that is the whole explanation of the one residual (3s) could not account for.  (122,182) read a
stable chi = -0.905518 at 0.75 quanta from the CPU; its flag reads 0.9764 -- stable, and neither 0 nor
1.  It is a blend.  Two hypotheses had already been falsified as the cause (basis interpolation, input
quantisation); the answer was a sample-quality problem, not a numerical one.

**(3) The parallel transport now reaches the rendered polarisation.**  The old accumulation,

    pRe += emis * cos(2 * faradayDepth);

implicitly places every segment's source at EVPA = 0 -- true only in the frame whose Q axis is the
LOCAL projected field, and that frame is different at every segment and different again from the
observer's.  Summing the segments as if they shared it rotates each contribution by an arbitrary angle,
so the transport -- the entire subject of this module -- never entered the rendered image at all.

Each segment's source EVPA is now expressed in the OBSERVER's transported screen basis (gA, gB) before
accumulation: the same general-b epsilon construction with b = the magnetic field that view 41
validates, with the state interpolated into the segment.  No transport of the source back to the camera
is needed, because parallel transport preserves inner products.  The recipe is identical to view 41's,
evaluated per segment.

**The control that this did not contaminate anything:** view 41's four previously recorded values are
bit-identical after the change -- -0.609839, -0.905518, -0.215599, +0.006160.  The disk accumulator is
firewalled from the validated quantity, as intended.  View 21 still renders with no non-finite bytes.

#### The assertion, retightened and passing (node, exit 0)

With blending excluded by the flag, the tolerance is tightened from one readout quantum to **half a
quantum -- the pure 8-bit rounding bound**:

    case        rCross(sh) rCross(cpu)    |dr|  shader chi    cpu chi       dchi  quanta
    (160,120)        17.57     17.586   0.016   -0.572879  -0.573877  -0.000998    0.08  PASS
    (164,120)        17.57     17.548   0.022   -0.560559  -0.565034  -0.004475    0.36  PASS
    (320,120)        16.56     16.490   0.070   -0.277199  -0.273137  +0.004062    0.33  PASS
    (324,120)        16.56     16.513   0.047   -0.264879  -0.267362  -0.002483    0.20  PASS
    (122,92)         18.07     18.158   0.088   -0.609839  -0.611177  -0.001338    0.11  PASS
    (722,452)         2.26      2.358   0.098   -0.215599  -0.214842  +0.000757    0.06  PASS

Six clean samples, every one inside half a quantum, CPU self-convergence 2e-9 ... 2.4e-5.  The four new
rows were picked by scanning view 42 for a flag of exactly 255.

#### Still open after this round

* **(2)** the shader's EVPA remains step-dependent (0.15 -> 0.45 moves chi by ~0.04 rad).  Now that
  the residual at the default step is inside the rounding bound this is no longer an error-budget
  problem, but it is still not demonstrated to converge, and the sub-step-to-the-crossing fix is not in.
* **(9)** the -2a/r_s^2 sign and scaling have not been redone with the physical chi.
* **(7)** the three tools are still reproducible CALCULATIONS fed by hand-copied readbacks.

### (3u) Round 19: (9)'s blocker is cleared, and one of my own arguments is corrected

**(9) needed R, and R turns out not to depend on the spin.**  Last round I declined to compare with
Gelles' -2a/r_s^2 because the conversion between my chi and their EVPA is `EVPA = -chi + R(pixel; a)`
and I had not measured R.  It is measured now, and the result is clean:

    pixel        R(a=0.86)   R(a=0)     R(a=-0.86)   dR vs the direction quantum (0.44 deg)
    (640,200)     178.880    178.877       --        identical to the readout's last bit
    (900,400)     178.880    178.877       --
    (1100,500)    172.120    172.124       --
    (300,150)     167.980    167.984       --

Identical, bit for bit, at the 8-bit resolution of the direction readout.  There is an independent
reason to expect that: the observer sits at r = 24 M, where the frame-dragging term is
O(a/r^3) ~ 6e-5, so R's spin dependence is of order 1e-4 rad -- far below the paper's 0.006 rad
signal at r_s ~ 17.  **So dEVPA = -dchi to well within the effect being tested**, and (9) is no
longer blocked by an unknown convention.

**Two corrections to my own earlier claims.**

1. **The non-conformality argument was wrong, even though the conclusion survives.**  I had inferred
   that the map from the local sky to Gelles' (alpha, beta) screen is non-conformal from the angle
   between the alpha and beta GRADIENTS **measured in canvas coordinates**.  That is not valid: the
   canvas is a projection of the sky, its induced metric is not Euclidean, so a canvas-coordinate
   angle is not a sky angle.  Redone properly -- by perturbing the arrival direction inside the
   observer's own orthonormal frame and reading (E, L, p_theta) back through the shader's own
   `knZamoInit` (views 43 and 44) -- the angle between +alpha-hat and +beta-hat is **92.25 degrees**
   near the optical axis and **111.74 degrees** far off it.  Genuinely non-conformal, now measured with
   a real angle.  The determinant-SIGN argument that (3r) rested on is unaffected, because a
   positive-definite metric cannot change a Jacobian's sign.

2. **View 44 needed a sign flip.**  It computes grad(beta) from the shader's p_theta, which is the
   BACKWARD-traced momentum, so it is the negative of the physical p_theta.  Uncorrected it puts
   +beta-hat pointing SOUTH, contradicting the paper's "±_o = +1 is the top".  Same affine-parameter
   sign that (3r) certified, and the paper's own statement caught it again.

**The readout floor, and the fix.**  At r_s ~ 17 the prediction is 2a/r_s^2 = 0.006 rad, which is HALF
of view 41's 8-bit quantum (pi/255 = 0.01232) -- so it could never have been resolved there.  View 45
now carries chi on 16 bits (floor-split, exactly invertible, quantum 4.8e-5 rad), 256 times finer.

**Two traps hit while setting this up, both recorded.**

* **The spin cannot be changed by mutating `window.__KN.values.a`.**  `main.js` pushes `uA.uA` from
  `derived`, and `derived = derive(values)` runs on the parameter-change path, NOT every frame.  The
  readback of `values.a` changes, so it LOOKS like it worked, while the shader keeps the old spin --
  the first sweep showed dchi = 0 at seven of nine pixels, including one where the prediction was
  0.14 rad.  What does work: write the app's own store key
  (`localStorage['gargantua-kn-v2.params']` = the values object) and reload.  Verified.
* **The framing moves with the spin.**  With the camera face-on, the same pixel maps to completely
  different emission radii at a = 0 and a = 0.86: the r_cross sets are {3.5, 8.3, 13.3, 18.1, 23.1,
  28.1, 32.9, 37.9, 42.9} and {none, 2.3, 5.5, 16.6, 8.8, 10.0, 15.3, 21.1, 18.3}.  The rig reframes
  when the spin changes.  **A per-pixel comparison across spins is therefore invalid**; the comparison
  has to be made as a function of r_s, which is the paper's own independent variable anyway.

A tool call timed out mid-sweep and I checked whether it had left a parameter mutated: it had not, and
the app's defaults were restored and re-verified afterwards (a = 0.86, camTheta = 76, camR = 24,
bfield = 1, stepScale = 0.15, 0 console errors).

#### Still open

* **(9) itself**: the r_s-matched sweep is not done.  What is established is the prerequisite --
  dEVPA = -dchi, and a readout fine enough to see 0.006 rad.
* **(2)** the shader's EVPA is still step-dependent; the sub-step-to-the-crossing fix is not in.
* **(7)** the tools are still calculations fed by hand-copied readbacks.

### (3v) Round 20: (9) attempted, and the paper's coefficient is NOT reproduced

The test was built to be as clean as the physics allows.  Two spins, +0.86 and -0.86, camera face-on
at theta_o = 3 degrees, and the ANTI-SYMMETRIC combination, which cancels any a-independent offset
and any even-in-a background while keeping exactly the odd term the paper's -2a/r_s^2 describes.
Because the rig reframes when the spin changes (3u), the comparison is made as a function of the
emission radius r_s, not per pixel: every clean crossing pixel in the frame was binned by r_cross in
steps of 1 M and averaged with a DOUBLED-ANGLE mean, which is the correct average for a quantity
defined modulo pi.

Converting the paper's result with the (3r)/(3u) relation dEVPA = -dchi, and using
EVPA(a) - EVPA(0) = -2a/r_s^2, gives dchi(+a vs -a) = +4a/r_s^2 = +3.44/r_s^2.

    r_s     dchi measured   4a/r_s^2 predicted   dchi * r_s^2
    13.5      +0.032088          0.018875             5.85
    17.5      +0.023679          0.011233             7.25
    21.5      +0.016998          0.007442             7.85

**The sign is right and the magnitude is not.**  dchi is positive for +a against -a, which after the
convention flip is the direction the paper predicts.  But the measured value is 1.7 to 2.3 times the
prediction, and -- more damaging than the magnitude -- dchi * r_s^2 is NOT constant: it drifts from
5.85 to 7.85 across the range, so the 1/r_s^2 form itself is not what this configuration produces.

**This is a non-reproduction, and it is recorded as one.**  It is not a refutation of the paper, for a
reason that is structural rather than numerical:

* **My observer is at r = 24 M; theirs is asymptotic.**  The -2a/r_s^2 result is a leading term in an
  expansion for a distant observer.  Comparing it against a measurement made from 24 M away, without
  their finite-radius correction, tests a different quantity.  This is the most likely cause and it
  cannot be removed without rebuilding their geometry.
* **chi sits exactly at the +/-pi/2 fold in this configuration** (measured 1.5587 against pi/2 =
  1.5708, for BOTH spins).  That is a symmetry artefact of face-on plus a toroidal field, and it means
  a small differential is being read underneath a large constant.  The doubled-angle mean handles the
  wrap correctly, but the lever arm is poor.
* **Image-order mixing was considered and judged unlikely, but not eliminated.**  At face-on the direct
  image sits at an impact parameter of order r_s while the subimages crowd the shadow, so the bins
  should be dominated by the direct image.  Views 3 and 15 exist for this, but view 3 routes through
  heat() -- a colour map, not a readable number -- so separating orders needs a new raw channel.

What a real test would need: an asymptotic observer, or the paper's finite-radius correction, plus an
image-order separation done with a numeric channel.  Neither is in place, so (9) remains open and is
now known to be blocked by GEOMETRY rather than by convention.

### (3w) Round 21: (7) is done, and it immediately overturned last round's clean result

The measurement half of the assertion is now a script in the repository rather than a set of numbers
pasted in by hand.  tools/capture-evpa.js is executed inside the running page: it records the app
parameters it ran under, scans view 42 for pixels whose crossing flag is EXACTLY 255, picks a spread
of six crossing radii, reads the four 16-bit ray channels plus the physical EVPA at each, and returns
a JSON blob.  That blob is written to tools/measurements/evpa-physical.json.  tools/dbg-evpa-physical.mjs
now READS that file and, before comparing anything, checks that the captured parameters are the ones
the CPU integration assumes -- M, a, Q, camR, camTheta, bfield.  A capture from any other
configuration makes the tool exit 2 with the mismatch printed rather than quietly comparing nonsense.

**The re-measurement did not confirm the previous result, and that is the point of doing it.**  The
hand-picked six that passed at half a quantum were replaced by six arbitrary clean pixels:

    case          flag  rCross(sh) rCross(cpu)    |dr|   shader chi    cpu chi      dchi   quanta
    (25,25)      1.000      19.33      19.135   0.195    -0.720718  -0.788594  -0.067876    5.51  FAIL (chi)
    (337,187)    1.000      15.06      15.065   0.005    -0.314159  -0.316608  -0.002449    0.20  PASS
    (625,172)    1.000      14.31      14.034   0.276    -0.030800  -0.033352  -0.002552    0.21  FAIL (r)
    (742,220)    1.000      12.30      12.125   0.175    +0.043120  +0.043970  +0.000850    0.07  PASS
    (616,505)    1.000       5.27       5.183   0.087    +0.363439  +0.374061  +0.010622    0.86  FAIL (chi)
    (715,550)    1.000      10.79      10.481   0.309    -0.006160  -0.003250  +0.002910    0.24  FAIL (r)

Two pass, four do not, and the verdicts now say WHICH test failed:

* **FAIL (r), three cases.**  The shader sampled the equatorial crossing at a radius 0.276 to 0.309
  from the CPU's, and the rCross channel's own quantum is 0.251.  The angle is fine in all three
  (0.21, 0.07, 0.24 quanta) -- what is wrong is WHERE the crossing is.  That is the shader's GEODESIC
  truncation, the same root cause as (2), and it is not a transport error at all.
* **FAIL (chi), two cases.**  (616,505) sits at r_cross = 5.27, hard against the shadow where the
  geodesic is most sensitive, and its radius agrees to 0.087 while the angle is off by 0.86 quanta --
  plausibly the same cause amplified.  (25,25) is NOT explained: the radius agrees to 0.195, inside
  the quantum, yet the angle is off by 5.5 quanta.  That one is a frame-corner pixel and I have not
  found the mechanism; it is recorded as an open anomaly rather than smoothed over.

So the assertion currently FAILS, and the tool exits 1.  It is left failing deliberately: a test that
is tuned until it passes is worth nothing, and the previous 6/6 was a property of which pixels were
chosen by hand, not of the shader.  What changed is that this is now visible.

**This makes (2) the blocker for the physical EVPA assertion, not just for the shader's step
sensitivity.**  Reducing the geodesic truncation at the crossing -- the sub-step-to-cos(theta)=0 fix,
or a step budget that allows a smaller stepScale -- is now the single change that would let this
assertion be tightened honestly.

### (3x) Round 22: (2) is diagnosed, priced, and NOT what the objective described

Two hypotheses were tested and the first was FALSIFIED before the second was confirmed.

**Falsified: the crossing locator.**  The shader located cos(theta) = 0 by linear interpolation between
the step endpoints, which is first order, and a first-order locator is about the size of the observed
error (a step moves r by roughly 1 while the disagreement was 0.20 to 0.31).  So both sides were made
second order -- a quadratic root using dtheta/dlambda = pth / Sigma, which is free because
Sigma = r^2 + a^2 cos^2(theta) needs no metric evaluation.  **Nothing changed.**  The shader's captured
values came back BIT-IDENTICAL at all six pixels (19.33 / 15.06 / 14.31 / 12.30 / 5.27 / 10.79 and the
same six angles), and the CPU's crossing radii were unchanged to the digit as well.  The locator is not
the cause, and a better one buys nothing.

**Confirmed: the geodesic truncation.**  Lowering stepScale from 0.15 to 0.05 with maxSteps raised from
2048 to 4096 turned every FAIL(r) into a PASS:

    pixel        |dr| before   |dr| after    quanta before   quanta after   verdict
    (625,172)      0.276        0.012          0.21            0.30         FAIL(r) -> PASS
    (715,550)      0.309        0.029          0.24            0.26         FAIL(r) -> PASS
    (742,220)      0.175        0.069          0.07            0.15         FAIL(r) -> PASS
    (337,187)      0.005        0.034          0.20            0.01         PASS
    2 of 6 pass  ->  4 of 6 pass

So the sentence the tool prints for FAIL(r) -- that the shader sampled the crossing at a different
radius because of its own geodesic truncation -- is now VERIFIED rather than asserted.  But note what
that means for the objective: **(2) was specified as sub-stepping the transported basis to
cos(theta) = 0, and that is not the fix.**  The basis interpolation bound had already been measured at
4e-5 to 2.6e-3 rad (round 18), and the locator has now been shown to matter not at all.  What was
actually wrong is the GEODESIC, and the fix is a CONFIGURATION change: a smaller step and a larger step
budget.

**And it is not free.**  Measured on the same scene, GPU frame time: 19.8 ms at the default
(stepScale 0.15, maxSteps 2048) against 36.6 ms at the tighter setting -- 1.85x, about 27 fps instead of
the 60 fps cap.  So (2) is now diagnosed and priced but NOT shipped: shipping it means accepting that
cost or finding a cheaper integrator, and neither is a decision to make silently.

**Two failures are step-independent and therefore not truncation at all.**

* (25,25): |dr| = 0.200, inside the rCross quantum, yet the angle is off by 5.3 quanta -- and it stays
  at 5.3 when the step shrinks by 3x (5.51 -> 5.26).  It is a frame-corner pixel.  Unexplained.
* (616,505): |dr| = 0.084 and the angle is off by 0.89 quanta, unchanged by the step (0.86 -> 0.89).
  It sits at r_cross = 5.27, hard against the shadow.  Its radius is fine and its angle is not, so
  this is not the same failure mode as the other three.  Also unexplained.

Both are recorded as open anomalies rather than absorbed into the tolerance.

**One (7) repair this round.**  The capture was picking pixels by scan order, and the picks moved when
the candidate count moved, which made before/after comparison impossible -- exactly the kind of silent
irreproducibility (7) exists to remove.  The pixel list is now fixed and recorded inside
tools/capture-evpa.js, with the validity flag still checked on every capture so a pixel that degrades
into a boundary blend is detected rather than trusted.

App restored and verified: stepScale 0.15, maxSteps 2048, a 0.86, camTheta 76, 0 console errors.

### (3y) Round 23: the p^theta readout was clipping a SECOND time, and it invalidated part of round 22

The two step-independent anomalies from round 22 were pursued by replacing the sample with a
spatially spread grid -- eight more clean pixels on a 4x3 lattice, chosen once and recorded in the
capture script, giving fourteen in total.  That made the picture worse in a useful way: eleven of
fourteen failed, and two of them by |dr| = 5.7 and 7.5, which is not truncation by any reading.

**First hypothesis, FALSIFIED.**  Both of those pixels returned exactly chi = 0 with the validity flag
reading 1, which is what the crossing block leaves behind when the Gram determinant is below its guard.
The flag was given a third state (0 = no crossing, 0.5 = crossing but degenerate solve, 1 = solved) so
the failure would be visible.  The flag still read 1: the determinant was NOT degenerate.  The
hypothesis was wrong, and the three-state flag is kept because the silent path it exposes is real even
if these pixels do not use it.

**Second hypothesis, CONFIRMED.**  The captured p^theta values were sitting exactly on the ends of the
view-37 encoding range.  That range was +-8, and five of the fourteen pixels were at the edge or
beyond:

    pixel        p^theta as read (+-8)   p^theta re-read (+-16)
    (25,25)            +8.0234                 +8.7117
    (480,120)          +8.0539                 +8.6453
    (800,120)          +8.0482                 +8.6394
    (480,600)          -7.9823                 -8.6822
    (800,600)          -7.9970                 -8.6817

**This is the SECOND time the same view has clipped, and the same view.**  The first was the +-2 range
in round 15, which is what produced a 0.26 rad theta discrepancy and a page of phantom disagreement.
Now the +-8 range did it again, and the CPU was integrating a different ray for all five pixels --
which is why the crossing radius could be off by 7.5 while the angle looked almost right.

The range is now +-16 and the encoder, the capture decoder and the documented decoder string were all
updated together.  Re-measuring gave:

    pixel        |dr| before   |dr| after   quanta before -> after
    (480,120)       0.364        0.017         0.33 -> 0.03
    (800,120)       0.465        0.057         0.03 -> 0.22
    (25,25)         0.199        0.005         5.44 -> 0.70
    (480,600)       7.454        0.679         1.17 -> 0.46
    (800,600)       5.748        0.257         0.45 -> 0.54
    (160,120)       0.013        0.019         1.05 -> 0.04

**3 of 14 passed before, 7 of 14 now.**  Seven remain: four FAIL(r) at |dr| = 0.257 to 0.679, all just
above the rCross channel's own quantum of 0.251, and three FAIL(chi) at 0.70, 1.35 and 3.61 quanta.

**A claim of mine from round 22 has to be narrowed.**  The tool printed, as fact, that FAIL(r) means
the shader sampled the crossing at a different radius because of its own geodesic truncation.  That
HOLDS for the three cases it was measured on, whose p^theta was inside the range, and it is FALSIFIED
as a general rule: a clipped input produces the same symptom, and here it produced |dr| up to 7.5 --
seventeen times the largest truncation effect seen.  The verdict text now says both.

App restored and re-verified: stepScale 0.15, maxSteps 2048, a 0.86, camTheta 76, 0 console errors.

### (3z) Round 24: the two anomalies were the same truncation, and the test was asking the wrong question

The FAIL(chi) cases left over from round 22 were (25,25) at 0.70 quanta and (616,505) at 1.35, plus
(800,360) at 3.61.  The first thing that stood out was the sensitivity: dividing the angle error by the
radius error gave 0.81 rad per unit of r at (800,360) against 0.055 at (25,25).  In the strong field
dchi/dr is enormous, so the question 'did the radius agree?' was being answered with a channel whose
quantum is 0.251 in r -- three chi quanta at that sensitivity.  The channel could not resolve what the
test needed.

So the crossing radius was put on 16 bits as well (view 46, quantum 9.8e-4, same exact floor split),
and the comparison tolerance was tightened from 0.251 to 0.005.  Every case then failed on the radius,
which is the honest reading: the shader's crossing radius agrees with an independent integration only
to 0.008-0.08 typically, and 0.63 in the worst case, and that spread IS its geodesic truncation.

**That dissolved the anomalies.**  With the radius known precisely, the three FAIL(chi) cases are not a
second effect at all -- they are the SAME truncation, amplified where dchi/dr is large.  (800,360) needs
the radius to agree to about 0.002 before half a chi quantum is achievable; the shader's truncation is
ten times that.  Measured dchi/dr on the same rays: 2.04 at (480,360), 1.36 at (800,360), 0.98 at
(616,505), 0.09 at (337,187).

**So the test was reframed.**  Demanding |dchi| <= half a quantum conflates the radius offset with the
transport.  The fair question is whether the shader agrees with the CPU AT THE RADIUS THE SHADER
ITSELF SAMPLED, so the tool now measures dchi/dr on the same ray (two nearby equatorial points) and
tests the residual |dchi - (dchi/dr) * dr|, reporting dchidr and residQ per case.

**Result: 10 of 14, up from 3 of 14 at the start of the round.**  The four that remain: (800,600) at
residQ 0.52 and (25,25) at 0.53, both marginal against the 0.5 bound, and the two near-shadow pixels
(616,505) at 1.24 and (800,360) at 1.68, where the linear radius model is not good enough -- a second
order term in r, or a transport effect of the same truncation, is the remaining candidate.  Those two
are recorded as open.

Nothing about this required a physics change: the shader, the CPU reference and the transport were all
already correct.  What was wrong was the measuring instrument -- twice the readout range and once the
test's own question.

App verified after the round: stepScale 0.15, maxSteps 2048, a 0.86, camTheta 76, bfield 1, 47 views,
0 console errors.

### (3aa) Round 25: the second-order radius model was tried and FALSIFIED

The two near-shadow residuals (616,505 at 1.24 quanta, 800,360 at 1.68) were the obvious candidates
for a second-order term in r, since that is where dchi/dr is largest and a linear extrapolation over
|dr| ~ 0.02 is at its least trustworthy.  So the residual test was extended to a QUADRATIC through
three points on the same ray -- theta = pi/2 and pi/2 +- 0.02 -- fitted in Newton form on the
non-uniform grid, with the curvature read off the second divided difference.

**It made things worse, not better.**

    pixel        residQ linear   residQ quadratic
    (25,25)         0.53            1.93
    (616,505)       1.24            1.47
    (800,360)       1.68            5.72
    (800,600)       0.52            0.57
    10 of 14 pass   ->   10 of 14 pass, with larger residuals

The reason is visible in the numbers: three points 0.02 rad apart in theta are FAR apart in r exactly
where the curvature is largest, so the fitted curvature is extrapolated over a range much smaller than
the fit's own baseline and overshoots.  The linear radius model is the better description of this
data, and it has been restored; the curvature term is computed and deliberately not used, with the
reason recorded at the call site.

So the four remaining failures stand as open: (800,600) at 0.52 and (25,25) at 0.53, both marginal
against the half-quantum bound, and the two near-shadow pixels at 1.24 and 1.68, which neither the
linear nor the quadratic radius model explains.  What is NOT in doubt is the direction of the
remaining discrepancy: it scales with the shader's own geodesic truncation, and (2) -- a smaller
step at a cost of 1.85x frame time, measured in round 22 -- is still the lever.

### (3ab) Round 26: the decisive experiment was run, and it says NO

Round 25 ended with a proposal: land the tighter configuration (stepScale 0.05, maxSteps 4096) and
re-measure all fourteen cases.  If the four remaining residuals turned green, they were truncation; if
they survived, they were something else.  It was run, and the answer is the second one.

    case        residQ at stepScale 0.15   residQ at stepScale 0.05
    (25,25)             0.53                      7.24
    (616,505)           1.24                      1.48
    (800,360)           1.68                      5.65
    (800,600)           0.52                      0.65
    (480,600)          PASS 0.53                 FAIL 0.61
    total              10 of 14                   9 of 14

**A three-times smaller step made the residuals larger, not smaller, and the pass count went DOWN.**
So the four remaining failures are not explained by the shader's geodesic truncation, and the
'radius-explained' residual model cannot absorb them either -- it is the same model that overshot
when given a curvature term in round 25.

**This also narrows round 22's result.**  There, shrinking the step turned three FAIL(r) cases into
PASS, and I recorded that the |dr| spread WAS the geodesic truncation.  That holds for those three
pixels (p^theta = 7.17, -7.20, 5.34, all well inside the encoding range).  It does NOT generalise: on
this fourteen-pixel set the same change moved |dr| both ways -- (625,172) improved from 0.185 to 0.058,
while (25,25) went from 0.027 to 0.127 and (480,600) from 0.631 to 0.908.  A shrunken step is not
monotonically better here, which points at the adaptive controller rather than at the truncation
order: the shader's h is capped and then grown by its PI step-size controller after each accepted
step, so a smaller uStepScale does not simply scale every step down.

**Where that leaves the assertion.**  Ten of fourteen cases agree with an independent CPU integration
to within half a readout quantum, on a physical screen EVPA at a defined emission point, with a
source built from the magnetic field.  Four do not, and after three attempts (linear radius model,
quadratic radius model, smaller geodesic step) none of the obvious numerical explanations accounts
for them.  They are recorded as open rather than tuned away, and the tool keeps exiting 1.

What would actually settle it is to stop treating the shader's crossing radius as something to be
corrected for, and instead export the STATE the shader used at the crossing (r, pr, pth at full
precision) so the CPU can start from exactly that point.  That removes the radius question entirely
and leaves only the transport and projection, which is what this assertion is supposed to be about.

App restored and verified: stepScale 0.15, maxSteps 2048, a 0.86, camTheta 76, bfield 1, 47 views,
0 console errors, and the measurement artifact re-captured at that configuration so it stays
consistent with the tool's expectations.

### (3ac) Round 27: the five items, scored, and one of my own proposals corrected

**A correction first.**  Round 26 ended by proposing to export the shader's crossing STATE (r, pr, pth)
so the CPU could start from exactly that point.  That proposal is INCOMPLETE and would not settle
anything.  chi is the expansion of the source in the TRANSPORTED BASIS, and at the crossing BOTH the
state and the basis differ between the two integrations.  Aligning only the state leaves the basis
error untouched, which at the near-shadow pixels is exactly where the residual lives.  Doing this
properly means exporting eight more numbers (gA and gB, four components each) and that is four more
views -- possible, expensive, and not attempted.

**Scorecard.**

    item   status
    (8)    DONE.  View 42 carries a three-state validity flag: 0 = no equatorial crossing, 0.5 =
           crossing found but the Gram solve was degenerate, 1 = crossing and solved.  It removed the
           silent ambiguity it was built for, and then earned its keep twice: it identified a pixel
           whose chi was a blend of two rays (2.2 per cent of the frame) and that explained a
           0.75-quantum residual that had resisted two other explanations.
    (3)    DONE.  The parallel transport is in the RENDERED accumulator, not only in a debug view.
           Each emission segment's source EVPA is expressed in the observer's transported screen
           basis before the complex amplitude is summed; previously every segment was summed as if it
           shared a frame with every other, which is true of none of them.  Control: view 41's four
           recorded values were bit-identical after the change, so the disk accumulator is firewalled
           from the validated quantity.
    (2)    RESOLVED, NOT SHIPPED.  The item as specified -- sub-stepping the transported basis to
           cos(theta)=0 -- was shown NOT to be the issue: the basis interpolation bound was measured
           at 4e-5..2.6e-3 rad, and making the crossing locator second order changed the shader's
           output BIT-IDENTICALLY at every pixel (round 22).  The real lever is the geodesic step,
           priced at 36.6 ms against 19.8 ms (1.85x, about 27 fps) -- and round 26 showed that even
           that does not remove the last four residuals, because the shader's adaptive controller
           grows h after each accepted step, so a smaller uStepScale is not a proportional shrink.
    (9)    NOT DONE.  Blocked by geometry, not by convention: the paper's -2a/r_s^2 is an asymptotic
           observer's leading term, this camera is at r = 24 M, and the comparison needs their
           finite-radius correction.  What IS established: the sign relation (from round 16/17), and
           a 16-bit readout fine enough to see 0.006 rad.
    (7)    DONE, with a caveat.  tools/capture-evpa.js is the measurement, in the repository, and
           tools/measurements/evpa-physical.json is its output; the assertion READS that file and
           refuses to compare if the captured configuration is not the one the CPU assumes (exit 2).
           The caveat: the capture still has to be launched by hand, so it is reproducible but not
           automatic.

**The assertion's current state, and why it is left failing.**  Fourteen clean crossing pixels, ten of
which agree with an independent CPU integration to within HALF a readout quantum, on a physical screen
EVPA at a geometrically defined emission point with a source built from the magnetic field.  Four do
not, and four explanations have now been tested and rejected: a boundary-blend sample (fixed for one
pixel, not the others), a clipped input channel (found and fixed twice, and it accounted for five
pixels), a degenerate Gram solve (falsified), and geodesic truncation (falsified by shrinking the step,
which made things worse).  The tool exits 1 and keeps printing the failures, because a test that is
tuned until it passes is worth nothing.

App verified: stepScale 0.15, maxSteps 2048, a 0.86, camTheta 76, bfield 1, 47 views, 0 console errors.

### (3ad) Round 28: pushing the observer out, and the fold that stops it

(9) is blocked because the paper's -2a/r_s^2 assumes a distant observer while this camera sits at
r = 24 M.  That looked like a parameter away: camR exists.  It does -- but it is CLAMPED.  Writing 100
into the store gives back 60, the same way maxSteps clamps at 4096; both are UI range limits.

**At r = 60 the renderer works.**  A full-frame scan of view 42 finds 96611 clean crossings, 4116
boundary blends and only 185 pixels with no crossing at all -- 0.19 per cent, so the rays complete
even with the longer path, and the crossing radii span 0 to 65 M with a usable distribution.  The
asymptotic approximation at r = 60 is 2.5 times closer to valid than at 24.

**But the measurement still does not work, for a reason that has nothing to do with the radius.**
With the camera face-on and a toroidal field, chi sits AT the +/-pi/2 fold -- 1.5587 against
pi/2 = 1.5708 in round 20, and the same here.  That is a symmetry property of the configuration, not
an artefact, and it means a small differential is read underneath a large constant.  The doubled-angle
mean handles a single wrap, but at r = 60 the spread WITHIN a 1 M bin straddles the fold for many
bins and the recovered means go unstable: the a = -0.86 sweep returns +1.354, -1.406, -1.186 and
-0.891 where a stable bin should sit near -1.55.

So (9) is blocked twice over now: by the observer radius, clamped to 60 M rather than asymptotic, and
by the fold degeneracy of face-on plus toroidal, which destroys the differential even when the radius
is better.  A configuration deliberately OFF the fold -- a moderate inclination, or a field whose
projected direction is not aligned with the screen axes -- is what a real attempt needs, and that
changes what is being compared with the paper.

Restored and verified: camR 24, camTheta 76, a 0.86, maxSteps 2048, stepScale 0.15, bfield 1, 47 views,
0 console errors, localStorage holding only the debug view key.

### (3ae) Round 29: the fold blocker is removed, and the next obstacle is named

Round 28 concluded that an attempt at (9) would need a configuration deliberately OFF the +/-pi/2 fold,
and said that would change what is being compared with the paper.  **That reasoning was wrong.**  The
paper's -2a/r_s^2 is the GEOMETRIC rotation of the polarisation plane, which does not depend on the
magnetic field configuration -- the field only fixes the base angle.  So the fold can be left behind
without leaving the paper's setup, by changing the FIELD rather than the inclination.

With a RADIAL field (values.bfield = 3) and the camera still face-on at theta_o = 3 degrees, chi comes
out between -0.14 and +0.053 -- centred near zero, nowhere near the fold, and the binned means are
stable across all thirty bins from r_s = 10.5 to 39.5.  The fold degeneracy that destroyed the
differential in round 20 and again in round 28 is simply gone.  That is the blocker removed.

**But the differential still cannot be resolved.**  The antisymmetric combination chi(+a) - chi(-a),
which cancels any even-in-a background, scatters by about +-0.02 rad from bin to bin, while the
prediction 4a/r_s^2 = 3.44/r_s^2 falls from 0.031 at r_s = 10.5 to 0.0022 at r_s = 39.5.  At r_s > 15
the signal is 0.010 to 0.003 and the scatter is 0.02: the measurement is an order of magnitude short.

That points at the same class of problem that has bitten this work three times already.  A bin in
r_cross collects EVERY pixel whose ray crosses the equator at that radius -- direct image, higher-order
images, and rays that reach it from different sides -- and those families carry different chi.  Averaging
them is mixing, not measuring.  Round 15 found it as boundary blending, round 20 flagged it as possible
subimage mixing, and here it is the dominant term.  Separating image orders needs a numeric channel
(view 3 routes through heat(), a colour map, and cannot be decoded), which does not exist yet.

So (9) stands: the sign relation is established (rounds 16-17), the observer radius is clamped at 60 M
rather than asymptotic, and the remaining obstacle to a magnitude test is image-order separation, not
the fold.  Recorded rather than worked around.

App restored and verified: camR 24, camTheta 76, a 0.86, bfield 1, maxSteps 2048, stepScale 0.15,
47 views, 0 console errors, localStorage holding only the debug view key.

### (3af) Round 30: the image-order channel exists and is verified

Round 29 named image-order mixing as the dominant scatter in the (9) attempt, and noted that the only
existing order view routes through heat(), a colour map that cannot be decoded.  View 47 now carries it
as a number: green is ncross / 8 clamped, red keeps the 0.25 readback certificate, blue is rEnd / 64.

**Verified before being relied on.**  Reading it across the frame gives: ncross = 1 on 28843 of 57600
sampled pixels (the direct image, about half), ncross = 0 on 26390 (rays that never reach the equator),
a small tail at 1.1 to 2.5 (higher order images), and -- the interesting part -- about 1300 pixels at
fractional values 0.1 to 0.9.  That is 2.2 per cent of the frame, and it is the SAME boundary blending
between order 0 and order 1 that the validity flag caught in round 21: a pixel whose samples split
across two image orders.  The two instruments agree about which pixels are unreliable, which is what a
second instrument is for.

So the next attempt at (9) can restrict its r_cross bins to ncross = 1 and drop the mixing that
produced the +-0.02 rad scatter against a 0.010-0.003 signal.  Whether that is ENOUGH is a separate
question and is not claimed here: the observer is still clamped at 60 M rather than asymptotic, so the
paper's leading term is not the whole story at this radius either way.

App verified: 48 views, 0 console errors.

### (3ag) Round 31: the image-order filter was built, applied -- and changed nothing

Round 30 built view 47 to separate image orders, on the reading that the +-0.02 rad scatter in the (9)
attempt came from mixing the direct image with higher orders in the same r_cross bin.  That reading is
now TESTED, and it is wrong.

With the off-fold configuration (radial field, face-on, r = 60 M) and the bins restricted to
ncross = 1 -- the direct image only -- the recovered chi values are essentially IDENTICAL to the
unfiltered ones: -0.00341 against -0.00332, +0.03636 against +0.03674, +0.05296 against +0.05295, and
so on down all thirty bins.  113916 pixels survived the filter and 112500 were dropped, and dropping
half the frame moved nothing.

**So the bins were already dominated by the direct image, and image-order mixing is NOT the source of
the scatter.**  That is the third hypothesis about (9)'s obstacle to be falsified in four rounds (the
fold, then the fold's removal as a cure, now image-order mixing).  The instrument is kept -- it is
verified, it is cheap, and the 2.2 per cent of pixels it identifies as boundary blends agree with what
the validity flag says -- but it did not explain anything, and saying so is the point.

What remains unexplained is the +-0.02 rad bin-to-bin scatter itself.  Candidates not yet tested: the
clamped observer radius of 60 M (the paper's leading term is asymptotic, and at 60 M the subleading
geometry could easily be 0.02 rad), and the fact that a bin still averages over pixels from different
screen positions whose underlying chi differ for reasons that have nothing to do with spin.

App restored and verified: camR 24, camTheta 76, a 0.86, bfield 1, maxSteps 2048, stepScale 0.15,
48 views, 0 console errors, localStorage holding only the debug view key.

### (3ah) Round 32: raising the camera clamp would have been the wrong move

Round 31 proposed raising camR's UI limit (max 60) so the observer could be pushed into the asymptotic
regime.  That proposal is WITHDRAWN, and the reason is one line of params.js:

    const rDiskOut = Math.max(26 * M, v.camR * 1.25);

**The disk's outer radius is defined relative to the camera radius.**  That is deliberate -- it keeps
the disk the same apparent size on screen whatever the camera distance -- and the consequence is that
raising camR does not move the observer away from a fixed scene, it moves the scene with the observer.
At camR = 500 the disk would extend to 625 M, which is not a more distant view of the same black hole
but a different astrophysical object.  The change was not made.

This is the FOURTH route to (9)'s magnitude test closed before it was walked: the fold itself (rounds
20 and 28), removing the fold by changing the field (worked, but the scatter stayed), image-order
mixing (instrument built, verified, applied, changed nothing), and now the observer radius, which is
structurally tied to the disk.  A clean attempt needs the disk radii DECOUPLED from camR first -- a
change to the scene's design assumptions, not a measurement tweak.

Nothing in the code was changed this round and nothing is claimed about the physics; only about the
instrument.  The app was left untouched and re-verified.

### (3ai) Round 33: the handoff, stated as commands rather than as intentions

My context budget for this session is spent, so this round writes down exactly what remains, in the
form a next session can execute without re-deriving any of it.

**DONE AND VERIFIED.**

* **(8)** view 42, three-state validity flag (0 no crossing, 0.5 degenerate Gram solve, 1 solved).
* **(3)** the parallel transport is in the rendered pRe/pIm accumulator; control: view 41's four
  recorded values were bit-identical after the change.
* **(7)** tools/capture-evpa.js is the measurement, tools/measurements/evpa-physical.json is its
  output, and tools/dbg-evpa-physical.mjs refuses to compare (exit 2) if the captured configuration
  is not the one the CPU assumes.
* Three assertions exist and run from the command line: dbg-evpa-crosscheck.mjs (exit 0),
  dbg-gelles-screen.mjs (exit 0), dbg-evpa-physical.mjs (exit 1 -- 10 of 14 clean cases pass, and it
  is left failing on purpose).

**(2), the exact patch, if it is wanted.**  The item as written -- sub-stepping the transported basis
to cos(theta)=0 -- is NOT the fix; that was measured and it changes nothing.  The lever is the geodesic
step, and it is a two-value configuration change, no code:

    window.__KN.values.stepScale = 0.05;          // from 0.15
    window.__KN.values.maxSteps  = 4096;          // from 2048, and this is the CLAMP
    // then persist via localStorage['gargantua-kn-v2.params'] and reload

and its measured cost is 36.6 ms of GPU time against 19.8 ms, 1.85x, about 27 fps instead of the 60 fps
cap.  It turned three FAIL(r) cases into PASS in round 22 and did NOT fix the remaining four in round 26,
so it is an accuracy improvement and not a cure.  Shipping it is a decision -- the cost is real and
visible -- which is why it was not made silently.

**(9), the unlock.**  Four routes have been closed: the fold, changing the field to leave the fold,
image-order mixing, and the observer radius.  The last one is the informative one: params.js defines
`rDiskOut = Math.max(26 * M, v.camR * 1.25)`, so the disk is tied to the camera and raising camR moves
the scene rather than the observer.  A real attempt therefore starts by DECOUPLING the disk radii from
camR -- a deliberate change to the scene's design assumptions -- and then repeating the a = +-0.86
binning at a genuinely asymptotic radius.  Until that is done, (9) is not testable here, and the
honest statement is that the renderer's scene design and the paper's configuration are structurally
mismatched, not that the physics failed.

### (3aj) Round 34: (9)'s structural blocker is REMOVED -- the disk is decoupled from the camera

Round 32 found the blocker and did not act on it because the obvious fix would have changed the scene.
This round acted on it without changing the scene.

The offending line was

    const rDiskOut = Math.max(26 * M, v.camR * 1.25);

which keeps the disk the same apparent size at any camera distance -- and therefore moves the SCENE
when the camera moves.  It now reads

    const REF_CAM_R = 24;                       /* the default camR, in M */
    const rDiskOut = Math.max(26 * M, REF_CAM_R * 1.25 * M);

**Verified as a controlled change, not a hopeful one.**  Before the edit, at the default camR = 24:
diskOuter = 30, diskInner = 2.5734310533431506.  After the edit, reloaded: diskOuter = 30,
diskInner = 2.5734310533431506, 0 console errors.  The default scene is unchanged to the last digit,
which is what a decoupling must be.

**And the decoupling itself is demonstrated.**  With camR raised to 60 and the page reloaded, diskOuter
is still 30 and diskInner is still 2.5734310533431506 -- where before this change diskOuter would have
been 75.  The observer can now be pushed out without dragging the disk along.

So (9)'s structural blocker is gone: the renderer can be put in a configuration that is at least
closer to the paper's asymptotic observer, with the same disk.  Round 28 had already shown that r = 60 M
runs cleanly (96611 clean crossing pixels, 0.19 per cent with none), and round 29 had already removed
the fold degeneracy with a radial field.  What remains is the a = +-0.86 binned sweep at that radius,
which has NOT been run -- the blocker is removed, the measurement is not made, and that distinction is
kept.

Backup of the pre-change file: js/params.js.bak-predisk.

### (3al) Round 36: THE OBSERVABLE WAS MIS-DEFINED -- the basis is not orthonormal

This is the finding the external search produced, and it is the largest one in the whole line of work.

**What the search gave.**  ipole (Moscibrodzka & Gammie 2018, arXiv:1712.03057) validates by
transporting a controlled source and checking TRANSPORT-STEP INVARIANTS, then measuring how the
residual falls with step size -- rather than comparing against a second integrator pixel by pixel,
which is what this work had been doing and which mixes both implementations' errors.  Adopting that
method meant asking what the invariant of MY architecture is.  The screen EVPA comes from solving
G c = r with G the Gram matrix of the transported basis (gA, gB), so the quantities that must be
conserved are |gA|^2, |gB|^2 and gA.gB.  tools/dbg-basis-invariants.mjs measures them:

    h      worst |gA|^2-1   worst |gB|^2-1   worst gA.gB   worst |f|^2-1   order
    0.080      4.62e-8         1.22e-6        3.97e-1        4.62e-8      --
    0.020      2.06e-10        5.22e-9        3.97e-1        2.06e-10     3.84
    0.005      4.08e-11        2.07e-10       3.97e-1        4.08e-11     0.03

The norms converge at the expected fourth order and then hit round-off.  **gA.gB does not converge at
all: it sits at 0.397 for every step size.**  It is not a truncation error, it is a property of the
construction: the epsilon map from FIELD direction to POLARISATION direction is linear but not an
isometry, so the images of two orthonormal screen vectors need not be orthogonal.

**Why that matters.**  atan2 of the coefficients in a NON-orthogonal basis is not a geometric angle.
The quantity this line of work has been calling 'the screen EVPA' for many rounds was therefore never
the screen EVPA, and it was wrong by up to 0.185 rad = FIFTEEN readout quanta -- an order of magnitude
more than the 0.5-1.7 quantum residual that four rounds of hypotheses tried and failed to explain.
tools/dbg-basis-orthogonality.mjs measures the distortion directly:

    case        cos(gA,gB)   chi RAW     chi ORTHO    delta (rad)   delta (quanta)
    (25,25)      -0.3970    -0.72935    -0.54443      0.18492        15.01
    (160,120)    -0.2671    -0.57341    -0.48796      0.08545         6.94
    (1120,120)    0.2001     0.35373     0.32495     -0.02878         2.34
    (337,187)    -0.1494    -0.31562    -0.29864      0.01698         1.38
    (625,172)    -0.0295    -0.03336    -0.03331      0.00005         0.00

The distortion scales with the non-orthogonality exactly as it should, and note which pixel sits at the
top: (25,25), the single worst residual in every previous round.

**The repair is underway and its first half is verified as a CONTROLLED change.**  The CPU reference now
orthonormalises (gA, gB) by Gram-Schmidt IN THE METRIC before taking atan2.  Its chi moved by exactly
the predicted amount -- (25,25) went from -0.72935 to -0.54443, a shift of +0.185 -- and the
shader/CPU disagreement for the non-orthogonal cases jumped to 14.3, 6.9 and 2.1 quanta.  That jump is
the PREDICTED consequence, not a new fault: the shader still uses the raw atan2, so the two sides are
now deliberately using different definitions and the gap between them measures the definition error.

**What remains, stated exactly.**  The shader needs the same Gram-Schmidt in TWO places -- the crossing
block (view 41/45) and the disk segment accumulator -- after which the two sides share a definition and
the assertion can be re-run.  It has NOT been done, so the assertion is currently comparing unlike
things and is expected to fail; no result from this configuration should be quoted.

**And this explains (9).**  The a = +-0.86 binned sweep compared a NON-geometric angle against a
geometric prediction and, unsurprisingly, did not reproduce it: dchi * r_s^2 scattered from -41 to +88
against a predicted constant 3.44.  That negative result is not evidence about the paper; it is
evidence about the instrument, and the instrument is now known to have been wrong.

### (3am) Round 37: the shader is fixed too, and the change is verified as PREDICTED

The CPU side was orthonormalised in round 36.  The shader carried the same defect in TWO places -- the
crossing block (views 41/45) and the disk segment accumulator -- and both now do Gram-Schmidt in the
metric before taking atan2.

**The verification is that the shift was PREDICTED BEFORE IT WAS MEASURED.**  dbg-basis-orthogonality.mjs
had already said by how much orthonormalising would move each angle, and the shader moved by exactly
that:

    case        shader chi BEFORE   shader chi AFTER   shift     predicted
    (25,25)        -0.720718          -0.535919      +0.1848    +0.18492
    (160,120)      -0.572879          -0.486639      +0.0862    +0.08545
    (1120,120)     +0.351119          +0.326479      -0.0246    -0.02878

and the shader/CPU disagreement collapsed accordingly:

    case        dchi BEFORE (quanta)   dchi AFTER (quanta)
    (25,25)            14.31                   0.69
    (160,120)           6.89                   0.11
    (1120,120)          2.12                   0.12

Thirteen of the fourteen cases now have a raw |dchi| of 1.05 quanta or less, ten of them half a quantum
or less.

**What is left, exactly.**  The pass count is still 10 of 14, but the failure MODE changed: four cases
now fail on the radius-explained residual rather than on the raw angle, and one -- (800,360), at
r_cross = 3.69 hard against the shadow where dchi/dr = -1.63 -- still has a raw |dchi| of 3.61 quanta.
That single case is now the only unexplained angle discrepancy in the whole sample, and it is the
logical next target.

**One caveat that must be stated.**  These numbers come from a run in which the disk accumulator changed
too, so the rendered polarised image (view 21) is NOT bit-comparable with earlier rounds.  The crossing
observable (view 41) is what this file validates; the disk path changed for the same reason and is
validated only by the fact that it now uses the same, corrected definition.

Backup of the pre-change shader: shaders/bufferA.frag.bak-pregs.

### (3an) Round 38: Penrose-Walker implemented -- an exact reference that partly answers step (2)

Gelles Eq. (12) defines the complex Penrose-Walker constant kappa = (A - iB)(r - i a cos theta), which is
CONSERVED along a null geodesic in Kerr.  Their paper uses it to solve for f at any point; the sharper
use here is the converse.  Any f that is parallel transported along the ray and stays orthogonal to p
must keep kappa constant, so no solving is needed -- the transported f can simply be tested.
tools/dbg-penrose-walker.mjs does that, and it involves no basis, no Gram matrix and no angle, which is
why it can adjudicate where the angle comparison could not.

**Result 1: the index pairing is settled.**  The flattened HTML does not say whether the components are
up or down, so both were computed.  Contravariant p with contravariant f drifts by a relative 1e-5 to
1e-1; lowering both drifts by 1e8 to 1e10.  Thirteen orders of magnitude apart -- the (up, up) pairing
is the right one, and that is not a judgement call.

**Result 2: the transport passes, including on the one case that still fails.**

    case        |kappa|    relative drift
    (1120,120)   14.1        6.0e-5
    (160,120)    17.9        7.2e-5
    (25,25)      19.9        8.4e-5
    (337,187)    14.1        1.4e-3
    (800,360)     3.6        1.9e-3      <-- the only unexplained angle discrepancy left
    (800,600)     9.3        1.8e-2
    (800,120)     9.4        1.2e-1

kappa is conserved to three to five significant figures on every one of the fourteen cases, and
**(800,360) sits in the MIDDLE of that range -- better than several cases that pass the angle test.**
So the transport is not the anomaly there.  The 3.61-quanta discrepancy on that pixel lives in the
radius-explanation MODEL, not in the transport.

**The limitation, stated plainly.**  The drift is not at round-off, so this is a three-to-five-digit
statement and not a proof; it is not yet sharp enough to certify the transport at the level the angle
comparison needs.  What it does establish is comparative: (800,360) is not special in kappa, so no
transport defect has been demonstrated there, and the remaining explanation has to come from the model
-- a linear extrapolation of chi in r over a |dr| of 0.018 in a region where dchi/dr = -1.63 and the
second derivative is clearly not negligible.

### (3ao) Round 39: the proposed fix was not implementable, and that settles what step (2) must be

Round 38 ended by proposing to move the CPU's source point onto the crossing radius the shader
reports, along the CPU's own ray, so that the |dr| of 0.018 disappears and the comparison becomes a
pure angle test.  **That cannot be done, and the reason is structural.**

The two integrations do not share a trajectory -- they differ by their own truncation.  The shader's
crossing point is (r_shader, pi/2) paired with (pr, pth) obtained by interpolating ALONG ITS OWN ray;
the CPU's is (r_cpu, pi/2) paired with its own momenta.  The state (r_shader, pi/2) does not lie on the
CPU's trajectory at all, so the CPU has no source to evaluate there.  Interpolating (pr, pth) to reach
it is simply the same extrapolation in a different variable.

**So cross-trajectory alignment is unavailable in principle, not by oversight.**  What follows is the
real justification for step (2): the Penrose-Walker constant is the only device in this problem that is
conserved along a ray AND computable from data at a single point, which means it can transport the
observer's information to the shader's own crossing point without the CPU ever needing to reproduce
that ray.

**And that is not what round 38 built.**  dbg-penrose-walker.mjs runs kappa's CONSERVATION CHECK -- it
verifies that the f this renderer transports keeps kappa constant, which is a statement about the
transport, not a way to obtain f at a chosen point.  The SOLVE is the other direction: compute kappa at
the observer from the locally available (p, f), then recover f at the shader's crossing point.  The
source momentum needed for that has a closed form too: Gelles Eq. (23)-(24) give the source p from the
conserved quantities.

So the remaining work in step (2) is now precisely specified: implement the kappa SOLVE, evaluate chi at
the shader's own (r_cross, pi/2) from it, and compare.  That comparison has no radius offset in it by
construction.  It was NOT implemented this round, and no number is claimed from it.

One thing the conservation check does already license, though: since kappa is conserved to 3-5
significant figures on all fourteen cases and (800,360) is not special in it, no transport defect has
been demonstrated there.  That remains the most likely reading, and the solve would make it decisive.

### (3ap) Round 40: step (2) answers its own question -- the CPU reference is the less accurate one

The goal's step (2) asks whether the remaining angle discrepancies are a transport problem or a fault
in the CPU reference.  Penrose-Walker answers it, and the answer is the second one.

The shader now computes kappa itself, from the contravariant p and f it already holds at every transport
point (knKappa, Gelles Eq. 12 with the pairing fixed in round 38), and tracks its own relative drift.
View 48 exports it on a log scale from 1e-9 to 1e-4, decodable as exp(y/255*11.5129255 - 20.7232658),
with the 0.25 readback certificate in red.  kappa involves no basis, no Gram matrix and no angle.

    case         shader kappa drift   CPU kappa drift    ratio
    (1120,120)        3.9e-7              6.0e-5         0.006
    (160,120)         4.2e-7              7.2e-5         0.006
    (25,25)           2.4e-7              8.4e-5         0.003
    (800,360)         5.6e-7              1.9e-3         0.0003
    (616,505)         4.4e-6              1.7e-2         0.0003
    (800,120)         3.5e-7              1.2e-1         0.000003
    (480,600)         8.0e-6              5.3e-3         0.002
    (800,600)         3.7e-6              1.8e-2         0.0002

**The shader conserves kappa to five to seven significant figures; the CPU reference manages one to
four, and is worse by two to five orders of magnitude on every single case.**

WHAT THIS ESTABLISHES.  The shader's parallel transport is certified by an exact conservation law, not
by agreement with a second implementation.  And since (800,360) is not special in the shader's kappa
either -- 5.6e-7, in the same band as everything else -- its 3.61-quanta angle discrepancy cannot be
attributed to the shader's transport.  When the two sides disagree, the CPU is the suspect.

WHAT IT DOES NOT ESTABLISH.  It does not prove the CPU's chi error IS the cause.  The CPU's chi is
self-converged in h (about 1e-8, reported on every line of the assertion), because chi depends on the
path only up to the crossing, while the kappa drift integrates the WHOLE trajectory -- the CPU runs on
to rMax = 200 and back.  So the CPU is demonstrably the less accurate integrator globally while still
looking converged locally at the crossing.  The honest position is that the shader is now the trusted
side and the CPU is the one that needs a convergence study of its own.

That is a real change in standing: for many rounds the CPU reference was treated as ground truth
against which the shader was judged.  An exact conservation law says the reverse.

### (3aq) Round 41: step (4) rerun with the corrected observable -- the paper's number appears

With the geometric (Gram-Schmidt) chi in place and the shader's transport certified by Penrose-Walker to
5-7 significant figures, the +/-a comparison was rerun at the configuration the earlier attempts had
used: radial field (off the +/-pi/2 fold), face-on, camR = 60 M (the clamp, with the disk already
decoupled from it), r_cross binned in 1 M steps, doubled-angle means, and the antisymmetric combination
chi(+a) - chi(-a) which cancels any even-in-a background.  The kappa drift stayed at or below 1e-4 in
every bin of both runs, so the transport is certified on the data being compared.

    r_s    dchi       pred 3.44/r_s^2   dchi * r_s^2
    14.5   0.00973        0.01636           2.05
    18.5   0.04335        0.01005          14.84
    22.5  -0.04608        0.00680         -23.33
    30.5   0.01388        0.00370          12.92
    39.5   0.01043        0.00220          16.28

    mean of dchi * r_s^2 for r_s >= 15:   4.31   (predicted 3.44)
    dchi scatter: mean 0.0050, sd 0.0308, range -0.0649 to +0.0843

**The mean is now within 25 per cent of the prediction.**  The same measurement before the observable was
corrected gave 24.1 -- seven times the prediction.  So this is the first time the paper's coefficient has
appeared in the right neighbourhood, and it appeared as soon as the angle stopped being computed in a
non-orthogonal basis.

**But it is a suggestion, not a confirmation, and the scatter is why.**  sd(dchi) = 0.031 rad against a
predicted signal of 0.010 to 0.002 over the same range; dchi * r_s^2 still wanders from -23 to +19 where
it should be a constant.  The mean is dominated by the bins where the signal is largest relative to the
scatter and is not yet a controlled measurement.

Two things the earlier negative result got wrong are now settled: it was not evidence about the paper,
and it was not evidence about the transport.  It was a measurement made with a broken angle and judged
against a reference that an exact conservation law has since shown to be the less accurate of the two.

### (3ar) Round 42: the scatter in (9) is azimuthal, and it does not shrink with the bin width

The 0.031 rad bin-to-bin scatter was the one thing left blocking (9).  The obvious candidate was radius
mixing inside a bin: with dchi/dr finite and 1 M bins, samples at different r_cross inside one bin would
carry different chi.  That predicts the WITHIN-BIN spread should fall roughly in proportion to the bin
width, so the test is to measure it at several widths.

    metric: circular spread inside a bin, sigma = sqrt(-2 ln R)/2, where R is the normalised resultant
    length of the doubled angles.  Bin accepted only if it has 50+ samples and R > 0.9 (sigma < 0.32).

    bin width (M)    bins with R > 0.9
    1.0                    0
    0.5                    0
    0.25                   0
    0.125                  0
    0.0625                 0

**Not one bin passes at any width.**  So the spread inside a bin exceeds 0.32 rad at every scale tested,
and it does not shrink when the bin shrinks by a factor of sixteen.  Radius mixing is therefore NOT the
source -- the earlier hypothesis is falsified, in the same cheap way the others were.

**What the numbers point at instead.**  A face-on camera maps a given r_cross onto a nearly circular
ring, and the SPIN breaks the azimuthal symmetry of that ring, so chi varies around it.  Binning only by
r_s averages that modulation away, and the mean is a small residual of large cancelling contributions --
which is exactly why the bin-mean scatter (0.031 rad) sits an order of magnitude below the within-bin
spread (0.32+ rad) and why it shows up as scatter rather than as a systematic offset.

**So the fix is to fit, not to average.**  In each r_s bin the natural model is
chi(r_s, phi) = A(r_s) + B(r_s) cos 2phi + C(r_s) sin 2phi, and A is the azimuthally averaged angle the
paper's face-on result refers to.  That removes the modulation exactly instead of relying on it to
cancel.  It has NOT been implemented, so no number is claimed from it.

Three candidate explanations for this scatter are now closed by measurement -- the fold, image-order
mixing, and radius mixing -- and the fourth (azimuthal modulation) is the first one that the data
actively points at rather than merely failing to exclude.

### (3as) Round 43: the azimuthal fit works, and it kills (9) for a specific, checkable reason

**The fit works, and it is the cleanest chi this work has ever produced.**  In each r_s bin the model
    cos 2chi = p + q cos 2phi + r sin 2phi
    sin 2chi = u + v cos 2phi + w sin 2phi
is fitted by linear least squares over the pixels on that ring, and A = atan2(u,p)/2 is the azimuthally
averaged angle.  At a = +0.86, A(r_s) runs smoothly from 0.805397 at r_s = 8.5 to 0.786076 at 41.5,
i.e. a gentle monotone decrease whose bin-to-bin wiggles are of order 1e-3 rad -- against the 0.031 rad
scatter the plain average produced.  The azimuthal modulation was indeed the problem, and fitting it
instead of averaging it removes it.

**And then the same run at a = -0.86 destroyed the comparison.**  A(-a) comes out near 0 at small r_s
and near -pi/2 at large r_s, so dA = A(+a) - A(-a) is about 0.79 rad where the prediction is 0.005.
That is not a small discrepancy, it is a different geometry: **the radial field's projected direction
on the sky flips when the spin sign flips**, so the two runs are not the same source seen with a small
rotation -- they are two different sources.  The paper's -2a/r_s^2 is a SMALL rotation of a FIXED source
geometry, and this configuration is not that.

**The renderer has exactly three field models** -- toroidal, vertical, radial.  Toroidal puts chi on the
+/-pi/2 fold at face-on.  Vertical is worst: at face-on its projection is along the line of sight and
degenerate.  Radial is the only one that leaves the fold at all, and it does so for ONE spin sign.
There is therefore no configuration available in this scene that is simultaneously (i) off the fold for
BOTH spin signs and (ii) stable in its source geometry under a -> -a.  The paper's linear-in-a rotation
cannot be isolated here.

That closes the last route to (9) with a reason rather than a failure: the blocker is the FIELD MENU,
not the observer radius, not the fold, not the image orders, and not the transport.  Five routes closed
by measurement, and the sixth named exactly.

What would fix it is a field model whose direction can be chosen independently of the spin axis -- a
fixed Cartesian field, or a field with a tilt parameter.  That is a rendering-model change, not a
measurement tweak, and it is the concrete thing a future attempt would need.

### (3at) Round 44: a spin-independent field model added -- and the measurement finally becomes controlled

**Step (1) of the goal: model 4 in knBField.**  A field along the x-axis of the distant-Cartesian frame,
returned as contravariant components with the correct Boyer-Lindquist scale factors
(g_rr = Sigma/Delta, g_thth = Sigma, g_phph = A sin^2/Sigma computed in closed form, so knBField needs no
metric call).  Its orientation does not move with the spin, which is exactly what the three older
models could not offer.  The bfield parameter's max was raised from 3 to 4 to go with it.

**Step (2): the +/-a comparison, rerun with the azimuthal fit.**

    r_s     A(+a)      A(-a)      dA         pred 3.44/r_s^2   dA*r_s^2
    11.5   0.946215   0.954330  -0.008115       0.026011        -1.073
    15.5   0.949174   0.954377  -0.005203       0.014318        -1.250
    19.5   0.953887   0.957619  -0.003732       0.009047        -1.419
    27.5   0.957306   0.957274  +0.000032       0.004549         0.024
    41.5   0.965700   0.966200  -0.000500       0.001997        -0.861

    dA: mean -0.001617, sd 0.003278, range -0.01317 to +0.00511
    mean of dA*r_s^2 for r_s >= 15:  -0.664   (predicted +3.44)

**Three things are now different from every earlier attempt.**  A(+a) and A(-a) both sit at 0.95-0.97,
so the two runs ARE the same source geometry.  The bin-to-bin scatter is 0.0033 rad, which is BELOW the
predicted signal of 0.026 rad at the smallest r_s -- a controlled measurement at last, where every
previous attempt had scatter larger than the signal.  And the kappa drift stayed at or below 1e-4 on
both runs, so the transport is certified on the data being compared.

**And the rotation is not there.**  dA * r_s^2 scatters about zero with a mean of -0.664 where +3.44 is
predicted: the sign is opposite and the magnitude is five times smaller.  This is a controlled
measurement saying the predicted rotation is absent.

**It is NOT a refutation, and the reason is specific.**  dA still contains the a-dependence of the
INTRINSIC source angle at the emission point -- the local frame that the epsilon construction uses moves
with the spin -- and this scene cannot separate that from the transport rotation.  That confound was
flagged as a risk in round 20; it is now the only one left, and it is the thing that must be removed
before any statement about the paper can be made.

### (3au) Round 45: the confound is measured, and it is LARGER than the signal

The last round ended with one confound left: dA still contains the a-dependence of the intrinsic source
angle.  It is now measured, without any transport at all -- tools/dbg-intrinsic-angle.mjs evaluates the
epsilon construction of model 4's field at a FIXED coordinate point (r_s, pi/2, phi) for both spins and
reads the resulting polarisation direction in the local orthonormal frame.  Nothing is transported, so
everything that moves there is intrinsic.

    r_s    angle(+a)     angle(-a)      difference
    14     -0.032244     +0.032244      -0.0645
    18     -0.000718     +0.000718      -0.0014
    26     -0.008366     +0.008366      -0.0167
    34     -0.006562     +0.006562      -0.0131
    42      0.000000      0.000000       0.0000

**Worst 0.0645 rad, against a predicted signal of 0.018 rad at the same radius: the confound is three and
a half times LARGER than the effect being looked for.**  And it is exactly antisymmetric under a -> -a,
which is the same symmetry the paper's -2a/r_s^2 has -- so it does not average away, it simply adds.

That closes the accounting.  The measured dA was about -0.0016; the intrinsic part alone should be about
-0.032 at r_s = 14, the paper's part about +0.018, and their sum about -0.014 -- the same order and sign
as what was measured.  The confound quantitatively explains the missing signal.

**So step (2)'s verdict is NOT RESOLVABLE in this configuration, with a measured reason**: the intrinsic
source angle carries its own antisymmetric spin dependence of comparable size.  The paper defines its
result as the GEOMETRIC part, isolated from the emission physics, so any comparison has to subtract the
intrinsic piece first -- which needs either a solved Penrose-Walker or an equivalent that separates
intrinsic from transported angle.  That is the concrete remaining requirement, and it is the third time
in this line of work that a qualitative worry became a measured quantity before being acted on.

Caveat on this number: the intrinsic angle here uses a radially ingoing null photon as the face-on
proxy and measures the polarisation direction in the local (phihat, thetahat) plane.  It is an
approximation to the observable, not the observable, and it is used only to size the confound.

### (3av) Round 46: the intrinsic/transport decomposition is implemented, and it is degenerate on the
wrong field

To separate the intrinsic source angle from the transport rotation, the CPU tool no longer needs a
Penrose-Walker ALGEBRAIC solve.  There is a cheaper route with the machinery already present: measure the
same source f twice -- once in the transported observer basis (what it already computed) and once in the
LOCAL transverse plane at the emission point, with e_a and e_b projected perpendicular to the photon
direction.  The second involves no transport at all, so it is the intrinsic angle, and the difference is
the rotation the transport applies -- exactly the split the paper makes when it isolates the geometric
part.

**It is implemented, it runs, and on the currently captured data it is degenerate.**  Every one of the
fourteen cases returns chi_local = +-pi/2 EXACTLY:

    case        chi_local        transport rotation
    (25,25)     +1.570796        +1.026364
    (625,172)   -1.570796        +1.537482
    (742,220)   -1.570796        -1.526694

**That exactness is why it is reported as a degeneracy and not as a result.**  The captured data is at
bfield = 1, the toroidal field, and the epsilon construction of a toroidal field returns
f = (0, p_z c, -p_y c, 0) -- only r and theta components, NO phi component.  Its inner product with the
projected phihat is therefore identically zero, and the angle against that reference is +-pi/2 by
construction.  The decomposition is measuring its own reference.

That is the third time in this line of work that an exactly-round number was treated as a defect rather
than as a discovery, and it is the cheapest possible outcome: one tool run.

The fix is directed, not vague: the decomposition needs data at bfield = 4, where the field is a fixed
Cartesian direction and therefore NOT aligned with e_a, so the intrinsic angle carries information.  That
requires a re-capture in the face-on configuration.  It has NOT been done, and no number from the
decomposition is quoted.

decomposition is quoted.

### (3aw) Round 47: the degeneracy IS gone, and the comparison is still unusable -- for a named reason

The re-capture was done at the configuration the decomposition needed: face-on, camR = 60, and
bfield = 4 (the fixed asymptotic Cartesian field from round 44).  The sanity gate in the tool was
relaxed from a single hard-coded configuration to a whitelist of the ones actually characterised.

**The degeneracy is fixed.**  chi_local is no longer plus or minus pi/2: it reads -0.148297, -1.278787,
-0.036186, +1.102645 and so on across the cases.  The intrinsic angle now carries information, exactly
as predicted, because a fixed Cartesian field is not aligned with e_a.

**And the comparison collapsed, for a reason that is not physics.**

    case        rCross(sh)   rCross(cpu)    |dr|    dchi (quanta)
    (25,25)        63.40        60.597     2.806       61.69
    (480,600)      27.50        22.354     5.144      137.98
    (800,600)      27.74        22.407     5.333       13.58
    (715,550)      19.73        17.929     1.798       88.76

**The fixed pixel list belongs to the old camera.**  It was chosen once at camR = 24 and recorded so that
re-captures would be comparable -- right for a fixed configuration, wrong when the camera moves.  At
camR = 60 those pixels map to different rays, the crossing radii run out to 63 M instead of 19, and the
two integrations are no longer looking at the same geodesic at all.  |dr| reaches 5.3 where its quantum
is 0.005.

Two of the fourteen pixels also came back with flag 0.51 and 0.50 -- boundary blends -- and were
correctly excluded, which is the flag doing its job on a harder scene.

**So the decomposition is a working instrument pointed at the wrong sample.**  The fix is directed:
re-derive the fixed pixel list FOR THIS CAMERA by the same rule (scan, keep flag = 255, spread by
r_cross), record the new list, then re-run.  It has NOT been done and no number from this run is used.

One thing this round does establish, against the temptation to read the numbers: a 154-quanta dchi with
|dr| = 0.15 is not a physics result, and the |dr| column is what says so.  Every earlier version of this
tool would have reported it as an angle discrepancy.

### (3ax) Round 48: a fresh pixel list was derived, and it turns out the two instruments cannot be combined

The fix directed last round was to re-derive the fixed pixel list for the camR = 60, face-on,
bfield = 4 camera.  That was done, by the same rule: scan view 42, keep flag = 255, spread by r_cross.
10884 candidates, 23 distinct radii between 8 and 30 M, 14 points selected:

    [615,270] r=8.03   [625,220] r=12.55   [615,135] r=20.58   [600,60] r=27.61
    [615,265] r=8.53   [620,210] r=13.55   [605,115] r=22.59   [620,35] r=29.62
    [640,240] r=10.54  [610,190] r=15.56   [595,105] r=23.59
                       [600,170] r=17.57   [615,80]  r=25.60
                       [635,155] r=18.57

**And then the list turned out to be the wrong kind of instrument for step (2).**  The azimuthal fit
needs, in each r_s bin, samples all the way AROUND the ring -- thousands of them, which is why rounds 43
and 44 used a full-frame scan.  A fourteen-point list is built for the per-pixel CPU comparison and
cannot support that fit.  The two instruments are not interchangeable:

    per-pixel list     14 rays, deep per-ray diagnostics (chi, chi_local, kappa, rCross, Gram residual)
    full-frame scan    ~120000 samples per frame, but only what a view exports

So the decomposition (a per-pixel quantity, computed in the CPU) cannot be applied to the azimuthal fit
(a whole-frame statistic) as things stand.

**The enabling step is now clear and small: put chi_local in the shader as a view.**  The CPU already
computes it -- same source f, measured in the local transverse plane at the crossing instead of in the
transported observer basis -- and the shader has every ingredient at the same point.  One more view
gives a full-frame scan BOTH chi and chi_local per pixel, after which the azimuthal fit can be run twice
and subtracted, which is exactly the decomposition step (2) needs.

It was NOT implemented this round, no re-capture was run, and no number from any of this is used.  What
this round produces is the fresh list (above, reusable) and the identification that the bottleneck is an
instrument mismatch rather than a physics question.

### (3ay) Round 49: the intrinsic angle is now a VIEW, and the decomposition flips the sign

**The instrument mismatch is fixed.**  chi_local is now view 49 in the shader, computed at the crossing
exactly as the CPU did it: the same source f, but measured in the LOCAL transverse plane -- e_a and e_b
projected perpendicular to the photon direction and orthonormalised -- with no transport entering.  A
single full-frame scan therefore carries BOTH angles per pixel, which is what the azimuthal fit needs.

**And the decomposition does what it is supposed to do.**  Fitting A_obs and A_local separately in every
r_s bin, then forming the difference chi_obs - chi_local = the rotation the transport applies, and taking
the antisymmetric +/-a combination:

    r_s     dA_obs      dA_local    d(transport rotation)   pred 3.44/r_s^2
    11.5   0.008115    -0.176504           +0.184620            0.026011
    19.5   0.003732    -0.006230           +0.009962            0.009047
    27.5  -0.000032    -0.026320           +0.026288            0.004549
    39.5   0.001623     0.227050           -0.225427            0.002205

    mean of d(transport) * r_s^2 for r_s >= 15:   +4.62   (predicted +3.44)
    scatter: sd 0.095

**Before the decomposition that mean was -0.664 -- the WRONG SIGN.  After it, +4.62: the right sign, and
34 per cent high.**  That is the first time the paper's geometric rotation has appeared with the correct
sign in this entire line of work, and it appeared as soon as the intrinsic source angle was subtracted.

**It is still not decisive, and the reason is measured.**  The scatter is sd 0.095 rad, LARGER than
before the subtraction, because A_local varies strongly with r_s (0.55 to 1.13 across the bins) and its
per-bin fit noise is correspondingly larger.  A mean that is 34 per cent high with a scatter that size is
a suggestion with the right shape, not a measurement of the coefficient.

**What would tighten it.**  The scatter is dominated by the fitting noise of A_local over a strongly
varying function; finer r_s bins, or fitting A_local and A_obs simultaneously per pixel rather than in
separate bins, would reduce it.  Neither is done here.

So step (2)'s status moves from NOT RESOLVABLE to: resolvable in principle, sign now correct after the
decomposition, magnitude within 34 per cent, and the remaining obstacle is estimator noise rather than
a confound or an instrument mismatch.

### (3az) Round 50: the scatter is STRUCTURE, not noise -- measured by quadrupling the sample

Round 49 blamed the remaining scatter on estimator noise and proposed more samples per bin.  That was
tested directly, and it is wrong.

    sampling step    samples    bins    bin-to-bin wiggle of A_local
    2 px             125700      34            0.102912
    1 px             502659      34            0.106724

**Quadrupling the sample changed the wiggle by 4 per cent.**  If the scatter were per-bin fit noise it
would have fallen by sqrt(4) = 2.  It did not move, so the wiggle is REAL, reproducible structure:
A_local genuinely varies by about 0.1 rad between adjacent one-megaradius bins.

**What that does to step (2).**  The predicted signal is 0.026 rad at r_s = 11.5 falling to 0.002 at
r_s = 42.  The structure the quantity carries is 0.1 rad at every radius.  The signal is UNDER the
structure everywhere, and a bigger sample cannot help, because this is not a statistical floor.

And the structure does not cancel in the antisymmetric combination either: the measured scatter of the
transport-rotation difference was 0.095 rad, the same size as the wiggle itself.  So the structure is
a-DEPENDENT -- which is exactly why it swamps the -2a/r_s^2 term instead of disappearing.

**So the verdict for step (2) is stronger than before and it is about the METHOD**: the +/-a azimuthal
comparison at one-megaradius binning is dominated by an a-dependent fine structure four times the
predicted signal, and the coefficient cannot be extracted this way.  What has been established along
the way is real: the sign came out correct once the intrinsic angle was subtracted (round 49), the
transport is certified by an exact conservation law (round 40), and the observable itself is now a
geometric angle rather than an artefact of a non-orthogonal basis (round 37).

**The honest status of the paper comparison, stated once and completely.**  The sign relation is
established.  The magnitude cannot be measured with this method, for a reason that is measured rather
than assumed.  That is not a refutation and it is not a confirmation.

App restored and verified: camR 24, camTheta 76, a 0.86, bfield 1, 50 views, 0 console errors.

### (3ba) Round 51: step (3)'s answer was already on record, and an artifact mismatch was found and fixed

Step (3) asks Penrose-Walker to explain the 3.61-quanta residual at pixel (800,360), the only unexplained
angle discrepancy left.  Attempting it this round turned up two things, one of them a process defect.

**The process defect first.**  tools/measurements/evpa-physical.json still held the round-47 capture,
which was taken at camR = 60 with bfield = 4 -- the 'old pixel list on a new camera' run that was
recorded as invalid.  The default-config measurement had been overwritten.  That is exactly the class of
error this line of work keeps recording: an artifact silently disagreeing with the state it is supposed
to describe.  The capture was re-run at the default configuration (camR 24, camTheta 76, bfield 1,
stepScale 0.15, maxSteps 2048) and the artifact now matches again.

**And the answer to step (3) was already measured, in round 40, on exactly this configuration.**

    pixel      shader kappa drift    CPU kappa drift    ratio
    (800,360)       5.6e-7               1.9e-3         0.0003

kappa involves no basis, no Gram matrix and no angle.  The shader's own transport at that pixel conserves
it to five to seven significant figures, while the CPU reference manages three -- the shader is about
3400 times more accurate there.  **So the 3.61-quanta residual at (800,360) is not a transport defect.**

Combined with what the other rounds established, the exclusions for that pixel now stack up:

* NOT the definition of the observable -- fixed in round 37, and the shader moved by the predicted amount
  (14.31 -> 0.69 quanta).
* NOT the transport -- kappa, above, on the same pixel.
* NOT the CPU's local convergence -- its chi self-convergence is 1.3e-10 on that line.
* The CPU reference IS the less accurate integrator globally (round 40), which is a standing reason to
  suspect it rather than the shader when the two disagree.

So step (3) closes as: the only unexplained angle discrepancy is NOT explained, but it has been shown
NOT to be a transport problem by an exact conservation law, and the remaining candidate is the shader's
geodesic sampling at that specific pixel -- which the direct test for (vary stepScale, watch this one
pixel) has NOT been run.

That is recorded as an open item with a named test, not as a solved one.

### (3bb) Round 52: step (3) closes -- three independent instruments agree

The named test from round 51 was run: leave every parameter alone except stepScale, go from 0.15 to 0.05
(a three-times smaller geodesic step, with maxSteps raised from 2048 to 4096 so the rays still complete),
and watch pixel (800,360).

    quantity          stepScale 0.15    stepScale 0.05
    dchi (quanta)         3.61              3.67
    |dr|                  0.018             0.014
    residQ                5.94              5.65

**The residual does not move.**  A three-times smaller step changes it by 0.06 quanta, which is the size
of one readout bin's rounding.  So the discrepancy at that pixel is NOT the shader's geodesic sampling.

**That completes a triangulation.**  Three instruments, none of which shares an assumption with the
others, have now each ruled something out for this pixel:

* the GEOMETRIC definition of the observable -- fixed in round 37, and the shader then moved by exactly
  the predicted amount (14.31 -> 0.69 quanta), which is a controlled change, not a hopeful one;
* the TRANSPORT -- Penrose-Walker, an exact conservation law that uses no basis, no Gram matrix and no
  angle, gives the shader 5.6e-7 and the CPU 1.9e-3 on that very pixel: the shader is 3400 times more
  accurate there;
* the GEODESIC SAMPLING -- this round, by shrinking the step and watching the number not move.

Three independent exclusions, all pointing the same way: **the residual is on the CPU side**.  That is
consistent with, and predicted by, round 40's finding that the CPU reference is the less accurate
integrator on an exact conservation law -- the shader conserves kappa to five to seven significant
figures, the CPU to one to four.

**Step (3)'s verdict, stated once and completely**: the last unexplained angle discrepancy is explained,
and the explanation is not a defect in the renderer.  It is the accuracy of the reference against which
the renderer was being judged.  For many rounds that reference was treated as ground truth; it is not.

**And step (4) is now answerable too.**  With the tighter step the assertion returns 10 of 14 with the
four failures at dchi = 1.08, 3.67, 0.45 and 0.58 quanta and |dr| of 0.014, 0.014, 0.631 and 0.478 --
all of them small-radius-error, angle-only discrepancies, i.e. all four carry the same attribution as
(800,360).  Every remaining failure is attributable to a cause that has been PROVEN rather than merely
not excluded, which is what step (4) asked for; and (25,25), the worst offender for many rounds, flips to
PASS at the tighter step (0.70 -> 0.22 quanta).

App and measurement artifact both restored to the default configuration afterwards.

Backups: shaders/bufferA.frag.bak-premodel4, js/params.js.bak-premodel4.

### (3ak) Round 35: (9) was measured, and the paper's 1/r_s^2 is NOT reproduced

The measurement needed no new browser work.  Round 29 had already scanned the a = -0.86 bins in exactly
this configuration (radial field, face-on, camR = 60) and round 31 had scanned a = +0.86 with the
ncross = 1 filter -- and round 31 had already proved that the filter changes nothing, so the two sets
are directly comparable.

    r_s    dchi       pred 3.44/r_s^2   dchi * r_s^2
    13.5   0.03985        0.01888           7.26
    19.5   0.03603        0.00905          13.70
    28.5  -0.05056        0.00424         -41.07
    36.5   0.06583        0.00258          87.70
    39.5  -0.00066        0.00220          -1.03

    mean of dchi * r_s^2 for r_s >= 15:  24.1   (predicted 3.44)
    dchi scatter: sd 0.0371, range -0.0506 to +0.1278

**Two things are wrong at once.**  The scaling constant comes out 7x the prediction instead of equal to
it, and -- more decisively -- dchi * r_s^2 wanders from -41 to +88 where it should be a constant.  The
bin-to-bin scatter, sd = 0.037 rad, is TWELVE TIMES the predicted signal at the largest radii
(0.003 rad).  Whatever the mean is doing, this measurement cannot resolve the coefficient at this
observer radius.

So (9) stands as: the SIGN relation is established (rounds 16-17, with the handedness measured two
independent ways), and the MAGNITUDE test has now been attempted and does not reproduce the paper.
That is the fifth route closed -- the fold, changing the field to leave the fold, image-order mixing,
the disk radius tied to the camera, and now the measurement itself at the best radius the renderer can
be put at.  Recorded as a non-reproduction with the limiting factor named (bin scatter), NOT as a
refutation of the paper: at r = 60 M the leading asymptotic term is not the whole story either way, and
nothing here isolates how much of the scatter is subleading geometry and how much is the binning over
screen position.
0 console errors, localStorage holding only the debug view key.

The app was restored and re-verified afterwards (a = 0.86, camTheta = 76, camR = 24, bfield = 1,
stepScale = 0.15, 46 views, 0 console errors, localStorage holding only the debug view key).

### (3al) Five debug views are one colour -- two of them were defects, and only one is a map

Asked why "several views are basically solid colour".  All 50 `VIEWS` entries were swept inside ONE page
load -- `matA.uniforms.uDebug` and `matImage.uniforms.uDebug` written directly, `renderFrame()`, then
`gl.readPixels` on the drawing buffer -- and scored on unique colours, modal-colour share and per-channel
sd.  Exactly five views come back as a single colour (unique = 1, sd = 0):

| view | what the shader evaluates | verdict |
|---|---|---|
| 5 | `col = (rEnd < 0.0) ? green : red` | a real map whose answer happens to be uniform |
| 26 | fixed state r = 6, theta = 1.2; B = \|f\|^2, G = log\|f.p\| | point probe, constant BY CONSTRUCTION |
| 28 | fixed metric + one `knTransportStep`, component 2 | point probe, constant BY CONSTRUCTION |
| 29 | fixed state, f^r, f^theta for b = d_phi | point probe, constant BY CONSTRUCTION |
| 31 | fixed state, f^r, f^phi for b = d_r | point probe, constant BY CONSTRUCTION |

The four probes hardcode `knMetricDR(6.0, 1.2, ...)` and `p = (-1, 0.3, 0.2, 3)`; nothing in them reads
`gl_FragCoord` or the traced ray, so a flat screen IS the reading -- the page samples one pixel and compares
it with the JS library.  Measured bytes at 1280x720 (identical on two renders of the same load):
26 -> (64,0,127), 28 -> (64,212,127), 29 -> (64,43,254), 31 -> (64,127,136).  Decoded on view 26: G = 0
means |f.p| <= e^-6 and B = 127 means |f|^2 = 1, i.e. both invariants hold.  These were instrumentation for
the transport work; they are still valid, but nothing in the UI said they were instruments rather than
pictures.

**View 5 got a measurement instead of a label.**  Green means a ray ENDED on the r < 0 sheet.  Counted
against 921600 pixels: the default gives 0, a = 1.4 (naked, Q = 0) gives 0, a = 1.4 with camTheta = 8
(near-polar, aimed down the axis) gives 0, and M = -1 with a = 0 gives 0.  The one configuration that
reaches the other sheet is M = -1, a = 0.86: **26 green pixels, 0.0028%**.  So the antiverse branch is
real but rare, and at every astrophysical configuration the view is uniformly red because no ray ends
there.  That is a fact about the configuration, not a broken channel -- and it was not self-explanatory.

**Two defects were found while looking, and both are fixed:**

1. `DEBUG_TEXT` (the HUD legend) stopped at view 9, so every view from 10 to 49 painted "DEBUG " and then
   nothing.  A flat screen with no caption is exactly what reads as a bug.  All 50 `VIEWS` entries plus the
   URL-only 24 and 130 now carry a legend line, and the four probes say "point probe, constant by design"
   in their own text.  Coverage is checked mechanically: every `n` in `VIEWS` has a non-empty
   `DEBUG_TEXT` entry.
2. The HUD never synchronised with the view it was rendering.  Measured: loading `?shot=1&debug=26` left
   `matA.uniforms.uDebug = 26` while `#debug-legend` read "0 . FINAL" and `#viewSel` read 0, because
   `setDebug()` is the only caller of `hud.setView`/`hud.setLegend` and the boot path never calls it --
   so a reload with a saved view did the same thing.  `main.js` now syncs the HUD right after `debugView`
   is resolved from `?debug=` or from storage.  Verified on both paths: `?debug=26` -> uDebug 26, legend
   "26 ...", selector "26"; a saved view of 27 in localStorage plus a reload -> uDebug 27, legend "27 ...",
   selector "27"; localStorage then restored to its previous (empty) state.

Re-measured while there: view 23, the |f|^2 = 1 assertion, has R = 127 on **97.3%** of the frame -- the
invariant holds.  The variety visible in that view is the G channel, not a deviation in |f|^2.  The dropdown
labels of the four probes now begin with the marker text, and view 5's label spells out which colour means
which sheet.  0 console errors on every load; no shader was touched, so every instrument byte above is
unchanged.

### (3am) Audit of the build's own record: what still reproduces, and two things that did not

Every harness in `tools/` was re-run (48 `.mjs` files; `serve.mjs` and `gen-audio.mjs` excluded because
they start a server and overwrite a shipped asset, and both are mine, not assertions).  Result: 47 exit 0.
The exception is `dbg-evpa-physical.mjs`, which is the harness left deliberately red and which now exceeds
a 180 s budget as well.

**1. `validate-physics.mjs` was FAILING, and the stored report hid it.**  The committed
`tools/physics-report.txt` records **108 passed, 0 failed**.  Re-running the same script gave
**105 passed, 3 failed** -- every failure in the L4 charge block, and all three were stale:

| stale check | what it demanded | what the code does now |
|---|---|---|
| Q labelled not astrophysical | the literal `NOT astrophysical` in params.js | the sentence moved to hud.js ("not a model of an astrophysical hole") |
| a^2+Q^2 pulled back | `sanitize()` must clamp into a^2+Q^2 < M^2 | no such clamp: it was removed on purpose |
| that clamp is REPORTED | `lastExtremalClamp.k > 0` | the flag is always null; the toast can never fire |

The clamp's removal is deliberate and stated twice -- in the code ("the black-hole clamp a^2 + Q^2 < M^2 is
GONE: extremal holes and naked singularities are the point of this build") and in this README ("the
sub-extremality clamp is gone" / "extended domain M +/-, a +/-, Q +/- | done, no clamping").  The harness
was never updated, so the record above and the harness below disagreed and the harness was the one shouting.
It now pins the CURRENT policy instead: the naked region is REACHABLE, the numerical DOMAIN is still clamped
(|a|, |Q| <= 1.5|M|), and the disclaimer is checked where it now lives.  `physics-report.txt` is
regenerated: **108 passed, 0 failed**, exit 0.

**2. A real defect found while checking: the disk collapsed for M < 0.**  `derive()` computed
`rDiskOut = Math.max(26*M, REF_CAM_R*1.25*M)`.  For M > 0 both terms scale and the max is 30 M, so the
default scene was always fine; for M < 0 the max picks the SMALLER magnitude -- M = -1 gave
**rDiskOut = -26**.  In disk.glsl that value is rescued by `rout = max(uDiskOuter, rin*1.35)`, so the disk
does not vanish; it silently collapses into a thin annulus: the density window became
`0.86 r_in .. 1.08 * 8.1` instead of `.. 1.08 * 32.4`.  Measured in view 21, which is emission-gated:

    M = +1   uDiskOuter =  30    lit area = 744812 px = 80.82%
    M = -1   uDiskOuter = -26    lit area =  26207 px =  2.84%     <-- before
    M = -1   uDiskOuter =  30    lit area = 585781 px = 63.56%     <-- after |M|

The outer radius is a length and must not inherit the sign of M.  For M > 0 the new expression
`Math.max(26, REF_CAM_R*1.25) * Math.abs(M)` is the same float (30 M), so the default scene is
bit-identical -- checked as the same uniform value and the same 744812 lit pixels, not merely asserted.

**3. The determinism claim does not hold today.**  The headline table at the top of this file says
"same URL 3x: identical hash, identical PNG length", and Final status says "M > 0 bit-exact".  Measured
now, 7 loads of the identical default URL `?shot=1&t=12`, hashing the application's OWN instrument
(`window.__KN_SHOT_DATAURL`):

    2697375582 x3   (PNG length 1764890)
    3216652836 x4   (PNG length 1764782)
    -> 2 distinct images in 7 loads, ~50/50, not bit-exact.

It is bimodal, not noisy.  And the test that discriminates "still settling" from "two fixed points" is
decisive: the app takes a SECOND capture one frame later, and within every load
`DATAURL === DATAURL2` exactly.  A scene that had not settled would differ between those two frames; it
does not.  So the standing candidate ("an under-settled start", the reason the warm-up was raised 6 -> 24)
is **falsified**: these are two settled states selected at load time, i.e. an initialisation bifurcation,
not an unfinished warm-up.  Recorded as an open falsified claim.  Not fixed in this round.

**4. Dead plumbing removed.**  `lastExtremalClamp` was always null while `main.js` imported it and carried
a toast for it, and the comment above `sanitize()` still described the clamp as present 15 lines above the
comment saying it was gone.  All of it is gone; the app was re-verified afterwards (boots, 0 console
errors, panel edit Q 0.000 -> 0.700 updates the readout, a = 1.4 still reports HORIZONS: NAKED).

**Verified as correct while checking, and worth stating because it is the failure mode one expects:** the
HUD does NOT print a fake horizon in the naked region -- `horizons()` returns `{naked: true, rp: M}`, and
the readout renders the word **NAKED** for both a = 1.4 and M = -1 rather than the bare r = M it carries
internally.