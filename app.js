/* ==========================================================
   Bitácora de vuelo (antes "Bitácora de Aprendizaje")
   Todo el código está en este archivo, ordenado por bloques:
   1. Fechas   2. Datos (localStorage)   3. Cálculos (rachas y puntos)
   4. Sesiones   5. Hábitos   6. Acceso con clave   7. Respaldo   8. Arranque
   ========================================================== */

const CLAVE = "bitacora-v1";   // única clave de localStorage
const VERSION = 1;             // versión del formato de datos (sirve para migrar a futuro)
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* ==========================================================
   1. FECHAS
   Siempre usamos la fecha LOCAL del usuario, nunca UTC.
   (toISOString() devuelve UTC y a la noche podría dar el día siguiente.)
   ========================================================== */

// Date -> "YYYY-MM-DD" usando año/mes/día locales
function fechaLocal(d) {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mes + "-" + dia;
}

// "YYYY-MM-DD" -> Date a medianoche local
function leerFecha(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function hoy() {
  return fechaLocal(new Date());
}

// Suma (o resta) días a una fecha en texto. new Date(a, m, d + n) maneja cambios de mes y de horario de verano.
function sumarDias(texto, n) {
  const d = leerFecha(texto);
  return fechaLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

// Días de diferencia entre dos fechas (b - a). Usa UTC solo para contar días enteros sin errores de horario.
function diferenciaDias(a, b) {
  const [a1, a2, a3] = a.split("-").map(Number);
  const [b1, b2, b3] = b.split("-").map(Number);
  return Math.round((Date.UTC(b1, b2 - 1, b3) - Date.UTC(a1, a2 - 1, a3)) / 86400000);
}

// ¿Es un texto "YYYY-MM-DD" que corresponde a una fecha real?
function fechaValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && fechaLocal(leerFecha(texto)) === texto;
}

// Posición del día en la semana, con lunes = 0 y domingo = 6
function indiceSemana(texto) {
  return (leerFecha(texto).getDay() + 6) % 7;
}

/* ==========================================================
   2. DATOS (localStorage)
   ========================================================== */

function datosVacios() {
  return {
    version: VERSION,
    sesiones: [],   // { id, plataforma, curso, seccion, url, resumen, puntosClave[], conceptos[], minutos, fecha }
    habitos: [],    // { id, nombre, tipo: "diario"|"diassin", icono, diasObjetivo[0-6], inicio, record }
    marcas: {},     // { idHabito: { "YYYY-MM-DD": true } }
    notas: {},      // { "YYYY-MM-DD": "texto" }
    acceso: null    // { sal, hash, hasta } -> clave de esta computadora (ver bloque 6)
  };
}

// Asegura que los datos tengan todos los campos. Acá se agregarían las migraciones futuras
// (por ejemplo: if (datos.version < 2) { ... }).
function normalizar(crudos) {
  const d = datosVacios();
  if (!crudos || typeof crudos !== "object") return d;
  if (Array.isArray(crudos.sesiones)) d.sesiones = crudos.sesiones.filter(s => s && typeof s === "object");
  if (Array.isArray(crudos.habitos)) d.habitos = crudos.habitos.filter(h => h && typeof h === "object");
  if (crudos.marcas && typeof crudos.marcas === "object") d.marcas = crudos.marcas;
  if (crudos.notas && typeof crudos.notas === "object") d.notas = crudos.notas;
  const a = crudos.acceso;
  if (a && typeof a.sal === "string" && typeof a.hash === "string") {
    d.acceso = { sal: a.sal, hash: a.hash, hasta: Number(a.hasta) || 0 };
  }
  d.version = VERSION;
  return d;
}

function cargar() {
  try {
    const texto = localStorage.getItem(CLAVE);
    return texto ? normalizar(JSON.parse(texto)) : datosVacios();
  } catch (e) {
    return datosVacios();
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (e) {
    alert("No se pudo guardar en el navegador (¿almacenamiento lleno o bloqueado?).");
  }
}

let datos = cargar();

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ==========================================================
   3. CÁLCULOS: rachas y puntos
   Todo se calcula a partir de los datos guardados, así borrar
   una sesión recalcula todo correctamente.
   ========================================================== */

// Conjunto de fechas (sin repetir) que tienen al menos una sesión
function fechasConSesion() {
  return new Set(datos.sesiones.map(s => s.fecha));
}

// Devuelve el largo de cada tramo de días consecutivos. Ej: [3, 7, 1]
function tramosConsecutivos(conjuntoFechas) {
  const orden = [...conjuntoFechas].sort();
  const tramos = [];
  let largo = 0;
  orden.forEach((f, i) => {
    if (i > 0 && diferenciaDias(orden[i - 1], f) === 1) {
      largo++;
    } else {
      if (largo > 0) tramos.push(largo);
      largo = 1;
    }
  });
  if (largo > 0) tramos.push(largo);
  return tramos;
}

// Racha actual: días consecutivos que terminan hoy.
// Si hoy todavía no hay sesión, se cuenta desde ayer (la racha sigue viva hasta que termine el día).
function rachaActual() {
  const fechas = fechasConSesion();
  let dia = hoy();
  if (!fechas.has(dia)) dia = sumarDias(dia, -1);
  let racha = 0;
  while (fechas.has(dia)) {
    racha++;
    dia = sumarDias(dia, -1);
  }
  return racha;
}

function rachaMaxima() {
  return Math.max(0, ...tramosConsecutivos(fechasConSesion()));
}

// Puntos totales:
// +10 por sesión, +1 cada 5 minutos, +20 por el primer registro de cada día,
// +50 por cada día en que una racha llega a un múltiplo de 7
function calcularPuntos(sesiones) {
  let puntos = 0;
  const fechas = new Set();
  sesiones.forEach(s => {
    puntos += 10;
    puntos += Math.floor((s.minutos || 0) / 5);
    fechas.add(s.fecha);
  });
  puntos += 20 * fechas.size;
  tramosConsecutivos(fechas).forEach(largo => {
    puntos += 50 * Math.floor(largo / 7);
  });
  return puntos;
}

/* ==========================================================
   Utilidad para armar HTML sin riesgos:
   h("div", { class: "x" }, "texto", otroElemento)
   Los textos se insertan como texto (no como HTML), así que
   nada de lo que se pegue puede romper la página.
   ========================================================== */
function h(etiqueta, props, ...hijos) {
  const el = document.createElement(etiqueta);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  });
  hijos.flat().forEach(hijo => {
    if (hijo === null || hijo === undefined || hijo === false) return;
    el.append(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  });
  return el;
}

const $ = id => document.getElementById(id);

function mostrarMensaje(el, texto) {
  el.textContent = texto;
  el.hidden = !texto;
}

/* ==========================================================
   4. SESIONES: validar, guardar, historial
   ========================================================== */

// Valida un objeto con los campos de una sesión.
// Devuelve { errores: [...], sesion: {...} }. Si hay errores no se guarda nada.
function validarSesion(obj) {
  const errores = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { errores: ["El contenido debe ser un objeto JSON con los datos de la sesión."] };
  }

  const texto = v => (typeof v === "string" ? v.trim() : "");

  // Campos obligatorios
  const faltan = ["plataforma", "seccion", "url", "resumen"].filter(c => !texto(obj[c]));
  if (faltan.length) errores.push("Faltan campos obligatorios: " + faltan.join(", ") + ".");

  const url = texto(obj.url);
  if (url && !/^https?:\/\//i.test(url)) errores.push('La "url" debe empezar con http:// o https://.');

  // Campos opcionales
  let minutos = 0;
  if (obj.minutos !== undefined && obj.minutos !== null && obj.minutos !== "") {
    minutos = Number(obj.minutos);
    if (!isFinite(minutos) || minutos < 0) {
      errores.push('"minutos" debe ser un número mayor o igual a 0.');
      minutos = 0;
    }
  }

  let fecha = hoy();
  if (obj.fecha !== undefined && obj.fecha !== null && obj.fecha !== "") {
    if (typeof obj.fecha === "string" && fechaValida(obj.fecha.trim())) fecha = obj.fecha.trim();
    else errores.push('"fecha" debe tener el formato AAAA-MM-DD (por ejemplo 2026-11-01).');
  }

  // puntosClave y conceptos: listas de textos
  const lista = campo => {
    const v = obj[campo];
    if (v === undefined || v === null || v === "") return [];
    if (!Array.isArray(v)) {
      errores.push('"' + campo + '" debe ser una lista, por ejemplo ["a", "b"].');
      return [];
    }
    return v.map(texto).filter(Boolean);
  };
  const puntosClave = lista("puntosClave");
  const conceptos = lista("conceptos");

  return {
    errores,
    sesion: {
      plataforma: texto(obj.plataforma),
      curso: texto(obj.curso),
      seccion: texto(obj.seccion),
      url,
      resumen: texto(obj.resumen),
      puntosClave,
      conceptos,
      minutos: Math.floor(minutos),
      fecha
    }
  };
}

// Guarda la sesión. Si ya existe una con la misma url y fecha, la actualiza en vez de duplicarla.
// Devuelve cuántos puntos se sumaron y si fue una actualización.
function guardarSesion(sesion) {
  const antes = calcularPuntos(datos.sesiones);
  const existente = datos.sesiones.find(s => s.url === sesion.url && s.fecha === sesion.fecha);
  if (existente) Object.assign(existente, sesion);
  else datos.sesiones.push({ id: nuevoId(), creada: Date.now(), ...sesion });
  guardar();
  const sumados = Math.max(0, calcularPuntos(datos.sesiones) - antes);
  return { sumados, actualizada: Boolean(existente) };
}

// --- Importar JSON (lo usa la extensión de Claude) ---
function importarCaptura() {
  const ok = $("importar-ok");
  const error = $("importar-error");
  mostrarMensaje(ok, "");
  mostrarMensaje(error, "");

  // Por si el JSON viene dentro de un bloque ```json ... ```
  let texto = $("importar-json").value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!texto) {
    mostrarMensaje(error, "El cuadro está vacío. Pegá el JSON de la captura.");
    return;
  }

  let obj;
  try {
    obj = JSON.parse(texto);
  } catch (e) {
    mostrarMensaje(error, "El JSON no es válido (" + e.message + "). No se guardó nada.");
    return;
  }

  const { errores, sesion } = validarSesion(obj);
  if (errores.length) {
    mostrarMensaje(error, errores.join(" ") + " No se guardó nada.");
    return;
  }

  const r = guardarSesion(sesion);
  mostrarMensaje(ok, (r.actualizada ? "Sesión actualizada. " : "Sesión guardada. ") +
    "Se sumaron " + r.sumados + " puntos.");
  $("importar-json").value = "";
  render();
}

