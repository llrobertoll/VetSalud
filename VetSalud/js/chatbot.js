/* ============================================
   chatbot.js - VetBot 🐾
   Asistente virtual de cuidado de mascotas.
   ✅ 100% gratis e ilimitado: funciona con reglas
   y base de conocimiento local (sin APIs externas).
   ============================================ */

// Si es FALSE, el bot se queda en SILENCIO ante temas ajenos a mascotas.
// Si es TRUE, muestra un aviso amable indicando que solo habla de mascotas.
const AVISAR_FUERA_DE_TEMA = false;

// Normaliza texto: minúsculas y sin tildes
function normText(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Palabras que indican que el mensaje trata sobre mascotas
const PET_WORDS = [
  'perr', 'gat', 'mascota', 'cachorr', 'felino', 'canino', 'animal',
  'loro', 'conejo', 'hamster', 'veterinari', 'croqueta', 'arenero',
  'correa', 'bozal', 'ladra', 'maulla', 'hocico', 'pelaje', 'raza',
  'vacuna', 'desparasit', 'pulga', 'garrapata', 'esteriliz', 'camada'
];

// ============================================
// BASE DE CONOCIMIENTO (temas → respuestas)
// ============================================
const KB = [
  {
    id: 'alimentacion', reqPet: true,
    keywords: ['comida', 'comer', 'alimento', 'croqueta', 'alimentar', 'dieta', 'racion', 'pienso', 'premio', 'snack'],
    perro: ' Un perro adulto come 2 veces al día con alimento balanceado según su peso y edad; los cachorros, 3-4 veces. Evita comida humana: chocolate, cebolla, uvas y ajo son tóxicos.',
    gato: '🐟 Los gatos prefieren comer varias veces al día en porciones pequeñas. Combina croquetas de calidad con alimento húmedo y siempre ten agua fresca disponible.',
    general: '🍽️ Depende de la especie: ¿es perro o gato? Usa alimento balanceado según edad y peso, y nunca le des chocolate, cebolla, uvas o ajo (son tóxicos).'
  },
  {
    id: 'vacunas', reqPet: false,
    keywords: ['vacuna', 'vacunacion', 'refuerzo', 'rabia', 'parvo', 'moquillo', 'triple'],
    perro: '💉 Calendario del perro: primera vacuna a las 6-8 semanas, refuerzos hasta las 16 semanas, y refuerzo anual (rabia, moquillo, parvovirus). ¡Agenda su vacuna aquí en VetSalud!',
    gato: '💉 Los gatos se vacunan desde las 8 semanas con la triple felina y rabia, con refuerzo anual. Si sale al exterior, pregunta por la vacuna de leucemia felina.',
    general: '💉 Las vacunas esenciales se aplican desde cachorro y se refuerzan cada año: rabia, moquillo/parvo en perros y triple felina en gatos. Te recomiendo agendar una cita de vacunación. 📅'
  },
  {
    id: 'bano', reqPet: true,
    keywords: ['bano', 'banar', 'banarlo', 'banarla', 'lavar', 'jabon', 'shampoo'],
    perro: '🛁 Baña a tu perro cada 3-4 semanas con shampoo para perros. Bañarlo muy seguido daña los aceites naturales de su piel. Sécalo bien y cepíllalo al final.',
    gato: '🐱 ¡Los gatos se asean solos! Solo báñalo si está muy sucio (máximo cada 2-3 meses), con shampoo para gatos y agua tibia.',
    general: '🛁 Perros: cada 3-4 semanas. Gatos: casi nunca, ellos se asean solos. Usa siempre shampoo para mascotas, nunca de humanos.'
  },
  {
    id: 'desparasitacion', reqPet: false,
    keywords: ['desparasit', 'parasito', 'gusano'],
    general: '💊 La desparasitación interna se recomienda cada 3 meses y la externa (pulgas y garrapatas) cada mes o según el producto. En VetSalud tenemos el servicio de desparasitación. ✅'
  },
  {
    id: 'pulgas', reqPet: false,
    keywords: ['pulga', 'garrapata', 'pica mucho', 'se rasca', 'rasca mucho'],
    general: '🐜 Si tiene pulgas o garrapatas: aplica un antiparasitario externo (pipeta, collar o tableta), lava su cama con agua caliente y desparasita internamente también. Repite según indicaciones.'
  },
  {
    id: 'ejercicio', reqPet: true,
    keywords: ['ejercicio', 'pasear', 'paseo', 'caminar', 'jugar', 'juego', 'energia'],
    perro: '🎾 Un perro necesita al menos 2 paseos al día (30-60 min en total) más juego mental. Las razas activas requieren más ejercicio para evitar ansiedad y destrozos.',
    gato: '🐱 Los gatos necesitan 15-30 minutos de juego activo al día: varitas con plumas, láser o juguetes. Esto previene obesidad y estrés.',
    general: '🏃 El ejercicio diario es clave: perros con 2+ paseos al día y gatos con sesiones de juego. Una mascota activa es una mascota sana.'
  },
  {
    id: 'sintomas', reqPet: true,
    keywords: ['vomita', 'vomito', 'diarrea', 'enfermo', 'decaido', 'no come', 'triste', 'fiebre', 'tos', 'estornuda', 'cojea'],
    general: '🚨 Si vomita, tiene diarrea, no come o está decaída por más de 24 horas, NO lo automediques: agenda una consulta en VetSalud lo antes posible. Esos síntomas pueden indicar algo serio.'
  },
  {
    id: 'emergencia', reqPet: false,
    keywords: ['emergencia', 'urgencia', 'accidente', 'veneno', 'enveneno', 'golpe', 'sangra', 'convulsion', 'no respira'],
    general: '🚨 EMERGENCIA: mantén la calma, no automediques y acude de inmediato al veterinario. En VetSalud tenemos servicio de Urgencia. Llámanos: 55 1234 5678.'
  },
  {
    id: 'toxicos', reqPet: false,
    keywords: ['toxico', 'chocolate', 'uva', 'pasas', 'cebolla', 'ajo', 'aguacate', 'cafe', 'alcohol', 'xilitol'],
    general: '☠️ Alimentos TÓXICOS para perros y gatos: chocolate, uvas/pasas, cebolla, ajo, aguacate, café, alcohol, xilitol y huesos cocidos. Si ingirió alguno, acude al veterinario de inmediato.'
  },
  {
    id: 'esterilizacion', reqPet: false,
    keywords: ['esteriliz', 'castrar', 'operar', 'operacion'],
    general: '✂️ La esterilización se recomienda entre los 6 y 12 meses. Previene tumores e infecciones, reduce conductas no deseadas y evita camadas no planeadas. Consulta el mejor momento en una consulta.'
  },
  {
    id: 'celo', reqPet: false,
    keywords: ['celo', 'cruzar', 'reproduc', 'embaraz', 'crias'],
    general: '❤️ Las perras entran en celo cada 6-8 meses aprox.; las gatas tienen varios celos al año. Si no buscas crías, considera la esterilización por su salud y bienestar.'
  },
  {
    id: 'pelo', reqPet: true,
    keywords: ['cepill', 'pelo', 'pelaje', 'muda', 'nudos', 'peinar', 'cae el pelo'],
    general: '✨ Cepíllalo 2-3 veces por semana (diario en pelo largo). Reduce la muda, evita nudos y te ayuda a detectar pulgas o problemas de piel a tiempo.'
  },
  {
    id: 'unas', reqPet: true,
    keywords: ['cortar las unas', 'cortarle las unas', 'unas largas', 'unas de mi'],
    general: '✂️ Corta sus uñas cada 3-4 semanas con cortauñas para mascotas, evitando la parte rosada. Si escuchas "clic-clic" al caminar, es señal de que las tiene largas.'
  },
  {
    id: 'dientes', reqPet: true,
    keywords: ['diente', 'dientes', 'sarro', 'mal aliento', 'boca'],
    general: '🦷 Cepilla sus dientes 2-3 veces por semana con pasta para mascotas (nunca de humanos). El mal aliento puede indicar sarro o enfermedad dental: agenda una revisión.'
  },
  {
    id: 'oidos', reqPet: true,
    keywords: ['oreja', 'orejas', 'oido', 'otitis'],
    general: '👂 Revisa sus oídos cada semana. Si hay mal olor, enrojecimiento o sacude mucho la cabeza, puede ser otitis: acude al veterinario. Limpia solo la parte externa.'
  },
  {
    id: 'cachorro', reqPet: false,
    keywords: ['cachorro', 'recien nacido', 'bebe', 'adoptar', 'adopcion', 'nuevo integrante'],
    general: '🎉 ¡Felicidades por tu nuevo integrante! Prioridades: primera vacuna (6-8 semanas), desparasitación, alimento para cachorro/gatito y visita al veterinario. Socialízalo con cariño desde pequeño.'
  },
  {
    id: 'peso', reqPet: true,
    keywords: ['gordo', 'obesidad', 'sobrepeso', 'adelgazar', 'bajar de peso'],
    general: '⚖️ Si tiene sobrepeso: controla porciones, evita premios en exceso y aumenta el ejercicio diario. La obesidad causa diabetes y problemas articulares. Pide una consulta nutricional.'
  },
  {
    id: 'estres', reqPet: true,
    keywords: ['estres', 'ansiedad', 'muerde', 'ladra mucho', 'maulla mucho', 'destruye', 'se esconde', 'comportamiento'],
    general: '🧠 El estrés se nota en lamidos excesivos, destrozos o esconderse. Dale rutina, ejercicio, juguetes interactivos y un espacio seguro. Si persiste, consulta al veterinario.'
  },
  {
    id: 'chequeo', reqPet: true,
    keywords: ['chequeo', 'revision', 'cuando llevar', 'cada cuanto llevar', 'consulta general'],
    general: '📅 Se recomienda un chequeo general al menos 1 vez al año (2 veces en mascotas senior +7 años). Puedes agendar tu Consulta General desde la app de VetSalud.'
  },
  {
    id: 'agua', reqPet: true,
    keywords: ['agua', 'hidrat', 'bebe agua'],
    general: '💧 Siempre debe tener agua fresca y limpia. Un perro bebe aprox. 50-60 ml por kg al día; en gatos, fomenta el consumo con fuentes o alimento húmedo para cuidar sus riñones.'
  }
];

// ============================================
// CEREBRO DEL BOT
// ============================================

function detectAnimal(msg) {
  if (msg.includes('gat')) return 'gato';
  if (msg.includes('perr') || msg.includes('canino')) return 'perro';
  return null;
}

function botReply(raw) {
  const msg = normText(raw);

  // ---- Charla básica ----
  if (/(hola|buenos dias|buenas tardes|buenas noches|hey|saludos)/.test(msg) && msg.length < 30) {
    return '¡Hola! 👋 Soy VetBot, tu asistente de cuidado de mascotas. Pregúntame sobre alimentación, vacunas, baño, ejercicio o salud de tu perro o gato. 🐾';
  }
  if (msg.includes('como estas')) {
    return '¡Muy bien, gracias por preguntar! 😊 Listo para ayudarte con el cuidado de tu mascota. ¿Qué quieres saber?';
  }
  if (msg.includes('gracias')) {
    return '¡Con mucho gusto! 🐾 Si tienes otra duda sobre tu mascota, aquí estaré.';
  }
  if (/(adios|bye|chao|hasta luego|hasta pronto)/.test(msg)) {
    return '¡Hasta pronto! 👋 Dale muchos cariños a tu mascota de mi parte. 🐶🐱';
  }
  if (msg.includes('quien eres') || msg.includes('que eres') || msg.includes('que puedes hacer') || msg.includes('ayuda')) {
    return '🤖 Soy VetBot, un asistente virtual especializado en el cuidado de perros y gatos. Puedo orientarte sobre alimentación, vacunas, baño, desparasitación, ejercicio, higiene y señales de alerta. Solo respondo temas de mascotas. 🐾';
  }

  // ---- ¿Tema de mascotas? ----
  const petContext = PET_WORDS.some(w => msg.includes(w));

  // ---- Buscar el tema con mejor puntuación ----
  let best = null, bestScore = 0;
  for (const t of KB) {
    let s = 0;
    for (const k of t.keywords) {
      if (msg.includes(k)) s += k.length; // palabras largas pesan más
    }
    if (s > 0 && (!t.reqPet || petContext) && s > bestScore) {
      bestScore = s;
      best = t;
    }
  }

  if (best) {
    const animal = detectAnimal(msg);
    return (animal && best[animal]) ? best[animal] : (best.general || best.perro);
  }

  // ---- Habla de mascotas pero no detecto el tema ----
  if (petContext) {
    return '🐾 Puedo ayudarte con temas como: alimentación, vacunas, baño, desparasitación, pulgas, ejercicio, higiene, peso, estrés y señales de alerta. ¿Sobre qué quieres saber?';
  }

  // ---- Tema AJENO a mascotas ----
  if (AVISAR_FUERA_DE_TEMA) {
    return '🐾 Lo siento, solo respondo preguntas sobre el cuidado de mascotas.';
  }
  return null; // 🔇 Silencio total (como se pidió)
}

// ============================================
// INTERFAZ DEL CHAT
// ============================================

let chatStarted = false;

function toggleChat() {
  const w = $('#chat-window');
  const open = w.classList.toggle('open');
  if (open && !chatStarted) {
    chatStarted = true;
    addMsg('¡Hola! 👋 Soy VetBot 🐾, el asistente de VetSalud. Pregúntame lo que quieras sobre el cuidado de tu perro o gato.', 'bot');
    renderSugs();
  }
}

function addMsg(text, who) {
  const body = $('#chat-body');
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text; // textContent = seguro contra XSS
  body.appendChild(d);
  body.scrollTop = body.scrollHeight;
}

function showTyping() {
  const body = $('#chat-body');
  const d = document.createElement('div');
  d.className = 'msg bot typing';
  d.id = 'typing';
  d.textContent = 'VetBot está escribiendo…';
  body.appendChild(d);
  body.scrollTop = body.scrollHeight;
}

function hideTyping() {
  const t = $('#typing');
  if (t) t.remove();
}

function sendChat() {
  const input = $('#chat-text');
  const txt = input.value.trim();
  if (!txt) return;

  addMsg(txt, 'user');
  input.value = '';

  showTyping();
  setTimeout(() => {
    hideTyping();
    const reply = botReply(txt);
    if (reply) addMsg(reply, 'bot'); // si es null → silencio
  }, 600 + Math.random() * 700);
}

// Sugerencias rápidas
const SUGS = [
  '¿Cada cuánto baño a mi perro?',
  '¿Qué vacunas necesita mi gato?',
  'Alimentos tóxicos',
  '¿Cada cuánto lo desparasito?'
];

function renderSugs() {
  $('#chat-sugs').innerHTML = SUGS.map(s =>
    '<button class="sug" onclick="askSug(\'' + s + '\')">' + s + '</button>'
  ).join('');
}

function askSug(s) {
  $('#chat-text').value = s;
  sendChat();
}