from pathlib import Path
from html.parser import HTMLParser
from html import escape, unescape
import re

root = Path(__file__).resolve().parent.parent
source = root / 'enlaces-de-interes-originales.html'
dest = root / 'enlaces-de-interes.html'

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.comments = []
        self._anchor = None
        self._anchor_text_parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a':
            self._anchor = {'href': attrs.get('href', ''), 'text': ''}
            self._anchor_text_parts = []
        elif tag == 'br' and self._anchor is not None:
            self._anchor_text_parts.append('\n')

    def handle_endtag(self, tag):
        if tag == 'a' and self._anchor is not None:
            self._anchor['text'] = ''.join(self._anchor_text_parts).strip()
            if self._anchor['href']:
                self.links.append(self._anchor)
            self._anchor = None
            self._anchor_text_parts = []

    def handle_data(self, data):
        if self._anchor is not None:
            self._anchor_text_parts.append(data)

    def handle_comment(self, data):
        self.comments.append(data)


def category_for(href, text):
    haystack = f"{text} {href}".lower()
    if any(k in haystack for k in ['google', 'gmail', 'drive', 'maps', 'shelly', 'cloud', 'correo', 'mail', 'calendar', 'contacts', 'messages', 'drive', 'dropbox', 'box']):
        return 'Utilidades'
    if any(k in haystack for k in ['futbol', 'liga', 'tenis', 'atp', 'wta', 'deporte', 'sport', 'balon']):
        return 'Deportes'
    if any(k in haystack for k in ['prensa', 'periodico', 'diario', 'elpais', 'lavanguardia', 'abc', 'mundo', 'elmundo', 'radio', 'tv', 'television']):
        return 'Prensa'
    if any(k in haystack for k in ['youtube', 'netflix', 'spotify', 'humor', 'musica', 'serie', 'pelicula', 'juego']):
        return 'Humor, música y series'
    if any(k in haystack for k in ['ia', 'ai', 'gemini', 'copilot', 'perplexity', 'notebooklm', 'chatgpt']):
        return 'Inteligencia artificial'
    if any(k in haystack for k in ['economia', 'bolsa', 'mercado', 'invers', 'tarifa', 'luz', 'energia', 'epdata', 'expansion']):
        return 'Economía'
    if any(k in haystack for k in ['administr', 'sede', 'gob', 'tramite', 'correos', 'red sara']):
        return 'Administración'
    if any(k in haystack for k in ['virus', 'whatsmyip', 'chrome', 'windows', 'linux', 'software', 'webmaster', 'hosting', 'tech', 'ip', 'router', 'dns']):
        return 'Recursos técnicos'
    if any(k in haystack for k in ['mapa', 'datos', 'estad', 'cultura', 'educ', 'escuela', 'niño', 'children']):
        return 'Datos, mapas y estadísticas'
    return 'PENDIENTES DE CLASIFICAR'


parser = LinkParser()
text = source.read_text(encoding='latin-1', errors='ignore')
parser.feed(text)

links = parser.links
comments = parser.comments

categories = [
    'Utilidades',
    'Deportes',
    'Prensa',
    'Humor, música y series',
    'Inteligencia artificial',
    'Economía',
    'Administración',
    'Recursos técnicos',
    'Datos, mapas y estadísticas',
    'PENDIENTES DE CLASIFICAR',
]

items_by_category = {name: [] for name in categories}
for link in links:
    label = re.sub(r'\s+', ' ', link['text']).strip() or link['href']
    category = category_for(link['href'], label)
    items_by_category[category].append((label, link['href']))

