(() => {
'use strict';

const STORAGE_KEY = 'benchmarkLogger.v1';
const DATA_VERSION = 1;
const SERIES_COLORS = 6;
const CSV_COLUMNS = ['id', 'createdAt', 'groupName', 'groupValue', 'groupNote', 'XMP', 'tRAS', 'metric', 'value', 'lowerIsBetter'];

// Every preset metric has the same shape: { label, value?, lowerIsBetter? }.
const PRESETS = {
  MemoryMark: {
    groupName: 'Memory Benchmark',
    groupValue: null,
    XMP: 'Enabled',
    tRAS: 75,
    metrics: [
      { label: 'Database Operations' },
      { label: 'Memory Read Uncached' },
      { label: 'Available RAM' },
      { label: 'Memory Threaded' },
      { label: 'Memory Read Cached' },
      { label: 'Memory Write' },
      { label: 'Memory Latency', lowerIsBetter: true }
    ]
  },
  CPUMark: {
    groupName: 'CPU Benchmark',
    groupValue: 36477,
    XMP: '',
    tRAS: null,
    metrics: [
      { label: 'Integer Math' },
      { label: 'Prime Numbers' },
      { label: 'Compression' },
      { label: 'Physics' },
      { label: 'CPU Single Threaded' },
      { label: 'Floating Point Math' },
      { label: 'Extended Instructions (SSE)' },
      { label: 'Encryption' },
      { label: 'Sorting' }
    ]
  },
  TestMark: {
    groupName: 'Test Benchmark',
    groupValue: 12,
    XMP: '',
    tRAS: null,
    metrics: [
      { label: 'Metric 0', value: 1 },
      { label: 'Metric 1', value: 10 },
      { label: 'Metric 2', value: 50 },
      { label: 'Metric 3', value: 100 },
      { label: 'Metric 4', value: 1000 },
      { label: 'Metric 5', value: 2500 },
      { label: 'Metric 6', value: 5000 },
      { label: 'Metric 7', value: 10000 },
      { label: 'Metric 8', value: 50000 },
      { label: 'Metric 9', value: 100000 },
      { label: 'Metric 10', value: 250000 },
      { label: 'Metric 11', value: 500000 },
      { label: 'Metric 12', value: 999000 }
    ]
  }
};

const $ = id => document.getElementById(id);
const els = {
  form: $('groupForm'),
  formTitle: $('formTitle'),
  formError: $('formError'),
  metricsContainer: $('metricsContainer'),
  groupName: $('groupName'),
  groupValue: $('groupValue'),
  groupNote: $('groupNote'),
  groupXMP: $('groupXMP'),
  groupTRAS: $('groupTRAS'),
  predefinedSelect: $('predefinedGroupSelect'),
  addMetricBtn: $('addMetricBtn'),
  submitBtn: $('submitBtn'),
  cancelEditBtn: $('cancelEditBtn'),
  exportJsonBtn: $('exportJsonBtn'),
  exportCsvBtn: $('exportCsvBtn'),
  importInput: $('importInput'),
  status: $('status'),
  comparison: $('comparison'),
  comparisonBody: $('comparisonBody'),
  clearCompareBtn: $('clearCompareBtn'),
  graph: $('graph')
};

let data = loadData();
let editingId = null;
let statusTimer = null;

// ---------- Helpers ----------

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, onClick, className) {
  const btn = el('button', className, text);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function groupSettings(group) {
  const parts = [];
  if (group.XMP) parts.push(`XMP ${group.XMP}`);
  if (group.tRAS !== null) parts.push(`tRAS ${group.tRAS}`);
  return parts;
}

function groupLabel(group) {
  return [group.groupName, ...groupSettings(group), formatDate(group.createdAt)].join(' · ');
}

function seriesLetter(index) {
  let s = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

function setStatus(message, isError = false) {
  clearTimeout(statusTimer);
  els.status.textContent = message;
  els.status.classList.toggle('error', isError);
  if (!isError) statusTimer = setTimeout(() => { els.status.textContent = ''; }, 8000);
}

// ---------- Data model and persistence ----------

// Checks and cleans a group from storage, an import or the form. Returns null if unusable.
function normalizeGroup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const groupName = String(raw.groupName ?? '').trim();
  const groupValue = toNumberOrNull(raw.groupValue);
  const seen = new Set();
  const metrics = (Array.isArray(raw.metrics) ? raw.metrics : [])
    .map(m => ({
      label: String(m?.label ?? '').trim(),
      value: toNumberOrNull(m?.value),
      lowerIsBetter: m?.lowerIsBetter === true || m?.lowerIsBetter === 'true'
    }))
    .filter(m => m.label && m.value !== null && !seen.has(m.label) && seen.add(m.label));
  if (!groupName || (metrics.length === 0 && groupValue === null)) return null;

  const created = raw.createdAt ? new Date(raw.createdAt) : new Date();
  const tRAS = toNumberOrNull(raw.tRAS);
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : newId(),
    createdAt: (Number.isNaN(created.getTime()) ? new Date() : created).toISOString(),
    groupName,
    groupValue,
    groupNote: String(raw.groupNote ?? '').trim(),
    XMP: String(raw.XMP ?? '').trim(),
    tRAS: tRAS !== null && Number.isInteger(tRAS) && tRAS >= 0 ? tRAS : null,
    metrics,
    showDetails: raw.showDetails !== false,
    compare: raw.compare === true
  };
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const groups = Array.isArray(parsed) ? parsed : parsed?.groups;
    return Array.isArray(groups) ? groups.map(normalizeGroup).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, groups: data }));
  } catch {
    setStatus('Could not save to browser storage. Export your data to keep it.', true);
  }
}

