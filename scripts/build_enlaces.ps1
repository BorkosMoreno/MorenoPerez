param(
  [string]$Source = "D:\__md\_Datos\CodigoFuente y Plantillas\GitHub\MorenoPerez.es\MorenoPerez\enlaces-de-interes-originales.html",
  [string]$Dest = "D:\__md\_Datos\CodigoFuente y Plantillas\GitHub\MorenoPerez.es\MorenoPerez\enlaces-de-interes.html"
)

Add-Type -AssemblyName System.Web
$encoding = [System.Text.Encoding]::GetEncoding('iso-8859-1')
$text = [System.IO.File]::ReadAllText($Source, $encoding)

$pattern = '(?is)<h2\b[^>]*>(.*?)</h2>'
$matches = [regex]::Matches($text, $pattern)

$sections = New-Object System.Collections.Generic.List[object]

if ($matches.Count -gt 0) {
  $firstIndex = $matches[0].Index
  $intro = $text.Substring(0, [Math]::Min($firstIndex, $text.Length))
  if ($intro -match '\S') {
    $sections.Add([pscustomobject]@{ Title = 'Introducción'; Content = $intro; Group = 'Utilidades' })
  }

  for ($i = 0; $i -lt $matches.Count; $i++) {
    $m = $matches[$i]
    $start = $m.Index + $m.Length
    $end = if ($i + 1 -lt $matches.Count) { $matches[$i + 1].Index } else { $text.Length }
    $rawTitle = [regex]::Replace($m.Groups[1].Value, '<[^>]+>', '')
    $title = [System.Web.HttpUtility]::HtmlDecode([regex]::Replace($rawTitle, '\s+', ' ').Trim())
    $content = $text.Substring($start, $end - $start)
    if ($title -or $content -match '\S') {
      if (-not $title) { $title = "Sección $($i + 1)" }
      $sections.Add([pscustomobject]@{ Title = $title; Content = $content; Group = $null })
    }
  }
}
else {
  $sections.Add([pscustomobject]@{ Title = 'Contenido'; Content = $text; Group = 'PENDIENTES DE CLASIFICAR' })
}

function Get-Group([string]$title) {
  $t = $title.ToLowerInvariant()
  if ($t -match 'utilidad|google|drive|dropbox|skydrive|syncplicity|box|internet|correo|mail|web 2\.0|ofimatica|herramienta|shelly') { return 'Utilidades' }
  if ($t -match 'deporte|futbol|tenis|sport|balon') { return 'Deportes' }
  if ($t -match 'prensa|periodico|television|tv|radio|televisión') { return 'Prensa' }
  if ($t -match 'humor|musica|pelicula|serie|juegos') { return 'Humor, música y series' }
  if ($t -match 'inteligencia|ia|ai') { return 'Inteligencia artificial' }
  if ($t -match 'economia|bolsa|mercado|eur|euro|energia|luz|electric|pvpc') { return 'Economía' }
  if ($t -match 'administr|sede|gob|gobierno|tramit') { return 'Administración' }
  if ($t -match 'programa|software|webmaster|tecn|ordenador|malware|proxy|virus|ip|windows|chrome|tech|linux|driver|server') { return 'Recursos técnicos' }
  if ($t -match 'educ|niño|niños|escuela') { return 'Educación y niños' }
  if ($t -match 'mapa|estad|dato|cultura|document|geograf') { return 'Datos, mapas y estadísticas' }
  return 'PENDIENTES DE CLASIFICAR'
}

$groupOrder = @(
  'Utilidades',
  'Deportes',
  'Prensa',
  'Humor, música y series',
  'Inteligencia artificial',
  'Economía',
  'Administración',
  'Recursos técnicos',
  'Educación y niños',
  'Datos, mapas y estadísticas',
  'PENDIENTES DE CLASIFICAR'
)

$grouped = @{}
foreach ($g in $groupOrder) { $grouped[$g] = New-Object System.Collections.Generic.List[object] }

