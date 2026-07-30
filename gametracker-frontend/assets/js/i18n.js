/**
 * i18n.js — sistema de internacionalização do GameTracker Pro.
 *
 * Suporta 3 idiomas: Português (Brasil), Inglês e Espanhol.
 * Uso:
 *   - Texto estático:      <span data-i18n="chave.aqui">Texto padrão (pt-BR)</span>
 *   - Placeholder:         <input data-i18n-placeholder="chave.aqui">
 *   - title / aria-label:  <button data-i18n-title="chave.aqui" data-i18n-aria-label="chave.aqui">
 *   - Texto dinâmico via JS: GT_I18N.t('chave.aqui')  ou  GT_I18N.t('chave.com.{n}', {n: 3})
 *
 * O idioma escolhido é salvo em localStorage e reaplicado em toda navegação
 * (cada página chama GT_I18N.init() ao carregar).
 */

const GT_I18N_KEY = 'gt_lang';

const GT_LANGUAGES = [
  { code: 'pt-BR', flag: '🇧🇷', name: 'Português (Brasil)' },
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
];

const GT_DICT = {
  'pt-BR': {
    // --- Navbar / geral ---
    'nav.myGames': 'Meus Jogos',
    'nav.explore': 'Explorar',
    'nav.stats': 'Estatísticas',
    'nav.account': 'Minha conta',
    'nav.games': 'Jogos',
    'nav.settings': 'Configurações',
    'nav.logout': 'Sair',
    'nav.addGame': 'Adicionar jogo',
    'nav.language': 'Idioma',
    'nav.profile': 'Perfil',
    'nav.loading': 'Carregando...',
    'common.cancel': 'Cancelar',
    'common.save': 'Salvar alterações',
    'common.delete': 'Excluir',
    'common.close': 'Fechar',
    'common.loading': 'Carregando...',
    'common.search': 'Buscar',
    'footer.credit': 'GameTracker Pro © 2026 — desenvolvido por Edivan Vicente',

    // --- Login / cadastro (index.html) ---
    'auth.tagline': 'Todo jogo que você joga, em um único save.',
    'auth.subtitle': 'Catalogue, avalie por gráficos, som, jogabilidade e dificuldade, e acompanhe seu progresso mês a mês.',
    'auth.login': 'Entrar',
    'auth.register': 'Criar conta',
    'auth.email': 'E-mail',
    'auth.password': 'Senha',
    'auth.forgotPassword': 'Esqueci minha senha',
    'auth.loginError': 'E-mail ou senha incorretos.',
    'auth.resendVerification': 'Reenviar e-mail de confirmação',
    'auth.demoLogin': 'Entrar como visitante (conta demo)',
    'auth.passwordHint': 'Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.',
    'auth.registerError': 'Não foi possível criar a conta.',
    'auth.terms': 'Ao continuar, você concorda com o acompanhamento obsessivo da sua backlog.',
    'auth.resetTitle': 'Redefinir senha',
    'auth.resetText': 'Digite o e-mail cadastrado na sua conta. Vamos enviar um link para você escolher uma nova senha.',
    'auth.sendLink': 'Enviar link',
    'auth.selectLanguage': 'Escolha seu idioma',

    // --- Toolbar / filtros (dashboard) ---
    'toolbar.searchPlaceholder': 'Buscar nos meus jogos',
    'toolbar.filters': 'Filtros',
    'toolbar.console': 'Console',
    'toolbar.genre': 'Gênero',
    'toolbar.status': 'Status',
    'toolbar.minGameplay': 'Jogabilidade mínima',
    'toolbar.gameplayGte': 'Jogabilidade ≥',
    'toolbar.stars5': '5 estrelas',
    'toolbar.stars4': '4+ estrelas',
    'toolbar.stars3': '3+ estrelas',
    'toolbar.clearFilters': 'Limpar filtros',
    'toolbar.favoritesOnly': 'Somente favoritos',
    'toolbar.sort': 'Ordenar',
    'toolbar.sortRecent': 'Adicionado recentemente',
    'toolbar.sortNameAsc': 'Nome (A-Z)',
    'toolbar.sortNameDesc': 'Nome (Z-A)',
    'toolbar.sortScoreDesc': 'Nota mais alta',
    'toolbar.viewMode': 'Visualização',
    'toolbar.viewList': 'Lista',
    'toolbar.viewSmall': 'Pequeno',
    'toolbar.viewMedium': 'Médio',
    'toolbar.viewLarge': 'Grande',
    'status.playing': 'Em andamento',
    'status.finished': 'Finalizado',

    // --- HUD ---
    'hud.myGames': 'Meus Jogos',
    'hud.playing': 'Em andamento',
    'hud.finished': 'Finalizados',
    'hud.favorites': 'Favoritos',

    // --- Grid de jogos ---
    'grid.loadingLibrary': 'Carregando sua biblioteca...',
    'grid.empty': 'Nenhum jogo encontrado com esses filtros.',
    'grid.loadError': 'Não foi possível carregar sua biblioteca.',

    // --- Modal de detalhe ---
    'detail.platform': 'Plataforma',
    'detail.startDate': 'Data de início',
    'detail.endDate': 'Data de finalização',
    'detail.playCountLabel': 'Vezes jogado',
    'detail.lastPlayed': 'Última vez',
    'detail.logSession': 'Registrar nova jogada',
    'detail.hoursPlayed': 'Horas jogadas',
    'detail.timeToBeatMain': 'Duração estimada (missão principal)',
    'detail.timeToBeat100': 'Duração estimada (100%)',
    'detail.timeToBeatHint': 'As durações estimadas são informativas — preencha manualmente com base na sua própria experiência ou em um guia externo (ex: HowLongToBeat).',
    'detail.ratingByCategory': 'Avaliação por categoria',
    'detail.graphics': 'Gráficos',
    'detail.sound': 'Som',
    'detail.gameplay': 'Jogabilidade',
    'detail.difficulty': 'Dificuldade',
    'detail.markFavorite': 'Marcar como favorito',
    'detail.gameplayLabel': 'Gameplay',
    'detail.noVideo': 'Buscando vídeo de gameplay...',
    'toast.replayLogged': '"{title}" já estava na sua biblioteca — registramos mais uma jogada (total: {count}x).',

    // --- Add game modal ---
    'addGame.title': 'Adicionar jogo',
    'addGame.searchPlaceholder': 'Digite o nome de um jogo para buscar',
    'addGame.searchHint': 'Digite o nome de um jogo para buscar na base de dados.',
    'addGame.add': 'Adicionar',

    // --- Games summary (games.html) ---
    'gamesSummary.nowPlaying': 'Jogando agora',
    'gamesSummary.lastFinished': 'Último finalizado',
    'gamesSummary.viewAll': 'Ver todos os meus jogos',

    // --- Explore ---
    'explore.title': 'Explorar',
    'explore.subtitle': 'Descubra novos jogos por gênero, plataforma e mais.',
    'explore.heroTitle': 'Descubra o próximo jogo antes de adicionar',
    'explore.heroSubtitle': 'Pesquise qualquer título e veja capa, gênero, plataformas disponíveis e um vídeo de gameplay — tudo antes de decidir se ele entra na sua biblioteca.',
    'explore.searchPlaceholder': 'Digite o nome de um jogo (ex: Hollow Knight)',
    'explore.searchBtn': 'Explorar',
    'explore.suggestions': 'Sugestões:',
    'explore.emptyState': 'Escolha uma sugestão acima ou digite o nome de um jogo para começar.',

    // --- Estatísticas ---
    'stats.title': 'Estatísticas',

    // --- Account / Settings (títulos principais) ---
    'account.title': 'Minha conta',
    'account.basicInfo': 'Informações básicas',
    'account.friendCodes': 'Redes e códigos de amigo',
    'settings.title': 'Configurações',
    'settings.changeEmail': 'Trocar e-mail',
    'settings.changePassword': 'Trocar senha',
    'settings.privacy': 'Privacidade do perfil',
    'settings.deleteAccount': 'Excluir conta',
    'stats.byGenre': 'Por gênero',
    'stats.byPlatform': 'Por plataforma',
    'stats.avgByCategory': 'Notas médias por categoria',
    'stats.topRated': 'Melhor avaliados',
  },

  'en': {
    'nav.myGames': 'My Games',
    'nav.explore': 'Explore',
    'nav.stats': 'Statistics',
    'nav.account': 'My account',
    'nav.games': 'Games',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',
    'nav.addGame': 'Add game',
    'nav.language': 'Language',
    'nav.profile': 'Profile',
    'nav.loading': 'Loading...',
    'common.cancel': 'Cancel',
    'common.save': 'Save changes',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.search': 'Search',
    'footer.credit': 'GameTracker Pro © 2026 — built by Edivan Vicente',

    'auth.tagline': 'Every game you play, in a single save.',
    'auth.subtitle': 'Catalog your games, rate graphics, sound, gameplay and difficulty, and track your progress month by month.',
    'auth.login': 'Log in',
    'auth.register': 'Create account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot my password',
    'auth.loginError': 'Incorrect email or password.',
    'auth.resendVerification': 'Resend confirmation email',
    'auth.demoLogin': 'Continue as guest (demo account)',
    'auth.passwordHint': 'At least 8 characters, with uppercase, lowercase, number and special character.',
    'auth.registerError': 'Could not create the account.',
    'auth.terms': 'By continuing, you agree to the obsessive tracking of your backlog.',
    'auth.resetTitle': 'Reset password',
    'auth.resetText': "Enter the email registered to your account. We'll send you a link to choose a new password.",
    'auth.sendLink': 'Send link',
    'auth.selectLanguage': 'Choose your language',

    'toolbar.searchPlaceholder': 'Search my games',
    'toolbar.filters': 'Filters',
    'toolbar.console': 'Console',
    'toolbar.genre': 'Genre',
    'toolbar.status': 'Status',
    'toolbar.minGameplay': 'Minimum gameplay',
    'toolbar.gameplayGte': 'Gameplay ≥',
    'toolbar.stars5': '5 stars',
    'toolbar.stars4': '4+ stars',
    'toolbar.stars3': '3+ stars',
    'toolbar.clearFilters': 'Clear filters',
    'toolbar.favoritesOnly': 'Favorites only',
    'toolbar.sort': 'Sort',
    'toolbar.sortRecent': 'Recently added',
    'toolbar.sortNameAsc': 'Name (A-Z)',
    'toolbar.sortNameDesc': 'Name (Z-A)',
    'toolbar.sortScoreDesc': 'Highest rated',
    'toolbar.viewMode': 'View',
    'toolbar.viewList': 'List',
    'toolbar.viewSmall': 'Small',
    'toolbar.viewMedium': 'Medium',
    'toolbar.viewLarge': 'Large',
    'status.playing': 'Playing',
    'status.finished': 'Finished',

    'hud.myGames': 'My Games',
    'hud.playing': 'Playing',
    'hud.finished': 'Finished',
    'hud.favorites': 'Favorites',

    'grid.loadingLibrary': 'Loading your library...',
    'grid.empty': 'No games found with these filters.',
    'grid.loadError': 'Could not load your library.',

    'detail.platform': 'Platform',
    'detail.startDate': 'Start date',
    'detail.endDate': 'Finish date',
    'detail.playCountLabel': 'Times played',
    'detail.lastPlayed': 'Last played',
    'detail.logSession': 'Log a new playthrough',
    'detail.hoursPlayed': 'Hours played',
    'detail.timeToBeatMain': 'Estimated time (main story)',
    'detail.timeToBeat100': 'Estimated time (100%)',
    'detail.timeToBeatHint': 'Estimated durations are informational — fill them in manually based on your own experience or an external guide (e.g. HowLongToBeat).',
    'detail.ratingByCategory': 'Rating by category',
    'detail.graphics': 'Graphics',
    'detail.sound': 'Sound',
    'detail.gameplay': 'Gameplay',
    'detail.difficulty': 'Difficulty',
    'detail.markFavorite': 'Mark as favorite',
    'detail.gameplayLabel': 'Gameplay',
    'detail.noVideo': 'Searching for gameplay video...',
    'toast.replayLogged': '"{title}" was already in your library — we logged another playthrough (total: {count}x).',

    'addGame.title': 'Add game',
    'addGame.searchPlaceholder': 'Type a game name to search',
    'addGame.searchHint': 'Type a game name to search the database.',
    'addGame.add': 'Add',

    'gamesSummary.nowPlaying': 'Now playing',
    'gamesSummary.lastFinished': 'Last finished',
    'gamesSummary.viewAll': 'View all my games',

    'explore.title': 'Explore',
    'explore.subtitle': 'Discover new games by genre, platform and more.',
    'explore.heroTitle': 'Discover your next game before adding it',
    'explore.heroSubtitle': 'Search any title and see its cover, genre, available platforms and a gameplay video — all before deciding whether it joins your library.',
    'explore.searchPlaceholder': 'Type a game name (e.g. Hollow Knight)',
    'explore.searchBtn': 'Explore',
    'explore.suggestions': 'Suggestions:',
    'explore.emptyState': 'Pick a suggestion above or type a game name to get started.',

    'stats.title': 'Statistics',

    'account.title': 'My account',
    'account.basicInfo': 'Basic information',
    'account.friendCodes': 'Networks & friend codes',
    'settings.title': 'Settings',
    'settings.changeEmail': 'Change email',
    'settings.changePassword': 'Change password',
    'settings.privacy': 'Profile privacy',
    'settings.deleteAccount': 'Delete account',
    'stats.byGenre': 'By genre',
    'stats.byPlatform': 'By platform',
    'stats.avgByCategory': 'Average scores by category',
    'stats.topRated': 'Top rated',
  },

  'es': {
    'nav.myGames': 'Mis Juegos',
    'nav.explore': 'Explorar',
    'nav.stats': 'Estadísticas',
    'nav.account': 'Mi cuenta',
    'nav.games': 'Juegos',
    'nav.settings': 'Configuración',
    'nav.logout': 'Salir',
    'nav.addGame': 'Añadir juego',
    'nav.language': 'Idioma',
    'nav.profile': 'Perfil',
    'nav.loading': 'Cargando...',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar cambios',
    'common.delete': 'Eliminar',
    'common.close': 'Cerrar',
    'common.loading': 'Cargando...',
    'common.search': 'Buscar',
    'footer.credit': 'GameTracker Pro © 2026 — desarrollado por Edivan Vicente',

    'auth.tagline': 'Cada juego que juegas, en un solo save.',
    'auth.subtitle': 'Cataloga tus juegos, califica gráficos, sonido, jugabilidad y dificultad, y sigue tu progreso mes a mes.',
    'auth.login': 'Entrar',
    'auth.register': 'Crear cuenta',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.forgotPassword': 'Olvidé mi contraseña',
    'auth.loginError': 'Correo o contraseña incorrectos.',
    'auth.resendVerification': 'Reenviar correo de confirmación',
    'auth.demoLogin': 'Entrar como invitado (cuenta demo)',
    'auth.passwordHint': 'Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial.',
    'auth.registerError': 'No fue posible crear la cuenta.',
    'auth.terms': 'Al continuar, aceptas el seguimiento obsesivo de tu backlog.',
    'auth.resetTitle': 'Restablecer contraseña',
    'auth.resetText': 'Ingresa el correo registrado en tu cuenta. Te enviaremos un enlace para elegir una nueva contraseña.',
    'auth.sendLink': 'Enviar enlace',
    'auth.selectLanguage': 'Elige tu idioma',

    'toolbar.searchPlaceholder': 'Buscar en mis juegos',
    'toolbar.filters': 'Filtros',
    'toolbar.console': 'Consola',
    'toolbar.genre': 'Género',
    'toolbar.status': 'Estado',
    'toolbar.minGameplay': 'Jugabilidad mínima',
    'toolbar.gameplayGte': 'Jugabilidad ≥',
    'toolbar.stars5': '5 estrellas',
    'toolbar.stars4': '4+ estrellas',
    'toolbar.stars3': '3+ estrellas',
    'toolbar.clearFilters': 'Limpiar filtros',
    'toolbar.favoritesOnly': 'Solo favoritos',
    'toolbar.sort': 'Ordenar',
    'toolbar.sortRecent': 'Añadido recientemente',
    'toolbar.sortNameAsc': 'Nombre (A-Z)',
    'toolbar.sortNameDesc': 'Nombre (Z-A)',
    'toolbar.sortScoreDesc': 'Mejor calificado',
    'toolbar.viewMode': 'Visualización',
    'toolbar.viewList': 'Lista',
    'toolbar.viewSmall': 'Pequeño',
    'toolbar.viewMedium': 'Mediano',
    'toolbar.viewLarge': 'Grande',
    'status.playing': 'Jugando',
    'status.finished': 'Finalizado',

    'hud.myGames': 'Mis Juegos',
    'hud.playing': 'Jugando',
    'hud.finished': 'Finalizados',
    'hud.favorites': 'Favoritos',

    'grid.loadingLibrary': 'Cargando tu biblioteca...',
    'grid.empty': 'No se encontraron juegos con esos filtros.',
    'grid.loadError': 'No fue posible cargar tu biblioteca.',

    'detail.platform': 'Plataforma',
    'detail.startDate': 'Fecha de inicio',
    'detail.endDate': 'Fecha de finalización',
    'detail.playCountLabel': 'Veces jugado',
    'detail.lastPlayed': 'Última vez',
    'detail.logSession': 'Registrar nueva partida',
    'detail.hoursPlayed': 'Horas jugadas',
    'detail.timeToBeatMain': 'Duración estimada (misión principal)',
    'detail.timeToBeat100': 'Duración estimada (100%)',
    'detail.timeToBeatHint': 'Las duraciones estimadas son informativas — complétalas manualmente según tu propia experiencia o una guía externa (ej: HowLongToBeat).',
    'detail.ratingByCategory': 'Calificación por categoría',
    'detail.graphics': 'Gráficos',
    'detail.sound': 'Sonido',
    'detail.gameplay': 'Jugabilidad',
    'detail.difficulty': 'Dificultad',
    'detail.markFavorite': 'Marcar como favorito',
    'detail.gameplayLabel': 'Gameplay',
    'detail.noVideo': 'Buscando video de gameplay...',
    'toast.replayLogged': '"{title}" ya estaba en tu biblioteca — registramos otra partida (total: {count}x).',

    'addGame.title': 'Añadir juego',
    'addGame.searchPlaceholder': 'Escribe el nombre de un juego para buscar',
    'addGame.searchHint': 'Escribe el nombre de un juego para buscar en la base de datos.',
    'addGame.add': 'Añadir',

    'gamesSummary.nowPlaying': 'Jugando ahora',
    'gamesSummary.lastFinished': 'Último finalizado',
    'gamesSummary.viewAll': 'Ver todos mis juegos',

    'explore.title': 'Explorar',
    'explore.subtitle': 'Descubre nuevos juegos por género, plataforma y más.',
    'explore.heroTitle': 'Descubre tu próximo juego antes de añadirlo',
    'explore.heroSubtitle': 'Busca cualquier título y mira la carátula, género, plataformas disponibles y un video de gameplay — todo antes de decidir si entra en tu biblioteca.',
    'explore.searchPlaceholder': 'Escribe el nombre de un juego (ej: Hollow Knight)',
    'explore.searchBtn': 'Explorar',
    'explore.suggestions': 'Sugerencias:',
    'explore.emptyState': 'Elige una sugerencia arriba o escribe el nombre de un juego para empezar.',

    'stats.title': 'Estadísticas',

    'account.title': 'Mi cuenta',
    'account.basicInfo': 'Información básica',
    'account.friendCodes': 'Redes y códigos de amigo',
    'settings.title': 'Configuración',
    'settings.changeEmail': 'Cambiar correo',
    'settings.changePassword': 'Cambiar contraseña',
    'settings.privacy': 'Privacidad del perfil',
    'settings.deleteAccount': 'Eliminar cuenta',
    'stats.byGenre': 'Por género',
    'stats.byPlatform': 'Por plataforma',
    'stats.avgByCategory': 'Notas promedio por categoría',
    'stats.topRated': 'Mejor calificados',
  },
};

