/**
 * Tema claro/escuro — persiste a escolha no localStorage e aplica via
 * atributo data-theme na tag <html>, que o style.css usa para sobrescrever
 * as variáveis de cor.
 *
 * Este script deve ser incluído no <head>, antes do CSS de página renderizar,
 * para evitar o "flash" do tema errado ao carregar a página.
 */
(function () {
    const THEME_KEY = 'gt-theme';
    const salvo = localStorage.getItem(THEME_KEY);
    const tema = salvo === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', tema);
})();

function toggleTheme() {
    const atual = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const novo = atual === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', novo);
    localStorage.setItem('gt-theme', novo);
    atualizarIconeTema();
}

function atualizarIconeTema() {
    const tema = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    document.querySelectorAll('.gt-theme-toggle i').forEach(icon => {
        icon.className = tema === 'light' ? 'bi bi-moon-stars' : 'bi bi-sun';
    });
}

document.addEventListener('DOMContentLoaded', atualizarIconeTema);
