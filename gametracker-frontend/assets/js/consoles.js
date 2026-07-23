/**
 * Lista de consoles/plataformas mais tradicionais, agrupados por fabricante.
 * Usada tanto no seletor de plataforma do modal de detalhe (dashboard) quanto
 * no filtro de console da toolbar.
 *
 * Cada plataforma tem um "group" (fabricante) usado para montar <optgroup>,
 * e uma lista de "aliases" (palavras-chave) usada para casar com o texto livre
 * salvo no jogo — por exemplo, um jogo salvo como "PS5" ou "Playstation 5"
 * deve casar com a opção "PlayStation 5" do filtro.
 */
const GT_CONSOLES = [
  // --- Nintendo ---
  { value: 'Game Boy', group: 'Nintendo', aliases: ['game boy', 'gameboy'] },
  { value: 'Game Boy Advance', group: 'Nintendo', aliases: ['game boy advance', 'gba'] },
  { value: 'Nintendo DS', group: 'Nintendo', aliases: ['nintendo ds', 'nds'] },
  { value: 'Nintendo 3DS', group: 'Nintendo', aliases: ['nintendo 3ds', '3ds'] },
  { value: 'NES (8 bits)', group: 'Nintendo', aliases: ['nes', '8 bits', '8bits', 'nintendinho'] },
  { value: 'Super Nintendo', group: 'Nintendo', aliases: ['super nintendo', 'snes'] },
  { value: 'Nintendo 64', group: 'Nintendo', aliases: ['nintendo 64', 'n64'] },
  { value: 'GameCube', group: 'Nintendo', aliases: ['gamecube', 'game cube', 'ngc'] },
  { value: 'Wii', group: 'Nintendo', aliases: ['wii'] },
  { value: 'Wii U', group: 'Nintendo', aliases: ['wii u'] },
  { value: 'Nintendo Switch', group: 'Nintendo', aliases: ['nintendo switch', 'switch'] },

  // --- PlayStation ---
  { value: 'PlayStation 1', group: 'PlayStation', aliases: ['playstation 1', 'playstation1', 'ps1', 'psx'] },
  { value: 'PlayStation 2', group: 'PlayStation', aliases: ['playstation 2', 'ps2'] },
  { value: 'PlayStation 3', group: 'PlayStation', aliases: ['playstation 3', 'ps3'] },
  { value: 'PlayStation 4', group: 'PlayStation', aliases: ['playstation 4', 'ps4'] },
  { value: 'PlayStation 5', group: 'PlayStation', aliases: ['playstation 5', 'ps5'] },
  { value: 'PSP', group: 'PlayStation', aliases: ['psp', 'playstation portable'] },
  { value: 'PS Vita', group: 'PlayStation', aliases: ['ps vita', 'psvita', 'vita'] },

  // --- Xbox ---
  { value: 'Xbox (Clássico)', group: 'Xbox', aliases: ['xbox classico', 'xbox clássico', 'xbox (classico)'] },
  { value: 'Xbox 360', group: 'Xbox', aliases: ['xbox 360'] },
  { value: 'Xbox One', group: 'Xbox', aliases: ['xbox one'] },
  { value: 'Xbox Series S/X', group: 'Xbox', aliases: ['xbox series', 'series s', 'series x'] },

  // --- Sega ---
  { value: 'Mega Drive', group: 'Sega', aliases: ['mega drive', 'genesis'] },

  // --- Outros ---
  { value: 'PC', group: 'Outros', aliases: ['pc', 'windows', 'steam', 'epic games', 'linux', 'mac'] },
  { value: 'Mobile', group: 'Outros', aliases: ['mobile', 'celular', 'android', 'ios'] },
];

// Agrupa por fabricante, na ordem em que os grupos aparecem na lista acima.
function agruparConsolesPorFabricante() {
  const grupos = [];
  const indicePorGrupo = {};

  GT_CONSOLES.forEach(console => {
    if (!(console.group in indicePorGrupo)) {
      indicePorGrupo[console.group] = grupos.length;
      grupos.push({ nome: console.group, itens: [] });
    }
    grupos[indicePorGrupo[console.group]].itens.push(console);
  });

  return grupos;
}

// Descobre a plataforma "conhecida" mais provável a partir de um texto livre salvo
// no jogo (ex: "PS5", "Play 5", "playstation 5") comparando com os aliases.
function identificarConsoleConhecido(textoLivre) {
  if (!textoLivre) return null;
  const normalizado = textoLivre.toLowerCase().trim();
  return GT_CONSOLES.find(c => c.aliases.some(alias => normalizado.includes(alias))) || null;
}

// Preenche um <select> com os consoles agrupados por fabricante + opção "Outro" no final.
function popularSelectConsoles(selectEl, { incluirTodos = false, labelTodos = 'Todos os consoles' } = {}) {
  const grupos = agruparConsolesPorFabricante();

  let html = incluirTodos ? `<option value="">${labelTodos}</option>` : '';
  grupos.forEach(grupo => {
    html += `<optgroup label="${grupo.nome}">`;
    grupo.itens.forEach(item => {
      html += `<option value="${item.value}">${item.value}</option>`;
    });
    html += '</optgroup>';
  });
  html += '<option value="Outro">Outro (digitar manualmente)</option>';

  selectEl.innerHTML = html;
}