// --- Registro manual ---
function guardarManual(evento) {
  evento.preventDefault();
  const f = evento.target;
  const msg = $("registro-msg");

  // Armamos el mismo objeto que tendría el JSON y usamos la misma validación
  const obj = {
    plataforma: f.plataforma.value,
    curso: f.curso.value,
    seccion: f.seccion.value,
    url: f.url.value,
    resumen: f.resumen.value,
    puntosClave: f.puntosClave.value.split("\n"),
    conceptos: f.conceptos.value.split(","),
    minutos: f.minutos.value,
    fecha: f.fecha.value
  };
  const { errores, sesion } = validarSesion(obj);
  msg.className = "mensaje";
  if (errores.length) {
    msg.classList.add("error");
    mostrarMensaje(msg, errores.join(" "));
    return;
  }

  const r = guardarSesion(sesion);
  msg.classList.add("ok");
  mostrarMensaje(msg, (r.actualizada ? "Sesión actualizada. " : "Sesión guardada. ") +
    "Se sumaron " + r.sumados + " puntos.");
  f.reset();
  f.fecha.value = hoy();
  render();
}

// --- Panel principal ---

// Rangos de la tripulación: se sube de rango al llegar a esos puntos.
// Se calculan a partir de los puntos, así que no se guardan en ningún lado.
const RANGOS = [
  { desde: 0,    nombre: "Cadete" },
  { desde: 500,  nombre: "Piloto" },
  { desde: 1500, nombre: "Navegante" },
  { desde: 3000, nombre: "Comandante" },
  { desde: 5000, nombre: "Capitán de flota" },
  { desde: 8000, nombre: "Almirante estelar" }
];

