/* Service worker собирается вместе с сайтом: в шаблон scripts/sw-template.js подставляются
   номер сборки и список её файлов /assets/. Раз текст sw.js меняется с каждой сборкой,
   браузер ставит новую версию, а та при активации удаляет из кэша файлы прошлых сборок. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TEMPLATE = path.join(path.dirname(new URL(import.meta.url).pathname), 'sw-template.js');

export function renderServiceWorker(assets, template = fs.readFileSync(TEMPLATE, 'utf8')) {
  const list = [...assets].sort();
  const id = crypto.createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
  return template.replace(/\/\*__BUILD__\*\/\s*\{[^}]*\}/, JSON.stringify({ id, assets: list }));
}

export default function serviceWorker() {
  return {
    name: 'inflatia-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((f) => f.startsWith('assets/'));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker(assets) });
    },
  };
}