function commit() {
  saveData();
  render();
}

// Fields that go into exports (without UI state such as showDetails/compare).
function exportableGroup(g) {
  const { id, createdAt, groupName, groupValue, groupNote, XMP, tRAS } = g;
  return { id, createdAt, groupName, groupValue, groupNote, XMP, tRAS, metrics: g.metrics.map(m => ({ ...m })) };
}

// ---------- Form ----------

function addMetricField({ label = '', value = '', lowerIsBetter = false } = {}) {
  const row = el('div', 'metric-input-row');

  const labelInput = el('input', 'metric-label');
  labelInput.placeholder = 'Metric label';
  labelInput.autocomplete = 'off';
  labelInput.setAttribute('aria-label', 'Metric label');
  labelInput.value = label;

  const valueInput = el('input', 'metric-value');
  valueInput.type = 'number';
  valueInput.step = 'any';
  valueInput.inputMode = 'decimal';
  valueInput.placeholder = 'Value';
  valueInput.setAttribute('aria-label', 'Metric value');
  valueInput.value = value ?? '';

  const lowerToggle = el('label', 'lower-toggle');
  const lowerBox = el('input', 'metric-lower');
  lowerBox.type = 'checkbox';
  lowerBox.checked = lowerIsBetter;
  lowerToggle.append(lowerBox, 'Lower is better');

  const removeBtn = button('Remove', () => row.remove(), 'button-quiet');

  row.append(labelInput, valueInput, lowerToggle, removeBtn);
  els.metricsContainer.appendChild(row);
  return labelInput;
}

function fillForm(group) {
  els.groupName.value = group.groupName ?? '';
  els.groupValue.value = group.groupValue ?? '';
  els.groupNote.value = group.groupNote ?? '';
  els.groupXMP.value = group.XMP ?? '';
  els.groupTRAS.value = group.tRAS ?? '';
  els.metricsContainer.replaceChildren();
  (group.metrics || []).forEach(m => addMetricField(m));
}

function clearForm() {
  els.predefinedSelect.value = '';
  fillForm({});
  hideFormError();
}

