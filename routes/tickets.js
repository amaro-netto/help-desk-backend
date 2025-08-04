const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middleware para verificar o token JWT e obter as informações do usuário
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);

  jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Middleware para verificar se o usuário é Técnico ou Admin
const checkTechnicianOrAdmin = (req, res, next) => {
  if (req.user.role !== 'TECHNICIAN' && req.user.role !== 'ADMIN') {
    return res.status(403).send('Acesso negado. Apenas técnicos ou administradores.');
  }
  next();
};

// Middleware para verificar se o usuário é Admin
const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).send('Acesso negado. Apenas administradores.');
  }
  next();
};

// Rota para criar um novo chamado
router.post('/tickets', authenticateToken, async (req, res) => {
  const { title, description, type, priority } = req.body;
  const createdBy = req.user.userId;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'INSERT INTO tickets (title, description, type, priority, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, type, priority, 'OPEN', createdBy]
    );

    const newTicket = result.rows[0];
    const io = req.app.locals.io;
    io.emit('new-ticket-alert', newTicket);

    res.status(201).json({ message: 'Chamado criado com sucesso!', ticket: newTicket });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar o chamado.');
  }
});

// Rota para um técnico aceitar um chamado
router.post('/tickets/:id/accept', authenticateToken, checkTechnicianOrAdmin, async (req, res) => {
  const { id } = req.params;
  const technicianId = req.user.userId;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'UPDATE tickets SET assigned_to = $1, status = $2 WHERE id = $3 AND assigned_to IS NULL RETURNING *',
      [technicianId, 'IN_PROGRESS', id]
    );

    if (result.rowCount === 0) {
      return res.status(400).send('O chamado não pode ser aceito. Já foi atribuído ou não existe.');
    }

    const acceptedTicket = result.rows[0];
    const io = req.app.locals.io;
    io.emit('ticket-accepted', acceptedTicket);

    res.json({ message: 'Chamado aceito com sucesso!', ticket: acceptedTicket });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao aceitar o chamado.');
  }
});


// Rota para listar chamados
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    let query;
    let params;

    if (req.user.role === 'ADMIN') {
      query = 'SELECT * FROM tickets ORDER BY created_at DESC';
      params = [];
    } else if (req.user.role === 'TECHNICIAN') {
      query = 'SELECT * FROM tickets WHERE status IN (\'OPEN\', \'IN_PROGRESS\') OR assigned_to = $1 ORDER BY created_at DESC';
      params = [req.user.userId];
    } else { // USER
      query = 'SELECT * FROM tickets WHERE created_by = $1 ORDER BY created_at DESC';
      params = [req.user.userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao listar os chamados.');
  }
});

// Rota para atualizar um chamado (exclusivo para técnicos e admins)
router.put('/tickets/:id', authenticateToken, checkTechnicianOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to } = req.body;

  try {
    const pool = req.app.locals.pool;

    let updateQuery = 'UPDATE tickets SET status = $1, assigned_to = $2 WHERE id = $3 RETURNING *';
    let params = [status, assigned_to, id];

    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateQuery = 'UPDATE tickets SET status = $1, assigned_to = $2, closed_at = NOW() WHERE id = $3 RETURNING *';
      
      const ticket = await pool.query('SELECT assigned_to FROM tickets WHERE id = $1', [id]);
      const technicianId = ticket.rows[0].assigned_to;

      if (technicianId) {
        await pool.query('UPDATE users SET points = points + 10 WHERE id = $1', [technicianId]);
      }
    }
    
    const result = await pool.query(updateQuery, params);

    if (result.rowCount === 0) {
      return res.status(404).send('Chamado não encontrado.');
    }

    res.json({ message: 'Chamado atualizado com sucesso!', ticket: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar o chamado.');
  }
});

module.exports = router;