function gtSupportedLang(lang) {
  return GT_DICT[lang] ? lang : 'pt-BR';
}

function gtDetectDefaultLang() {
  const saved = localStorage.getItem(GT_I18N_KEY);
  if (saved && GT_DICT[saved]) return saved;

  const browser = (navigator.language || 'pt-BR').toLowerCase();
  if (browser.startsWith('pt')) return 'pt-BR';
  if (browser.startsWith('es')) return 'es';
  if (browser.startsWith('en')) return 'en';
  return 'pt-BR';
}

const GT_I18N = {
  currentLang: gtDetectDefaultLang(),

  t(key, vars) {
    const dict = GT_DICT[this.currentLang] || GT_DICT['pt-BR'];
    let text = dict[key] ?? GT_DICT['pt-BR'][key] ?? key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return text;
  },

  getLang() {
    return this.currentLang;
  },

  setLang(lang) {
    this.currentLang = gtSupportedLang(lang);
    localStorage.setItem(GT_I18N_KEY, this.currentLang);
    document.documentElement.setAttribute('lang', this.currentLang);
    this.apply();
    document.dispatchEvent(new CustomEvent('gt:langchange', { detail: { lang: this.currentLang } }));
  },

  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', this.t(el.getAttribute('data-i18n-title')));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', this.t(el.getAttribute('data-i18n-aria-label')));
    });
    this._renderSwitchers();
  },

  // Monta o botão/dropdown de idioma em qualquer container com [data-gt-lang-switcher].
  _renderSwitchers() {
    document.querySelectorAll('[data-gt-lang-switcher]').forEach(container => {
      if (container.dataset.gtRendered === 'true') {
        const current = GT_LANGUAGES.find(l => l.code === this.currentLang);
        const label = container.querySelector('.gt-lang-current-label');
        const flag = container.querySelector('.gt-lang-current-flag');
        if (label) label.textContent = current.code === 'pt-BR' ? 'PT-BR' : current.code.toUpperCase();
        if (flag) flag.textContent = current.flag;
        container.querySelectorAll('[data-lang-option]').forEach(item => {
          item.classList.toggle('active', item.getAttribute('data-lang-option') === this.currentLang);
        });
        return;
      }

      const current = GT_LANGUAGES.find(l => l.code === this.currentLang);
      container.dataset.gtRendered = 'true';
      container.classList.add('dropdown');
      container.innerHTML = `
        <button class="btn btn-gt-outline d-flex align-items-center gap-2 px-2 py-1" type="button"
                data-bs-toggle="dropdown" aria-expanded="false" title="${this.t('nav.language')}">
          <span class="gt-lang-current-flag">${current.flag}</span>
          <span class="gt-lang-current-label small d-none d-sm-inline">${current.code === 'pt-BR' ? 'PT-BR' : current.code.toUpperCase()}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          ${GT_LANGUAGES.map(l => `
            <li>
              <a class="dropdown-item d-flex align-items-center gap-2 ${l.code === this.currentLang ? 'active' : ''}"
                 href="#" data-lang-option="${l.code}">
                <span>${l.flag}</span><span>${l.name}</span>
              </a>
            </li>`).join('')}
        </ul>`;

      container.querySelectorAll('[data-lang-option]').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          this.setLang(item.getAttribute('data-lang-option'));
        });
      });
    });
  },

  init() {
    document.documentElement.setAttribute('lang', this.currentLang);
    document.addEventListener('DOMContentLoaded', () => this.apply());
  },
};

GT_I18N.init();