function showFormError(message, input) {
  hideFormError();
  els.formError.textContent = message;
  els.formError.hidden = false;
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

function hideFormError() {
  els.formError.hidden = true;
  els.formError.textContent = '';
  els.form.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
}

// Returns { value } (null when empty) or { error: true }.
function readNumberInput(input) {
  if (input.validity.badInput) return { error: true };
  const raw = input.value.trim();
  if (raw === '') return { value: null };
  const n = Number(raw);
  return Number.isFinite(n) ? { value: n } : { error: true };
}

// Returns the group fields from the form, or null after showing an error.
function readForm() {
  const groupName = els.groupName.value.trim();
  if (!groupName) return showFormError('Enter a benchmark name.', els.groupName), null;

  const groupValue = readNumberInput(els.groupValue);
  if (groupValue.error) return showFormError('Overall score must be a number.', els.groupValue), null;

  const tRAS = readNumberInput(els.groupTRAS);
  if (tRAS.error || (tRAS.value !== null && (!Number.isInteger(tRAS.value) || tRAS.value < 0))) {
    return showFormError('tRAS must be a whole number of 0 or more.', els.groupTRAS), null;
  }

  const metrics = [];
  const labels = new Set();
  for (const row of els.metricsContainer.querySelectorAll('.metric-input-row')) {
    const labelInput = row.querySelector('.metric-label');
    const valueInput = row.querySelector('.metric-value');
    const label = labelInput.value.trim();
    const isBlankValue = valueInput.value.trim() === '' && !valueInput.validity.badInput;
    if (!label && isBlankValue) continue; // Ignore fully empty rows.
    if (!label) return showFormError('Every metric with a value needs a label.', labelInput), null;
    if (labels.has(label)) return showFormError(`The metric "${label}" is listed twice.`, labelInput), null;
    const value = readNumberInput(valueInput);
    if (value.error || value.value === null) {
      return showFormError(`Enter a numeric value for "${label}".`, valueInput), null;
    }
    labels.add(label);
    metrics.push({ label, value: value.value, lowerIsBetter: row.querySelector('.metric-lower').checked });
  }

  if (metrics.length === 0 && groupValue.value === null) {
    return showFormError('Add at least one metric or an overall score.', els.groupValue), null;
  }

  return {
    groupName,
    groupValue: groupValue.value,
    groupNote: els.groupNote.value.trim(),
    XMP: els.groupXMP.value.trim(),
    tRAS: tRAS.value,
    metrics
  };
}

function startEdit(id) {
  const group = data.find(g => g.id === id);
  if (!group) return;
  editingId = id;
  els.predefinedSelect.value = '';
  fillForm(group);
  hideFormError();
  els.formTitle.textContent = `Edit "${group.groupName}"`;
  els.submitBtn.textContent = 'Save Changes';
  els.cancelEditBtn.hidden = false;
  render();
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.groupName.focus({ preventScroll: true });
}

function exitEditMode() {
  editingId = null;
  els.formTitle.textContent = 'Add Benchmark Group';
  els.submitBtn.textContent = 'Add Group to Graph';
  els.cancelEditBtn.hidden = true;
}

function deleteGroup(id) {
  const group = data.find(g => g.id === id);
  if (!group || !confirm(`Delete "${groupLabel(group)}"? This cannot be undone.`)) return;
  data = data.filter(g => g.id !== id);
  if (editingId === id) {
    exitEditMode();
    clearForm();
  }
  commit();
  setStatus(`Deleted "${group.groupName}".`);
}

// ---------- Rendering ----------

function render() {
  renderGraph();
  renderComparison();
}

function renderBar(widthPercent, value, innerClass) {
  const bar = el('div', 'bar');
  const inner = el('div', `bar-inner ${innerClass || ''}`.trim());
  inner.style.width = `${Math.min(100, Math.max(0, widthPercent))}%`;
  bar.append(inner, el('div', 'bar-value', value === null ? '—' : formatNumber(value)));
  return bar;
}

function lowerBadge() {
  const badge = el('span', 'lower-badge', '↓ lower is better');
  badge.title = 'Lower values are better for this metric';
  return badge;
}

function renderGraph() {
  els.graph.replaceChildren();
  if (data.length === 0) {
    els.graph.appendChild(el('p', 'empty', 'No benchmarks logged yet. Add a group above or import a file.'));
    return;
  }

  // Log scale shared by all groups, so bars can be compared across groups.
  // log10(v + 1) keeps values between 0 and 1 visible and maps 0 to an empty bar.
  const maxValue = Math.max(1, ...data.flatMap(g => g.metrics.map(m => m.value)));
  const maxLog = Math.log10(maxValue + 1);

  data.forEach(entry => {
    const card = el('article', 'group');
    if (entry.id === editingId) card.classList.add('editing');

    const header = el('div', 'group-header');
    const titleText = entry.groupName + (entry.groupValue !== null ? `: ${formatNumber(entry.groupValue)}` : '');
    const title = el('h3', 'group-title', titleText);
    const time = el('time', 'group-time', formatDate(entry.createdAt));
    time.dateTime = entry.createdAt;

    const actions = el('div', 'group-actions');
    const compareToggle = el('label', 'compare-toggle');
    const compareBox = el('input');
    compareBox.type = 'checkbox';
    compareBox.checked = entry.compare;
    compareBox.addEventListener('change', () => {
      entry.compare = compareBox.checked;
      commit();
    });
    compareToggle.append(compareBox, 'Compare');

    const toggleBtn = button(entry.showDetails ? 'Hide details' : 'Show details', () => {
      entry.showDetails = !entry.showDetails;
      commit();
    }, 'button-quiet');
    toggleBtn.setAttribute('aria-expanded', String(entry.showDetails));

    actions.append(
      compareToggle,
      toggleBtn,
      button('Edit', () => startEdit(entry.id), 'button-quiet'),
      button('Delete', () => deleteGroup(entry.id), 'button-quiet button-danger')
    );
    header.append(title, time, actions);
    card.appendChild(header);

    if (entry.groupNote) card.appendChild(el('p', 'groupNote', entry.groupNote));

    if (entry.showDetails) {
      const settings = groupSettings(entry);
      if (settings.length) card.appendChild(el('div', 'group-meta', settings.join(' · ')));

      entry.metrics.forEach(metric => {
        const row = el('div', 'bar-row');
        const label = el('div', 'bar-label', metric.label);
        if (metric.lowerIsBetter) label.appendChild(lowerBadge());
        const width = metric.value > 0 ? (Math.log10(metric.value + 1) / maxLog) * 100 : 0;
        row.append(label, renderBar(width, metric.value, metric.lowerIsBetter ? 'lower' : ''));
        card.appendChild(row);
      });
    }

    els.graph.appendChild(card);
  });
}

function formatDiff(value, base, lowerIsBetter) {
  if (value === null) return { text: 'missing', cls: 'neutral' };
  if (base === null || base === 0) return { text: 'n/a', cls: 'neutral' };
  const pct = ((value - base) / Math.abs(base)) * 100;
  if (Math.abs(pct) < 0.05) return { text: '±0.0%', cls: 'neutral' };
  const better = lowerIsBetter ? pct < 0 : pct > 0;
  return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, cls: better ? 'better' : 'worse' };
}

