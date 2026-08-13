/* ============================================
   cliente.js - Funciones para usuarios clientes
   ============================================ */

function renderHome() {
  const u = currentUser();
  if (!u) return;
  $('#home-hello').textContent = '¡Hola, ' + u.nombre.split(' ')[0] + '!';
  $('#home-avatar').textContent = u.nombre[0].toUpperCase();
}

function setupAgendar() {
  const u = currentUser();
  const pets = db.pets.filter(p => p.owner === u.id);

  if (!pets.length) {
    $('#ag-form').style.display = 'none';
    $('#ag-nopets').style.display = 'block';
    return;
  }

  $('#ag-form').style.display = 'block';
  $('#ag-nopets').style.display = 'none';

  $('#ag-pet').innerHTML = pets.map(p =>
    '<option value="' + p.id + '">' + escapeHTML(p.nombre) + '</option>'
  ).join('');

  $('#ag-serv').innerHTML = SERVICIOS.map(s => '<option>' + s + '</option>').join('');

  $('#ag-vet').innerHTML = '<option value="">Seleccionar…</option>' +
    VETS.map(v => '<option>' + v + '</option>').join('');

  $('#ag-hora').innerHTML = '<option value="">HH:MM</option>' +
    SLOTS.map(s => '<option value="' + s + '">' + fmtHora(s) + '</option>').join('');

  $('#ag-fecha').min = todayISO();

  if (ui.reprogramId) {
    const c = db.citas.find(x => x.id === ui.reprogramId);
    if (c) {
      $('#ag-pet').value = c.petId;
      $('#ag-serv').value = c.servicio;
      $('#ag-fecha').value = c.fecha;
      $('#ag-hora').value = c.hora;
      $('#ag-vet').value = c.veterinario || '';
      $('#ag-notas').value = c.notas || '';
    }
  } else {
    ['ag-fecha', 'ag-notas'].forEach(i => $('#' + i).value = '');
    $('#ag-hora').value = '';
    $('#ag-vet').value = '';
  }
}

function submitCita() {
  const petId = $('#ag-pet').value;
  const serv = $('#ag-serv').value;
  const fecha = $('#ag-fecha').value;
  const hora = $('#ag-hora').value;
  const vet = $('#ag-vet').value;
  const notas = sanitize($('#ag-notas').value, 500);

  // Validaciones
  if (!petId || !fecha || !hora) {
    toast('Completa mascota, fecha y hora');
    return;
  }

  if (!SERVICIOS.includes(serv)) {
    toast('Servicio inválido');
    return;
  }

  // Validar fecha no anterior a hoy
  if (fecha < todayISO()) {
    toast('No puedes agendar en fechas pasadas');
    return;
  }

  // Validar hora
  if (!SLOTS.includes(hora)) {
    toast('Hora inválida');
    return;
  }

  // Verificar que el veterinario, si se seleccionó, exista
  if (vet && !VETS.includes(vet)) {
    toast('Veterinario inválido');
    return;
  }

  let cid;

  if (ui.reprogramId) {
    const c = db.citas.find(x => x.id === ui.reprogramId);
    if (!c) {
      toast('Error al reprogramar');
      return;
    }
    Object.assign(c, { petId, servicio: serv, fecha, hora, veterinario: vet, notas });
    cid = c.id;
    ui.reprogramId = null;
    $('#conf-msg').textContent = '¡Cita reprogramada correctamente!';
  } else {
    const c = {
      id: uid(),
      petId,
      servicio: serv,
      fecha,
      hora,
      veterinario: vet,
      notas,
      estado: 'pendiente',
      diagnostico: '',
      tratamiento: ''
    };
    db.citas.push(c);
    cid = c.id;
    $('#conf-msg').textContent = '¡Cita registrada correctamente!';
  }

  saveDB();

  const c = db.citas.find(x => x.id === cid);
  const p = db.pets.find(x => x.id === c.petId);

  $('#conf-card').innerHTML = avatar(p) +
    '<div class="li-main"><div class="li-title">' + escapeHTML(p.nombre) + '</div>' +
    '<div class="li-sub">📅 ' + fmtFecha(c.fecha) + ' · 🕒 ' + fmtHora(c.hora) + '</div>' +
    '<div class="li-sub">Servicio: ' + escapeHTML(c.servicio) + '</div>' +
    '<div class="li-sub">Veterinario: ' + (c.veterinario ? escapeHTML(c.veterinario) : 'Por asignar') + '</div></div>';

  go('confirmar');
}

