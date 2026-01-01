const socket = io();

let currentRoomCode = null;
let yourId = null;
let roomState = null;
let timerInterval = null;
let diceRolls = {};

// ==================== INDEX PAGE ====================
if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
  document.getElementById('createRoomBtn')?.addEventListener('click', () => {
    const name = document.getElementById('createName').value.trim();
    const numTeams = Number(document.getElementById('numTeams').value) || 2;
    if (!name) {
      alert('Digite seu nome!');
      return;
    }
    socket.emit('room:create', { name, numTeams });
  });

  document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
    const name = document.getElementById('joinName').value.trim();
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    if (!name || !code) {
      alert('Preencha nome e código!');
      return;
    }
    socket.emit('room:join', { name, code });
  });

  socket.on('room:joined', ({ code }) => {
    window.location.href = `/room.html?code=${encodeURIComponent(code)}`;
  });

  socket.on('error:toast', (msg) => {
    alert(msg);
  });
}

// ==================== ROOM PAGE ====================
if (window.location.pathname.endsWith('room.html')) {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomCode = urlParams.get('code');

  socket.on('connect', () => {
    yourId = socket.id;
    if (currentRoomCode) {
      socket.emit('room:rejoin', { code: currentRoomCode });
    }
  });

  // Copy room code
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    alert('Código copiado!');
  });

  // Update room state
  socket.on('room:update', (state) => {
    roomState = state;
    document.getElementById('roomCode').textContent = state.code;

    // Render teams
    renderTeams(state.teams, state.activeTeamId);

    // Render board
    renderBoard(state.boardSize, state.teams);

    // Render history
    renderHistory(state.history || []);

    // Update round info
    updateRoundInfo(state);

    // Show/hide dice section (apenas antes do jogo começar)
    const diceSection = document.getElementById('diceSection');
    if (!state.gameStarted && state.teams.length >= 2) {
      diceSection.style.display = 'block';
    } else {
      diceSection.style.display = 'none';
    }

    // Show/hide play again button (apenas para host)
    const playAgainSection = document.getElementById('playAgainSection');
    const isHost = state.hostId === yourId;
    if (state.canPlayAgain && state.activeTeamId && isHost) {
      playAgainSection.style.display = 'block';
    } else {
      playAgainSection.style.display = 'none';
    }

    // Button visibility
    updateButtons(state);

    // Timer
    if (state.roundEndsAt) {
      startTimer(state.roundEndsAt);
    } else {
      stopTimer();
    }

    // Winner
    if (state.winner) {
      showWinner(state.winner);
    }
  });

  // Receive card (only active player or all in T mode)
  socket.on('round:card', (data) => {
    const bigCard = document.getElementById('bigCard');
    const cardCategory = bigCard.querySelector('.card-category');
    const cardWord = bigCard.querySelector('.card-word');
    const cardMode = bigCard.querySelector('.card-mode');
    const cardSpaces = bigCard.querySelector('.card-spaces');

    // Define border color
    const colors = {
      P: '#3b82f6',
      O: '#10b981',
      A: '#f59e0b',
      D: '#ef4444',
      L: '#8b5cf6',
      T: '#ec4899'
    };

    bigCard.querySelector('.card-back').style.borderColor = colors[data.category] || '#666';

    cardCategory.textContent = data.categoryName;
    cardWord.textContent = data.text;
    cardMode.textContent = `Modo: ${data.mode}`;
    cardSpaces.textContent = `Avança ${data.spaces} ${data.spaces === 1 ? 'casa' : 'casas'}`;

    if (data.allPlay) {
      cardSpaces.innerHTML += '<br><strong style="color: #ec4899;">🔥 TODOS JOGAM!</strong>';
    }

    // Reset flip
    bigCard.classList.remove('flipped');
    playCardFlipSound();

    // Auto-flip after 1 second
    setTimeout(() => {
      bigCard.classList.add('flipped');
    }, 1000);
  });

  // Round ended
  socket.on('round:ended', (data) => {
    const bigCard = document.getElementById('bigCard');
    bigCard.classList.remove('flipped');

    if (data.reason === 'correct') {
      showConfetti();
      if (data.spaces) {
        alert(`🎉 ${data.teamName} acertou e avançou ${data.spaces} ${data.spaces === 1 ? 'casa' : 'casas'}!`);
      }
    }
  });

  // Winner event
  socket.on('game:winner', (data) => {
    showWinner(data.teamName);
    showConfetti();
  });

  // Button handlers
  document.getElementById('startRoundBtn')?.addEventListener('click', () => {
    socket.emit('round:start', { code: currentRoomCode, duration: 60 });
  });

  document.getElementById('correctBtn')?.addEventListener('click', () => {
    socket.emit('round:correct', { code: currentRoomCode });
  });

  document.getElementById('skipBtn')?.addEventListener('click', () => {
    socket.emit('round:skip', { code: currentRoomCode });
  });

  document.getElementById('playAgainBtn')?.addEventListener('click', () => {
    socket.emit('round:start', { code: currentRoomCode, duration: 60 });
  });

  // Dice roll
  document.getElementById('rollDiceBtn')?.addEventListener('click', () => {
    rollDice();
  });

  // Click to flip card
  document.getElementById('bigCard')?.addEventListener('click', (e) => {
    const card = document.getElementById('bigCard');
    if (card.classList.contains('flipped')) {
      card.classList.remove('flipped');
    } else {
      card.classList.add('flipped');
    }
  });
}

