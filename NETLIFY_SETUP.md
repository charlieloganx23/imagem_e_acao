# 🚀 GUIA COMPLETO: Deploy 100% Netlify

## ⚠️ Aviso Importante

Esta versão usa **polling HTTP** ao invés de WebSocket, resultando em:
- ⏱️ **Delay de 2 segundos** entre atualizações
- 📡 Atualizações **não instantâneas**
- ⚡ Experiência **um pouco mais lenta**

**Para experiência real-time perfeita**, considere usar Railway + Netlify (ver DEPLOY.md).

---

## 📋 Pré-requisitos

1. ✅ Conta no [Netlify](https://netlify.com) (gratuita)
2. ✅ Conta no [Upstash](https://upstash.com) (gratuita - Redis serverless)
3. ✅ Repositório no GitHub atualizado

---

## 🔧 PASSO 1: Configurar Upstash Redis

### 1.1 Criar Conta
1. Acesse: https://upstash.com
2. Clique em "Sign Up" > "Continue with GitHub"
3. Autorize o acesso

### 1.2 Criar Database
1. No dashboard, clique em "Create Database"
2. Configurações:
   - **Name**: `imagem-e-acao-db`
   - **Type**: Regional
   - **Region**: Escolha a mais próxima (ex: US East, South America)
   - **TLS**: Enabled (padrão)
3. Clique em "Create"

### 1.3 Copiar Credenciais
1. Na página do database, vá para aba **REST API**
2. Copie:
   - `UPSTASH_REDIS_REST_URL` (ex: https://your-db.upstash.io)
   - `UPSTASH_REDIS_REST_TOKEN` (token longo)
3. **Guarde essas credenciais!** Vamos usar no próximo passo

---

## 🌐 PASSO 2: Configurar Netlify

### 2.1 Conectar Repositório
1. Acesse: https://app.netlify.com
2. Vá em **Sites** > seu site `img-acao`
3. **Site settings** > **Build & deploy** > **Link repository**
4. Selecione: `charlieloganx23/imagem_e_acao`
5. Branch: `main`

### 2.2 Configurar Build
Em **Build settings**:
```
Build command: npm install
Publish directory: .
Functions directory: netlify/functions
```

### 2.3 Adicionar Variáveis de Ambiente
Em **Site settings** > **Environment variables** > **Add a variable**:

```
UPSTASH_REDIS_REST_URL = https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN = seu-token-aqui
```

⚠️ **Cole os valores copiados do Upstash no Passo 1.3**

### 2.4 Deploy
1. Clique em **Deploys** > **Trigger deploy** > **Deploy site**
2. Aguarde ~2-3 minutos
3. Seu site estará em: `https://img-acao.netlify.app`

---

## ✅ PASSO 3: Testar

### 3.1 Abrir Site
Acesse: https://img-acao.netlify.app

### 3.2 Criar Sala
1. Digite seu nome
2. Escolha número de equipes
3. Clique em "Criar Sala"
4. Copie o código gerado

### 3.3 Entrar em Outra Aba (Simular Multiplayer)
1. Abra nova aba anônima/privada
2. Acesse o mesmo link
3. Escolha "Entrar em Sala Existente"
4. Cole o código
5. Digite outro nome

### 3.4 Jogar
1. Role o dado para sortear equipe inicial
2. Clique em "Iniciar Rodada"
3. O desenhista verá a carta (palavra + categoria)
4. Equipe tem 60 segundos para adivinhar
5. Host marca "Acertou" ou "Pular"

---

## 🔍 Verificar se Está Funcionando

### Teste Rápido de API
Abra o console do navegador (F12) e execute:

```javascript
fetch('/.netlify/functions/game/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Teste', numTeams: 2 })
})
.then(r => r.json())
.then(d => console.log('✅ API funcionando!', d))
.catch(e => console.error('❌ Erro:', e));
```

Se retornar um objeto com `room` e `playerId`, está funcionando! 🎉

---

## 🆘 Problemas Comuns

### ❌ "Error: Missing Upstash credentials"
**Solução**: Verifique se as variáveis de ambiente estão configuradas corretamente no Netlify:
1. Site settings > Environment variables
2. Confirme que `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` estão definidas
3. Faça um novo deploy: Deploys > Trigger deploy

### ❌ "Sala não encontrada" ao entrar
**Solução**: 
- Redis pode ter expirado (TTL de 2 horas)
- Crie uma nova sala
- Verifique se Upstash database está ativo

### ❌ Polling não atualiza automaticamente
**Solução**:
- Abra o console do navegador (F12)
- Veja se há erros de CORS ou fetch
- Confirme que `client-polling.js` está sendo carregado

### ❌ Build falha no Netlify
**Solução**:
```bash
# Localmente, teste se o build funciona:
npm install
npm install @upstash/redis

# Se funcionar, faça commit e push:
git add package.json package-lock.json
git commit -m "Adicionar @upstash/redis"
git push origin main
```

---

## 📊 Diferenças vs Railway+Netlify

| Aspecto | Netlify Only | Railway + Netlify |
|---------|--------------|-------------------|
| **Tempo real** | ⚠️ 2s delay | ✅ Instantâneo |
| **Setup** | ✅ Simples (10 min) | ⚠️ Médio (15 min) |
| **Custo** | 🆓 Grátis | 🆓 Grátis |
| **Performance** | ⚠️ Polling | ✅ WebSocket |
| **Escalabilidade** | ✅ Serverless | ⚠️ Limitado |
| **Experiência** | ⚠️ Laggy | ✅ Fluida |

---

## 🔄 Atualizações Futuras

Para atualizar o código:
```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

Netlify fará deploy automático em ~1-2 minutos.

---

## 💡 Dicas

### Melhorar Performance do Polling
No [client-polling.js](client-polling.js), linha 16:
```javascript
}, 2000); // Mude para 1000 (1 segundo) se quiser mais rápido
```

⚠️ **Atenção**: Polling mais rápido = mais requisições = pode esgotar limite grátis.

### Aumentar Tempo de Expiração do Redis
No [netlify/functions/game.js](netlify/functions/game.js), procure:
```javascript
{ ex: 7200 } // 2 horas - mude para 14400 (4 horas) se precisar
```

---

## 📱 URLs Finais

- **Site**: https://img-acao.netlify.app
- **API**: https://img-acao.netlify.app/.netlify/functions/game
- **Upstash Dashboard**: https://console.upstash.com

---

## 🎉 Pronto!

Agora seu jogo está 100% no Netlify! 

**Limitações conhecidas**:
- ⏱️ Delay de 2 segundos (polling)
- ⚡ Não é instantâneo como WebSocket
- 📡 Pode ter lag em conexões lentas

**Se quiser melhor experiência**, migre para Railway + Netlify usando o [DEPLOY.md](DEPLOY.md).

---

**Bom jogo! 🎨🎭**