function renderMisCitas() {
  const u = currentUser();
  const t = todayISO();
  const mine = db.citas.filter(c => {
    const p = db.pets.find(x => x.id === c.petId);
    return p && p.owner === u.id;
  });

  let list;
  if (ui.tab === 'proximas') {
    list = mine.filter(c => c.fecha >= t && (c.estado === 'confirmada' || c.estado === 'pendiente'));
  } else if (ui.tab === 'confirmadas') {
    list = mine.filter(c => c.estado === 'confirmada');
  } else if (ui.tab === 'pendientes') {
    list = mine.filter(c => c.estado === 'pendiente');
  } else {
    list = mine.filter(c => c.estado === 'finalizada' || c.estado === 'cancelada' || c.fecha < t);
  }

  list.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  $('#mc-tabs').innerHTML = ['proximas', 'confirmadas', 'pendientes', 'historial'].map(x =>
    '<button class="tab ' + (ui.tab === x ? 'active' : '') + '" onclick="setTab(\'' + x + '\')">' + cap(x) + '</button>'
  ).join('');

  $('#mc-list').innerHTML = list.map(c => {
    const p = db.pets.find(x => x.id === c.petId) || { nombre: '—', especie: '' };
    return '<div class="list-item" onclick="openDetalle(\'' + c.id + '\')">' +
      avatar(p) +
      '<div class="li-main"><div class="li-title">' + escapeHTML(p.nombre) + '</div>' +
      '<div class="li-sub">' + escapeHTML(c.servicio) + '</div>' +
      '<div class="li-meta"><span>📅 ' + fmtFecha(c.fecha) + '</span><span>🕒 ' + fmtHora(c.hora) + '</span></div></div>' +
      '<span class="chip ' + c.estado + '">' + cap(c.estado) + '</span></div>';
  }).join('') || '<p class="empty">No hay citas en esta categoría.</p>';
}

function setTab(t) {
  ui.tab = t;
  renderMisCitas();
}

function openDetalle(id) {
  const c = db.citas.find(x => x.id === id);
  if (!c) return;

  ui.detId = id;
  const p = db.pets.find(x => x.id === c.petId) || { nombre: '—', especie: 'Perro' };

  $('#det-avatar').innerHTML = avatar(p).replace('class="li-avatar"', 'class="li-avatar" style="width:76px;height:76px;font-size:38px"');
  $('#det-name').textContent = p.nombre;
  $('#det-fecha').textContent = fmtFechaLong(c.fecha);
  $('#det-hora').textContent = fmtHora(c.hora);
  $('#det-serv').textContent = c.servicio;
  $('#det-vet').textContent = c.veterinario || 'Por asignar';
  $('#det-estado').innerHTML = '<span class="chip ' + c.estado + '">' + cap(c.estado) + '</span>';
  $('#det-notas').textContent = c.notas || '—';
  $('#det-actions').style.display = (c.estado === 'pendiente' || c.estado === 'confirmada') ? 'block' : 'none';

  go('detalle');
}

function reprogramCita() {
  ui.reprogramId = ui.detId;
  go('agendar');
}

function cancelCita() {
  const c = db.citas.find(x => x.id === ui.detId);
  if (!c) return;
  if (!confirm('¿Seguro que deseas cancelar esta cita?')) return;

  c.estado = 'cancelada';
  saveDB();
  toast('Cita cancelada');
  go('miscitas');
}

function renderPerfil() {
  const u = currentUser();
  if (!u) return;

  $('#pf-avatar').textContent = u.nombre[0].toUpperCase();
  $('#pf-name').textContent = u.nombre;
  $('#pf-email').textContent = u.email;

  const pets = db.pets.filter(p => p.owner === u.id);

  $('#pf-pets').innerHTML = pets.map(p =>
    '<div class="list-item" onclick="openEditarMascota(\'' + p.id + '\')">' +
    avatar(p) +
    '<div class="li-main"><div class="li-title">' + escapeHTML(p.nombre) + '</div>' +
    '<div class="li-sub">' + escapeHTML(p.especie) + ' · ' + escapeHTML(p.raza || '') + ' · ' + escapeHTML(p.edad || '') + '</div></div>' +
    '<span class="chev">›</span></div>'
  ).join('') || '<p class="empty">Aún no tienes mascotas registradas.</p>';
}

function openEditarMascota(id) {
  ui.editPetId = id;
  go('editarMascota');
}

function pickFoto(input) {
  const f = input.files[0];
  if (!f) return;

  // Validar tipo
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(f.type)) {
    toast('Solo se permiten imágenes PNG, JPG o WebP');
    return;
  }

  // Validar tamaño máximo 2MB
  if (f.size > 2 * 1024 * 1024) {
    toast('La imagen debe pesar menos de 2MB');
    return;
  }

  const r = new FileReader();
  r.onload = () => {
    ui.tmpFoto = r.result;
    $('#' + input.dataset.preview).innerHTML = '<img src="' + r.result + '">';
  };
  r.readAsDataURL(f);
}