// Devuelve el rango actual y el siguiente (null si ya es el más alto)
function rangoSegunPuntos(puntos) {
  let posicion = 0;
  RANGOS.forEach((rango, i) => { if (puntos >= rango.desde) posicion = i; });
  return { actual: RANGOS[posicion], siguiente: RANGOS[posicion + 1] || null };
}

function renderPanel() {
  const puntos = calcularPuntos(datos.sesiones);
  const rango = rangoSegunPuntos(puntos);

  $("racha-actual").textContent = rachaActual();
  $("racha-max").textContent = rachaMaxima();
  $("puntos-total").textContent = puntos;
  $("nivel").textContent = rango.actual.nombre;
  $("nivel-detalle").textContent = rango.siguiente
    ? "Rango (" + (rango.siguiente.desde - puntos) + " puntos para " + rango.siguiente.nombre + ")"
    : "Rango máximo";

  renderTrayectoria();

  // Últimos 7 días: hoy y los 6 anteriores
  const desde = sumarDias(hoy(), -6);
  const semana = datos.sesiones.filter(s => s.fecha >= desde && s.fecha <= hoy());
  $("semana-sesiones").textContent = semana.length;
  $("semana-minutos").textContent = semana.reduce((suma, s) => suma + (s.minutos || 0), 0);
}

