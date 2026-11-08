import { mkdir, writeFile } from 'node:fs/promises';
const sources = [
  { file: 'rocket.mp3', title: 'Bomb Explosion With Whistle', author: 'GarlicBreadBen', page: 'https://www.myinstants.com/en/instant/bomb-explosion-with-whistle-20035/', url: 'https://www.myinstants.com/media/sounds/bomb-explosion-with-whistle.mp3' },
  { file: 'laxmi.mp3', title: 'CSGO AWP', author: 'katerpillar', page: 'https://www.myinstants.com/en/instant/csgo-awp-14800/', url: 'https://www.myinstants.com/media/sounds/awp_02.mp3' },
  { file: 'gola.mp3', title: 'Super Explosion', author: 'BestNoob', page: 'https://www.myinstants.com/en/instant/super-explosion-80886/', url: 'https://www.myinstants.com/media/sounds/super-explosion.mp3' },
];
await mkdir('public/audio', { recursive: true });
for (const source of sources) {
  const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${source.title}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 1000 || !response.headers.get('content-type')?.includes('audio')) throw new Error(`${source.title}: not a valid audio response`);
  await writeFile(`public/audio/${source.file}`, bytes);
  console.log(`${source.file}: ${bytes.length} bytes`);
}
await writeFile('public/audio/sources.json', JSON.stringify({
  note: 'Exact user-selected reference sounds downloaded from the publicly provided MP3 links. Third-party recordings, not original FIREPLAY synthesis. No open redistribution license was supplied by the source pages; retain original rights and attribution. No reference photographs are distributed.', sources,
}, null, 2) + '\n');
