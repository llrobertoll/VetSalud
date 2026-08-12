/* ============================================
   ui.js - Navegación, toast y modales
   ============================================ */

function go(id) {
  current = id;

  // Renderizados específicos
  if (id === 'home') renderHome();
  if (id === 'agendar') setupAgendar();
  if (id === 'miscitas') renderMisCitas();
  if (id === 'perfil') renderPerfil();
  if (id === 'historial') renderHistorial();
  if (id === 'editarCliente') fillClientForm();
  if (id === 'registrarMascota') resetPetForm();
  if (id === 'editarMascota') fillPetForm();
  if (id === 'adminDashboard') renderAdminDash();
  if (id === 'adminCitas') renderAdminCitas();
  if (id === 'adminDia') renderAdminDia();
  if (id === 'adminClientes') renderAdminClientes();
  if (id === 'adminMascotas') renderAdminMascotas();
  if (id === 'adminReportes') renderAdminReportes();
  if (id === 'adminReportes') renderAdminReportes();
  if (id === 'adminPerfil') fillAdminForm(); 

  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));

  const u = currentUser();
  document.body.classList.toggle('mode-admin', !!(u && u.rol === 'admin'));
  document.body.classList.toggle('mode-auth', ['splash', 'login', 'register'].includes(id));

  const navMap = {
    home: 'inicio',
    miscitas: 'citas',
    detalle: 'citas',
    confirmar: 'citas',
    historial: 'citas',
    agendar: 'agendar',
    perfil: 'mascotas',
    registrarMascota: 'mascotas',
    editarMascota: 'mascotas',
    editarCliente: 'perfil',
    adminPerfil: 'perfil'
  };

  $$('.bn-item').forEach(b => b.classList.toggle('active', b.dataset.nav === navMap[id]));
  $$('.sb-item').forEach(b => b.classList.toggle('active', b.dataset.s === id));

  window.scrollTo(0, 0);
}

function startApp() {
  if (!session) { go('login'); return; }
  currentUser().rol === 'admin' ? go('adminDashboard') : go('home');
}

function goAgendar() {
  ui.reprogramId = null;
  go('agendar');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

function openContact() {
  $('#contactModal').classList.add('show');
}

function closeModal() {
  $('#contactModal').classList.remove('show');
}

function resetDemo() {
  if (!confirm('¿Seguro? Se borrarán todos los datos guardados.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

/**
 * Genera HTML seguro para el avatar de una mascota
 */
function avatar(p) {
  p = p || {};
  const em = p.especie === 'Gato' ? '🐱' : (p.especie === 'Perro' ? '🐶' : '🐾');
  if (p.foto) {
    // Asegurar que la URL sea segura
    const safeFoto = escapeHTML(p.foto);
    return '<div class="li-avatar"><img src="' + safeFoto + '" alt=""></div>';
  }
  return '<div class="li-avatar">' + em + '</div>';
}