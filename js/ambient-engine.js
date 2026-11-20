// Ambient sounds, generated live with the Web Audio API: no recordings, so
// nothing to license and nothing to download. Each sound is a small graph of
// noise, filters and oscillators, plus a scheduler for the little random events
// (rain drops, key clicks, cup clinks, crackles).

export const SOUNDS = [
  { id: "rain", name: "Rain", note: "Steady rain on a window" },
  { id: "cafe", name: "Café", note: "Murmur, cups and clatter" },
  { id: "keys", name: "Keyboard", note: "Someone typing nearby" },
  { id: "server", name: "Server room", note: "Hum, fans, disk ticks" },
  { id: "waves", name: "Ocean waves", note: "Slow swells on a beach" },
  { id: "fire", name: "Fireplace", note: "Crackling logs" },
];

const R = (a, b) => a + Math.random() * (b - a);

function noiseBuffer(ac, kind) {
  const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else if (kind === "pink") { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
    else d[i] = w;
  }
  return buf;
}

export class Ambient {
  constructor() { this.ac = null; this.ch = {}; this.timer = 0; }

  ensure() {
    if (this.ac) { if (this.ac.state === "suspended") this.ac.resume(); return; }
    const ac = (this.ac = new AudioContext());
    this.master = ac.createGain(); this.master.gain.value = 0.9; this.master.connect(ac.destination);
    this.buf = { white: noiseBuffer(ac, "white"), pink: noiseBuffer(ac, "pink"), brown: noiseBuffer(ac, "brown") };
    this.timer = setInterval(() => this.tick(), 90);
  }

