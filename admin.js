// Configuração da API
const API_URL = 'http://localhost:3000/api';

// Verificar se está logado
if (!localStorage.getItem('adminLoggedIn')) {
  window.location.href = 'index.html';
}

// Dados do usuário logado
const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

// Atualizar informações do usuário
function updateUserInfo() {
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    if (adminUser.nome) {
      userNameElement.textContent = adminUser.nome;
    } else if (adminUser.username) {
      userNameElement.textContent = adminUser.username;
    } else {
      userNameElement.textContent = 'Administrador';
    }
  }
}
updateUserInfo();

// Variáveis globais
let items = [];
let marcas = new Set();
let modelos = new Set();
let selectedItemForLoan = null;

// ========== FUNÇÕES DE API ==========
async function fetchItems() {
  try {
    const response = await fetch(`${API_URL}/items`);
    items = await response.json();
    // Extrair marcas e modelos únicos
    items.forEach(item => {
      if (item.marca) marcas.add(item.marca);
      if (item.modelo) modelos.add(item.modelo);
    });
    return items;
  } catch (error) {
    console.error('Erro ao carregar itens:', error);
    return [];
  }
}

async function createItem(item) {
  try {
    const response = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao criar item:', error);
    throw error;
  }
}

async function updateItem(id, item) {
  try {
    const response = await fetch(`${API_URL}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    throw error;
  }
}

async function deleteItem(id) {
  try {
    const response = await fetch(`${API_URL}/items/${id}`, {
      method: 'DELETE'
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao deletar item:', error);
    throw error;
  }
}

async function fetchLoans() {
  try {
    const response = await fetch(`${API_URL}/loans`);
    return await response.json();
  } catch (error) {
    console.error('Erro ao carregar empréstimos:', error);
    return [];
  }
}

async function fetchActiveLoans() {
  try {
    const response = await fetch(`${API_URL}/loans/active`);
    return await response.json();
  } catch (error) {
    console.error('Erro ao carregar empréstimos ativos:', error);
    return [];
  }
}

async function createLoan(loan) {
  try {
    const response = await fetch(`${API_URL}/loans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loan)
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao criar empréstimo:', error);
    throw error;
  }
}

async function concluirLoan(id) {
  try {
    const response = await fetch(`${API_URL}/loans/${id}/concluir`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataDevolucaoReal: new Date().toISOString() })
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao concluir empréstimo:', error);
    throw error;
  }
}

async function fetchSolicitacoes() {
  try {
    const response = await fetch(`${API_URL}/solicitacoes`);
    return await response.json();
  } catch (error) {
    console.error('Erro ao carregar solicitações:', error);
    return [];
  }
}

async function aprovarSolicitacao(id) {
  try {
    const response = await fetch(`${API_URL}/solicitacoes/${id}/aprovar`, {
      method: 'PUT'
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao aprovar solicitação:', error);
    throw error;
  }
}

async function rejeitarSolicitacao(id, motivo) {
  try {
    const response = await fetch(`${API_URL}/solicitacoes/${id}/rejeitar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao rejeitar solicitação:', error);
    throw error;
  }
}

// ========== FUNÇÕES DE BUSCA COM SUGESTÕES ==========
function searchItemsByMarca(query) {
  return items.filter(item => item.marca && item.marca.toLowerCase().includes(query.toLowerCase()));
}

function searchItemsByModelo(query) {
  return items.filter(item => item.modelo && item.modelo.toLowerCase().includes(query.toLowerCase()));
}

function searchItemsByPatrimonio(query) {
  return items.filter(item => item.patrimonio && item.patrimonio.toLowerCase().includes(query.toLowerCase()));
}

function searchItemsByText(query) {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  return items.filter(item => 
    (item.marca && item.marca.toLowerCase().includes(lowerQuery)) ||
    (item.modelo && item.modelo.toLowerCase().includes(lowerQuery)) ||
    (item.patrimonio && item.patrimonio.toLowerCase().includes(lowerQuery))
  );
}

function showMarcaSuggestions(suggestions, inputId, suggestionsId) {
  const suggestionsDiv = document.getElementById(suggestionsId);
  if (suggestions.length === 0 || !suggestionsDiv) {
    suggestionsDiv.classList.remove('active');
    return;
  }
  
  const uniqueMarcas = [...new Set(suggestions.map(s => s.marca))];
  suggestionsDiv.innerHTML = uniqueMarcas.map(marca => `
    <div class="suggestion-item" data-value="${marca}">
      <strong>${marca}</strong>
      <small>Clique para selecionar</small>
    </div>
  `).join('');
  
  suggestionsDiv.classList.add('active');
  
  document.querySelectorAll(`#${suggestionsId} .suggestion-item`).forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(inputId).value = el.dataset.value;
      suggestionsDiv.classList.remove('active');
    });
  });
}