foreach ($section in $sections) {
  $g = Get-Group $section.Title
  $grouped[$g].Add($section)
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<!DOCTYPE html>')
[void]$sb.AppendLine('<html lang="es">')
[void]$sb.AppendLine('<head>')
[void]$sb.AppendLine('  <meta charset="UTF-8">')
[void]$sb.AppendLine('  <meta name="viewport" content="width=device-width, initial-scale=1.0">')
[void]$sb.AppendLine('  <title>Enlaces de interés</title>')
[void]$sb.AppendLine('  <meta name="description" content="Versión reorganizada de enlaces de interés, conservando enlaces y comentarios originales.">')
[void]$sb.AppendLine('  <style>')
[void]$sb.AppendLine('    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;line-height:1.5;margin:0;}')
[void]$sb.AppendLine('    main{max-width:1200px;margin:0 auto;padding:24px;}')
[void]$sb.AppendLine('    header{background:linear-gradient(135deg,#4338ca,#0ea5e9);color:white;padding:24px 28px;border-radius:24px;}')
[void]$sb.AppendLine('    a{color:#2563eb;text-decoration:underline;}')
[void]$sb.AppendLine('    .nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}')
[void]$sb.AppendLine('    .nav a{background:#e2e8f0;color:#0f172a;padding:8px 12px;border-radius:999px;text-decoration:none;font-size:0.95rem;}')
[void]$sb.AppendLine('    .group{background:white;border:1px solid #e2e8f0;border-radius:20px;padding:24px;margin-top:20px;box-shadow:0 10px 30px rgba(15,23,42,0.04);}')
[void]$sb.AppendLine('    .group h2{margin-top:0;font-size:1.35rem;}')
[void]$sb.AppendLine('    .block{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-top:14px;}')
[void]$sb.AppendLine('    .block h3{margin:0 0 8px 0;font-size:1rem;color:#1e293b;}')
[void]$sb.AppendLine('    .block div{font-size:0.95rem;color:#334155;overflow-wrap:anywhere;}')
[void]$sb.AppendLine('  </style>')
[void]$sb.AppendLine('</head>')
[void]$sb.AppendLine('<body>')
[void]$sb.AppendLine('<main>')
[void]$sb.AppendLine('  <header>')
[void]$sb.AppendLine('    <div style="margin-bottom:12px;"><a href="enlaces-de-interes-originales.html" style="color:white;text-decoration:underline;">Ver versión original</a></div>')
[void]$sb.AppendLine('    <h1>Enlaces de interés</h1>')
[void]$sb.AppendLine('    <p>Esta versión conserva los enlaces y comentarios originales, pero los agrupa por categorías para que la navegación sea más clara.</p>')
[void]$sb.AppendLine('    <div class="nav">')
foreach ($g in $groupOrder) {
  if ($grouped[$g].Count -gt 0) {
    $slug = [regex]::Replace($g.ToLowerInvariant(), '[^a-z0-9]+', '-')
    [void]$sb.AppendLine("      <a href=\"#$slug\">$g</a>")
  }
}
[void]$sb.AppendLine('    </div>')
[void]$sb.AppendLine('  </header>')

foreach ($g in $groupOrder) {
  if ($grouped[$g].Count -eq 0) { continue }
  $slug = [regex]::Replace($g.ToLowerInvariant(), '[^a-z0-9]+', '-')
  [void]$sb.AppendLine("  <section class=\"group\" id=\"$slug\">")
  [void]$sb.AppendLine("    <h2>$g</h2>")
  foreach ($section in $grouped[$g]) {
    [void]$sb.AppendLine('    <div class="block">')
    if ($section.Title) {
      [void]$sb.AppendLine("      <h3>$([System.Web.HttpUtility]::HtmlEncode($section.Title))</h3>")
    }
    [void]$sb.AppendLine('      <div>')
    [void]$sb.AppendLine($section.Content)
    [void]$sb.AppendLine('      </div>')
    [void]$sb.AppendLine('    </div>')
  }
  [void]$sb.AppendLine('  </section>')
}

[void]$sb.AppendLine('</main>')
[void]$sb.AppendLine('</body>')
[void]$sb.AppendLine('</html>')

[System.IO.File]::WriteAllText($Dest, $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host "Generado: $Dest"
