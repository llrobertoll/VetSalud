/* ============================================
   auth.js - Login, registro y sesión
   ============================================ */

function login() {
  const emailInput = $('#lg-email').value.trim().toLowerCase();
  const passInput = $('#lg-pass').value;

  // Validación de campos vacíos
  if (!emailInput || !passInput) {
    toast('Por favor completa todos los campos');
    return;
  }

  // Validación de email
  if (!isValidEmail(emailInput)) {
    toast('Formato de correo inválido');
    return;
  }

  // 🔒 VALIDACIÓN DE LONGITUD DE CONTRASEÑA
  if (passInput.length > 100) {
    toast('La contraseña es demasiado larga');
    return;
  }

  if (passInput.length < 1) {
    toast('Ingresa tu contraseña');
    return;
  }

  // Proteger contra fuerza bruta simple:
  // Si hay muchos intentos fallidos, podría bloquearse (demo simple)
  const hashedPass = simpleHash(passInput);
  const user = db.users.find(u => 
    u.email.toLowerCase() === emailInput && 
    u.password === hashedPass
  );

  if (!user) {
    toast('Correo o contraseña incorrectos');
    return;
  }

  setSession(user.id);
  toast('¡Bienvenido, ' + escapeHTML(user.nombre.split(' ')[0]) + '!');
  user.rol === 'admin' ? go('adminDashboard') : go('home');
}

function logout() {
  if (confirm('¿Cerrar sesión?')) {
    setSession(null);
    go('login');
  }
}

function registerClient() {
  const nombre = $('#rg-nombre').value.trim();
  const tel = $('#rg-tel').value.trim();
  const email = $('#rg-email').value.trim();
  const pass = $('#rg-pass').value;
  const pass2 = $('#rg-pass2').value;
  const dir = $('#rg-dir').value.trim();

  // Validaciones
  if (!nombre || !email || !pass) {
    toast('Completa nombre, correo y contraseña');
    return;
  }

  if (nombre.length > 60) {
    toast('El nombre es demasiado largo');
    return;
  }

  if (!isValidEmail(email)) {
    toast('Correo no válido');
    return;
  }

  if (!isValidPassword(pass)) {
    toast('La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número');
    return;
  }

  if (pass !== pass2) {
    toast('Las contraseñas no coinciden');
    return;
  }

  if (tel && !isValidPhone(tel)) {
    toast('Teléfono no válido');
    return;
  }

  if (dir.length > 150) {
    toast('La dirección es demasiado larga');
    return;
  }

  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    toast('Este correo ya está registrado');
    return;
  }

  const preg = $('#rg-pregunta').value.trim();
  const resp = $('#rg-respuesta').value.trim();

  if (!preg || !resp) {
    toast('Configura tu pregunta y respuesta de seguridad');
    return;
  }
  if (preg.length < 5 || preg.length > 100) {
    toast('La pregunta debe tener entre 5 y 100 caracteres');
    return;
  }
  if (resp.length < 2 || resp.length > 60) {
    toast('La respuesta debe tener entre 2 y 60 caracteres');
    return;
  }

  const newUser = {
    id: uid(),
    nombre: sanitize(nombre, 60),
    telefono: sanitize(tel, 20),
    email: email.toLowerCase(),
    password: simpleHash(pass),
    direccion: sanitize(dir, 150),
    rol: 'cliente',
    pregunta: sanitize(preg, 100),
    respuesta: simpleHash(normalizeAnswer(resp))
  };

  db.users.push(newUser);
  saveDB();
  setSession(newUser.id);
  toast('Cuenta creada con éxito');
  go('home');
}

/* ============================================
   🔑 RECUPERACIÓN DE CONTRASEÑA (3 pasos)
   ============================================ */

function resetRecuperar() {
  rec.userId = null;
  rec.intentos = 0;
  ['rec-email', 'rec-respuesta', 'rec-pass1', 'rec-pass2'].forEach(i => $('#' + i).value = '');
  showRecStep(1);
}

function showRecStep(n) {
  [1, 2, 3].forEach(i => {
    $('#rec-step' + i).style.display = (i === n) ? 'block' : 'none';
    $('#rec-dot' + i).classList.toggle('on', i <= n);
  });
}

