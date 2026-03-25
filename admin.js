const API_URL = 'http://localhost:3000/api';
const ADMIN_BACKGROUND_STORAGE_KEY = 'adminBackgroundImage';
const ADMIN_BACKGROUND_IMAGES = ['img/gen.jpeg', 'img/lab.jpeg', 'img/osci.jpeg'];

if (!localStorage.getItem('adminLoggedIn')) {
  window.location.href = 'index.html';
}

const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

let items = [];
let metadataOptions = {
  marca: [],
  modelo: [],
  localizacao: [],
};
let adminLoanLines = [];
let selectedActiveLoanIds = new Set();
let lineSequence = 0;
let siteModalResolver = null;
let selectedExistingItem = null;

const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');
const manageTabs = document.querySelectorAll('.manage-tab-btn');
const managePanes = document.querySelectorAll('.manage-pane');

const itemTituloInput = document.getElementById('itemTitulo');
const itemMarcaInput = document.getElementById('itemMarca');
const itemModeloInput = document.getElementById('itemModelo');
const itemPatrimonioInput = document.getElementById('itemPatrimonio');
const itemSerialInput = document.getElementById('itemSerial');
const itemTipoInput = document.getElementById('itemTipo');
const itemLocalizacaoInput = document.getElementById('itemLocalizacao');
const goToCadastrarItemBtn = document.getElementById('goToCadastrarItemBtn');
const goToAdicionarLocalizacaoBtn = document.getElementById('goToAdicionarLocalizacaoBtn');

const tituloSuggestions = document.getElementById('tituloSuggestions');
const marcaSuggestions = document.getElementById('marcaSuggestions');
const modeloSuggestions = document.getElementById('modeloSuggestions');
const localizacaoSuggestions = document.getElementById('localizacaoSuggestions');
const existingItemModeNotice = document.getElementById('existingItemModeNotice');
const existingItemModeText = document.getElementById('existingItemModeText');
const clearExistingItemBtn = document.getElementById('clearExistingItemBtn');

const adminLoanItemsContainer = document.getElementById('adminLoanItemsContainer');
const addAdminLoanItemBtn = document.getElementById('addAdminLoanItemBtn');

const siteModalOverlay = document.getElementById('siteModalOverlay');
const siteModalClose = document.getElementById('siteModalClose');
const siteModalTitle = document.getElementById('siteModalTitle');
const siteModalBody = document.getElementById('siteModalBody');
const siteModalFooter = document.getElementById('siteModalFooter');
const adminBackgroundImage = document.getElementById('adminBackgroundImage');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateUserInfo() {
  const userNameElement = document.getElementById('userName');
  if (!userNameElement) {
    return;
  }

  userNameElement.textContent = adminUser.nome || adminUser.username || 'Administrador';
}

function applyAdminBackground() {
  if (!adminBackgroundImage) {
    return;
  }

  const storedImage = sessionStorage.getItem(ADMIN_BACKGROUND_STORAGE_KEY);
  const selectedImage =
    storedImage && ADMIN_BACKGROUND_IMAGES.includes(storedImage)
      ? storedImage
      : ADMIN_BACKGROUND_IMAGES[Math.floor(Math.random() * ADMIN_BACKGROUND_IMAGES.length)];

  sessionStorage.setItem(ADMIN_BACKGROUND_STORAGE_KEY, selectedImage);
  adminBackgroundImage.style.backgroundImage = `url('${selectedImage}')`;
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

async function fetchMetadata() {
  const response = await fetch(`${API_URL}/metadata`);
  metadataOptions = await parseJsonResponse(response);
  return metadataOptions;
}

async function fetchLoans() {
  const response = await fetch(`${API_URL}/loans`);
  return parseJsonResponse(response);
}

async function fetchActiveLoans() {
  const response = await fetch(`${API_URL}/loans/active`);
  return parseJsonResponse(response);
}

async function fetchSolicitacoes() {
  const response = await fetch(`${API_URL}/solicitacoes`);
  return parseJsonResponse(response);
}

async function createItem(payload) {
  const response = await fetch(`${API_URL}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

async function updateItem(id, payload) {
  const response = await fetch(`${API_URL}/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

async function deleteItem(id) {
  const response = await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
  return parseJsonResponse(response);
}

async function createLoan(payload) {
  const response = await fetch(`${API_URL}/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

async function concluirLoan(id) {
  const response = await fetch(`${API_URL}/loans/${id}/concluir`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataDevolucaoReal: new Date().toISOString() }),
  });
  return parseJsonResponse(response);
}

async function aprovarSolicitacao(id, itemsPayload) {
  const response = await fetch(`${API_URL}/solicitacoes/${id}/aprovar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: itemsPayload }),
  });
  return parseJsonResponse(response);
}

async function rejeitarSolicitacao(id, motivo) {
  const response = await fetch(`${API_URL}/solicitacoes/${id}/rejeitar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
  return parseJsonResponse(response);
}

async function updateMetadata(field, oldValue, newValue) {
  const response = await fetch(`${API_URL}/metadata`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, oldValue, newValue }),
  });
  return parseJsonResponse(response);
}

async function createMetadata(field, value) {
  const response = await fetch(`${API_URL}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value }),
  });
  return parseJsonResponse(response);
}

async function deleteMetadata(field, value) {
  const response = await fetch(`${API_URL}/metadata`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value }),
  });
  return parseJsonResponse(response);
}

function showFeedback(elementId, message, type) {
  const feedback = document.getElementById(elementId);
  if (!feedback) {
    return;
  }

  feedback.style.display = 'block';
  feedback.className = `feedback-message ${type}`;
  feedback.innerHTML = message;
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 5000);
}

function openSiteModal({ title, bodyHtml, footerHtml, onOpen }) {
  siteModalTitle.textContent = title;
  siteModalBody.innerHTML = bodyHtml;
  siteModalFooter.innerHTML = footerHtml;
  siteModalOverlay.classList.add('active');
  if (onOpen) {
    onOpen();
  }
}

