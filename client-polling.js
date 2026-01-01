// Cliente com polling HTTP (sem Socket.io)
const API_BASE = '/.netlify/functions/game';

let currentRoomCode = null;
let yourId = null;
let roomState = null;
let timerInterval = null;
let pollInterval = null;
let diceRolls = {};

// ==================== POLLING ====================
function startPolling(roomCode) {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomCode}`);
      const data = await res.json();
      
      if (data.success) {
        handleRoomUpdate(data.room);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 2000); // Poll a cada 2 segundos
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ==================== INDEX PAGE ====================
if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
  document.getElementById('createRoomBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('createName').value.trim();
    const numTeams = Number(document.getElementById('numTeams').value) || 2;
    if (!name) {
      alert('Digite seu nome!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, numTeams }),
      });
      
      const data = await res.json();
      if (data.success) {
        yourId = data.playerId;
        localStorage.setItem('yourId', yourId);
        localStorage.setItem('roomCode', data.room.code);
        window.location.href = `room.html?code=${data.room.code}`;
      }
    } catch (error) {
      alert('Erro ao criar sala: ' + error.message);
    }
  });

  document.getElementById('joinRoomBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('joinName').value.trim();
    const code = document.getElementById('roomCode').value.trim().toUpperCase();
    if (!name || !code) {
      alert('Preencha todos os campos!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      
      const data = await res.json();
      if (data.success) {
        yourId = data.playerId;
        localStorage.setItem('yourId', yourId);
        localStorage.setItem('roomCode', code);
        window.location.href = `room.html?code=${code}`;
      } else {
        alert('Sala não encontrada!');
      }
    } catch (error) {
      alert('Erro ao entrar na sala: ' + error.message);
    }
  });
}

// ==================== ROOM PAGE ====================
if (window.location.pathname.endsWith('room.html')) {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomCode = urlParams.get('code') || localStorage.getItem('roomCode');
  yourId = localStorage.getItem('yourId');

  if (!currentRoomCode || !yourId) {
    alert('Sessão inválida. Redirecionando...');
    window.location.href = 'index.html';
  }

  // Iniciar polling
  startPolling(currentRoomCode);

  // Buscar sala inicial
  fetch(`${API_BASE}/rooms/${currentRoomCode}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        handleRoomUpdate(data.room);
      }
    });

  // ===== BOTÕES =====
  document.getElementById('startRoundBtn')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms/${currentRoomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: yourId }),
      });
      // Polling vai atualizar automaticamente
    } catch (error) {
      console.error('Erro ao iniciar rodada:', error);
    }
  });

  document.getElementById('correctBtn')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms/${currentRoomCode}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: yourId }),
      });
      const data = await res.json();
      if (data.success) {
        handleRoundEnded(data.room, true);
      }
    } catch (error) {
      console.error('Erro ao marcar correto:', error);
    }
  });

  document.getElementById('skipBtn')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms/${currentRoomCode}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: yourId }),
      });
      const data = await res.json();
      if (data.success) {
        handleRoundEnded(data.room, false);
      }
    } catch (error) {
      console.error('Erro ao pular:', error);
    }
  });

  document.getElementById('playAgainBtn')?.addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE}/rooms/${currentRoomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: yourId }),
      });
    } catch (error) {
      console.error('Erro ao jogar novamente:', error);
    }
  });

  // Limpar polling ao sair
  window.addEventListener('beforeunload', () => {
    stopPolling();
  });
}

// ==================== HANDLERS ====================
function handleRoomUpdate(room) {
  roomState = room;

  if (window.location.pathname.endsWith('room.html')) {
    document.getElementById('roomCodeDisplay').textContent = `Sala: ${room.code}`;
    renderTeams(room.teams, room.activeTeamId);
    renderBoard(room.boardSize, room.teams);
    renderHistory(room.history);
    updateRoundInfo(room);
    updateButtons(room);

    // Timer
    if (room.inRound && room.roundEndsAt) {
      startTimer(room.roundEndsAt);
      
      // Mostrar carta para o desenhista
      const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
      const isDrawer = activeTeam?.players.some(p => p.id === yourId && p.id === room.activePlayerId);
      
      if (isDrawer && room.activeCard) {
        showCard(room);
      }
    } else {
      clearInterval(timerInterval);
    }

    // Verificar vitória
    if (room.winner) {
      showWinner(room.winner);
    }

    // Play Again
    const playAgainSection = document.getElementById('playAgainSection');
    const isHost = room.hostId === yourId;
    if (room.canPlayAgain && isHost) {
      playAgainSection.style.display = 'block';
    } else {
      playAgainSection.style.display = 'none';
    }
  }
}

