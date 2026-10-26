// Synthesise the voiceover, check every line fits the gap before the next cue,
// lay the lines on a silent bed at their cue times and mux onto the video.
//
//   node narrate.mjs desktop   walkthrough.mp4       walkthrough-narrated.mp4
//   node narrate.mjs phone     walkthrough-phone.mp4 walkthrough-phone-narrated.mp4
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const FF = join(ROOT, 'node_modules/ffmpeg-static/ffmpeg.exe');
const PY = join(ROOT, '.ttsvenv/Scripts/python.exe');

const [which, inVideo, outVideo] = process.argv.slice(2);
if (!which || !inVideo || !outVideo) { console.error('usage: narrate.mjs <desktop|phone> <in.mp4> <out.mp4>'); process.exit(1); }

const spec = JSON.parse(readFileSync(join(ROOT, 'narration.json'), 'utf8'));
const cues = spec[which];
if (!cues) { console.error('no cues named ' + which); process.exit(1); }

const WORK = join(ROOT, 'vo-' + which);
if (!process.env.KEEP_VO) rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function durationOf(file) {
  let out = '';
  try { run(FF, ['-hide_banner', '-i', file]); }
  catch (e) { out = (e.stderr || e.stdout || '').toString(); }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error('no duration for ' + file);
  return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}

// ---------------------------------------------------------------- synthesise
console.log(`voice ${spec.voice}  rate ${spec.rate}\n`);
const clips = [];
for (let i = 0; i < cues.length; i++) {
  const c = cues[i];
  const mp3 = join(WORK, `v${String(i).padStart(2, '0')}.mp3`);
  if (!existsSync(mp3)) {
    // --rate=-4% must be one token: argparse would read a bare "-4%" as a flag.
    run(PY, ['-m', 'edge_tts', '--voice', spec.voice, `--rate=${spec.rate}`,
             `--pitch=${spec.pitch}`, '--no-progress', '--text', c.text, '--write-media', mp3]);
  }
  const dur = durationOf(mp3);
  const next = i + 1 < cues.length ? cues[i + 1].t : Infinity;
  const room = next - c.t - 0.35;
  const over = dur - room;
  clips.push({ ...c, mp3, dur, room });
  const flag = over > 0 ? `  OVER BY ${over.toFixed(2)}s` : '';
  console.log(`${String(i).padStart(2)}  @${c.t.toFixed(1).padStart(5)}s  ${dur.toFixed(2)}s / ${isFinite(room) ? room.toFixed(2) : '  ∞'}s${flag}`);
}

const over = clips.filter(c => c.dur > c.room);
if (over.length) {
  console.error(`\n${over.length} line(s) do not fit. Shorten them in narration.json and re-run.`);
  if (!process.env.FORCE) process.exit(2);
}

// ------------------------------------------------------- lay on a silent bed
const videoDur = durationOf(join(ROOT, inVideo));
const tail = Math.max(0, ...clips.map(c => c.t + c.dur));
const bed = Math.max(videoDur, tail) + 0.2;
console.log(`\nvideo ${videoDur.toFixed(2)}s   voice ends ${tail.toFixed(2)}s`);

const inputs = clips.flatMap(c => ['-i', c.mp3]);
const delays = clips.map((c, i) =>
  `[${i}:a]aresample=48000,adelay=${Math.round(c.t * 1000)}|${Math.round(c.t * 1000)}[d${i}]`).join(';');
const mixIn = clips.map((_, i) => `[d${i}]`).join('');
const filter =
  `${delays};${mixIn}amix=inputs=${clips.length}:duration=longest:normalize=0[vo];` +
  `[vo]apad=whole_dur=${bed.toFixed(2)},alimiter=limit=0.92,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;

const track = join(WORK, 'voiceover.m4a');
run(FF, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter,
         '-map', '[out]', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', track]);
console.log('voiceover track', durationOf(track).toFixed(2) + 's');

// --------------------------------------------------------------------- mux
run(FF, ['-y', '-loglevel', 'error', '-i', join(ROOT, inVideo), '-i', track,
         '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
         '-shortest', '-movflags', '+faststart', join(ROOT, outVideo)]);
console.log('wrote', outVideo, durationOf(join(ROOT, outVideo)).toFixed(2) + 's');
