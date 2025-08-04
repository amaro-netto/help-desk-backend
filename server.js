require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Permite acesso de qualquer frontend durante o desenvolvimento
  }
});

// Configuração do CORS e JSON Parser
app.use(express.json());
app.use(cors());

// Configuração do pool de conexão com o PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  ssl: {
    rejectUnauthorized: false // Para conexões SSL com Supabase
  }
});

// Testar a conexão com o banco de dados
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

// Expondo o pool e o io para as rotas
app.locals.pool = pool;
app.locals.io = io;

// Configuração do WebSocket
io.on('connection', (socket) => {
  console.log(`Usuário conectado via WebSocket: ${socket.id}`);
  
  socket.on('technician-available', (userId) => {
    console.log(`Técnico ${userId} está online.`);
    // Implemente a lógica para rastrear técnicos disponíveis
  });

  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
  });
});

// Rotas da aplicação
const authRoutes = require('./routes/auth');
const ticketsRoutes = require('./routes/tickets'); // Adicione esta linha
app.use('/auth', authRoutes);
app.use('/api', ticketsRoutes); // Adicione esta linha

app.get('/', (req, res) => {
  res.send('API de Chamados está funcionando!');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});