function closeSiteModal(result = null) {
  siteModalOverlay.classList.remove('active');
  siteModalBody.innerHTML = '';
  siteModalFooter.innerHTML = '';
  if (siteModalResolver) {
    const resolver = siteModalResolver;
    siteModalResolver = null;
    resolver(result);
  }
}

function showConfirmModal({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    siteModalResolver = resolve;
    openSiteModal({
      title,
      bodyHtml: `<p class="modal-text">${escapeHtml(message)}</p>`,
      footerHtml: `
        <button type="button" class="btn-secondary" id="siteModalCancelBtn">${escapeHtml(cancelText)}</button>
        <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" id="siteModalConfirmBtn">${escapeHtml(confirmText)}</button>
      `,
      onOpen: () => {
        document.getElementById('siteModalCancelBtn').addEventListener('click', () => closeSiteModal(false));
        document.getElementById('siteModalConfirmBtn').addEventListener('click', () => closeSiteModal(true));
      },
    });
  });
}

function showFormModal({ title, fields, confirmText = 'Salvar', cancelText = 'Cancelar' }) {
  return new Promise((resolve) => {
    siteModalResolver = resolve;
    openSiteModal({
      title,
      bodyHtml: `
        <form class="modal-form-grid" id="siteModalForm">
          ${fields
            .map(
              (field) => `
                <label class="modal-form-field">
                  <span>${escapeHtml(field.label)}</span>
                  ${
                    field.type === 'textarea'
                      ? `<textarea id="modal-field-${field.id}" rows="${field.rows || 4}" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(field.value || '')}</textarea>`
                      : `<input id="modal-field-${field.id}" type="${escapeHtml(field.type || 'text')}" value="${escapeHtml(field.value || '')}" placeholder="${escapeHtml(field.placeholder || '')}">`
                  }
                </label>
              `
            )
            .join('')}
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn-secondary" id="siteModalCancelBtn">${escapeHtml(cancelText)}</button>
        <button type="button" class="btn-primary" id="siteModalConfirmBtn">${escapeHtml(confirmText)}</button>
      `,
      onOpen: () => {
        document.getElementById('siteModalCancelBtn').addEventListener('click', () => closeSiteModal(null));
        document.getElementById('siteModalConfirmBtn').addEventListener('click', () => {
          const values = {};
          fields.forEach((field) => {
            const input = document.getElementById(`modal-field-${field.id}`);
            values[field.id] = input ? input.value.trim() : '';
          });
          closeSiteModal(values);
        });
      },
    });
  });
}

function showCustomModal({ title, bodyHtml, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onOpen }) {
  return new Promise((resolve) => {
    siteModalResolver = resolve;
    openSiteModal({
      title,
      bodyHtml,
      footerHtml: `
        <button type="button" class="btn-secondary" id="siteModalCancelBtn">${escapeHtml(cancelText)}</button>
        <button type="button" class="btn-primary" id="siteModalConfirmBtn">${escapeHtml(confirmText)}</button>
      `,
      onOpen: () => {
        if (onOpen) {
          onOpen();
        }
        document.getElementById('siteModalCancelBtn').addEventListener('click', () => closeSiteModal(null));
        document.getElementById('siteModalConfirmBtn').addEventListener('click', async () => {
          const result = await onConfirm();
          if (result !== false) {
            closeSiteModal(result);
          }
        });
      },
    });
  });
}

function createLineId(prefix) {
  lineSequence += 1;
  return `${prefix}-${lineSequence}`;
}

function getItemById(itemId) {
  return items.find((item) => Number(item.id) === Number(itemId)) || null;
}

function itemMetaLine(item) {
  return `${item.marca || 'Sem marca'} | ${item.modelo || 'Sem modelo'} | ${item.disponiveis} disponível(eis)`;
}

function itemPatrimoniosLine(item) {
  return item.unidades.map((unit) => unit.patrimonioExibicao).join(', ');
}

function formatSolicitacaoItens(itens) {
  return itens.map((item) => `${item.itemNome} x${item.quantidade}`).join('<br>');
}

function searchItems(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return items.filter((item) => {
    const searchable = [
      item.titulo,
      item.marca,
      item.modelo,
      item.localizacao,
      ...item.unidades.map((unit) => unit.patrimonioExibicao),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalized);
  });
}

