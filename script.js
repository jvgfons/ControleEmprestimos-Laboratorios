// Configuração da API
const API_URL = 'http://localhost:3000/api';

// Elementos do modal de administrador
const modalOverlay = document.getElementById('modalOverlay');
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const adminForm = document.getElementById('adminLoginForm');

// Elementos do modal de empréstimo
const loanModalOverlay = document.getElementById('loanModalOverlay');
const openLoanModalBtn = document.getElementById('openLoanModal');
const closeLoanModalBtn = document.getElementById('closeLoanModal');
const loanForm = document.getElementById('loanRequestForm');

// Elementos do formulário de empréstimo
const itemSearch = document.getElementById('itemSearch');
const itemPatrimonio = document.getElementById('itemPatrimonio');
const itemSuggestions = document.getElementById('itemSuggestions');
const patrimonioSuggestions = document.getElementById('patrimonioSuggestions');
const selectedItemInfo = document.getElementById('selectedItemInfo');
const selectedItemName = document.getElementById('selectedItemName');
const selectedItemPatrimonio = document.getElementById('selectedItemPatrimonio');
const submitBtn = document.getElementById('submitLoanBtn');
const loanDate = document.getElementById('loanDate');
const returnDate = document.getElementById('returnDate');

let selectedItem = null;
let items = [];

// ========== FUNÇÕES DE API ==========
async function fetchItems() {
  try {
    const response = await fetch(`${API_URL}/items`);
    items = await response.json();
    return items;
  } catch (error) {
    console.error('Erro ao carregar itens:', error);
    return [];
  }
}

async function searchItemsByName(query) {
  try {
    const response = await fetch(`${API_URL}/items/search/nome/${encodeURIComponent(query)}`);
    return await response.json();
  } catch (error) {
    console.error('Erro na busca:', error);
    return [];
  }
}

async function searchItemsByPatrimonio(query) {
  try {
    const response = await fetch(`${API_URL}/items/search/patrimonio/${encodeURIComponent(query)}`);
    return await response.json();
  } catch (error) {
    console.error('Erro na busca:', error);
    return [];
  }
}

