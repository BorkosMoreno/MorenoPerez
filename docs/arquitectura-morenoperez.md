# Arquitectura del proyecto MorenoPerez

**Sitio:** https://morenoperez.es  
**Repositorio:** https://github.com/BorkosMoreno/MorenoPerez  
**Documento:** `docs/arquitectura-morenoperez.md`  
**Versión:** 1.0  
**Fecha:** 2026-08-14  
**Idioma:** castellano de España

---

## Índice

1. [Propósito del documento y audiencia](#1-propósito-del-documento-y-audiencia)
2. [Visión general del proyecto](#2-visión-general-del-proyecto)
3. [Stack tecnológico y versiones](#3-stack-tecnológico-y-versiones)
4. [Conceptos de Eleventy explicados desde cero](#4-conceptos-de-eleventy-explicados-desde-cero)
5. [Estado actual](#5-estado-actual)
6. [Deuda técnica y defectos detectados](#6-deuda-técnica-y-defectos-detectados)
7. [Estado recomendado (arquitectura objetivo)](#7-estado-recomendado-arquitectura-objetivo)
8. [Runbook: añadir una página nueva](#8-runbook-añadir-una-página-nueva)
9. [Runbook: añadir un proyecto nuevo con subruta](#9-runbook-añadir-un-proyecto-nuevo-con-subruta)
10. [Glosario](#10-glosario)
11. [Historial de cambios del documento](#11-historial-de-cambios-del-documento)

---

## 1. Propósito del documento y audiencia

### 1.1 Para qué sirve

Este documento describe **cómo está construido** el sitio `morenoperez.es`: qué
tecnologías usa, cómo se organizan los ficheros, cómo se convierten en páginas
web y cómo llegan a Internet.

Está dividido en dos partes claramente separadas:

- **Estado actual** (sección 5): lo que hay hoy, funcione bien o mal.
- **Estado recomendado** (sección 7): hacia dónde debería evolucionar.

Entre ambas, la sección 6 recoge **todos los defectos conocidos**, sin
maquillarlos. Un documento de arquitectura que oculta los problemas no sirve
para nada.

### 1.2 A quién va dirigido

| Lector | Qué le interesa |
|---|---|
| **El propietario del sitio** | Secciones 5, 6, 8 y 9. Cómo funciona y cómo añadir cosas. |
| **Un desarrollador humano** | Todo. La sección 4 puede saltársela si conoce Eleventy. |
| **Un asistente de IA** | Todo, especialmente 5 y 6, para no proponer cambios que rompan lo existente. |
| **Un curioso** | Secciones 2, 3 y 4. |

### 1.3 Convenciones tipográficas

- Las rutas de fichero van en `código monoespaciado`.
- Las rutas relativas se dan **desde la raíz del repositorio**, con barra
  inclinada normal: `src/_data/site.json`.
- Los bloques marcados con **⚠ VERIFICAR** contienen información que no ha
  podido comprobarse y que debe contrastarse antes de darla por buena.
- Los bloques marcados con **📌 SUPUESTO** indican inferencias, no hechos
  comprobados.

---

## 2. Visión general del proyecto

### 2.1 Qué es

`MorenoPerez` es un **sitio web estático personal y familiar** que cumple dos
funciones a la vez:

1. **Portal familiar**: presentación de la familia, miembros, árbol genealógico,
   galería de fotos, calendario de eventos y contacto.
2. **Contenedor de proyectos**: cada proyecto personal cuelga de una subruta
   bajo `/proyectos/`, comparte el diseño global y se beneficia del mismo
   despliegue automático.

### 2.2 Qué NO es

- **No es una aplicación web con servidor.** No hay backend, ni base de datos,
  ni sesiones, ni login. Todo son ficheros HTML, CSS, JavaScript e imágenes
  servidos tal cual.
- **No es un CMS.** No hay panel de administración. El contenido se edita
  escribiendo ficheros y haciendo `git push`.
- **No es privado.** El repositorio es público y el sitio también. Cualquier
  cosa que se escriba aquí es visible por todo el mundo.

### 2.3 Relación con el proyecto CloudflareMonitorShelly

Existe un segundo proyecto, en **repositorio y despliegue independientes**, que
sí tiene backend:

```
┌────────────────────────────────────────────────────────────────────┐
│  MorenoPerez  (este proyecto)                                      │
│                                                                    │
│  Repositorio GitHub  →  GitHub Actions  →  GitHub Pages            │
│  Eleventy (estático)                        morenoperez.es         │
│                                                                    │
│                    ┌──────────────────────┐                        │
│                    │ Página del monitor   │                        │
│                    │ (JavaScript en el    │                        │
│                    │  navegador)          │                        │
│                    └──────────┬───────────┘                        │
└───────────────────────────────┼────────────────────────────────────┘
                                │
                                │  fetch() HTTPS
                                │  GET /api/range
                                │  GET /api/latest
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  CloudflareMonitorShelly  (proyecto separado)                      │
│                                                                    │
│  Cloudflare Worker  ←→  Cloudflare D1 (SQLite)                     │
│         │                                                          │
│         │  Cron cada minuto                                        │
│         ▼                                                          │
│  Shelly Cloud API  ←  Shelly EM (dispositivo físico en la casa)    │
└────────────────────────────────────────────────────────────────────┘
```

**Punto clave:** los dos proyectos están acoplados **únicamente** por una URL
HTTPS. MorenoPerez no sabe nada de bases de datos ni de dispositivos; solo hace
peticiones a una API y dibuja el resultado. Esto significa que:

- Se pueden desplegar por separado sin coordinación.
- Si el Worker cae, la web sigue funcionando (la página del monitor muestra un
  aviso de error, pero el resto del sitio es indiferente).
- El backend está documentado en su propio fichero, no aquí.

### 2.4 Principios de diseño adoptados

| Principio | Motivo |
|---|---|
| **Estático siempre que sea posible** | Coste cero, velocidad máxima, superficie de ataque mínima, no hay nada que mantener actualizado por seguridad. |
| **Sin frameworks de CSS** | Un único fichero `estilos.css` con variables. No hay que aprender Tailwind ni Bootstrap ni actualizar dependencias. |
| **JavaScript mínimo** | Solo donde es imprescindible (gráficos interactivos). El resto del sitio funciona con JS desactivado. |
| **Herramientas gratuitas y abiertas** | Eleventy es MIT. GitHub Pages y Actions son gratuitos en repositorios públicos. Cloudflare Workers y D1 tienen plan gratuito suficiente. El único coste es el dominio en Ionos. |
| **Datos separados de la presentación** | El contenido repetitivo vive en JSON; las plantillas solo lo pintan. |
| **Nombres en castellano** | Coherencia con el idioma del sitio y de su autor. |

---

## 3. Stack tecnológico y versiones

### 3.1 Producción (lo que ejecuta GitHub Actions)

| Componente | Versión | Origen |
|---|---|---|
| Sistema operativo | Ubuntu (última) | `runs-on: ubuntu-latest` en `deploy.yml` |
| Node.js | 20 | `node-version: 20` en `deploy.yml` |
| Eleventy | `^3.1.6` | `package.json` → `devDependencies` |
| Motor de plantillas | Nunjucks | Incluido en Eleventy, sin dependencia adicional |
| Alojamiento | GitHub Pages | Modo "GitHub Actions" |
| DNS | Ionos | Registros A hacia GitHub Pages |
| Certificado TLS | Let's Encrypt | Gestionado por GitHub, "Enforce HTTPS" activo |

### 3.2 Desarrollo local

| Componente | Versión | Nota |
|---|---|---|
| Sistema operativo | Windows 11 | |
| Node.js | v24.18.0 | **Distinta de la de CI (20)** |
| npm | 11.16.0 | |
| Git | 2.55.0.windows.3 | |
| Editor | Visual Studio Code (español) | Con GitHub Copilot |

> ⚠ **Divergencia de versiones.** Local usa Node 24, CI usa Node 20. Eleventy 3
> funciona en ambas, pero una diferencia de versión mayor puede producir
> comportamientos distintos que solo se detectan al desplegar. Ver defecto 18.

### 3.3 Librerías cargadas en el navegador

Se cargan **desde CDN**, no están en `node_modules` ni en el repositorio.
Solo las usa la página del monitor eléctrico.

| Librería | Versión | Para qué |
|---|---|---|
| Chart.js | 4.4.1 | Dibujar el gráfico de líneas |
| chartjs-adapter-date-fns | 3.0.0 | Que Chart.js entienda el eje de tiempo |
| Hammer.js | 2.0.8 | Gestos táctiles (pellizco para zoom) |
| chartjs-plugin-zoom | 2.0.1 | Zoom y desplazamiento con rueda del ratón |

Todas se sirven desde `cdn.jsdelivr.net` con versión fijada, lo cual es
correcto: una versión fijada no puede cambiar bajo tus pies.

### 3.4 Dependencias de npm

El proyecto tiene **una sola dependencia**:

```json
"devDependencies": {
  "@11ty/eleventy": "^3.1.6"
}
```

Esto es deliberado y es una virtud: menos dependencias significa menos
actualizaciones de seguridad, menos incompatibilidades y menos tiempo de
instalación en CI.

---

## 4. Conceptos de Eleventy explicados desde cero

Esta sección es didáctica. Si ya conoces Eleventy, salta a la sección 5.

### 4.1 Qué es un generador de sitios estáticos

Un sitio web tradicional con servidor (WordPress, por ejemplo) funciona así:

```
Visitante pide una página
   → El servidor ejecuta PHP
   → PHP consulta la base de datos
   → PHP construye el HTML
   → El servidor envía el HTML
```

Esto ocurre **en cada visita**. Requiere un servidor encendido, una base de
datos, y mantenimiento de seguridad constante.

Un **generador de sitios estáticos** invierte el orden:

```
El desarrollador hace "git push"
   → Un ordenador construye TODAS las páginas de golpe
   → El resultado son ficheros .html sueltos
   → Esos ficheros se suben a un servidor tonto

Visitante pide una página
   → El servidor envía el fichero .html ya hecho
```

El trabajo se hace **una vez, en el momento de publicar**, no en cada visita.

**Eleventy** (abreviado **11ty**) es uno de estos generadores. Está escrito en
JavaScript y su filosofía es no imponer nada: no obliga a usar React, ni un
formato de contenido concreto, ni una estructura de carpetas determinada.

### 4.2 El ciclo de vida de una construcción

Cuando se ejecuta `npm run build` (que internamente llama a `eleventy`), ocurre
esto:

```
1. Eleventy lee eleventy.config.js
      ↓
2. Lee TODOS los ficheros de src/_data/*.json
   y los deja disponibles como variables globales
      ↓
3. Recorre src/ buscando ficheros con extensión .njk, .md o .html
      ↓
4. Para cada fichero encontrado:
      a) Lee su "front matter" (la cabecera entre ---)
      b) Renderiza el contenido con Nunjucks
      c) Mete el resultado dentro del layout indicado
      d) Repite (c) si el layout tiene a su vez otro layout
      e) Calcula la URL de salida (el "permalink")
      f) Escribe el fichero en _site/
      ↓
5. Copia tal cual las carpetas declaradas en addPassthroughCopy
      ↓
6. Termina. La carpeta _site/ contiene el sitio completo.
```

### 4.3 La carpeta `_data` y la cascada de datos

Cualquier fichero `.json` que se ponga en `src/_data/` se convierte
automáticamente en una **variable global** accesible desde cualquier plantilla.
El nombre de la variable es el nombre del fichero sin extensión.

Ejemplo real de este proyecto:

```
src/_data/site.json   →  variable  site
src/_data/redes.json  →  variable  redes
```

Y en cualquier plantilla se puede escribir:

```njk
{{ site.name }}     → Familia Moreno Pérez
{{ redes.email }}   → contacto@morenoperez.es
```

No hay que importar nada ni declarar nada. Es automático.

**Por qué esto importa:** el nombre de la familia aparece en el título de todas
las páginas, en la cabecera, en el pie y en las etiquetas Open Graph. Si
estuviera escrito a mano en cada sitio, cambiarlo requeriría editar decenas de
ficheros. Al estar en `site.json`, se cambia en un solo lugar.

Esto es el principio de **fuente única de verdad** (*single source of truth*).

### 4.4 Front matter

El **front matter** es un bloque de metadatos al principio de un fichero,
delimitado por tres guiones. Usa el formato YAML.

Ejemplo real, de `src/proyectos/notas/notas.html`:

```yaml
---
layout: layouts/proyecto.njk
title: Notas de Trabajo
description: Espacio de notas rápidas, tareas pendientes y recordatorios.
categoria: Documentación
---
```

Cada línea define una variable **solo para esa página**:

| Clave | Significado |
|---|---|
| `layout` | Qué plantilla envolvente usar. Es una clave especial que Eleventy interpreta. |
| `title` | Variable libre. La usa `base.njk` para el `<title>` y `proyecto.njk` para el `<h1>`. |
| `description` | Variable libre. Se usa en la metaetiqueta `description` y en Open Graph. |
| `categoria` | Variable libre. La pinta `proyecto.njk` como etiqueta encima del título. |

`layout` es la única con significado predefinido. Las demás son inventadas por
este proyecto y funcionan porque las plantillas las buscan.

### 4.5 Layouts y partials

Un **layout** es una plantilla que envuelve el contenido de una página. Evita
repetir la estructura HTML en cada fichero.

Los layouts pueden **anidarse**: un layout puede a su vez indicar que él mismo
va dentro de otro. Este proyecto tiene dos niveles:

```
página concreta (notas.html)
        │ layout: layouts/proyecto.njk
        ▼
proyecto.njk  ── añade cabecera de proyecto, título, divisor, botón "volver"
        │ layout: layouts/base.njk
        ▼
base.njk      ── añade <html>, <head>, meta, CSS, header, footer
        │
        ▼
   HTML final
```

En cada nivel, la variable especial `{{ content }}` contiene el resultado del
nivel anterior. El filtro `| safe` le dice a Nunjucks que no escape el HTML
(sin él, se vería `&lt;p&gt;` en lugar de un párrafo).

Un **partial** es un fragmento reutilizable que se inserta con `{% include %}`.
A diferencia de un layout, no envuelve nada: se pega tal cual en el punto donde
se le llama. Este proyecto tiene dos: `header.njk` y `footer.njk`.

### 4.6 Permalinks: cómo se decide la URL final

El **permalink** es la ruta que tendrá el fichero generado dentro de `_site/`,
y por tanto la URL pública.

Por defecto, Eleventy convierte `src/pagina.njk` en `_site/pagina/index.html`,
lo que produce la URL limpia `/pagina/`. **Este proyecto ha cambiado ese
comportamiento** (ver 5.2.2).

Hay tres formas de fijar un permalink, en orden de prioridad:

1. **Front matter de la página** (máxima prioridad)
2. **Dato global** definido en `eleventy.config.js`
3. **Convención por defecto** de Eleventy (mínima prioridad)

Que el front matter gane al dato global es exactamente lo que permite corregir
el problema del sitemap descrito en el defecto 4.

### 4.7 Passthrough copy

Algunos ficheros no deben procesarse: una imagen JPEG no tiene front matter ni
plantillas dentro. Para esos casos existe `addPassthroughCopy`, que copia
ficheros o carpetas enteras **tal cual**, sin tocarlos.

En este proyecto se usa para el CSS, el JavaScript, los favicons, las imágenes,
las fotografías, las descargas, el `CNAME`, el `robots.txt` y el
`site.webmanifest`.

Consecuencia importante: **dentro de un fichero copiado con passthrough no
funcionan las variables de Nunjucks**. Por eso el `robots.txt` lleva el dominio
escrito a mano y no `{{ site.url }}`.

### 4.8 Colecciones

Eleventy agrupa automáticamente las páginas en **colecciones**. La más útil es
`collections.all`, que contiene todas las páginas generadas. Se puede recorrer
con un bucle:

```njk
{% for pagina in collections.all %}
  {{ pagina.url }}
{% endfor %}
```

Es lo que permite generar un sitemap automáticamente, sin mantener una lista a
mano.

---

## 5. Estado actual

Todo lo descrito en esta sección está **verificado** sobre el código fuente,
salvo lo marcado explícitamente como supuesto.

### 5.1 Mapa de directorios comentado

```
MorenoPerez/
│
├── .github/
│   └── workflows/
│       └── deploy.yml          Pipeline de CI/CD. Construye y publica.
│
├── docs/
│   └── arquitectura-morenoperez.md    Este documento.
│
├── src/                        RAÍZ DE ENTRADA de Eleventy.
│   │                           Todo lo que hay aquí se procesa o se copia.
│   │
│   ├── _data/                  CAPA DE DATOS. Ocho ficheros JSON que se
│   │   │                       convierten en variables globales.
│   │   ├── config.json         Ajustes técnicos (zona horaria, formato fecha).
│   │   ├── eventos.json        Calendario familiar.
│   │   ├── miembros.json       Ficha de cada miembro de la familia.
│   │   ├── navegacion.json     Estructura del menú de cabecera.
│   │   ├── proyectos.json      Catálogo de proyectos para la portada.
│   │   ├── redes.json          Datos de contacto y redes sociales.
│   │   ├── site.json           Identidad global del sitio.
│   │   └── ui.json             Textos de interfaz reutilizables.
│   │
│   ├── _includes/              PLANTILLAS. No generan páginas por sí mismas.
│   │   ├── layouts/
│   │   │   ├── base.njk        Esqueleto HTML completo. Todas heredan de él.
│   │   │   ├── home.njk        Envoltorio mínimo de la portada.
│   │   │   └── proyecto.njk    Envoltorio de las páginas de proyecto.
│   │   └── partials/
│   │       ├── header.njk      Cabecera fija con menú desplegable.
│   │       └── footer.njk      Pie con contacto, redes y copyright.
│   │
│   ├── assets/                 RECURSOS ESTÁTICOS. Todos por passthrough.
│   │   ├── css/
│   │   │   └── estilos.css     ÚNICO fichero CSS del sitio (17,9 KB).
│   │   ├── favicons/           8 ficheros de icono, todos generados.
│   │   ├── fuentes/            Vacía. Se usan fuentes del sistema.
│   │   ├── imagenes/
│   │   │   ├── og/             Vacía. DEBERÍA contener default-og.webp.
│   │   │   └── ui/             Vacía.
│   │   └── js/
│   │       └── shelly-monitor.js   Huérfano. Ver defecto 13.
│   │
│   ├── descargas/              Vacía. Para PDF y documentos descargables.
│   │
│   ├── fotografias/            Passthrough. NO se procesan ni optimizan.
│   │   ├── albumes/
│   │   │   └── 2026-londres/   4 JPEG de prueba (~1,5 MB en total).
│   │   ├── miembros/           Vacía. DEBERÍA tener 4 avatares.
│   │   ├── miniaturas/         Vacía.
│   │   └── originales/         Vacía.
│   │
│   ├── proyectos/              CONTENEDOR DE PROYECTOS. Una carpeta por
│   │   │                       proyecto, que se convierte en subruta.
│   │   ├── enlaces-de-interes/
│   │   │   └── enlaces-de-interes-originales.html
│   │   ├── monitores-electricos/
│   │   │   └── shelly-bip30.njk        Única página canónica del monitor.
│   │   ├── notas/
│   │   │   ├── apuntes.html
│   │   │   └── notas.html
│   │   └── programacion/
│   │       └── entorno-de-programacion.html
│   │
│   ├── CNAME                   Dominio personalizado para GitHub Pages.
│   ├── index.njk               Portada del sitio.
│   ├── robots.txt              VACÍO (0 bytes). Ver defecto 6.
│   ├── site.webmanifest        VACÍO (0 bytes). Ver defecto 5.
│   └── sitemap.xml.njk         VACÍO (0 bytes). Ver defecto 4.
│
├── _site/                      SALIDA GENERADA. En .gitignore.
│                               No se edita nunca a mano.
│
├── node_modules/               Dependencias. En .gitignore.
│
├── .editorconfig               Normaliza indentación y codificación.
├── .gitignore                  Qué no versionar.
├── eleventy.config.js          Configuración de Eleventy.
├── LICENSE                     VACÍO. Ver defecto 11.
├── package-lock.json           Versiones exactas. Lo usa "npm ci".
├── package.json                Metadatos y scripts.
└── README.md                   VACÍO. Ver defecto 11.
```

**Nota sobre las carpetas vacías:** contienen un fichero `.gitkeep` de 0 bytes.
Git no versiona carpetas vacías, solo ficheros; `.gitkeep` es un convenio para
forzar que la carpeta exista en el repositorio. Es una práctica correcta.

### 5.2 Configuración: `eleventy.config.js` explicado

Fichero completo, comentado bloque a bloque.

#### 5.2.1 Passthrough copy

```js
eleventyConfig.addPassthroughCopy("src/CNAME");
eleventyConfig.addPassthroughCopy("src/robots.txt");
eleventyConfig.addPassthroughCopy("src/site.webmanifest");
eleventyConfig.addPassthroughCopy("src/assets/css");
eleventyConfig.addPassthroughCopy("src/assets/js");
eleventyConfig.addPassthroughCopy("src/assets/favicons");
eleventyConfig.addPassthroughCopy("src/assets/imagenes");
eleventyConfig.addPassthroughCopy("src/descargas");
eleventyConfig.addPassthroughCopy("src/fotografias");
```

Nueve reglas de copia directa. Observaciones:

- **`src/assets/fuentes` NO está en la lista.** La carpeta existe pero está
  vacía, así que hoy no importa. Si algún día se añade una tipografía, no se
  publicará. Es una trampa latente.
- **`src/fotografias` se copia sin optimizar.** Los 4 JPEG actuales suman
  ~1,5 MB. Con un álbum de 200 fotos, cada despliegue subiría cientos de
  megabytes. Ver sección 7.7.

#### 5.2.2 El permalink global

```js
eleventyConfig.addGlobalData("permalink", () => {
  return "{{ page.filePathStem }}.html";
});
```

**Esta es la decisión de configuración más importante del proyecto.** Merece
explicación detallada.

`addGlobalData` define un dato disponible en todas las plantillas. Al llamarlo
`permalink`, se está fijando la ruta de salida de **todas** las páginas.

La función devuelve una cadena que contiene sintaxis de Nunjucks. Eleventy la
renderiza después, sustituyendo `page.filePathStem` por la ruta del fichero sin
extensión.

Ejemplo paso a paso:

| Paso | Valor |
|---|---|
| Fichero de entrada | `src/proyectos/notas/notas.html` |
| `page.filePathStem` | `/proyectos/notas/notas` |
| Permalink renderizado | `/proyectos/notas/notas.html` |
| Fichero de salida | `_site/proyectos/notas/notas.html` |
| URL pública | `https://morenoperez.es/proyectos/notas/notas.html` |

**Qué habría pasado sin esta regla:** Eleventy habría generado
`_site/proyectos/notas/notas/index.html`, dando la URL limpia
`/proyectos/notas/notas/`.

**Por qué se eligió `.html` explícito:**

| Ventaja | Inconveniente |
|---|---|
| El fichero en `_site/` se corresponde 1:1 con el fichero en `src/`. Fácil de razonar. | Es la opción minoritaria hoy. Las URL limpias son el estándar de facto. |
| No hay ambigüedad entre `/pagina` y `/pagina/`. | Expone el detalle de implementación (que es HTML) en la URL. |
| Las rutas relativas funcionan de forma predecible. | Cambiar de criterio más adelante rompe todos los enlaces existentes. |

Es una decisión legítima y consciente. **Pero tiene un efecto secundario grave:
se aplica también a ficheros que no son HTML.** Cualquier plantilla con otra
extensión sale mal:

| Fichero | Salida deseada | Salida real | Correcto |
|---|---|---|---|
| `index.njk` | `/index.html` | `/index.html` | ✅ |
| `notas.html` | `/notas.html` | `/notas.html` | ✅ |
| `sitemap.xml.njk` | `/sitemap.xml` | `/sitemap.xml.html` | ❌ |
| `feed.rss.njk` (futuro) | `/feed.rss` | `/feed.rss.html` | ❌ |

La solución no es quitar la regla global (rompería todas las URLs), sino
**declarar un `permalink` en el front matter** de los ficheros no-HTML. El front
matter tiene prioridad sobre el dato global. Ver sección 7.2.

#### 5.2.3 Shortcode `year`

```js
eleventyConfig.addShortcode("year", () => {
  return new Date().getFullYear().toString();
});
```

Un **shortcode** es una función invocable desde las plantillas. Se usa en el pie:

```njk
<p>&copy; {% year %} {{ site.name }}. {{ ui.copyright }}</p>
```

> ⚠ **Matiz importante.** El año se calcula **en el momento de la construcción**,
> no en el momento de la visita. Si el sitio no se despliega durante 2027, el pie
> seguirá diciendo 2026. Es inherente a un sitio estático y no es un fallo, pero
> conviene saberlo.

#### 5.2.4 Objeto de configuración devuelto

```js
return {
  dir: {
    input: "src",
    output: "_site",
    includes: "_includes",
    data: "_data"
  },
  templateFormats: ["njk", "md", "html"],
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk"
};
```

| Clave | Valor | Significado |
|---|---|---|
| `input` | `src` | Dónde buscar el contenido. |
| `output` | `_site` | Dónde escribir el resultado. |
| `includes` | `_includes` | Dónde buscar layouts y partials. **Ruta relativa a `input`**, así que es `src/_includes`. |
| `data` | `_data` | Dónde buscar los JSON. También relativa a `input`. |
| `templateFormats` | `njk`, `md`, `html` | Qué extensiones procesar. Lo demás se ignora. |
| `markdownTemplateEngine` | `njk` | Los `.md` también pueden usar sintaxis Nunjucks. |
| `htmlTemplateEngine` | `njk` | Los `.html` también. **Esto es lo que permite que las páginas `.html` tengan front matter y layout.** |

La última clave explica una cosa que de otro modo sería confusa: por qué
`notas.html` es un fichero `.html` pero se comporta como una plantilla.

### 5.3 Capa de datos: los ocho ficheros JSON

#### `site.json` — Identidad global

```json
{
  "name": "Familia Moreno Pérez",
  "shortName": "MorenoPerez",
  "url": "https://morenoperez.es",
  "language": "es",
  "author": "BorkosMoreno",
  "startYear": "1996",
  "description": "Sitio web oficial de la Familia Moreno Pérez",
  "repoUrl": "https://github.com/BorkosMoreno/MorenoPerez",
  "defaultOgImage": "/assets/imagenes/og/default-og.webp",
  "keywords": ["Moreno Pérez", "Familia", "Proyectos", ...]
}
```

| Campo | Dónde se usa |
|---|---|
| `name` | `<title>`, `og:title`, `footer.njk` |
| `shortName` | Logotipo de la cabecera |
| `url` | Enlace canónico, Open Graph, sitemap |
| `language` | Atributo `lang` del `<html>` |
| `startYear` | Portada ("desde 1996") y pie |
| `description` | Metaetiqueta por defecto cuando la página no define la suya |
| `defaultOgImage` | Imagen al compartir en redes. **El fichero no existe** (defecto 7) |
| `author`, `repoUrl`, `keywords` | **No se usan en ninguna plantilla.** Informativos |

#### `navegacion.json` — Menú de cabecera

Array de objetos. Cada uno tiene `texto` y `url`. Si además tiene `submenu`
(array de lo mismo), `header.njk` lo pinta como desplegable.

Estructura actual: Inicio · Miembros · Proyectos (desplegable) · Galería ·
Contacto.

> **Duplicación conocida.** Las URLs de los proyectos están aquí **y** en
> `proyectos.json`. Cualquier cambio hay que hacerlo dos veces. Ver defecto 15 y
> sección 7.3.

#### `proyectos.json` — Catálogo de proyectos

Array de objetos con: `id`, `nombre`, `descripcion`, `url`, `externo`,
`categoria`, y (tras la corrección de agosto de 2026) `enMenu` y `orden`.

Lo recorre `index.njk` para pintar las tarjetas de la sección "Nuestros
Proyectos".

| Campo | Uso |
|---|---|
| `id` | Identificador único. **No se usa aún** en ninguna plantilla |
| `nombre` | Título de la tarjeta |
| `descripcion` | Texto de la tarjeta |
| `url` | Destino del enlace |
| `externo` | Booleano. **No se usa aún.** Debería controlar `target="_blank"` |
| `categoria` | Etiqueta superior de la tarjeta |
| `enMenu` | Preparado para generar el submenú desde aquí (sección 7.3) |
| `orden` | Numerado de 10 en 10 para poder intercalar sin renumerar |

#### `miembros.json` — Fichas familiares

Cuatro objetos (Jose Carlos, Cristina, Gonzalo, Diego). Cada uno con `id`,
`nombre`, `rol`, `nacimiento`, `descripcion`, `foto`, `contacto`, `redes` y
`arbol` (objeto anidado con `padre` y `madre`).

> ⚠ **Las cuatro fotos referenciadas no existen.** `fotografias/miembros/` solo
> contiene `.gitkeep`. La portada muestra cuatro imágenes rotas. Defecto 9.

> ⚠ **Datos personales en repositorio público.** El fichero contiene nombres
> reales, años de nacimiento y direcciones de correo de cuatro personas, dos de
> ellas descritas como estudiantes. Está publicado en Internet y es rastreable
> por buscadores. Es una decisión del propietario, pero conviene que sea
> consciente y deliberada, no accidental.

#### `redes.json` — Contacto

```json
{
  "email": "contacto@morenoperez.es",
  "telefono": "+34 600 000 000",
  "direccion": "Madrid, España",
  "social": [ { "nombre": "GitHub", "url": "...", "icono": "github" } ]
}
```

El teléfono es un valor de relleno evidente y **no se pinta** en ninguna
plantilla. El campo `icono` tampoco se usa (no hay sistema de iconos).

#### `eventos.json` — Calendario

Dos entradas: aniversario de bodas (11-06) y Nochebuena (12-24). Formato de
fecha `MM-DD`, sin año, porque son recurrentes anuales.

El campo `tipo` no se usa en ninguna plantilla.

#### `ui.json` — Textos de interfaz

Seis cadenas reutilizables: `menuTitle`, `searchPlaceholder`, `backToTop`,
`viewProject`, `contactTitle`, `copyright`.

Solo se usan tres: `menuTitle` (en `aria-label` del `<nav>`), `viewProject` (en
las tarjetas) y `copyright` (en el pie). Las otras tres están sin usar.

Este fichero es el germen de una futura internacionalización: si algún día el
sitio fuera bilingüe, bastaría con duplicarlo.

#### `config.json` — Ajustes técnicos

```json
{
  "timezone": "Europe/Madrid",
  "dateFormat": "DD/MM/YYYY",
  "showDrafts": false,
  "maxHomeProjects": 5
}
```

> **Ninguno de los cuatro valores se usa en el código actual.** `maxHomeProjects`
> sugiere una intención de limitar las tarjetas de la portada que nunca se
> implementó: `index.njk` recorre `proyectos` sin límite.

### 5.4 Cadena de plantillas

#### `base.njk` — El esqueleto

Contiene el `<!DOCTYPE html>` y todo el `<head>`. Responsabilidades:

1. **Título dinámico**  
   `{% if title %}{{ title }} | {% endif %}{{ site.name }}`  
   La portada, que no define `title` en su front matter... en realidad sí lo
   define (`Portal Familiar`), así que siempre hay título.

2. **Descripción con reserva**  
   Usa `description` de la página si existe; si no, la de `site.json`.

3. **Enlace canónico**  
   `<link rel="canonical" href="{{ site.url }}{{ page.url }}">`  
   Indica a los buscadores cuál es la URL oficial de la página.

4. **Favicons**: cuatro enlaces (ICO, SVG, apple-touch-icon, manifest).

5. **Open Graph y Twitter Cards**: cómo se ve el enlace al compartirlo.

6. **Un único `<link>` de CSS**: `/assets/css/estilos.css`.

7. **Estructura del `<body>`**: header (partial), `<main>` con el contenido,
   footer (partial).

#### `home.njk` — Envoltorio de portada

Cinco líneas. Solo añade un `<div class="home-portal">`. Existe para que la
portada pueda diferenciarse en el futuro sin tocar `base.njk`.

#### `proyecto.njk` — Envoltorio de proyectos

Añade la estructura común a todas las páginas de proyecto:

- Etiqueta de categoría
- Título `<h1>`
- Sinopsis (si existe `description`)
- Línea divisoria
- El contenido de la página
- Botón "← Volver a Proyectos" que apunta a `/index.html#proyectos`

**Este layout es la razón por la que añadir una página de proyecto es tan
barato:** basta con un front matter de cuatro líneas y el contenido; toda la
estructura visual viene dada.

#### `header.njk` — Cabecera

Cabecera fija (`position: fixed`) con logotipo a la izquierda y menú a la
derecha.

**Detalle técnico destacable:** el desplegable de "Proyectos" usa los elementos
HTML nativos `<details>` y `<summary>`, no JavaScript. Ventajas: funciona sin JS,
es accesible por teclado de serie, y el navegador gestiona el estado
abierto/cerrado. Es una decisión de diseño acertada.

#### `footer.njk` — Pie

Tres columnas (identidad, contacto, redes) más una línea inferior con el
copyright y el shortcode `{% year %}`.

### 5.5 Sistema de estilos

Un único fichero: `src/assets/css/estilos.css` (17.931 bytes).

#### Variables CSS

Todo el sistema visual se define en el bloque `:root`:

```css
:root {
  --primario: #1e3a8a;        /* Azul marino profundo */
  --primario-claro: #3b82f6;  /* Azul medio */
  --secundario: #0f172a;      /* Pizarra oscuro, para textos */
  --gris-claro: #f8fafc;      /* Fondos alternos */
  --gris-borde: #e2e8f0;      /* Bordes */
  --blanco: #ffffff;
  --accent: #b45309;          /* Ámbar: foco de accesibilidad */

  --fuente-base: system-ui, -apple-system, BlinkMacSystemFont,
                 "Segoe UI", Roboto, sans-serif;
  --alto-header: 75px;
}
```

**Por qué esto es correcto:** una variable CSS se puede cambiar en un solo sitio
y afecta a todo el documento. Cambiar el azul corporativo es editar una línea.

**Elección de fuentes:** `system-ui` usa la tipografía nativa del sistema
operativo del visitante. No se descarga ningún fichero de fuente. Esto ahorra
entre 50 y 200 KB por visita y elimina el parpadeo de texto sin estilar (FOUT).
Decisión acertada.

**El color de acento (`--accent`) se usa para `outline` en `:focus-visible`.**
Esto es accesibilidad real: quien navega con teclado ve claramente dónde está.

#### Familias de clases

| Prefijo | Ámbito | Dónde está definido |
|---|---|---|
| `.container`, `.tarjeta`, `.grid-tarjetas` | Genéricas, reutilizables | `estilos.css` |
| `.sitio-header`, `.menu-*`, `.dropdown-*` | Cabecera | `estilos.css` |
| `.sitio-footer`, `.footer-*` | Pie | `estilos.css` |
| `.hero-*` | Sección de bienvenida | `estilos.css` |
| `.miembro-*`, `.arbol-*` | Sección de familia | `estilos.css` |
| `.galeria-*` | Galería | `estilos.css` |
| `.proyecto-*` | Layout de proyecto | `estilos.css` |
| `.mon-*` | Monitor eléctrico (**sin usar**) | `estilos.css` |
| `.p1-*` | Monitor eléctrico (**en uso**) | Inline en `shelly-bip30.njk` |

> **Anomalía.** Hay dos sistemas de clases para el monitor. Las `.mon-*` están en
> el CSS global pero **ninguna página las usa**; van emparejadas con el
> `shelly-monitor.js` huérfano. Las `.p1-*` sí se usan, pero están definidas
> dentro de la página, no en el CSS global.

#### Diseño adaptativo

Un único punto de ruptura: `@media (max-width: 768px)`.

En móvil: la cabecera deja de ser fija y se apila, la tipografía baja de 18px a
16px, el árbol genealógico pasa a columna, el gráfico reduce su altura.

**Cambio de agosto de 2026 documentado en el propio CSS:** se eliminó el
`max-width: 1200px` de `.container`, `.header-container` y `.footer-container`.
El sitio ahora ocupa el 100% del ancho. El código antiguo está comentado con la
fecha y el motivo. Es una buena práctica de documentación en línea.

### 5.6 Inventario de páginas publicadas

| Fichero fuente | URL pública | Layout | Estado |
|---|---|---|---|
| `src/index.njk` | `/index.html` | `home.njk` | Funcional, con imágenes rotas |
| `src/proyectos/monitores-electricos/shelly-bip30.njk` | `/proyectos/monitores-electricos/shelly-bip30.html` | `proyecto.njk` | Funcional |
| `src/proyectos/enlaces-de-interes/enlaces-de-interes-originales.html` | `/proyectos/enlaces-de-interes/enlaces-de-interes-originales.html` | `proyecto.njk` | 📌 Supuesto |
| `src/proyectos/notas/apuntes.html` | `/proyectos/notas/apuntes.html` | `proyecto.njk` | 📌 Supuesto |
| `src/proyectos/notas/notas.html` | `/proyectos/notas/notas.html` | `proyecto.njk` | Verificado |
| `src/proyectos/programacion/entorno-de-programacion.html` | `/proyectos/programacion/entorno-de-programacion.html` | `proyecto.njk` | Verificado |
| `src/sitemap.xml.njk` | `/sitemap.xml.html` ❌ | ninguno | Vacío y con URL errónea |

**Seis páginas HTML.** Nada más.

> 📌 **SUPUESTO.** No se ha inspeccionado el contenido de `apuntes.html` ni de
> `enlaces-de-interes-originales.html`. Se asume que siguen el mismo patrón que
> `notas.html` (front matter con `layout: layouts/proyecto.njk`) porque su tamaño
> compilado en `_site/` es coherente con ello.

### 5.7 Integración con CloudflareMonitorShelly

Solo afecta a una página: `shelly-bip30.njk`.

#### Contrato de la API

| Endpoint | Método | Devuelve |
|---|---|---|
| `/api/range?start=…&end=…&bucket=auto` | GET | Serie temporal de ambos canales en una sola respuesta |
| `/api/latest` | GET | Última lectura registrada |

La página **solo usa `/api/range`**, porque su respuesta ya incluye un objeto
`latest` con la última lectura. Una petición en lugar de dos.

#### Forma de la respuesta consumida

```json
{
  "success": true,
  "data": [
    { "t": 1723040000000, "aeroW": 10.5, "aeroWh": 1614312.1,
      "casaW": 395.0, "casaWh": 3159727.9 }
  ],
  "latest": {
    "timestamp": 1723040060000,
    "aerotermiaW": 12.0,
    "casaTotalW": 402.0
  }
}
```

| Campo | Unidad | Significado |
|---|---|---|
| `t` | ms desde época Unix | Instante de la lectura |
| `aeroW` | vatios | Potencia instantánea de la aerotermia |
| `aeroWh` | vatios-hora | Contador acumulado de la aerotermia |
| `casaW` | vatios | Potencia instantánea total de la vivienda |
| `casaWh` | vatios-hora | Contador acumulado total |

#### Cálculos hechos en el navegador

**Potencia del "resto de la vivienda":**
```
resto = casaW - aeroW
```
Se muestra aunque salga negativo. Un valor negativo indicaría un error de
calibración de las pinzas o inversión de sentido, y ocultarlo enmascararía el
problema. Decisión correcta.

**Energía consumida en el periodo:**
```
kWh = (último contador Wh − primer contador Wh) / 1000
```
Si el resultado es negativo, la página lo marca en rojo y avisa de un posible
reinicio del contador del Shelly. También correcto.

#### Detección de huecos en los datos

Si entre dos lecturas consecutivas pasan más de 2 minutos (el Cron es de 1
minuto), la página **inyecta un punto nulo** en la serie. Combinado con
`spanGaps: false` de Chart.js, esto produce una **interrupción visible** de la
línea en lugar de un segmento recto que uniría dos puntos lejanos.

Es una decisión de honestidad visual: una línea continua sobre un hueco de datos
es una mentira gráfica.

#### Semáforo de estado del dispositivo

| Antigüedad de la última lectura | Color | Mensaje |
|---|---|---|
| ≤ 3 minutos | Verde | "Shelly operando con normalidad" |
| 3 a 15 minutos | Amarillo | "Sin datos nuevos desde hace N min" |
| > 15 minutos | Rojo | "El Shelly lleva N minutos sin enviar datos" |

#### Estrategia de refresco

- **Carga completa** al entrar y al cambiar de periodo.
- **Carga incremental** cada 60 segundos: pide solo desde la última lectura
  conocida. Evita retransmitir 1440 puntos cada minuto.
- **Ventana deslizante**: al añadir puntos nuevos, purga los de más de 24 horas.
- **El zoom del usuario se conserva** durante el refresco automático, pero se
  restablece al cambiar de periodo manualmente. Comportamiento correcto: nunca
  interrumpe al usuario, pero tampoco lo deja con un zoom sin sentido.

#### Manejo del tiempo

Este es el punto más delicado de la página.

Los datos llegan en **milisegundos UTC**. Chart.js con el adaptador `date-fns`
dibuja siempre en la **hora local del navegador**. Para poder mostrar el eje en
UTC, la página aplica un desplazamiento visual:

```js
function aplicarOffsetZonaHoraria(rawMs) {
  if (!estado.modoUTC) return rawMs;
  return rawMs + new Date(rawMs).getTimezoneOffset() * 60000;
}
```

El valor real se guarda aparte, en la propiedad `tReal` de cada punto, para que
los *tooltips* muestren la hora correcta.

> ⚠ **Fragilidad conocida.** Este truco es correcto en la práctica, pero puede
> producir un desajuste de una hora en el instante exacto del cambio horario
> (último domingo de marzo y de octubre en España), porque el desplazamiento se
> calcula punto a punto. En la práctica afecta a un par de puntos al año.

**Selector de zona horaria:** la página arranca en hora local y muestra la zona
IANA detectada del navegador (por ejemplo, `Europe/Madrid`), con un conmutador
a UTC. Los cálculos de "día" siempre se hacen en UTC.

#### Exportación a CSV

Genera un CSV con separador `;`, coma decimal y BOM UTF-8. Los tres detalles son
correctos para que Excel en español lo abra sin pasar por el asistente de
importación.

### 5.8 Flujo de build y despliegue

```
┌─────────────────────────────────────────────────────────────┐
│  1. EDICIÓN LOCAL                                           │
│     VS Code, carpeta                                        │
│     D:\__md\_Datos\CodigoFuenteYPlantillas\GitHub\          │
│                                                MorenoPerez  │
│                                                             │
│     npm start   →  servidor local en localhost:8080         │
│                    con recarga automática                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ git add / commit / push
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. REPOSITORIO GITHUB (rama main)                          │
│     github.com/BorkosMoreno/MorenoPerez                     │
│     Público. NO contiene _site/ (está en .gitignore)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ dispara el workflow
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  3. GITHUB ACTIONS  (.github/workflows/deploy.yml)          │
│     Máquina virtual Ubuntu efímera                          │
│                                                             │
│     a) actions/checkout@v4      descarga el código          │
│     b) actions/setup-node@v4    Node 20 + caché de npm      │
│     c) npm ci                   instala EXACTAMENTE lo que  │
│                                 dice package-lock.json      │
│     d) npm run build            ejecuta eleventy → _site/   │
│     e) upload-pages-artifact@v3 empaqueta _site/            │
│     f) deploy-pages@v4          publica                     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  4. GITHUB PAGES                                            │
│     Sirve el contenido. Lee src/CNAME → morenoperez.es      │
│     Certificado TLS de Let's Encrypt, renovación automática │
│     "Enforce HTTPS" activado                                │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  5. DNS EN IONOS                                            │
│     morenoperez.es      A  185.199.108-111.153              │
│     www.morenoperez.es  A  185.199.108-111.153              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
                    https://morenoperez.es
```

#### Análisis del workflow

```yaml
permissions:
  contents: read      # solo lectura del código
  pages: write        # escritura en Pages
  id-token: write     # token OIDC de corta duración
```

**Permisos mínimos.** Correcto. Si el workflow se viera comprometido, no podría
modificar el repositorio.

```yaml
concurrency:
  group: "pages"
  cancel-in-progress: true
```

**Evita despliegues simultáneos.** Si se hacen dos `push` seguidos, el primer
despliegue se cancela. Correcto: impide que una construcción vieja pise a una
nueva.

```yaml
- run: npm ci
```

**`npm ci` en lugar de `npm install`.** Diferencia crítica:

| | `npm install` | `npm ci` |
|---|---|---|
| Respeta `package-lock.json` | Puede modificarlo | Lo obedece literalmente |
| Reproducibilidad | No garantizada | Garantizada |
| Velocidad | Más lenta | Más rápida |
| Uso recomendado | Desarrollo | CI/CD |

Elección correcta.

#### Valoración global

El workflow es **correcto y sigue las buenas prácticas actuales de GitHub Pages**.
Usa el método de despliegue moderno (artefacto + `deploy-pages`) en lugar del
antiguo de empujar a una rama `gh-pages`. Todas las acciones están en versiones
mayores actuales (`@v4`, `@v3`).

Única observación: no hay ningún paso de verificación entre la construcción y la
publicación. Si Eleventy genera un sitio con enlaces rotos, se publica igual. Ver
sección 7.8.

#### Configuración de DNS

Ambos registros son de tipo A hacia las cuatro IP de GitHub Pages
(`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`).

Lo habitual para el subdominio `www` sería un CNAME hacia
`borkosmoreno.github.io`, pero usar registros A también funciona. La única
desventaja teórica es que si GitHub cambiara sus IP, habría que actualizarlas a
mano; con CNAME sería transparente. Es un riesgo remoto y aceptable.

#### El fichero CNAME

`src/CNAME` contiene una sola línea: `morenoperez.es` (14 bytes, sin `www`).

Esto define el **dominio canónico**. GitHub Pages redirige automáticamente
`www.morenoperez.es` → `morenoperez.es`.

**Es imprescindible que este fichero esté en `addPassthroughCopy`.** Si no
llegara a `_site/`, GitHub Pages perdería la configuración de dominio
personalizado en el siguiente despliegue y el sitio dejaría de responder en
`morenoperez.es`. Está correctamente configurado.

#### Script de despliegue manual

Existe un `.bat` que automatiza `git status` → `add` → `status` → `commit` →
`push`, con una pausa entre cada paso y el mensaje de commit sellado con fecha y
hora.

Las pausas son deliberadas: obligan a leer la salida de `git status` antes de
confirmar. Para un flujo de trabajo individual, es una elección razonable.

---

## 6. Deuda técnica y defectos detectados

Inventario completo y honesto. Todos los puntos han sido verificados sobre el
código fuente en agosto de 2026, salvo indicación contraria.

### 6.1 Tabla resumen

| # | Defecto | Fichero afectado | Gravedad | Estado |
|---|---|---|---|---|
| 1 | Borradores dentro del árbol de compilación | `src/proyectos/monitores-electricos/Borradores-y-antiguos/` | Alta | ✅ Resuelto |
| 2 | Siete enlaces rotos en el menú | `src/_data/navegacion.json` | Alta | ✅ Resuelto |
| 3 | Seis proyectos rotos en la portada | `src/_data/proyectos.json` | Alta | ✅ Resuelto |
| 4 | El sitemap se publica como `.html` y está vacío | `src/sitemap.xml.njk` | Media | ⬜ Pendiente |
| 5 | Manifest vacío → error en consola en todas las páginas | `src/site.webmanifest` | Media | ⬜ Pendiente |
| 6 | `robots.txt` vacío | `src/robots.txt` | Baja | ⬜ Pendiente |
| 7 | Imagen Open Graph inexistente | `src/_data/site.json` | Media | ⬜ Pendiente |
| 8 | Tres fotos de galería inexistentes | `src/index.njk` | Media | ⬜ Pendiente |
| 9 | Cuatro avatares de miembros inexistentes | `src/_data/miembros.json` | Media | ⬜ Pendiente |
| 10 | Carácter corrompido (mojibake) en la portada | `src/index.njk` | Baja | ⬜ Pendiente |
| 11 | `LICENSE` y `README.md` vacíos | raíz | Baja | ⬜ Pendiente |
| 12 | 700 líneas de JavaScript en línea | `shelly-bip30.njk` | Media | ⬜ Pendiente |
| 13 | `shelly-monitor.js` huérfano | `src/assets/js/` | Baja | 🔵 Conservado a propósito |
| 14 | URL del Worker escrita a fuego | `shelly-bip30.njk` | Baja | ⬜ Pendiente |
| 15 | Navegación duplicada en dos JSON | `navegacion.json` + `proyectos.json` | Baja | 🟡 Mitigado |
| 16 | Endpoints del Worker sin autenticación | (proyecto Cloudflare) | Media | ⬜ Su documento |
| 17 | Canónico apunta a `/index.html`, no a `/` | `base.njk` | Baja | ⬜ Pendiente |
| 18 | Node 24 en local, Node 20 en CI | `deploy.yml` | Baja | ⬜ Pendiente |
| 19 | Fotografías sin optimizar por passthrough | `eleventy.config.js` | Media | ⬜ Pendiente |
| 20 | `src/assets/fuentes` no está en passthrough | `eleventy.config.js` | Baja | ⬜ Pendiente |
| 21 | Reset de zoom incoherente en un botón | `shelly-bip30.njk` | Muy baja | ⬜ Pendiente |
| 22 | Campos de datos declarados y nunca usados | varios JSON | Muy baja | ⬜ Pendiente |
| 23 | Nombre del fichero incoherente con el modelo real | `shelly-bip30.njk` | Baja | ⬜ Pendiente |
| 24 | Datos personales de menores en repositorio público | `miembros.json` | A valorar | ⬜ Decisión |

**Leyenda:** ✅ resuelto · ⬜ pendiente · 🟡 mitigado parcialmente · 🔵 decisión consciente

### 6.2 Detalle de los defectos pendientes relevantes

#### Defecto 4 — El sitemap

`src/sitemap.xml.njk` tiene 0 bytes y, además, el permalink global le añade
`.html`, produciendo `/sitemap.xml.html`.

**Causa raíz:** ver sección 5.2.2. No es que falte un permalink; es que el dato
global lo impone.

**Consecuencia:** los buscadores no pueden descubrir la estructura del sitio de
forma eficiente.

**Solución:** ver sección 7.2.

#### Defecto 5 — Manifest vacío

`base.njk` incluye `<link rel="manifest" href="/site.webmanifest">`, pero el
fichero tiene 0 bytes. Un fichero vacío no es JSON válido.

**Consecuencia:** error en la consola del navegador **en todas las páginas del
sitio**. No rompe nada visible, pero contamina el diagnóstico y penaliza en
auditorías tipo Lighthouse.

#### Defectos 7, 8 y 9 — Recursos inexistentes

| Recurso | Referenciado en | Efecto |
|---|---|---|
| `/assets/imagenes/og/default-og.webp` | `site.json` → `base.njk` | Al compartir el enlace en WhatsApp o redes, no aparece imagen |
| `/fotografias/albumes/vacaciones-2026.webp` | `index.njk` | Imagen rota en la galería |
| `/fotografias/albumes/navidad-2026.webp` | `index.njk` | Imagen rota en la galería |
| `/fotografias/albumes/cumpleanos-2026.webp` | `index.njk` | Imagen rota en la galería |
| `/fotografias/miembros/jose-carlos.webp` | `miembros.json` | Avatar roto |
| `/fotografias/miembros/cristina.webp` | `miembros.json` | Avatar roto |
| `/fotografias/miembros/gonzalo.webp` | `miembros.json` | Avatar roto |
| `/fotografias/miembros/diego.webp` | `miembros.json` | Avatar roto |

**Ocho recursos rotos**, todos visibles en la portada. Es el defecto con mayor
impacto en la percepción de calidad del sitio.

Para la imagen Open Graph, el tamaño estándar es **1200 × 630 píxeles**.

#### Defecto 10 — Mojibake

En `src/index.njk`, dentro de la tarjeta de proyecto:

```njk
{{ ui.viewProject }} ?
```

Ese `?` final es casi con certeza una flecha `→` corrompida al guardar el
fichero en una codificación distinta de UTF-8.

**Verificación:** abrir el fichero en VS Code y mirar la barra de estado inferior
derecha. Debe indicar `UTF-8`. Si dice otra cosa, usar "Reabrir con codificación"
y luego "Guardar con codificación UTF-8".

#### Defecto 12 — JavaScript en línea

`shelly-bip30.njk` pesa 49.196 bytes, de los cuales aproximadamente el 60% es
JavaScript embebido entre `{% raw %}` y `{% endraw %}`.

**Por qué hace falta `{% raw %}`:** Nunjucks interpreta `{{` y `{%` como
sintaxis propia. Sin el bloque `raw`, cualquier plantilla literal de JavaScript
o cualquier `{{` accidental haría fallar la compilación.

**Inconvenientes de tenerlo en línea:**

| Aspecto | Efecto |
|---|---|
| Caché | El navegador no puede cachear el JS por separado. Se descarga entero en cada visita a la página. |
| Depuración | Los errores de consola apuntan al HTML, no a un fichero `.js` con números de línea limpios. |
| Reutilización | Si mañana hay una segunda página de monitor, hay que duplicar todo. |
| Coherencia | Contradice el propio principio declarado del proyecto ("JavaScript mínimo en `/assets/js/`"). |

#### Defecto 13 — `shelly-monitor.js` (decisión consciente)

`src/assets/js/shelly-monitor.js` (28.696 bytes) **no lo carga ninguna página**.
Usa identificadores del DOM `mon-*` y `btn-utc`, mientras que la única página del
monitor usa `p1-*`.

**Decisión tomada:** se conserva deliberadamente como base para el refactor
descrito en la sección 7.4. Tiene mejor arquitectura que el código en línea
(usa `async/await` en lugar de cadenas de promesas, tiene funciones más pequeñas
y mejor separadas, y su bloque de comentarios explica las decisiones de diseño).

**Coste de conservarlo:** 28,7 KB se copian a producción en cada despliegue sin
que nadie los descargue. Coste real: despreciable.

**Condición:** este fichero **debe fusionarse o eliminarse** cuando se aborde el
refactor. Si sigue aquí sin uso dentro de seis meses, ya no es "base del
refactor", es código muerto.

#### Defecto 14 — URL del Worker escrita a fuego

```js
var WORKER_BASE_URL = 'https://worker-monitor-shelly-aerotermia.borkosmoreno.workers.dev';
```

Aparece literalmente en `shelly-bip30.njk` y también en `shelly-monitor.js`.
Cambiar el nombre del Worker obliga a editar dos ficheros.

Debería estar en la capa de datos. Ver sección 7.5.

#### Defecto 16 — Endpoints del Worker sin autenticación

Los endpoints `/api/latest`, `/api/range` y `/ultimas` del Worker **no requieren
token**. La restricción CORS que implementan **no protege nada**: CORS solo
afecta a navegadores; una petición con `curl` o desde un script los lee sin
obstáculo.

Cualquiera que vea el código fuente de la página pública obtiene la URL del
Worker y puede descargar el historial completo de consumo eléctrico de la
vivienda. De un perfil de consumo minuto a minuto se deduce con bastante
fiabilidad **cuándo hay alguien en casa y cuándo no**.

Se documenta aquí por completitud, pero **la corrección corresponde al proyecto
CloudflareMonitorShelly**, no a este.

#### Defecto 17 — Enlace canónico de la portada

`base.njk` genera:
```html
<link rel="canonical" href="{{ site.url }}{{ page.url }}">
```

Para la portada, `page.url` es `/index.html`, así que el canónico apunta a
`https://morenoperez.es/index.html`.

La portada es accesible tanto en `/` como en `/index.html`. Lo habitual es que el
canónico apunte a `/`. Impacto en SEO: mínimo pero real.

#### Defecto 19 — Fotografías sin optimizar

`src/fotografias` se copia con passthrough, sin procesar. Los cuatro JPEG
actuales suman ~1,5 MB.

Con un álbum familiar real (cientos de fotos de móvil de 3-5 MB cada una):

- El repositorio Git crecería hasta hacerse inmanejable (Git no comprime bien las
  imágenes y guarda cada versión).
- Cada despliegue subiría cientos de megabytes.
- Los visitantes descargarían imágenes de 4000 píxeles de ancho para verlas en un
  recuadro de 300.

Existe el plugin oficial `@11ty/eleventy-img` (gratuito, MIT) que genera
automáticamente versiones redimensionadas en WebP y AVIF. Ver sección 7.7.

#### Defecto 24 — Datos personales

`miembros.json`, en repositorio público e indexable, contiene:

- Nombres reales de cuatro personas
- Años de nacimiento (2000 y 2004 en dos casos)
- Direcciones de correo individuales
- Relaciones familiares explícitas
- Ubicación aproximada (Comunidad de Madrid)

La portada declara explícitamente que el mapa está desactivado "para proteger
nuestra privacidad", lo que indica que hay conciencia del tema. Pero los datos
personales sí están publicados.

**No es un fallo técnico, es una decisión.** Se documenta para que sea
deliberada. Las opciones son: mantenerlo tal cual, usar solo nombres de pila sin
apellidos ni fechas, o hacer privado el repositorio (GitHub Pages funciona
igualmente en repos privados con cuenta gratuita para sitios de usuario, aunque
conviene verificarlo).

---

## 7. Estado recomendado (arquitectura objetivo)

Propuestas ordenadas por relación entre beneficio y esfuerzo. Ninguna es
urgente; el sitio funciona sin ellas.

### 7.1 Convenciones de nomenclatura

**Regla única: todo en minúsculas, palabras separadas por guion medio.**

Aplica a carpetas, ficheros, identificadores en JSON y clases CSS.

**Motivo técnico, no estético:** Windows **no** distingue mayúsculas de
minúsculas en nombres de fichero; Linux (y por tanto GitHub Pages) **sí**. Un
fichero llamado `Pagina.html` enlazado como `pagina.html` funciona perfectamente
en local y da 404 en producción. Este error ya se ha producido en este proyecto.

Excepciones inevitables (impuestas por herramientas externas): `README.md`,
`LICENSE`, `CNAME`, `_data`, `_includes`, `.github`.

**Prefijo `_` para carpetas excluidas de la compilación.** Eleventy ignora por
defecto las carpetas que empiezan por guion bajo dentro de `src/`, salvo las
declaradas en la configuración. Es la forma más limpia de tener borradores sin
que se publiquen.

### 7.2 Ficheros pendientes de rellenar

#### `src/sitemap.xml.njk`

```njk
---
permalink: /sitemap.xml
eleventyExcludeFromCollections: true
---
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{%- for pagina in collections.all %}
  <url>
    <loc>{{ site.url }}{{ pagina.url }}</loc>
    <lastmod>{{ pagina.date.toISOString() }}</lastmod>
  </url>
{%- endfor %}
</urlset>
```

Explicación:

| Línea | Función |
|---|---|
| `permalink: /sitemap.xml` | **Anula el dato global.** El front matter tiene prioridad. Corrige el defecto 4. |
| `eleventyExcludeFromCollections: true` | Evita que el sitemap se liste a sí mismo. |
| `collections.all` | Colección automática con todas las páginas. |
| `{%- ... -%}` | El guion suprime el espacio en blanco sobrante. |

> ⚠ **VERIFICAR.** El espacio de nombres XML debe comprobarse en `sitemaps.org`
> antes de dar por bueno el fichero. Un `xmlns` incorrecto hace que los
> buscadores rechacen el sitemap sin avisar.

#### `src/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://morenoperez.es/sitemap.xml
```

El dominio va escrito a mano porque el fichero se copia con passthrough y no se
procesan variables.

#### `src/site.webmanifest`

```json
{
  "name": "Familia Moreno Pérez",
  "short_name": "MorenoPerez",
  "description": "Portal familiar y contenedor de proyectos personales",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e3a8a",
  "lang": "es",
  "icons": [
    {
      "src": "/assets/favicons/web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/assets/favicons/web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

Los dos PNG referenciados existen ya en `src/assets/favicons/`. El `theme_color`
coincide con la variable `--primario`.

#### `README.md`

Debería contener, como mínimo: qué es el proyecto, URL pública, cómo levantarlo
en local (`npm install` + `npm start`), cómo desplegarlo (push a `main`), y un
enlace a este documento.

#### `LICENSE`

`package.json` declara `"license": "UNLICENSED"`. Para coherencia, o se escribe
una nota de "todos los derechos reservados" en el fichero, o se elimina el
fichero vacío.

### 7.3 Fuente única de verdad para la navegación

**Problema:** las URLs de los proyectos están duplicadas en `navegacion.json` y
`proyectos.json`.

**Solución propuesta:** que el submenú se genere a partir de `proyectos.json`.

`navegacion.json` quedaría sin el submenú:

```json
[
  { "texto": "Inicio", "url": "/#inicio" },
  { "texto": "Miembros", "url": "/#miembros" },
  { "texto": "Proyectos", "url": "#", "generarDesdeProyectos": true },
  { "texto": "Galería", "url": "/#galeria" },
  { "texto": "Contacto", "url": "/#contacto" }
]
```

Y `header.njk` recorrería `proyectos` filtrando por `enMenu` y ordenando por
`orden`:

```njk
{% if item.generarDesdeProyectos %}
  <details class="dropdown-proyectos">
    <summary class="dropdown-trigger">{{ item.texto }}</summary>
    <ul class="submenu-lista">
      {% for p in proyectos | selectattr("enMenu") | sort(attribute="orden") %}
        <li><a href="{{ p.url }}">{{ p.nombre }}</a></li>
      {% endfor %}
    </ul>
  </details>
{% endif %}
```

**Resultado:** añadir un proyecto pasa de tocar dos ficheros a tocar uno.
Desaparece la posibilidad de que se desincronicen.

> ⚠ **VERIFICAR.** Los filtros `selectattr` y `sort` existen en Nunjucks
> (heredados de Jinja2), pero su comportamiento exacto con valores booleanos
> conviene probarlo en local antes de desplegar.

### 7.4 Consolidación del monitor eléctrico

Estado objetivo:

```
src/
├── assets/
│   ├── css/
│   │   └── estilos.css              ← incorpora las clases del monitor
│   └── js/
│       └── monitor-shelly-em.js     ← JS extraído, único
└── proyectos/
    └── monitores-electricos/
        └── monitor-shelly-em.njk    ← solo HTML + front matter (~10 KB)
```

Pasos:

1. Partir de `shelly-monitor.js` (mejor estructura) y adaptarlo a los
   identificadores `p1-*` que usa el HTML actual, **o** renombrar los
   identificadores del HTML a `mon-*` para aprovechar las clases CSS que ya
   existen en `estilos.css`. La segunda opción es más limpia.
2. Mover el bloque `<style>` de la página a `estilos.css`.
3. Eliminar el bloque `{% raw %}` de la página (ya no hará falta).
4. Borrar el fichero que quede huérfano.

**Beneficios:** la página baja de 49 KB a unos 10 KB; el JavaScript se cachea
entre visitas; los errores de consola apuntan a un fichero real; deja de haber
dos sistemas de clases CSS.

### 7.5 URL del Worker en la capa de datos

Crear `src/_data/api.json`:

```json
{
  "workerBaseUrl": "https://worker-monitor-shelly-aerotermia.borkosmoreno.workers.dev",
  "intervaloRefrescoMs": 60000,
  "maxHuecoMs": 120000
}
```

Y en la página, **fuera** del bloque `{% raw %}` (dentro, Nunjucks no
interpolaría):

```njk
<script>
  window.CONFIG_MONITOR = {
    workerBaseUrl: "{{ api.workerBaseUrl }}",
    intervaloRefrescoMs: {{ api.intervaloRefrescoMs }},
    maxHuecoMs: {{ api.maxHuecoMs }}
  };
</script>
<script src="/assets/js/monitor-shelly-em.js" defer></script>
```

El fichero JS leería `window.CONFIG_MONITOR` en lugar de tener constantes a
fuego.

### 7.6 Gestión de borradores y variantes

**Regla:** no guardar versiones antiguas en el sistema de ficheros. Para eso
está Git.

En agosto de 2026 llegó a haber **catorce variantes** de la misma página
conviviendo en `src/`, todas publicándose. Fueron eliminadas.

Flujo recomendado para experimentar:

```bash
git checkout -b experimento-monitor-v2
# ... trabajar sobre el fichero canónico ...
git commit -am "Prueba: nueva disposición de controles"
# Si funciona:
git checkout main && git merge experimento-monitor-v2
# Si no:
git checkout main && git branch -D experimento-monitor-v2
```

Si aun así se necesita conservar borradores en disco: carpeta
`src/proyectos/<proyecto>/_borradores/`. El guion bajo la excluye de la
compilación.

### 7.7 Optimización de imágenes

Instalar el plugin oficial (gratuito, licencia MIT):

```bash
npm install --save-dev @11ty/eleventy-img
```

Genera automáticamente versiones en varios tamaños y formatos modernos (WebP,
AVIF) a partir de los originales.

**Alternativa sin dependencias:** convertir manualmente a WebP antes de añadir
las fotos al repositorio (con Squoosh, GIMP o `cwebp`). Más trabajo manual, cero
dependencias. Para un álbum familiar que crece despacio, puede ser suficiente.

**Regla mínima recomendable en cualquier caso:** ninguna imagen del repositorio
debería superar los 300 KB.

### 7.8 Verificación en el pipeline

Añadir un paso al workflow, entre la construcción y la publicación, que
compruebe que no hay enlaces internos rotos.

Existen herramientas de línea de comandos gratuitas para ello. El paso debería
**fallar la construcción** si detecta enlaces rotos, impidiendo la publicación.

Esto habría detectado automáticamente los defectos 2, 3, 7, 8 y 9.

### 7.9 Alinear versiones de Node

Cambiar `node-version: 20` a `node-version: 22` en `deploy.yml` (LTS actual en el
momento de escribir), o instalar Node 22 en local. Lo importante es que la
diferencia entre local y CI no sea de más de una versión mayor.

Alternativa más robusta: añadir un fichero `.nvmrc` en la raíz con la versión, y
en el workflow usar `node-version-file: '.nvmrc'`. Así hay una única fuente de
verdad.

### 7.10 Estructura objetivo completa

```
MorenoPerez/
├── .github/workflows/deploy.yml
├── docs/
│   ├── arquitectura-morenoperez.md
│   └── arquitectura-cloudflaremonitorshelly.md
├── src/
│   ├── _data/
│   │   ├── api.json              ← NUEVO
│   │   ├── config.json
│   │   ├── eventos.json
│   │   ├── miembros.json
│   │   ├── navegacion.json       ← sin submenú duplicado
│   │   ├── proyectos.json        ← con enMenu y orden
│   │   ├── redes.json
│   │   ├── site.json
│   │   └── ui.json
│   ├── _includes/
│   │   ├── layouts/{base,home,proyecto}.njk
│   │   └── partials/{header,footer}.njk
│   ├── assets/
│   │   ├── css/estilos.css       ← incluye clases del monitor
│   │   ├── favicons/
│   │   ├── imagenes/og/default-og.webp   ← NUEVO
│   │   └── js/monitor-shelly-em.js       ← extraído
│   ├── fotografias/              ← optimizadas
│   ├── proyectos/
│   │   ├── enlaces-de-interes/
│   │   ├── monitores-electricos/
│   │   │   ├── _borradores/      ← excluida del build
│   │   │   └── monitor-shelly-em.njk
│   │   ├── notas/
│   │   └── programacion/
│   ├── CNAME
│   ├── index.njk
│   ├── robots.txt                ← con contenido
│   ├── site.webmanifest          ← con contenido
│   └── sitemap.xml.njk           ← con contenido y permalink
├── .nvmrc                        ← NUEVO
├── ARQUITECTURA.md               ← índice que enlaza a docs/
├── LICENSE                       ← con contenido
├── README.md                     ← con contenido
├── eleventy.config.js
└── package.json
```

---

## 8. Runbook: añadir una página nueva

Procedimiento paso a paso para añadir una página dentro de un proyecto que ya
existe.

**Ejemplo:** añadir "Tarifas eléctricas" al proyecto de monitores eléctricos.

### Paso 1 — Crear el fichero

Ruta:
```
src/proyectos/monitores-electricos/tarifas-electricas.njk
```

Nombre en minúsculas y con guiones. Extensión `.njk` si va a usar variables o
bucles; `.html` si es solo contenido estático (funciona igual, porque
`htmlTemplateEngine` es Nunjucks).

### Paso 2 — Escribir el front matter

```yaml
---
layout: layouts/proyecto.njk
title: Tarifas Eléctricas
description: Comparativa de tarifas y análisis del PVPC.
categoria: Domótica
---
```

Las cuatro claves son las que espera `proyecto.njk`. La ruta del layout es
relativa a `src/_includes/`.

### Paso 3 — Escribir el contenido

Solo el cuerpo. **Sin `<html>`, sin `<head>`, sin `<body>`**: eso lo pone
`base.njk`.

```html
<h2>Introducción</h2>
<p>Texto del contenido.</p>

<div class="tarjeta" style="margin: 1.5rem 0;">
  <h3 style="color: var(--primario);">Un bloque destacado</h3>
  <p>Reutilizando las clases y variables globales.</p>
</div>
```

Clases disponibles: `.container`, `.tarjeta`, `.grid-tarjetas`, `.btn-retorno`.
Variables CSS: `--primario`, `--secundario`, `--gris-claro`, `--gris-borde`,
`--accent`, `--blanco`.

### Paso 4 — Registrar la página en el menú

Editar `src/_data/navegacion.json`, dentro del submenú de "Proyectos":

```json
{ "texto": "Tarifas Eléctricas",
  "url": "/proyectos/monitores-electricos/tarifas-electricas.html" }
```

⚠ **La URL termina en `.html`**, por el permalink global (sección 5.2.2).

### Paso 5 — Registrar la página en la portada (opcional)

Solo si debe aparecer como tarjeta. Editar `src/_data/proyectos.json`:

```json
{
  "id": "tarifas-electricas",
  "nombre": "Tarifas Eléctricas",
  "descripcion": "Comparativa de tarifas y análisis del PVPC.",
  "url": "/proyectos/monitores-electricos/tarifas-electricas.html",
  "externo": false,
  "categoria": "Domótica",
  "enMenu": true,
  "orden": 15
}
```

El `orden` 15 la coloca entre el 10 y el 20 sin renumerar nada.

### Paso 6 — Probar en local

```powershell
cd "D:\__md\_Datos\CodigoFuenteyPlantillas\GitHub\MorenoPerez"
npm start
```

Abrir `http://localhost:8080/proyectos/monitores-electricos/tarifas-electricas.html`

Comprobar:
- [ ] Cabecera y pie aparecen
- [ ] Título correcto en la pestaña del navegador
- [ ] La página está en el menú desplegable
- [ ] El botón "Volver a Proyectos" funciona
- [ ] Se ve bien estrechando la ventana (móvil)
- [ ] La consola del navegador (F12) no muestra errores nuevos

`npm start` recarga automáticamente al guardar. Detener con `Ctrl + C`.

### Paso 7 — Publicar

```powershell
git add .
git commit -m "Añadida página de tarifas eléctricas"
git push origin main
```

O ejecutar el `.bat` de despliegue.

### Paso 8 — Verificar el despliegue

1. Ir a https://github.com/BorkosMoreno/MorenoPerez/actions
2. Esperar el tic verde (1-2 minutos habitualmente)
3. Abrir la URL pública
4. Si no aparecen los cambios: `Ctrl + F5` para forzar recarga sin caché

**Si el workflow falla (aspa roja):** pulsar sobre la ejecución fallida y leer el
paso que ha fallado. Lo más habitual es un error de sintaxis en el front matter
(indentación YAML) o un JSON malformado (coma sobrante).

---

## 9. Runbook: añadir un proyecto nuevo con subruta

Para un proyecto completamente nuevo, con su propia subruta.

**Ejemplo:** proyecto "Libreta de direcciones" en `/libreta-direcciones/`.

### Decisión previa: ¿bajo `/proyectos/` o en la raíz?

| Opción | URL resultante | Cuándo usarla |
|---|---|---|
| `src/proyectos/libreta-direcciones/` | `/proyectos/libreta-direcciones/…` | Por defecto. Coherente con lo existente. |
| `src/libreta-direcciones/` | `/libreta-direcciones/…` | Solo si el proyecto tiene entidad propia y se va a enlazar externamente. |

La segunda es la que se anticipaba en la planificación inicial del sitio. Ambas
funcionan; lo importante es ser coherente.

Este runbook usa la primera.

### Paso 1 — Crear la estructura

```powershell
cd "D:\__md\_Datos\CodigoFuenteyPlantillas\GitHub\MorenoPerez\src\proyectos"
mkdir libreta-direcciones
cd libreta-direcciones
New-Item -ItemType File _borradores\.gitkeep -Force
```

La carpeta `_borradores` con guion bajo queda excluida de la compilación desde el
primer día.

### Paso 2 — Crear la página índice del proyecto

`src/proyectos/libreta-direcciones/index.njk`:

```yaml
---
layout: layouts/proyecto.njk
title: Libreta de Direcciones
description: Gestión de contactos familiares y profesionales.
categoria: Utilidades
---
```

⚠ **Atención al permalink.** Con la regla global, `index.njk` dentro de esa
carpeta produce `/proyectos/libreta-direcciones/index.html`, **no**
`/proyectos/libreta-direcciones/`.

Si se quiere la URL corta, hay que declararlo explícitamente en el front matter:

```yaml
---
layout: layouts/proyecto.njk
title: Libreta de Direcciones
description: Gestión de contactos familiares y profesionales.
categoria: Utilidades
permalink: /proyectos/libreta-direcciones/
---
```

Recordatorio: el front matter tiene prioridad sobre el dato global.

### Paso 3 — Datos propios del proyecto (si los necesita)

Dos opciones:

**a) Fichero global**, si los datos son pequeños y estables:
`src/_data/contactos.json` → variable `contactos`, accesible desde cualquier
plantilla.

**b) Fichero local al directorio**, si solo interesan a ese proyecto:
`src/proyectos/libreta-direcciones/libreta-direcciones.json`. Eleventy aplica un
sistema de "datos de directorio" por el cual esos datos solo están disponibles
para las plantillas de esa carpeta.

> ⚠ **VERIFICAR.** Las reglas exactas de nomenclatura de los ficheros de datos de
> directorio conviene consultarlas en la documentación oficial de Eleventy antes
> de usarlas. Son sensibles al nombre.

### Paso 4 — Recursos propios

| Tipo | Dónde ponerlo | Cómo enlazarlo |
|---|---|---|
| CSS específico | Añadir al final de `estilos.css` con un prefijo de clase propio | Ya viene cargado por `base.njk` |
| JavaScript | `src/assets/js/libreta-direcciones.js` | `<script src="/assets/js/libreta-direcciones.js" defer></script>` |
| Imágenes | `src/assets/imagenes/ui/` | `/assets/imagenes/ui/imagen.webp` |
| Descargas | `src/descargas/` | `/descargas/fichero.pdf` |

**Prefijo de clases CSS obligatorio.** Para "Libreta de direcciones", usar `.lib-`
en todas sus clases. Evita colisiones con otros proyectos al compartir todos el
mismo `estilos.css`.

### Paso 5 — Registrar el proyecto

En `src/_data/proyectos.json`:

```json
{
  "id": "libreta-direcciones",
  "nombre": "Libreta de Direcciones",
  "descripcion": "Gestión de contactos familiares y profesionales.",
  "url": "/proyectos/libreta-direcciones/",
  "externo": false,
  "categoria": "Utilidades",
  "enMenu": true,
  "orden": 25
}
```

Y en `src/_data/navegacion.json` (mientras no se implemente la mejora 7.3):

```json
{ "texto": "Libreta de Direcciones", "url": "/proyectos/libreta-direcciones/" }
```

### Paso 6 — Si el proyecto consume una API externa

Registrar la URL base en `src/_data/api.json`, nunca a fuego en la página.

Si es un Worker de Cloudflare propio, **añadir `https://morenoperez.es` y
`https://www.morenoperez.es` a la lista `ALLOWED_ORIGINS`** del Worker. Sin esto,
el navegador bloqueará las peticiones por política CORS.

Recordar que CORS **no es un mecanismo de seguridad** para proteger datos: solo
condiciona a los navegadores. Si los datos son sensibles, hace falta
autenticación real (ver defecto 16).

### Paso 7 — Probar y publicar

Igual que en los pasos 6, 7 y 8 del runbook anterior.

Comprobaciones adicionales para un proyecto nuevo:
- [ ] La URL raíz del proyecto responde
- [ ] Aparece como tarjeta en la portada
- [ ] Aparece en el menú desplegable
- [ ] Si consume una API, no hay errores CORS en la consola
- [ ] La carpeta `_borradores` **no** ha generado ninguna página en `_site/`

---

## 10. Glosario

**11ty** — Abreviatura de Eleventy.

**Artefacto** — En GitHub Actions, paquete de ficheros producido por un trabajo y
consumido por otro. Aquí, la carpeta `_site` comprimida.

**BOM** *(Byte Order Mark)* — Marca invisible al principio de un fichero de texto
que declara su codificación. El CSV exportado por el monitor la incluye para que
Excel en español lo abra correctamente.

**Bucket** — En la API del Worker, intervalo de agregación temporal. `bucket=5m`
significa un punto cada cinco minutos.

**Canónico** *(enlace)* — Etiqueta `<link rel="canonical">` que indica a los
buscadores cuál es la URL oficial de una página cuando hay varias que muestran lo
mismo.

**Cascada de datos** — Sistema de Eleventy por el que las variables de distintos
orígenes (globales, de directorio, de front matter) se combinan con un orden de
prioridad definido.

**CI/CD** *(Integración Continua / Despliegue Continuo)* — Automatización que
construye y publica el proyecto al hacer `push`.

**Colección** — Agrupación automática o manual de páginas en Eleventy.
`collections.all` contiene todas.

**CORS** *(Cross-Origin Resource Sharing)* — Mecanismo por el que un navegador
decide si permite que una página de un dominio haga peticiones a otro. **No es
una medida de seguridad del servidor**: solo condiciona a los navegadores.

**Cron** — Programador de tareas periódicas. El Worker usa `* * * * *` (cada
minuto).

**D1** — Base de datos SQLite gestionada de Cloudflare, accesible desde Workers.

**Front matter** — Bloque de metadatos YAML al principio de un fichero,
delimitado por `---`.

**Gap** *(hueco)* — Interrupción en una serie temporal por falta de datos. El
monitor los dibuja como cortes en la línea, no como líneas rectas.

**GitHub Actions** — Servicio de automatización de GitHub. Ejecuta los workflows.

**GitHub Pages** — Servicio gratuito de alojamiento de sitios estáticos.

**Layout** — Plantilla que envuelve el contenido de una página.

**Mojibake** — Texto ilegible producido al interpretar caracteres con una
codificación distinta de la usada al guardarlos. Ver defecto 10.

**Nunjucks** — Motor de plantillas de JavaScript, inspirado en Jinja2 (Python).
Aporta `{{ variables }}`, `{% bucles %}` y `{% condicionales %}`.

**Open Graph** — Conjunto de metaetiquetas que definen cómo se ve un enlace al
compartirlo en redes sociales o mensajería.

**Partial** — Fragmento de plantilla reutilizable insertado con `{% include %}`.

**Passthrough copy** — Copia de ficheros sin procesar, tal cual, de `src/` a
`_site/`.

**Permalink** — Ruta de salida de una página; determina su URL pública.

**PVPC** — Precio Voluntario para el Pequeño Consumidor. Tarifa eléctrica
regulada en España.

**Raw** *(bloque)* — En Nunjucks, `{% raw %}…{% endraw %}` indica que el
contenido no debe interpretarse como plantilla. Necesario para JavaScript que
contenga `{{` o `{%`.

**Shelly EM** — Dispositivo de monitorización eléctrica con dos pinzas
amperimétricas.

**Shortcode** — Función invocable desde una plantilla. Aquí: `{% year %}`.

**Sitemap** — Fichero XML que lista las URLs del sitio para los buscadores.

**SSG** *(Static Site Generator)* — Generador de sitios estáticos.

**Stale** — En el monitor, estado en que los datos son demasiado antiguos para
considerarse actuales.

**Stepped** *(línea escalonada)* — Estilo de gráfico en el que la línea sube o
baja en vertical entre puntos, en lugar de en diagonal. Adecuado para lecturas
discretas.

**Worker** — Función que se ejecuta en la red de Cloudflare, sin servidor
propio.

**Workflow** — Fichero YAML en `.github/workflows/` que define una automatización
de GitHub Actions.

---

## 11. Historial de cambios del documento

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 2026-08-14 | Versión inicial. Estado tras la limpieza de borradores y la corrección de `navegacion.json` y `proyectos.json`. |

### Cuándo actualizar este documento

- Al añadir o eliminar un proyecto
- Al cambiar `eleventy.config.js`
- Al modificar el workflow de despliegue
- Al resolver cualquier defecto de la sección 6 (marcar como resuelto)
- Al adoptar cualquier propuesta de la sección 7 (moverla a la sección 5)

### Verificaciones pendientes

Puntos marcados en el texto que **no han podido comprobarse** y deben
contrastarse:

1. El `xmlns` correcto del estándar sitemap (sección 7.2)
2. El comportamiento de `selectattr` y `sort` en Nunjucks (sección 7.3)
3. Las reglas de nomenclatura de los ficheros de datos de directorio en Eleventy
   (sección 9, paso 3)
4. El contenido de `apuntes.html` y `enlaces-de-interes-originales.html`
   (sección 5.6)

### Documentos relacionados

- `docs/arquitectura-cloudflaremonitorshelly.md` — pendiente de redactar.
  Cubrirá el Worker, el esquema de D1, la integración con Shelly Cloud, la API y
  las consideraciones de seguridad del defecto 16.

---

*Documento generado con asistencia de IA a partir de la inspección directa del
código fuente. Todos los datos técnicos han sido verificados sobre los ficheros
del proyecto salvo los marcados explícitamente como supuesto o pendiente de
verificación.*