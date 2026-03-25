// Adicione esta função de atualização no server.js

// Atualizar a rota POST /api/items para aceitar os novos campos
app.post('/api/items', (req, res) => {
  const items = readJSONFile('items.json');
  const newItem = {
    id: items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1,
    marca: req.body.marca || '',
    modelo: req.body.modelo || '',
    patrimonio: req.body.patrimonio,
    serial: req.body.serial || '',
    tipo: req.body.tipo,
    quantidade: req.body.quantidade,
    descricao: req.body.descricao || '',
    localizacao: req.body.localizacao || ''
  };
  items.push(newItem);
  writeJSONFile('items.json', items);
  res.status(201).json(newItem);
});

// Atualizar a rota GET /api/items para retornar os novos campos
app.get('/api/items', (req, res) => {
  const items = readJSONFile('items.json');
  res.json(items);
});

// Adicionar rota de busca por texto (marca, modelo, patrimonio)
app.get('/api/items/search/:query', (req, res) => {
  const items = readJSONFile('items.json');
  const query = req.params.query.toLowerCase();
  const results = items.filter(item => 
    (item.marca && item.marca.toLowerCase().includes(query)) ||
    (item.modelo && item.modelo.toLowerCase().includes(query)) ||
    (item.patrimonio && item.patrimonio.toLowerCase().includes(query))
  );
  res.json(results);
});