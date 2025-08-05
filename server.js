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
    origin: "*", 
  }
});

app.use(express.json());
app.use(cors());

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
app.use('/auth', authRoutes);
app.use('/api', ticketsRoutes); 

app.get('/', (req, res) => {
  res.send('API de Chamados está funcionando!');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});