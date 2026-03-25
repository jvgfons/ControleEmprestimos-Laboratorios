const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DADOS_DIR = path.join(__dirname, 'dados');
const ALLOWED_METADATA_FIELDS = new Set(['marca', 'modelo', 'localizacao']);

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

function emptyMetadataStore() {
  return {
    marca: [],
    modelo: [],
    localizacao: [],
  };
}

function readMetadataStore() {
  const data = readJSONFile('metadata.json');

  if (!data || Array.isArray(data)) {
    return emptyMetadataStore();
  }

  return {
    marca: Array.isArray(data.marca) ? data.marca.map((value) => String(value || '').trim()).filter(Boolean) : [],
    modelo: Array.isArray(data.modelo) ? data.modelo.map((value) => String(value || '').trim()).filter(Boolean) : [],
    localizacao: Array.isArray(data.localizacao)
      ? data.localizacao.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
  };
}

function writeMetadataStore(store) {
  writeJSONFile('metadata.json', {
    marca: [...new Set((store.marca || []).map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),
    modelo: [...new Set((store.modelo || []).map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),
    localizacao: [...new Set((store.localizacao || []).map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),
  });
}

function getMetadataValues(field, items = getItemsRaw()) {
  const store = readMetadataStore();
  return [...new Set([...(store[field] || []), ...items.map((item) => item[field]).filter(Boolean)])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
}

function nextNumericId(records) {
  return records.length > 0 ? Math.max(...records.map((record) => Number(record.id) || 0)) + 1 : 1;
}

function generateYearlySequenceCode(records, prefix, field = 'id', date = new Date()) {
  const year = date.getFullYear();
  const regex = new RegExp(`^${prefix}-${year}-(\\d{4})$`);
  const usedNumbers = new Set(
    records
      .map((record) => String(record?.[field] || '').trim())
      .map((value) => {
        const match = value.match(regex);
        return match ? Number(match[1]) : null;
      })
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 9999)
  );

  for (let number = 1; number <= 9999; number += 1) {
    if (!usedNumbers.has(number)) {
      return `${prefix}-${year}-${String(number).padStart(4, '0')}`;
    }
  }

  throw new Error(`Limite anual de codigos ${prefix}-${year} atingido`);
}

function generateSolicitacaoId(records = []) {
  return generateYearlySequenceCode(records, 'SOL');
}

function generateLoanGroupId(records = []) {
  return generateYearlySequenceCode(records, 'EMP', 'loanGroupId');
}

function getUnitSequence(unitId) {
  const raw = String(unitId || '').split('-').pop();
  return Number(raw) || 1;
}

function getDisplayPatrimonio(unit) {
  if (unit.semPatrimonio) {
    return `Sem patrimonio (unidade ${getUnitSequence(unit.id)})`;
  }

  if (unit.legadoGerado && /^UNIDADE-/.test(unit.patrimonio)) {
    return `Patrimonio pendente (unidade ${getUnitSequence(unit.id)})`;
  }

  return unit.patrimonio;
}

function normalizeUnit(unit, fallbackId, index) {
  const patrimonioInformado = String(unit?.patrimonio || '').trim();
  const semPatrimonio = Boolean(unit?.semPatrimonio);
  const patrimonio =
    patrimonioInformado ||
    (semPatrimonio ? `SEM-PATRIMONIO-${fallbackId}-${index + 1}` : `UNIDADE-${fallbackId}-${index + 1}`);

  const normalized = {
    id: String(unit?.id || `${fallbackId}-${index + 1}`),
    patrimonio,
    patrimonioExibicao: '',
    serial: String(unit?.serial || '').trim(),
    legadoGerado: Boolean(unit?.legadoGerado) || (!patrimonioInformado && !semPatrimonio),
    semPatrimonio,
  };

  normalized.patrimonioExibicao = getDisplayPatrimonio(normalized);
  return normalized;
}

function normalizeItem(rawItem) {
  const fallbackId = Number(rawItem.id) || Date.now();
  let unidades = [];

  if (Array.isArray(rawItem.unidades) && rawItem.unidades.length > 0) {
    unidades = rawItem.unidades.map((unit, index) => normalizeUnit(unit, fallbackId, index));
  } else {
    const quantidadeLegada = Math.max(
      Number(rawItem.quantidade) || 0,
      rawItem.patrimonio || rawItem.serial ? 1 : 0
    );

    if (quantidadeLegada > 0) {
      unidades.push(
        normalizeUnit(
          {
            id: `${fallbackId}-1`,
            patrimonio: rawItem.patrimonio || '',
            serial: rawItem.serial || '',
            legadoGerado: !rawItem.patrimonio,
          },
          fallbackId,
          0
        )
      );
    }

    while (unidades.length < quantidadeLegada) {
      unidades.push(
        normalizeUnit(
          {
            id: `${fallbackId}-${unidades.length + 1}`,
            patrimonio: '',
            serial: '',
            legadoGerado: true,
          },
          fallbackId,
          unidades.length
        )
      );
    }
  }

  const titulo =
    String(rawItem.titulo || '').trim() ||
    String(rawItem.descricao || '').trim() ||
    String(rawItem.nome || '').trim() ||
    [rawItem.marca, rawItem.modelo].filter(Boolean).join(' ').trim();

  return {
    id: Number(rawItem.id) || fallbackId,
    titulo,
    nome: titulo,
    marca: String(rawItem.marca || '').trim(),
    modelo: String(rawItem.modelo || '').trim(),
    tipo: String(rawItem.tipo || '').trim(),
    localizacao: String(rawItem.localizacao || '').trim(),
    unidades,
  };
}

function serializeItem(item) {
  return {
    id: item.id,
    titulo: item.titulo,
    marca: item.marca,
    modelo: item.modelo,
    tipo: item.tipo,
    localizacao: item.localizacao,
    quantidade: item.unidades.length,
    unidades: item.unidades.map((unit) => ({
      id: unit.id,
      patrimonio: unit.patrimonio,
      serial: unit.serial || '',
      legadoGerado: Boolean(unit.legadoGerado),
      semPatrimonio: Boolean(unit.semPatrimonio),
    })),
    patrimonio: item.unidades[0]?.patrimonio || '',
    serial: item.unidades[0]?.serial || '',
  };
}

function normalizeSolicitacao(rawSolicitacao) {
  const itensBrutos =
    Array.isArray(rawSolicitacao.itens) && rawSolicitacao.itens.length > 0
      ? rawSolicitacao.itens
      : rawSolicitacao.itemId
        ? [
            {
              id: `${rawSolicitacao.id}-1`,
              itemId: Number(rawSolicitacao.itemId),
              itemNome: rawSolicitacao.itemNome || '',
              quantidade: Number(rawSolicitacao.quantidade) || 1,
              itemPatrimonios: rawSolicitacao.itemPatrimonio ? [rawSolicitacao.itemPatrimonio] : [],
            },
          ]
        : [];

  const itens = itensBrutos.map((item, index) => ({
    id: String(item.id || `${rawSolicitacao.id}-item-${index + 1}`),
    itemId: Number(item.itemId),
    itemNome: String(item.itemNome || '').trim(),
    quantidade: Math.max(1, Number(item.quantidade) || 1),
    itemPatrimonios: Array.isArray(item.itemPatrimonios)
      ? item.itemPatrimonios.map((value) => String(value || '').trim()).filter(Boolean)
      : rawSolicitacao.itemPatrimonio
        ? [String(rawSolicitacao.itemPatrimonio).trim()]
        : [],
    itemUnitIds: Array.isArray(item.itemUnitIds)
      ? item.itemUnitIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
  }));

  return {
    ...rawSolicitacao,
    itens,
    itemId: itens[0]?.itemId || Number(rawSolicitacao.itemId) || null,
    itemNome: itens[0]?.itemNome || String(rawSolicitacao.itemNome || '').trim(),
    itemPatrimonio:
      rawSolicitacao.itemPatrimonio ||
      itens.flatMap((item) => item.itemPatrimonios).filter(Boolean).join(', '),
    quantidadeTotal: itens.reduce((sum, item) => sum + item.quantidade, 0),
  };
}

function serializeSolicitacao(solicitacao) {
  return {
    ...solicitacao,
    itemId: solicitacao.itens[0]?.itemId || null,
    itemNome: solicitacao.itens[0]?.itemNome || '',
    itemPatrimonio: solicitacao.itens
      .flatMap((item) => item.itemPatrimonios || [])
      .filter(Boolean)
      .join(', '),
    itens: solicitacao.itens.map((item) => ({
      id: item.id,
      itemId: item.itemId,
      itemNome: item.itemNome,
      quantidade: item.quantidade,
      itemPatrimonios: item.itemPatrimonios || [],
      itemUnitIds: item.itemUnitIds || [],
    })),
  };
}

function getRelatedLoansForSolicitacao(solicitacao, loans) {
  const loanIds = Array.isArray(solicitacao.loanIds)
    ? solicitacao.loanIds
    : solicitacao.loanId
      ? [solicitacao.loanId]
      : [];

  const idsSet = new Set(loanIds.map((value) => Number(value)).filter(Boolean));

  return loans.filter(
    (loan) =>
      idsSet.has(Number(loan.id)) ||
      (solicitacao.loanGroupId && loan.loanGroupId === solicitacao.loanGroupId) ||
      (loan.solicitacaoId && loan.solicitacaoId === solicitacao.id)
  );
}

function getItemsRaw() {
  return readJSONFile('items.json').map(normalizeItem);
}

function saveItems(items) {
  writeJSONFile(
    'items.json',
    items.map((item) => serializeItem(item))
  );
}

function getSolicitacoesRaw() {
  return readJSONFile('solicitacoes.json').map(normalizeSolicitacao);
}

function saveSolicitacoes(solicitacoes) {
  writeJSONFile(
    'solicitacoes.json',
    solicitacoes.map((solicitacao) => serializeSolicitacao(solicitacao))
  );
}

function getActiveLoans() {
  return readJSONFile('loans.json').filter((loan) => loan.status === 'ativo');
}

function getReservedUnitsMap(activeLoans = getActiveLoans()) {
  const reserved = new Map();

  activeLoans.forEach((loan) => {
    const itemId = Number(loan.itemId);
    const unitId = String(loan.itemUnitId || '').trim();
    const patrimonio = String(loan.itemPatrimonioReal || loan.itemPatrimonio || '').trim();

    if (!itemId) {
      return;
    }

    if (!reserved.has(itemId)) {
      reserved.set(itemId, new Set());
    }

    if (unitId) {
      reserved.get(itemId).add(unitId);
    }

    if (patrimonio) {
      reserved.get(itemId).add(patrimonio);
    }
  });

  return reserved;
}

function getComputedItems() {
  const reservedMap = getReservedUnitsMap();

  return getItemsRaw().map((item) => {
    const reservedTokens = reservedMap.get(item.id) || new Set();
    const unidades = item.unidades.map((unit) => ({
      ...unit,
      patrimonioExibicao: getDisplayPatrimonio(unit),
    }));
    const unidadesDisponiveis = unidades.filter(
      (unit) => !reservedTokens.has(unit.id) && !reservedTokens.has(unit.patrimonio)
    );

    return {
      ...item,
      unidades,
      quantidade: unidades.length,
      disponiveis: unidadesDisponiveis.length,
      unidadesDisponiveis,
      patrimonio: unidades[0]?.patrimonioExibicao || '',
      patrimonioReal: unidades[0]?.patrimonio || '',
      serial: unidades[0]?.serial || '',
    };
  });
}

function getSearchableText(item) {
  return [
    item.titulo,
    item.nome,
    item.marca,
    item.modelo,
    item.tipo,
    item.localizacao,
    ...item.unidades.map((unit) => unit.patrimonio),
    ...item.unidades.map((unit) => unit.patrimonioExibicao),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function findItemByPatrimonio(items, patrimonio, ignoredItemId = null) {
  const patrimonioNormalizado = String(patrimonio || '').trim().toLowerCase();
  if (!patrimonioNormalizado) {
    return null;
  }

  return items.find((item) => {
    if (ignoredItemId !== null && Number(item.id) === Number(ignoredItemId)) {
      return false;
    }

    return item.unidades.some(
      (unit) =>
        !unit.semPatrimonio &&
        String(unit.patrimonio || '').trim().toLowerCase() === patrimonioNormalizado
    );
  });
}

function validateRequiredFields(res, payload, fields) {
  const missing = fields.filter((field) => !String(payload[field] || '').trim());
  if (missing.length > 0) {
    res.status(400).json({
      error: `Campos obrigatorios nao informados: ${missing.join(', ')}`,
    });
    return false;
  }
  return true;
}

function parsePatrimoniosInput(payload) {
  const rawList = Array.isArray(payload.patrimonios)
    ? payload.patrimonios
    : String(payload.patrimonio || '')
        .split(/\r?\n|,|;/)
        .map((value) => value.trim());

  return rawList.filter(Boolean);
}

function normalizeLineItems(itemsInput, fallbackItem) {
  const rawItems =
    Array.isArray(itemsInput) && itemsInput.length > 0
      ? itemsInput
      : fallbackItem
        ? [fallbackItem]
        : [];

  return rawItems.map((item, index) => ({
    id: String(item.id || `line-${index + 1}`),
    itemId: Number(item.itemId),
    itemNome: String(item.itemNome || '').trim(),
    quantidade: Math.max(1, Number(item.quantidade || item.quantity) || 1),
    unitIds: Array.isArray(item.unitIds)
      ? item.unitIds.map((value) => String(value || '').trim()).filter(Boolean)
      : Array.isArray(item.itemUnitIds)
        ? item.itemUnitIds.map((value) => String(value || '').trim()).filter(Boolean)
        : item.itemUnitId
          ? [String(item.itemUnitId).trim()]
          : [],
  }));
}

function buildAvailabilityContext() {
  const computedItems = getComputedItems();
  const itemsById = new Map(computedItems.map((item) => [Number(item.id), item]));
  const remainingByItemId = new Map(
    computedItems.map((item) => [Number(item.id), [...item.unidadesDisponiveis]])
  );

  return { computedItems, itemsById, remainingByItemId };
}

function takeUnitsFromAvailability(item, remainingUnits, line, requireExplicitSelection) {
  const quantity = Math.max(1, Number(line.quantidade) || 1);
  const requestedUnitIds = line.unitIds;

  if (remainingUnits.length < quantity) {
    throw new Error(`Quantidade indisponivel para ${item.titulo}`);
  }

  if (requestedUnitIds.length > 0) {
    if (requestedUnitIds.length !== quantity) {
      throw new Error(`Selecione ${quantity} patrimonio(s) para ${item.titulo}`);
    }

    const duplicated = requestedUnitIds.find(
      (unitId, index) => requestedUnitIds.indexOf(unitId) !== index
    );

    if (duplicated) {
      throw new Error(`O patrimonio selecionado foi repetido em ${item.titulo}`);
    }

    const selectedUnits = requestedUnitIds.map((unitId) => {
      const unit = remainingUnits.find((entry) => entry.id === unitId);
      if (!unit) {
        throw new Error(`Um dos patrimonios escolhidos para ${item.titulo} nao esta disponivel`);
      }
      return unit;
    });

    selectedUnits.forEach((unit) => {
      const unitIndex = remainingUnits.findIndex((entry) => entry.id === unit.id);
      if (unitIndex >= 0) {
        remainingUnits.splice(unitIndex, 1);
      }
    });

    return selectedUnits;
  }

  if (requireExplicitSelection && (quantity > 1 || item.unidadesDisponiveis.length > 1)) {
    throw new Error(`Selecione os patrimonios para ${item.titulo}`);
  }

  return remainingUnits.splice(0, quantity);
}

function assertRequestedQuantities(lines, availabilityContext) {
  lines.forEach((line) => {
    const item = availabilityContext.itemsById.get(Number(line.itemId));
    if (!item) {
      throw new Error('Item nao encontrado');
    }

    const remainingUnits = availabilityContext.remainingByItemId.get(Number(line.itemId)) || [];
    if (remainingUnits.length < line.quantidade) {
      throw new Error(`Quantidade indisponivel para ${item.titulo}`);
    }

    remainingUnits.splice(0, line.quantidade);
  });
}

// ===== LOGIN =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSONFile('users.json');

  const user = users.find((entry) => entry.username === username && entry.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Credenciais invalidas' });
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
  res.json(getComputedItems());
});

app.post('/api/items', (req, res) => {
  const items = getItemsRaw();
  const payload = req.body || {};
  const existingItemId = Number(payload.existingItemId);
  const patrimonios = parsePatrimoniosInput(payload);
  const serial = String(payload.serial || '').trim();

  const duplicatedPatrimonio = patrimonios.find(
    (patrimonio, index) => patrimonios.findIndex((value) => value === patrimonio) !== index
  );

  if (duplicatedPatrimonio) {
    return res.status(400).json({ error: `O patrimonio ${duplicatedPatrimonio} foi informado mais de uma vez` });
  }

  const patrimonioExistente = patrimonios.find((patrimonio) =>
    findItemByPatrimonio(items, patrimonio, Number.isFinite(existingItemId) ? existingItemId : null)
  );

  if (patrimonioExistente) {
    return res.status(400).json({ error: 'Ja existe uma unidade cadastrada com esse patrimonio' });
  }

  if (Number.isFinite(existingItemId) && existingItemId > 0) {
    const item = items.find((entry) => Number(entry.id) === existingItemId);

    if (!item) {
      return res.status(404).json({ error: 'Item base nao encontrado' });
    }

    const unidadesParaAdicionar =
      patrimonios.length > 0
        ? patrimonios.map((patrimonio, index) =>
            normalizeUnit(
              {
                id: `${item.id}-${item.unidades.length + index + 1}`,
                patrimonio,
                serial: index === 0 ? serial : '',
                semPatrimonio: false,
              },
              item.id,
              item.unidades.length + index
            )
          )
        : [
            normalizeUnit(
              {
                id: `${item.id}-${item.unidades.length + 1}`,
                patrimonio: '',
                serial,
                semPatrimonio: true,
              },
              item.id,
              item.unidades.length
            ),
          ];

    item.unidades.push(...unidadesParaAdicionar);

    saveItems(items);

    const updatedItem = getComputedItems().find((entry) => Number(entry.id) === existingItemId);
    return res.status(201).json(updatedItem);
  }

  if (!validateRequiredFields(res, payload, ['titulo', 'marca', 'modelo', 'tipo'])) {
    return;
  }

  const newId = nextNumericId(items);
  const newItem = {
    id: newId,
    titulo: String(payload.titulo || '').trim(),
    marca: String(payload.marca || '').trim(),
    modelo: String(payload.modelo || '').trim(),
    tipo: String(payload.tipo || '').trim(),
    localizacao: String(payload.localizacao || '').trim(),
    unidades:
      patrimonios.length > 0
        ? patrimonios.map((patrimonio, index) =>
            normalizeUnit(
              {
                id: `${newId}-${index + 1}`,
                patrimonio,
                serial: index === 0 ? serial : '',
                semPatrimonio: false,
              },
              newId,
              index
            )
          )
        : [
            normalizeUnit(
              {
                id: `${newId}-1`,
                patrimonio: '',
                serial,
                semPatrimonio: true,
              },
              newId,
              0
            ),
          ],
  };

  items.push(newItem);
  saveItems(items);

  const createdItem = getComputedItems().find((entry) => Number(entry.id) === newId);
  return res.status(201).json(createdItem);
});

app.put('/api/items/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const items = getItemsRaw();
  const item = items.find((entry) => Number(entry.id) === itemId);

  if (!item) {
    return res.status(404).json({ error: 'Item nao encontrado' });
  }

  const payload = req.body || {};

  if (Array.isArray(payload.unidades)) {
    const normalizedUnits = payload.unidades.map((unit, index) => normalizeUnit(unit, itemId, index));
    const duplicated = normalizedUnits.find(
      (unit, index) =>
        !unit.semPatrimonio &&
        normalizedUnits.findIndex((other) => other.patrimonio === unit.patrimonio) !== index
    );

    if (duplicated) {
      return res.status(400).json({ error: 'Nao e permitido repetir patrimonio no mesmo item' });
    }

    const patrimonioEmOutroItem = normalizedUnits.find(
      (unit) => !unit.semPatrimonio && findItemByPatrimonio(items, unit.patrimonio, itemId)
    );

    if (patrimonioEmOutroItem) {
      return res
        .status(400)
        .json({ error: `O patrimonio ${patrimonioEmOutroItem.patrimonio} ja esta em outro item` });
    }

    item.unidades = normalizedUnits;
  }

  item.titulo = String(payload.titulo ?? item.titulo).trim();
  item.marca = String(payload.marca ?? item.marca).trim();
  item.modelo = String(payload.modelo ?? item.modelo).trim();
  item.tipo = String(payload.tipo ?? item.tipo).trim();
  item.localizacao = String(payload.localizacao ?? item.localizacao).trim();

  saveItems(items);
  const updatedItem = getComputedItems().find((entry) => Number(entry.id) === itemId);
  return res.json(updatedItem);
});

app.delete('/api/items/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const items = getItemsRaw();
  const loans = readJSONFile('loans.json');

  const hasActiveLoan = loans.some(
    (loan) => Number(loan.itemId) === itemId && loan.status === 'ativo'
  );

  if (hasActiveLoan) {
    return res.status(400).json({ error: 'Item possui emprestimo ativo e nao pode ser removido' });
  }

  const filtered = items.filter((entry) => Number(entry.id) !== itemId);

  if (filtered.length === items.length) {
    return res.status(404).json({ error: 'Item nao encontrado' });
  }

  saveItems(filtered);
  return res.json({ success: true });
});

app.get('/api/metadata', (req, res) => {
  const items = getItemsRaw();
  res.json({
    marca: getMetadataValues('marca', items),
    modelo: getMetadataValues('modelo', items),
    localizacao: getMetadataValues('localizacao', items),
  });
});

app.post('/api/metadata', (req, res) => {
  const { field, value } = req.body || {};

  if (!ALLOWED_METADATA_FIELDS.has(field)) {
    return res.status(400).json({ error: 'Campo de metadado invalido' });
  }

  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return res.status(400).json({ error: 'Informe o valor a cadastrar' });
  }

  const store = readMetadataStore();
  store[field] = [...new Set([...(store[field] || []), normalizedValue])];
  writeMetadataStore(store);

  return res.status(201).json({ success: true, values: getMetadataValues(field) });
});

app.put('/api/metadata', (req, res) => {
  const { field, oldValue, newValue } = req.body || {};

  if (!ALLOWED_METADATA_FIELDS.has(field)) {
    return res.status(400).json({ error: 'Campo de metadado invalido' });
  }

  const oldValueNormalized = String(oldValue || '').trim();
  const newValueNormalized = String(newValue || '').trim();

  if (!oldValueNormalized || !newValueNormalized) {
    return res.status(400).json({ error: 'Informe os valores antigo e novo' });
  }

  const items = getItemsRaw();
  const store = readMetadataStore();
  let updatedCount = 0;

  items.forEach((item) => {
    if (String(item[field] || '').trim() === oldValueNormalized) {
      item[field] = newValueNormalized;
      updatedCount += 1;
    }
  });

  saveItems(items);
  store[field] = (store[field] || []).map((value) =>
    String(value || '').trim() === oldValueNormalized ? newValueNormalized : value
  );
  if (!store[field].includes(newValueNormalized)) {
    store[field].push(newValueNormalized);
  }
  writeMetadataStore(store);

  return res.json({ success: true, updatedCount, values: getMetadataValues(field, items) });
});

app.delete('/api/metadata', (req, res) => {
  const { field, value } = req.body || {};

  if (!ALLOWED_METADATA_FIELDS.has(field)) {
    return res.status(400).json({ error: 'Campo de metadado invalido' });
  }

  const valueNormalized = String(value || '').trim();
  if (!valueNormalized) {
    return res.status(400).json({ error: 'Informe o valor a remover' });
  }

  const items = getItemsRaw();
  const store = readMetadataStore();
  let updatedCount = 0;

  items.forEach((item) => {
    if (String(item[field] || '').trim() === valueNormalized) {
      item[field] = '';
      updatedCount += 1;
    }
  });

  saveItems(items);
  store[field] = (store[field] || []).filter((value) => String(value || '').trim() !== valueNormalized);
  writeMetadataStore(store);

  return res.json({ success: true, updatedCount, values: getMetadataValues(field, items) });
});

app.get('/api/items/search/nome/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = getComputedItems().filter((item) => {
    const searchable = [item.titulo, item.marca, item.modelo, item.localizacao]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });

  res.json(results);
});

