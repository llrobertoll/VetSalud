/* ============================================
   db.js - Capa de datos, validación y seguridad
   ============================================ */

// Constantes del dominio
const SERVICIOS = ['Consulta General', 'Vacuna', 'Baño y Corte', 'Desparasitación', 'Urgencia'];
const VETS = ['Dra. Mariana López', 'Dr. Carlos Ruiz', 'Dra. Sofía Herrera'];
const SLOTS = [];
for (let h = 9; h <= 18; h++) {
  SLOTS.push(String(h).padStart(2, '0') + ':00');
  if (h < 18) SLOTS.push(String(h).padStart(2, '0') + ':30');
}

const CAP = {
  proximas: 'Próximas',
  confirmadas: 'Confirmadas',
  pendientes: 'Pendientes',
  historial: 'Historial',
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada'
};

const cap = (k) => CAP[k] || k;

// Utilidades DOM
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// Generador de IDs únicos
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// Utilidades de fecha
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function off(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const fmtFecha = (iso) => {
  const [a, m, d] = iso.split('-');
  return d + '/' + m + '/' + a;
};

const fmtFechaLong = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const fmtHora = (h) => {
  const [H, M] = h.split(':').map(Number);
  return (H % 12 || 12) + ':' + String(M).padStart(2, '0') + ' ' + (H < 12 ? 'a.m.' : 'p.m.');
};

// Preguntas sugeridas para seguridad
const PREGUNTAS_SEGURIDAD = [
  '¿Cómo se llama tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo de la infancia?',
  '¿Cuál era tu comida favorita de niño?',
  '¿Cómo se llamaba tu primera escuela?'
];

// Estado del flujo de recuperación
const rec = { userId: null, intentos: 0 };

/**
 * Normaliza respuestas: minúsculas, sin tildes ni espacios extra.
 * Así "Firulais", "firulais" y "Firuláis" cuentan igual.
 */
function normalizeAnswer(str) {
  return (str || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================
// SEGURIDAD - Sanitización y validaciones
// ============================================

/**
 * Escapa caracteres HTML peligrosos para prevenir XSS
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Limpia un texto: trim + longitud máxima + escape
 */
function sanitize(text, maxLength = 100) {
  if (!text) return '';
  return escapeHTML(text.trim().slice(0, maxLength));
}

/**
 * Valida formato de email
 */
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email.trim()) && email.length <= 80;
}

/**
 * Valida teléfono (admite espacios, guiones, paréntesis, +)
 */
function isValidPhone(phone) {
  if (!phone) return true; // Opcional en algunos casos
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Valida contraseña fuerte
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos un número
 */
function isValidPassword(pass) {
  if (!pass || pass.length < 8) return false;
  if (pass.length > 100) return false;
  if (!/[A-ZÁÉÍÓÚÑ]/.test(pass)) return false;
  if (!/[0-9]/.test(pass)) return false;
  return true;
}

/**
 * Valida que un número esté en un rango
 */
function isValidNumber(value, min, max) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Hashea contraseña simple (para demo - en producción usar bcrypt en backend)
 */
function simpleHash(str) {
  // Nota: esto NO es seguro para producción real.
  // Es solo para no guardar contraseñas en texto plano en localStorage.
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

// ============================================
// BASE DE DATOS
// ============================================

let db = { users: [], pets: [], citas: [] };
let session = null;
let current = 'splash';

const ui = {
  tab: 'proximas',
  reprogramId: null,
  detId: null,
  editPetId: null,
  tmpFoto: '',
  adminPage: 1,
  adminFilter: 'todos',
  adminSearch: '',
  hiPet: 'all'
};

const STORAGE_KEY = 'vs_db_v3';
const SESSION_KEY = 'vs_session_v3';

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Error guardando DB:', e);
    toast('Error al guardar los datos');
  }
}

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      db = JSON.parse(raw);
    } catch (e) {
      seed();
      saveDB();
    }
  } else {
    seed();
    saveDB();
  }
  session = localStorage.getItem(SESSION_KEY) || null;
    // ✨ Si la sesión apunta a un usuario que ya no existe, limpiarla
  if (session && !currentUser()) setSession(null);
}

