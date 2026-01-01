# 🚀 GUIA DE DEPLOY - Netlify + Railway

## 📦 Arquitetura do Deploy

**Frontend (Netlify)**: HTML, CSS, JavaScript estáticos
**Backend (Railway/Render)**: Node.js + Socket.io

---

## 🔧 PARTE 1: Deploy do Backend (Railway)

### 1️⃣ Criar Conta no Railway
1. Acesse: https://railway.app
2. Faça login com GitHub
3. Clique em "New Project"

### 2️⃣ Conectar Repositório
1. Escolha "Deploy from GitHub repo"
2. Selecione: `charlieloganx23/imagem_e_acao`
3. Railway detectará automaticamente Node.js

### 3️⃣ Configurar Variáveis de Ambiente
No painel do Railway, vá em **Variables** e adicione:

```
PORT=3000
FRONTEND_URL=https://img-acao.netlify.app
```

### 4️⃣ Deploy Automático
- Railway fará deploy automaticamente
- Aguarde ~2-3 minutos
- Copie a URL gerada (ex: `https://imagem-e-acao-production.up.railway.app`)

---

## 🌐 PARTE 2: Deploy do Frontend (Netlify)

### 1️⃣ Já Criado
Você já tem o projeto criado:
- **Nome**: img-acao
- **Project ID**: e31e4bec-a1df-493f-aa2b-cb0a179f32e1

### 2️⃣ Conectar GitHub ao Netlify
1. Acesse: https://app.netlify.com/sites/img-acao/settings
2. Vá em **Build & deploy** > **Link repository**
3. Conecte ao repositório: `charlieloganx23/imagem_e_acao`

### 3️⃣ Configurar Build Settings
```
Build command: (deixe vazio)
Publish directory: .
```

### 4️⃣ Adicionar Variável de Ambiente
No Netlify, vá em **Site settings** > **Environment variables**:

```
BACKEND_URL=https://sua-url-do-railway.railway.app
```

⚠️ **Substitua pela URL real gerada pelo Railway!**

### 5️⃣ Adicionar Script de Injeção
No Netlify, vá em **Site settings** > **Build & deploy** > **Post processing** > **Snippet injection**

Adicione no `<head>` de todas as páginas:
```html
<script>
  window.BACKEND_URL = 'https://sua-url-do-railway.railway.app';
</script>
```

### 6️⃣ Deploy
1. Clique em "Deploy site"
2. Aguarde ~1-2 minutos
3. Seu site estará em: `https://img-acao.netlify.app`

---

## ✅ VERIFICAÇÃO

### Testar Backend
```bash
curl https://sua-url-do-railway.railway.app
# Deve retornar a página HTML
```

### Testar Frontend
1. Acesse: `https://img-acao.netlify.app/config.html`
2. Configure a URL do backend
3. Clique em "Salvar e Continuar"
4. Teste criando uma sala

---

## 🔄 ATUALIZAÇÕES FUTURAS

### Atualizar Código
```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

- **Railway**: Deploy automático em ~2 min
- **Netlify**: Deploy automático em ~1 min

---

## 🆘 PROBLEMAS COMUNS

### ❌ "Não consegue conectar ao servidor"
- Verifique se a URL do backend está correta em `config.html`
- Confirme que Railway está rodando (veja logs)

### ❌ "CORS error"
- Verifique variável `FRONTEND_URL` no Railway
- Deve ser exatamente: `https://img-acao.netlify.app`

### ❌ "Socket.io não conecta"
- Limpe localStorage: `localStorage.clear()`
- Reconfigure em `/config.html`

---

## 📱 URLs FINAIS

- **Frontend**: https://img-acao.netlify.app
- **Backend**: https://[seu-app].railway.app
- **Config**: https://img-acao.netlify.app/config.html

---

## 💡 ALTERNATIVA: Render (ao invés de Railway)

Se preferir usar Render.com:

1. Acesse: https://render.com
2. New > Web Service
3. Conecte GitHub: `charlieloganx23/imagem_e_acao`
4. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variables:
     ```
     PORT=10000
     FRONTEND_URL=https://img-acao.netlify.app
     ```

URL será: `https://imagem-e-acao.onrender.com`
