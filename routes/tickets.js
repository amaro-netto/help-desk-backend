const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validate: isUuid } = require('uuid'); // Adicione esta linha

router.get('/teste', (req, res) => {
  res.send('Rota tickets.js funcionando!');
});

// Middleware para verificar se o usuário já está logado
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);

  jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Rota para criar um novo chamado
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, type, priority } = req.body;
  const created_by = req.user.userId;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'INSERT INTO tickets (title, description, type, priority, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, type, priority, 'OPEN', created_by]
    );

    req.app.locals.io.emit('new-ticket-alert', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao criar chamado.');
  }
});

// Rota para buscar todos os tickets
router.get('/', authenticateToken, async (req, res) => {
  const pool = req.app.locals.pool;
  const { role, userId } = req.user;

  try {
    let result;

    if (role === 'USER') {
      result = await pool.query('SELECT * FROM tickets WHERE created_by = $1 ORDER BY created_at DESC', [userId]);
    } else {
      result = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar chamados.');
  }
});

// Rota para buscar um único chamado por ID
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  // Validação de UUID
  if (!isUuid(id)) {
    return res.status(400).send('ID inválido.');
  }

  try {
    const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Chamado não encontrado.');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar chamado.');
  }
});

// Rota para aceitar um chamado
router.post('/:id/accept', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const pool = req.app.locals.pool;

  // Validação de UUID
  if (!isUuid(id)) {
    return res.status(400).send('ID inválido.');
  }

  try {
    const result = await pool.query(
      'UPDATE tickets SET status = $1, assigned_to = $2 WHERE id = $3 AND status = $4 RETURNING *',
      ['IN_PROGRESS', userId, id, 'OPEN']
    );

    if (result.rows.length === 0) {
      return res.status(400).send('Chamado não pôde ser aceito. Verifique o status.');
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao aceitar chamado.');
  }
});

// Rota para atualizar um chamado e aplicar gamificação
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const pool = req.app.locals.pool;

  // Validação de UUID
  if (!isUuid(id)) {
    return res.status(400).send('ID inválido.');
  }

  try {
    const ticketResult = await pool.query('SELECT assigned_to FROM tickets WHERE id = $1', [id]);
    const assignedToId = ticketResult.rows[0]?.assigned_to;

    let updateQuery = 'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *';
    let params = [status, id];

    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateQuery = 'UPDATE tickets SET status = $1, closed_at = NOW() WHERE id = $2 RETURNING *';
      if (assignedToId) {
        await pool.query('UPDATE users SET points = points + 10 WHERE id = $1', [assignedToId]);
      }
    }
    
    const result = await pool.query(updateQuery, params);

    if (result.rowCount === 0) {
      return res.status(404).send('Chamado não encontrado.');
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao atualizar o chamado.');
  }
});

module.exports = router;