function setSession(id) {
  session = id;
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

const currentUser = () => db.users.find(u => u.id === session);

// ============================================
// DATOS SEMILLA
// ============================================

function seed() {
  const t = todayISO();

  db.users = [
    { id: 'admin', nombre: 'Administrador VetSalud', email: 'admin@vetsalud.com', password: simpleHash('Admin123'), rol: 'admin' },
    { id: 'u1', nombre: 'Ana Martínez', email: 'ana@email.com', password: simpleHash('Ana12345'), telefono: '561 234 5678', direccion: 'Calle Falsa 123, Col. Centro, CDMX', rol: 'cliente' },
    { id: 'u2', nombre: 'Carlos López', email: 'carlos@email.com', password: simpleHash('Carlos12'), telefono: '55 1111 2222', direccion: 'Av. Reforma 45, CDMX', rol: 'cliente' },
    { id: 'u3', nombre: 'María Gómez', email: 'maria@email.com', password: simpleHash('Maria123'), telefono: '55 3333 4444', direccion: 'Calle Roble 8, CDMX', rol: 'cliente' },
    { id: 'u4', nombre: 'Juan Pérez', email: 'juan@email.com', password: simpleHash('Juan1234'), telefono: '55 5555 6666', direccion: 'Calle Sauce 21, CDMX', rol: 'cliente' },
    { id: 'u5', nombre: 'Laura Torres', email: 'laura@email.com', password: simpleHash('Laura123'), telefono: '55 7777 8888', direccion: 'Av. Universidad 300, CDMX', rol: 'cliente' }
  ];

  db.pets = [
    { id: 'p1', owner: 'u1', nombre: 'Luna', especie: 'Perro', raza: 'Golden Retriever', edad: '4 años', peso: '22', sexo: 'Hembra', vacunas: 'Rabia, Moquillo, Parvovirus', historial: 'Alergia leve a ciertos alimentos.', foto: '' },
    { id: 'p2', owner: 'u1', nombre: 'Max', especie: 'Gato', raza: 'Europeo', edad: '3 años', peso: '4', sexo: 'Macho', vacunas: 'Rabia, Triple felina', historial: '', foto: '' },
    { id: 'p3', owner: 'u2', nombre: 'Max', especie: 'Perro', raza: 'Beagle', edad: '2 años', peso: '12', sexo: 'Macho', vacunas: 'Rabia', historial: '', foto: '' },
    { id: 'p4', owner: 'u3', nombre: 'Milo', especie: 'Perro', raza: 'Bulldog Francés', edad: '5 años', peso: '11', sexo: 'Macho', vacunas: 'Rabia, Parvovirus', historial: '', foto: '' },
    { id: 'p5', owner: 'u4', nombre: 'Rocky', especie: 'Perro', raza: 'Mestizo', edad: '6 años', peso: '18', sexo: 'Macho', vacunas: 'Rabia', historial: '', foto: '' },
    { id: 'p6', owner: 'u5', nombre: 'Kira', especie: 'Gato', raza: 'Siamesa', edad: '2 años', peso: '3', sexo: 'Hembra', vacunas: 'Triple felina', historial: '', foto: '' }
  ];

  db.citas = [
    { id: 'c1', petId: 'p1', servicio: 'Consulta General', fecha: t, hora: '09:00', veterinario: 'Dra. Mariana López', notas: '', estado: 'confirmada', diagnostico: '', tratamiento: '' },
    { id: 'c2', petId: 'p3', servicio: 'Vacuna', fecha: t, hora: '10:00', veterinario: 'Dr. Carlos Ruiz', notas: '', estado: 'pendiente', diagnostico: '', tratamiento: '' },
    { id: 'c3', petId: 'p4', servicio: 'Consulta General', fecha: t, hora: '11:30', veterinario: 'Dra. Mariana López', notas: '', estado: 'confirmada', diagnostico: '', tratamiento: '' },
    { id: 'c4', petId: 'p5', servicio: 'Consulta General', fecha: t, hora: '13:00', veterinario: 'Dra. Sofía Herrera', notas: '', estado: 'pendiente', diagnostico: '', tratamiento: '' },
    { id: 'c5', petId: 'p6', servicio: 'Baño y Corte', fecha: t, hora: '17:30', veterinario: '', notas: '', estado: 'cancelada', diagnostico: '', tratamiento: '' },
    { id: 'c6', petId: 'p1', servicio: 'Consulta General', fecha: off(3), hora: '10:00', veterinario: 'Dra. Mariana López', notas: 'Revisión general.', estado: 'confirmada', diagnostico: '', tratamiento: '' },
    { id: 'c7', petId: 'p2', servicio: 'Vacuna', fecha: off(6), hora: '11:30', veterinario: 'Dr. Carlos Ruiz', notas: '', estado: 'pendiente', diagnostico: '', tratamiento: '' },
    { id: 'c8', petId: 'p4', servicio: 'Consulta General', fecha: off(12), hora: '09:00', veterinario: '', notas: '', estado: 'confirmada', diagnostico: '', tratamiento: '' },
    { id: 'c9', petId: 'p1', servicio: 'Vacuna', fecha: off(-15), hora: '10:30', veterinario: 'Dra. Mariana López', notas: '', estado: 'cancelada', diagnostico: '', tratamiento: '' },
    { id: 'c10', petId: 'p2', servicio: 'Vacuna', fecha: off(-65), hora: '10:00', veterinario: 'Dr. Carlos Ruiz', notas: '', estado: 'finalizada', diagnostico: 'Vacunación anual', tratamiento: 'Vacuna múltiple' },
    { id: 'c11', petId: 'p1', servicio: 'Consulta General', fecha: off(-95), hora: '12:00', veterinario: 'Dra. Mariana López', notas: '', estado: 'finalizada', diagnostico: 'Salud óptima', tratamiento: 'Ninguno' },
    { id: 'c12', petId: 'p1', servicio: 'Consulta General', fecha: off(-140), hora: '09:30', veterinario: 'Dra. Sofía Herrera', notas: '', estado: 'finalizada', diagnostico: 'Revisión rutinaria', tratamiento: 'Desparasitación' }
  ];

  db.users = [
    { id: 'admin', nombre: 'Administrador VetSalud', email: 'admin@vetsalud.com',
      password: simpleHash('Admin123'), rol: 'admin',
      pregunta: '¿Cómo se llama tu primera mascota?',
     respuesta: simpleHash(normalizeAnswer('Firulais')) },

    { id: 'u1', nombre: 'Ana Martínez', email: 'ana@email.com',
      password: simpleHash('Ana12345'), telefono: '561 234 5678',
     direccion: 'Calle Falsa 123, Col. Centro, CDMX', rol: 'cliente',
     pregunta: '¿En qué ciudad naciste?',
     respuesta: simpleHash(normalizeAnswer('Guadalajara')) },

    { id: 'u2', nombre: 'Carlos López', email: 'carlos@email.com',
      password: simpleHash('Carlos12'), telefono: '55 1111 2222',
      direccion: 'Av. Reforma 45, CDMX', rol: 'cliente',
      pregunta: '¿Cuál es el nombre de tu mejor amigo de la infancia?',
      respuesta: simpleHash(normalizeAnswer('Pedro')) },

    { id: 'u3', nombre: 'María Gómez', email: 'maria@email.com',
      password: simpleHash('Maria123'), telefono: '55 3333 4444',
      direccion: 'Calle Roble 8, CDMX', rol: 'cliente',
      pregunta: '¿Cuál era tu comida favorita de niño?',
      respuesta: simpleHash(normalizeAnswer('Sopa de fideo')) },

    { id: 'u4', nombre: 'Juan Pérez', email: 'juan@email.com',
      password: simpleHash('Juan1234'), telefono: '55 5555 6666',
      direccion: 'Calle Sauce 21, CDMX', rol: 'cliente',
      pregunta: '¿Cómo se llamaba tu primera escuela?',
      respuesta: simpleHash(normalizeAnswer('Benito Juárez')) },

    { id: 'u5', nombre: 'Laura Torres', email: 'laura@email.com',
      password: simpleHash('Laura123'), telefono: '55 7777 8888',
      direccion: 'Av. Universidad 300, CDMX', rol: 'cliente',
      pregunta: '¿Cómo se llama tu primera mascota?',
      respuesta: simpleHash(normalizeAnswer('Misifú')) }
  ];
}