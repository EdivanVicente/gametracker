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
  { code: 'pt-BR', flagCode: 'br', name: 'Português (Brasil)' },
  { code: 'en', flagCode: 'us', name: 'English' },
  { code: 'es', flagCode: 'es', name: 'Español' },
];

// Bandeiras como SVG embutido — nada de imagem externa (flagcdn, etc), então
// funciona sempre, mesmo offline ou com bloqueador de anúncios/CSP restritiva.
// (A versão anterior usava <img src="flagcdn.com/..."> e, se essa requisição
// falhasse silenciosamente por qualquer motivo de rede, a bandeira simplesmente
// não aparecia — por isso trocamos para SVG inline, que sempre renderiza.)
const GT_FLAG_SVGS = {
  br: `<svg viewBox="0 0 24 18" width="20" height="15" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="18" fill="#009739"/>
    <polygon points="12,3 21,9 12,15 3,9" fill="#FEDD00"/>
    <circle cx="12" cy="9" r="4" fill="#012169"/>
  </svg>`,
  us: `<svg viewBox="0 0 24 18" width="20" height="15" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="18" fill="#B22234"/>
    <g fill="#FFFFFF">
      <rect y="1.38" width="24" height="1.38"/><rect y="4.15" width="24" height="1.38"/>
      <rect y="6.92" width="24" height="1.38"/><rect y="9.69" width="24" height="1.38"/>
      <rect y="12.46" width="24" height="1.38"/><rect y="15.23" width="24" height="1.38"/>
    </g>
    <rect width="10" height="9.69" fill="#3C3B6E"/>
  </svg>`,
  es: `<svg viewBox="0 0 24 18" width="20" height="15" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="18" fill="#AA151B"/>
    <rect y="4.5" width="24" height="9" fill="#F1BF00"/>
  </svg>`,
};

function gtFlagImg(flagCode) {
  return `<span style="display:inline-flex;vertical-align:middle;border-radius:2px;overflow:hidden;line-height:0;">${GT_FLAG_SVGS[flagCode] || ''}</span>`;
}

