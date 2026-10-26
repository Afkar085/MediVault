# The walkthrough video, from source

`docs/walkthrough.mp4` is not a screen recording and not a mockup. Every frame of
the product in it is a PNG screenshot of this app running against its own API,
driven by a script. The motion graphics around it — titles, captions, the cursor,
the focus rings — are an HTML page rendered a frame at a time. Nothing is drawn by
hand, so the video can be rebuilt after the UI changes.

## How it works

1. **`capture.mjs`** drives the real frontend over the Chrome DevTools Protocol:
   it signs in, uploads a prescription, waits for the extraction to finish, opens
   the record, walks the timeline, switches family member, searches. While it does
   that it screenshots continuously and writes `capture/manifest.json` — the frames
   with their millisecond timestamps, the on-screen box of every element it
   clicked, and the boxes it marked for annotation.
2. **`stage.html`** is the video itself: a 1920×1080 page that composites those
   frames inside a browser window and animates everything else. It exposes
   `window.seek(t)`, which puts the whole composition at time `t` with no CSS
   transitions anywhere — so a given `t` always renders identically.
3. **`render.mjs`** steps `seek()` at 30 fps and screenshots each step.
4. `ffmpeg` encodes the PNG sequence to H.264, and a selection of ranges to the GIF.

Because the cursor and the focus rings are positioned from boxes measured in the
real DOM, they land exactly on the thing being clicked, at the moment it was
clicked.

## Rebuilding it

Needs Node 20+, a Chrome install, and an `ffmpeg` binary
(`npm i ffmpeg-static` gives you one).

```bash
# 1. the app, with the in-memory dev stack — no credentials, no network calls
cd backend && python scripts/dev_server.py          # API on :8787
cd frontend && npm start                            # app on :3100

# 2. a headless Chrome for the scripts to drive
chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/mv-chrome

# 3. capture the product footage (idempotent: it removes what it uploaded)
cd scripts/walkthrough && node capture.mjs

# 4. halve the captured frames for the stage, then render and encode
ffmpeg -i capture/f%05d.png -vf scale=1360:850 capture_s/f%05d.png
node server.mjs &                                   # serves the stage on :7788
node render.mjs                                     # writes frames/v%06d.png
ffmpeg -framerate 30 -i frames/v%06d.png -c:v libx264 -preset slow -crf 19 \
       -pix_fmt yuv420p -movflags +faststart ../../docs/walkthrough.mp4
```

`FPS=1 node render.mjs` renders a one-frame-per-second contact sheet, which is the
quick way to check the edit before committing to a full render.

## Editing the story

The edit lives in one array, `EDIT`, at the top of the script block in
`stage.html`: the order of the acts, which recorded scene each one plays, how much
of it to use (`in`/`out`), how fast (`speed`), the caption beats and which marked
boxes to ring. Changing a caption means changing a string there. Adding a beat to
the product footage means adding steps to `capture.mjs`.