// ==================== RENDERING FUNCTIONS ====================

function renderTeams(teams, activeTeamId) {
  const container = document.getElementById('teamsList');
  if (!container) return;

  container.innerHTML = teams.map(team => {
    const isActive = team.id === activeTeamId;
    const players = team.players.map(p => p.name).join(', ') || 'Nenhum jogador';
    return `
      <div class="team-item ${isActive ? 'active' : ''}" style="border-left: 4px solid ${team.color}">
        <div class="team-name">${team.name}</div>
        <div class="team-position">Casa ${team.position}</div>
        <div class="team-players">${players}</div>
      </div>
    `;
  }).join('');
}

function renderBoard(boardSize, teams) {
  const container = document.getElementById('boardGrid');
  if (!container) return;

  const categories = ['P', 'O', 'A', 'D', 'L', 'M'];
  const categoryColors = {
    P: '#3b82f6',
    O: '#10b981',
    A: '#f59e0b',
    D: '#ef4444',
    L: '#8b5cf6',
    M: '#ec4899',
    T: '#a855f7'
  };

  // Define posições em trilha oval (3 faixas)
  const path = [];
  
  // Faixa inferior (esquerda para direita): 0-9
  for (let i = 0; i <= 9; i++) {
    path.push({ x: i, y: 2, pos: i });
  }
  
  // Curva direita (subindo): 10-12
  for (let i = 1; i >= 0; i--) {
    path.push({ x: 9, y: i, pos: 10 + (1 - i) });
  }
  
  // Faixa superior (direita para esquerda): 13-22
  for (let i = 8; i >= 0; i--) {
    path.push({ x: i, y: 0, pos: 13 + (8 - i) });
  }
  
  // Curva esquerda (descendo): 23-24
  for (let i = 1; i <= 1; i++) {
    path.push({ x: 0, y: i, pos: 23 + i });
  }
  
  // Faixa intermediária (esquerda para direita): 25-29
  for (let i = 1; i <= 5; i++) {
    path.push({ x: i, y: 1, pos: 25 + (i - 1) });
  }

  // Cria grid 10x3
  let html = '<div class="board-track">';
  
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 10; x++) {
      const cell = path.find(p => p.x === x && p.y === y);
      
      if (cell) {
        const pos = cell.pos;
        const cat = getCategoryFromPosition(pos);
        const color = categoryColors[cat];
        
        // Casas especiais
        const isStart = pos === 0;
        const isEnd = pos === 29;
        const isTodosJogam = [0, 9, 18, 29].includes(pos);
        const isMix = pos === 24;
        
        // Times nesta casa
        const teamsHere = teams.filter(t => t.position === pos);
        const markers = teamsHere.map(t => `<span class="team-marker" style="background: ${t.color}"></span>`).join('');
        
        let specialIcon = '';
        if (isTodosJogam) {
          specialIcon = '<span class="special-icon">👥</span>';
        } else if (isMix) {
          specialIcon = '<span class="special-icon">👥❓</span>';
        }
        
        html += `
          <div class="board-track-cell ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''}" 
               style="background: white; border: 3px solid ${color}; box-shadow: 0 0 10px ${color}44;">
            <div class="cell-number">${pos}</div>
            <div class="cell-cat" style="color: ${color}">${cat}</div>
            ${specialIcon}
            ${markers ? `<div class="cell-markers-track">${markers}</div>` : ''}
            ${isStart ? '<div class="cell-label">INÍCIO</div>' : ''}
            ${isEnd ? '<div class="cell-label">FIM</div>' : ''}
          </div>
        `;
      } else {
        html += '<div class="board-track-empty"></div>';
      }
    }
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function getCategoryFromPosition(pos) {
  const categories = ['P', 'O', 'A', 'D', 'L', 'M'];
  
  // Casas especiais
  if ([0, 9, 18, 29].includes(pos)) return 'T';
  if (pos === 24) return 'M';
  
  return categories[pos % categories.length];
}

