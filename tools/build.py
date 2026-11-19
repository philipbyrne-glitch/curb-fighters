"""Export a standalone HTML copy for offline use and the legacy GoDaddy workflows."""
import base64
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MIME_TYPES = {
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.json': 'application/json',
}


def data_url(path):
    encoded = base64.b64encode(path.read_bytes()).decode('ascii')
    return f'data:{MIME_TYPES[path.suffix]};base64,{encoded}'


def build():
    html = (REPO / 'index.html').read_text(encoding='utf-8')
    source = REPO / 'source'
    css = (source / 'style.css').read_text(encoding='utf-8')
    css = re.sub(r'url\((\.\./assets/built/[^)]+)\)',
                 lambda match: f'url({data_url(source / match[1])})', css)
    assets = (source / 'assets.js').read_text(encoding='utf-8')
    manifest = json.loads(assets.removeprefix('window.CF_DATA = ').strip().removesuffix(';'))
    for group in ('img', 'audio'):
        manifest[group] = {key: data_url(REPO / path) for key, path in manifest[group].items()}
    manifest['metaUrl'] = data_url(REPO / manifest['metaUrl'])
    game = (source / 'game.js').read_text(encoding='utf-8')
    if '</script' in game.lower():
        raise ValueError('Game script contains an HTML script closing tag')
    html = re.sub(r'href="(assets/built/[^"]+)"',
                  lambda match: f'href="{data_url(REPO / match[1])}"', html)
    return (
        html.replace('<link rel="stylesheet" href="source/style.css">', f'<style>{css}</style>')
        .replace('<script src="source/assets.js"></script>',
                 f'<script>window.CF_DATA = {json.dumps(manifest, separators=(",", ":"))};</script>')
        .replace('<script src="source/game.js"></script>', f'<script>{game}</script>')
    )


if __name__ == '__main__':
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / 'dist' / 'index.html'
    if output.resolve() == REPO / 'index.html':
        raise SystemExit('Choose an export path other than the web entry point index.html.')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build(), encoding='utf-8')
    print(f'{output} ({output.stat().st_size:,} bytes)')