function uniqueFieldValues(field, query) {
  const normalized = query.trim().toLowerCase();
  return [...new Set([...(metadataOptions[field] || []), ...items.map((item) => item[field]).filter(Boolean)])]
    .filter((value) => value.toLowerCase().includes(normalized))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function renderSimpleSuggestions(container, values, onSelect) {
  if (!values.length) {
    container.innerHTML = '';
    container.classList.remove('active');
    return;
  }

  container.innerHTML = values
    .map(
      (value) => `
        <div class="suggestion-item" data-value="${escapeHtml(value)}">
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join('');
  container.classList.add('active');

  container.querySelectorAll('.suggestion-item').forEach((element) => {
    element.addEventListener('click', () => {
      onSelect(element.dataset.value);
      container.classList.remove('active');
    });
  });
}

function bindAutocomplete(input, container, field) {
  input.addEventListener('input', () => {
    if (input.disabled || !input.value.trim()) {
      container.classList.remove('active');
      container.innerHTML = '';
      return;
    }
    renderSimpleSuggestions(container, uniqueFieldValues(field, input.value), (value) => {
      input.value = value;
    });
  });
}

function setExistingItemMode(item) {
  selectedExistingItem = item;
  itemTituloInput.value = item.titulo;
  itemMarcaInput.value = item.marca || '';
  itemModeloInput.value = item.modelo || '';
  itemTipoInput.value = item.tipo || '';
  itemLocalizacaoInput.value = item.localizacao || '';

  [itemTituloInput, itemMarcaInput, itemModeloInput, itemTipoInput, itemLocalizacaoInput].forEach(
    (field) => {
      field.disabled = true;
    }
  );

  existingItemModeText.textContent = `${item.titulo} | ${itemMetaLine(item)}. Informe um ou mais patrimônios novos e, se quiser, o número de série.`;
  existingItemModeNotice.style.display = 'block';
  tituloSuggestions.classList.remove('active');
}

function clearExistingItemMode() {
  selectedExistingItem = null;
  existingItemModeNotice.style.display = 'none';
  existingItemModeText.textContent = '';
  [itemTituloInput, itemMarcaInput, itemModeloInput, itemTipoInput, itemLocalizacaoInput].forEach(
    (field) => {
      field.disabled = false;
    }
  );
}

function resetCadastrarItemForm() {
  document.getElementById('cadastrarItemForm').reset();
  clearExistingItemMode();
  [tituloSuggestions, marcaSuggestions, modeloSuggestions, localizacaoSuggestions].forEach((element) => {
    element.classList.remove('active');
    element.innerHTML = '';
  });
}

function createAdminLoanLine() {
  return {
    id: createLineId('loan-line'),
    query: '',
    itemId: null,
    quantity: 1,
    unitIds: [],
  };
}

function ensureAdminLoanLines() {
  if (!adminLoanLines.length) {
    adminLoanLines = [createAdminLoanLine()];
  }
}

function normalizeUnitSelections(line) {
  const item = getItemById(line.itemId);
  if (!item) {
    line.quantity = 1;
    line.unitIds = [];
    return;
  }

  const maxQuantity = Math.max(1, item.unidadesDisponiveis.length);
  if (line.quantity > maxQuantity) {
    line.quantity = maxQuantity;
  }

  line.unitIds = line.unitIds.slice(0, line.quantity);
  const uniqueSelections = [];
  line.unitIds.forEach((unitId) => {
    if (!uniqueSelections.includes(unitId)) {
      uniqueSelections.push(unitId);
    }
  });
  line.unitIds = uniqueSelections;
  while (line.unitIds.length < line.quantity) {
    line.unitIds.push('');
  }
}

function renderAdminLoanLines() {
  ensureAdminLoanLines();

  adminLoanItemsContainer.innerHTML = adminLoanLines
    .map((line, index) => {
      const item = getItemById(line.itemId);
      const suggestions = !item && line.query ? searchItems(line.query).filter((entry) => entry.disponiveis > 0) : [];
      const maxQuantity = item ? Math.max(1, item.unidadesDisponiveis.length) : 1;
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
              <p>Selecione o título e os patrimônios reservados para este empréstimo.</p>
            </div>
            <div class="item-line-tools">
              <label class="inline-field">
                <span>Quantidade</span>
                <select class="line-quantity-select" data-action="set-quantity">${quantityOptions}</select>
              </label>
              ${
                adminLoanLines.length > 1
                  ? '<button type="button" class="icon-btn danger" data-action="remove-line" title="Remover item">×</button>'
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
                      <small>${escapeHtml(itemMetaLine(suggestion))}</small>
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
                  <div>${escapeHtml(itemMetaLine(item))}</div>
                </div>
                <div class="unit-selectors">
                  ${Array.from({ length: line.quantity }, (_, unitIndex) => {
                    const selectedElsewhere = line.unitIds.filter((unitId, indexUnit) => unitId && indexUnit !== unitIndex);
                    return `
                      <label class="modal-form-field">
                        <span>Patrimônio ${unitIndex + 1}</span>
                        <select class="line-unit-select" data-action="set-unit" data-unit-index="${unitIndex}">
                          <option value="">Selecione</option>
                          ${item.unidadesDisponiveis
                            .map((unit) => {
                              const isSelected = line.unitIds[unitIndex] === unit.id;
                              const isDisabled = selectedElsewhere.includes(unit.id) && !isSelected;
                              return `<option value="${escapeHtml(unit.id)}" ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${escapeHtml(unit.patrimonioExibicao)}</option>`;
                            })
                            .join('')}
                        </select>
                      </label>
                    `;
                  }).join('')}
                </div>
              `
              : ''
          }
        </div>
      `;
    })
    .join('');
}

function renderGerenciarItems(itemsToRender) {
  const tbody = document.getElementById('gerenciarItemsTableBody');
  if (!itemsToRender.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-message">Nenhum item cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = itemsToRender
    .map(
      (item) => `
        <tr>
          <td>${item.id}</td>
          <td>${escapeHtml(item.titulo)}</td>
          <td>${escapeHtml(item.marca || '-')}</td>
          <td>${escapeHtml(item.modelo || '-')}</td>
          <td>${escapeHtml(itemPatrimoniosLine(item))}</td>
          <td>${item.disponiveis}/${item.quantidade}</td>
          <td>${escapeHtml(item.localizacao || '-')}</td>
          <td>
            <button class="icon-btn" data-action="edit-item" data-item-id="${item.id}" title="Editar">✏</button>
            <button class="icon-btn danger" data-action="delete-item" data-item-id="${item.id}" title="Excluir">×</button>
          </td>
        </tr>
      `
    )
    .join('');
}

function renderMetadataTags(field, values, containerId) {
  const container = document.getElementById(containerId);
  if (!values.length) {
    container.innerHTML = '<p class="empty-message">Nenhum registro encontrado</p>';
    return;
  }

  container.innerHTML = values
    .map(
      (value) => `
        <div class="tag-item">
          <span>${escapeHtml(value)}</span>
          <button class="tag-action" data-action="edit-metadata" data-field="${field}" data-value="${escapeHtml(value)}" title="Editar">✏</button>
          <button class="tag-action danger" data-action="delete-metadata" data-field="${field}" data-value="${escapeHtml(value)}" title="Excluir">×</button>
        </div>
      `
    )
    .join('');
}

function renderManageViews() {
  const itemQuery = document.getElementById('searchGerenciarItems').value.toLowerCase();
  const filteredItems = items.filter((item) => {
    if (!itemQuery) {
      return true;
    }
    const searchable = [
      item.titulo,
      item.marca,
      item.modelo,
      item.localizacao,
      ...item.unidades.map((unit) => unit.patrimonioExibicao),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(itemQuery);
  });

  renderGerenciarItems(filteredItems);
  renderMetadataTags('marca', uniqueFieldValues('marca', document.getElementById('searchMarcas').value || ''), 'marcasList');
  renderMetadataTags('modelo', uniqueFieldValues('modelo', document.getElementById('searchModelos').value || ''), 'modelosList');
  renderMetadataTags('localizacao', uniqueFieldValues('localizacao', document.getElementById('searchLocalizacoes').value || ''), 'localizacoesList');
}

function updateSolicitacoesBadge(count) {
  const badge = document.getElementById('solicitacoesBadge');
  document.getElementById('solicitacoesCount').textContent = String(count);
  badge.hidden = count === 0;
}

async function loadActiveLoans() {
  const loans = await fetchActiveLoans();
  const tbody = document.getElementById('ativosTableBody');
  const searchInput = document.getElementById('searchAtivos');
  const bulkConcluirBtn = document.getElementById('bulkConcluirBtn');
  const selectAllAtivos = document.getElementById('selectAllAtivos');

  selectedActiveLoanIds = new Set(
    [...selectedActiveLoanIds].filter((loanId) => loans.some((loan) => Number(loan.id) === Number(loanId)))
  );

  function updateBulkSelectionState(loansToRender) {
    const visibleIds = loansToRender.map((loan) => Number(loan.id));
    const selectedVisibleCount = visibleIds.filter((loanId) => selectedActiveLoanIds.has(loanId)).length;
    bulkConcluirBtn.disabled = selectedActiveLoanIds.size === 0;
    bulkConcluirBtn.textContent =
      selectedActiveLoanIds.size > 0
        ? `Concluir selecionados (${selectedActiveLoanIds.size})`
        : 'Concluir selecionados';

    selectAllAtivos.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
    selectAllAtivos.indeterminate =
      selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  }

  function render(loansToRender) {
    if (!loansToRender.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-message">Nenhum empréstimo ativo</td></tr>';
      updateBulkSelectionState([]);
      return;
    }

    tbody.innerHTML = loansToRender
      .map(
        (loan) => `
          <tr>
            <td><input type="checkbox" class="ativo-checkbox" data-loan-id="${loan.id}" ${selectedActiveLoanIds.has(Number(loan.id)) ? 'checked' : ''}></td>
            <td>${loan.id}</td>
            <td>${escapeHtml(loan.loanGroupId || '-')}</td>
            <td>${escapeHtml(loan.itemNome || 'Item não especificado')}</td>
            <td>${escapeHtml(loan.itemPatrimonio || '-')}</td>
            <td>${escapeHtml(loan.solicitante || '-')}</td>
            <td>${new Date(loan.dataRetirada).toLocaleDateString('pt-BR')}</td>
            <td>${new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR')}</td>
            <td><button class="btn-success" data-action="finish-loan" data-loan-id="${loan.id}">Concluir</button></td>
          </tr>
        `
      )
      .join('');

    updateBulkSelectionState(loansToRender);
  }

  render(loans);
  searchInput.removeEventListener('input', searchInput._listener);
  searchInput._listener = () => {
    const query = searchInput.value.toLowerCase();
    render(
      loans.filter((loan) =>
        [loan.loanGroupId, loan.itemNome, loan.itemPatrimonio, loan.solicitante]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    );
  };
  searchInput.addEventListener('input', searchInput._listener);

  tbody.removeEventListener('change', tbody._checkboxListener);
  tbody._checkboxListener = (event) => {
    if (!event.target.classList.contains('ativo-checkbox')) {
      return;
    }

    const loanId = Number(event.target.dataset.loanId);
    if (event.target.checked) {
      selectedActiveLoanIds.add(loanId);
    } else {
      selectedActiveLoanIds.delete(loanId);
    }

    const query = searchInput.value.toLowerCase();
    const visibleLoans = loans.filter((loan) =>
      [loan.loanGroupId, loan.itemNome, loan.itemPatrimonio, loan.solicitante]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
    updateBulkSelectionState(visibleLoans);
  };
  tbody.addEventListener('change', tbody._checkboxListener);

  selectAllAtivos.removeEventListener('change', selectAllAtivos._listener);
  selectAllAtivos._listener = () => {
    const query = searchInput.value.toLowerCase();
    const visibleLoans = loans.filter((loan) =>
      [loan.loanGroupId, loan.itemNome, loan.itemPatrimonio, loan.solicitante]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );

    visibleLoans.forEach((loan) => {
      if (selectAllAtivos.checked) {
        selectedActiveLoanIds.add(Number(loan.id));
      } else {
        selectedActiveLoanIds.delete(Number(loan.id));
      }
    });

    render(visibleLoans);
  };
  selectAllAtivos.addEventListener('change', selectAllAtivos._listener);

  bulkConcluirBtn.removeEventListener('click', bulkConcluirBtn._listener);
  bulkConcluirBtn._listener = async () => {
    if (selectedActiveLoanIds.size === 0) {
      return;
    }

    const confirmed = await showConfirmModal({
      title: 'Concluir empréstimos',
      message: `Confirmar devolução de ${selectedActiveLoanIds.size} empréstimo(s)?`,
      confirmText: 'Concluir selecionados',
    });

    if (!confirmed) {
      return;
    }

    try {
      for (const loanId of selectedActiveLoanIds) {
        await concluirLoan(loanId);
      }

      selectedActiveLoanIds.clear();
      showFeedback('cadastroEmprestimoFeedback', 'Empréstimos concluídos com sucesso.', 'success');
      await fetchItems();
      renderAdminLoanLines();
      renderManageViews();
      await loadActiveLoans();
      await loadHistorico();
      await loadSolicitacoes();
    } catch (error) {
      showFeedback('cadastroEmprestimoFeedback', escapeHtml(error.message || 'Erro ao concluir empréstimos.'), 'error');
    }
  };
  bulkConcluirBtn.addEventListener('click', bulkConcluirBtn._listener);
}

async function loadHistorico() {
  const loans = await fetchLoans();
  const concluded = loans.filter((loan) => loan.status === 'concluido');
  const tbody = document.getElementById('historicoTableBody');
  const searchInput = document.getElementById('searchHistorico');

  function render(loansToRender) {
    if (!loansToRender.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-message">Nenhum registro no histórico</td></tr>';
      return;
    }

    tbody.innerHTML = loansToRender
      .map(
        (loan) => `
          <tr>
            <td>${loan.id}</td>
            <td>${escapeHtml(loan.loanGroupId || '-')}</td>
            <td>${escapeHtml(loan.itemNome || 'Item não especificado')}</td>
            <td>${escapeHtml(loan.itemPatrimonio || '-')}</td>
            <td>${escapeHtml(loan.solicitante || '-')}</td>
            <td>${new Date(loan.dataRetirada).toLocaleDateString('pt-BR')}</td>
            <td>${new Date(loan.dataDevolucaoPrevista).toLocaleDateString('pt-BR')}</td>
            <td><span class="status-concluido">Concluído</span></td>
            <td>${loan.dataDevolucaoReal ? new Date(loan.dataDevolucaoReal).toLocaleDateString('pt-BR') : '-'}</td>
          </tr>
        `
      )
      .join('');
  }

  render(concluded);
  searchInput.removeEventListener('input', searchInput._listener);
  searchInput._listener = () => {
    const query = searchInput.value.toLowerCase();
    render(
      concluded.filter((loan) =>
        [loan.loanGroupId, loan.itemNome, loan.itemPatrimonio, loan.solicitante]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    );
  };
  searchInput.addEventListener('input', searchInput._listener);
}

async function loadSolicitacoes() {
  const solicitacoes = await fetchSolicitacoes();
  const pendentes = solicitacoes.filter((solicitacao) => solicitacao.status === 'pendente');
  const tbody = document.getElementById('solicitacoesTableBody');
  updateSolicitacoesBadge(pendentes.length);

  if (!pendentes.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhuma solicitação pendente</td></tr>';
    return;
  }

  tbody.innerHTML = pendentes
    .map(
      (solicitacao) => `
        <tr>
          <td>${escapeHtml(solicitacao.id)}</td>
          <td>${escapeHtml(solicitacao.nome || '-')}</td>
          <td>${formatSolicitacaoItens(solicitacao.itens || [])}</td>
          <td>${new Date(solicitacao.dataRetirada).toLocaleDateString('pt-BR')}</td>
          <td>${new Date(solicitacao.dataDevolucao).toLocaleDateString('pt-BR')}</td>
          <td>
            <button class="btn-success" data-action="approve-request" data-request-id="${escapeHtml(solicitacao.id)}">Aprovar</button>
            <button class="btn-danger" data-action="reject-request" data-request-id="${escapeHtml(solicitacao.id)}">Rejeitar</button>
          </td>
        </tr>
      `
    )
    .join('');
}

async function refreshAfterInventoryChange() {
  await fetchItems();
  await fetchMetadata();
  renderAdminLoanLines();
  renderManageViews();
  await loadSolicitacoes();
}

async function handleCadastrarItemSubmit(event) {
  event.preventDefault();

  const patrimonios = itemPatrimonioInput.value
    .split(/\r?\n|,|;/)
    .map((value) => value.trim())
    .filter(Boolean);

  const payload = {
    titulo: itemTituloInput.value.trim(),
    marca: itemMarcaInput.value.trim(),
    modelo: itemModeloInput.value.trim(),
    patrimonios,
    serial: itemSerialInput.value.trim(),
    tipo: itemTipoInput.value,
    localizacao: itemLocalizacaoInput.value.trim(),
  };

  if (!payload.titulo || !payload.marca || !payload.modelo || !payload.tipo) {
    showFeedback('cadastroItemFeedback', 'Preencha título, marca, modelo e tipo.', 'error');
    return;
  }

  if (payload.patrimonios.length === 0) {
    const confirmed = await showConfirmModal({
      title: 'Cadastrar sem patrimônio',
      message: 'Deseja cadastrar o novo item sem número de patrimônio?',
      confirmText: 'Cadastrar mesmo assim',
    });
    if (!confirmed) {
      return;
    }
  }

  try {
    if (selectedExistingItem) {
      await createItem({
        existingItemId: selectedExistingItem.id,
        patrimonios: payload.patrimonios,
        serial: payload.serial,
      });
      showFeedback('cadastroItemFeedback', 'Nova unidade adicionada ao item existente.', 'success');
    } else {
      await createItem(payload);
      showFeedback('cadastroItemFeedback', 'Item cadastrado com sucesso.', 'success');
    }

    resetCadastrarItemForm();
    await refreshAfterInventoryChange();
  } catch (error) {
    showFeedback('cadastroItemFeedback', escapeHtml(error.message || 'Erro ao salvar item.'), 'error');
  }
}

function collectAdminLoanPayload() {
  return adminLoanLines.map((line) => {
    const item = getItemById(line.itemId);
    if (!item) {
      throw new Error('Selecione todos os itens do empréstimo.');
    }

    normalizeUnitSelections(line);
    if (line.unitIds.some((value) => !value)) {
      throw new Error(`Selecione todos os patrimônios para ${item.titulo}.`);
    }

    return {
      id: line.id,
      itemId: item.id,
      itemNome: item.titulo,
      quantidade: line.quantity,
      unitIds: [...line.unitIds],
    };
  });
}

async function handleCadastrarEmprestimoSubmit(event) {
  event.preventDefault();

  let payloadItems;
  try {
    payloadItems = collectAdminLoanPayload();
  } catch (error) {
    showFeedback('cadastroEmprestimoFeedback', escapeHtml(error.message), 'error');
    return;
  }

  const payload = {
    items: payloadItems,
    solicitante: document.getElementById('emprestimoSolicitante').value.trim(),
    email: document.getElementById('emprestimoEmail').value.trim(),
    dataRetirada: document.getElementById('emprestimoDataRetirada').value,
    dataDevolucaoPrevista: document.getElementById('emprestimoDataDevolucao').value,
    observacoes: document.getElementById('emprestimoObservacoes').value.trim(),
  };

  if (!payload.solicitante || !payload.dataRetirada || !payload.dataDevolucaoPrevista) {
    showFeedback('cadastroEmprestimoFeedback', 'Preencha solicitante e datas obrigatórias.', 'error');
    return;
  }

  try {
    await createLoan(payload);
    showFeedback('cadastroEmprestimoFeedback', 'Empréstimo registrado com sucesso.', 'success');
    document.getElementById('cadastrarEmprestimoForm').reset();
    adminLoanLines = [createAdminLoanLine()];
    renderAdminLoanLines();
    await fetchItems();
    renderManageViews();
    await loadActiveLoans();
    await loadSolicitacoes();
  } catch (error) {
    showFeedback('cadastroEmprestimoFeedback', escapeHtml(error.message || 'Erro ao registrar empréstimo.'), 'error');
  }
}

async function openApproveModal(requestId) {
  const solicitacoes = await fetchSolicitacoes();
  const solicitacao = solicitacoes.find((entry) => entry.id === requestId);
  if (!solicitacao) {
    showFeedback('cadastroEmprestimoFeedback', 'Solicitação não encontrada.', 'error');
    return;
  }

  const bodyHtml = `
    <div class="approval-lines">
      ${solicitacao.itens
        .map((line) => {
          const item = getItemById(line.itemId);
          const availableUnits = item ? item.unidadesDisponiveis : [];
          return `
            <div class="item-line-card approval-card">
              <div class="approval-title">
                <strong>${escapeHtml(line.itemNome)}</strong>
                <span>Quantidade solicitada: ${line.quantidade}</span>
              </div>
              ${
                item
                  ? Array.from({ length: line.quantidade }, (_, index) => `
                      <label class="modal-form-field">
                        <span>Patrimônio ${index + 1}</span>
                        <select class="approval-unit-select" data-line-id="${line.id}">
                          <option value="">Selecione</option>
                          ${availableUnits
                            .map((unit) => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.patrimonioExibicao)}</option>`)
                            .join('')}
                        </select>
                      </label>
                    `).join('')
                  : '<p class="empty-inline">Item não encontrado no catálogo atual.</p>'
              }
            </div>
          `;
        })
        .join('')}
      <div class="modal-inline-error" id="approvalModalError" style="display: none;"></div>
    </div>
  `;

  const result = await showCustomModal({
    title: `Aprovar ${solicitacao.id}`,
    bodyHtml,
    confirmText: 'Aprovar solicitação',
    onConfirm: async () => {
      const payloadItems = solicitacao.itens.map((line) => ({
        id: line.id,
        unitIds: [...document.querySelectorAll(`.approval-unit-select[data-line-id="${line.id}"]`)]
          .map((select) => select.value)
          .filter(Boolean),
      }));

      if (payloadItems.some((line, index) => line.unitIds.length !== solicitacao.itens[index].quantidade)) {
        const errorBox = document.getElementById('approvalModalError');
        errorBox.style.display = 'block';
        errorBox.textContent = 'Selecione todos os patrimônios antes de aprovar.';
        return false;
      }

      try {
        await aprovarSolicitacao(solicitacao.id, payloadItems);
        return true;
      } catch (error) {
        const errorBox = document.getElementById('approvalModalError');
        errorBox.style.display = 'block';
        errorBox.textContent = error.message || 'Erro ao aprovar a solicitação.';
        return false;
      }
    },
  });

  if (result) {
    showFeedback('cadastroEmprestimoFeedback', 'Solicitação aprovada com sucesso.', 'success');
    await fetchItems();
    renderAdminLoanLines();
    renderManageViews();
    await loadSolicitacoes();
    await loadActiveLoans();
  }
}

async function openRejectModal(requestId) {
  const values = await showFormModal({
    title: 'Rejeitar solicitação',
    confirmText: 'Rejeitar',
    fields: [{ id: 'motivo', label: 'Motivo da rejeição', type: 'textarea', placeholder: 'Descreva o motivo...' }],
  });

  if (!values) {
    return;
  }

  try {
    await rejeitarSolicitacao(requestId, values.motivo || 'Sem motivo informado');
    showFeedback('cadastroEmprestimoFeedback', 'Solicitação rejeitada.', 'info');
    await loadSolicitacoes();
  } catch (error) {
    showFeedback('cadastroEmprestimoFeedback', escapeHtml(error.message || 'Erro ao rejeitar solicitação.'), 'error');
  }
}

async function handleEditItem(itemId) {
  const item = getItemById(itemId);
  if (!item) {
    return;
  }

  const values = await showFormModal({
    title: 'Editar item',
    fields: [
      { id: 'titulo', label: 'Título', value: item.titulo },
      { id: 'marca', label: 'Marca', value: item.marca },
      { id: 'modelo', label: 'Modelo', value: item.modelo },
      { id: 'tipo', label: 'Tipo', value: item.tipo },
      { id: 'localizacao', label: 'Localização', value: item.localizacao },
    ],
  });

  if (!values) {
    return;
  }

  try {
    await updateItem(itemId, values);
    showFeedback('cadastroItemFeedback', 'Item atualizado com sucesso.', 'success');
    await refreshAfterInventoryChange();
  } catch (error) {
    showFeedback('cadastroItemFeedback', escapeHtml(error.message || 'Erro ao atualizar item.'), 'error');
  }
}

async function handleDeleteItem(itemId) {
  const confirmed = await showConfirmModal({
    title: 'Excluir item',
    message: 'Tem certeza que deseja remover este item?',
    confirmText: 'Excluir item',
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  try {
    await deleteItem(itemId);
    showFeedback('cadastroItemFeedback', 'Item removido com sucesso.', 'success');
    await refreshAfterInventoryChange();
  } catch (error) {
    showFeedback('cadastroItemFeedback', escapeHtml(error.message || 'Erro ao remover item.'), 'error');
  }
}

async function handleMetadataEdit(field, value) {
  const labels = { marca: 'Marca', modelo: 'Modelo', localizacao: 'Localização' };
  const values = await showFormModal({
    title: `Editar ${labels[field]}`,
    fields: [{ id: 'valor', label: labels[field], value }],
  });

  if (!values) {
    return;
  }

  try {
    await updateMetadata(field, value, values.valor);
    showFeedback('cadastroItemFeedback', `${labels[field]} atualizada com sucesso.`, 'success');
    await refreshAfterInventoryChange();
  } catch (error) {
    showFeedback('cadastroItemFeedback', escapeHtml(error.message || 'Erro ao atualizar registro.'), 'error');
  }
}

async function handleMetadataDelete(field, value) {
  const confirmed = await showConfirmModal({
    title: 'Excluir registro',
    message: `Deseja remover "${value}" dos itens associados?`,
    confirmText: 'Remover',
    danger: true,
  });

  if (!confirmed) {
    return;
  }

  try {
    await deleteMetadata(field, value);
    showFeedback('cadastroItemFeedback', 'Registro removido dos itens associados.', 'info');
    await refreshAfterInventoryChange();
  } catch (error) {
    showFeedback('cadastroItemFeedback', escapeHtml(error.message || 'Erro ao remover registro.'), 'error');
  }
}

async function handleCreateStandaloneLocation() {
  const values = await showFormModal({
    title: 'Adicionar localização',
    confirmText: 'Cadastrar localização',
    fields: [
      {
        id: 'valor',
        label: 'Nome da localização',
        placeholder: 'Ex: Lab 101, Almoxarifado, Sala de preparo',
      },
    ],
  });

  if (!values || !values.valor) {
    return;
  }

  try {
    await createMetadata('localizacao', values.valor);
    await fetchMetadata();
    renderManageViews();
    showFeedback('cadastroItemFeedback', 'Localização cadastrada com sucesso.', 'success');
  } catch (error) {
    showFeedback('cadastroItemFeedback', escapeHtml(error.message || 'Erro ao cadastrar localização.'), 'error');
  }
}

function bindItemTitleSuggestions() {
  itemTituloInput.addEventListener('input', () => {
    if (selectedExistingItem || !itemTituloInput.value.trim()) {
      tituloSuggestions.classList.remove('active');
      tituloSuggestions.innerHTML = '';
      return;
    }

    const suggestions = searchItems(itemTituloInput.value);
    if (!suggestions.length) {
      tituloSuggestions.classList.remove('active');
      tituloSuggestions.innerHTML = '';
      return;
    }

    tituloSuggestions.innerHTML = suggestions
      .map(
        (item) => `
          <div class="suggestion-item" data-item-id="${item.id}">
            <strong>${escapeHtml(item.titulo)}</strong>
            <small>${escapeHtml(itemMetaLine(item))}</small>
          </div>
        `
      )
      .join('');
    tituloSuggestions.classList.add('active');

    tituloSuggestions.querySelectorAll('.suggestion-item').forEach((element) => {
      element.addEventListener('click', () => {
        const item = getItemById(Number(element.dataset.itemId));
        if (item) {
          setExistingItemMode(item);
        }
      });
    });
  });
}

function setupAdminLoanLineEvents() {
  adminLoanItemsContainer.addEventListener('click', (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) {
      return;
    }

    const card = actionElement.closest('.item-line-card');
    const line = adminLoanLines.find((entry) => entry.id === card?.dataset.lineId);
    if (!line) {
      return;
    }

    if (actionElement.dataset.action === 'add-line') {
      adminLoanLines.push(createAdminLoanLine());
      renderAdminLoanLines();
      return;
    }

    if (actionElement.dataset.action === 'remove-line') {
      adminLoanLines = adminLoanLines.filter((entry) => entry.id !== line.id);
      renderAdminLoanLines();
      return;
    }

    if (actionElement.dataset.action === 'select-item') {
      const item = getItemById(Number(actionElement.dataset.itemId));
      if (!item) {
        return;
      }
      line.itemId = item.id;
      line.query = item.titulo;
      line.quantity = 1;
      line.unitIds = [''];
      normalizeUnitSelections(line);
      renderAdminLoanLines();
    }
  });

  adminLoanItemsContainer.addEventListener('input', (event) => {
    const line = adminLoanLines.find((entry) => entry.id === event.target.closest('.item-line-card')?.dataset.lineId);
    if (!line || !event.target.classList.contains('line-search-input')) {
      return;
    }

    const cursorPosition = event.target.selectionStart;
    line.query = event.target.value;
    line.itemId = null;
    line.quantity = 1;
    line.unitIds = [];
    renderAdminLoanLines();

    const nextInput = adminLoanItemsContainer.querySelector(`[data-line-id="${line.id}"] .line-search-input`);
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(cursorPosition, cursorPosition);
    }
  });

  adminLoanItemsContainer.addEventListener('change', (event) => {
    const line = adminLoanLines.find((entry) => entry.id === event.target.closest('.item-line-card')?.dataset.lineId);
    if (!line) {
      return;
    }

    if (event.target.dataset.action === 'set-quantity') {
      line.quantity = Math.max(1, Number(event.target.value) || 1);
      normalizeUnitSelections(line);
      renderAdminLoanLines();
      return;
    }

    if (event.target.dataset.action === 'set-unit') {
      line.unitIds[Number(event.target.dataset.unitIndex)] = event.target.value;
      renderAdminLoanLines();
    }
  });
}

function setupGlobalTableActions() {
  document.body.addEventListener('click', async (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;

    if (action === 'finish-loan') {
      const confirmed = await showConfirmModal({ title: 'Concluir empréstimo', message: 'Confirmar devolução do item?' });
      if (!confirmed) {
        return;
      }
      try {
        const loanId = Number(actionElement.dataset.loanId);
        await concluirLoan(loanId);
        selectedActiveLoanIds.delete(loanId);
        showFeedback('cadastroEmprestimoFeedback', 'Empréstimo concluído com sucesso.', 'success');
        await fetchItems();
        renderAdminLoanLines();
        renderManageViews();
        await loadActiveLoans();
        await loadHistorico();
        await loadSolicitacoes();
      } catch (error) {
        showFeedback('cadastroEmprestimoFeedback', escapeHtml(error.message || 'Erro ao concluir empréstimo.'), 'error');
      }
    }

    if (action === 'approve-request') {
      await openApproveModal(actionElement.dataset.requestId);
    }

    if (action === 'reject-request') {
      await openRejectModal(actionElement.dataset.requestId);
    }

    if (action === 'edit-item') {
      await handleEditItem(Number(actionElement.dataset.itemId));
    }

    if (action === 'delete-item') {
      await handleDeleteItem(Number(actionElement.dataset.itemId));
    }

    if (action === 'edit-metadata') {
      await handleMetadataEdit(actionElement.dataset.field, actionElement.dataset.value);
    }

    if (action === 'delete-metadata') {
      await handleMetadataDelete(actionElement.dataset.field, actionElement.dataset.value);
    }
  });
}

function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      await activateMainTab(tab.dataset.tab);
    });
  });

  manageTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      manageTabs.forEach((entry) => entry.classList.remove('active'));
      managePanes.forEach((entry) => entry.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.manageTab).classList.add('active');
    });
  });
}