function showCard(room) {
  const card = document.querySelector('.card-flip');
  const cardBack = card.querySelector('.card-back');
  
  const categoryName = getCategoryName(room.activeCard.category);
  const modeIcon = room.mode === 'Desenho' ? '✏️' : '🤹';
  
  cardBack.querySelector('.card-category').textContent = `${categoryName} (${room.activeCard.category})`;
  cardBack.querySelector('.card-word').textContent = room.activeCard.text;
  cardBack.querySelector('.card-mode').innerHTML = `${modeIcon} ${room.mode}`;
  cardBack.querySelector('.card-spaces').textContent = `+${room.activeCard.spaces} casas`;
  
  if (room.allPlayMode) {
    cardBack.querySelector('.card-mode').innerHTML += ' 👥 <strong>TODOS JOGAM!</strong>';
  }
  
  card.classList.add('flipped');
  setTimeout(() => card.classList.add('flipped'), 100);
}

function handleRoundEnded(room, wasCorrect) {
  const card = document.querySelector('.card-flip');
  card.classList.remove('flipped');
  
  if (wasCorrect) {
    showConfetti();
    const spaces = room.activeCard?.spaces || 1;
    alert(`🎉 Acertou! +${spaces} casas`);
  } else {
    alert('❌ Errou ou tempo esgotado');
  }
  
  clearInterval(timerInterval);
}

function getCategoryName(code) {
  const names = {
    P: "Pessoa/Lugar/Animal",
    O: "Objeto",
    A: "Ação",
    D: "Difícil",
    L: "Lazer",
    M: "Mix",
    T: "Todos Jogam"
  };
  return names[code] || code;
}

function getCategoryFromPosition(pos) {
  const categories = ["P", "O", "A", "D", "L", "M"];
  const todosJogamPositions = [0, 9, 18, 29];
  if (todosJogamPositions.includes(pos)) return "T";
  if (pos === 24) return "M";
  return categories[pos % categories.length];
}

// ==================== UI RENDERING ====================
function renderBoard(boardSize, teams) {
  const boardGrid = document.getElementById('boardGrid');
  if (!boardGrid) return;
  
  boardGrid.innerHTML = '';
  boardGrid.className = 'board-track';

  const path = [];
  for (let i = 0; i < 10; i++) path.push({ pos: i, row: 2, col: i });
  for (let i = 10; i < 13; i++) path.push({ pos: i, row: 2 - (i - 10), col: 9 });
  for (let i = 13; i < 23; i++) path.push({ pos: i, row: 0, col: 22 - i });
  for (let i = 23; i < 25; i++) path.push({ pos: i, row: i - 23, col: 0 });
  for (let i = 25; i < 30; i++) path.push({ pos: i, row: 1, col: i - 24 });

  const grid = Array(3).fill(null).map(() => Array(10).fill(null));
  path.forEach(({ pos, row, col }) => {
    grid[row][col] = pos;
  });

  grid.forEach((row, r) => {
    row.forEach((pos, c) => {
      const cell = document.createElement('div');
      
      if (pos === null) {
        cell.className = 'board-track-empty';
      } else {
        cell.className = 'board-track-cell';
        const category = getCategoryFromPosition(pos);
        cell.classList.add(`cat-${category}`);
        
        if (pos === 0) cell.classList.add('start');
        if (pos === 29) cell.classList.add('end');
        
        cell.innerHTML = `
          <div class="cell-number">${pos}</div>
          <div class="cell-cat">${category}</div>
          ${pos === 0 ? '<div class="cell-label">INÍCIO</div>' : ''}
          ${pos === 29 ? '<div class="cell-label">FIM</div>' : ''}
          ${category === 'T' ? '<div class="special-icon">👥</div>' : ''}
          ${category === 'M' && pos === 24 ? '<div class="special-icon">👥❓</div>' : ''}
        `;
        
        const markersDiv = document.createElement('div');
        markersDiv.className = 'team-markers';
        teams.forEach(team => {
          if (team.position === pos) {
            const marker = document.createElement('div');
            marker.className = 'team-marker';
            marker.style.backgroundColor = team.color;
            marker.title = team.name;
            markersDiv.appendChild(marker);
          }
        });
        cell.appendChild(markersDiv);
      }
      
      boardGrid.appendChild(cell);
    });
  });
}