function resetPetForm() {
  ui.tmpFoto = '';
  ['rm-nombre', 'rm-raza', 'rm-edad', 'rm-peso', 'rm-vacunas', 'rm-historial'].forEach(i => $('#' + i).value = '');
  $('#rm-especie').value = 'Perro';
  $('#rm-sexo').value = 'Hembra';
  $('#rm-preview').innerHTML = '🐾';
}

function saveNewPet() {
  const u = currentUser();
  const nombre = $('#rm-nombre').value.trim();

  if (!nombre) {
    toast('Escribe el nombre de tu mascota');
    return;
  }

  if (nombre.length > 40) {
    toast('El nombre es demasiado largo');
    return;
  }

  const peso = $('#rm-peso').value.trim();
  if (peso && !isValidNumber(peso, 0.1, 200)) {
    toast('El peso debe estar entre 0.1 y 200 kg');
    return;
  }

  db.pets.push({
    id: uid(),
    owner: u.id,
    nombre: sanitize(nombre, 40),
    especie: $('#rm-especie').value,
    raza: sanitize($('#rm-raza').value, 40),
    edad: sanitize($('#rm-edad').value, 20),
    peso: sanitize(peso, 6),
    sexo: $('#rm-sexo').value,
    vacunas: sanitize($('#rm-vacunas').value, 300),
    historial: sanitize($('#rm-historial').value, 500),
    foto: ui.tmpFoto || ''
  });

  saveDB();
  toast('Mascota registrada');
  go('perfil');
}

function fillPetForm() {
  const p = db.pets.find(x => x.id === ui.editPetId);
  if (!p) { go('perfil'); return; }

  ui.tmpFoto = p.foto || '';
  $('#em-nombre').value = p.nombre;
  $('#em-especie').value = p.especie;
  $('#em-raza').value = p.raza || '';
  $('#em-edad').value = p.edad || '';
  $('#em-peso').value = p.peso || '';
  $('#em-sexo').value = p.sexo || 'Hembra';
  $('#em-vacunas').value = p.vacunas || '';
  $('#em-historial').value = p.historial || '';
  $('#em-preview').innerHTML = p.foto ? '<img src="' + escapeHTML(p.foto) + '">' : '🐾';
}

function saveEditPet() {
  const p = db.pets.find(x => x.id === ui.editPetId);
  if (!p) return;

  const nombre = $('#em-nombre').value.trim();
  if (!nombre) {
    toast('El nombre es obligatorio');
    return;
  }

  const peso = $('#em-peso').value.trim();
  if (peso && !isValidNumber(peso, 0.1, 200)) {
    toast('Peso inválido');
    return;
  }

  p.nombre = sanitize(nombre, 40);
  p.especie = $('#em-especie').value;
  p.raza = sanitize($('#em-raza').value, 40);
  p.edad = sanitize($('#em-edad').value, 20);
  p.peso = sanitize(peso, 6);
  p.sexo = $('#em-sexo').value;
  p.vacunas = sanitize($('#em-vacunas').value, 300);
  p.historial = sanitize($('#em-historial').value, 500);

  if (ui.tmpFoto) p.foto = ui.tmpFoto;

  saveDB();
  toast('Mascota actualizada');
  go('perfil');
}

function deletePet() {
  if (!confirm('¿Eliminar esta mascota y todas sus citas? Esta acción no se puede deshacer.')) return;

  db.citas = db.citas.filter(c => c.petId !== ui.editPetId);
  db.pets = db.pets.filter(p => p.id !== ui.editPetId);

  saveDB();
  toast('Mascota eliminada');
  go('perfil');
}

function fillClientForm() {
  const u = currentUser();
  if (!u) return;

  $('#ec-nombre').value = u.nombre;
  $('#ec-tel').value = u.telefono || '';
  $('#ec-email').value = u.email;
  $('#ec-dir').value = u.direccion || '';
  
  // 🔐 Limpiar campos de contraseña al entrar
  $('#ec-pass-actual').value = '';
  $('#ec-pass-nueva').value = '';
  $('#ec-pass-confirm').value = '';

  // 🛡️ Mostrar pregunta actual y limpiar campos de seguridad
  $('#ec-pregunta-hint').textContent = 'Pregunta actual: ' + (u.pregunta || 'sin configurar');
  ['ec-pass-seg', 'ec-pregunta', 'ec-respuesta'].forEach(i => $('#' + i).value = '');
}