async function activateMainTab(tabId) {
  tabs.forEach((entry) => entry.classList.remove('active'));
  panes.forEach((entry) => entry.classList.remove('active'));

  const selectedTab = [...tabs].find((entry) => entry.dataset.tab === tabId);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  const selectedPane = document.getElementById(tabId);
  if (selectedPane) {
    selectedPane.classList.add('active');
  }

  if (['cadastrar-item', 'cadastrar-emprestimo', 'solicitacoes', 'gerenciar'].includes(tabId)) {
    await fetchItems();
    await fetchMetadata();
    renderAdminLoanLines();
    renderManageViews();
  }

  if (tabId === 'emprestimos-ativos') {
    await loadActiveLoans();
  }
  if (tabId === 'historico') {
    await loadHistorico();
  }
  if (tabId === 'solicitacoes') {
    await loadSolicitacoes();
  }
}

function setupSearches() {
  ['searchGerenciarItems', 'searchMarcas', 'searchModelos', 'searchLocalizacoes'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderManageViews);
  });
}

function setupModalCloseActions() {
  siteModalClose.addEventListener('click', () => closeSiteModal(null));
  siteModalOverlay.addEventListener('click', (event) => {
    if (event.target === siteModalOverlay) {
      closeSiteModal(null);
    }
  });
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const confirmed = await showConfirmModal({ title: 'Encerrar sessão', message: 'Tem certeza que deseja sair do sistema?', confirmText: 'Sair' });
    if (!confirmed) {
      return;
    }
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem(ADMIN_BACKGROUND_STORAGE_KEY);
    window.location.href = 'index.html';
  });
}

