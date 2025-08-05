const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

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

// Rota de Registro de Usuário (apenas para Admin)
router.post('/register', authenticateToken, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (req.user.role !== 'ADMIN') {
    return res.status(403).send('Acesso negado. Apenas administradores podem registrar novos usuários.');
  }

  try {
    const pool = req.app.locals.pool;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'Usuário registrado com sucesso!', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao registrar o usuário.');
  }
});

// Rota de Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query('SELECT id, name, email, password_hash, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).send('Email ou senha incorretos.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).send('Email ou senha incorretos.');
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao fazer login.');
  }
});

module.exports = router;