app.get('/api/items/search/patrimonio/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = getComputedItems().filter((item) =>
    item.unidades.some(
      (unit) =>
        unit.patrimonio.toLowerCase().includes(query) ||
        unit.patrimonioExibicao.toLowerCase().includes(query)
    )
  );

  res.json(results);
});

app.get('/api/items/search/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const results = getComputedItems().filter((item) => getSearchableText(item).includes(query));
  res.json(results);
});

// ===== EMPRESTIMOS =====
app.get('/api/loans', (req, res) => {
  res.json(readJSONFile('loans.json'));
});

app.get('/api/loans/active', (req, res) => {
  const active = readJSONFile('loans.json').filter((loan) => loan.status === 'ativo');
  res.json(active);
});

app.post('/api/loans', (req, res) => {
  const loans = readJSONFile('loans.json');
  const lines = normalizeLineItems(req.body.items, req.body.itemId ? req.body : null);

  if (lines.length === 0) {
    return res.status(400).json({ error: 'Nenhum item foi informado para o emprestimo' });
  }

  const availabilityContext = buildAvailabilityContext();
  const loanGroupId = generateLoanGroupId(loans);
  const createdLoans = [];

  try {
    lines.forEach((line) => {
      const item = availabilityContext.itemsById.get(Number(line.itemId));

      if (!item) {
        throw new Error('Item nao encontrado');
      }

      const remainingUnits = availabilityContext.remainingByItemId.get(Number(line.itemId)) || [];
      const selectedUnits = takeUnitsFromAvailability(item, remainingUnits, line, true);

      selectedUnits.forEach((unit) => {
        createdLoans.push({
          id: nextNumericId([...loans, ...createdLoans]),
          loanGroupId,
          itemId: Number(item.id),
          itemNome: line.itemNome || item.titulo,
          itemUnitId: unit.id,
          itemPatrimonio: unit.patrimonioExibicao,
          itemPatrimonioReal: unit.patrimonio,
          solicitante: req.body.solicitante || req.body.nome || '',
          email: req.body.email || '',
          dataRetirada: req.body.dataRetirada,
          dataDevolucaoPrevista: req.body.dataDevolucaoPrevista || req.body.dataDevolucao,
          dataDevolucaoReal: null,
          observacoes: req.body.observacoes || '',
          status: 'ativo',
          dataCriacao: new Date().toISOString(),
        });
      });
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erro ao registrar emprestimo' });
  }

  loans.push(...createdLoans);
  writeJSONFile('loans.json', loans);
  return res.status(201).json({ success: true, loanGroupId, loans: createdLoans });
});

app.put('/api/loans/:id/concluir', (req, res) => {
  const loanId = Number(req.params.id);
  const loans = readJSONFile('loans.json');

  const loanIndex = loans.findIndex((loan) => Number(loan.id) === loanId);
  if (loanIndex === -1) {
    return res.status(404).json({ error: 'Emprestimo nao encontrado' });
  }

  if (loans[loanIndex].status === 'concluido') {
    return res.status(400).json({ error: 'Emprestimo ja concluido' });
  }

  loans[loanIndex].status = 'concluido';
  loans[loanIndex].dataDevolucaoReal = req.body.dataDevolucaoReal || new Date().toISOString();

  writeJSONFile('loans.json', loans);
  return res.json(loans[loanIndex]);
});

// ===== SOLICITACOES =====
app.get('/api/solicitacoes', (req, res) => {
  res.json(getSolicitacoesRaw());
});

app.get('/api/solicitacoes/email/:email', (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Informe um e-mail para consulta' });
  }

  const solicitacoes = getSolicitacoesRaw();
  const loans = readJSONFile('loans.json');

  const results = solicitacoes
    .filter((solicitacao) => String(solicitacao.email || '').trim().toLowerCase() === email)
    .sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime())
    .map((solicitacao) => ({
      ...solicitacao,
      loans: getRelatedLoansForSolicitacao(solicitacao, loans),
    }));

  res.json(results);
});