function setupOutsideSuggestionClose() {
  document.addEventListener('click', (event) => {
    if (!itemTituloInput.contains(event.target) && !tituloSuggestions.contains(event.target)) {
      tituloSuggestions.classList.remove('active');
    }
    if (!itemMarcaInput.contains(event.target) && !marcaSuggestions.contains(event.target)) {
      marcaSuggestions.classList.remove('active');
    }
    if (!itemModeloInput.contains(event.target) && !modeloSuggestions.contains(event.target)) {
      modeloSuggestions.classList.remove('active');
    }
    if (!itemLocalizacaoInput.contains(event.target) && !localizacaoSuggestions.contains(event.target)) {
      localizacaoSuggestions.classList.remove('active');
    }
  });
}

function setupDates() {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('emprestimoDataRetirada').min = hoje;
  document.getElementById('emprestimoDataDevolucao').min = hoje;
}

async function init() {
  applyAdminBackground();
  updateUserInfo();
  setupModalCloseActions();
  setupTabs();
  setupSearches();
  setupOutsideSuggestionClose();
  setupLogout();
  setupGlobalTableActions();
  setupAdminLoanLineEvents();
  setupDates();

  bindAutocomplete(itemMarcaInput, marcaSuggestions, 'marca');
  bindAutocomplete(itemModeloInput, modeloSuggestions, 'modelo');
  bindAutocomplete(itemLocalizacaoInput, localizacaoSuggestions, 'localizacao');
  bindItemTitleSuggestions();

  document.getElementById('cadastrarItemForm').addEventListener('submit', handleCadastrarItemSubmit);
  document.getElementById('cadastrarEmprestimoForm').addEventListener('submit', handleCadastrarEmprestimoSubmit);
  clearExistingItemBtn.addEventListener('click', clearExistingItemMode);
  addAdminLoanItemBtn.addEventListener('click', () => {
    adminLoanLines.push(createAdminLoanLine());
    renderAdminLoanLines();
  });
  goToCadastrarItemBtn.addEventListener('click', async () => {
    await activateMainTab('cadastrar-item');
    itemTituloInput.focus();
  });
  goToAdicionarLocalizacaoBtn.addEventListener('click', handleCreateStandaloneLocation);

  await fetchItems();
  await fetchMetadata();
  adminLoanLines = [createAdminLoanLine()];
  renderAdminLoanLines();
  renderManageViews();
  await loadActiveLoans();
  await loadHistorico();
  await loadSolicitacoes();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && siteModalOverlay.classList.contains('active')) {
    closeSiteModal(null);
  }
});

init();
