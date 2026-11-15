// Turns three public npm packages into the pack's data files. It reads their files as text and never runs them.
// Usage: node extract-public.mjs <tailwindcss-4.2.2/package> <tailwindcss-3.4.17/package> <@carbon/type/package> <data dir>
import fs from 'node:fs';
import path from 'node:path';

const [tw4, tw3, carbon, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error('usage: node extract-public.mjs <tw4 package dir> <tw3 package dir> <carbon type package dir> <data dir>');
  process.exit(2);
}
const read = (p) => fs.readFileSync(p, 'utf8');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const write = (name, obj) => {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(obj, null, 2) + '\n');
  console.log('wrote', path.join(outDir, name));
};
const ROOT_PX = 16; // the browser default that rem is relative to

// Tailwind CSS 4.2.2: the default text sizes and their paired line heights, from theme.css.
{
  const file = path.join(tw4, 'theme.css');
  const css = read(file);
  const version = JSON.parse(read(path.join(tw4, 'package.json'))).version;
  const steps = [];
  for (const m of css.matchAll(/--text-([a-z0-9]+):\s*([0-9.]+)rem;/g)) {
    const name = m[1];
    const lh = css.match(new RegExp(`--text-${name}--line-height:\\s*([^;]+);`));
    const expr = lh[1].trim();
    const calc = expr.match(/^calc\(\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*\)$/);
    const ratio = calc ? +calc[1] / +calc[2] : +expr;
    const size = +m[2] * ROOT_PX;
    steps.push({
      name: `text-${name}`,
      size_px: +size.toFixed(4),
      line_px: +(ratio * size).toFixed(4),
      tracking: null,
      as_written: { size: `${m[2]}rem`, line_height: expr, at: `theme.css:${lineOf(css, m.index)}` },
    });
  }
  const tracking = [...css.matchAll(/--tracking-([a-z]+):\s*([-0-9.]+)em;/g)].map((m) => ({ name: `tracking-${m[1]}`, em: +m[2], at: `theme.css:${lineOf(css, m.index)}` }));
  write('tailwind-4.2.2-type.json', {
    name: `Tailwind CSS ${version}, default text sizes`,
    source: `npm tailwindcss@${version}, theme.css`,
    licence: 'MIT',
    root_px: ROOT_PX,
    note: 'Tailwind pairs each text size with a line height. Letter spacing is a separate set of utilities, not tied to a size, so the tracking check has nothing to read here.',
    steps,
    separate_tracking_utilities: tracking,
  });
}

// Tailwind CSS 3.4.17: the palette, in hex, from src/public/colors.js.
{
  const file = path.join(tw3, 'src', 'public', 'colors.js');
  const js = read(file);
  const version = JSON.parse(read(path.join(tw3, 'package.json'))).version;
  const families = [];
  for (const m of js.matchAll(/\n\s{2}([a-z]+): \{([^}]*)\}/g)) {
    const shades = Object.fromEntries([...m[2].matchAll(/(\d+): '(#[0-9a-f]{6})'/g)].map((s) => [s[1], s[2]]));
    if (Object.keys(shades).length) families.push({ name: m[1], at: `src/public/colors.js:${lineOf(js, m.index + 1)}`, shades });
  }
  const greys = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
  write('tailwind-3.4.17-palette.json', {
    name: `Tailwind CSS ${version}, default palette`,
    source: `npm tailwindcss@${version}, src/public/colors.js`,
    licence: 'MIT',
    note: 'Hex values, so every colour is inside the sRGB gamut a screen can show. The gradient check uses shade 500 of the 17 colours that are not greys, in the order the file lists them, which runs round the colour wheel from red to rose.',
    greys,
    families,
  });
}

// IBM Carbon @carbon/type: the size generator, the 23-step scale and every type style's base values, from es/index.js.
{
  const file = path.join(carbon, 'es', 'index.js');
  const js = read(file);
  const version = JSON.parse(read(path.join(carbon, 'package.json'))).version;
  const gen = js.match(/const getTypeSize = \(step\) => \{[\s\S]*?\n\};/);
  const scaleM = js.match(/const scale = \[([\s\S]*?)\];/);
  const scale = scaleM[1].split(',').map((s) => +s.trim()).filter((n) => !Number.isNaN(n));
  const styles = [];
  for (const m of js.matchAll(/\nconst ([a-zA-Z0-9]+) = \{/g)) {
    // Walk to the matching brace and keep only the style's own (top-level) values, not its breakpoint overrides.
    let depth = 0, i = m.index + m[0].length - 1, top = '';
    for (; i < js.length; i++) {
      const c = js[i];
      if (c === '{') depth++;
      if (c === '}') { depth--; if (depth === 0) break; }
      if (depth === 1 && c !== '{') top += c;
    }
    const size = top.match(/fontSize:\s*\/\*#__PURE__\*\/\s*rem\(([0-9.]+)\)/);
    const lh = top.match(/lineHeight:\s*([0-9.]+)/);
    if (!size || !lh) continue;
    const ls = top.match(/letterSpacing:\s*(?:\/\*#__PURE__\*\/\s*px\(([-0-9.]+)\)|(0))/);
    const sizePx = +size[1];
    styles.push({
      name: m[1],
      size_px: sizePx,
      line_px: +(+lh[1] * sizePx).toFixed(4),
      tracking: ls ? { value: ls[1] !== undefined ? +ls[1] : 0, unit: ls[1] !== undefined ? 'px' : 'none' } : null,
      has_breakpoints: /breakpoints:/.test(js.slice(m.index, i)),
      as_written: { size: `rem(${size[1]})`, line_height: lh[1], letter_spacing: ls ? ls[0].replace(/\/\*#__PURE__\*\/\s*/, '') : null, at: `es/index.js:${lineOf(js, m.index + 1)}` },
    });
  }
  const aliases = Object.fromEntries([...js.matchAll(/\nconst ([a-zA-Z0-9]+) = ([a-zA-Z0-9]+);/g)].map((m) => [m[1], m[2]]));
  const byName = (n) => styles.find((s) => s.name === (aliases[n] ?? n));
  // Carbon's current names for its reading ladder: one style per size, the default ("long") body styles and the headings.
  const ladderNames = ['label01', 'body01', 'body02', 'heading03', 'heading04', 'heading05', 'heading06', 'heading07'];
  const ladder = ladderNames.map((n) => ({ ...byName(n), name: n, alias_of: aliases[n] ?? null }));
  write(`carbon-type-${version}.json`, {
    name: `IBM Carbon @carbon/type ${version}`,
    source: `npm @carbon/type@${version}, es/index.js`,
    licence: 'Apache-2.0',
    typeface: 'IBM Plex Sans (SIL Open Font Licence)',
    root_px: ROOT_PX,
    size_generator: { code: gen[0], at: `es/index.js:${lineOf(js, gen.index + 1)}` },
    scale: { steps: scale, at: `es/index.js:${lineOf(js, scaleM.index + 1)}` },
    note: 'Sizes are written in rem and letter spacing in px. The ladder is one style per size: label-01 and the default body and heading styles. "styles" is every style, at its base breakpoint.',
    ladder,
    styles,
    aliases,
  });
}