function renderTeams(teams, activeTeamId) {
  const teamsList = document.getElementById('teamsList');
  if (!teamsList) return;
  
  teamsList.innerHTML = '';
  teams.forEach(team => {
    const teamDiv = document.createElement('div');
    teamDiv.className = 'team-item';
    if (team.id === activeTeamId) teamDiv.classList.add('active');
    
    teamDiv.innerHTML = `
      <div class="team-color" style="background: ${team.color};"></div>
      <div class="team-info">
        <div class="team-name">${team.name}</div>
        <div class="team-position">Posição: ${team.position}/29</div>
        <div class="team-players">${team.players.map(p => p.name).join(', ')}</div>
      </div>
    `;
    teamsList.appendChild(teamDiv);
  });
}

function renderHistory(history) {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  
  historyList.innerHTML = history.length === 0 
    ? '<div style="text-align: center; color: #666;">Nenhuma rodada ainda</div>'
    : '';
  
  history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const icon = h.success ? '✓' : '✗';
    const spacesText = h.success ? `+${h.spaces}` : '0';
    item.innerHTML = `
      <span class="history-icon ${h.success ? 'success' : 'fail'}">${icon}</span>
      <span class="history-text">${h.teamName} - ${h.card}</span>
      <span class="history-spaces">${spacesText}</span>
    `;
    historyList.appendChild(item);
  });
}

function updateRoundInfo(state) {
  const roundInfo = document.getElementById('roundInfo');
  if (!roundInfo) return;
  
  if (!state.inRound && !state.gameStarted) {
    roundInfo.innerHTML = '<p>Aguardando início...</p>';
    return;
  }
  
  if (!state.inRound && state.canPlayAgain) {
    roundInfo.innerHTML = '<p>✅ Acertou! Pode jogar novamente</p>';
    return;
  }
  
  if (!state.inRound) {
    roundInfo.innerHTML = '<p>Entre rodadas...</p>';
    return;
  }
  
  const activeTeam = state.teams.find(t => t.id === state.activeTeamId);
  const activePlayer = activeTeam.players.find(p => p.id === state.activePlayerId);
  const category = getCategoryFromPosition(activeTeam.position, state.boardSize);
  
  let html = `
    <p><strong>Equipe:</strong> ${activeTeam.name}</p>
    <p><strong>Desenhista:</strong> ${activePlayer.name}</p>
    <p><strong>Categoria:</strong> ${getCategoryName(category)}</p>
    <p><strong>Modo:</strong> ${state.mode}</p>
  `;
  
  if (state.allPlayMode) {
    html += `<p class="all-play-badge">👥 TODOS JOGAM!</p>`;
  }
  
  roundInfo.innerHTML = html;
}

function updateButtons(state) {
  const startBtn = document.getElementById('startRoundBtn');
  const correctBtn = document.getElementById('correctBtn');
  const skipBtn = document.getElementById('skipBtn');
  
  const isHost = state.hostId === yourId;
  
  if (startBtn) startBtn.style.display = (!state.inRound && !state.canPlayAgain && isHost) ? 'block' : 'none';
  if (correctBtn) correctBtn.style.display = (state.inRound && isHost) ? 'inline-block' : 'none';
  if (skipBtn) skipBtn.style.display = (state.inRound && isHost) ? 'inline-block' : 'none';
}

function startTimer(endsAt) {
  const timerBar = document.getElementById('timerBar');
  const timerText = document.getElementById('timerText');
  if (!timerBar || !timerText) return;
  
  clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    const remaining = Math.max(0, endsAt - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    const percent = (remaining / 60000) * 100;
    
    timerBar.style.width = percent + '%';
    timerText.textContent = `${seconds}s`;
    
    if (percent > 50) timerBar.className = 'timer-bar green';
    else if (percent > 20) timerBar.className = 'timer-bar yellow';
    else timerBar.className = 'timer-bar red';
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerText.textContent = 'Tempo esgotado!';
    }
  }, 100);
}

function rollDice() {
  const dice = document.querySelector('.dice');
  if (!dice) return;
  
  const result = Math.floor(Math.random() * 6) + 1;
  dice.className = 'dice';
  dice.classList.add(`show-${result}`);
  
  setTimeout(() => dice.className = 'dice', 3000);
}

function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  
  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.backgroundColor = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)];
    container.appendChild(confetti);
  }
  
  setTimeout(() => container.remove(), 5000);
}

function showWinner(winnerName) {
  document.getElementById('winnerText').textContent = `🏆 ${winnerName} venceu!`;
  document.getElementById('winnerBanner').style.display = 'flex';
  showConfetti();
  stopPolling();
}

// ===== DICE =====
document.getElementById('rollDiceBtn')?.addEventListener('click', rollDice);