function showModeloSuggestions(suggestions, inputId, suggestionsId) {
  const suggestionsDiv = document.getElementById(suggestionsId);
  if (suggestions.length === 0 || !suggestionsDiv) {
    suggestionsDiv.classList.remove('active');
    return;
  }
  
  const uniqueModelos = [...new Set(suggestions.map(s => s.modelo))];
  suggestionsDiv.innerHTML = uniqueModelos.map(modelo => `
    <div class="suggestion-item" data-value="${modelo}">
      <strong>${modelo}</strong>
      <small>Clique para selecionar</small>
    </div>
  `).join('');
  
  suggestionsDiv.classList.add('active');
  
  document.querySelectorAll(`#${suggestionsId} .suggestion-item`).forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(inputId).value = el.dataset.value;
      suggestionsDiv.classList.remove('active');
    });
  });
}

function showItemSuggestions(suggestions, suggestionsId, onSelect) {
  const suggestionsDiv = document.getElementById(suggestionsId);
  if (suggestions.length === 0 || !suggestionsDiv) {
    suggestionsDiv.classList.remove('active');
    return;
  }
  
  suggestionsDiv.innerHTML = suggestions.map(item => `
    <div class="suggestion-item" data-id="${item.id}">
      <strong>${item.marca} ${item.modelo}</strong>
      <small>Patrimônio: ${item.patrimonio} | Disponível: ${item.quantidade}</small>
    </div>
  `).join('');
  
  suggestionsDiv.classList.add('active');
  
  document.querySelectorAll(`#${suggestionsId} .suggestion-item`).forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id);
      const selected = items.find(i => i.id === id);
      if (selected && onSelect) onSelect(selected);
      suggestionsDiv.classList.remove('active');
    });
  });
}

// ========== FUNÇÕES DE UI ==========
function showFeedback(elementId, message, type) {
  const feedback = document.getElementById(elementId);
  feedback.style.display = 'block';
  feedback.className = `feedback-message ${type}`;
  feedback.innerHTML = message;
  
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 5000);
}

// ========== CADASTRO DE ITEM COM SUGESTÕES ==========
const marcaInput = document.getElementById('itemMarca');
const modeloInput = document.getElementById('itemModelo');

if (marcaInput) {
  marcaInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (!query) {
      document.getElementById('marcaSuggestions').classList.remove('active');
      return;
    }
    const results = searchItemsByMarca(query);
    showMarcaSuggestions(results, 'itemMarca', 'marcaSuggestions');
  });
}

if (modeloInput) {
  modeloInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (!query) {
      document.getElementById('modeloSuggestions').classList.remove('active');
      return;
    }
    const results = searchItemsByModelo(query);
    showModeloSuggestions(results, 'itemModelo', 'modeloSuggestions');
  });
}

