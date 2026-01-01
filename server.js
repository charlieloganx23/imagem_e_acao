const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Configuração CORS para produção
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware CORS para Express
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Carrega cartas
const words = JSON.parse(fs.readFileSync(path.join(__dirname, "words.json"), "utf-8"));

// Estado em memória (protótipo)
const rooms = new Map();
/**
 * rooms.get(code) = {
 *   code,
 *   hostId,
 *   teams: [{ id, name, color, position, players: [{ id, name }] }],
 *   boardSize: 30,
 *   inRound: boolean,
 *   activeTeamId: string|null,
 *   activePlayerId: string|null,
 *   activeCard: { category, text, spaces }|null,
 *   mode: "Desenho"|"Mímica"|null,
 *   roundEndsAt: number|null,
 *   history: [{ teamName, playerName, card, success, timestamp }],
 *   winner: string|null,
 *   gameStarted: boolean,
 *   canPlayAgain: boolean,
 *   allPlayMode: boolean
 * }
 */

function makeRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pickRandomCard(category = null) {
  const filtered = category ? words.filter(w => w.category === category) : words;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function pickRandomMode() {
  return Math.random() < 0.5 ? "Desenho" : "Mímica";
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

function getCategoryAtPosition(position, boardSize) {
  const categories = ["P", "O", "A", "D", "L", "M"];
  
  // Casas especiais "Todos Jogam" em posições estratégicas
  const todosJogamPositions = [0, 9, 18, 29]; // Início, meio-caminho, quase fim, e fim
  if (todosJogamPositions.includes(position)) return "T";
  
  // Casa especial "Mix + Escolha" na posição 24
  if (position === 24) return "M";
  
  return categories[position % categories.length];
}

function getPublicRoomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    teams: room.teams.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      position: t.position,
      players: t.players.map(p => ({ id: p.id, name: p.name }))
    })),
    boardSize: room.boardSize,
    inRound: room.inRound,
    activeTeamId: room.activeTeamId,
    activePlayerId: room.activePlayerId,
    mode: room.mode,
    activeCategory: room.activeCard ? room.activeCard.category : null,
    activeSpaces: room.activeCard ? room.activeCard.spaces : null,
    roundEndsAt: room.roundEndsAt,
    history: room.history.slice(-5), // Últimas 5 rodadas
    winner: room.winner,
    gameStarted: room.gameStarted || false,
    canPlayAgain: room.canPlayAgain || false,
    allPlayMode: room.allPlayMode || false
  };
}

function emitRoom(room) {
  io.to(room.code).emit("room:update", getPublicRoomState(room));
  // Envia a carta completa SOMENTE ao jogador ativo
  if (room.inRound && room.activePlayerId && room.activeCard) {
    const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
    
    // Se for modo "Todos Jogam", envia para todos
    if (room.allPlayMode) {
      io.to(room.code).emit("round:card", {
        category: room.activeCard.category,
        categoryName: getCategoryName(room.activeCard.category),
        text: room.activeCard.text,
        spaces: room.activeCard.spaces,
        mode: room.mode,
        roundEndsAt: room.roundEndsAt,
        teamPosition: activeTeam ? activeTeam.position : 0,
        allPlay: true
      });
    } else {
      // Modo normal: só o desenhista vê
      io.to(room.activePlayerId).emit("round:card", {
        category: room.activeCard.category,
        categoryName: getCategoryName(room.activeCard.category),
        text: room.activeCard.text,
        spaces: room.activeCard.spaces,
        mode: room.mode,
        roundEndsAt: room.roundEndsAt,
        teamPosition: activeTeam ? activeTeam.position : 0,
        allPlay: false
      });
    }
  }
}