// --- Trayectoria de los últimos 30 días ---
// Una estrella por día: encendida si ese día hubo al menos una sesión.
// El último punto es hoy.
const DIAS_TRAYECTORIA = 30;

function renderTrayectoria() {
  const fechas = fechasConSesion();
  const estrellas = [];
  let diasConEstudio = 0;

  for (let atras = DIAS_TRAYECTORIA - 1; atras >= 0; atras--) {
    const fecha = sumarDias(hoy(), -atras);
    const estudio = fechas.has(fecha);
    if (estudio) diasConEstudio++;

    const [, mes, dia] = fecha.split("-").map(Number);
    const texto = DIAS_CORTOS[indiceSemana(fecha)] + " " + dia + " " + MESES[mes - 1] + ": " +
      (estudio ? "estudiaste" : "sin sesión");
    const clases = "estrella" + (estudio ? " encendida" : "") + (atras === 0 ? " es-hoy" : "");
    estrellas.push(h("span", { class: clases, title: texto, "aria-label": texto }));
  }

  $("trayectoria").replaceChildren(...estrellas);
  $("trayectoria-resumen").textContent = diasConEstudio + " de " + DIAS_TRAYECTORIA + " días con estudio";
}

// --- Historial ---
function renderHistorial() {
  // Rellenar el select de plataformas (conservando la selección)
  const select = $("filtro-plataforma");
  const elegida = select.value;
  const plataformas = [...new Set(datos.sesiones.map(s => s.plataforma))].sort();
  select.replaceChildren(
    h("option", { value: "" }, "Todas las plataformas"),
    ...plataformas.map(p => h("option", { value: p }, p))
  );
  select.value = plataformas.includes(elegida) ? elegida : "";

  const busqueda = $("buscador").value.trim().toLowerCase();

  // Más reciente primero: por fecha y, a igual fecha, por orden de creación
  const sesiones = datos.sesiones
    .filter(s => !select.value || s.plataforma === select.value)
    .filter(s => {
      if (!busqueda) return true;
      const todo = [s.plataforma, s.curso, s.seccion, s.resumen, ...(s.puntosClave || []), ...(s.conceptos || [])]
        .join(" ").toLowerCase();
      return todo.includes(busqueda);
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creada || 0) - (a.creada || 0));

  const lista = $("lista-sesiones");
  if (!sesiones.length) {
    lista.replaceChildren(h("p", { class: "vacio" },
      datos.sesiones.length ? "No hay sesiones que coincidan." : "Todavía no hay sesiones registradas."));
    return;
  }

  // Cada sesión se muestra como una entrada de bitácora:
  // a la izquierda la fecha (como en un registro de vuelo), a la derecha el contenido
  lista.replaceChildren(...sesiones.map(s => {
    const [anio, mes, dia] = s.fecha.split("-").map(Number);

    const columnaFecha = h("div", { class: "sesion-fecha" },
      h("span", { class: "sesion-dia" }, String(dia)),
      h("span", {}, MESES[mes - 1] + " " + anio),
      s.minutos ? h("span", { class: "sesion-minutos" }, s.minutos + " min") : null
    );

    const cuerpo = h("div", { class: "sesion-cuerpo" },
      h("div", { class: "sesion-meta" },
        h("strong", {}, s.plataforma),
        s.curso ? h("span", {}, s.curso) : null
      ),
      h("h3", {}, s.seccion),
      h("p", {}, s.resumen),
      s.puntosClave && s.puntosClave.length
        ? h("ul", {}, s.puntosClave.map(p => h("li", {}, p))) : null,
      s.conceptos && s.conceptos.length
        ? h("div", { class: "etiquetas" }, s.conceptos.map(c => h("span", { class: "etiqueta" }, c))) : null,
      h("div", { class: "sesion-pie" },
        // Solo se crea el link si la url es http(s), por seguridad
        /^https?:\/\//i.test(s.url)
          ? h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, "Ir a esta sección")
          : h("span"),
        h("button", { type: "button", class: "peligro chico", onclick: () => borrarSesion(s.id) }, "Borrar")
      )
    );

    return h("article", { class: "tarjeta sesion" }, columnaFecha, cuerpo);
  }));
}