// Cadastrar Item
const cadastrarItemForm = document.getElementById('cadastrarItemForm');
if (cadastrarItemForm) {
  cadastrarItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novoItem = {
      marca: document.getElementById('itemMarca').value.trim(),
      modelo: document.getElementById('itemModelo').value.trim(),
      patrimonio: document.getElementById('itemPatrimonio').value.trim(),
      serial: document.getElementById('itemSerial').value.trim(),
      tipo: document.getElementById('itemTipo').value,
      quantidade: parseInt(document.getElementById('itemQuantidade').value),
      descricao: document.getElementById('itemDescricao').value.trim(),
      localizacao: document.getElementById('itemLocalizacao').value.trim()
    };
    
    if (!novoItem.marca || !novoItem.modelo || !novoItem.patrimonio || !novoItem.tipo) {
      showFeedback('cadastroItemFeedback', '⚠️ Preencha todos os campos obrigatórios', 'error');
      return;
    }
    
    try {
      await createItem(novoItem);
      showFeedback('cadastroItemFeedback', '✓ Item cadastrado com sucesso!', 'success');
      cadastrarItemForm.reset();
      await fetchItems();
      loadGerenciarItems();
      loadMarcasList();
      loadModelosList();
    } catch (error) {
      showFeedback('cadastroItemFeedback', '❌ Erro ao cadastrar item', 'error');
    }
  });
}

// ========== CADASTRO DE EMPRÉSTIMO COM BUSCA DE ITEM ==========
const buscarItemInput = document.getElementById('buscarItemEmprestimo');
const selectedItemDisplay = document.getElementById('selectedItemDisplay');
const selectedItemDetails = document.getElementById('selectedItemDetails');
const submitEmprestimoBtn = document.getElementById('submitEmprestimoBtn');

function selectItemForLoan(item) {
  selectedItemForLoan = item;
  selectedItemDetails.innerHTML = `
    <strong>${item.marca} ${item.modelo}</strong><br>
    Patrimônio: ${item.patrimonio}<br>
    Disponível: ${item.quantidade} unidade(s)
  `;
  selectedItemDisplay.style.display = 'block';
  buscarItemInput.value = `${item.marca} ${item.modelo} - ${item.patrimonio}`;
  submitEmprestimoBtn.disabled = false;
}

if (buscarItemInput) {
  buscarItemInput.addEventListener('input', async (e) => {
    const query = e.target.value;
    if (!query) {
      document.getElementById('itemEmprestimoSuggestions').classList.remove('active');
      return;
    }
    const results = searchItemsByText(query);
    showItemSuggestions(results, 'itemEmprestimoSuggestions', selectItemForLoan);
  });
}

// Cadastrar Empréstimo
const cadastrarEmprestimoForm = document.getElementById('cadastrarEmprestimoForm');
if (cadastrarEmprestimoForm) {
  cadastrarEmprestimoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedItemForLoan) {
      showFeedback('cadastroEmprestimoFeedback', '⚠️ Selecione um item para empréstimo', 'error');
      return;
    }
    
    if (selectedItemForLoan.quantidade <= 0) {
      showFeedback('cadastroEmprestimoFeedback', '❌ Item indisponível no momento', 'error');
      return;
    }
    
    const novoEmprestimo = {
      itemId: selectedItemForLoan.id,
      itemNome: `${selectedItemForLoan.marca} ${selectedItemForLoan.modelo}`,
      itemPatrimonio: selectedItemForLoan.patrimonio,
      solicitante: document.getElementById('emprestimoSolicitante').value.trim(),
      email: document.getElementById('emprestimoEmail').value.trim(),
      dataRetirada: document.getElementById('emprestimoDataRetirada').value,
      dataDevolucaoPrevista: document.getElementById('emprestimoDataDevolucao').value,
      observacoes: document.getElementById('emprestimoObservacoes').value.trim()
    };
    
    if (!novoEmprestimo.solicitante || !novoEmprestimo.dataRetirada || !novoEmprestimo.dataDevolucaoPrevista) {
      showFeedback('cadastroEmprestimoFeedback', '⚠️ Preencha todos os campos obrigatórios', 'error');
      return;
    }
    
    try {
      await createLoan(novoEmprestimo);
      showFeedback('cadastroEmprestimoFeedback', '✓ Empréstimo registrado com sucesso!', 'success');
      cadastrarEmprestimoForm.reset();
      selectedItemForLoan = null;
      selectedItemDisplay.style.display = 'none';
      buscarItemInput.value = '';
      submitEmprestimoBtn.disabled = true;
      await fetchItems();
      loadActiveLoans();
    } catch (error) {
      showFeedback('cadastroEmprestimoFeedback', '❌ Erro ao registrar empréstimo', 'error');
    }
  });
}

