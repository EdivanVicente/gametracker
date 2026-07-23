/**
 * Gêneros de jogo — rótulo em português mapeado para a palavra-chave em
 * inglês usada pela RAWG (que tem um vocabulário fixo de ~19 gêneros).
 * Usado no filtro de gênero da toolbar.
 */
const GT_GENRES = [
  { label: 'Ação', keyword: 'action' },
  { label: 'Indie', keyword: 'indie' },
  { label: 'Aventura', keyword: 'adventure' },
  { label: 'RPG', keyword: 'rpg' },
  { label: 'Estratégia', keyword: 'strategy' },
  { label: 'FPS / Tiro', keyword: 'shooter' },
  { label: 'Casual', keyword: 'casual' },
  { label: 'Simulação', keyword: 'simulation' },
  { label: 'Puzzle', keyword: 'puzzle' },
  { label: 'Arcade', keyword: 'arcade' },
  { label: 'Plataforma', keyword: 'platformer' },
  { label: 'Multiplayer Massivo', keyword: 'massively multiplayer' },
  { label: 'Esporte', keyword: 'sports' },
  { label: 'Corrida', keyword: 'racing' },
  { label: 'Luta', keyword: 'fighting' },
  { label: 'Família', keyword: 'family' },
  { label: 'Tabuleiro', keyword: 'board games' },
  { label: 'Educativo', keyword: 'educational' },
  { label: 'Cartas', keyword: 'card' },
];

function popularSelectGeneros(selectEl) {
  let html = '<option selected value="">Gênero</option>';
  GT_GENRES.forEach(g => {
    html += `<option value="${g.keyword}">${g.label}</option>`;
  });
  selectEl.innerHTML = html;
}
