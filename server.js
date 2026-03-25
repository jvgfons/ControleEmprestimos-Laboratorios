const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DADOS_DIR = path.join(__dirname, 'dados');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

function getDataFilePath(filename) {
  return path.join(DADOS_DIR, filename);
}

function readJSONFile(filename) {
  const filePath = getDataFilePath(filename);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    if (!data.trim()) {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler ${filename}:`, error);
    return [];
  }
}

function writeJSONFile(filename, data) {
  const filePath = getDataFilePath(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function withComputedName(item) {
  const nome = item.nome || [item.marca, item.modelo].filter(Boolean).join(' ').trim();
  return { ...item, nome };
}

function nextNumericId(records) {
  return records.length > 0 ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1 : 1;
}

function generateSolicitacaoId() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SOL-${year}-${random}`;
}

// ===== LOGIN =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSONFile('users.json');

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      nome: user.nome,
      role: user.role,
    },
  });
});

// ===== ITENS =====
app.get('/api/items', (req, res) => {
  const items = readJSONFile('items.json').map(withComputedName);
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const items = readJSONFile('items.json');

  const newItem = {
    id: nextNumericId(items),
    marca: req.body.marca || '',
    modelo: req.body.modelo || '',
    patrimonio: req.body.patrimonio || '',
    serial: req.body.serial || '',
    tipo: req.body.tipo || '',
    quantidade: Number(req.body.quantidade) || 0,
    descricao: req.body.descricao || '',
    localizacao: req.body.localizacao || '',
  };

  items.push(newItem);
  writeJSONFile('items.json', items);

  res.status(201).json(withComputedName(newItem));
});

app.put('/api/items/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const items = readJSONFile('items.json');
  const index = items.findIndex((i) => Number(i.id) === itemId);

  if (index === -1) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  items[index] = {
    ...items[index],
    ...req.body,
    id: items[index].id,
    quantidade:
      req.body.quantidade !== undefined
        ? Number(req.body.quantidade) || 0
        : Number(items[index].quantidade) || 0,
  };

  writeJSONFile('items.json', items);
  res.json(withComputedName(items[index]));
});

app.delete('/api/items/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const items = readJSONFile('items.json');
  const loans = readJSONFile('loans.json');

  const hasActiveLoan = loans.some(
    (loan) => Number(loan.itemId) === itemId && loan.status === 'ativo'
  );

  if (hasActiveLoan) {
    return res.status(400).json({ error: 'Item possui empréstimo ativo e não pode ser removido' });
  }

  const filtered = items.filter((i) => Number(i.id) !== itemId);

  if (filtered.length === items.length) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  writeJSONFile('items.json', filtered);
  return res.json({ success: true });
});

app.get('/api/items/search/nome/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const items = readJSONFile('items.json').map(withComputedName);

  const results = items.filter((item) => {
    const nomeCompleto = [item.marca, item.modelo].filter(Boolean).join(' ').toLowerCase();
    return (
      (item.nome && item.nome.toLowerCase().includes(query)) ||
      (item.marca && item.marca.toLowerCase().includes(query)) ||
      (item.modelo && item.modelo.toLowerCase().includes(query)) ||
      nomeCompleto.includes(query)
    );
  });

  res.json(results);
});

app.get('/api/items/search/patrimonio/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const items = readJSONFile('items.json').map(withComputedName);

  const results = items.filter(
    (item) => item.patrimonio && item.patrimonio.toLowerCase().includes(query)
  );

  res.json(results);
});

app.get('/api/items/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const items = readJSONFile('items.json').map(withComputedName);

  const results = items.filter((item) => {
    const nomeCompleto = [item.marca, item.modelo].filter(Boolean).join(' ').toLowerCase();
    return (
      (item.nome && item.nome.toLowerCase().includes(query)) ||
      (item.patrimonio && item.patrimonio.toLowerCase().includes(query)) ||
      nomeCompleto.includes(query)
    );
  });

  res.json(results);
});

// ===== EMPRÉSTIMOS =====
app.get('/api/loans', (req, res) => {
  const loans = readJSONFile('loans.json');
  res.json(loans);
});

app.get('/api/loans/active', (req, res) => {
  const loans = readJSONFile('loans.json');
  const active = loans.filter((loan) => loan.status === 'ativo');
  res.json(active);
});

app.post('/api/loans', (req, res) => {
  const loans = readJSONFile('loans.json');
  const items = readJSONFile('items.json');

  const itemId = Number(req.body.itemId);
  const itemIndex = items.findIndex((i) => Number(i.id) === itemId);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item não encontrado' });
  }

  if ((Number(items[itemIndex].quantidade) || 0) <= 0) {
    return res.status(400).json({ error: 'Item sem disponibilidade para empréstimo' });
  }

  const newLoan = {
    id: nextNumericId(loans),
    itemId,
    itemNome: req.body.itemNome || withComputedName(items[itemIndex]).nome,
    itemPatrimonio: req.body.itemPatrimonio || items[itemIndex].patrimonio,
    solicitante: req.body.solicitante || req.body.nome || '',
    email: req.body.email || '',
    dataRetirada: req.body.dataRetirada,
    dataDevolucaoPrevista: req.body.dataDevolucaoPrevista || req.body.dataDevolucao,
    dataDevolucaoReal: null,
    observacoes: req.body.observacoes || '',
    status: 'ativo',
    dataCriacao: new Date().toISOString(),
  };

  loans.push(newLoan);
  items[itemIndex].quantidade = (Number(items[itemIndex].quantidade) || 0) - 1;

  writeJSONFile('loans.json', loans);
  writeJSONFile('items.json', items);

  return res.status(201).json(newLoan);
});