function saveClient() {
  const u = currentUser();
  if (!u) return;

  const nombre = $('#ec-nombre').value.trim();
  const tel = $('#ec-tel').value.trim();
  const email = $('#ec-email').value.trim();
  const dir = $('#ec-dir').value.trim();

  if (!nombre) {
    toast('El nombre es obligatorio');
    return;
  }

  if (!isValidEmail(email)) {
    toast('Correo inválido');
    return;
  }

  if (tel && !isValidPhone(tel)) {
    toast('Teléfono inválido');
    return;
  }

  u.nombre = sanitize(nombre, 60);
  u.telefono = sanitize(tel, 20);
  u.email = email.toLowerCase();
  u.direccion = sanitize(dir, 150);

  saveDB();
  toast('Perfil actualizado');
  go('perfil');
}

function renderHistorial() {
  const u = currentUser();
  const pets = db.pets.filter(p => p.owner === u.id);

  $('#hi-pet').innerHTML = '<option value="all">Todas las mascotas</option>' +
    pets.map(p => '<option value="' + p.id + '">' + escapeHTML(p.nombre) + '</option>').join('');

  $('#hi-pet').value = ui.hiPet;

  let list = db.citas.filter(c => {
    const p = db.pets.find(x => x.id === c.petId);
    return p && p.owner === u.id &&
      (ui.hiPet === 'all' || c.petId === ui.hiPet) &&
      (c.estado === 'finalizada' || c.fecha < todayISO());
  });

  list.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));

  $('#hi-list').innerHTML = list.map(c => {
    const p = db.pets.find(x => x.id === c.petId) || { nombre: '—' };
    return '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<strong style="font-size:.9rem">' + fmtFecha(c.fecha) + '</strong>' +
      '<span class="chip ' + c.estado + '">' + cap(c.estado) + '</span></div>' +
      '<div class="li-sub">' + escapeHTML(p.nombre) + ' · ' + escapeHTML(c.servicio) + '</div>' +
      (c.diagnostico ? '<div class="li-sub"><b>Diagnóstico:</b> ' + escapeHTML(c.diagnostico) + '</div>' : '') +
      (c.tratamiento ? '<div class="li-sub"><b>Tratamiento:</b> ' + escapeHTML(c.tratamiento) + '</div>' : '') +
      '</div>';
  }).join('') || '<p class="empty">Sin historial aún.</p>';
}

function setHiPet(v) {
  ui.hiPet = v;
  renderHistorial();
}

/* ============================================
   🔐 CAMBIO DE CONTRASEÑA
   Requiere validar la contraseña actual antes de cambiar
   ============================================ */

function changePassword() {
  const u = currentUser();
  if (!u) {
    toast('No hay sesión activa');
    return;
  }

  const passActual = $('#ec-pass-actual').value;
  const passNueva = $('#ec-pass-nueva').value;
  const passConfirm = $('#ec-pass-confirm').value;

  // 1. Validar campos no vacíos
  if (!passActual || !passNueva || !passConfirm) {
    toast('Completa los tres campos');
    return;
  }

  // 2. Validar longitud máxima
  if (passActual.length > 100 || passNueva.length > 100 || passConfirm.length > 100) {
    toast('La contraseña es demasiado larga');
    return;
  }

  // 3. 🔒 VALIDAR CONTRASEÑA ACTUAL
  const hashActual = simpleHash(passActual);
  if (hashActual !== u.password) {
    toast('Error: La contraseña actual es incorrecta');
    // Limpiar el campo de contraseña actual por seguridad
    $('#ec-pass-actual').value = '';
    $('#ec-pass-actual').classList.add('error');
    setTimeout(() => $('#ec-pass-actual').classList.remove('error'), 2000);
    return;
  }

  // 4. Validar fortaleza de la nueva contraseña
  if (!isValidPassword(passNueva)) {
    toast('La nueva contraseña debe tener mínimo 8 caracteres, una mayúscula y un número');
    return;
  }

  // 5. Verificar que coincidan
  if (passNueva !== passConfirm) {
    toast('Error: Las nuevas contraseñas no coinciden');
    return;
  }

  // 6. Evitar que la nueva sea igual a la actual
  if (passNueva === passActual) {
    toast('La nueva contraseña debe ser diferente a la actual');
    return;
  }

  // 7. Guardar la nueva contraseña hasheada
  u.password = simpleHash(passNueva);
  saveDB();

  // 8. Limpiar campos por seguridad
  $('#ec-pass-actual').value = '';
  $('#ec-pass-nueva').value = '';
  $('#ec-pass-confirm').value = '';

  toast('Contraseña actualizada correctamente');
}