function borrarSesion(id) {
  if (!confirm("¿Borrar esta sesión? Los puntos y la racha se recalcularán.")) return;
  datos.sesiones = datos.sesiones.filter(s => s.id !== id);
  guardar();
  render();
}

/* ==========================================================
   5. HÁBITOS
   ========================================================== */

let semanaOffset = 0;   // 0 = esta semana, -1 = la anterior, 1 = la siguiente

// Un hábito llamado "Estudio" se marca solo con las sesiones registradas
function esEstudio(habito) {
  return habito.tipo === "diario" && habito.nombre.trim().toLowerCase() === "estudio";
}

// Conjunto de fechas marcadas de un hábito diario
function fechasMarcadas(habito) {
  if (esEstudio(habito)) return fechasConSesion();
  return new Set(Object.keys(datos.marcas[habito.id] || {}));
}

// Racha actual y récord de un hábito diario.
// Los días que no son objetivo no cortan la racha (si se marcan, suman).
// Un día objetivo sin marcar corta la racha, salvo que sea hoy (todavía hay tiempo).
function rachasHabito(habito) {
  const marcadas = fechasMarcadas(habito);
  if (!marcadas.size) return { actual: 0, record: 0 };

  const objetivo = habito.diasObjetivo && habito.diasObjetivo.length ? habito.diasObjetivo : [0, 1, 2, 3, 4, 5, 6];
  const hoyTexto = hoy();
  let dia = [...marcadas].sort()[0];   // arrancamos en la primera marca
  let actual = 0;
  let record = 0;

  while (dia <= hoyTexto) {
    if (marcadas.has(dia)) {
      actual++;
      record = Math.max(record, actual);
    } else if (objetivo.includes(indiceSemana(dia)) && dia !== hoyTexto) {
      actual = 0;
    }
    dia = sumarDias(dia, 1);
  }
  return { actual, record };
}

// Para "Días sin": días transcurridos desde la fecha de inicio y récord
function infoDiasSin(habito) {
  const dias = Math.max(0, diferenciaDias(habito.inicio, hoy()));
  return { dias, record: Math.max(habito.record || 0, dias) };
}

function lunesDeSemana() {
  const base = hoy();
  return sumarDias(base, -indiceSemana(base) + semanaOffset * 7);
}