const GT_DICT = {
  'pt-BR': {
    // --- Navbar / geral ---
    'nav.myGames': 'Meus Jogos',
    'nav.explore': 'Explorar',
    'nav.stats': 'Estatísticas',
    'nav.community': 'Comunidade',
    'nav.account': 'Minha conta',
    'nav.games': 'Jogos',
    'nav.settings': 'Configurações',
    'nav.logout': 'Sair',
    'nav.addGame': 'Adicionar jogo',
    'nav.language': 'Idioma',
    'nav.profile': 'Perfil',
    'nav.loading': 'Carregando...',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.save': 'Salvar alterações',
    'common.delete': 'Excluir',
    'common.close': 'Fechar',
    'common.back': 'Voltar',
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
    'detail.logSession': 'Jogar novamente',
    'detail.finishSession': 'Finalizar esta jogada',
    'detail.sessionError': 'Não foi possível registrar essa jogada.',
    'detail.hoursPlayed': 'Horas jogadas',
    'detail.timeToBeatMain': 'Duração estimada (missão principal)',
    'detail.timeToBeat100': 'Duração estimada (100%)',
    'detail.timeToBeatHint': 'As durações estimadas são informativas — preencha manualmente com base na sua própria experiência ou em um guia externo (ex: HowLongToBeat).',
    'detail.fetchDuration': 'Buscar duração automaticamente (HowLongToBeat)',
    'detail.durationNotFound': 'Não encontramos duração para esse jogo. Preencha manualmente.',
    'detail.ratingByCategory': 'Avaliação por categoria',
    'detail.graphics': 'Gráficos',
    'detail.sound': 'Som',
    'detail.gameplay': 'Jogabilidade',
    'detail.difficulty': 'Dificuldade',
    'detail.markFavorite': 'Marcar como favorito',
    'detail.gameplayLabel': 'Gameplay',
    'detail.noVideo': 'Buscando vídeo de gameplay...',
    'detail.noGenre': 'Gênero não informado',
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
    'explore.notFound': 'Nenhuma informação encontrada na nossa base para "{title}".',
    'explore.searchOnYoutube': 'Buscar "{title}" no YouTube',
    'explore.gameNotFound': 'Jogo não encontrado na base',
    'explore.noDescription': 'Sem descrição disponível para este jogo.',

    // --- Estatísticas ---
    'stats.title': 'Estatísticas',

    // --- Account / Settings (títulos principais) ---
    'account.title': 'Minha conta',
    'account.basicInfo': 'Informações básicas',
    'account.friendCodes': 'Redes e códigos de amigo',
    'account.memberSince': 'Membro desde',
    'settings.title': 'Configurações',
    'settings.changeEmail': 'Trocar e-mail',
    'settings.changePassword': 'Trocar senha',
    'settings.privacy': 'Privacidade do perfil',
    'settings.deleteAccount': 'Excluir conta',
    'stats.byGenre': 'Por gênero',
    'stats.byPlatform': 'Por plataforma',
    'stats.avgByCategory': 'Notas médias por categoria',
    'stats.topRated': 'Melhor avaliados',
    'stats.gamesCataloged': 'Jogos catalogados',
    'stats.completionRate': 'Taxa de conclusão',
    'stats.avgScore': 'Nota média geral',
    'stats.notEnoughData': 'Sem dados suficientes.',
    'stats.noRatedGames': 'Ainda não há jogos avaliados.',
    'stats.notInformed': 'Não informado',
    'stats.categoryHint': 'Clique numa categoria para ver quais jogos você avaliou nela.',
    'stats.gamesRatedIn': 'Jogos avaliados em {category}',
    'stats.noGamesInCategory': 'Nenhum jogo avaliado nessa categoria ainda.',

    'community.searchPlaceholder': 'Buscar por jogo, nome de usuário ou e-mail...',
    'community.feedTitle': 'O que os membros estão jogando',
    'community.rankingTitle': 'Ranking da comunidade',
    'community.feedEmpty': 'Nenhuma atividade recente. Siga outros membros para ver o que eles estão jogando.',
    'community.feedStarted': 'começou a jogar',
    'community.feedFinished': 'finalizou',
    'community.anonymous': 'Jogador sem nome',
    'community.loadError': 'Não foi possível carregar. Tente novamente.',
    'community.rankingEmpty': 'Ainda não há dados suficientes pro ranking.',
    'community.searchEmpty': 'Nada encontrado para essa busca.',
    'community.searchGames': 'Jogos',
    'community.searchUsers': 'Usuários',
    'community.playersCount': 'jogadores',
    'community.noPlayersYet': 'Ninguém adicionou esse jogo ainda.',
    'community.privateProfile': 'Este perfil é privado.',
    'community.games': 'Jogos',
    'community.followers': 'Seguidores',
    'community.following': 'Seguindo',
    'community.follow': 'Seguir',
    'community.unfollow': 'Deixar de seguir',
    'community.nothingPlaying': 'Nada em andamento no momento.',
    'community.nothingFinished': 'Nenhum jogo finalizado ainda.',
    'community.recentlyFinished': 'Finalizados recentemente',
    'community.emptyFollowList': 'Ninguém por aqui ainda.',

    'onboarding.title': 'Boas-vindas ao GameTracker Pro!',
    'onboarding.subtitle': 'Só mais um passinho pra deixar sua conta com a sua cara — leva 10 segundos.',
    'onboarding.nameLabel': 'Como devemos te chamar?',
    'onboarding.namePlaceholder': 'Ex: Edivan',
    'onboarding.platformsLabel': 'IDs de plataforma (opcional — ajuda a comunidade a te achar na busca)',
    'onboarding.switchLabel': 'Nintendo Switch ID',
    'onboarding.skip': 'Pular',
    'onboarding.save': 'Salvar',
    'onboarding.laterHint': 'Você pode preencher ou mudar tudo isso depois em \'Minha conta\'.',
    'community.searchInLibrary': 'Buscar na biblioteca desta pessoa...',
    'community.emptyLibrary': 'Nenhum jogo encontrado.',

    'gameplay.searchOnYoutube': 'Buscar no YouTube',
    'gameplay.notFound': 'Nenhum vídeo de gameplay encontrado.',
    'gameplay.notAvailable': 'Nenhum vídeo de gameplay disponível no momento.',
    'gameplay.watchGameplay': 'Ver gameplay',
    'gameplay.viewChannel': 'Ver canal',
    'gameplay.noneAvailable': 'Não foi possível carregar nenhum vídeo disponível para este jogo.',
    'quickview.summary': 'Resumo da história',
    'auth.connectionError': 'Erro de conexão com o servidor.',
    'resetPassword.title': 'Redefinir senha',
    'resetPassword.subtitle': 'Escolha uma nova senha para sua conta.',
    'resetPassword.newPassword': 'Nova senha',
    'resetPassword.confirmPassword': 'Confirmar nova senha',
    'resetPassword.submit': 'Redefinir senha',
    'resetPassword.successMessage': 'Senha redefinida com sucesso!',
    'resetPassword.goToLogin': 'Ir para o login',
    'resetPassword.invalidLink': 'Este link é inválido ou já expirou.',
    'resetPassword.backToLogin': 'Voltar ao login',
    'resetPassword.fillBothFields': 'Preencha os dois campos.',
    'resetPassword.mismatch': 'A confirmação não bate com a nova senha.',
    'resetPassword.genericError': 'Não foi possível redefinir a senha.',
  },

  'en': {
    'nav.myGames': 'My Games',
    'nav.explore': 'Explore',
    'nav.stats': 'Statistics',
    'nav.community': 'Community',
    'nav.account': 'My account',
    'nav.games': 'Games',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',
    'nav.addGame': 'Add game',
    'nav.language': 'Language',
    'nav.profile': 'Profile',
    'nav.loading': 'Loading...',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save changes',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.back': 'Back',
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
    'detail.logSession': 'Play again',
    'detail.finishSession': 'Finish this playthrough',
    'detail.sessionError': 'Could not save this playthrough.',
    'detail.hoursPlayed': 'Hours played',
    'detail.timeToBeatMain': 'Estimated time (main story)',
    'detail.timeToBeat100': 'Estimated time (100%)',
    'detail.timeToBeatHint': 'Estimated durations are informational — fill them in manually based on your own experience or an external guide (e.g. HowLongToBeat).',
    'detail.fetchDuration': 'Auto-fetch duration (HowLongToBeat)',
    'detail.durationNotFound': 'We could not find a duration for this game. Please fill it in manually.',
    'detail.ratingByCategory': 'Rating by category',
    'detail.graphics': 'Graphics',
    'detail.sound': 'Sound',
    'detail.gameplay': 'Gameplay',
    'detail.difficulty': 'Difficulty',
    'detail.markFavorite': 'Mark as favorite',
    'detail.gameplayLabel': 'Gameplay',
    'detail.noVideo': 'Searching for gameplay video...',
    'detail.noGenre': 'Genre not informed',
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
    'explore.notFound': 'No information found in our database for "{title}".',
    'explore.searchOnYoutube': 'Search "{title}" on YouTube',
    'explore.gameNotFound': 'Game not found in database',
    'explore.noDescription': 'No description available for this game.',

    'stats.title': 'Statistics',

    'account.title': 'My account',
    'account.basicInfo': 'Basic information',
    'account.friendCodes': 'Networks & friend codes',
    'account.memberSince': 'Member since',
    'settings.title': 'Settings',
    'settings.changeEmail': 'Change email',
    'settings.changePassword': 'Change password',
    'settings.privacy': 'Profile privacy',
    'settings.deleteAccount': 'Delete account',
    'stats.byGenre': 'By genre',
    'stats.byPlatform': 'By platform',
    'stats.avgByCategory': 'Average scores by category',
    'stats.topRated': 'Top rated',
    'stats.gamesCataloged': 'Games cataloged',
    'stats.completionRate': 'Completion rate',
    'stats.avgScore': 'Overall average score',
    'stats.notEnoughData': 'Not enough data yet.',
    'stats.noRatedGames': 'No rated games yet.',
    'stats.notInformed': 'Not informed',
    'stats.categoryHint': 'Click a category to see which games you rated in it.',
    'stats.gamesRatedIn': 'Games rated in {category}',
    'stats.noGamesInCategory': 'No games rated in this category yet.',

    'community.searchPlaceholder': 'Search by game, username or email...',
    'community.feedTitle': 'What members are playing',
    'community.rankingTitle': 'Community ranking',
    'community.feedEmpty': "No recent activity. Follow other members to see what they're playing.",
    'community.feedStarted': 'started playing',
    'community.feedFinished': 'finished',
    'community.anonymous': 'Unnamed player',
    'community.loadError': 'Could not load. Please try again.',
    'community.rankingEmpty': 'Not enough data for the ranking yet.',
    'community.searchEmpty': 'Nothing found for this search.',
    'community.searchGames': 'Games',
    'community.searchUsers': 'Users',
    'community.playersCount': 'players',
    'community.noPlayersYet': 'No one has added this game yet.',
    'community.privateProfile': 'This profile is private.',
    'community.games': 'Games',
    'community.followers': 'Followers',
    'community.following': 'Following',
    'community.follow': 'Follow',
    'community.unfollow': 'Unfollow',
    'community.nothingPlaying': 'Nothing in progress right now.',
    'community.nothingFinished': 'No finished games yet.',
    'community.recentlyFinished': 'Recently finished',
    'community.emptyFollowList': 'No one here yet.',

    'onboarding.title': 'Welcome to GameTracker Pro!',
    'onboarding.subtitle': "Just one more step to make your account yours — takes 10 seconds.",
    'onboarding.nameLabel': 'What should we call you?',
    'onboarding.namePlaceholder': 'E.g. Edivan',
    'onboarding.platformsLabel': 'Platform IDs (optional — helps the community find you in search)',
    'onboarding.switchLabel': 'Nintendo Switch ID',
    'onboarding.skip': 'Skip',
    'onboarding.save': 'Save',
    'onboarding.laterHint': "You can fill in or change all of this later in 'My account'.",
    'community.searchInLibrary': "Search this person's library...",
    'community.emptyLibrary': 'No games found.',

    'gameplay.searchOnYoutube': 'Search on YouTube',
    'gameplay.notFound': 'No gameplay video found.',
    'gameplay.notAvailable': 'No gameplay video available right now.',
    'gameplay.watchGameplay': 'Watch gameplay',
    'gameplay.viewChannel': 'View channel',
    'gameplay.noneAvailable': 'Could not load any available video for this game.',
    'quickview.summary': 'Story summary',
    'auth.connectionError': 'Connection error with the server.',
    'resetPassword.title': 'Reset password',
    'resetPassword.subtitle': 'Choose a new password for your account.',
    'resetPassword.newPassword': 'New password',
    'resetPassword.confirmPassword': 'Confirm new password',
    'resetPassword.submit': 'Reset password',
    'resetPassword.successMessage': 'Password reset successfully!',
    'resetPassword.goToLogin': 'Go to login',
    'resetPassword.invalidLink': 'This link is invalid or has expired.',
    'resetPassword.backToLogin': 'Back to login',
    'resetPassword.fillBothFields': 'Fill in both fields.',
    'resetPassword.mismatch': "Confirmation doesn't match the new password.",
    'resetPassword.genericError': 'Could not reset the password.',
  },

  'es': {
    'nav.myGames': 'Mis Juegos',
    'nav.explore': 'Explorar',
    'nav.stats': 'Estadísticas',
    'nav.community': 'Comunidad',
    'nav.account': 'Mi cuenta',
    'nav.games': 'Juegos',
    'nav.settings': 'Configuración',
    'nav.logout': 'Salir',
    'nav.addGame': 'Añadir juego',
    'nav.language': 'Idioma',
    'nav.profile': 'Perfil',
    'nav.loading': 'Cargando...',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.save': 'Guardar cambios',
    'common.delete': 'Eliminar',
    'common.close': 'Cerrar',
    'common.back': 'Volver',
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
    'detail.logSession': 'Jugar de nuevo',
    'detail.finishSession': 'Finalizar esta partida',
    'detail.sessionError': 'No fue posible registrar esta partida.',
    'detail.hoursPlayed': 'Horas jugadas',
    'detail.timeToBeatMain': 'Duración estimada (misión principal)',
    'detail.timeToBeat100': 'Duración estimada (100%)',
    'detail.timeToBeatHint': 'Las duraciones estimadas son informativas — complétalas manualmente según tu propia experiencia o una guía externa (ej: HowLongToBeat).',
    'detail.fetchDuration': 'Buscar duración automáticamente (HowLongToBeat)',
    'detail.durationNotFound': 'No encontramos duración para este juego. Complétala manualmente.',
    'detail.ratingByCategory': 'Calificación por categoría',
    'detail.graphics': 'Gráficos',
    'detail.sound': 'Sonido',
    'detail.gameplay': 'Jugabilidad',
    'detail.difficulty': 'Dificultad',
    'detail.markFavorite': 'Marcar como favorito',
    'detail.gameplayLabel': 'Gameplay',
    'detail.noVideo': 'Buscando video de gameplay...',
    'detail.noGenre': 'Género no informado',
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
    'explore.notFound': 'No se encontró información en nuestra base para "{title}".',
    'explore.searchOnYoutube': 'Buscar "{title}" en YouTube',
    'explore.gameNotFound': 'Juego no encontrado en la base',
    'explore.noDescription': 'No hay descripción disponible para este juego.',

    'stats.title': 'Estadísticas',

    'account.title': 'Mi cuenta',
    'account.basicInfo': 'Información básica',
    'account.friendCodes': 'Redes y códigos de amigo',
    'account.memberSince': 'Miembro desde',
    'settings.title': 'Configuración',
    'settings.changeEmail': 'Cambiar correo',
    'settings.changePassword': 'Cambiar contraseña',
    'settings.privacy': 'Privacidad del perfil',
    'settings.deleteAccount': 'Eliminar cuenta',
    'stats.byGenre': 'Por género',
    'stats.byPlatform': 'Por plataforma',
    'stats.avgByCategory': 'Notas promedio por categoría',
    'stats.topRated': 'Mejor calificados',
    'stats.gamesCataloged': 'Juegos catalogados',
    'stats.completionRate': 'Tasa de finalización',
    'stats.avgScore': 'Nota promedio general',
    'stats.notEnoughData': 'No hay suficientes datos.',
    'stats.noRatedGames': 'Todavía no hay juegos calificados.',
    'stats.notInformed': 'No informado',
    'stats.categoryHint': 'Haz clic en una categoría para ver qué juegos calificaste en ella.',
    'stats.gamesRatedIn': 'Juegos calificados en {category}',
    'stats.noGamesInCategory': 'Todavía no hay juegos calificados en esta categoría.',

    'community.searchPlaceholder': 'Buscar por juego, usuario o correo...',
    'community.feedTitle': 'Qué están jugando los miembros',
    'community.rankingTitle': 'Ranking de la comunidad',
    'community.feedEmpty': 'Sin actividad reciente. Sigue a otros miembros para ver qué están jugando.',
    'community.feedStarted': 'empezó a jugar',
    'community.feedFinished': 'terminó',
    'community.anonymous': 'Jugador sin nombre',
    'community.loadError': 'No fue posible cargar. Inténtalo de nuevo.',
    'community.rankingEmpty': 'Todavía no hay suficientes datos para el ranking.',
    'community.searchEmpty': 'No se encontró nada para esta búsqueda.',
    'community.searchGames': 'Juegos',
    'community.searchUsers': 'Usuarios',
    'community.playersCount': 'jugadores',
    'community.noPlayersYet': 'Nadie ha añadido este juego todavía.',
    'community.privateProfile': 'Este perfil es privado.',
    'community.games': 'Juegos',
    'community.followers': 'Seguidores',
    'community.following': 'Siguiendo',
    'community.follow': 'Seguir',
    'community.unfollow': 'Dejar de seguir',
    'community.nothingPlaying': 'Nada en curso por ahora.',
    'community.nothingFinished': 'Todavía no hay juegos finalizados.',
    'community.recentlyFinished': 'Finalizados recientemente',
    'community.emptyFollowList': 'Todavía no hay nadie aquí.',

    'onboarding.title': '¡Bienvenido a GameTracker Pro!',
    'onboarding.subtitle': 'Solo un paso más para personalizar tu cuenta — toma 10 segundos.',
    'onboarding.nameLabel': '¿Cómo debemos llamarte?',
    'onboarding.namePlaceholder': 'Ej: Edivan',
    'onboarding.platformsLabel': 'IDs de plataforma (opcional — ayuda a la comunidad a encontrarte en la búsqueda)',
    'onboarding.switchLabel': 'Nintendo Switch ID',
    'onboarding.skip': 'Omitir',
    'onboarding.save': 'Guardar',
    'onboarding.laterHint': 'Puedes completar o cambiar todo esto después en \'Mi cuenta\'.',
    'community.searchInLibrary': 'Buscar en la biblioteca de esta persona...',
    'community.emptyLibrary': 'No se encontraron juegos.',

    'gameplay.searchOnYoutube': 'Buscar en YouTube',
    'gameplay.notFound': 'No se encontró ningún video de gameplay.',
    'gameplay.notAvailable': 'Ningún video de gameplay disponible por el momento.',
    'gameplay.watchGameplay': 'Ver gameplay',
    'gameplay.viewChannel': 'Ver canal',
    'gameplay.noneAvailable': 'No fue posible cargar ningún video disponible para este juego.',
    'quickview.summary': 'Resumen de la historia',
    'auth.connectionError': 'Error de conexión con el servidor.',
    'resetPassword.title': 'Restablecer contraseña',
    'resetPassword.subtitle': 'Elige una nueva contraseña para tu cuenta.',
    'resetPassword.newPassword': 'Nueva contraseña',
    'resetPassword.confirmPassword': 'Confirmar nueva contraseña',
    'resetPassword.submit': 'Restablecer contraseña',
    'resetPassword.successMessage': '¡Contraseña restablecida con éxito!',
    'resetPassword.goToLogin': 'Ir al login',
    'resetPassword.invalidLink': 'Este enlace no es válido o ya expiró.',
    'resetPassword.backToLogin': 'Volver al login',
    'resetPassword.fillBothFields': 'Completa los dos campos.',
    'resetPassword.mismatch': 'La confirmación no coincide con la nueva contraseña.',
    'resetPassword.genericError': 'No fue posible restablecer la contraseña.',
  },
};