html_parts = []
html_parts.append('<!DOCTYPE html>')
html_parts.append('<html lang="es">')
html_parts.append('<head>')
html_parts.append('  <meta charset="UTF-8">')
html_parts.append('  <meta name="viewport" content="width=device-width, initial-scale=1.0">')
html_parts.append('  <title>Enlaces de interés</title>')
html_parts.append('  <meta name="description" content="Versión reorganizada de enlaces de interés, conservando enlaces y comentarios originales.">')
html_parts.append('  <style>')
html_parts.append('    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f8fafc;color:#0f172a;line-height:1.5;}')
html_parts.append('    main{max-width:1200px;margin:0 auto;padding:24px 20px 48px;}')
html_parts.append('    header{background:linear-gradient(135deg,#4f46e5,#0ea5e9);color:white;padding:28px;border-radius:24px;box-shadow:0 16px 32px rgba(15,23,42,.12);}')
html_parts.append('    a{color:#2563eb;text-decoration:underline;}')
html_parts.append('    .nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}')
html_parts.append('    .nav a{display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.18);color:white;text-decoration:none;font-size:.95rem;}')
html_parts.append('    article{background:white;border:1px solid #e2e8f0;border-radius:20px;padding:22px;margin-top:20px;box-shadow:0 10px 30px rgba(15,23,42,.04);}')
html_parts.append('    h2{margin-top:0;font-size:1.35rem;}')
html_parts.append('    ul{padding-left:1.2rem;}')
html_parts.append('    li{margin-bottom:8px;}')
html_parts.append('    .meta{font-size:.9rem;color:#64748b;word-break:break-all;}')
html_parts.append('    .small{font-size:.9rem;color:#64748b;}')
html_parts.append('    details{margin-top:10px;}')
html_parts.append('    pre{white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;padding:16px;border-radius:12px;overflow:auto;font-size:.9rem;}')
html_parts.append('  </style>')
html_parts.append('</head>')
html_parts.append('<body>')
html_parts.append('<main>')
html_parts.append('  <header>')
html_parts.append('    <div style="margin-bottom:12px;"><a href="enlaces-de-interes-originales.html" style="color:white;text-decoration:underline;">Ver versión original</a></div>')
html_parts.append('    <h1>Enlaces de interés</h1>')
html_parts.append('    <p>Esta versión reorganiza el contenido histórico en categorías y conserva el texto original del archivo fuente en una sección de respaldo.</p>')
html_parts.append('    <div class="nav">')
for category in categories:
    if items_by_category[category]:
        anchor = category.lower().replace(' ', '-')
        html_parts.append(f'      <a href="#{anchor}">{category}</a>')
html_parts.append('    </div>')
html_parts.append('  </header>')

for category in categories:
    if not items_by_category[category]:
        continue
    anchor = category.lower().replace(' ', '-')
    html_parts.append(f'  <article id="{anchor}">')
    html_parts.append(f'    <h2>{category}</h2>')
    html_parts.append('    <ul>')
    for label, href in items_by_category[category]:
        html_parts.append(f'      <li><a href="{escape(href, quote=True)}">{escape(label)}</a><div class="meta">{escape(href)}</div></li>')
    html_parts.append('    </ul>')
    html_parts.append('  </article>')

html_parts.append('  <article>')
html_parts.append('    <h2>Comentarios originales preservados</h2>')
html_parts.append(f'    <p class="small">Se han conservado {len(comments)} comentarios del archivo original.</p>')
for idx, comment in enumerate(comments[:80], 1):
    safe_comment = escape(unescape(comment)).strip()
    if not safe_comment:
        continue
    html_parts.append(f'    <details><summary>Comentario {idx}</summary><pre>{safe_comment}</pre></details>')
if len(comments) > 80:
    html_parts.append(f'    <p class="small">Se muestran los primeros 80 comentarios. El resto quedan preservados en el bloque de texto original.</p>')
html_parts.append('  </article>')

html_parts.append('  <article>')
html_parts.append('    <h2>Contenido original preservado</h2>')
html_parts.append('    <p class="small">Este bloque contiene el texto fuente original del archivo de respaldo, con enlaces y comentarios tal como estaban en la página anterior.</p>')
html_parts.append(f'    <details open><summary>Ver texto completo</summary><pre>{escape(unescape(text))}</pre></details>')
html_parts.append('  </article>')

html_parts.append('</main>')
html_parts.append('</body>')
html_parts.append('</html>')

(dest.write_text('\n'.join(html_parts), encoding='utf-8'))
print(f'Generated {dest} with {len(links)} links and {len(comments)} comments')
