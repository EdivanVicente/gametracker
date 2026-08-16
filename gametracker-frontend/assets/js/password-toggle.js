/**
 * password-toggle.js — liga o botão "olhinho" de mostrar/ocultar senha.
 *
 * Uso no HTML:
 *   <div class="gt-password-field">
 *     <input type="password" id="minha-senha" class="form-control">
 *     <button type="button" class="gt-password-toggle" data-target="minha-senha"
 *             aria-label="Mostrar senha" tabindex="-1">
 *       <i class="bi bi-eye"></i>
 *     </button>
 *   </div>
 *
 * Não precisa registrar nada em JS por página — qualquer botão com a classe
 * .gt-password-toggle presente no DOM já funciona automaticamente.
 */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.gt-password-toggle').forEach((btn) => {
    const input = document.getElementById(btn.getAttribute('data-target'));
    const icon = btn.querySelector('i');
    if (!input || !icon) return;

    btn.addEventListener('click', () => {
      const vaiMostrar = input.type === 'password';
      input.type = vaiMostrar ? 'text' : 'password';

      icon.classList.toggle('bi-eye', !vaiMostrar);
      icon.classList.toggle('bi-eye-slash', vaiMostrar);

      const chaveLabel = vaiMostrar ? 'auth.hidePassword' : 'auth.showPassword';
      const label = (typeof GT_I18N !== 'undefined') ? GT_I18N.t(chaveLabel) : (vaiMostrar ? 'Ocultar senha' : 'Mostrar senha');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  });
});