// A RAWG devolve os gêneros sempre em inglês (ex: "Action, Adventure, RPG"),
// independente do idioma escolhido no site. Esse mapa traduz os nomes mais
// comuns — gêneros fora da lista são exibidos como vieram da API (em inglês).
const GT_GENRE_MAP = {
  'en': {}, // já vem em inglês, não precisa mapear
  'pt-BR': {
    'Action': 'Ação', 'Adventure': 'Aventura', 'RPG': 'RPG', 'Strategy': 'Estratégia',
    'Shooter': 'Tiro', 'Casual': 'Casual', 'Simulation': 'Simulação', 'Puzzle': 'Quebra-cabeça',
    'Arcade': 'Arcade', 'Platformer': 'Plataforma', 'Racing': 'Corrida', 'Sports': 'Esportes',
    'Fighting': 'Luta', 'Family': 'Família', 'Board Games': 'Jogos de tabuleiro',
    'Educational': 'Educativo', 'Card': 'Cartas', 'Massively Multiplayer': 'Multiplayer massivo',
    'Indie': 'Indie',
  },
  'es': {
    'Action': 'Acción', 'Adventure': 'Aventura', 'RPG': 'RPG', 'Strategy': 'Estrategia',
    'Shooter': 'Disparos', 'Casual': 'Casual', 'Simulation': 'Simulación', 'Puzzle': 'Rompecabezas',
    'Arcade': 'Arcade', 'Platformer': 'Plataformas', 'Racing': 'Carreras', 'Sports': 'Deportes',
    'Fighting': 'Lucha', 'Family': 'Familia', 'Board Games': 'Juegos de mesa',
    'Educational': 'Educativo', 'Card': 'Cartas', 'Massively Multiplayer': 'Multijugador masivo',
    'Indie': 'Indie',
  },
};

