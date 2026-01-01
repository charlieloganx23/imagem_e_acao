# 🎨 Imagem & Ação Online

Jogo clássico **Imagem & Ação** adaptado para jogar online em família, com design inspirado no **Imagem & Ação 2 da Grow**.

## ✨ Funcionalidades

### 🎮 Gameplay Completo
- ✅ Sistema de **2-6 equipes** competindo
- ✅ **Tabuleiro oval** em 3 faixas (30 casas) estilo Grow
- ✅ Categorias **P.O.A.D.L.M.T** (Pessoa, Objeto, Ação, Difícil, Lazer, Mix, Todos Jogam)
- ✅ Cartas com **1-3 casas** de avanço
- ✅ Sistema **"Jogar novamente"** ao acertar (regra original)
- ✅ Modo **"Todos Jogam"** nas casas especiais (0, 9, 18, 29)
- ✅ Casa **"Mix"** com escolha de categoria (posição 24)
- ✅ Timer visual de **60 segundos**
- ✅ Histórico das últimas 5 rodadas

### 🎲 Mecânicas Especiais
- **Dado 3D** para sortear equipe inicial
- **Carta 3D animada** com flip effect
- **Confetti animado** nas vitórias
- **Sistema de turnos** com rotação automática
- **Detecção de vitória** ao chegar na casa "FIM"

### 🎨 Visual Premium
- 🌟 **Tema escuro** profissional com gradientes
- 🌟 **Tabuleiro estilo Grow**: fundo amarelo/laranja com casas circulares
- 🌟 **Animações suaves**: pulse, glow, shimmer, flip
- 🌟 **Efeitos 3D**: carta, dado, perspectiva
- 🌟 **Responsivo** para desktop e mobile
- 🌟 **Legenda lateral** com todas as categorias

## 🚀 Como Usar

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/charlieloganx23/imagem_e_acao.git
cd imagem_e_acao

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

O servidor estará rodando em `http://localhost:3000`

### 🌐 Deploy em Produção (Netlify + Railway)

#### Backend (Railway/Render):
1. Crie conta no [Railway](https://railway.app) ou [Render](https://render.com)
2. Conecte o repositório GitHub
3. Configure variáveis de ambiente:
   ```
   PORT=3000
   FRONTEND_URL=https://img-acao.netlify.app
   ```
4. Deploy automático gerará URL do backend

#### Frontend (Netlify):
1. Acesse [Netlify](https://netlify.com)
2. Conecte o repositório GitHub
3. Configure: Build command vazio, Publish directory: `.`
4. Adicione variável de ambiente:
   ```
   BACKEND_URL=https://sua-url-railway.railway.app
   ```
5. Adicione snippet injection no `<head>`:
   ```html
   <script>
     window.BACKEND_URL = 'https://sua-url-railway.railway.app';
   </script>
   ```

**📖 Guia completo**: Veja [DEPLOY.md](DEPLOY.md)

**🔧 Configuração**: Acesse `/config.html` para definir URL do backend

### Jogando

1. **Criar Sala**
   - Acesse `http://localhost:3000`
   - Digite seu nome
   - Escolha 2-4 equipes
   - Clique em "Criar Sala"
   - Compartilhe o código de 5 letras

2. **Entrar na Sala**
   - Outros jogadores digitam o código
   - Distribuição automática entre equipes

3. **Iniciar Jogo**
   - Role o dado 3D para sortear quem começa
   - Host clica "Iniciar Rodada"
   - Desenhista vê a carta com palavra secreta
   - Equipe tenta adivinhar em 60 segundos

4. **Regras**
   - ✅ **Acertou**: avança 1-3 casas e joga novamente
   - ❌ **Errou**: passa para próxima equipe
   - ⏰ **Tempo esgotou**: passa para próxima equipe
   - 🏆 **Vitória**: primeira equipe a chegar na casa "FIM"

## 📁 Estrutura do Projeto

```
img_acao/
├── server.js           # Backend Node.js + Socket.io
├── client.js           # Frontend JavaScript
├── index.html          # Página inicial
├── room.html           # Sala de jogo
├── styles.css          # Estilos CSS3
├── words.json          # 60 cartas categorizadas
├── package.json        # Dependências
└── favicon.svg         # Ícone do jogo
```

## 🛠️ Tecnologias

- **Backend**: Node.js 22.x, Express 4.19.2
- **Real-time**: Socket.io 4.7.5
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Arquitetura**: Event-driven, WebSockets

## 🎯 Categorias

| Código | Nome | Cor | Descrição |
|--------|------|-----|-----------|
| **P** | Pessoa/Lugar/Animal | 🔵 Azul | Pessoas, lugares, animais e partes |
| **O** | Objeto | 🟢 Verde | Coisas que podem ser vistas ou tocadas |
| **A** | Ação | 🟠 Laranja | Verbos e expressões de ação |
| **D** | Difícil | 🔴 Vermelho | Conceitos abstratos e difíceis |
| **L** | Lazer | 🟣 Roxo | Filmes, livros, esportes, artistas |
| **M** | Mix | 🟡 Rosa | Categoria escolhida pelo jogador |
| **T** | Todos Jogam | 🟣 Roxo Claro | Todos competem simultaneamente |

## 🎨 Design Inspirado no Imagem & Ação 2 (Grow)

O tabuleiro recria fielmente a **trilha oval** do jogo original:

- **3 faixas horizontais** conectadas por curvas
- **Fundo amarelo/laranja** com textura de quadro escolar
- **Casas circulares brancas** com bordas roxas
- **Casa INÍCIO** (roxa) no canto inferior esquerdo
- **Casa FIM** (verde pulsante) na região superior
- **Casas especiais** distribuídas estrategicamente
- **Legenda lateral** com todas as categorias

## 🎯 Casas Especiais

| Posição | Tipo | Descrição |
|---------|------|-----------|
| **0** | INÍCIO + Todos Jogam | Casa de partida |
| **9** | Todos Jogam | Primeira casa especial |
| **18** | Todos Jogam | Casa intermediária |
| **24** | Mix + Escolha | Jogador escolhe a categoria |
| **29** | FIM + Todos Jogam | Casa final (vitória) |

## 🚧 Roadmap Futuro

- [ ] Sistema de desenho colaborativo (canvas compartilhado)
- [ ] Chat em tempo real
- [ ] Sons e efeitos sonoros
- [ ] Persistência de estatísticas
- [ ] Modo campeonato
- [ ] Temas visuais alternativos
- [ ] Deploy em nuvem (Heroku/Railway)
- [ ] Suporte a múltiplas salas simultâneas
- [ ] Sistema de conquistas

## 📝 Licença

Este é um projeto educacional e recreativo. O jogo original **Imagem & Ação** é propriedade da **Grow**.

## 👨‍💻 Desenvolvimento

Desenvolvido em **31 de dezembro de 2025** com foco em:
- ✅ Experiência multiplayer fluida
- ✅ Visual profissional AAA
- ✅ Regras fiéis ao original
- ✅ Código limpo e bem documentado

---

**🎉 Bom jogo e Feliz Ano Novo 2026!** 🎊
