import { useEffect, useRef, useState } from 'react';
import { Runtime, initialView } from '../engine/runtime';
import type { Clip } from '../recording/recorder';
import type { Firework } from '../types';
import { FIREWORKS, FIREWORK_LABELS } from '../config/fireworks';
import { drawProp } from '../fx/props';

function Icon({ name }: { name: 'sound' | 'muted' | 'settings' | 'switch' | 'close' | 'reset' | 'camera' | 'download' | 'play' | 'fullscreen' | 'flame' | 'fuse' }) {
  const paths = {
    play: <path d="m8 4 13 8-13 8z" fill="currentColor" stroke="none"/>,
    fullscreen: <path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>,
    flame: <path d="M12 2c2 5-4 7-1 11 2-1 3-3 3-5 6 6 7 14-2 14C3 22 1 14 7 9c0 4 2 4 2 4-1-5 3-6 3-11z"/>,
    fuse: <><circle cx="12" cy="15" r="6"/><path d="M12 9c-2-5 5-3 4-7m3 4 3 1M8 15h8m-4-4v8"/></>,
    sound: <><path d="M11 4 6 8H3v8h3l5 4z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></>,
    muted: <><path d="M11 4 6 8H3v8h3l5 4z"/><path d="m16 9 6 6m0-6-6 6"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
    switch: <><path d="M4 9V5h4m12 10v4h-4M4 5c5-5 13-2 15 3M20 19c-5 5-13 2-15-3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
    camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function FireworkIcon({ kind }: { kind: Firework }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 192, 192); ctx.save(); ctx.scale(2, 2);
    drawProp(ctx, kind, 48, 50, { Laxmi: .6, Rocket: .32, Anaar: .42, Gola: .4 }[kind]); ctx.restore();
  }, [kind]);
  return <canvas ref={ref} className="inventory-icon" width={192} height={192} aria-hidden="true"/>;
}

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const clipRef = useRef<Clip | null>(null);
  const [view, setView] = useState(initialView);
  const [settings, setSettings] = useState(false);
  const [muted, setMuted] = useState(false);
  const [debug, setDebug] = useState(false);
  const [guided, setGuided] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [portrait, setPortrait] = useState(true);
  const [quality, setQuality] = useState(720);
  const [clip, setClip] = useState<Clip | null>(null);
  const [fatal, setFatal] = useState('');
  const replay = import.meta.env.DEV && new URLSearchParams(location.search).has('replay');
  useEffect(() => {
    if (!canvas.current) return;
    let engine: Runtime;
    try { engine = new Runtime(canvas.current); } catch (error) { setFatal(error instanceof Error ? error.message : 'WebGL2 is required. Try a current browser.'); return; }
    runtime.current = engine; engine.onview = setView;
    engine.onclip = value => { if (clipRef.current) URL.revokeObjectURL(clipRef.current.url); clipRef.current = value; setClip(value); };
    if (replay) void import('../dev/harness').then(m => m.attachHarness(engine));
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement || event.repeat) return;
      if (event.code === 'Escape') { setSettings(false); return; }
      if (event.code === 'KeyR' && engine.view.camera === 'live') { event.preventDefault(); void engine.record(); }
      if (engine.controller.manual && event.code === 'Space') { event.preventDefault(); engine.light(); }
      if (engine.controller.manual && event.code === 'Enter') { event.preventDefault(); engine.ignite(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('keydown', keyboard); void engine.dispose(); if (clipRef.current) URL.revokeObjectURL(clipRef.current.url); };
  }, [replay]);
  useEffect(() => {
    if (!settings && !clip) return;
    const dialog = document.querySelector<HTMLElement>(clip ? '.clip-panel' : '.settings-panel');
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (clip) { if (clipRef.current) URL.revokeObjectURL(clipRef.current.url); clipRef.current = null; setClip(null); } else setSettings(false); }
      if (e.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), video[controls]'));
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first && last) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last && first) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [settings, clip]);
  const live = view.camera === 'live';
  const loading = view.camera === 'loading';
  const busy = view.phase === 'FUSE_IGNITING' || view.phase === 'EFFECT_PLAYING';
  const call = (action: (engine: Runtime) => void) => { if (runtime.current) action(runtime.current); };
  const start = () => call(e => { void e.start(); });
  function closeClip() { if (clipRef.current) URL.revokeObjectURL(clipRef.current.url); clipRef.current = null; setClip(null); }
  const placed = view.ground === 'detected' || view.ground === 'manual';
  const cue = !placed && !['MATCH_HELD', 'STRIKING'].includes(view.phase) ? 'Show floor · or tap to place' : view.phase === 'READY' ? 'Pinch' : ['MATCH_HELD', 'STRIKING'].includes(view.phase) ? view.torsoReady ? 'Rub on shirt' : 'Show shoulders' : view.phase === 'MATCH_LIT' ? 'Touch fuse' : '';
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return <main className="game">
    <section className="camera-stage" aria-label="Fireplay AR camera">
      <canvas ref={canvas} className="scene-canvas" data-ground={view.ground} aria-label="Mirrored camera with augmented reality fireworks"
        onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); call(engine => engine.pointerMove({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })); }}
        onPointerDown={e => { const r = e.currentTarget.getBoundingClientRect(); const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; call(engine => { if (engine.pointerDown(p)) e.currentTarget.setPointerCapture(e.pointerId); }); }}
        onPointerUp={() => call(engine => engine.pointerUp())} onPointerCancel={() => call(engine => engine.pointerUp())}
        style={{ touchAction: 'none' }}/>
      <div className="stage-top">
        <span className="camera-state" data-testid={view.modelReady && !view.manual ? 'vision-ready' : undefined} aria-label={live ? view.manual ? 'Manual mode' : 'Camera live' : 'Camera off'}>
          {live && <i/>}{view.manual && 'MANUAL'}
        </span>
        <div className="top-actions">
          {live && <button className="icon-button" aria-label="Switch camera" title="Switch camera" disabled={view.recording} onClick={() => call(e => { e.camera.facing = e.camera.facing === 'user' ? 'environment' : 'user'; void e.start(); })}><Icon name="switch"/></button>}
          <button className="icon-button" aria-label={muted ? 'Unmute sound' : 'Mute sound'} title="Sound" aria-pressed={muted} onClick={() => { setMuted(!muted); call(e => { e.audio.setMute(!muted); void e.audio.unlock().catch(() => {}); }); }}><Icon name={muted ? 'muted' : 'sound'}/></button>
          <button className="icon-button" aria-label="Toggle fullscreen" title="Fullscreen" onClick={fullscreen}><Icon name="fullscreen"/></button>
          <button className="icon-button" aria-label="Open settings" title="Settings" aria-expanded={settings} onClick={() => setSettings(!settings)}><Icon name="settings"/></button>
          {live && <button className="icon-button" aria-label="Stop camera" title="Stop" onClick={() => call(e => { void e.stop(); })}><Icon name="close"/></button>}
        </div>
      </div>
      {!live && <div className="start-overlay">
        <button className="play-button" aria-label={view.camera === 'error' ? 'Retry camera' : 'Start Camera'} title="Play" disabled={loading || !!fatal} onClick={start}><Icon name={loading ? 'camera' : 'play'}/></button>
        <small className="privacy-note">Camera stays on your device</small>
        {(view.message || fatal) && <p className="error-message" role="status">{fatal || view.message}</p>}
        <button className="text-button" aria-label="No camera? Open manual studio" disabled={!!fatal || loading} onClick={() => call(e => { void e.studio(); })}>Manual</button>
      </div>}
      {live && <>
        {replay && <div className="replay-label">SYNTHETIC REPLAY</div>}
        {!view.modelReady && !view.manual && <div className="loading-card" role="status"><div className="loading-line"/>{view.message || 'Loading…'}</div>}
        {!view.manual && view.modelReady && cue && <div className="live-hint" key={cue} aria-live="polite">{cue}</div>}
        {view.recording && <><span className="record-timer">● {Math.floor(view.seconds / 60)}:{String(view.seconds % 60).padStart(2, '0')}</span><div className="capture-guide" aria-label="Recording frame" style={{ width: portrait ? 'min(100vw, 56.25dvh)' : 'min(100vw, 177.7778dvh)', height: portrait ? 'min(100dvh, 177.7778vw)' : 'min(100dvh, 56.25vw)' }}/></>}
        <div className="stage-controls">
          {view.manual && <div className="manual-actions">
            <button className="icon-button" aria-label="Light match" title="Light match · Space" onClick={() => call(e => e.light())} disabled={busy}><Icon name="flame"/></button>
            <button className="icon-button" aria-label="Light fuse" title="Light fuse · Enter" onClick={() => call(e => e.ignite())} disabled={busy || !runtime.current?.controller.scene.match?.lit}><Icon name="fuse"/></button>
          </div>}
          <button className="icon-button reset-button" aria-label="Reset experience" title="Reset" onClick={() => call(e => e.reset())}><Icon name="reset"/></button>
          <div className="firework-picker" aria-label="Choose firework">{FIREWORKS.map(kind => <button key={kind} aria-label={FIREWORK_LABELS[kind]} title={FIREWORK_LABELS[kind]} className={view.queued === kind ? 'selected' : ''} aria-pressed={view.queued === kind} onClick={() => call(e => e.select(kind))}><FireworkIcon kind={kind}/>{busy && view.queued === kind && view.selected !== kind && <i className="queued-dot"/>}</button>)}</div>
          <button className={`record-button ${view.recording ? 'recording' : ''}`} aria-label={view.recording ? 'Stop recording' : 'Start recording'} title="Record · R" onClick={() => call(e => { void e.record(); })}><span/></button>
        </div>
        {view.message && !view.message.startsWith('Manual studio') && (view.modelReady || view.manual) && <div className="toast" role="status">{view.message}</div>}
      </>}
      {settings && <div className="settings-scrim" onClick={e => { if (e.target === e.currentTarget) setSettings(false); }}><section className="settings-panel" role="dialog" aria-modal="true" aria-label="Experience settings">
        <div className="panel-heading"><h2>Settings</h2><button className="icon-button" aria-label="Close settings" onClick={() => setSettings(false)} autoFocus><Icon name="close"/></button></div>
        <label className="setting-row"><span>Sound</span><input type="checkbox" checked={!muted} onChange={e => { setMuted(!e.target.checked); call(r => r.audio.setMute(!e.target.checked)); }}/></label>
        <label className="setting-row"><span>Mirror</span><input type="checkbox" checked={mirror} disabled={view.recording} onChange={e => { setMirror(e.target.checked); call(r => r.setMirror(e.target.checked)); }}/></label>
        <label className="setting-row"><span>Gentler motion</span><input type="checkbox" checked={reduced} onChange={e => { setReduced(e.target.checked); call(r => { r.compositor.reduced = e.target.checked; }); }}/></label>
        <label className="setting-row"><span>Manual controls</span><input type="checkbox" checked={view.manual} disabled={!live} onChange={e => call(r => r.setManual(e.target.checked))}/></label>
        <label className="setting-row"><span>Guided strike</span><input type="checkbox" checked={guided} onChange={e => { setGuided(e.target.checked); call(r => r.setGuided(e.target.checked)); }}/></label>
        <label className="setting-row"><span>Debug</span><input type="checkbox" checked={debug} onChange={e => { setDebug(e.target.checked); call(r => { r.compositor.debug = e.target.checked; }); }}/></label>
        <div className="setting-selects"><label>Video<select aria-label="Capture aspect ratio" value={portrait ? 'portrait' : 'landscape'} disabled={view.recording} onChange={e => { const value = e.target.value === 'portrait'; setPortrait(value); call(r => r.resize(value, quality)); }}><option value="portrait">9:16</option><option value="landscape">16:9</option></select></label><label>Quality<select aria-label="Capture quality" value={quality} disabled={view.recording} onChange={e => { const value = Number(e.target.value); setQuality(value); call(r => r.resize(portrait, value)); }}><option value={720}>720p</option><option value={540}>540p</option></select></label></div>
        <div className="settings-links"><button className="text-button" disabled={!live || view.manual} onClick={() => { call(r => r.reset()); setSettings(false); }}>Recalibrate</button><label className="text-button file-button">Local video<input type="file" accept="video/*" onChange={e => { const file = e.target.files?.[0]; if (file) call(r => { void r.studio(file).catch(error => setFatal(String(error))); }); setSettings(false); }}/></label></div>
        <small className="settings-foot">{view.resolution} · {view.fps || '—'} fps</small>
      </section></div>}
      {clip && <div className="clip-scrim"><section className="clip-panel" role="dialog" aria-modal="true" aria-label="Your recorded clip">
        <div className="panel-heading"><h2>Clip</h2><button className="icon-button" aria-label="Close clip" onClick={closeClip} autoFocus><Icon name="close"/></button></div>
        <video src={clip.url} controls playsInline/><p>{view.resolution} · {clip.audio ? 'App audio included' : 'Video only'}</p>
        <a className="download-button" aria-label="Download clip" href={clip.url} download={clip.filename}><Icon name="download"/></a>
      </section></div>}
    </section>
  </main>;
}