  // A looping noise source through a chain of filters into `out`.
  loop(kind, out, filters = [], gain = 1) {
    const ac = this.ac, src = ac.createBufferSource(); src.buffer = this.buf[kind]; src.loop = true;
    src.loopStart = Math.random(); // different start so layers don't line up
    let node = src;
    for (const [type, freq, q] of filters) { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; node.connect(f); node = f; }
    const g = ac.createGain(); g.gain.value = gain; node.connect(g); g.connect(out);
    src.start(0, Math.random() * 3);
    return { src, g };
  }
  // A short burst of filtered noise at time t (a drop, a click, a crackle).
  burst(out, t, dur, freq, q, vol, type = "bandpass", kind = "white") {
    const ac = this.ac, s = ac.createBufferSource(); s.buffer = this.buf[kind];
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 3); s.stop(t + dur + 0.02);
  }
  tone(out, t, freq, dur, vol, type = "sine") {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  lfo(param, rate, depth) { const o = this.ac.createOscillator(), g = this.ac.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o; }

  build(id) {
    const ac = this.ac, out = ac.createGain(); out.gain.value = 0; out.connect(this.master);
    const c = { out, nodes: [], next: 0, state: {} };
    const keep = (x) => { c.nodes.push(x.src || x); return x; };
    if (id === "rain") {
      keep(this.loop("white", out, [["highpass", 600], ["lowpass", 7000]], 0.32));
      keep(this.loop("pink", out, [["lowpass", 1200]], 0.35));
      keep(this.loop("brown", out, [["lowpass", 300]], 0.4));
      c.tick = (t) => { while (c.next < t + 0.15) { c.next = Math.max(c.next, t) + R(0.01, 0.07); this.burst(out, c.next, R(0.01, 0.03), R(1800, 5200), 1.5, R(0.04, 0.16)); } };
    } else if (id === "waves") {
      const a = keep(this.loop("brown", out, [["lowpass", 700]], 0.5)), b = keep(this.loop("white", out, [["highpass", 1200], ["lowpass", 5000]], 0.05));
      c.nodes.push(this.lfo(a.g.gain, 0.11, 0.45), this.lfo(b.g.gain, 0.11, 0.05));
    } else if (id === "fire") {
      keep(this.loop("brown", out, [["lowpass", 420]], 0.6));
      keep(this.loop("pink", out, [["bandpass", 900, 0.6]], 0.08));
      c.tick = (t) => {
        while (c.next < t + 0.15) {
          c.next = Math.max(c.next, t) + R(0.02, 0.25);
          const n = Math.random() < 0.15 ? 4 : 1;
          for (let i = 0; i < n; i++) this.burst(out, c.next + i * R(0.008, 0.03), R(0.002, 0.008), R(1500, 6000), 0.8, R(0.1, Math.random() < 0.1 ? 0.6 : 0.3), "highpass");
        }
      };
    } else if (id === "cafe") {
      keep(this.loop("pink", out, [["lowpass", 1500]], 0.28));
      // voices: three formant bands whose loudness wanders like talk
      const bands = [[320, 3], [620, 4], [1150, 5]].map(([f, q]) => keep(this.loop("brown", out, [["bandpass", f, q]], 0.0)));
      c.tick = (t) => {
        if (t > (c.state.v || 0)) { c.state.v = t + R(0.12, 0.35); bands.forEach((b, i) => b.g.gain.setTargetAtTime(Math.random() < 0.3 ? 0.02 : R(0.4, 1.6) / (i + 1), t, 0.06)); }
        if (t > (c.state.clink || 0)) { c.state.clink = t + R(2.5, 8); const f = R(2400, 4200); this.tone(out, t + 0.05, f, 0.5, 0.025); this.tone(out, t + 0.05, f * 1.5, 0.35, 0.012); }
        if (t > (c.state.thud || 0)) { c.state.thud = t + R(4, 11); this.burst(out, t + 0.1, 0.08, 220, 1, 0.12, "lowpass", "brown"); }
      };
    } else if (id === "keys") {
      keep(this.loop("pink", out, [["lowpass", 900]], 0.05));
      c.tick = (t) => {
        while (c.next < t + 0.15) {
          if (!c.state.left) { c.next = Math.max(c.next, t) + R(0.6, 2.4); c.state.left = Math.round(R(4, 28)); continue; } // a pause between words / thoughts
          c.next = Math.max(c.next, t) + R(0.07, 0.19); c.state.left--;
          const space = Math.random() < 0.16;
          this.burst(out, c.next, space ? 0.045 : R(0.015, 0.028), space ? 900 : R(1800, 3600), 1.4, space ? 0.35 : R(0.18, 0.32));
          this.tone(out, c.next, space ? 90 : R(130, 180), 0.03, space ? 0.12 : 0.05);
        }
      };
    } else if (id === "server") {
      for (const [f, v] of [[60, 0.06], [120, 0.045], [180, 0.02], [240, 0.012]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f + R(-0.3, 0.3); g.gain.value = v; o.connect(g); g.connect(out); o.start(); c.nodes.push(o); }
      const fan = keep(this.loop("pink", out, [["lowpass", 650]], 0.45));
      keep(this.loop("white", out, [["bandpass", 3200, 2]], 0.02));
      c.nodes.push(this.lfo(fan.g.gain, 0.07, 0.08));
      c.tick = (t) => { if (t > (c.state.seek || 0)) { c.state.seek = t + R(1.2, 5); const n = Math.round(R(3, 7)); for (let i = 0; i < n; i++) this.burst(out, t + 0.05 + i * R(0.03, 0.07), 0.004, 3500, 1, R(0.06, 0.12), "highpass"); } };
    }
    return c;
  }

  // levels: { rain: 0.6, cafe: 0, ... } (0..1). Missing or 0 means off.
  set(levels) {
    const any = Object.values(levels || {}).some((v) => v > 0);
    if (!any && !this.ac) return;
    this.ensure();
    const t = this.ac.currentTime;
    for (const { id } of SOUNDS) {
      const v = Math.max(0, Math.min(1, (levels && levels[id]) || 0));
      let c = this.ch[id];
      if (v > 0 && !c) { c = this.ch[id] = this.build(id); c.next = t; }
      if (!c) continue;
      clearTimeout(c.kill);
      c.out.gain.setTargetAtTime(v * v * 1.1, t, 0.35); // squared: a slider that feels even
      if (v === 0) c.kill = setTimeout(() => { c.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); c.out.disconnect(); delete this.ch[id]; }, 1800);
    }
  }
  tick() { if (!this.ac) return; const t = this.ac.currentTime; for (const c of Object.values(this.ch)) if (c.tick) c.tick(t); }
  stop() { this.set({}); }
}
