/* ============================================
   admin.js - Panel administrativo
   ============================================ */

function renderAdminDash() {
  const t = todayISO();
  const dia = db.citas.filter(c => c.fecha === t && c.estado !== 'cancelada')
    .sort((a, b) => a.hora.localeCompare(b.hora));

  $('#ad-dia').textContent = dia.length;
  $('#ad-pend').textContent = db.citas.filter(c => c.estado === 'pendiente').length;
  $('#ad-cli').textContent = db.users.filter(u => u.rol === 'cliente').length;
  $('#ad-mas').textContent = db.pets.length;

  $('#ad-list').innerHTML = dia.map(c => {
    const p = db.pets.find(x => x.id === c.petId) || { nombre: '—' };
    return '<div class="list-item" style="cursor:default">' +
      '<div class="li-main"><div class="li-title">' + fmtHora(c.hora) + ' · ' + escapeHTML(p.nombre) + '</div>' +
      '<div class="li-sub">' + escapeHTML(c.servicio) + '</div></div>' +
      '<span class="chip ' + c.estado + '">' + cap(c.estado) + '</span></div>';
  }).join('') || '<p class="empty">Sin citas hoy.</p>';
}

function actionBtns(c) {
  let b = '<div class="acts">';

  if (c.estado === 'pendiente') {
    b += '<button class="icon-btn ok" title="Confirmar" onclick="adminSetEstado(\'' + c.id + '\',\'confirmada\')">✓</button>';
  }
  if (c.estado === 'confirmada') {
    b += '<button class="icon-btn ok" title="Finalizar" onclick="adminSetEstado(\'' + c.id + '\',\'finalizada\')">✔</button>';
  }
  if (c.estado !== 'cancelada' && c.estado !== 'finalizada') {
    b += '<button class="icon-btn bad" title="Cancelar" onclick="adminSetEstado(\'' + c.id + '\',\'cancelada\')">✕</button>';
  }

  b += '<button class="icon-btn bad" title="Eliminar" onclick="adminDelCita(\'' + c.id + '\')">🗑</button></div>';
  return b;
}