app.put('/api/loans/:id/concluir', (req, res) => {
  const loanId = Number(req.params.id);
  const loans = readJSONFile('loans.json');
  const items = readJSONFile('items.json');

  const loanIndex = loans.findIndex((l) => Number(l.id) === loanId);
  if (loanIndex === -1) {
    return res.status(404).json({ error: 'Empréstimo não encontrado' });
  }

  if (loans[loanIndex].status === 'concluido') {
    return res.status(400).json({ error: 'Empréstimo já concluído' });
  }

  loans[loanIndex].status = 'concluido';
  loans[loanIndex].dataDevolucaoReal = req.body.dataDevolucaoReal || new Date().toISOString();

  const itemIndex = items.findIndex((i) => Number(i.id) === Number(loans[loanIndex].itemId));
  if (itemIndex !== -1) {
    items[itemIndex].quantidade = (Number(items[itemIndex].quantidade) || 0) + 1;
    writeJSONFile('items.json', items);
  }

  writeJSONFile('loans.json', loans);
  return res.json(loans[loanIndex]);
});

// ===== SOLICITAÇÕES =====
app.get('/api/solicitacoes', (req, res) => {
  const solicitacoes = readJSONFile('solicitacoes.json');
  res.json(solicitacoes);
});

app.post('/api/solicitacoes', (req, res) => {
  const solicitacoes = readJSONFile('solicitacoes.json');
  const items = readJSONFile('items.json');

  const item = items.find((i) => Number(i.id) === Number(req.body.itemId));

  const novaSolicitacao = {
    id: generateSolicitacaoId(),
    nome: req.body.nome || '',
    email: req.body.email || '',
    itemId: Number(req.body.itemId),
    itemNome: req.body.itemNome || (item ? withComputedName(item).nome : ''),
    itemPatrimonio: req.body.itemPatrimonio || (item ? item.patrimonio : ''),
    dataRetirada: req.body.dataRetirada,
    dataDevolucao: req.body.dataDevolucao,
    status: 'pendente',
    dataSolicitacao: new Date().toISOString(),
    motivoRejeicao: null,
  };

  solicitacoes.push(novaSolicitacao);
  writeJSONFile('solicitacoes.json', solicitacoes);

  return res.status(201).json(novaSolicitacao);
});

app.put('/api/solicitacoes/:id/aprovar', (req, res) => {
  const solicitacoes = readJSONFile('solicitacoes.json');
  const items = readJSONFile('items.json');
  const loans = readJSONFile('loans.json');

  const solicitacaoIndex = solicitacoes.findIndex((s) => s.id === req.params.id);
  if (solicitacaoIndex === -1) {
    return res.status(404).json({ error: 'Solicitação não encontrada' });
  }

  const solicitacao = solicitacoes[solicitacaoIndex];
  if (solicitacao.status !== 'pendente') {
    return res.status(400).json({ error: 'Somente solicitações pendentes podem ser aprovadas' });
  }

  const itemIndex = items.findIndex((i) => Number(i.id) === Number(solicitacao.itemId));
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item da solicitação não encontrado' });
  }

  if ((Number(items[itemIndex].quantidade) || 0) <= 0) {
    return res.status(400).json({ error: 'Item indisponível para aprovação' });
  }

  const novoEmprestimo = {
    id: nextNumericId(loans),
    itemId: solicitacao.itemId,
    itemNome: solicitacao.itemNome,
    itemPatrimonio: solicitacao.itemPatrimonio,
    solicitante: solicitacao.nome,
    email: solicitacao.email,
    dataRetirada: solicitacao.dataRetirada,
    dataDevolucaoPrevista: solicitacao.dataDevolucao,
    dataDevolucaoReal: null,
    observacoes: 'Gerado por aprovação de solicitação',
    status: 'ativo',
    dataCriacao: new Date().toISOString(),
  };

  loans.push(novoEmprestimo);
  items[itemIndex].quantidade = (Number(items[itemIndex].quantidade) || 0) - 1;

  solicitacao.status = 'aprovado';
  solicitacao.dataAprovacao = new Date().toISOString();
  solicitacao.loanId = novoEmprestimo.id;

  writeJSONFile('solicitacoes.json', solicitacoes);
  writeJSONFile('loans.json', loans);
  writeJSONFile('items.json', items);

  return res.json({ success: true, solicitacao, loan: novoEmprestimo });
});

app.put('/api/solicitacoes/:id/rejeitar', (req, res) => {
  const solicitacoes = readJSONFile('solicitacoes.json');
  const solicitacaoIndex = solicitacoes.findIndex((s) => s.id === req.params.id);

  if (solicitacaoIndex === -1) {
    return res.status(404).json({ error: 'Solicitação não encontrada' });
  }

  solicitacoes[solicitacaoIndex].status = 'rejeitado';
  solicitacoes[solicitacaoIndex].motivoRejeicao = req.body.motivo || 'Sem motivo informado';
  solicitacoes[solicitacaoIndex].dataRejeicao = new Date().toISOString();

  writeJSONFile('solicitacoes.json', solicitacoes);
  return res.json({ success: true, solicitacao: solicitacoes[solicitacaoIndex] });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