app.post('/api/solicitacoes', (req, res) => {
  const solicitacoes = getSolicitacoesRaw();
  const lines = normalizeLineItems(req.body.items, req.body.itemId ? req.body : null).map((line) => ({
    ...line,
    itemPatrimonios: [],
    itemUnitIds: [],
  }));

  if (lines.length === 0) {
    return res.status(400).json({ error: 'Nenhum item foi informado para a solicitacao' });
  }

  if (!String(req.body.nome || '').trim() || !String(req.body.email || '').trim()) {
    return res.status(400).json({ error: 'Nome e e-mail sao obrigatorios para a solicitacao' });
  }

  try {
    assertRequestedQuantities(lines, buildAvailabilityContext());
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erro ao validar solicitacao' });
  }

  const novaSolicitacao = normalizeSolicitacao({
    id: generateSolicitacaoId(solicitacoes),
    nome: req.body.nome || '',
    email: req.body.email || '',
    dataRetirada: req.body.dataRetirada,
    dataDevolucao: req.body.dataDevolucao,
    status: 'pendente',
    dataSolicitacao: new Date().toISOString(),
    motivoRejeicao: null,
    itens: lines,
  });

  solicitacoes.push(novaSolicitacao);
  saveSolicitacoes(solicitacoes);
  return res.status(201).json(novaSolicitacao);
});