function renderComparison() {
  const selected = data.filter(g => g.compare);
  els.comparison.hidden = selected.length === 0;
  els.comparisonBody.replaceChildren();
  if (selected.length === 0) return;

  const legend = el('ul', 'cmp-legend');
  selected.forEach((g, i) => {
    const item = el('li');
    item.append(el('span', `swatch series-${i % SERIES_COLORS}`), el('strong', '', `${seriesLetter(i)}: `), groupLabel(g));
    if (i === 0) item.append(el('span', 'baseline-tag', ' (baseline)'));
    legend.appendChild(item);
  });
  els.comparisonBody.appendChild(legend);

  if (selected.length < 2) {
    els.comparisonBody.appendChild(el('p', 'empty', 'Tick "Compare" on at least one more group to see them side by side.'));
    return;
  }
  els.comparisonBody.appendChild(el('p', 'hint',
    'The baseline is the first selected group in the list. Differences are relative to it: green is better, red is worse.'));

  const rows = [];
  if (selected.some(g => g.groupValue !== null)) {
    rows.push({ label: 'Overall score', lowerIsBetter: false, values: selected.map(g => g.groupValue) });
  }
  const metricLabels = new Map(); // label -> lowerIsBetter, in first-seen order
  selected.forEach(g => g.metrics.forEach(m => {
    metricLabels.set(m.label, metricLabels.get(m.label) === true || m.lowerIsBetter);
  }));
  metricLabels.forEach((lowerIsBetter, label) => {
    rows.push({
      label,
      lowerIsBetter,
      values: selected.map(g => g.metrics.find(m => m.label === label)?.value ?? null)
    });
  });

  rows.forEach(row => {
    const block = el('div', 'cmp-metric');
    const heading = el('div', 'cmp-metric-title', row.label);
    if (row.lowerIsBetter) heading.appendChild(lowerBadge());
    block.appendChild(heading);

    // Linear scale per metric: easier to compare readings of the same metric.
    const max = Math.max(0, ...row.values.filter(v => v !== null));
    row.values.forEach((value, i) => {
      const line = el('div', 'cmp-row');
      const name = el('span', 'cmp-name', `${seriesLetter(i)} · ${selected[i].groupName}`);
      name.title = groupLabel(selected[i]);
      const width = value !== null && max > 0 ? (Math.max(value, 0) / max) * 100 : 0;
      const diff = i === 0 ? { text: 'baseline', cls: 'neutral' } : formatDiff(value, row.values[0], row.lowerIsBetter);
      line.append(name, renderBar(width, value, `series-${i % SERIES_COLORS}`), el('span', `cmp-diff ${diff.cls}`, diff.text));
      block.appendChild(line);
    });
    els.comparisonBody.appendChild(block);
  });
}