function renderHistory(history) {
  const container = document.getElementById('historyList');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<p style="opacity: 0.6; text-align: center;">Nenhuma rodada ainda</p>';
    return;
  }

  container.innerHTML = history.slice(-5).reverse().map(h => {
    const icon = h.success ? '✓' : '✗';
    const color = h.success ? '#10b981' : '#ef4444';
    const spacesText = h.spaces ? ` (+${h.spaces})` : '';
    return `
      <div class="history-item">
        <span style="color: ${color}; font-weight: bold;">${icon}</span>
        <strong>${h.teamName}</strong> (${h.playerName})<br>
        <span style="font-size: 0.9em; opacity: 0.8;">${h.card}${spacesText}</span>
      </div>
    `;
  }).join('');
}

function updateRoundInfo(state) {
  const container = document.getElementById('roundInfo');
  if (!container) return;

  if (!state.inRound && !state.activeTeamId) {
    container.innerHTML = '<p style="text-align: center; opacity: 0.7;">⏸️ Aguardando início da rodada...</p>';
    return;
  }

  const activeTeam = state.teams.find(t => t.id === state.activeTeamId);
  const activePlayer = activeTeam ? activeTeam.players.find(p => p.id === state.activePlayerId) : null;

  if (state.inRound) {
    const iAmActive = state.activePlayerId === yourId;
    container.innerHTML = `
      <h3>🎯 Rodada Atual</h3>
      <div style="margin: 10px 0;">
        <strong style="color: ${activeTeam.color};">Equipe: ${activeTeam.name}</strong><br>
        <span>Desenhista: ${activePlayer ? activePlayer.name : '?'}</span><br>
        <span>Categoria: ${state.activeCategory ? getCategoryName(state.activeCategory) : '?'}</span><br>
        <span>Modo: ${state.mode || '?'}</span>
      </div>
      ${iAmActive ? '<div class="badge-you" style="background: #10b981; color: white; padding: 5px 10px; border-radius: 5px; display: inline-block; margin-top: 10px;">👤 Você é o desenhista!</div>' : ''}
      ${state.allPlayMode ? '<div class="badge-allplay" style="background: #ec4899; color: white; padding: 5px 10px; border-radius: 5px; display: inline-block; margin-top: 10px;">🔥 TODOS JOGAM!</div>' : ''}
    `;
  } else if (activeTeam) {
    container.innerHTML = `
      <h3>⏭️ Próxima Equipe</h3>
      <div style="margin: 10px 0;">
        <strong style="color: ${activeTeam.color};">Equipe: ${activeTeam.name}</strong><br>
        <span>Desenhista: ${activePlayer ? activePlayer.name : '?'}</span>
      </div>
    `;
  }
}

function updateButtons(state) {
  const startBtn = document.getElementById('startRoundBtn');
  const correctBtn = document.getElementById('correctBtn');
  const skipBtn = document.getElementById('skipBtn');

  if (!startBtn || !correctBtn || !skipBtn) return;

  // Apenas o host pode ver e usar os botões
  const isHost = state.hostId === yourId;
  
  if (!isHost) {
    startBtn.style.display = 'none';
    correctBtn.style.display = 'none';
    skipBtn.style.display = 'none';
    return;
  }

  if (state.inRound) {
    startBtn.style.display = 'none';
    correctBtn.style.display = 'inline-block';
    skipBtn.style.display = 'inline-block';
  } else {
    startBtn.style.display = 'inline-block';
    correctBtn.style.display = 'none';
    skipBtn.style.display = 'none';
  }
}

