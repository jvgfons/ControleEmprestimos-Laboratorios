const API_URL = 'http://localhost:3000/api';

const modalOverlay = document.getElementById('modalOverlay');
const openModalBtn = document.getElementById('openModal');
const openTrackModalBtn = document.getElementById('openTrackModal');
const closeModalBtn = document.getElementById('closeModal');
const adminForm = document.getElementById('adminLoginForm');

const loanModalOverlay = document.getElementById('loanModalOverlay');
const openLoanModalBtn = document.getElementById('openLoanModal');
const closeLoanModalBtn = document.getElementById('closeLoanModal');
const loanForm = document.getElementById('loanRequestForm');
const requestItemsContainer = document.getElementById('requestItemsContainer');
const addRequestItemBtn = document.getElementById('addRequestItemBtn');

const siteModalOverlay = document.getElementById('siteModalOverlay');
const siteModalTitle = document.getElementById('siteModalTitle');
const siteModalBody = document.getElementById('siteModalBody');
const siteModalFooter = document.getElementById('siteModalFooter');
const siteModalClose = document.getElementById('siteModalClose');

const loanDate = document.getElementById('loanDate');
const returnDate = document.getElementById('returnDate');

let items = [];
let requestLines = [];
let lineSequence = 0;
let siteModalResolver = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function parseJsonResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Erro na requisição');
  }
  return data;
}

async function fetchItems() {
  const response = await fetch(`${API_URL}/items`);
  items = await parseJsonResponse(response);
  return items;
}