io.on("connection", (socket) => {
  // Criar sala
  socket.on("room:create", ({ name, numTeams = 2 }) => {
    const safeName = String(name || "").trim().slice(0, 24) || "Host";
    let code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();

    const teams = [];
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
    for (let i = 0; i < Math.min(6, Math.max(2, numTeams)); i++) {
      teams.push({
        id: `team${i + 1}`,
        name: `Equipe ${i + 1}`,
        color: colors[i],
        position: 0,
        players: []
      });
    }

    // Host entra na primeira equipe
    teams[0].players.push({ id: socket.id, name: safeName });

    const room = {
      code,
      hostId: socket.id,
      teams,
      boardSize: 30,
      inRound: false,
      activeTeamId: null,
      activePlayerId: null,
      activeCard: null,
      mode: null,
      roundEndsAt: null,
      history: [],
      winner: null,
      gameStarted: false,
      canPlayAgain: false,
      allPlayMode: false
    };

    rooms.set(code, room);
    socket.join(code);

    socket.emit("room:joined", { code, youAreHost: true });
    emitRoom(room);
  });

  // Entrar em sala
  socket.on("room:join", ({ code, name, teamId }) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error:toast", "Sala não encontrada. Verifique o código.");
      return;
    }

    const safeName = String(name || "").trim().slice(0, 24) || "Jogador";

    // Remove de qualquer equipe anterior (se reconectando)
    room.teams.forEach(t => {
      t.players = t.players.filter(p => p.id !== socket.id);
    });

    // Adiciona à equipe especificada ou à primeira com menos jogadores
    let targetTeam;
    if (teamId) {
      targetTeam = room.teams.find(t => t.id === teamId);
    }
    if (!targetTeam) {
      targetTeam = room.teams.reduce((min, t) => t.players.length < min.players.length ? t : min);
    }

    targetTeam.players.push({ id: socket.id, name: safeName });

    socket.join(roomCode);
    socket.emit("room:joined", { code: roomCode, youAreHost: room.hostId === socket.id });
    emitRoom(room);
  });

  // Reconectar em sala
  socket.on("room:rejoin", ({ code }) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error:toast", "Sala não encontrada.");
      return;
    }
    socket.join(roomCode);
    socket.emit("room:joined", { code: roomCode, youAreHost: room.hostId === socket.id });
    emitRoom(room);
  });

  // Iniciar rodada (host)
  socket.on("round:start", ({ code, seconds }) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("error:toast", "Somente o host pode iniciar a rodada.");
      return;
    }
    if (room.winner) {
      socket.emit("error:toast", "O jogo já terminou!");
      return;
    }

    const totalPlayers = room.teams.reduce((sum, t) => sum + t.players.length, 0);
    if (totalPlayers < 2) {
      socket.emit("error:toast", "Entre com pelo menos 2 jogadores para iniciar.");
      return;
    }

    const duration = Math.max(15, Math.min(180, Number(seconds || 60)));

    // Determina próxima equipe
    let teamIndex;
    if (room.activeTeamId) {
      const current = room.teams.findIndex(t => t.id === room.activeTeamId);
      teamIndex = (current + 1) % room.teams.length;
    } else {
      teamIndex = 0;
    }

    const activeTeam = room.teams[teamIndex];

    // Determina próximo jogador da equipe
    let playerIndex;
    if (room.activePlayerId && activeTeam.players.some(p => p.id === room.activePlayerId)) {
      const current = activeTeam.players.findIndex(p => p.id === room.activePlayerId);
      playerIndex = (current + 1) % activeTeam.players.length;
    } else {
      playerIndex = 0;
    }

    const activePlayer = activeTeam.players[playerIndex];
    if (!activePlayer) {
      socket.emit("error:toast", "Equipe sem jogadores.");
      return;
    }

    // Determina categoria baseada na posição da equipe
    const category = getCategoryAtPosition(activeTeam.position, room.boardSize);
    const card = pickRandomCard(category);

    // Verifica se é casa "Todos Jogam"
    const isAllPlaySquare = category === "T";

    room.activeTeamId = activeTeam.id;
    room.activePlayerId = activePlayer.id;
    room.activeCard = card;
    room.mode = pickRandomMode();
    room.inRound = true;
    room.roundEndsAt = Date.now() + duration * 1000;
    room.gameStarted = true;
    room.canPlayAgain = false;
    room.allPlayMode = isAllPlaySquare;

    emitRoom(room);

    // Auto-encerrar (se ninguém encerrar antes)
    setTimeout(() => {
      const r = rooms.get(room.code);
      if (!r) return;
      if (r.inRound && r.roundEndsAt && Date.now() >= r.roundEndsAt) {
        const activeTeam = r.teams.find(t => t.id === r.activeTeamId);
        const activePlayer = activeTeam ? activeTeam.players.find(p => p.id === r.activePlayerId) : null;
        
        // Adiciona ao histórico
        r.history.push({
          teamName: activeTeam ? activeTeam.name : "?",
          playerName: activePlayer ? activePlayer.name : "?",
          card: `${getCategoryName(r.activeCard.category)}: ${r.activeCard.text}`,
          spaces: 0,
          success: false,
          timestamp: Date.now()
        });

        r.inRound = false;
        r.activeCard = null;
        r.mode = null;
        r.roundEndsAt = null;
        r.canPlayAgain = false;
        r.allPlayMode = false;
        
        emitRoom(r);
        io.to(room.code).emit('round:ended', {
          reason: 'timeout',
          teamName: activeTeam ? activeTeam.name : null,
          playerName: activePlayer ? activePlayer.name : null,
          canPlayAgain: false
        });
      }
    }, duration * 1000 + 250);
  });

  // Marcar ACERTO (host)
  socket.on("round:correct", ({ code }) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("error:toast", "Somente o host pode marcar acerto.");
      return;
    }
    if (!room.inRound) return;

    const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
    if (!activeTeam) return;

    const activePlayer = activeTeam.players.find(p => p.id === room.activePlayerId);

    // Avança no tabuleiro com o número de casas da carta
    const spacesToMove = room.activeCard.spaces || 1;
    activeTeam.position += spacesToMove;

    // Adiciona ao histórico
    room.history.push({
      teamName: activeTeam.name,
      playerName: activePlayer ? activePlayer.name : "?",
      card: `${getCategoryName(room.activeCard.category)}: ${room.activeCard.text}`,
      spaces: spacesToMove,
      success: true,
      timestamp: Date.now()
    });

    // Verifica vitória
    if (activeTeam.position >= room.boardSize) {
      room.winner = activeTeam.name;
      room.inRound = false;
      room.activeCard = null;
      room.mode = null;
      room.roundEndsAt = null;
      room.canPlayAgain = false;
      room.allPlayMode = false;
      emitRoom(room);
      io.to(room.code).emit('game:winner', {
        teamName: activeTeam.name,
        teamColor: activeTeam.color
      });
      return;
    }

    // Encerrar a rodada e permitir jogar novamente
    room.inRound = false;
    room.activeCard = null;
    room.mode = null;
    room.roundEndsAt = null;
    room.canPlayAgain = true; // Permite jogar novamente!
    room.allPlayMode = false;

    emitRoom(room);
    io.to(room.code).emit('round:ended', {
      reason: 'correct',
      teamName: activeTeam.name,
      playerName: activePlayer ? activePlayer.name : null,
      spaces: spacesToMove,
      canPlayAgain: true
    });
  });

  // Pular/Errar (host) — passa para próxima equipe
  socket.on("round:skip", ({ code }) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("error:toast", "Somente o host pode marcar erro.");
      return;
    }
    if (!room.inRound) return;

    const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
    if (!activeTeam) return;

    const activePlayer = activeTeam.players.find(p => p.id === room.activePlayerId);

    // Adiciona ao histórico como erro
    room.history.push({
      teamName: activeTeam.name,
      playerName: activePlayer ? activePlayer.name : "?",
      card: `${getCategoryName(room.activeCard.category)}: ${room.activeCard.text}`,
      spaces: 0,
      success: false,
      timestamp: Date.now()
    });

    // Encerra rodada e passa para próxima equipe
    room.inRound = false;
    room.activeCard = null;
    room.mode = null;
    room.roundEndsAt = null;
    room.canPlayAgain = false;
    room.allPlayMode = false;

    emitRoom(room);
    io.to(room.code).emit('round:ended', {
      reason: 'skip',
      teamName: activeTeam.name,
      playerName: activePlayer ? activePlayer.name : null,
      canPlayAgain: false
    });
  });

  // Encerrar rodada (host)
  socket.on("round:end", ({ code }) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("error:toast", "Somente o host pode encerrar.");
      return;
    }

    // Adiciona ao histórico como erro
    if (room.inRound && room.activeCard) {
      const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
      const activePlayer = activeTeam ? activeTeam.players.find(p => p.id === room.activePlayerId) : null;
      room.history.push({
        teamName: activeTeam ? activeTeam.name : "?",
        playerName: activePlayer ? activePlayer.name : "?",
        card: `${getCategoryName(room.activeCard.category)}: ${room.activeCard.text}`,
        spaces: 0,
        success: false,
        timestamp: Date.now()
      });
    }

    room.inRound = false;
    room.activeCard = null;
    room.mode = null;
    room.roundEndsAt = null;
    room.canPlayAgain = false;
    room.allPlayMode = false;

    emitRoom(room);
  });

  // Desconexão
  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      let changed = false;
      
      // Remove jogador de todas as equipes
      room.teams.forEach(team => {
        const before = team.players.length;
        team.players = team.players.filter(p => p.id !== socket.id);
        if (before !== team.players.length) changed = true;
      });

      if (changed) {
        // Promove novo host se necessário
        if (room.hostId === socket.id) {
          let newHost = null;
          for (const team of room.teams) {
            if (team.players.length > 0) {
              newHost = team.players[0].id;
              break;
            }
          }
          room.hostId = newHost;
        }

        // Encerra rodada se jogador ativo saiu
        if (room.activePlayerId === socket.id) {
          room.inRound = false;
          room.activePlayerId = null;
          room.activeCard = null;
          room.mode = null;
          room.roundEndsAt = null;
        }

        // Verifica se sala está vazia
        const totalPlayers = room.teams.reduce((sum, t) => sum + t.players.length, 0);
        if (totalPlayers === 0) {
          rooms.delete(code);
        } else {
          emitRoom(room);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