app.put('/api/solicitacoes/:id/aprovar', (req, res) => {
  const solicitacoes = getSolicitacoesRaw();
  const loans = readJSONFile('loans.json');
  const solicitacaoIndex = solicitacoes.findIndex((entry) => entry.id === req.params.id);

  if (solicitacaoIndex === -1) {
    return res.status(404).json({ error: 'Solicitacao nao encontrada' });
  }

  const solicitacao = solicitacoes[solicitacaoIndex];
  if (solicitacao.status !== 'pendente') {
    return res.status(400).json({ error: 'Somente solicitacoes pendentes podem ser aprovadas' });
  }

  const allocationInput = Array.isArray(req.body.items) ? req.body.items : [];
  const allocationByLineId = new Map(
    allocationInput.map((item) => [
      String(item.id || item.lineId || ''),
      {
        unitIds: Array.isArray(item.unitIds)
          ? item.unitIds.map((value) => String(value || '').trim()).filter(Boolean)
          : [],
      },
    ])
  );

  const availabilityContext = buildAvailabilityContext();
  const loanGroupId = generateLoanGroupId(loans);
  const createdLoans = [];

  try {
    solicitacao.itens.forEach((line) => {
      const item = availabilityContext.itemsById.get(Number(line.itemId));

      if (!item) {
        throw new Error('Item da solicitacao nao encontrado');
      }

      const remainingUnits = availabilityContext.remainingByItemId.get(Number(line.itemId)) || [];
      const allocation = allocationByLineId.get(String(line.id)) || { unitIds: [] };
      const selectedUnits = takeUnitsFromAvailability(
        item,
        remainingUnits,
        { ...line, unitIds: allocation.unitIds },
        true
      );

      line.itemUnitIds = selectedUnits.map((unit) => unit.id);
      line.itemPatrimonios = selectedUnits.map((unit) => unit.patrimonioExibicao);

      selectedUnits.forEach((unit) => {
        createdLoans.push({
          id: nextNumericId([...loans, ...createdLoans]),
          loanGroupId,
          solicitacaoId: solicitacao.id,
          itemId: Number(item.id),
          itemNome: line.itemNome || item.titulo,
          itemUnitId: unit.id,
          itemPatrimonio: unit.patrimonioExibicao,
          itemPatrimonioReal: unit.patrimonio,
          solicitante: solicitacao.nome,
          email: solicitacao.email,
          dataRetirada: solicitacao.dataRetirada,
          dataDevolucaoPrevista: solicitacao.dataDevolucao,
          dataDevolucaoReal: null,
          observacoes: 'Gerado por aprovacao de solicitacao',
          status: 'ativo',
          dataCriacao: new Date().toISOString(),
        });
      });
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erro ao aprovar solicitacao' });
  }

  loans.push(...createdLoans);
  solicitacao.status = 'aprovado';
  solicitacao.dataAprovacao = new Date().toISOString();
  solicitacao.loanIds = createdLoans.map((loan) => loan.id);
  solicitacao.loanGroupId = loanGroupId;

  saveSolicitacoes(solicitacoes);
  writeJSONFile('loans.json', loans);
  return res.json({ success: true, solicitacao, loans: createdLoans, loanGroupId });
});

app.put('/api/solicitacoes/:id/rejeitar', (req, res) => {
  const solicitacoes = getSolicitacoesRaw();
  const solicitacaoIndex = solicitacoes.findIndex((entry) => entry.id === req.params.id);

  if (solicitacaoIndex === -1) {
    return res.status(404).json({ error: 'Solicitacao nao encontrada' });
  }

  solicitacoes[solicitacaoIndex].status = 'rejeitado';
  solicitacoes[solicitacaoIndex].motivoRejeicao = req.body.motivo || 'Sem motivo informado';
  solicitacoes[solicitacaoIndex].dataRejeicao = new Date().toISOString();

  saveSolicitacoes(solicitacoes);
  return res.json({ success: true, solicitacao: solicitacoes[solicitacaoIndex] });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