async function createSolicitacao(solicitacao) {
  try {
    const response = await fetch(`${API_URL}/solicitacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitacao)
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    throw error;
  }
}

async function loginAdmin(username, password) {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await response.json();
  } catch (error) {
    console.error('Erro no login:', error);
    throw error;
  }
}

// Mostrar sugestões de nome
function showNameSuggestions(suggestions) {
  if (suggestions.length === 0) {
    itemSuggestions.classList.remove('active');
    return;
  }
  
  itemSuggestions.innerHTML = suggestions.map(item => `
    <div class="suggestion-item" data-id="${item.id}" data-nome="${item.nome}" data-patrimonio="${item.patrimonio}">
      <strong>${item.nome}</strong>
      <small>Patrimônio: ${item.patrimonio} | Disponível: ${item.quantidade}</small>
    </div>
  `).join('');
  
  itemSuggestions.classList.add('active');
  
  document.querySelectorAll('#itemSuggestions .suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id);
      const item = items.find(i => i.id === id);
      if (item) {
        selectItem(item);
      }
      itemSuggestions.classList.remove('active');
    });
  });
}

// Mostrar sugestões de patrimônio
function showPatrimonioSuggestions(suggestions) {
  if (suggestions.length === 0) {
    patrimonioSuggestions.classList.remove('active');
    return;
  }
  
  patrimonioSuggestions.innerHTML = suggestions.map(item => `
    <div class="suggestion-item" data-id="${item.id}" data-nome="${item.nome}" data-patrimonio="${item.patrimonio}">
      <strong>${item.patrimonio}</strong>
      <small>${item.nome} | Disponível: ${item.quantidade}</small>
    </div>
  `).join('');
  
  patrimonioSuggestions.classList.add('active');
  
  document.querySelectorAll('#patrimonioSuggestions .suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id);
      const item = items.find(i => i.id === id);
      if (item) {
        selectItem(item);
      }
      patrimonioSuggestions.classList.remove('active');
    });
  });
}

// Selecionar item
function selectItem(item) {
  selectedItem = item;
  itemSearch.value = item.nome;
  itemPatrimonio.value = item.patrimonio;
  
  selectedItemName.textContent = item.nome;
  selectedItemPatrimonio.textContent = item.patrimonio;
  selectedItemInfo.style.display = 'block';
  
  submitBtn.disabled = false;
  
  itemSuggestions.classList.remove('active');
  patrimonioSuggestions.classList.remove('active');
}

// Evento de busca por nome
itemSearch.addEventListener('input', async (e) => {
  const query = e.target.value;
  if (!query) {
    itemSuggestions.classList.remove('active');
    return;
  }
  
  const results = await searchItemsByName(query);
  showNameSuggestions(results);
});

// Evento de busca por patrimônio
itemPatrimonio.addEventListener('input', async (e) => {
  const query = e.target.value;
  if (!query) {
    patrimonioSuggestions.classList.remove('active');
    return;
  }
  
  const results = await searchItemsByPatrimonio(query);
  showPatrimonioSuggestions(results);
});

// Fechar sugestões ao clicar fora
document.addEventListener('click', (e) => {
  if (!itemSearch.contains(e.target) && !itemSuggestions.contains(e.target)) {
    itemSuggestions.classList.remove('active');
  }
  if (!itemPatrimonio.contains(e.target) && !patrimonioSuggestions.contains(e.target)) {
    patrimonioSuggestions.classList.remove('active');
  }
});

// Configurar data mínima
function setMinDates() {
  const today = new Date().toISOString().split('T')[0];
  loanDate.min = today;
  
  loanDate.addEventListener('change', () => {
    if (loanDate.value) {
      returnDate.min = loanDate.value;
      if (returnDate.value && returnDate.value < loanDate.value) {
        returnDate.value = loanDate.value;
      }
    }
  });
}

// ========== FUNÇÕES DO MODAL ==========
function openAdminModal() {
  modalOverlay.classList.add('active');
  document.getElementById('usuario').value = '';
  document.getElementById('senha').value = '';
  const feedback = document.getElementById('adminFeedback');
  feedback.style.display = 'none';
  feedback.innerHTML = '';
  feedback.className = 'feedback-message';
}

function closeAdminModal() {
  modalOverlay.classList.remove('active');
}

function openLoanModal() {
  loanModalOverlay.classList.add('active');
  loanForm.reset();
  
  const today = new Date().toISOString().split('T')[0];
  loanDate.min = today;
  loanDate.value = today;
  returnDate.min = today;
  
  selectedItem = null;
  selectedItemInfo.style.display = 'none';
  submitBtn.disabled = true;
  
  const feedback = document.getElementById('loanFeedback');
  feedback.style.display = 'none';
  feedback.innerHTML = '';
  feedback.className = 'feedback-message';
}

function closeLoanModal() {
  loanModalOverlay.classList.remove('active');
}

// Processar solicitação de empréstimo
loanForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!selectedItem) {
    const feedback = document.getElementById('loanFeedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = '⚠️ Por favor, selecione um item da lista.';
    return;
  }
  
  const name = document.getElementById('requesterName').value.trim();
  const email = document.getElementById('requesterEmail').value.trim();
  const retirada = loanDate.value;
  const devolucao = returnDate.value;
  
  if (!name) {
    const feedback = document.getElementById('loanFeedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = '⚠️ Por favor, informe seu nome completo.';
    return;
  }
  
  if (!retirada || !devolucao) {
    const feedback = document.getElementById('loanFeedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = '⚠️ Por favor, informe as datas de retirada e devolução.';
    return;
  }
  
  const submitBtn = loanForm.querySelector('.modal-login-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';
  
  try {
    const novaSolicitacao = {
      nome: name,
      email: email,
      itemId: selectedItem.id,
      itemNome: selectedItem.nome,
      itemPatrimonio: selectedItem.patrimonio,
      dataRetirada: retirada,
      dataDevolucao: devolucao
    };
    
    const result = await createSolicitacao(novaSolicitacao);
    
    const feedback = document.getElementById('loanFeedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback-message success';
    feedback.innerHTML = `
      ✓ Solicitação registrada com sucesso!<br><br>
      <strong>Protocolo:</strong> ${result.id}<br>
      <strong>Solicitante:</strong> ${name}<br>
      <strong>Item:</strong> ${selectedItem.nome}<br>
      <strong>Patrimônio:</strong> ${selectedItem.patrimonio}<br>
      <strong>Retirada:</strong> ${new Date(retirada).toLocaleDateString('pt-BR')}<br>
      <strong>Devolução:</strong> ${new Date(devolucao).toLocaleDateString('pt-BR')}<br><br>
      Aguarde a aprovação do administrador.
    `;
    
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar solicitação';
    }, 2000);
    
    setTimeout(() => {
      if (confirm('Deseja fazer outra solicitação?')) {
        closeLoanModal();
        setTimeout(() => openLoanModal(), 100);
      } else {
        closeLoanModal();
      }
    }, 4000);
  } catch (error) {
    const feedback = document.getElementById('loanFeedback');
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = '❌ Erro ao enviar solicitação. Tente novamente.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar solicitação';
  }
});

// ========== EVENTOS ==========
openModalBtn.addEventListener('click', openAdminModal);
closeModalBtn.addEventListener('click', closeAdminModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeAdminModal();
});

openLoanModalBtn.addEventListener('click', openLoanModal);
closeLoanModalBtn.addEventListener('click', closeLoanModal);

loanModalOverlay.addEventListener('click', (e) => {
  if (e.target === loanModalOverlay) closeLoanModal();
});

// Processar login
adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const usuario = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value;
  const feedback = document.getElementById('adminFeedback');
  
  if (!usuario || !senha) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = '⚠️ Preencha usuário e senha.';
    return;
  }
  
  try {
    const result = await loginAdmin(usuario, senha);
    
    if (result.success) {
      feedback.style.display = 'block';
      feedback.className = 'feedback-message success';
      feedback.innerHTML = '✓ Login bem-sucedido! Redirecionando...';
      
      const submitBtn = adminForm.querySelector('.modal-login-btn');
      submitBtn.disabled = true;
      
      localStorage.setItem('adminLoggedIn', 'true');
      localStorage.setItem('adminUser', JSON.stringify(result.user));
      
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 1000);
    } else {
      feedback.style.display = 'block';
      feedback.className = 'feedback-message error';
      feedback.innerHTML = '❌ Usuário ou senha inválidos.<br><small>Credenciais: admin / unesp2025</small>';
    }
  } catch (error) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = '❌ Erro ao conectar com o servidor. Verifique se o servidor está rodando.';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('active')) closeAdminModal();
    if (loanModalOverlay.classList.contains('active')) closeLoanModal();
  }
});

// Inicializar
fetchItems();
setMinDates();