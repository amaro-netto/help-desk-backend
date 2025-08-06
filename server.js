require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

// --- Início da Configuração do Socket.io e CORS ---

const io = new Server(server, {
  cors: {
    origin: "*", // Mantém a configuração para o WebSocket, se necessário
  }
});

// CORREÇÃO 1: Definir as opções de CORS corretamente
const corsOptions = {
  // ATENÇÃO: Substitua pela URL do seu frontend na Vercel!
  // Este deve ser o endereço que você usa no navegador para ver seu site.
  origin: 'https://amaronetto-helpdesk.vercel.app/', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// CORREÇÃO 2: Aplicar os middlewares na ordem correta e sem duplicação
app.use(cors(corsOptions)); // Usa as opções de CORS para todas as rotas HTTP
app.options('*', cors(corsOptions)); // Habilita a resposta para requisições preflight (OPTIONS)

app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições (apenas uma vez)

// --- Fim da Configuração ---

const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar ao banco de dados', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Erro ao executar a query', err.stack);
    }
    console.log('Conexão com o banco de dados estabelecida com sucesso!');
  });
});

app.locals.pool = pool;
app.locals.io = io;

const connectedUsers = {};

io.on('connection', (socket) => {
  console.log(`Usuário conectado via WebSocket: ${socket.id}`);
  
  socket.on('technician-available', (userId) => {
    connectedUsers[userId] = socket.id;
    console.log(`Técnico ${userId} está online. ID do Socket: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    for (const userId in connectedUsers) {
      if (connectedUsers[userId] === socket.id) {
        delete connectedUsers[userId];
        console.log(`Técnico ${userId} está offline.`);
        break;
      }
    }
    console.log(`Usuário desconectado: ${socket.id}`);
  });
});

const authRoutes = require('./routes/auth');
const ticketsRoutes = require('./routes/tickets');

// Registre as rotas da API com seus prefixos completos
app.use('/api/tickets', ticketsRoutes); 
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('API de Chamados está funcionando!');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});