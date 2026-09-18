/* shaderlib.js -- fetch the GLSL sources and resolve the tiny #include syntax.
   Kept as real .glsl files on disk (readable, diffable) but compiled as one
   string per program, so a static file server is the only requirement. */
const FILES = [
  'fullscreen.vert', 'state.vert', 'bufferA.frag', 'bloom.frag', 'state.frag', 'image.frag',
  'common.glsl', 'kn.glsl', 'sky.glsl', 'disk.glsl',
];

export async function loadShaders(baseHref, onProgress) {
  const src = {};
  let done = 0;
  for (const f of FILES) {
    const url = new URL('shaders/' + f, baseHref).href;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('shader fetch failed: ' + f + ' (' + res.status + ')');
    src[f] = await res.text();
    done++;
    if (onProgress) onProgress(done / FILES.length, f);
  }
  const resolve = (text, depth) => {
    if (depth > 6) throw new Error('include recursion');
    return text.replace(/#include\s+"([^"]+)"/g, (m, name) => {
      if (!(name in src)) throw new Error('missing include: ' + name);
      return resolve(src[name], depth + 1);
    });
  };
  const out = {};
  for (const f of ['bufferA.frag', 'bloom.frag', 'state.frag', 'image.frag']) {
    /* three.js already injects its own "#define SHADER_NAME" into the prefix;
       defining it again is a shader-compile error, so only the sources go in. */
    out[f] = resolve(src[f], 0);
  }
  out['fullscreen.vert'] = src['fullscreen.vert'];
  out['state.vert'] = src['state.vert'];
  return out;
}
