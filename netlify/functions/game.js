// Netlify Function para gerenciar estado do jogo via Upstash Redis
// Requer Upstash Redis (gratuito): https://upstash.com

const { Redis } = require('@upstash/redis');
const words = require('../../words.json');

// Cliente Redis serverless
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/game', '');
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // POST /rooms - Criar sala
    if (path === '/rooms' && method === 'POST') {
      const { name, numTeams } = body;
      const code = generateCode();
      const playerId = generateId();
      
      const room = {
        code,
        hostId: playerId,
        teams: createTeams(numTeams),
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
        allPlayMode: false,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
      };

      // Adicionar host à primeira equipe
      room.teams[0].players.push({ id: playerId, name });

      await redis.set(`room:${code}`, JSON.stringify(room), { ex: 7200 }); // 2 horas
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, room, playerId }),
      };
    }

    // GET /rooms/:code - Obter sala
    if (path.startsWith('/rooms/') && path.split('/').length === 3 && method === 'GET') {
      const code = path.split('/')[2];
      const roomData = await redis.get(`room:${code}`);
      
      if (!roomData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Sala não encontrada' }),
        };
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, room }),
      };
    }

    // POST /rooms/:code/join - Entrar na sala
    if (path.match(/^\/rooms\/[^/]+\/join$/) && method === 'POST') {
      const code = path.split('/')[2];
      const { name, teamId } = body;
      const playerId = generateId();
      
      const roomData = await redis.get(`room:${code}`);
      if (!roomData) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Sala não encontrada' }) };
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      
      let targetTeam = room.teams.find(t => t.id === teamId);
      if (!targetTeam) {
        // Auto-balancear
        targetTeam = room.teams.reduce((min, t) => t.players.length < min.players.length ? t : min, room.teams[0]);
      }
      
      targetTeam.players.push({ id: playerId, name });
      room.lastUpdate = Date.now();
      
      await redis.set(`room:${code}`, JSON.stringify(room), { ex: 7200 });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, room, playerId }),
      };
    }

    // POST /rooms/:code/start - Iniciar rodada
    if (path.match(/^\/rooms\/[^/]+\/start$/) && method === 'POST') {
      const code = path.split('/')[2];
      const { playerId } = body;
      
      const roomData = await redis.get(`room:${code}`);
      if (!roomData) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Sala não encontrada' }) };
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      
      if (room.hostId !== playerId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Apenas o host pode iniciar' }) };
      }

      if (room.canPlayAgain) {
        room.canPlayAgain = false;
      } else {
        const nextData = getNextTeamAndPlayer(room);
        room.activeTeamId = nextData.teamId;
        room.activePlayerId = nextData.playerId;
      }

      const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
      const category = getCategoryAtPosition(activeTeam.position, room.boardSize);
      
      room.allPlayMode = category === 'T';
      room.activeCard = pickRandomCard(category === 'M' ? null : category);
      room.mode = pickRandomMode();
      room.roundEndsAt = Date.now() + 60000;
      room.inRound = true;
      room.gameStarted = true;
      room.lastUpdate = Date.now();
      
      await redis.set(`room:${code}`, JSON.stringify(room), { ex: 7200 });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, room }),
      };
    }

    // POST /rooms/:code/correct - Acertou
    if (path.match(/^\/rooms\/[^/]+\/correct$/) && method === 'POST') {
      const code = path.split('/')[2];
      const { playerId } = body;
      
      const roomData = await redis.get(`room:${code}`);
      if (!roomData) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Sala não encontrada' }) };
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      
      if (room.hostId !== playerId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Apenas o host pode marcar' }) };
      }

      const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
      const activePlayer = activeTeam.players.find(p => p.id === room.activePlayerId);
      const spacesToMove = room.activeCard.spaces || 1;
      
      activeTeam.position += spacesToMove;
      
      room.history.unshift({
        teamName: activeTeam.name,
        playerName: activePlayer.name,
        card: room.activeCard.text,
        success: true,
        spaces: spacesToMove,
        timestamp: Date.now(),
      });
      
      if (room.history.length > 5) room.history.pop();
      
      if (activeTeam.position >= room.boardSize) {
        room.winner = activeTeam.name;
        room.inRound = false;
      } else {
        room.canPlayAgain = true;
        room.inRound = false;
      }
      
      room.activeCard = null;
      room.roundEndsAt = null;
      room.lastUpdate = Date.now();
      
      await redis.set(`room:${code}`, JSON.stringify(room), { ex: 7200 });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, room }),
      };
    }

    // POST /rooms/:code/skip - Pular/Errou
    if (path.match(/^\/rooms\/[^/]+\/skip$/) && method === 'POST') {
      const code = path.split('/')[2];
      const { playerId } = body;
      
      const roomData = await redis.get(`room:${code}`);
      if (!roomData) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Sala não encontrada' }) };
      }

      const room = typeof roomData === 'string' ? JSON.parse(roomData) : roomData;
      
      if (room.hostId !== playerId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Apenas o host pode pular' }) };
      }

      const activeTeam = room.teams.find(t => t.id === room.activeTeamId);
      const activePlayer = activeTeam.players.find(p => p.id === room.activePlayerId);
      
      room.history.unshift({
        teamName: activeTeam.name,
        playerName: activePlayer.name,
        card: room.activeCard.text,
        success: false,
        spaces: 0,
        timestamp: Date.now(),
      });
      
      if (room.history.length > 5) room.history.pop();
      
      room.activeCard = null;
      room.roundEndsAt = null;
      room.inRound = false;
      room.canPlayAgain = false;
      room.lastUpdate = Date.now();
      
      await redis.set(`room:${code}`, JSON.stringify(room), { ex: 7200 });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, room }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// ========== HELPERS ==========

function generateCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function createTeams(numTeams) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const teams = [];
  
  for (let i = 0; i < numTeams; i++) {
    teams.push({
      id: `team-${i + 1}`,
      name: `Equipe ${i + 1}`,
      color: colors[i],
      position: 0,
      players: [],
    });
  }
  
  return teams;
}

function pickRandomCard(category = null) {
  const filtered = category ? words.filter(w => w.category === category) : words;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function pickRandomMode() {
  return Math.random() < 0.5 ? "Desenho" : "Mímica";
}

function getCategoryAtPosition(position, boardSize) {
  const categories = ["P", "O", "A", "D", "L", "M"];
  const todosJogamPositions = [0, 9, 18, 29];
  if (todosJogamPositions.includes(position)) return "T";
  if (position === 24) return "M";
  return categories[position % categories.length];
}

function getNextTeamAndPlayer(room) {
  if (!room.activeTeamId) {
    return {
      teamId: room.teams[0].id,
      playerId: room.teams[0].players[0].id,
    };
  }

  const currentTeamIdx = room.teams.findIndex(t => t.id === room.activeTeamId);
  const currentTeam = room.teams[currentTeamIdx];
  const currentPlayerIdx = currentTeam.players.findIndex(p => p.id === room.activePlayerId);

  if (currentPlayerIdx < currentTeam.players.length - 1) {
    return {
      teamId: currentTeam.id,
      playerId: currentTeam.players[currentPlayerIdx + 1].id,
    };
  }

  const nextTeamIdx = (currentTeamIdx + 1) % room.teams.length;
  const nextTeam = room.teams[nextTeamIdx];
  return {
    teamId: nextTeam.id,
    playerId: nextTeam.players[0].id,
  };
}
