const API_URL = 'http://localhost:3000/api';

const modalOverlay = document.getElementById('modalOverlay');
const openModalBtn = document.getElementById('openModal');
const openTrackModalBtn = document.getElementById('openTrackModal');
const openNewAdminBtn = document.getElementById('openNewAdminBtn');
const closeModalBtn = document.getElementById('closeModal');
const adminForm = document.getElementById('adminLoginForm');

const loanModalOverlay = document.getElementById('loanModalOverlay');
const openLoanModalBtn = document.getElementById('openLoanModal');
const closeLoanModalBtn = document.getElementById('closeLoanModal');
const loanForm = document.getElementById('loanRequestForm');
const requestLocationSelect = document.getElementById('requestLocation');
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
let metadataOptions = {
  localizacao: [],
};
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
    const error = new Error(data.error || data.message || 'Erro na requisição');
    error.details = data;
    throw error;
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

async function fetchMetadata() {
  const response = await fetch(`${API_URL}/metadata`);
  metadataOptions = await parseJsonResponse(response);
  return metadataOptions;
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

async function fetchAdminEligibility(email) {
  const response = await fetch(`${API_URL}/admin-users/eligibility/${encodeURIComponent(email)}`);
  return parseJsonResponse(response);
}

async function activateAdminAccount(payload) {
  const response = await fetch(`${API_URL}/admin-users/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

async function resetAdminPassword(payload) {
  const response = await fetch(`${API_URL}/admin-users/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

function validateAdminPassword(password, confirmPassword) {
  if (password !== confirmPassword) {
    return 'A confirmação da senha não confere.';
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
    return 'A senha deve ter pelo menos 8 caracteres, com letras maiúsculas, minúsculas e caractere especial.';
  }

  return '';
}

function openAdminPasswordResetModal(user) {
  openSiteModal({
    title: 'Redefinir senha do administrador',
    bodyHtml: `
      <div class="modal-form-grid">
        <label class="modal-form-field">
          <span>E-mail institucional</span>
          <input type="email" id="adminResetEmail" class="readonly-field" value="${escapeHtml(user.email || '')}" readonly>
        </label>
        <p class="modal-text">O administrador master liberou a redefinição da sua senha. Cadastre uma nova senha para continuar.</p>
        <label class="modal-form-field">
          <span>Nova senha</span>
          <input type="password" id="adminResetPassword" placeholder="Crie uma nova senha">
        </label>
        <label class="modal-form-field">
          <span>Confirmar senha</span>
          <input type="password" id="adminResetPasswordConfirm" placeholder="Repita a nova senha">
        </label>
        <p class="password-rule-hint">Use no mínimo 8 caracteres, com letras maiúsculas, minúsculas e caractere especial.</p>
        <div id="adminResetFeedback"></div>
      </div>
    `,
    footerHtml: `
      <button type="button" class="modal-login-btn" id="adminResetSubmitBtn">Salvar nova senha</button>
    `,
    onOpen: () => {
      const submitButton = document.getElementById('adminResetSubmitBtn');
      const feedback = document.getElementById('adminResetFeedback');
      const passwordInput = document.getElementById('adminResetPassword');
      const confirmInput = document.getElementById('adminResetPasswordConfirm');

      submitButton.addEventListener('click', async () => {
        const validationMessage = validateAdminPassword(passwordInput.value, confirmInput.value);
        if (validationMessage) {
          feedback.innerHTML = `<div class="feedback-message error">${escapeHtml(validationMessage)}</div>`;
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        try {
          await resetAdminPassword({
            email: user.email,
            password: passwordInput.value,
            confirmPassword: confirmInput.value,
          });

          closeSiteModal(true);
          await showInfoModal({
            title: 'Senha atualizada',
            bodyHtml: '<p class="modal-text">Senha cadastrada com sucesso. Agora você já pode entrar no painel administrativo pelo login.</p>',
            buttonText: 'Voltar ao login',
          });
          openAdminModal();
          document.getElementById('usuario').value = user.email || '';
          document.getElementById('senha').focus();
        } catch (error) {
          feedback.innerHTML = `<div class="feedback-message error">${escapeHtml(error.message || 'Erro ao atualizar a senha.')}</div>`;
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Salvar nova senha';
        }
      });
    },
  });
}

async function openAdminActivationModal(user) {
  openSiteModal({
    title: 'Concluir cadastro de administrador',
    bodyHtml: `
      <div class="modal-form-grid">
        <label class="modal-form-field">
          <span>E-mail institucional</span>
          <input type="email" id="adminActivationEmail" class="readonly-field" value="${escapeHtml(user.email || '')}" readonly>
        </label>
        <label class="modal-form-field">
          <span>Nome completo</span>
          <input type="text" id="adminActivationName" placeholder="Ex: Maria Fernanda Souza">
        </label>
        <div class="selected-item-info compact">
          <strong>Localizações responsáveis</strong>
          <div>${escapeHtml((user.localizacoes || []).join(', ') || user.localizacao || 'Nenhuma localização vinculada')}</div>
        </div>
        <label class="modal-form-field">
          <span>Senha</span>
          <input type="password" id="adminActivationPassword" placeholder="Crie uma senha">
        </label>
        <label class="modal-form-field">
          <span>Confirmar senha</span>
          <input type="password" id="adminActivationPasswordConfirm" placeholder="Repita a senha">
        </label>
        <p class="password-rule-hint">Use no mínimo 8 caracteres, com letras maiúsculas, minúsculas e caractere especial.</p>
        <div id="adminActivationFeedback"></div>
      </div>
    `,
    footerHtml: `
      <button type="button" class="modal-login-btn" id="adminActivationSubmitBtn">Confirmar cadastro</button>
    `,
    onOpen: () => {
      const submitButton = document.getElementById('adminActivationSubmitBtn');
      const feedback = document.getElementById('adminActivationFeedback');

      submitButton.addEventListener('click', async () => {
        const payload = {
          email: user.email,
          nome: document.getElementById('adminActivationName').value.trim(),
          password: document.getElementById('adminActivationPassword').value,
          confirmPassword: document.getElementById('adminActivationPasswordConfirm').value,
        };

        const validationMessage = validateAdminPassword(payload.password, payload.confirmPassword);
        if (validationMessage) {
          feedback.innerHTML = `<div class="feedback-message error">${escapeHtml(validationMessage)}</div>`;
          return;
        }

        if (!payload.nome) {
          feedback.innerHTML = '<div class="feedback-message error">Preencha o nome e a senha para concluir o cadastro.</div>';
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Confirmando...';

        try {
          await activateAdminAccount(payload);
          closeSiteModal(true);
          await showInfoModal({
            title: 'Cadastro concluído',
            bodyHtml: '<p class="modal-text">Administrador cadastrado com sucesso. Faça login com o e-mail institucional e a nova senha.</p>',
            buttonText: 'Voltar ao login',
          });
          openAdminModal();
          document.getElementById('usuario').value = user.email || '';
          document.getElementById('senha').focus();
        } catch (error) {
          feedback.innerHTML = `<div class="feedback-message error">${escapeHtml(error.message || 'Erro ao concluir o cadastro.')}</div>`;
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Confirmar cadastro';
        }
      });
    },
  });
}

function openNewAdminModal(prefilledEmail = '') {
  openSiteModal({
    title: 'Novo Administrador',
    bodyHtml: `
      <div class="modal-form-grid">
        <p class="modal-text">Informe o e-mail institucional autorizado por um administrador master para concluir o primeiro acesso.</p>
        <label class="modal-form-field">
          <span>E-mail institucional</span>
          <input type="email" id="newAdminEmailInput" placeholder="nome.sobrenome@unesp.br" value="${escapeHtml(prefilledEmail)}">
        </label>
        <div id="newAdminFeedback"></div>
      </div>
    `,
    footerHtml: `
      <button type="button" class="modal-login-btn" id="newAdminContinueBtn">Continuar</button>
    `,
    onOpen: () => {
      const emailInput = document.getElementById('newAdminEmailInput');
      const continueButton = document.getElementById('newAdminContinueBtn');
      const feedback = document.getElementById('newAdminFeedback');

      continueButton.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
          feedback.innerHTML = '<div class="feedback-message error">Informe o e-mail institucional para continuar.</div>';
          return;
        }

        continueButton.disabled = true;
        continueButton.textContent = 'Verificando...';

        try {
          const result = await fetchAdminEligibility(email);
          if (result.mode === 'reset') {
            openAdminPasswordResetModal(result.user || { email });
            return;
          }
          await openAdminActivationModal(result.user || { email });
        } catch (error) {
          feedback.innerHTML = `<div class="feedback-message error">${escapeHtml(error.message || 'Não foi possível validar o e-mail informado.')}</div>`;
        } finally {
          continueButton.disabled = false;
          continueButton.textContent = 'Continuar';
        }
      });
    },
  });
}

function itemSubtitle(item) {
  return `${item.marca || 'Sem marca'} | ${item.modelo || 'Sem modelo'} | ${item.disponiveis} disponível(eis)`;
}

function populateRequestLocationOptions() {
  if (!requestLocationSelect) {
    return;
  }

  const currentValue = requestLocationSelect.value;
  const locations = [...new Set((metadataOptions.localizacao || []).map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  requestLocationSelect.innerHTML = `
    <option value="">Selecione o laboratório...</option>
    ${locations
      .map(
        (location) => `<option value="${escapeHtml(location)}" ${location === currentValue ? 'selected' : ''}>${escapeHtml(location)}</option>`
      )
      .join('')}
  `;
}

function getSelectedRequestLocation() {
  return String(requestLocationSelect?.value || '').trim();
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
  const selectedLocation = getSelectedRequestLocation();
  if (!normalized) {
    return [];
  }

  if (!selectedLocation) {
    return [];
  }

  return items.filter((item) => {
    const searchable = [item.titulo, item.marca, item.modelo]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalized) && item.disponiveis > 0 && String(item.localizacao || '').trim() === selectedLocation;
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
              <p>${getSelectedRequestLocation() ? 'Escolha o título do item e a quantidade desejada.' : 'Selecione primeiro o laboratório para buscar os itens disponíveis.'}</p>
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
            <input type="text" class="line-search-input" value="${escapeHtml(item ? item.titulo : line.query)}" placeholder="${escapeHtml(
              getSelectedRequestLocation() ? 'Digite o título, a marca ou o modelo...' : 'Selecione o laboratório antes de pesquisar'
            )}" autocomplete="off" ${getSelectedRequestLocation() ? '' : 'disabled'}>
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
  populateRequestLocationOptions();
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
  const localizacao = getSelectedRequestLocation();
  const retirada = loanDate.value;
  const devolucao = returnDate.value;

  if (!name || !email || !localizacao || !retirada || !devolucao) {
    feedback.style.display = 'block';
    feedback.className = 'feedback-message error';
    feedback.innerHTML = 'Preencha nome, e-mail, laboratório e datas obrigatórias.';
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
          <p><strong>Laboratório:</strong> ${escapeHtml(localizacao)}</p>
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

requestLocationSelect.addEventListener('change', () => {
  requestLines = [createRequestLine()];
  renderRequestLines();
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
openNewAdminBtn.addEventListener('click', () => {
  closeAdminModal();
  openNewAdminModal();
});
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
    feedback.innerHTML = 'Preencha o usuário ou e-mail e a senha.';
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
    if (error.details?.code === 'FIRST_ACCESS_REQUIRED') {
      closeAdminModal();
      openNewAdminModal(error.details?.user?.email || usuario);
      return;
    }

    if (error.details?.code === 'RESET_REQUIRED' && error.details?.user?.email) {
      closeAdminModal();
      openAdminPasswordResetModal(error.details.user);
      return;
    }

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

fetchMetadata().then(populateRequestLocationOptions);
fetchItems();
requestLines = [createRequestLine()];
renderRequestLines();
setMinDates();