// ---------- Import / export ----------

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportFilename(ext) {
  return `benchmark-log-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per metric; the group's fields repeat on each row.
function toCsv(groups) {
  const lines = [CSV_COLUMNS.join(',')];
  groups.forEach(g => {
    const base = [g.id, g.createdAt, g.groupName, g.groupValue, g.groupNote, g.XMP, g.tRAS];
    const metricRows = g.metrics.length ? g.metrics.map(m => [m.label, m.value, m.lowerIsBetter]) : [['', '', '']];
    metricRows.forEach(m => lines.push([...base, ...m].map(csvCell).join(',')));
  });
  return lines.join('\r\n') + '\r\n';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function csvToGroups(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('the CSV file is empty.');
  const col = new Map(header.map((h, i) => [h.trim(), i]));
  if (!col.has('groupName')) throw new Error('the CSV has no "groupName" column.');
  const get = (row, name) => (col.has(name) ? row[col.get(name)] ?? '' : '').trim();

  const groups = new Map();
  rows.forEach(row => {
    const key = get(row, 'id') || `${get(row, 'createdAt')}|${get(row, 'groupName')}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: get(row, 'id'),
        createdAt: get(row, 'createdAt'),
        groupName: get(row, 'groupName'),
        groupValue: get(row, 'groupValue'),
        groupNote: get(row, 'groupNote'),
        XMP: get(row, 'XMP'),
        tRAS: get(row, 'tRAS'),
        metrics: []
      });
    }
    const label = get(row, 'metric');
    if (label) {
      groups.get(key).metrics.push({
        label,
        value: get(row, 'value'),
        lowerIsBetter: /^(true|1|yes)$/i.test(get(row, 'lowerIsBetter'))
      });
    }
  });
  return [...groups.values()];
}

async function importFile(file) {
  const text = await file.text();
  let rawGroups;
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    rawGroups = csvToGroups(text);
  } else {
    const parsed = JSON.parse(text);
    rawGroups = Array.isArray(parsed) ? parsed : parsed?.groups;
    if (!Array.isArray(rawGroups)) throw new Error('the JSON must be a list of groups or { "groups": [...] }.');
  }

  const existingIds = new Set(data.map(g => g.id));
  let added = 0, duplicates = 0, invalid = 0;
  rawGroups.forEach(raw => {
    const group = normalizeGroup(raw);
    if (!group) invalid++;
    else if (existingIds.has(group.id)) duplicates++;
    else {
      existingIds.add(group.id);
      data.push(group);
      added++;
    }
  });
  commit();

  const notes = [];
  if (duplicates) notes.push(`${duplicates} already present`);
  if (invalid) notes.push(`${invalid} invalid`);
  setStatus(`Imported ${added} group${added === 1 ? '' : 's'}${notes.length ? ` (skipped ${notes.join(', ')})` : ''}.`);
}

// ---------- Event wiring ----------

els.predefinedSelect.addEventListener('change', () => {
  const preset = PRESETS[els.predefinedSelect.value];
  fillForm(preset || {});
  hideFormError();
});

els.addMetricBtn.addEventListener('click', () => addMetricField().focus());

els.form.addEventListener('submit', event => {
  event.preventDefault();
  hideFormError();
  const fields = readForm();
  if (!fields) return;

  const editedIndex = editingId ? data.findIndex(g => g.id === editingId) : -1;
  if (editedIndex !== -1) {
    data[editedIndex] = { ...data[editedIndex], ...fields };
    setStatus(`Saved changes to "${fields.groupName}".`);
  } else {
    data.push({ id: newId(), createdAt: new Date().toISOString(), ...fields, showDetails: true, compare: false });
    setStatus(`Added "${fields.groupName}".`);
  }
  exitEditMode();
  clearForm();
  commit();
});

els.cancelEditBtn.addEventListener('click', () => {
  exitEditMode();
  clearForm();
  render();
});

els.clearCompareBtn.addEventListener('click', () => {
  data.forEach(g => { g.compare = false; });
  commit();
});

els.exportJsonBtn.addEventListener('click', () => {
  if (data.length === 0) return setStatus('Nothing to export yet.', true);
  const payload = { version: DATA_VERSION, exportedAt: new Date().toISOString(), groups: data.map(exportableGroup) };
  download(exportFilename('json'), JSON.stringify(payload, null, 2), 'application/json');
});

els.exportCsvBtn.addEventListener('click', () => {
  if (data.length === 0) return setStatus('Nothing to export yet.', true);
  download(exportFilename('csv'), toCsv(data), 'text/csv');
});

els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files[0];
  els.importInput.value = ''; // Allow importing the same file again.
  if (!file) return;
  try {
    await importFile(file);
  } catch (err) {
    setStatus(`Import failed: ${err.message}`, true);
  }
});

render();
})();
