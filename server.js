const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));
app.use('/public', express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin123',
    database: 'HandCakesDB'
});

db.connect((err) => {
    if (err) console.error('❌ Erro no MySQL:', err.message);
    else console.log('✅ Back-end HandCakes ativo!');
});

// Cadastro de Cliente com Validação Estrita e Trata Mínimo de Senha
app.post('/api/cadastro', (req, res) => {
    const { nome, email, senha, telefone, cpf, rua, numero, complemento, bairro, cidade, estado, cep } = req.body;

    if (!nome) return res.status(400).json({ success: false, error: 'O campo Nome Completo é obrigatório.' });
    if (!email) return res.status(400).json({ success: false, error: 'O campo E-mail é obrigatório.' });
    if (!senha || senha.length < 6) return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 6 caracteres.' });
    if (!cpf) return res.status(400).json({ success: false, error: 'O campo CPF é obrigatório.' });
    if (!telefone) return res.status(400).json({ success: false, error: 'O campo Telefone é obrigatório.' });
    if (!rua || !numero || !bairro) return res.status(400).json({ success: false, error: 'Preencha Rua, Número e Bairro no endereço.' });

    const cpfApenasNumeros = cpf.replace(/\D/g, '');
    const telApenasNumeros = telefone.replace(/\D/g, '');

    if (cpfApenasNumeros.length !== 11) {
        return res.status(400).json({ success: false, error: 'O CPF precisa ter exatamente 11 dígitos numéricos.' });
    }

    if (telApenasNumeros.length < 10 || telApenasNumeros.length > 11) {
        return res.status(400).json({ success: false, error: 'O Telefone deve conter 10 ou 11 números com DDD.' });
    }

    const queryCliente = 'INSERT INTO Cliente (nome, email, senha, telefone, cpf) VALUES (?, ?, ?, ?, ?)';
    db.query(queryCliente, [nome, email, senha, telApenasNumeros, cpfApenasNumeros], (err, result) => {
        if (err) {
            console.error('❌ Erro no cadastro de cliente:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                if (err.sqlMessage.includes('cpf')) {
                    return res.status(400).json({ success: false, error: 'Este CPF já está cadastrado.' });
                }
                return res.status(400).json({ success: false, error: 'Este E-mail já está cadastrado.' });
            }
            return res.status(500).json({ success: false, error: 'Erro ao salvar cliente no banco. Verifique os dados.' });
        }

        const idCliente = result.insertId;
        const queryEndereco = 'INSERT INTO Endereco (idCliente, rua, numero, complemento, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        
        db.query(queryEndereco, [idCliente, rua, numero, complemento || '', bairro, cidade || 'Curitiba', estado || 'PR', cep || '80000-000'], (errEnd, resEnd) => {
            if (errEnd) {
                console.error('❌ Erro ao cadastrar endereço:', errEnd);
                return res.status(500).json({ success: false, error: 'Erro ao cadastrar o endereço inicial.' });
            }
            
            res.json({
                success: true,
                usuario: { idCliente, nome, email, cpf: cpfApenasNumeros, telefone: telApenasNumeros, idEndereco: resEnd.insertId, rua, numero, bairro }
            });
        });
    });
});

// Autenticação (Login)
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const query = 'SELECT c.idCliente, c.nome, c.email, c.cpf, c.telefone, e.idEndereco, e.rua, e.numero, e.bairro FROM Cliente c LEFT JOIN Endereco e ON c.idCliente = e.idCliente WHERE c.email = ? AND c.senha = ? LIMIT 1';

    db.query(query, [email, senha], (err, results) => {
        if (err || results.length === 0) {
            res.status(401).json({ success: false, error: 'E-mail ou senha incorretos.' });
        } else {
            res.json({ success: true, usuario: results[0] });
        }
    });
});

// Editar Dados Pessoais do Cliente
app.put('/api/cliente/:idCliente', (req, res) => {
    const { nome, email, cpf, telefone } = req.body;
    const cpfApenasNumeros = (cpf || '').replace(/\D/g, '');
    const telApenasNumeros = (telefone || '').replace(/\D/g, '');

    if (!nome) return res.status(400).json({ success: false, error: 'O Nome é obrigatório.' });
    if (!email) return res.status(400).json({ success: false, error: 'O E-mail é obrigatório.' });
    if (cpfApenasNumeros.length !== 11) return res.status(400).json({ success: false, error: 'O CPF precisa ter 11 dígitos.' });

    const query = 'UPDATE Cliente SET nome = ?, email = ?, cpf = ?, telefone = ? WHERE idCliente = ?';
    db.query(query, [nome, email, cpfApenasNumeros, telApenasNumeros, req.params.idCliente], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, error: 'E-mail ou CPF já em uso por outra conta.' });
            }
            return res.status(500).json({ success: false, error: 'Erro ao atualizar dados pessoais.' });
        }
        res.json({ success: true });
    });
});

