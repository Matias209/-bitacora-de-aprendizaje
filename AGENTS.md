# AGENTS.md — Bitácora de vuelo

Diario personal de estudio y planificador de hábitos de Matías Samuel Díaz, publicado en `https://matias209.github.io/-bitacora-de-aprendizaje/`. Sirve para registrar lo que estudia (muchas veces con una skill de Claude que pega un JSON), medir su racha y sus puntos, y llevar sus hábitos. También se muestra en el portfolio como prueba de aprendizaje continuo. Usa la estética espacial de la suite OrbitCX.

## Stack y estructura

- HTML, CSS y JavaScript puro. **Sin frameworks, sin build, sin dependencias y sin tests.**
- **Exactamente tres archivos:** `index.html`, `styles.css` y `app.js`. No se agregan archivos ni dependencias.
- Única dependencia externa: las tipografías de Google Fonts (Space Grotesk, Inter y JetBrains Mono). Sin internet, la página usa las del sistema y sigue funcionando.
- `app.js` está ordenado en bloques: 1. Fechas, 2. Datos (localStorage), 3. Cálculos (rachas y puntos), 4. Sesiones, 5. Hábitos, 6. Acceso con clave, 7. Respaldo, 8. Arranque.

## Comandos

No hay build, lint ni tests. Se abre `index.html` con doble clic: tiene que funcionar desde `file://` y desde GitHub Pages.

Para revisar la sintaxis sin abrir el navegador:

```bash
"C:\Program Files\nodejs\node.exe" --check app.js
```

## Convenciones

- Todos los textos de la interfaz en **español**.
- **Código legible para juniors:** nombres en español que digan qué hacen y comentarios que expliquen el porqué.
- **El DOM se arma con el helper `h()`**, con nodos de texto y nunca con `innerHTML`, porque el contenido viene de JSON pegado.
- **Toda modificación sigue el mismo camino:** cambiar `datos` → `guardar()` → `render()`. `render()` redibuja el panel, el historial y los hábitos completos. La única excepción son las notas del día, que se guardan sin redibujar para no perder el foco del campo.
- **Colores:** siempre con las variables de `:root` en `styles.css`. El modo oscuro es el principal y el claro se activa con `prefers-color-scheme: light`.

## Reglas de dominio / trampas conocidas

- **Contrato con la extensión de Claude:** la skill **registrar-sesion** pega el JSON en la página.
  - Los ids `importar-json`, `importar-btn`, `importar-ok` e `importar-error` **no se pueden cambiar**.
  - La sección "Importar captura" tiene que estar siempre visible. Por eso la navegación es con anclas y no con pestañas ocultas.
- **La URL no se cambia:** el repo se sigue llamando `-bitacora-de-aprendizaje` aunque la página diga "Bitácora de vuelo". La skill registrar-sesion y el portfolio usan esa dirección.
- **Solo fechas locales:** nunca usar `toISOString()` ni UTC para fechas. Usar `fechaLocal`, `leerFecha`, `sumarDias` y `diferenciaDias`. Las fechas son textos `"YYYY-MM-DD"` y se comparan como texto.
- **Una sola clave de localStorage**, `"bitacora-v1"`, con un campo `version`. Los cambios de formato pasan por `normalizar()` (el punto de migración) y por `VERSION`.
- **Los puntos se calculan, nunca se guardan.** `calcularPuntos()` los recalcula desde `datos.sesiones`:
  - +10 por sesión;
  - +1 cada 5 minutos;
  - +20 por día activo;
  - +50 por cada múltiplo de 7 dentro de cada racha.

  Borrar una sesión tiene que funcionar solo. No agregar contadores incrementales.
- **El rango también se calcula:** `RANGOS` y `rangoSegunPuntos()` lo sacan de los puntos (Cadete, Piloto, Navegante, Comandante, Capitán de flota, Almirante estelar). Se muestra en el elemento con id `nivel`.
- **La trayectoria de 30 días** (`renderTrayectoria()`) usa `fechasConSesion()`: una estrella por día, con hoy al final.
- **Sesiones:** tanto el importador como el formulario pasan por `validarSesion()` → `guardarSesion()`, que actualiza en lugar de duplicar cuando coinciden `url` y `fecha`. Cualquier entrada nueva tiene que usar ese mismo camino.
- **Hábitos:**
  - Los de tipo `"diario"` usan `marcas`.
  - Los de tipo `"diassin"` guardan `inicio` y `record`, y se reinician con `reiniciarDiasSin`.
  - Un hábito diario llamado "Estudio" (`esEstudio`) se marca solo con las sesiones, y sus casillas están deshabilitadas.
  - Las rachas de hábitos (`rachasHabito`) saltean los días que no son objetivo. El lunes es el índice 0.
- **Pantalla de clave:**
  - Todo vive dentro de `#app`, que está oculto hasta desbloquear. `render()` solo corre desde `mostrarApp()`, así que no hay que llamarlo al arrancar.
  - El hash PBKDF2 y el vencimiento del desbloqueo (`datos.acceso`) están dentro de `bitacora-v1`, no se exportan y se conservan al restaurar un respaldo.
  - Es un bloqueo de pantalla, **no seguridad real**.

## Límites y datos sensibles

- Los datos de estudio viven solo en el navegador de cada persona. No se suben a ningún lado.
- Nunca guardar ni mostrar la clave: solo su hash.
- `MEMORY.md` no se sube al repo (está excluido en `.git/info/exclude`).

## Forma de trabajar

- **Diseñar antes de programar:** proponer el cambio y esperar el OK de Matías.
- **Cambios chicos.** Al terminar, explicar en lenguaje simple qué cambió, qué se probó y qué falta.
- ✅ **Siempre:**
  - mantener los ids del importador;
  - usar fechas locales;
  - pasar los textos por `h()`;
  - revisar con `node --check`;
  - actualizar `MEMORY.md`.
- ⚠ **Pregunta antes:**
  - cambiar el formato de los datos (necesita una migración en `normalizar()`);
  - agregar secciones;
  - hacer commits o push, porque publican la página.
- 🚫 **Nunca:**
  - agregar archivos o dependencias;
  - cambiar los ids del importador o la URL del repo;
  - guardar puntos o rachas;
  - usar `innerHTML` con datos importados.

## Verificación

- `node --check app.js` sin errores.
- Abrir con doble clic, desbloquear y recorrer todas las secciones. No tiene que haber errores en la consola.
- Importar un JSON de prueba con la skill registrar-sesion (o pegándolo a mano) y comprobar que aparezca en el historial y en la trayectoria.
- Borrar esa sesión y comprobar que la racha, los puntos y el rango se recalculen.
- Probar en celular (375 px) y en modo claro.

## Memoria

- Al empezar, lee `MEMORY.md` para conocer el estado del proyecto y las decisiones tomadas.
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria.
- No guardes nunca datos sensibles (claves, tokens, datos personales).