// ==================== TIMER ====================

function startTimer(roundEndsAt) {
  stopTimer();
  
  timerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, roundEndsAt - now);
    const seconds = Math.ceil(remaining / 1000);

    const timerText = document.getElementById('timerText');
    const timerBar = document.getElementById('timerBar');
    
    if (timerText) {
      timerText.textContent = `⏱️ ${seconds}s`;
    }
    
    if (timerBar) {
      const percent = (remaining / 60000) * 100;
      timerBar.style.width = `${Math.max(0, percent)}%`;
      
      if (seconds <= 10) {
        timerBar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      } else if (seconds <= 30) {
        timerBar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        timerBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
      }
    }

    if (remaining === 0) {
      stopTimer();
    }
  }, 300);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  const timerText = document.getElementById('timerText');
  const timerBar = document.getElementById('timerBar');
  
  if (timerText) timerText.textContent = '';
  if (timerBar) timerBar.style.width = '0%';
}

// ==================== DICE ROLL ====================

function rollDice() {
  const dice = document.getElementById('dice');
  const resultDiv = document.getElementById('diceResult');
  const btn = document.getElementById('rollDiceBtn');
  
  if (!dice || !resultDiv) return;

  // Disable button
  btn.disabled = true;
  resultDiv.innerHTML = '';

  // Random rotations
  const rotations = [
    { x: 0, y: 0, z: 0, value: 1 },      // Front
    { x: 0, y: 180, z: 0, value: 6 },    // Back
    { x: 0, y: -90, z: 0, value: 3 },    // Right
    { x: 0, y: 90, z: 0, value: 4 },     // Left
    { x: -90, y: 0, z: 0, value: 5 },    // Top
    { x: 90, y: 0, z: 0, value: 2 }      // Bottom
  ];

  const random = rotations[Math.floor(Math.random() * rotations.length)];
  
  // Multiple spins for effect
  const extraSpins = 1080; // 3 full rotations
  dice.style.transform = `rotateX(${random.x + extraSpins}deg) rotateY(${random.y + extraSpins}deg) rotateZ(${random.z}deg)`;

  setTimeout(() => {
    resultDiv.innerHTML = `<strong style="color: #10b981; font-size: 1.2em;">🎲 Resultado: ${random.value}</strong><br>
    <span style="font-size: 0.9em; opacity: 0.8;">Maior número começa!</span>`;
    btn.disabled = false;
  }, 2000);
}

// ==================== HELPERS ====================

function getCategoryName(cat) {
  const names = {
    P: 'Pessoa/Lugar/Animal',
    O: 'Objeto',
    A: 'Ação',
    D: 'Difícil',
    L: 'Lazer',
    M: 'Mix',
    T: 'Todos Jogam'
  };
  return names[cat] || cat;
}

function showWinner(teamName) {
  const banner = document.getElementById('winnerBanner');
  const text = document.getElementById('winnerText');
  const subtext = document.getElementById('winnerSubtext');
  
  if (banner && text) {
    text.textContent = `🎉 ${teamName} Venceu!`;
    if (subtext) {
      subtext.textContent = 'Parabéns! Vocês chegaram ao final do tabuleiro! 🏆';
    }
    banner.style.display = 'flex';
  }
}

function showConfetti() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-container';
  document.body.appendChild(confetti);

  const shapes = ['●', '■', '▲', '★', '♦'];
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  for (let i = 0; i < 100; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    piece.style.cssText = `
      position: fixed;
      top: -20px;
      left: ${Math.random() * 100}vw;
      color: ${colors[Math.floor(Math.random() * colors.length)]};
      font-size: ${Math.random() * 20 + 15}px;
      animation: fall ${Math.random() * 3 + 2}s linear forwards;
      opacity: ${Math.random() * 0.5 + 0.5};
      z-index: 99999;
    `;
    confetti.appendChild(piece);
  }

  setTimeout(() => confetti.remove(), 5000);
}

function playCardFlipSound() {
  // Placeholder for sound effect
  // You can add Web Audio API here
}