async function createSolicitacao(payload) {
  const response = await fetch(`${API_URL}/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

async function fetchSolicitacoesByEmail(email) {
  const response = await fetch(`${API_URL}/solicitacoes/email/${encodeURIComponent(email)}`);
  return parseJsonResponse(response);
}

async function loginAdmin(username, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return parseJsonResponse(response);
}

function openSiteModal({ title, bodyHtml, footerHtml, footerClass = '', onOpen }) {
  siteModalTitle.textContent = title;
  siteModalBody.innerHTML = bodyHtml;
  siteModalFooter.innerHTML = footerHtml;
  siteModalFooter.className = `modal-actions${footerClass ? ` ${footerClass}` : ''}`;
  siteModalOverlay.classList.add('active');
  if (onOpen) {
    onOpen();
  }
}

function closeSiteModal(result = null) {
  siteModalOverlay.classList.remove('active');
  siteModalBody.innerHTML = '';
  siteModalFooter.innerHTML = '';
  siteModalFooter.className = 'modal-actions';
  if (siteModalResolver) {
    const resolver = siteModalResolver;
    siteModalResolver = null;
    resolver(result);
  }
}

function showInfoModal({ title, bodyHtml, buttonText = 'Voltar ao menu', onAfterClose }) {
  return new Promise((resolve) => {
    siteModalResolver = (result) => {
      resolve(result);
      if (onAfterClose) {
        onAfterClose(result);
      }
    };

    openSiteModal({
      title,
      bodyHtml,
      footerHtml: `<button type="button" class="modal-login-btn" id="siteModalConfirmBtn">${escapeHtml(buttonText)}</button>`,
      onOpen: () => {
        document.getElementById('siteModalConfirmBtn').addEventListener('click', () => closeSiteModal(true));
      },
    });
  });
}

function getStatusLabel(status) {
  const labels = {
    pendente: 'Pendente',
    aprovado: 'Aprovada',
    rejeitado: 'Rejeitada',
  };
  return labels[status] || status;
}

function buildTrackResultsHtml(solicitacoes) {
  if (!solicitacoes.length) {
    return '<p class="modal-text">Nenhuma solicitação foi encontrada para este e-mail.</p>';
  }

  return `
    <div class="track-results">
      ${solicitacoes
        .map(
          (solicitacao) => `
            <div class="track-card">
              <div class="track-card-header">
                <h3>${escapeHtml(solicitacao.id)}</h3>
                <span class="track-badge ${escapeHtml(solicitacao.status)}">${escapeHtml(getStatusLabel(solicitacao.status))}</span>
              </div>
              <div class="track-meta">
                <div><strong>Solicitante:</strong> ${escapeHtml(solicitacao.nome || '-')}</div>
                <div><strong>Data da solicitação:</strong> ${new Date(solicitacao.dataSolicitacao).toLocaleDateString('pt-BR')}</div>
                <div><strong>Retirada:</strong> ${new Date(solicitacao.dataRetirada).toLocaleDateString('pt-BR')}</div>
                <div><strong>Devolução:</strong> ${new Date(solicitacao.dataDevolucao).toLocaleDateString('pt-BR')}</div>
                <div><strong>Itens:</strong> ${solicitacao.itens.map((item) => `${item.itemNome} x${item.quantidade}`).join(', ')}</div>
                ${
                  solicitacao.motivoRejeicao
                    ? `<div><strong>Motivo da rejeição:</strong> ${escapeHtml(solicitacao.motivoRejeicao)}</div>`
                    : ''
                }
              </div>
              ${
                solicitacao.loans && solicitacao.loans.length > 0
                  ? `
                    <div class="track-loans">
                      ${solicitacao.loans
                        .map(
                          (loan) => `
                            <div class="track-loan-item">
                              <div><strong>Empréstimo:</strong> ${escapeHtml(loan.loanGroupId || String(loan.id))}</div>
                              <div><strong>Item:</strong> ${escapeHtml(loan.itemNome || '-')}</div>
                              <div><strong>Patrimônio:</strong> ${escapeHtml(loan.itemPatrimonio || '-')}</div>
                              <div><strong>Status:</strong> ${escapeHtml(loan.status || '-')}</div>
                              <div><strong>Retirada:</strong> ${loan.dataRetirada ? new Date(loan.dataRetirada).toLocaleDateString('pt-BR') : '-'}</div>
                              <div><strong>Devolução prevista:</strong> ${loan.dataDevolucaoPrevista ? new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR') : '-'}</div>
                            </div>
                          `
                        )
                        .join('')}
                    </div>
                  `
                  : ''
              }
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function openTrackModal() {
  openSiteModal({
    title: 'Acompanhar Solicitação',
    bodyHtml: `
      <div class="modal-form-grid">
        <label class="modal-form-field">
          <span>E-mail institucional</span>
          <input type="email" id="trackEmailInput" placeholder="maria.souza@unesp.br">
        </label>
        <div id="trackResultsArea"></div>
      </div>
    `,
    footerHtml: `
      <button type="button" class="modal-login-btn" id="trackSearchBtn">Buscar solicitações</button>
    `,
    onOpen: () => {
      const searchButton = document.getElementById('trackSearchBtn');
      const emailInput = document.getElementById('trackEmailInput');
      const resultsArea = document.getElementById('trackResultsArea');

      searchButton.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
          resultsArea.innerHTML = '<div class="feedback-message error">Informe o e-mail para consultar as solicitações.</div>';
          return;
        }

        searchButton.disabled = true;
        searchButton.textContent = 'Buscando...';

        try {
          const solicitacoes = await fetchSolicitacoesByEmail(email);
          resultsArea.innerHTML = buildTrackResultsHtml(solicitacoes);
        } catch (error) {
          resultsArea.innerHTML = `<div class="feedback-message error">${escapeHtml(error.message || 'Erro ao consultar solicitações.')}</div>`;
        } finally {
          searchButton.disabled = false;
          searchButton.textContent = 'Buscar solicitações';
        }
      });
    },
  });
}

function itemSubtitle(item) {
  return `${item.marca || 'Sem marca'} | ${item.modelo || 'Sem modelo'} | ${item.disponiveis} disponível(eis)`;
}

function createLineId() {
  lineSequence += 1;
  return `request-line-${lineSequence}`;
}

function getItemById(itemId) {
  return items.find((item) => Number(item.id) === Number(itemId)) || null;
}

function searchItems(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return items.filter((item) => {
    const searchable = [item.titulo, item.marca, item.modelo]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalized) && item.disponiveis > 0;
  });
}

function createRequestLine() {
  return {
    id: createLineId(),
    query: '',
    itemId: null,
    quantity: 1,
  };
}

function ensureRequestLines() {
  if (!requestLines.length) {
    requestLines = [createRequestLine()];
  }
}

function renderRequestLines() {
  ensureRequestLines();

  requestItemsContainer.innerHTML = requestLines
    .map((line, index) => {
      const item = getItemById(line.itemId);
      const suggestions = !item && line.query ? searchItems(line.query) : [];
      const maxQuantity = item ? Math.max(1, item.disponiveis) : 1;
      const quantityOptions = Array.from({ length: maxQuantity }, (_, optionIndex) => optionIndex + 1)
        .map(
          (option) => `<option value="${option}" ${option === Number(line.quantity) ? 'selected' : ''}>${option}</option>`
        )
        .join('');

      return `
        <div class="item-line-card" data-line-id="${line.id}">
          <div class="item-line-header">
            <div>
              <h3>Item ${index + 1}</h3>
              <p>Escolha o título do item e a quantidade desejada.</p>
            </div>
            <div class="item-line-tools">
              <label class="inline-field">
                <span>Quantidade</span>
                <select data-action="set-quantity">${quantityOptions}</select>
              </label>
              ${
                requestLines.length > 1
                  ? '<button type="button" class="ghost-icon-btn danger" data-action="remove-line">×</button>'
                  : ''
              }
            </div>
          </div>

          <div class="form-group">
            <label>Título do item *</label>
            <input type="text" class="line-search-input" value="${escapeHtml(item ? item.titulo : line.query)}" placeholder="Digite o título, a marca ou o modelo..." autocomplete="off">
            <div class="suggestions-list ${suggestions.length ? 'active' : ''}">
              ${suggestions
                .map(
                  (suggestion) => `
                    <div class="suggestion-item" data-action="select-item" data-item-id="${suggestion.id}">
                      <strong>${escapeHtml(suggestion.titulo)}</strong>
                      <small>${escapeHtml(itemSubtitle(suggestion))}</small>
                    </div>
                  `
                )
                .join('')}
            </div>
          </div>

          ${
            item
              ? `
                <div class="selected-item-info compact">
                  <strong>${escapeHtml(item.titulo)}</strong>
                  <div>${escapeHtml(itemSubtitle(item))}</div>
                </div>
              `
              : ''
          }
        </div>
      `;
    })
    .join('');
}

function setMinDates() {
  const today = new Date().toISOString().split('T')[0];
  loanDate.min = today;

  loanDate.addEventListener('change', () => {
    if (!loanDate.value) {
      return;
    }
    returnDate.min = loanDate.value;
    if (returnDate.value && returnDate.value < loanDate.value) {
      returnDate.value = loanDate.value;
    }
  });
}

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
  requestLines = [createRequestLine()];
  renderRequestLines();
  const feedback = document.getElementById('loanFeedback');
  feedback.style.display = 'none';
  feedback.innerHTML = '';
  feedback.className = 'feedback-message';
}

function closeLoanModal() {
  loanModalOverlay.classList.remove('active');
}

function collectRequestItems() {
  return requestLines.map((line) => {
    const item = getItemById(line.itemId);
    if (!item) {
      throw new Error('Selecione todos os itens da solicitação.');
    }
    return {
      id: line.id,
      itemId: item.id,
      itemNome: item.titulo,
      quantidade: line.quantity,
    };
  });
}

loanForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const feedback = document.getElementById('loanFeedback');
  let requestItems = [];

  try {
    requestItems = collectRequestItems();
  } catch (error) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = escapeHtml(error.message);
    return;
  }

  const name = document.getElementById('requesterName').value.trim();
  const email = document.getElementById('requesterEmail').value.trim();
  const retirada = loanDate.value;
  const devolucao = returnDate.value;

  if (!name || !email || !retirada || !devolucao) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = 'Preencha nome, e-mail e datas obrigatórias.';
    return;
  }

  const submitButton = loanForm.querySelector('.modal-login-btn');
  submitButton.disabled = true;
  submitButton.textContent = 'Enviando...';

  try {
    const result = await createSolicitacao({
      nome: name,
      email,
      items: requestItems,
      dataRetirada: retirada,
      dataDevolucao: devolucao,
    });

    await fetchItems();
    closeLoanModal();

    await showInfoModal({
      title: 'Solicitação registrada',
      bodyHtml: `
        <div class="request-summary">
          <p><strong>Protocolo:</strong> ${escapeHtml(result.id)}</p>
          <p><strong>Solicitante:</strong> ${escapeHtml(name)}</p>
          <p><strong>Itens:</strong></p>
          <ul class="summary-list">
            ${requestItems.map((item) => `<li>${escapeHtml(item.itemNome)} x${item.quantidade}</li>`).join('')}
          </ul>
          <p><strong>Retirada:</strong> ${new Date(retirada).toLocaleDateString('pt-BR')}</p>
          <p><strong>Devolução:</strong> ${new Date(devolucao).toLocaleDateString('pt-BR')}</p>
          <p>O patrimônio será definido pelo administrador na aprovação.</p>
        </div>
      `,
    });

    submitButton.disabled = false;
    submitButton.textContent = 'Enviar solicitação';
  } catch (error) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = escapeHtml(error.message || 'Erro ao enviar solicitação.');
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar solicitação';
  }
});

requestItemsContainer.addEventListener('click', (event) => {
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) {
    return;
  }

  const line = requestLines.find((entry) => entry.id === actionElement.closest('.item-line-card')?.dataset.lineId);
  if (!line) {
    return;
  }

  if (actionElement.dataset.action === 'add-line') {
    requestLines.push(createRequestLine());
    renderRequestLines();
  }

  if (actionElement.dataset.action === 'remove-line') {
    requestLines = requestLines.filter((entry) => entry.id !== line.id);
    renderRequestLines();
  }

  if (actionElement.dataset.action === 'select-item') {
    const item = getItemById(Number(actionElement.dataset.itemId));
    if (!item) {
      return;
    }
    line.itemId = item.id;
    line.query = item.titulo;
    line.quantity = 1;
    renderRequestLines();
  }
});

requestItemsContainer.addEventListener('input', (event) => {
  const line = requestLines.find((entry) => entry.id === event.target.closest('.item-line-card')?.dataset.lineId);
  if (!line || !event.target.classList.contains('line-search-input')) {
    return;
  }

  const cursorPosition = event.target.selectionStart;
  line.query = event.target.value;
  line.itemId = null;
  line.quantity = 1;
  renderRequestLines();

  const nextInput = requestItemsContainer.querySelector(`[data-line-id="${line.id}"] .line-search-input`);
  if (nextInput) {
    nextInput.focus();
    nextInput.setSelectionRange(cursorPosition, cursorPosition);
  }
});

requestItemsContainer.addEventListener('change', (event) => {
  const line = requestLines.find((entry) => entry.id === event.target.closest('.item-line-card')?.dataset.lineId);
  if (!line || event.target.dataset.action !== 'set-quantity') {
    return;
  }
  line.quantity = Math.max(1, Number(event.target.value) || 1);
});

openModalBtn.addEventListener('click', openAdminModal);
openTrackModalBtn.addEventListener('click', openTrackModal);
closeModalBtn.addEventListener('click', closeAdminModal);
openLoanModalBtn.addEventListener('click', openLoanModal);
closeLoanModalBtn.addEventListener('click', closeLoanModal);
addRequestItemBtn.addEventListener('click', () => {
  requestLines.push(createRequestLine());
  renderRequestLines();
});

modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    closeAdminModal();
  }
});

loanModalOverlay.addEventListener('click', (event) => {
  if (event.target === loanModalOverlay) {
    closeLoanModal();
  }
});

siteModalOverlay.addEventListener('click', (event) => {
  if (event.target === siteModalOverlay) {
    closeSiteModal(null);
  }
});

siteModalClose.addEventListener('click', () => closeSiteModal(null));

adminForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const usuario = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value;
  const feedback = document.getElementById('adminFeedback');

  if (!usuario || !senha) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = 'Preencha usuário e senha.';
    return;
  }

  try {
    const result = await loginAdmin(usuario, senha);
    feedback.style.display = 'block';
    feedback.className = 'feedback-message success';
    feedback.innerHTML = 'Login bem-sucedido. Redirecionando...';
    localStorage.setItem('adminLoggedIn', 'true');
    localStorage.setItem('adminUser', JSON.stringify(result.user));
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 1000);
  } catch (error) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = escapeHtml(error.message || 'Erro ao conectar com o servidor.');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (modalOverlay.classList.contains('active')) {
      closeAdminModal();
    }
    if (loanModalOverlay.classList.contains('active')) {
      closeLoanModal();
    }
    if (siteModalOverlay.classList.contains('active')) {
      closeSiteModal(null);
    }
  }
});

fetchItems();
requestLines = [createRequestLine()];
renderRequestLines();
setMinDates();