// Endereços de um Cliente
app.get('/api/enderecos/:idCliente', (req, res) => {
    const query = 'SELECT * FROM Endereco WHERE idCliente = ?';
    db.query(query, [req.params.idCliente], (err, results) => {
        if (err) res.status(500).json({ error: 'Erro ao buscar endereços.' });
        else res.json(results);
    });
});

// Cadastrar Novo Endereço
app.post('/api/enderecos', (req, res) => {
    const { idCliente, rua, numero, complemento, bairro, cidade, estado, cep } = req.body;
    const query = 'INSERT INTO Endereco (idCliente, rua, numero, complemento, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    
    db.query(query, [idCliente, rua, numero, complemento || '', bairro, cidade || 'Curitiba', estado || 'PR', cep || '80000-000'], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: 'Erro ao cadastrar endereço.' });
        res.json({ success: true, idEndereco: result.insertId });
    });
});

// Editar Endereço
app.put('/api/enderecos/:idEndereco', (req, res) => {
    const { rua, numero, complemento, bairro } = req.body;
    const query = 'UPDATE Endereco SET rua = ?, numero = ?, complemento = ?, bairro = ? WHERE idEndereco = ?';
    
    db.query(query, [rua, numero, complemento || '', bairro, req.params.idEndereco], (err) => {
        if (err) return res.status(500).json({ success: false, error: 'Erro ao atualizar endereço.' });
        res.json({ success: true });
    });
});

// Excluir Endereço
app.delete('/api/enderecos/:idEndereco', (req, res) => {
    const query = 'DELETE FROM Endereco WHERE idEndereco = ?';
    db.query(query, [req.params.idEndereco], (err) => {
        if (err) return res.status(500).json({ success: false, error: 'Erro ao excluir endereço.' });
        res.json({ success: true });
    });
});

// Buscar Produtos
app.get('/api/produtos', (req, res) => {
    const query = 'SELECT p.*, c.nome AS categoriaNome FROM Produto p JOIN Categoria c ON p.idCategoria = c.idCategoria WHERE p.emEstoque = TRUE';
    db.query(query, (err, results) => {
        if (err) res.status(500).json({ error: 'Erro ao buscar produtos.' });
        else res.json(results);
    });
});

// Finalizar Pedido
app.post('/api/pedidos', (req, res) => {
    const { idCliente, idEndereco, subtotal, taxaEntrega, valorTotal, metodoPagamento, ultimosDigitos, itens } = req.body;
    
    const queryPedido = 'INSERT INTO Pedido (idCliente, idEndereco, subtotal, taxaEntrega, valorTotal, status) VALUES (?, ?, ?, ?, ?, "Em Preparo")';
    
    db.query(queryPedido, [idCliente, idEndereco, subtotal, taxaEntrega, valorTotal], (err, result) => {
        if (err) {
            console.error('❌ Erro ao criar pedido:', err);
            return res.status(500).json({ success: false, error: 'Erro ao criar pedido no banco de dados.' });
        }
        
        const idPedido = result.insertId;
        const queryItens = 'INSERT INTO ItemPedido (idPedido, idProduto, quantidade, precoUnitario) VALUES ?';
        const valoresItens = itens.map(item => [idPedido, item.idProduto, item.quantidade, item.preco]);

        db.query(queryItens, [valoresItens], (errItens) => {
            if (errItens) {
                console.error('❌ Erro ao salvar itens:', errItens);
                return res.status(500).json({ success: false, error: 'Erro ao salvar os itens do pedido.' });
            }

            // Mapeia o método para gravar o texto amigável
            let metodoTratado = 'PIX';
            if (metodoPagamento === 'Credito') metodoTratado = 'Cartão de Crédito';
            if (metodoPagamento === 'Debito') metodoTratado = 'Cartão de Débito';

            const queryPagamento = 'INSERT INTO Pagamento (idPedido, metodoPagamento, statusPagamento, idTransacao, ultimosDigitosCartao) VALUES (?, ?, "Aprovado", ?, ?)';
            const txId = 'TX-' + Math.floor(Math.random() * 1000000);
            
            db.query(queryPagamento, [idPedido, metodoTratado, txId, ultimosDigitos || null], (errPag) => {
                if (errPag) {
                    console.error('❌ ERRO NO INSERT DE PAGAMENTO:', errPag);
                    return res.status(500).json({ success: false, error: `Erro no banco ao registrar pagamento: ${errPag.message}` });
                }
                res.json({ success: true, idPedido });
            });
        });
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Back-end HandCakes ativo em http://localhost:${PORT}`));