// ========== EMPRÉSTIMOS ATIVOS ==========
async function loadActiveLoans() {
  const loans = await fetchActiveLoans();
  const tbody = document.getElementById('ativosTableBody');
  const searchInput = document.getElementById('searchAtivos');
  
  function renderLoans(loansToRender) {
    if (loansToRender.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum empréstimo ativo</td></tr>';
      return;
    }
    
    tbody.innerHTML = loansToRender.map(loan => `
      <tr>
        <td>${loan.id}</td>
        <td>${loan.itemNome || 'Item não especificado'}</td>
        <td>${loan.itemPatrimonio || '-'}</td>
        <td>${loan.solicitante}</td>
        <td>${new Date(loan.dataRetirada).toLocaleDateString('pt-BR')}</td>
        <td>${new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR')}</td>
        <td>
          <button class="btn-success" onclick="concluirEmprestimo(${loan.id})">
            ✓ Concluir
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  renderLoans(loans);
  
  if (searchInput) {
    searchInput.removeEventListener('input', searchInput._listener);
    searchInput._listener = () => {
      const query = searchInput.value.toLowerCase();
      const filtered = loans.filter(loan => 
        loan.solicitante.toLowerCase().includes(query) || 
        (loan.itemNome && loan.itemNome.toLowerCase().includes(query))
      );
      renderLoans(filtered);
    };
    searchInput.addEventListener('input', searchInput._listener);
  }
}

window.concluirEmprestimo = async function(id) {
  if (confirm('Confirmar devolução do item?')) {
    try {
      await concluirLoan(id);
      showFeedback('cadastroEmprestimoFeedback', '✓ Empréstimo concluído com sucesso!', 'success');
      loadActiveLoans();
      loadHistorico();
      await fetchItems();
    } catch (error) {
      showFeedback('cadastroEmprestimoFeedback', '❌ Erro ao concluir empréstimo', 'error');
    }
  }
};

// ========== HISTÓRICO ==========
async function loadHistorico() {
  const loans = await fetchLoans();
  const tbody = document.getElementById('historicoTableBody');
  const searchInput = document.getElementById('searchHistorico');
  
  const concludedLoans = loans.filter(loan => loan.status === 'concluido');
  
  function renderHistorico(loansToRender) {
    if (loansToRender.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum registro no histórico</td></tr>';
      return;
    }
    
    tbody.innerHTML = loansToRender.map(loan => `
      <tr>
        <td>${loan.id}</td>
        <td>${loan.itemNome || 'Item não especificado'}</td>
        <td>${loan.solicitante}</td>
        <td>${new Date(loan.dataRetirada).toLocaleDateString('pt-BR')}</td>
        <td>${new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR')}</td>
        <td><span class="status-concluido">Concluído</span></td>
        <td>${loan.dataDevolucaoReal ? new Date(loan.dataDevolucaoReal).toLocaleDateString('pt-BR') : '-'}</td>
      </tr>
    `).join('');
  }
  
  renderHistorico(concludedLoans);
  
  if (searchInput) {
    searchInput.removeEventListener('input', searchInput._listener);
    searchInput._listener = () => {
      const query = searchInput.value.toLowerCase();
      const filtered = concludedLoans.filter(loan => 
        loan.solicitante.toLowerCase().includes(query) || 
        (loan.itemNome && loan.itemNome.toLowerCase().includes(query))
      );
      renderHistorico(filtered);
    };
    searchInput.addEventListener('input', searchInput._listener);
  }
}

// ========== SOLICITAÇÕES PENDENTES ==========
async function loadSolicitacoes() {
  const solicitacoes = await fetchSolicitacoes();
  const pendentes = solicitacoes.filter(s => s.status === 'pendente');
  const tbody = document.getElementById('solicitacoesTableBody');
  
  if (pendentes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhuma solicitação pendente</td></tr>';
    return;
  }
  
  tbody.innerHTML = pendentes.map(sol => `
    <tr>
      <td>${sol.id}</td>
      <td>${sol.nome}</td>
      <td>${sol.itemNome}</td>
      <td>${sol.itemPatrimonio}</td>
      <td>${new Date(sol.dataRetirada).toLocaleDateString('pt-BR')}</td>
      <td>${new Date(sol.dataDevolucao).toLocaleDateString('pt-BR')}</td>
      <td>
        <button class="btn-success" onclick="aprovarSolicitacaoUI('${sol.id}')">
          ✓ Aprovar
        </button>
        <button class="btn-danger" onclick="rejeitarSolicitacaoUI('${sol.id}')">
          ✗ Rejeitar
        </button>
      </td>
    </tr>
  `).join('');
}

window.aprovarSolicitacaoUI = async function(id) {
  if (confirm('Aprovar esta solicitação? O item será reservado para o solicitante.')) {
    try {
      await aprovarSolicitacao(id);
      showFeedback('cadastroEmprestimoFeedback', '✓ Solicitação aprovada com sucesso!', 'success');
      loadSolicitacoes();
      loadActiveLoans();
      await fetchItems();
      loadGerenciarItems();
    } catch (error) {
      showFeedback('cadastroEmprestimoFeedback', error.error || '❌ Erro ao aprovar solicitação', 'error');
    }
  }
};

window.rejeitarSolicitacaoUI = async function(id) {
  const motivo = prompt('Informe o motivo da rejeição:');
  if (motivo !== null) {
    try {
      await rejeitarSolicitacao(id, motivo);
      showFeedback('cadastroEmprestimoFeedback', '✓ Solicitação rejeitada', 'info');
      loadSolicitacoes();
    } catch (error) {
      showFeedback('cadastroEmprestimoFeedback', '❌ Erro ao rejeitar solicitação', 'error');
    }
  }
};

// ========== GERENCIAR ITENS ==========
async function loadGerenciarItems() {
  const tbody = document.getElementById('gerenciarItemsTableBody');
  const searchInput = document.getElementById('searchGerenciar');
  
  function renderItems(itemsToRender) {
    if (itemsToRender.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum item cadastrado</td></tr>';
      return;
    }
    
    tbody.innerHTML = itemsToRender.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${item.marca || '-'}</td>
        <td>${item.modelo || '-'}</td>
        <td>${item.patrimonio || '-'}</td>
        <td>${item.serial || '-'}</td>
        <td>${item.quantidade}</td>
        <td>
          <button class="btn-danger" onclick="removerItem(${item.id})">
            🗑️ Remover
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  renderItems(items);
  
  if (searchInput) {
    searchInput.removeEventListener('input', searchInput._listener);
    searchInput._listener = () => {
      const query = searchInput.value.toLowerCase();
      const filtered = items.filter(item => 
        (item.marca && item.marca.toLowerCase().includes(query)) ||
        (item.modelo && item.modelo.toLowerCase().includes(query)) ||
        (item.patrimonio && item.patrimonio.toLowerCase().includes(query))
      );
      renderItems(filtered);
    };
    searchInput.addEventListener('input', searchInput._listener);
  }
}

async function loadMarcasList() {
  const marcasList = document.getElementById('marcasList');
  const uniqueMarcas = [...new Set(items.map(i => i.marca).filter(m => m))];
  
  if (uniqueMarcas.length === 0) {
    marcasList.innerHTML = '<p class="empty-message">Nenhuma marca cadastrada</p>';
    return;
  }
  
  marcasList.innerHTML = uniqueMarcas.map(marca => `
    <div class="tag-item">
      <span>${marca}</span>
      <button class="tag-remove" onclick="removerMarca('${marca}')">×</button>
    </div>
  `).join('');
}

async function loadModelosList() {
  const modelosList = document.getElementById('modelosList');
  const uniqueModelos = [...new Set(items.map(i => i.modelo).filter(m => m))];
  
  if (uniqueModelos.length === 0) {
    modelosList.innerHTML = '<p class="empty-message">Nenhum modelo cadastrado</p>';
    return;
  }
  
  modelosList.innerHTML = uniqueModelos.map(modelo => `
    <div class="tag-item">
      <span>${modelo}</span>
      <button class="tag-remove" onclick="removerModelo('${modelo}')">×</button>
    </div>
  `).join('');
}

window.removerItem = async function(id) {
  if (confirm('Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.')) {
    try {
      await deleteItem(id);
      showFeedback('cadastroItemFeedback', '✓ Item removido com sucesso!', 'success');
      await fetchItems();
      loadGerenciarItems();
      loadMarcasList();
      loadModelosList();
    } catch (error) {
      showFeedback('cadastroItemFeedback', '❌ Erro ao remover item', 'error');
    }
  }
};

window.removerMarca = async function(marca) {
  const itemsWithMarca = items.filter(i => i.marca === marca);
  if (itemsWithMarca.length > 0) {
    alert(`Não é possível remover a marca "${marca}" pois existem ${itemsWithMarca.length} item(ns) associado(s) a ela.`);
    return;
  }
  // Remover marca da lista (apenas visual, pois não há itens)
  showFeedback('cadastroItemFeedback', `Marca "${marca}" removida da lista`, 'info');
  loadMarcasList();
};

window.removerModelo = async function(modelo) {
  const itemsWithModelo = items.filter(i => i.modelo === modelo);
  if (itemsWithModelo.length > 0) {
    alert(`Não é possível remover o modelo "${modelo}" pois existem ${itemsWithModelo.length} item(ns) associado(s) a ele.`);
    return;
  }
  showFeedback('cadastroItemFeedback', `Modelo "${modelo}" removido da lista`, 'info');
  loadModelosList();
};

// ========== TABS ==========
const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    const tabId = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    panes.forEach(pane => pane.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'cadastrar-item') {
      await fetchItems();
    } else if (tabId === 'cadastrar-emprestimo') {
      await fetchItems();
      const hoje = new Date().toISOString().split('T')[0];
      document.getElementById('emprestimoDataRetirada').min = hoje;
      document.getElementById('emprestimoDataDevolucao').min = hoje;
    } else if (tabId === 'emprestimos-ativos') {
      loadActiveLoans();
    } else if (tabId === 'historico') {
      loadHistorico();
    } else if (tabId === 'solicitacoes') {
      loadSolicitacoes();
    } else if (tabId === 'gerenciar-itens') {
      await fetchItems();
      loadGerenciarItems();
      loadMarcasList();
      loadModelosList();
    }
  });
});

// ========== LOGOUT ==========
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair do sistema?')) {
      localStorage.removeItem('adminLoggedIn');
      localStorage.removeItem('adminUser');
      window.location.href = 'index.html';
    }
  });
}

// ========== CONFIGURAÇÕES INICIAIS ==========
async function init() {
  await fetchItems();
  loadActiveLoans();
  loadHistorico();
  loadSolicitacoes();
  loadGerenciarItems();
  loadMarcasList();
  loadModelosList();
  
  const hoje = new Date().toISOString().split('T')[0];
  const retiradaInput = document.getElementById('emprestimoDataRetirada');
  const devolucaoInput = document.getElementById('emprestimoDataDevolucao');
  if (retiradaInput) retiradaInput.min = hoje;
  if (devolucaoInput) devolucaoInput.min = hoje;
}

init();