// PASO 1: buscar cuenta por correo o usuario
function recStep1() {
  const q = $('#rec-email').value.trim().toLowerCase();

  if (!q) { toast('Escribe tu correo o usuario'); return; }
  if (q.length > 80) { toast('Texto demasiado largo'); return; }

  let user;
  if (q.includes('@')) {
    user = db.users.find(u => u.email.toLowerCase() === q);       // búsqueda por correo
  } else if (q.length >= 3) {
    user = db.users.find(u => u.nombre.toLowerCase().includes(q)); // búsqueda por nombre
  }

  // ❌ No existe en la base de datos
  if (!user) {
    toast('❌ No se encontró ninguna cuenta con esos datos');
    return;
  }

  if (!user.pregunta || !user.respuesta) {
    toast('Esta cuenta no tiene pregunta de seguridad configurada');
    return;
  }

  // ✅ Existe → mostrar SU pregunta
  rec.userId = user.id;
  rec.intentos = 0;
  $('#rec-pregunta-text').textContent = user.pregunta;
  $('#rec-respuesta').value = '';
  showRecStep(2);
}

// PASO 2: verificar respuesta (máx. 3 intentos)
function recStep2() {
  const ans = $('#rec-respuesta').value;
  if (!ans.trim()) { toast('Escribe la respuesta'); return; }

  const u = db.users.find(x => x.id === rec.userId);
  if (!u) { resetRecuperar(); return; }

  if (simpleHash(normalizeAnswer(ans)) !== u.respuesta) {
    rec.intentos++;
    if (rec.intentos >= 3) {
      toast('❌ Demasiados intentos. Vuelve a empezar.');
      rec.userId = null;
      showRecStep(1);
    } else {
      toast('❌ Respuesta incorrecta (intento ' + rec.intentos + ' de 3)');
    }
    return;
  }

  // ✅ Respuesta correcta
  $('#rec-pass1').value = '';
  $('#rec-pass2').value = '';
  showRecStep(3);
}

// PASO 3: guardar nueva contraseña
function recStep3() {
  const p1 = $('#rec-pass1').value;
  const p2 = $('#rec-pass2').value;

  if (!isValidPassword(p1)) {
    toast('Mínimo 8 caracteres, una mayúscula y un número');
    return;
  }
  if (p1 !== p2) { toast('Las contraseñas no coinciden'); return; }

  const u = db.users.find(x => x.id === rec.userId);
  if (!u) { go('login'); return; }

  u.password = simpleHash(p1);
  saveDB();
  rec.userId = null;
  toast('✅ Contraseña restablecida. Inicia sesión.');
  go('login');
}

/* ============================================
   🛡️ EDITAR PREGUNTA DE SEGURIDAD
   (requiere contraseña actual)
   ============================================ */

function saveSecurityQuestion(passId, pregId, respId) {
  const u = currentUser();
  if (!u) return;

  const pass = $('#' + passId).value;
  const preg = $('#' + pregId).value.trim();
  const resp = $('#' + respId).value.trim();

  // 🔒 1. Exigir contraseña actual
  if (!pass) {
    toast('Ingresa tu contraseña actual para continuar');
    return;
  }
  if (simpleHash(pass) !== u.password) {
    toast('❌ Contraseña actual incorrecta');
    $('#' + passId).value = '';
    $('#' + passId).classList.add('error');
    setTimeout(() => $('#' + passId).classList.remove('error'), 2000);
    return;
  }

  // 2. Validar pregunta y respuesta
  if (preg.length < 5) { toast('La pregunta debe tener al menos 5 caracteres'); return; }
  if (preg.length > 100) { toast('Pregunta demasiado larga'); return; }
  if (resp.length < 2) { toast('La respuesta debe tener al menos 2 caracteres'); return; }
  if (resp.length > 60) { toast('Respuesta demasiado larga'); return; }

  // 3. Guardar
  u.pregunta = sanitize(preg, 100);
  u.respuesta = simpleHash(normalizeAnswer(resp));
  saveDB();

  [passId, pregId, respId].forEach(i => $('#' + i).value = '');
  toast('✅ Pregunta de seguridad actualizada');
}