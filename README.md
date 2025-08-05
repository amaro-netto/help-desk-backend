# Backend do Sistema de Chamados

Este é o repositório do backend da aplicação de gerenciamento de chamados. Ele é responsável por gerenciar a lógica de negócio, a autenticação de usuários e a comunicação com o banco de dados.

## Tecnologias

- **Node.js**: Ambiente de execução do servidor.
- **Express.js**: Framework para criar a API RESTful.
- **PostgreSQL**: Banco de dados relacional (usando Supabase).
- **Socket.io**: Biblioteca para comunicação em tempo real (WebSockets).
- **JWT (JSON Web Tokens)**: Para autenticação e autorização de usuários.
- **Bcrypt.js**: Para hash de senhas.

## Configuração do Projeto

Para rodar o backend localmente, siga estes passos:

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/SEU_USUARIO/help-desk-backend.git](https://github.com/SEU_USUARIO/help-desk-backend.git)
    cd help-desk-backend
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **Configure as variáveis de ambiente:**
    * Crie um arquivo `.env` na raiz do projeto.
    * Adicione as variáveis de conexão do seu banco de dados Supabase e a chave secreta do JWT.
    ```
    SUPABASE_URL="sua_url_de_conexao_do_supabase"
    JWT_SECRET="uma_chave_secreta_longa_e_aleatoria"
    ```
4.  **Inicie o servidor:**
    ```bash
    node server.js
    ```
    O servidor será iniciado na porta 3001.

## Rotas da API

- `POST /auth/login`: Autentica um usuário e retorna um token JWT.
- `POST /api/tickets`: Cria um novo chamado (requer autenticação).
- `GET /api/tickets`: Lista todos os chamados (o acesso varia por perfil).
- `GET /api/tickets/:id`: Busca os detalhes de um chamado específico.
- `POST /api/tickets/:id/accept`: Permite que um técnico aceite um chamado.
- `PUT /api/tickets/:id`: Atualiza o status de um chamado (e adiciona pontos de gamificação).
