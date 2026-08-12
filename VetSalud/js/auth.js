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

  const newUser = {
    id: uid(),
    nombre: sanitize(nombre, 60),
    telefono: sanitize(tel, 20),
    email: email.toLowerCase(),
    password: simpleHash(pass),
    direccion: sanitize(dir, 150),
    rol: 'cliente'
  };

  db.users.push(newUser);
  saveDB();
  setSession(newUser.id);
  toast('Cuenta creada con éxito');
  go('home');
}