function crearHabito(evento) {
  evento.preventDefault();
  const f = evento.target;
  const msg = $("habito-msg");
  const nombre = f.nombre.value.trim();
  if (!nombre) {
    mostrarMensaje(msg, "El nombre del hábito es obligatorio.");
    return;
  }
  const tipo = f.tipo.value;
  const habito = { id: nuevoId(), nombre, tipo, icono: f.icono.value, diasObjetivo: [], inicio: null, record: 0 };

  if (tipo === "diario") {
    habito.diasObjetivo = [...f.querySelectorAll('input[name="dia"]:checked')].map(c => Number(c.value));
  } else {
    habito.inicio = fechaValida(f.inicio.value) ? f.inicio.value : hoy();
  }

  datos.habitos.push(habito);
  guardar();
  mostrarMensaje(msg, "");
  f.nombre.value = "";
  render();
}

function marcarDia(habito, fecha, marcado) {
  if (!datos.marcas[habito.id]) datos.marcas[habito.id] = {};
  if (marcado) datos.marcas[habito.id][fecha] = true;
  else delete datos.marcas[habito.id][fecha];
  guardar();
  render();
}

function reiniciarDiasSin(habito) {
  if (!confirm('¿Reiniciar "' + habito.nombre + '"? El contador vuelve a 0 desde hoy y se guarda tu récord.')) return;
  habito.record = infoDiasSin(habito).record;
  habito.inicio = hoy();
  guardar();
  render();
}

function borrarHabito(habito) {
  if (!confirm('¿Borrar el hábito "' + habito.nombre + '" y sus marcas?')) return;
  datos.habitos = datos.habitos.filter(x => x.id !== habito.id);
  delete datos.marcas[habito.id];
  guardar();
  render();
}

function renderHabitos() {
  const lunes = lunesDeSemana();
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const hoyTexto = hoy();

  // Título de la semana, ej: "27 oct – 2 nov 2026"
  const ini = leerFecha(dias[0]);
  const fin = leerFecha(dias[6]);
  $("semana-titulo").textContent = ini.getDate() + " " + MESES[ini.getMonth()] + " – " +
    fin.getDate() + " " + MESES[fin.getMonth()] + " " + fin.getFullYear();

  const contenedor = $("tabla-habitos");
  if (!datos.habitos.length) {
    contenedor.replaceChildren(h("p", { class: "vacio" }, "Todavía no creaste hábitos."));
    return;
  }

  // Encabezado: una columna por día
  const encabezado = h("tr", {},
    h("th", { class: "habito" }, "Hábito"),
    dias.map((f, i) => h("th", { class: f === hoyTexto ? "hoy" : "" },
      DIAS_CORTOS[i], h("span", { class: "habito-info" }, String(leerFecha(f).getDate()))))
  );

  // Una fila por hábito
  const filas = datos.habitos.map(hab => {
    const auto = esEstudio(hab);
    let detalle;
    if (hab.tipo === "diario") {
      const r = rachasHabito(hab);
      detalle = "🔥 " + r.actual + " · récord " + r.record + (auto ? " · automático" : "");
    } else {
      detalle = "Desde " + hab.inicio;
    }

    const celdaNombre = h("th", { class: "habito" },
      hab.icono + " " + hab.nombre,
      h("span", { class: "habito-info" }, detalle),
      h("button", { type: "button", class: "peligro chico", onclick: () => borrarHabito(hab) }, "Borrar")
    );

    // "Días sin": una sola celda ancha con el contador y el botón Reiniciar
    if (hab.tipo === "diassin") {
      const info = infoDiasSin(hab);
      return h("tr", {}, celdaNombre,
        h("td", { colSpan: 7, class: "dias-sin" },
          h("strong", {}, info.dias + (info.dias === 1 ? " día" : " días") + " sin"),
          " · Récord: " + info.record + " " + (info.record === 1 ? "día" : "días") + " ",
          h("button", { type: "button", class: "chico", onclick: () => reiniciarDiasSin(hab) }, "Reiniciar")
        )
      );
    }

    // Hábito diario: un checkbox por día
    const marcadas = fechasMarcadas(hab);
    return h("tr", {}, celdaNombre, dias.map((f, i) => {
      const esObjetivo = !hab.diasObjetivo.length || hab.diasObjetivo.includes(i);
      const clases = [f === hoyTexto ? "hoy" : "", esObjetivo ? "" : "no-objetivo"].join(" ").trim();
      return h("td", { class: clases },
        h("input", {
          type: "checkbox",
          checked: marcadas.has(f),
          disabled: auto,   // "Estudio" se marca solo
          title: auto ? "Se marca solo si hay una sesión ese día" : (esObjetivo ? "" : "No es día objetivo"),
          "aria-label": hab.nombre + " " + f,
          onchange: e => marcarDia(hab, f, e.target.checked)
        }));
    }));
  });

  // Fila de notas: una nota de texto por día
  const filaNotas = h("tr", {},
    h("th", { class: "habito" }, "📝 Nota del día"),
    dias.map(f => h("td", { class: f === hoyTexto ? "hoy" : "" },
      h("input", {
        type: "text",
        value: datos.notas[f] || "",
        "aria-label": "Nota del " + f,
        // "change" se dispara al salir del campo; guardamos sin redibujar para no perder el foco
        onchange: e => {
          const valor = e.target.value.trim();
          if (valor) datos.notas[f] = valor;
          else delete datos.notas[f];
          guardar();
        }
      })))
  );

  contenedor.replaceChildren(
    h("table", { class: "semana" }, h("thead", {}, encabezado), h("tbody", {}, filas, filaNotas))
  );
}