function gtTranslateGenre(genreString) {
  if (!genreString) return genreString;
  const map = GT_GENRE_MAP[GT_I18N.currentLang] || {};
  return genreString.split(',').map(g => {
    const nome = g.trim();
    return map[nome] || nome;
  }).join(', ');
}

// O backend traduz descrições com códigos curtos (pt/en/es) — o front usa 'pt-BR'.
function gtBackendLang() {
  return GT_I18N.currentLang === 'pt-BR' ? 'pt' : GT_I18N.currentLang;
}
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
        const flagSlot = container.querySelector('.gt-lang-current-flag');
        if (label) label.textContent = current.code === 'pt-BR' ? 'PT-BR' : current.code.toUpperCase();
        if (flagSlot) flagSlot.innerHTML = gtFlagImg(current.flagCode, 18);
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
          <span class="gt-lang-current-flag d-inline-flex">${gtFlagImg(current.flagCode, 18)}</span>
          <span class="gt-lang-current-label small d-none d-sm-inline">${current.code === 'pt-BR' ? 'PT-BR' : current.code.toUpperCase()}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          ${GT_LANGUAGES.map(l => `
            <li>
              <a class="dropdown-item d-flex align-items-center gap-2 ${l.code === this.currentLang ? 'active' : ''}"
                 href="#" data-lang-option="${l.code}">
                <span class="d-inline-flex">${gtFlagImg(l.flagCode, 18)}</span><span>${l.name}</span>
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