function renderAdminCitas() {
  const q = sanitize(ui.adminSearch, 50).toLowerCase();
  let list = db.citas.filter(c => {
    const p = db.pets.find(x => x.id === c.petId);
    const o = p && db.users.find(u => u.id === p.owner);
    const txt = ((p ? p.nombre : '') + ' ' + (o ? o.nombre : '')).toLowerCase();
    return (!q || txt.includes(q)) && (ui.adminFilter === 'todos' || c.estado === ui.adminFilter);
  });

  list.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));

  const per = 5;
  const pages = Math.max(1, Math.ceil(list.length / per));
  if (ui.adminPage > pages) ui.adminPage = pages;

  const slice = list.slice((ui.adminPage - 1) * per, ui.adminPage * per);

  $('#ac-body').innerHTML = slice.map(c => {
    const p = db.pets.find(x => x.id === c.petId) || { nombre: '—', owner: null };
    const o = db.users.find(u => u.id === p.owner) || { nombre: '—' };
    return '<tr>' +
      '<td>' + escapeHTML(o.nombre) + '</td>' +
      '<td>' + escapeHTML(p.nombre) + '</td>' +
      '<td>' + fmtFecha(c.fecha) + '</td>' +
      '<td>' + fmtHora(c.hora) + '</td>' +
      '<td><span class="chip ' + c.estado + '">' + cap(c.estado) + '</span></td>' +
      '<td>' + actionBtns(c) + '</td></tr>';
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px">Sin resultados.</td></tr>';

  let pg = '';
  for (let i = 1; i <= pages; i++) {
    pg += '<button class="page-btn ' + (i === ui.adminPage ? 'active' : '') + '" onclick="changePage(' + i + ')">' + i + '</button>';
  }
  $('#ac-pages').innerHTML = pg;
}

function acSearch(v) {
  ui.adminSearch = v;
  ui.adminPage = 1;
  renderAdminCitas();
}

function acFilter(v) {
  ui.adminFilter = v;
  ui.adminPage = 1;
  renderAdminCitas();
}

function changePage(i) {
  ui.adminPage = i;
  renderAdminCitas();
}

function adminSetEstado(id, est) {
  const validStates = ['pendiente', 'confirmada', 'finalizada', 'cancelada'];
  if (!validStates.includes(est)) return;

  const c = db.citas.find(x => x.id === id);
  if (!c) return;

  c.estado = est;
  saveDB();
  toast('Cita marcada: ' + cap(est));

  if (current === 'adminCitas') renderAdminCitas();
  if (current === 'adminDia') renderAdminDia();
  if (current === 'adminDashboard') renderAdminDash();
}

function adminDelCita(id) {
  if (!confirm('¿Eliminar esta cita permanentemente?')) return;
  db.citas = db.citas.filter(c => c.id !== id);
  saveDB();
  toast('Cita eliminada');
  renderAdminCitas();
}

function renderAdminDia() {
  const t = todayISO();
  $('#dia-fecha').textContent = fmtFechaLong(t);

  const list = db.citas.filter(c => c.fecha === t && c.estado !== 'cancelada')
    .sort((a, b) => a.hora.localeCompare(b.hora));

  $('#dia-list').innerHTML = list.map(c => {
    const p = db.pets.find(x => x.id === c.petId) || { nombre: '—', owner: null };
    const o = db.users.find(u => u.id === p.owner) || { nombre: '' };

    let act = '';
    if (c.estado === 'pendiente') {
      act = '<button class="icon-btn ok" title="Confirmar" onclick="adminSetEstado(\'' + c.id + '\',\'confirmada\')">✓</button>';
    } else if (c.estado === 'confirmada') {
      act = '<button class="btn mini" onclick="adminSetEstado(\'' + c.id + '\',\'finalizada\')">Finalizar</button>';
    }

    return '<div class="list-item">' +
      '<div class="li-main"><div class="li-title">' + fmtHora(c.hora) + '</div>' +
      '<div class="li-sub">' + escapeHTML(p.nombre) + ' · ' + escapeHTML(o.nombre) + '</div>' +
      '<div class="li-sub">' + escapeHTML(c.servicio) + '</div></div>' +
      '<span class="chip ' + c.estado + '">' + cap(c.estado) + '</span>' + act + '</div>';
  }).join('') || '<p class="empty">No hay citas para hoy.</p>';
}

function finalizeToday() {
  const t = todayISO();
  let n = 0;

  db.citas.forEach(c => {
    if (c.fecha === t && c.estado === 'confirmada') {
      c.estado = 'finalizada';
      n++;
    }
  });

  saveDB();
  toast(n ? n + ' cita(s) finalizada(s)' : 'No hay citas confirmadas hoy');
  renderAdminDia();
}

function renderAdminClientes() {
  $('#acl-body').innerHTML = db.users.filter(u => u.rol === 'cliente').map(u => {
    const n = db.pets.filter(p => p.owner === u.id).length;
    return '<tr>' +
      '<td>' + escapeHTML(u.nombre) + '</td>' +
      '<td>' + escapeHTML(u.email) + '</td>' +
      '<td>' + (u.telefono ? escapeHTML(u.telefono) : '—') + '</td>' +
      '<td>' + n + '</td></tr>';
  }).join('');
}

function renderAdminMascotas() {
  $('#am-body').innerHTML = db.pets.map(p => {
    const o = db.users.find(u => u.id === p.owner) || { nombre: '—' };
    return '<tr>' +
      '<td>' + escapeHTML(p.nombre) + '</td>' +
      '<td>' + escapeHTML(p.especie) + '</td>' +
      '<td>' + (p.raza ? escapeHTML(p.raza) : '—') + '</td>' +
      '<td>' + escapeHTML(o.nombre) + '</td></tr>';
  }).join('');
}

function renderAdminReportes() {
  const by = (e) => db.citas.filter(c => c.estado === e).length;

  $('#rep-body').innerHTML =
    '<div class="stat"><div class="num">' + db.citas.length + '</div><small>Total citas</small></div>' +
    '<div class="stat"><div class="num" style="color:var(--blue-tx)">' + by('confirmada') + '</div><small>Confirmadas</small></div>' +
    '<div class="stat"><div class="num" style="color:var(--orange-tx)">' + by('pendiente') + '</div><small>Pendientes</small></div>' +
    '<div class="stat"><div class="num" style="color:var(--green-tx)">' + by('finalizada') + '</div><small>Finalizadas</small></div>' +
    '<div class="stat"><div class="num" style="color:var(--red-tx)">' + by('cancelada') + '</div><small>Canceladas</small></div>';
}
/* ============================================
   👤 PERFIL DEL ADMINISTRADOR
   ============================================ */

function fillAdminForm() {
  const u = currentUser();
  if (!u || u.rol !== 'admin') {
    toast('Acceso no autorizado');
    go('login');
    return;
  }

  // Datos básicos
  $('#adm-avatar').textContent = u.nombre[0].toUpperCase();
  $('#adm-name').textContent = u.nombre;
  $('#adm-email').textContent = u.email;
  $('#adm-nombre').value = u.nombre;
  $('#adm-email-input').value = u.email;

  // 🔐 Limpiar campos de contraseña (por seguridad)
  $('#adm-pass-actual').value = '';
  $('#adm-pass-nueva').value = '';
  $('#adm-pass-confirm').value = '';

  // 🛡️ Mostrar pregunta actual y limpiar campos de seguridad
  $('#adm-pregunta-hint').textContent = 'Pregunta actual: ' + (u.pregunta || 'sin configurar');
  ['adm-pass-seg', 'adm-pregunta', 'adm-respuesta'].forEach(i => $('#' + i).value = '');
}

function saveAdminProfile() {
  const u = currentUser();
  if (!u || u.rol !== 'admin') return;

  const nombre = $('#adm-nombre').value.trim();
  const email = $('#adm-email-input').value.trim();

  if (!nombre) {
    toast('El nombre es obligatorio');
    return;
  }
  if (nombre.length > 60) {
    toast('Nombre demasiado largo');
    return;
  }
  if (!isValidEmail(email)) {
    toast('Correo inválido');
    return;
  }

  // Verificar que el nuevo email no esté en uso por otro usuario
  const emailExists = db.users.some(x =>
    x.id !== u.id && x.email.toLowerCase() === email.toLowerCase()
  );
  if (emailExists) {
    toast('Ese correo ya está en uso por otro usuario');
    return;
  }

  u.nombre = sanitize(nombre, 60);
  u.email = email.toLowerCase();
  saveDB();
  toast('✅ Perfil actualizado');
  fillAdminForm();  // Refrescar vista
}

function changeAdminPassword() {
  const u = currentUser();
  if (!u || u.rol !== 'admin') {
    toast('Acceso no autorizado');
    return;
  }

  const passActual = $('#adm-pass-actual').value;
  const passNueva = $('#adm-pass-nueva').value;
  const passConfirm = $('#adm-pass-confirm').value;

  // 1. Validar campos vacíos
  if (!passActual || !passNueva || !passConfirm) {
    toast('Completa los tres campos');
    return;
  }

  // 2. Validar longitud
  if (passActual.length > 100 || passNueva.length > 100 || passConfirm.length > 100) {
    toast('La contraseña es demasiado larga');
    return;
  }

  // 3. 🔒 Verificar contraseña actual
  const hashActual = simpleHash(passActual);
  if (hashActual !== u.password) {
    toast('❌ La contraseña actual es incorrecta');
    $('#adm-pass-actual').value = '';
    $('#adm-pass-actual').classList.add('error');
    setTimeout(() => $('#adm-pass-actual').classList.remove('error'), 2000);
    return;
  }

  // 4. Validar fortaleza
  if (!isValidPassword(passNueva)) {
    toast('La nueva contraseña debe tener mínimo 8 caracteres, una mayúscula y un número');
    return;
  }

  // 5. Verificar coincidencia
  if (passNueva !== passConfirm) {
    toast('❌ Las nuevas contraseñas no coinciden');
    return;
  }

  // 6. Evitar repetir la misma
  if (passNueva === passActual) {
    toast('La nueva contraseña debe ser diferente a la actual');
    return;
  }

  // 7. Guardar
  u.password = simpleHash(passNueva);
  saveDB();

  // 8. Limpiar campos
  $('#adm-pass-actual').value = '';
  $('#adm-pass-nueva').value = '';
  $('#adm-pass-confirm').value = '';

  toast('✅ Contraseña actualizada correctamente');
}