/* ==========================================================
   6. ACCESO CON CLAVE
   Ojo: la app es 100% del lado del navegador, así que esto es un candado
   de pantalla para quien use tu computadora, no seguridad de servidor.
   Los datos ya son privados porque viven en el localStorage de cada visitante.
   Se guarda solo un "hash" de la clave (nunca la clave) y la hora hasta la
   que el desbloqueo sigue vigente, para que el atajo de la extensión no se frene.
   ========================================================== */

const HORAS_DESBLOQUEO = 8;
const MIN_CLAVE = 6;

const aBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deBase64 = texto => Uint8Array.from(atob(texto), c => c.charCodeAt(0));

// Clave + sal -> hash, con PBKDF2 (lento a propósito para dificultar adivinar claves)
async function hashClave(clave, sal) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: 100000, hash: "SHA-256" }, material, 256);
  return aBase64(bits);
}

function mostrarApp() {
  $("bloqueo").hidden = true;
  $("app").hidden = false;
  render();   // los datos recién se dibujan cuando ya está desbloqueado
}

function mostrarBloqueo() {
  const primeraVez = !datos.acceso;
  $("app").hidden = true;
  $("bloqueo").hidden = false;
  $("acceso-ayuda").textContent = primeraVez
    ? "Creá una clave (mínimo " + MIN_CLAVE + " caracteres) para proteger tu bitácora en este navegador."
    : "Ingresá tu clave para ver tu bitácora.";
  $("acceso-repetir").hidden = !primeraVez;
  $("acceso-btn").textContent = primeraVez ? "Crear clave" : "Entrar";
  $("form-acceso").clave.focus();
}

async function enviarAcceso(evento) {
  evento.preventDefault();
  const f = evento.target;
  const msg = $("acceso-msg");
  mostrarMensaje(msg, "");

  if (!window.crypto || !crypto.subtle) {
    mostrarMensaje(msg, "Este navegador no permite crear la clave en esta dirección. Abrí la web por https o desde el archivo local.");
    return;
  }

  const clave = f.clave.value;
  const vigencia = Date.now() + HORAS_DESBLOQUEO * 3600 * 1000;

  if (!datos.acceso) {
    // Primera vez: crear la clave
    if (clave.length < MIN_CLAVE) {
      mostrarMensaje(msg, "La clave debe tener al menos " + MIN_CLAVE + " caracteres.");
      return;
    }
    if (clave !== f.clave2.value) {
      mostrarMensaje(msg, "Las dos claves no coinciden.");
      return;
    }
    const sal = crypto.getRandomValues(new Uint8Array(16));
    datos.acceso = { sal: aBase64(sal), hash: await hashClave(clave, sal), hasta: vigencia };
  } else {
    // Ya existe: comprobar la clave
    const hash = await hashClave(clave, deBase64(datos.acceso.sal));
    if (hash !== datos.acceso.hash) {
      mostrarMensaje(msg, "Clave incorrecta.");
      f.clave.value = "";
      return;
    }
    datos.acceso.hasta = vigencia;
  }

  guardar();
  f.reset();
  mostrarApp();
}

// Revisa al abrir la página si hay que pedir la clave
function controlarAcceso() {
  if (datos.acceso && Date.now() < datos.acceso.hasta) mostrarApp();
  else mostrarBloqueo();
}

function bloquear() {
  datos.acceso.hasta = 0;
  guardar();
  location.reload();   // recargar borra de la pantalla todo lo que se estaba mostrando
}

/* ==========================================================
   7. RESPALDO
   ========================================================== */

function exportar() {
  // El respaldo no incluye la clave: esa pertenece a este navegador
  const { acceso, ...sinAcceso } = datos;
  const blob = new Blob([JSON.stringify(sinAcceso, null, 2)], { type: "application/json" });
  const enlace = h("a", { href: URL.createObjectURL(blob), download: "bitacora-respaldo-" + hoy() + ".json" });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(enlace.href);
  const msg = $("respaldo-msg");
  msg.className = "mensaje ok";
  mostrarMensaje(msg, "Respaldo exportado.");
}

async function importarRespaldo(evento) {
  const archivo = evento.target.files[0];
  evento.target.value = "";   // permite volver a elegir el mismo archivo
  if (!archivo) return;

  const msg = $("respaldo-msg");
  const fallo = texto => {
    msg.className = "mensaje error";
    mostrarMensaje(msg, texto);
  };

  let crudos;
  try {
    crudos = JSON.parse(await archivo.text());
  } catch (e) {
    fallo("El archivo no es un JSON válido. No se cambió nada.");
    return;
  }
  if (!crudos || typeof crudos !== "object" || !Array.isArray(crudos.sesiones) || !Array.isArray(crudos.habitos)) {
    fallo("El archivo no parece un respaldo de la Bitácora. No se cambió nada.");
    return;
  }
  if (typeof crudos.version === "number" && crudos.version > VERSION) {
    fallo("El respaldo es de una versión más nueva de la app. No se cambió nada.");
    return;
  }
  if (!confirm("Esto REEMPLAZA todos los datos actuales con los del respaldo. ¿Continuar?")) return;

  const accesoActual = datos.acceso;   // la clave de este navegador se conserva
  datos = normalizar(crudos);
  datos.acceso = accesoActual;
  guardar();
  render();
  msg.className = "mensaje ok";
  mostrarMensaje(msg, "Respaldo restaurado: " + datos.sesiones.length + " sesiones y " + datos.habitos.length + " hábitos.");
}

/* ==========================================================
   8. ARRANQUE
   ========================================================== */

function render() {
  renderPanel();
  renderHistorial();
  renderHabitos();
}

function iniciar() {
  // Importar captura
  $("importar-btn").addEventListener("click", importarCaptura);

  // Registro manual (fecha por defecto: hoy)
  $("form-sesion").fecha.value = hoy();
  $("form-sesion").addEventListener("submit", guardarManual);

  // Historial
  $("filtro-plataforma").addEventListener("change", renderHistorial);
  $("buscador").addEventListener("input", renderHistorial);

  // Hábitos: el tipo "Días sin" muestra la fecha de inicio y oculta los días objetivo
  const formHabito = $("form-habito");
  formHabito.inicio.value = hoy();
  $("habito-tipo").addEventListener("change", e => {
    const diario = e.target.value === "diario";
    $("habito-dias").hidden = !diario;
    $("habito-inicio-label").hidden = diario;
  });
  formHabito.addEventListener("submit", crearHabito);
  $("semana-ant").addEventListener("click", () => { semanaOffset--; renderHabitos(); });
  $("semana-sig").addEventListener("click", () => { semanaOffset++; renderHabitos(); });

  // Respaldo
  $("exportar-btn").addEventListener("click", exportar);
  $("importar-respaldo-btn").addEventListener("click", () => $("respaldo-archivo").click());
  $("respaldo-archivo").addEventListener("change", importarRespaldo);

  // Clave
  $("form-acceso").addEventListener("submit", enviarAcceso);
  $("bloquear-btn").addEventListener("click", bloquear);

  controlarAcceso();   // solo dibuja los datos si ya está desbloqueado
}

iniciar();
