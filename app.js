"use strict";

const responsePdfInput = document.querySelector("#response-pdf-input");
const readResponseButton = document.querySelector("#read-response-pdf");
const clearResponseButton = document.querySelector("#clear-response");
const responseFileName = document.querySelector("#response-file-name");
const responseStatus = document.querySelector("#response-status");
const responseEditor = document.querySelector("#response-editor");
const responseCnpj = document.querySelector("#response-cnpj");
const responseTradeName = document.querySelector("#response-trade-name");
const responseMonth = document.querySelector("#response-month");
const responseEmployees = document.querySelector("#response-employees");
const addResponseEmployeeButton = document.querySelector("#add-response-employee");
const generateResponseReportButton = document.querySelector("#generate-response-report");
const responseReportPreview = document.querySelector("#response-report-preview");
const responseReportPages = document.querySelector("#response-report-pages");
const printResponseReportButton = document.querySelector("#print-response-report");
const saveResponseReportButton = document.querySelector("#save-response-report");

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let selectedResponsePdf = null;
let isReadingResponse = false;
let responseReportPreviewUrl = "";
let preparedResponseReport = null;
let responseReportRenderGeneration = 0;

responsePdfInput.addEventListener("change", () => {
  clearResponseReportPreview();
  selectedResponsePdf = responsePdfInput.files?.[0] || null;
  responseFileName.textContent = selectedResponsePdf?.name || "Nenhum arquivo selecionado";
  responseCnpj.value = "";
  responseTradeName.value = "";
  responseMonth.value = "";
  responseEmployees.replaceChildren();
  responseEditor.hidden = true;
  setResponseStatus("");
  readResponseButton.disabled = !selectedResponsePdf || isReadingResponse;
  clearResponseButton.disabled = !selectedResponsePdf || isReadingResponse;
});
readResponseButton.addEventListener("click", readFormResponsePdf);
clearResponseButton.addEventListener("click", clearFormResponse);
addResponseEmployeeButton.addEventListener("click", () => {
  invalidateResponseReportPreview();
  addResponseEmployee({}, { manual: true });
});
generateResponseReportButton.addEventListener("click", generateResponseReport);
printResponseReportButton.addEventListener("click", printResponseReport);
saveResponseReportButton.addEventListener("click", saveResponseReport);
responseEditor.addEventListener("input", invalidateResponseReportPreview);
responseEmployees.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".response-remove");
  if (removeButton) {
    const hadPreview = Boolean(preparedResponseReport);
    invalidateResponseReportPreview();
    removeButton.closest("tr").remove();
    if (!hadPreview) setResponseStatus("");
  }
});

function setResponseStatus(message, kind = "") {
  responseStatus.textContent = message;
  responseStatus.dataset.kind = kind;
}

function addResponseEmployee(values = {}, { manual = false } = {}) {
  const row = document.createElement("tr");
  if (manual) {
    row.dataset.source = "manual";
    row.title = "Funcionário adicionado manualmente.";
  }
  const nameCell = document.createElement("td");
  const hoursCell = document.createElement("td");
  const rateCell = document.createElement("td");
  const actionCell = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "response-employee-name";
  nameInput.setAttribute("aria-label", "Nome do funcionário");
  nameInput.placeholder = "Nome completo";
  nameInput.autocomplete = "off";
  nameInput.required = true;
  nameInput.value = values.name || "";
  const hoursInput = document.createElement("input");
  hoursInput.type = "number";
  hoursInput.className = "response-hours-input";
  hoursInput.setAttribute("aria-label", "Horas extras trabalhadas");
  hoursInput.min = "0";
  hoursInput.step = "0.01";
  hoursInput.required = true;
  hoursInput.value = values.hours ?? "";
  const rateInput = document.createElement("input");
  rateInput.type = "number";
  rateInput.className = "response-rate-input";
  rateInput.setAttribute("aria-label", "Valor unitário da hora extra em reais");
  rateInput.min = "0";
  rateInput.step = "0.01";
  rateInput.required = true;
  rateInput.placeholder = "0,00";
  rateInput.value = values.rate ?? "";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "response-remove";
  removeButton.setAttribute("aria-label", "Remover funcionário");
  removeButton.textContent = "×";
  nameCell.append(nameInput);
  hoursCell.append(hoursInput);
  rateCell.append(rateInput);
  actionCell.append(removeButton);
  row.append(nameCell, hoursCell, rateCell, actionCell);
  responseEmployees.append(row);
  if (manual) nameInput.focus();
}

function clearFormResponse() {
  if (isReadingResponse) return;
  clearResponseReportPreview();
  selectedResponsePdf = null;
  responsePdfInput.value = "";
  responseFileName.textContent = "Nenhum arquivo selecionado";
  responseCnpj.value = "";
  responseTradeName.value = "";
  responseMonth.value = "";
  responseEmployees.replaceChildren();
  responseEditor.hidden = true;
  readResponseButton.disabled = true;
  clearResponseButton.disabled = true;
  generateResponseReportButton.disabled = false;
  setResponseStatus("");
}

function parseLocaleNumber(value) {
  const cleaned = String(value)
    .replace(/R\$\s*/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!cleaned) return NaN;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  return Number(normalized);
}

function normalizeFormMonth(value) {
  const text = value.trim().toLocaleLowerCase("pt-BR");
  const isoMonth = text.match(/\b((?:19|20)\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (isoMonth) return `${isoMonth[1]}-${isoMonth[2].padStart(2, "0")}`;
  const numericMonth = text.match(/\b(0?[1-9]|1[0-2])\s*[/-]\s*((?:19|20)\d{2})\b/);
  if (numericMonth) return `${numericMonth[2]}-${numericMonth[1].padStart(2, "0")}`;
  const namedMonth = text.match(/\b([a-zçãé]+)\s*(?:de|[/.-])?\s*((?:19|20)\d{2})\b/);
  if (!namedMonth) return "";
  const monthNames = [
    "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const monthIndex = monthNames.indexOf(normalizeForMatching(namedMonth[1]));
  return monthIndex < 0 ? "" : `${namedMonth[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
}

const FORM_RESPONSE_LABELS = {
  cnpj: ["cnpj"],
  tradeName: ["razao social / nome fantasia", "nome fantasia", "nome comercial"],
  month: ["mes referente", "mes de referencia", "mes referente as horas trabalhadas", "competencia"],
  employees: ["funcionarios", "funcionario"],
};

function findFormFieldStart(line, aliases) {
  const normalized = normalizeForMatching(line.trim());
  return aliases.some((alias) => {
    if (!normalized.startsWith(alias)) return false;
    const next = normalized[alias.length];
    return !next || /[\s:=-]/.test(next);
  });
}

function extractFormFieldLines(lines, fieldName) {
  const aliases = FORM_RESPONSE_LABELS[fieldName];
  const allAliases = Object.values(FORM_RESPONSE_LABELS).flat();
  const index = lines.findIndex((line) => findFormFieldStart(line, aliases));
  if (index < 0) return [];

  const line = lines[index].trim();
  const normalizedLine = normalizeForMatching(line);
  const matchingAlias = aliases.find((alias) => normalizedLine.startsWith(alias));
  let inlineAnswer = "";
  if (matchingAlias) {
    const colonIndex = line.indexOf(":");
    if (colonIndex >= 0 && normalizeForMatching(line.slice(0, colonIndex).trim()) === matchingAlias) {
      inlineAnswer = line.slice(colonIndex + 1).trim();
    } else if (colonIndex < 0) {
      const possibleAnswer = line.slice(matchingAlias.length).trim();
      if (fieldName !== "employees" && /^[\d]/.test(possibleAnswer)) inlineAnswer = possibleAnswer;
    }
  }

  const answers = inlineAnswer ? [inlineAnswer] : [];
  for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
    const nextLine = lines[nextIndex].trim();
    if (!nextLine) {
      if (answers.length && fieldName !== "employees") break;
      continue;
    }
    if (allAliases.some((alias) => findFormFieldStart(nextLine, [alias]))) break;
    if (fieldName !== "employees" && answers.length) break;
    answers.push(nextLine);
  }
  return answers;
}

function parseFormEmployeeRows(lines) {
  const rows = [];
  for (const line of lines) {
    const columns = line
      .split(/[;|]/)
      .map((column) => column.trim())
      .filter(Boolean);
    if (columns.length < 3 || /^(?:nome|funcionario)\b/i.test(normalizeForMatching(columns[0]))) continue;
    const hours = parseLocaleNumber(columns[1]);
    const rate = parseLocaleNumber(columns[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(rate)) continue;
    rows.push({ name: columns[0].replace(/^[•*\-\s]+/, ""), hours, rate });
  }
  return rows;
}

function isValidCnpj(value) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (base, weights) => {
    const remainder =
      base.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(
    digits.slice(0, 12) + firstDigit,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return digits.endsWith(`${firstDigit}${secondDigit}`);
}

function hasCnpjFormat(value) {
  const digits = value.replace(/\D/g, "");
  return /^\d{14}$/.test(digits) && !/^(\d)\1{13}$/.test(digits);
}

function parsePositionedEmployeeRows(textContent) {
  const items = textContent.items
    .filter((item) => "str" in item && item.str.trim() && Array.isArray(item.transform))
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
    }));
  const headerPatterns = [
    (text) => /\bnome do funcionario\b/.test(text),
    (text) => /\bhoras extras trabalhadas\b/.test(text),
    (text) => /\bvalor da hora extra\b/.test(text),
  ];
  const headers = headerPatterns.map((matches) =>
    items.find((item) => matches(normalizeForMatching(item.text))),
  );
  if (headers.some((header) => !header)) return [];

  const [nameHeader, hoursHeader, rateHeader] = headers;
  if (!(nameHeader.x < hoursHeader.x && hoursHeader.x < rateHeader.x)) return [];
  const nameHoursBoundary = (nameHeader.x + hoursHeader.x) / 2;
  const hoursRateBoundary = (hoursHeader.x + rateHeader.x) / 2;
  const headerY = Math.min(...headers.map((header) => header.y));
  const rowGroups = [];
  for (const item of items) {
    if (item.y >= headerY - 2) continue;
    let group = rowGroups.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
    if (!group) {
      group = { y: item.y, items: [] };
      rowGroups.push(group);
    }
    group.items.push(item);
  }

  const employees = [];
  for (const group of rowGroups) {
    const name = group.items
      .filter((item) => item.x < nameHoursBoundary)
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(" ")
      .trim();
    const hoursText = group.items
      .filter((item) => item.x >= nameHoursBoundary && item.x < hoursRateBoundary)
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(" ")
      .trim();
    const rateText = group.items
      .filter((item) => item.x >= hoursRateBoundary)
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(" ")
      .trim();
    if (!name || /[\[\]]/.test(name) || /^(?:nome do funcionario|funcionario)$/i.test(normalizeForMatching(name))) {
      continue;
    }

    const duration = hoursText.match(/^\s*(\d{1,3})(?:[,.](\d+))?\s*h(?:\s*(\d{1,2})\s*m)?\s*$/i);
    const hours = duration
      ? Number(duration[1] + (duration[2] ? `.${duration[2]}` : "")) +
        Number(duration[3] || 0) / 60
      : parseLocaleNumber(hoursText);
    const rate = parseLocaleNumber(rateText);
    if (!Number.isFinite(hours) || !Number.isFinite(rate) || hours <= 0 || rate <= 0) continue;
    employees.push({ name, hours: Number(hours.toFixed(4)), rate });
  }
  return employees;
}

function parseGoogleFormResponse(text, positionedEmployees = []) {
  const lines = text.split(/\r?\n/);
  const cnpjLines = extractFormFieldLines(lines, "cnpj");
  const tradeNameLines = extractFormFieldLines(lines, "tradeName");
  const monthLines = extractFormFieldLines(lines, "month");
  const employeeLines = extractFormFieldLines(lines, "employees");
  const cnpjCandidate = (cnpjLines.join(" ").match(/(?:\d[\s()./-]*){14}/) || [""])[0];
  const cnpj = cnpjCandidate.replace(/\D/g, "");
  const employees = parseFormEmployeeRows(employeeLines);
  return {
    cnpj: hasCnpjFormat(cnpj) ? cnpj : "",
    tradeName: tradeNameLines.join(" ").replace(/\s+/g, " ").replace(/^\[.*\]$/, "").trim(),
    month: normalizeFormMonth(monthLines.join(" ").replace(/\s+/g, " ")),
    employees: employees.length ? employees : positionedEmployees,
  };
}

function formatHours(value) {
  return `${decimalFormatter.format(value)} h`;
}

function makeInput({ label, placeholder, type = "text", min, step, required = false }) {
  const input = document.createElement("input");
  input.className = "entry-input";
  input.type = type;
  input.setAttribute("aria-label", label);
  input.placeholder = placeholder;
  if (min !== undefined) input.min = String(min);
  if (step !== undefined) input.step = String(step);
  input.required = required;
  if (type === "number") input.inputMode = "decimal";
  return input;
}

function addEntry(values = {}, { focus = true, recalculate = true } = {}) {
  const row = document.createElement("tr");
  if (values.source === "document") {
    row.classList.add("auto-entry-row");
    row.title = "Dados extraídos do documento; confira o registro antes de exportar.";
  }
  if (values.needsReview) {
    row.classList.add("needs-review-row");
    row.title = "Leitura incerta: revise e complete este registro antes de exportar.";
  }
  if (values.holidayReview) {
    row.classList.add("holiday-review-row");
    row.title = "Confirme se houve folga compensatória antes de aplicar o adicional de 100%.";
  }
  const fields = [
    {
      key: "condominium",
      label: "Condomínio",
      placeholder: "Nome do condomínio",
      type: "text",
    },
    {
      key: "employee",
      label: "Funcionário",
      placeholder: "Nome completo",
      type: "text",
      required: true,
    },
    {
      key: "observation",
      label: "Registro / contexto da folha",
      placeholder: "Registro original",
      type: "text",
    },
    {
      key: "hours",
      label: "Horas extras",
      placeholder: "0,00",
      type: "number",
      min: 0.01,
      step: 0.01,
      required: true,
    },
    {
      key: "baseRate",
      label: "Valor-hora base em reais",
      placeholder: "0,00",
      type: "number",
      min: 0.01,
      step: 0.01,
      required: true,
    },
    {
      key: "premium",
      label: "Adicional percentual",
      placeholder: "50",
      type: "number",
      min: 0,
      step: 0.01,
      required: true,
    },
  ];

  for (const field of fields) {
    const cell = document.createElement("td");
    const input = makeInput(field);
    input.dataset.field = field.key;
    if (values[field.key] !== undefined) input.value = String(values[field.key]);
    cell.append(input);
    row.append(cell);
  }

  const overtimeRateCell = document.createElement("td");
  overtimeRateCell.className = "calculated-cell";
  overtimeRateCell.dataset.output = "overtime-rate";
  overtimeRateCell.textContent = "—";
  row.append(overtimeRateCell);

  const paymentCell = document.createElement("td");
  paymentCell.className = "calculated-cell pay-cell";
  paymentCell.dataset.output = "payment";
  paymentCell.textContent = "—";
  row.append(paymentCell);

  const actionCell = document.createElement("td");
  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-row";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", "Remover funcionário");
  deleteButton.title = "Remover lançamento";
  deleteButton.textContent = "×";
  actionCell.append(deleteButton);
  row.append(actionCell);

  entriesBody.append(row);
  emptyEntries.hidden = true;
  if (focus) row.querySelector('[data-field="employee"]').focus();
  if (recalculate) updateTotals();
  return row;
}

function calculateEntry(row) {
  const hours = row.querySelector('[data-field="hours"]').valueAsNumber;
  const baseRate = row.querySelector('[data-field="baseRate"]').valueAsNumber;
  const premium = row.querySelector('[data-field="premium"]').valueAsNumber;
  if (!Number.isFinite(hours) || hours <= 0) {
    row.querySelector('[data-output="overtime-rate"]').textContent = "—";
    row.querySelector('[data-output="payment"]').textContent = "—";
    return null;
  }
  if (!Number.isFinite(baseRate) || baseRate <= 0 || !Number.isFinite(premium) || premium < 0) {
    row.querySelector('[data-output="overtime-rate"]').textContent = "—";
    row.querySelector('[data-output="payment"]').textContent = "—";
    return { hours, paymentCents: null };
  }

  const overtimeRateCents = Math.round(baseRate * 100 * (1 + premium / 100));
  const paymentCents = Math.round(hours * overtimeRateCents);
  row.querySelector('[data-output="overtime-rate"]').textContent = currencyFormatter.format(
    overtimeRateCents / 100,
  );
  row.querySelector('[data-output="payment"]').textContent = currencyFormatter.format(
    paymentCents / 100,
  );

  return { hours, overtimeRateCents, paymentCents };
}

function updateTotals() {
  const rows = Array.from(entriesBody.querySelectorAll("tr:not(.validation-row)"));
  let totalHours = 0;
  let totalPaymentCents = 0;
  const employees = new Set();
  let allRowsComplete = rows.length > 0;

  for (const row of rows) {
    const result = calculateEntry(row);
    const employee = row.querySelector('[data-field="employee"]').value.trim();
    const baseRate = row.querySelector('[data-field="baseRate"]').valueAsNumber;
    const premium = row.querySelector('[data-field="premium"]').valueAsNumber;
    if (
      !employee ||
      !Number.isFinite(baseRate) ||
      baseRate <= 0 ||
      !Number.isFinite(premium) ||
      premium < 0 ||
      !result
    ) {
      allRowsComplete = false;
    }
    if (employee) employees.add(employee.toLocaleLowerCase("pt-BR"));
    if (!result) continue;
    totalHours += result.hours;
    if (Number.isFinite(result.paymentCents)) totalPaymentCents += result.paymentCents;
  }

  employeeCount.textContent = String(employees.size);
  hoursTotal.textContent = formatHours(totalHours);
  payTotal.textContent = currencyFormatter.format(totalPaymentCents / 100);
  emptyEntries.hidden = rows.length > 0;
  exportButton.disabled = !allRowsComplete;
  if (rows.length && !allRowsComplete) {
    setExportStatus("Preencha o valor-hora base e complete os campos marcados REVISAR para liberar a exportação.");
  } else if (allRowsComplete) {
    setExportStatus("");
  } else {
    setExportStatus("");
  }
}

function addDocumentResult({ fileName, pageNumber, method, text, confidence, error }) {
  const details = document.createElement("details");
  details.className = "document-card";
  if (Number.isFinite(confidence) && confidence < 70) {
    details.dataset.lowConfidence = "true";
  }

  const summary = document.createElement("summary");
  const pageTitle = document.createElement("span");
  pageTitle.textContent = `${fileName} · página ${pageNumber}`;
  const methodBadge = document.createElement("span");
  methodBadge.className = "method-badge";
  methodBadge.textContent = error
    ? "falha na leitura"
    : Number.isFinite(confidence)
      ? `${method} · ${confidence}% de confiança`
      : method;
  summary.append(pageTitle, methodBadge);

  const pre = document.createElement("pre");
  pre.className = "document-text";
  pre.textContent = error
    ? `Não foi possível ler esta página: ${error}`
    : [
        Number.isFinite(confidence) && confidence < 70
          ? "Confiança baixa: confira esta transcrição com atenção no documento original."
          : "",
        text.trim() || "Nenhum texto foi reconhecido nesta página.",
      ]
        .filter(Boolean)
        .join("\n\n");
  details.append(summary, pre);
  documentResults.append(details);
}

function normalizeForMatching(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function containsApproximateWord(line, target, maxDistance = 2) {
  const words = normalizeForMatching(line).match(/[a-z]+/g) || [];
  return words.some((word) => word === target || editDistance(word, target) <= maxDistance);
}

function findEmployeeHeader(line) {
  const normalized = normalizeForMatching(line);
  if (/[:/%/£§~^]/.test(normalized) || /[^\p{L}\p{M}\d\s,.'’-]/u.test(line)) return "";
  if (/\d/.test(normalized) && !/\p{L}\d|\d\p{L}/u.test(line)) return "";
  const looksLikeEvent =
    /,/.test(line) &&
    ["dias", "plantao", "feriado"].some((word) => containsApproximateWord(line, word, 3));
  if (looksLikeEvent) return "";

  const words = line.match(/[\p{L}\d]+/gu) || [];
  const ignoredWords = new Set([
    "a", "adicional", "as", "da", "das", "de", "dia", "dias", "do", "dos", "e", "colaborador",
    "empregado", "extra", "feriado", "folha", "funcionario", "hora", "horas", "mes", "nome",
    "normal", "ponto", "plantao", "trabalho",
  ]);
  const nameWords = words.filter((word) => {
    const normalizedWord = normalizeForMatching(word);
    return (
      !ignoredWords.has(normalizedWord) &&
      !["dias", "plantao", "feriado"].some((descriptor) =>
        editDistance(normalizedWord, descriptor) <= 1,
      )
    );
  });
  if (nameWords.length < 2 || nameWords.length > 6) return "";
  if (/\b(?:dias?|plant[aã]o|feriado)\b/i.test(normalized)) return "";
  return line.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

function findTimeRange(line) {
  const normalized = normalizeForMatching(line);
  const matches = Array.from(normalized.matchAll(/\b(\d{1,2})\s*[:.]\s*(\d{2})\b/g));
  if (matches.length < 2) return null;
  const [, startHour, startMinute] = matches[0];
  const [, endHour, endMinute] = matches[1];
  const start = Number(startHour) * 60 + Number(startMinute);
  const end = Number(endHour) * 60 + Number(endMinute);
  if (
    Number(startHour) > 23 ||
    Number(startMinute) > 59 ||
    Number(endHour) > 23 ||
    Number(endMinute) > 59
  ) {
    return null;
  }
  return { start, end };
}

function parseScheduleEvent(line) {
  const normalized = normalizeForMatching(line);
  const timeRange = findTimeRange(line);
  const isHoliday =
    /\b(?:feriado|domingo)\b/.test(normalized) ||
    containsApproximateWord(line, "feriado") ||
    containsApproximateWord(line, "domingo");
  const isPlantao = /\bplantao\b/.test(normalized) || containsApproximateWord(line, "plantao", 3);
  const hasDayLabel =
    /\bdias?\b/.test(normalized) ||
    (!/\bdas\b/.test(normalized) && /\d/.test(normalized) && containsApproximateWord(line, "dias"));
  const startsWithDate = /^\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(normalized);
  if (startsWithDate) return null;

  const hasEventCue = isHoliday || isPlantao || hasDayLabel;
  const hasTimeLikeText = /\d{1,2}\s*[:.]\s*\d{2}/.test(normalized);
  if (!hasEventCue && !timeRange && !hasTimeLikeText) return null;

  const exactCount = normalized.match(/\b(\d{1,3})\s*[,;:]?\s*(?:dias?|plantao|feriados?|vezes?)\b/);
  const leadingCount = normalized.match(/^\s*(\d{1,3})\s*[a-z]?\b/);
  const parsedCount = exactCount ? Number(exactCount[1]) : leadingCount ? Number(leadingCount[1]) : 1;
  const countIsPlausible = parsedCount >= 1 && parsedCount <= 31;
  const count = countIsPlausible ? parsedCount : 1;
  const needsReview =
    (!timeRange && !isHoliday) ||
    (!exactCount && hasEventCue) ||
    !countIsPlausible ||
    (isHoliday && !/\b(?:feriado|domingo)\b/.test(normalized)) ||
    (isPlantao && !/\bplantao\b/.test(normalized)) ||
    (hasDayLabel && !/\bdias?\b/.test(normalized));

  return {
    count,
    kind: isHoliday ? "holiday" : isPlantao ? "plantao" : "regular",
    timeRange,
    needsReview,
  };
}

function getEventOvertimeBuckets(event, timeRange) {
  let duration = timeRange.end - timeRange.start;
  if (duration <= 0) duration += 24 * 60;
  if (duration > 24 * 60) return new Map();

  const breakStart = duration > 6 * 60 ? 6 * 60 : -1;
  const breakEnd = breakStart < 0 ? -1 : breakStart + 60;
  const buckets = new Map();
  let workedMinutes = 0;

  for (let elapsed = 0; elapsed < duration; elapsed += 1) {
    if (breakStart >= 0 && elapsed >= breakStart && elapsed < breakEnd) continue;
    workedMinutes += 1;
    if (event.kind !== "holiday" && workedMinutes <= 8 * 60) continue;

    const clockMinute = (timeRange.start + elapsed) % (24 * 60);
    const isNight = clockMinute >= 22 * 60 || clockMinute < 5 * 60;
    const premium = event.kind === "holiday" ? 100 : 50;
    const premiumWithNight = premium + (isNight ? 20 : 0);
    buckets.set(premiumWithNight, (buckets.get(premiumWithNight) || 0) + 1);
  }

  return new Map(
    Array.from(buckets, ([premium, minutes]) => [premium, (minutes * event.count) / 60]),
  );
}

function formatEventLabel(kind, premium) {
  if (kind === "holiday") return premium >= 120 ? "Feriado · noturno" : "Feriado";
  if (premium >= 70) {
    return kind === "plantao" ? "Plantão · hora extra noturna" : "Hora extra · noturna";
  }
  return kind === "plantao" ? "Plantão · hora extra" : "Hora extra";
}

function getPdfTextInReadingOrder(textContent) {
  const items = textContent.items.filter(
    (item) => "str" in item && item.str.trim() && Array.isArray(item.transform),
  );
  if (items.length === 0) {
    return textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ").trim();
  }

  const lines = [];
  for (const item of items) {
    const y = item.transform[5];
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 3);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) =>
      line.items
        .sort((left, right) => left.transform[4] - right.transform[4])
        .map((item) => item.str.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n");
}

function importScheduleEntries(pages, fileName) {
  let currentEmployee = "";
  let normalSchedule = null;
  let periodContext = "";
  let importedCount = 0;

  for (const page of pages) {
    for (const line of page.text.split(/\r?\n/)) {
      if (/\b(?:mes|competencia|periodo)\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i.test(line)) {
        periodContext = line.trim();
      }
      const employeeHeader = findEmployeeHeader(line);
      if (employeeHeader) {
        currentEmployee = employeeHeader;
        normalSchedule = null;
        continue;
      }

      if (!currentEmployee) continue;
      const event = parseScheduleEvent(line);
      if (!event) continue;

      const needsReview = event.needsReview || (Number.isFinite(page.confidence) && page.confidence < 55);
      const observation = [
        event.kind === "holiday" ? "FERIADO · CONFIRMAR FOLGA COMPENSATÓRIA" : "",
        event.needsReview || (Number.isFinite(page.confidence) && page.confidence < 55) ? "REVISAR" : "",
        periodContext,
        line.trim(),
        `${fileName}, p. ${page.pageNumber}`,
      ]
        .filter(Boolean)
        .join(" · ");
      if (needsReview) {
        const row = addEntry(
          {
            employee: currentEmployee,
            observation,
            premium: event.kind === "holiday" ? 100 : 50,
            source: "document",
            needsReview: true,
            holidayReview: event.kind === "holiday",
          },
          { focus: false, recalculate: false },
        );
        documentEntryRows.push(row);
        importedCount += 1;
        continue;
      }
      if (event.kind === "holiday" && !event.timeRange) {
        event.timeRange = normalSchedule || { start: 8 * 60, end: 17 * 60 };
      } else if (event.kind === "regular" && event.timeRange) {
        normalSchedule = event.timeRange;
      }
      if (!event.timeRange) continue;

      const buckets = getEventOvertimeBuckets(event, event.timeRange);
      for (const [premium, hours] of buckets) {
        if (hours <= 0) continue;
        const row = addEntry(
          {
            employee: currentEmployee,
            observation: [
              event.kind === "holiday" ? "FERIADO · CONFIRMAR FOLGA COMPENSATÓRIA" : "",
              formatEventLabel(event.kind, premium),
              periodContext,
              line.trim(),
              `${fileName}, p. ${page.pageNumber}`,
            ]
              .filter(Boolean)
              .join(" · "),
            hours: Number(hours.toFixed(2)),
            premium,
            source: "document",
            holidayReview: event.kind === "holiday",
          },
            { focus: false, recalculate: false },
        );
        documentEntryRows.push(row);
        importedCount += 1;
      }
    }
  }
  if (importedCount) updateTotals();
  return importedCount;
}

function cropPageContent(sourceCanvas) {
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return sourceCanvas;
  const { width, height } = sourceCanvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      if (brightness >= 150) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right <= left || bottom <= top) return sourceCanvas;
  const margin = 30;
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(width, right + margin);
  bottom = Math.min(height, bottom + margin);

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = right - left;
  croppedCanvas.height = bottom - top;
  const croppedContext = croppedCanvas.getContext("2d", { alpha: false });
  if (!croppedContext) return sourceCanvas;
  croppedContext.drawImage(
    sourceCanvas,
    left,
    top,
    croppedCanvas.width,
    croppedCanvas.height,
    0,
    0,
    croppedCanvas.width,
    croppedCanvas.height,
  );
  return croppedCanvas;
}

function enhancePageImage(sourceCanvas) {
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Não foi possível melhorar a imagem da página.");

  const { width, height } = sourceCanvas;
  const imageData = sourceContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const histogram = new Uint32Array(256);
  const grayscale = new Uint8Array(width * height);

  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    const gray = Math.round(
      0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2],
    );
    grayscale[pixel] = gray;
    histogram[gray] += 1;
  }

  const percentileValue = (percentile) => {
    const target = Math.floor(grayscale.length * percentile);
    let count = 0;
    for (let value = 0; value < histogram.length; value += 1) {
      count += histogram[value];
      if (count >= target) return value;
    }
    return 255;
  };
  const low = percentileValue(0.02);
  const high = percentileValue(0.98);
  const contrastRange = Math.max(1, high - low);

  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    const enhanced = Math.round(((grayscale[pixel] - low) * 255) / contrastRange);
    const value = Math.max(0, Math.min(255, enhanced));
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
  }

  const contrastCanvas = document.createElement("canvas");
  contrastCanvas.width = width;
  contrastCanvas.height = height;
  const contrastContext = contrastCanvas.getContext("2d", { willReadFrequently: true });
  if (!contrastContext) throw new Error("Não foi possível preparar a imagem para o OCR.");
  contrastContext.putImageData(imageData, 0, 0);

  return contrastCanvas;
}

function brightenPageImage(sourceCanvas) {
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Não foi possível aumentar o brilho da página.");

  const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const pixels = imageData.data;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const gray = Math.round(
      0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2],
    );
    const value = Math.min(255, gray + 28);
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
  }

  const brightCanvas = document.createElement("canvas");
  brightCanvas.width = sourceCanvas.width;
  brightCanvas.height = sourceCanvas.height;
  const brightContext = brightCanvas.getContext("2d");
  if (!brightContext) throw new Error("Não foi possível preparar a imagem mais clara para o OCR.");
  brightContext.putImageData(imageData, 0, 0);
  return brightCanvas;
}

function createAdaptiveThresholdCanvas(sourceCanvas) {
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Não foi possível remover o fundo da imagem.");
  const { width, height } = sourceCanvas;
  const pixels = sourceContext.getImageData(0, 0, width, height).data;
  const grayscale = new Uint8Array(width * height);
  for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
    grayscale[pixel] = Math.round(
      0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2],
    );
  }

  const stride = width + 1;
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowTotal = 0;
    for (let x = 1; x <= width; x += 1) {
      rowTotal += grayscale[(y - 1) * width + (x - 1)];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowTotal;
    }
  }

  const thresholdCanvas = document.createElement("canvas");
  thresholdCanvas.width = width;
  thresholdCanvas.height = height;
  const thresholdContext = thresholdCanvas.getContext("2d");
  if (!thresholdContext) throw new Error("Não foi possível preparar a imagem para o OCR.");
  const thresholdImage = thresholdContext.createImageData(width, height);
  const radius = Math.max(8, Math.round(Math.min(width, height) / 80));
  const thresholdBias = 10;

  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const area = (right - left) * (bottom - top);
      const sum =
        integral[bottom * stride + right] -
        integral[top * stride + right] -
        integral[bottom * stride + left] +
        integral[top * stride + left];
      const localThreshold = sum / area - thresholdBias;
      const gray = grayscale[y * width + x];
      const value = gray < localThreshold ? 0 : 255;
      const offset = (y * width + x) * 4;
      thresholdImage.data[offset] = value;
      thresholdImage.data[offset + 1] = value;
      thresholdImage.data[offset + 2] = value;
      thresholdImage.data[offset + 3] = 255;
    }
  }
  thresholdContext.putImageData(thresholdImage, 0, 0);

  return thresholdCanvas;
}

function rotateCanvas(sourceCanvas, degrees) {
  if (degrees === 0) return sourceCanvas;
  const sideways = degrees === 90 || degrees === 270;
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = sideways ? sourceCanvas.height : sourceCanvas.width;
  rotatedCanvas.height = sideways ? sourceCanvas.width : sourceCanvas.height;
  const context = rotatedCanvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Não foi possível ajustar a orientação da página.");
  context.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return rotatedCanvas;
}

async function recognizeAtRotation(worker, sourceCanvas, degrees, pageSegmentationMode) {
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: pageSegmentationMode,
  });
  const rotatedCanvas = rotateCanvas(sourceCanvas, degrees);
  try {
    return await worker.recognize(rotatedCanvas);
  } finally {
    if (rotatedCanvas !== sourceCanvas) {
      rotatedCanvas.width = 0;
      rotatedCanvas.height = 0;
    }
  }
}

function scoreOcrResult(result) {
  const text = result.data.text;
  const lowerText = text.toLocaleLowerCase("pt-BR");
  const hoursCount = (
    text.match(/\b\d{1,2}\s*[:h]\s*\d{2}\b|\b\d{1,2}[,.]\d{1,2}\s*(?:h|horas?)\b/gi) || []
  ).length;
  const percentageCount = (text.match(/\b\d{1,3}\s*%/g) || []).length;
  const hasEmployeeLabel =
    /\b(funcion[aá]rios?|empregados?|colaboradores?|nome|matr[ií]cula)\b/i.test(lowerText);
  const hasPremiumContext = /\b(adicional|percentual|extra|he\s*[12]00)\b/i.test(lowerText);
  const letterCount = (text.match(/\p{L}/gu) || []).length;
  const textCoverage = Math.min(letterCount / 250, 1);

  return (
    result.data.confidence +
    Math.min(hoursCount, 5) * 2 +
    Math.min(percentageCount, 3) * 2 +
    (hasEmployeeLabel ? 3 : 0) +
    (hasPremiumContext ? 3 : 0) +
    textCoverage
  );
}

async function recognizePage(worker, sourceCanvas, updateStatus) {
  const variants = [];
  const layouts = [
    { mode: "6", label: "linhas horizontais" },
    { mode: "11", label: "texto disperso" },
  ];
  let bestCandidate;
  try {
    variants.push({ canvas: brightenPageImage(sourceCanvas), label: "brilho reforçado" });
    variants.push({ canvas: enhancePageImage(sourceCanvas), label: "contraste reforçado" });
    variants.push({ canvas: createAdaptiveThresholdCanvas(sourceCanvas), label: "remoção de fundo" });
    const totalChecks = variants.length * layouts.length;
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      const variant = variants[variantIndex];
      for (let layoutIndex = 0; layoutIndex < layouts.length; layoutIndex += 1) {
        const layout = layouts[layoutIndex];
        const checkNumber = variantIndex * layouts.length + layoutIndex + 1;
        updateStatus(
          `OCR: conferência ${checkNumber} de ${totalChecks} · ${layout.label} · ${variant.label}…`,
        );
        const result = await recognizeAtRotation(worker, variant.canvas, 0, layout.mode);
        const candidate = {
          result,
          canvas: variant.canvas,
          rotation: 0,
          label: variant.label,
          layout: layout.label,
          pageSegmentationMode: layout.mode,
          score: scoreOcrResult(result),
        };
        if (!bestCandidate || candidate.score > bestCandidate.score) {
          bestCandidate = candidate;
        }
      }
    }

    if (bestCandidate.result.data.confidence < 80) {
      const upsideDownResult = await recognizeAtRotation(
        worker,
        bestCandidate.canvas,
        180,
        bestCandidate.pageSegmentationMode,
      );
      const upsideDownCandidate = {
        ...bestCandidate,
        result: upsideDownResult,
        rotation: 180,
        score: scoreOcrResult(upsideDownResult),
      };
      if (upsideDownCandidate.score > bestCandidate.score) {
        bestCandidate = upsideDownCandidate;
      }
    }

    if (bestCandidate.result.data.confidence < 55) {
      for (const rotation of [90, 270]) {
        const result = await recognizeAtRotation(
          worker,
          bestCandidate.canvas,
          rotation,
          bestCandidate.pageSegmentationMode,
        );
        const candidate = {
          ...bestCandidate,
          result,
          rotation,
          score: scoreOcrResult(result),
        };
        if (candidate.score > bestCandidate.score) {
          bestCandidate = candidate;
        }
      }
    }

    return {
      text: bestCandidate.result.data.text,
      confidence: Math.round(bestCandidate.result.data.confidence),
      rotation: bestCandidate.rotation,
      processing: `${bestCandidate.layout} · ${bestCandidate.label} · ${totalChecks} conferências`,
    };
  } finally {
    for (const variant of variants) {
      variant.canvas.width = 0;
      variant.canvas.height = 0;
    }
  }
}

async function readFormResponsePdf() {
  if (isReadingResponse || !selectedResponsePdf) return;
  if (selectedResponsePdf.type !== "application/pdf" && !selectedResponsePdf.name.toLowerCase().endsWith(".pdf")) {
    setResponseStatus("Selecione um arquivo PDF.", "error");
    return;
  }
  if (selectedResponsePdf.size > 25 * 1024 * 1024) {
    setResponseStatus("O PDF excede o limite de 25 MB.", "error");
    return;
  }
  if (typeof pdfjsLib === "undefined") {
    setResponseStatus("A biblioteca de leitura de PDF não carregou. Verifique sua conexão e recarregue a página.", "error");
    return;
  }

  isReadingResponse = true;
  readResponseButton.disabled = true;
  clearResponseButton.disabled = true;
  responsePdfInput.disabled = true;
  let worker;
  let pdf;
  const pageTexts = [];
  const positionedEmployees = [];
  let usedOcr = false;

  try {
    setResponseStatus("Abrindo a resposta do Google Forms…");
    pdf = await pdfjsLib.getDocument({ data: await selectedResponsePdf.arrayBuffer() }).promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      setResponseStatus(`Lendo a resposta: página ${pageNumber} de ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const embeddedText = getPdfTextInReadingOrder(textContent);
      positionedEmployees.push(...parsePositionedEmployeeRows(textContent));
      if (embeddedText.replace(/\s/g, "").length >= 20) {
        pageTexts.push(embeddedText);
        continue;
      }

      usedOcr = true;
      if (typeof Tesseract === "undefined") {
        throw new Error("A biblioteca de OCR não carregou. Verifique sua conexão e recarregue a página.");
      }
      if (!worker) {
        setResponseStatus("Carregando o OCR em português pela primeira vez…");
        worker = await Tesseract.createWorker("por", 1, {
          logger: (message) => {
            if (message.status === "recognizing text" && message.progress > 0) {
              setResponseStatus(`OCR da resposta: ${Math.round(message.progress * 100)}% da página atual…`);
            }
          },
        });
      }

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      if (!context) throw new Error("Não foi possível preparar a página da resposta para leitura.");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await recognizePage(worker, canvas, setResponseStatus);
      pageTexts.push(result.text);
      canvas.width = 0;
      canvas.height = 0;
    }

    const fields = parseGoogleFormResponse(pageTexts.join("\n"), positionedEmployees);
    responseCnpj.value = fields.cnpj;
    responseTradeName.value = fields.tradeName;
    responseMonth.value = fields.month;
    responseEmployees.replaceChildren();
    fields.employees.forEach((employee) => addResponseEmployee(employee));
    responseEditor.hidden = false;
    clearResponseButton.disabled = false;

    const missing = [];
    if (!fields.cnpj) missing.push("CNPJ");
    if (!fields.tradeName) missing.push("nome fantasia");
    if (!fields.month) missing.push("mês de referência");
    if (!fields.employees.length) missing.push("linhas de funcionários no formato esperado");
    const method = usedOcr ? "PDF lido com OCR em português" : "texto do PDF extraído";
    setResponseStatus(
      missing.length
        ? `${method}; confira a extração e preencha os campos não identificados: ${missing.join(", ")}.`
        : !isValidCnpj(fields.cnpj)
          ? `${method}. O CNPJ foi extraído, mas os dígitos verificadores não conferem; confirme-o com o documento antes de gerar o relatório.`
          : `${method}. Revise todos os campos antes de gerar o relatório.`,
      missing.length ? "error" : "success",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setResponseStatus(`Não foi possível ler a resposta: ${message}`, "error");
  } finally {
    if (worker) await worker.terminate();
    if (pdf) await pdf.destroy();
    isReadingResponse = false;
    readResponseButton.disabled = !selectedResponsePdf;
    clearResponseButton.disabled = !responseEditor.hidden ? false : !selectedResponsePdf;
    responsePdfInput.disabled = false;
  }
}

function getResponseReportData() {
  const cnpj = responseCnpj.value.replace(/\D/g, "");
  const tradeName = responseTradeName.value.trim();
  const month = responseMonth.value;
  const rows = Array.from(responseEmployees.querySelectorAll("tr"));
  const employees = [];
  const errors = [];

  if (!hasCnpjFormat(cnpj)) errors.push("informe um CNPJ com 14 dígitos");
  if (!tradeName) errors.push("informe o nome fantasia");
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) errors.push("informe o mês de referência");
  if (!rows.length) errors.push("adicione ao menos um funcionário");

  rows.forEach((row, index) => {
    const name = row.querySelector(".response-employee-name").value.trim();
    const hours = row.querySelector(".response-hours-input").valueAsNumber;
    const rate = row.querySelector(".response-rate-input").valueAsNumber;
    if (!name) errors.push(`informe o nome do funcionário ${index + 1}`);
    if (!Number.isFinite(hours) || hours <= 0) errors.push(`informe horas extras válidas para o funcionário ${index + 1}`);
    if (!Number.isFinite(rate) || rate <= 0) errors.push(`informe um valor por hora válido para o funcionário ${index + 1}`);
    if (name && Number.isFinite(hours) && hours > 0 && Number.isFinite(rate) && rate > 0) {
      const rateCents = Math.round(rate * 100);
      employees.push({
        name,
        hours,
        rateCents,
        totalCents: Math.round(hours * rateCents),
        source: row.dataset.source || "",
      });
    }
  });
  return { cnpj, tradeName, month, employees, errors };
}

function buildResponseReport(data) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("A biblioteca de geração de PDF não carregou. Verifique sua conexão e recarregue a página.");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const columns = [
    { x: margin, width: 75, title: "Funcionário" },
    { x: margin + 75, width: 28, title: "Horas extras" },
    { x: margin + 103, width: 34, title: "Valor/hora" },
    { x: margin + 137, width: 44, title: "Total" },
  ];
  const formatMoney = (cents) => currencyFormatter.format(cents / 100);
  const [year, monthNumber] = data.month.split("-");
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(Number(year), Number(monthNumber) - 1, 1),
  );

  pdf.setFillColor(8, 126, 104);
  pdf.rect(0, 0, pageWidth, 34, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Relatório de horas extras", margin, 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Informações declaradas pelo cliente", margin, 25);
  pdf.setTextColor(21, 43, 40);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Empresa", margin, 46);
  pdf.setFont("helvetica", "normal");
  pdf.text(data.tradeName, margin, 53);
  pdf.text(`CNPJ: ${data.cnpj}`, margin, 60);
  pdf.text(`Mês de referência: ${monthLabel}`, margin, 67);

  const drawTableHeader = (y) => {
    pdf.setFillColor(230, 244, 239);
    pdf.rect(margin, y - 6, pageWidth - margin * 2, 10, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(21, 43, 40);
    for (const column of columns) pdf.text(column.title, column.x + 2, y);
    pdf.setFont("helvetica", "normal");
  };

  let y = 84;
  drawTableHeader(y);
  y += 9;
  pdf.setFontSize(9);
  pdf.setTextColor(35, 53, 49);
  for (const employee of data.employees) {
    const nameLines = pdf.splitTextToSize(employee.name, columns[0].width - 4);
    const nameLineCount = nameLines.length + (employee.source === "manual" ? 1 : 0);
    const rowHeight = Math.max(9, nameLineCount * 4.5 + 3);
    if (y + rowHeight > pageHeight - 28) {
      pdf.addPage();
      y = 20;
      drawTableHeader(y);
      y += 9;
    }
    pdf.text(nameLines, columns[0].x + 2, y);
    if (employee.source === "manual") {
      pdf.setFontSize(7);
      pdf.setTextColor(101, 119, 116);
      pdf.text("Adicionado manualmente", columns[0].x + 2, y + nameLines.length * 4.5);
      pdf.setFontSize(9);
      pdf.setTextColor(35, 53, 49);
    }
    pdf.text(decimalFormatter.format(employee.hours), columns[1].x + 2, y);
    pdf.text(formatMoney(employee.rateCents), columns[2].x + 2, y);
    pdf.text(formatMoney(employee.totalCents), columns[3].x + 2, y);
    y += rowHeight;
    pdf.setDrawColor(225, 233, 230);
    pdf.line(margin, y - 2, pageWidth - margin, y - 2);
  }

  const totalHours = data.employees.reduce((sum, employee) => sum + employee.hours, 0);
  const totalCents = data.employees.reduce((sum, employee) => sum + employee.totalCents, 0);
  if (y + 24 > pageHeight - 28) {
    pdf.addPage();
    y = 20;
  }
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.text("Total", columns[0].x + 2, y);
  pdf.text(decimalFormatter.format(totalHours), columns[1].x + 2, y);
  pdf.text(formatMoney(totalCents), columns[3].x + 2, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(101, 119, 116);
  const disclaimer = "Valores transcritos da resposta do cliente; confira com a folha de ponto e as regras aplicáveis antes de processar pagamentos.";
  const disclaimerLines = pdf.splitTextToSize(disclaimer, pageWidth - margin * 2);
  pdf.text(disclaimerLines, margin, Math.min(y + 12, pageHeight - 22));

  const pageCount = pdf.internal.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 145, 140);
    pdf.text(`RN · ${monthLabel}`, margin, pageHeight - 10);
    pdf.text(`${pageNumber}/${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
  return pdf;
}

function clearResponseReportPreview() {
  responseReportRenderGeneration += 1;
  preparedResponseReport = null;
  responseReportPreview.hidden = true;
  printResponseReportButton.disabled = true;
  saveResponseReportButton.disabled = true;
  responseReportPages.replaceChildren();
  if (responseReportPreviewUrl) URL.revokeObjectURL(responseReportPreviewUrl);
  responseReportPreviewUrl = "";
}

function invalidateResponseReportPreview() {
  const hadPreview = Boolean(preparedResponseReport);
  clearResponseReportPreview();
  if (hadPreview) {
    setResponseStatus("Os dados foram alterados. Gere uma nova prévia antes de imprimir ou salvar.", "warning");
  }
}

async function renderResponseReportPreview(blob) {
  const generation = ++responseReportRenderGeneration;
  let pdf;
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    pdf = await pdfjsLib.getDocument({ data }).promise;
    if (generation !== responseReportRenderGeneration) return false;

    responseReportPages.replaceChildren();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (generation !== responseReportRenderGeneration) return false;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.15 });
      const pageContainer = document.createElement("div");
      pageContainer.className = "response-report-page";
      const pageLabel = document.createElement("p");
      pageLabel.className = "response-report-page-label";
      pageLabel.textContent = `Página ${pageNumber} de ${pdf.numPages}`;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível exibir uma página da prévia.");
      await page.render({ canvasContext: context, viewport }).promise;
      if (generation !== responseReportRenderGeneration) return false;
      pageContainer.append(pageLabel, canvas);
      responseReportPages.append(pageContainer);
      page.cleanup();
    }
    printResponseReportButton.disabled = false;
    return true;
  } catch (error) {
    if (generation !== responseReportRenderGeneration) return false;
    const message = error instanceof Error ? error.message : String(error);
    saveResponseReportButton.disabled = true;
    setResponseStatus(`Não foi possível exibir a prévia do relatório PDF: ${message}`, "error");
    return false;
  } finally {
    if (pdf) await pdf.destroy();
  }
}

async function generateResponseReport() {
  const data = getResponseReportData();
  if (data.errors.length) {
    setResponseStatus(`Corrija os dados antes de gerar o relatório: ${data.errors.join("; ")}.`, "error");
    return;
  }

  generateResponseReportButton.disabled = true;
  try {
    const pdf = buildResponseReport(data);
    const fileName = `relatorio-horas-extras-${data.cnpj}-${data.month}-${Date.now()}.pdf`;
    const blob = pdf.output("blob");
    clearResponseReportPreview();
    preparedResponseReport = { blob, fileName, cnpj: data.cnpj };
    responseReportPreviewUrl = URL.createObjectURL(blob);
    responseReportPreview.hidden = false;
    saveResponseReportButton.disabled = !canSaveResponseReport();
    responseReportPreview.scrollIntoView({ behavior: "smooth", block: "start" });
    setResponseStatus("Gerando a prévia do PDF…");
    const previewRendered = await renderResponseReportPreview(blob);
    if (previewRendered && preparedResponseReport) {
      setResponseStatus("Prévia pronta. Confira o relatório antes de imprimir ou salvar.", "success");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setResponseStatus(`Não foi possível criar a prévia do relatório PDF: ${message}`, "error");
  } finally {
    generateResponseReportButton.disabled = false;
  }
}

function canSaveResponseReport() {
  return (
    location.protocol === "http:" &&
    (location.hostname === "127.0.0.1" || location.hostname === "localhost")
  );
}

function printResponseReport() {
  if (!preparedResponseReport || printResponseReportButton.disabled) return;
  const printWindow = window.open(responseReportPreviewUrl, "_blank");
  if (!printWindow) {
    setResponseStatus("O navegador bloqueou a nova aba do PDF. Permita pop-ups para abrir e imprimir o relatório.", "error");
  }
}

async function saveResponseReport() {
  if (!preparedResponseReport) return;
  const report = preparedResponseReport;
  if (!canSaveResponseReport()) {
    setResponseStatus(
      "Para salvar o relatório em destino/, abra a aplicação local em http://127.0.0.1:8765. É possível imprimir a prévia sem salvar no servidor.",
      "error",
    );
    return;
  }

  saveResponseReportButton.disabled = true;
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Filename": report.fileName,
      },
      body: report.blob,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "O servidor recusou o relatório.");
    setResponseStatus(
      `Relatório PDF salvo em ${result.file}.${isValidCnpj(report.cnpj) ? "" : " Atenção: confira os dígitos verificadores do CNPJ."}`,
      isValidCnpj(report.cnpj) ? "success" : "warning",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setResponseStatus(`Não foi possível salvar o relatório PDF: ${message}`, "error");
  } finally {
    saveResponseReportButton.disabled = !preparedResponseReport || !canSaveResponseReport();
  }
}

async function readDocuments() {
  if (isReadingDocuments || selectedPdfFiles.length === 0) return;
  isReadingDocuments = true;
  readButton.disabled = true;
  clearDocumentsButton.disabled = true;
  pdfInput.disabled = true;
  let worker;
  let processedPages = 0;
  let failedPages = 0;
  let importedRows = 0;

  try {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("A biblioteca de leitura de PDF não carregou. Verifique sua conexão e recarregue a página.");
    }
    setDocumentStatus("Abrindo os arquivos selecionados…");

    for (const file of selectedPdfFiles) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error(`“${file.name}” não é um arquivo PDF.`);
      }
      const pdfData = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const pageTexts = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setDocumentStatus(`${file.name}: página ${pageNumber} de ${pdf.numPages}`);
        const page = await pdf.getPage(pageNumber);
        let text = "";
        let method = "OCR em português";

        try {
          const textContent = await page.getTextContent();
          const embeddedText = getPdfTextInReadingOrder(textContent);

          if (embeddedText.replace(/\s/g, "").length >= 20) {
            text = embeddedText;
            method = "Texto do PDF";
          } else {
            if (typeof Tesseract === "undefined") {
              throw new Error("A biblioteca de OCR não carregou. Verifique sua conexão e recarregue a página.");
            }
            if (!worker) {
              setDocumentStatus("Carregando o OCR em português pela primeira vez…");
              worker = await Tesseract.createWorker("por", 1, {
                logger: (message) => {
                  if (message.status === "recognizing text" && message.progress > 0) {
                    setDocumentStatus(
                      `OCR em andamento: ${Math.round(message.progress * 100)}% da página atual`,
                    );
                  }
                },
              });
            }

            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
            if (!context) throw new Error("Não foi possível preparar a página para leitura.");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: context, viewport }).promise;
            const croppedCanvas = cropPageContent(canvas);
            const result = await recognizePage(worker, croppedCanvas);
            text = result.text;
            method = `OCR · rotação ${result.rotation}° · ${result.processing}`;
            addDocumentResult({
              fileName: file.name,
              pageNumber,
              method,
              text,
              confidence: result.confidence,
            });
            pageTexts.push({ pageNumber, text, confidence: result.confidence });
            canvas.width = 0;
            canvas.height = 0;
            croppedCanvas.width = 0;
            croppedCanvas.height = 0;
            processedPages += 1;
            continue;
          }

          addDocumentResult({ fileName: file.name, pageNumber, method, text });
          pageTexts.push({ pageNumber, text });
        } catch (error) {
          failedPages += 1;
          addDocumentResult({
            fileName: file.name,
            pageNumber,
            method,
            text: "",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        processedPages += 1;
      }
      importedRows += importScheduleEntries(pageTexts, file.name);
    }

    const importedMessage = importedRows
      ? ` ${importedRows} lançamentos foram colocados na tabela; preencha o valor-hora base e corrija os campos marcados REVISAR.`
      : " Nenhum lançamento identificável foi preenchido automaticamente; confira as transcrições.";
    const resultMessage = failedPages
      ? `Leitura concluída: ${processedPages} páginas, ${failedPages} com erro. Confira as páginas sinalizadas.${importedMessage}`
      : `Leitura concluída: ${processedPages} páginas prontas para conferência.${importedMessage}`;
    setDocumentStatus(resultMessage, failedPages ? "error" : "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDocumentStatus(`Não foi possível concluir a leitura: ${message}`, "error");
  } finally {
    if (worker) await worker.terminate();
    isReadingDocuments = false;
    readButton.disabled = selectedPdfFiles.length === 0;
    clearDocumentsButton.disabled = documentResults.childElementCount === 0;
    pdfInput.disabled = false;
  }
}

function clearDocuments() {
  if (isReadingDocuments) return;
  documentResults.replaceChildren();
  for (const row of documentEntryRows) row.remove();
  documentEntryRows = [];
  selectedPdfFiles = [];
  pdfInput.value = "";
  selectedFiles.textContent = "Nenhum arquivo selecionado";
  setDocumentStatus("");
  readButton.disabled = true;
  clearDocumentsButton.disabled = true;
  updateTotals();
}

function getValidEntries() {
  entriesBody.querySelectorAll(".validation-row").forEach((row) => row.remove());
  const rows = Array.from(entriesBody.querySelectorAll("tr:not(.validation-row)"));
  const entries = [];
  const errors = [];

  rows.forEach((row, index) => {
    const employee = row.querySelector('[data-field="employee"]');
    const hoursInput = row.querySelector('[data-field="hours"]');
    const baseRateInput = row.querySelector('[data-field="baseRate"]');
    const premiumInput = row.querySelector('[data-field="premium"]');
    const hours = hoursInput.valueAsNumber;
    const baseRate = baseRateInput.valueAsNumber;
    const premium = premiumInput.valueAsNumber;
    const missing = [];

    if (!employee.value.trim()) missing.push("nome do funcionário");
    if (!Number.isFinite(hours) || hours <= 0) missing.push("horas extras maiores que zero");
    if (!Number.isFinite(baseRate) || baseRate <= 0) missing.push("valor-hora base maior que zero");
    if (!Number.isFinite(premium) || premium < 0) missing.push("adicional igual ou maior que zero");

    const previousError = row.querySelector(".row-error");
    if (previousError) previousError.remove();

    if (missing.length) {
      const errorCell = document.createElement("td");
      errorCell.colSpan = 9;
      const errorMessage = document.createElement("p");
      errorMessage.className = "row-error";
      errorMessage.textContent = `Lançamento ${index + 1}: informe ${missing.join(", ")}.`;
      errorCell.append(errorMessage);
      const errorRow = document.createElement("tr");
      errorRow.className = "validation-row";
      errorRow.append(errorCell);
      row.after(errorRow);
      errors.push(errorMessage.textContent);
      return;
    }

    entries.push({
      condominium: row.querySelector('[data-field="condominium"]').value.trim(),
      employee: employee.value.trim(),
      observation: row.querySelector('[data-field="observation"]').value.trim(),
      hours,
      baseRate,
      premium,
      overtimeRateCents: Math.round(baseRate * 100 * (1 + premium / 100)),
      paymentCents: Math.round(hours * Math.round(baseRate * 100 * (1 + premium / 100))),
    });
  });

  return { entries, errors };
}

async function exportWorkbook() {
  const { entries, errors } = getValidEntries();
  if (errors.length) {
    window.alert(`Corrija os lançamentos incompletos antes de exportar:\n\n${errors.join("\n")}`);
    return;
  }
  if (entries.length === 0) {
    window.alert("Adicione ao menos um lançamento completo antes de exportar.");
    return;
  }
  if (typeof XLSX === "undefined") {
    setDocumentStatus("Não foi possível carregar a biblioteca de Excel. Verifique sua conexão e recarregue a página.", "error");
    return;
  }

  const detailRows = [
    [
      "Condomínio",
      "Funcionário",
      "Registro / contexto da folha",
      "Horas extras",
      "Valor-hora base (R$)",
      "Adicional (%)",
      "Valor da hora extra (R$)",
      "Total a pagar (R$)",
    ],
  ];
  const summaryByEmployee = new Map();

  for (const entry of entries) {
    detailRows.push([
      entry.condominium,
      entry.employee,
      entry.observation,
      entry.hours,
      entry.baseRate,
      entry.premium,
      entry.overtimeRateCents / 100,
      entry.paymentCents / 100,
    ]);
    const key = entry.employee.toLocaleLowerCase("pt-BR");
    const summary = summaryByEmployee.get(key) || {
      employee: entry.employee,
      hours: 0,
      paymentCents: 0,
    };
    summary.hours += entry.hours;
    summary.paymentCents += entry.paymentCents;
    summaryByEmployee.set(key, summary);
  }

  const totalHours = entries.reduce((total, entry) => total + entry.hours, 0);
  const totalPaymentCents = entries.reduce((total, entry) => total + entry.paymentCents, 0);
  detailRows.push(["", "TOTAL", "", totalHours, "", "", "", totalPaymentCents / 100]);

  const summaryRows = [
    ["Funcionário", "Horas extras", "Valor médio da hora extra (R$)", "Total a pagar (R$)"],
  ];
  const summaries = Array.from(summaryByEmployee.values()).sort((a, b) =>
    a.employee.localeCompare(b.employee, "pt-BR"),
  );
  for (const summary of summaries) {
    summaryRows.push([
      summary.employee,
      summary.hours,
      summary.paymentCents / 100 / summary.hours,
      summary.paymentCents / 100,
    ]);
  }
  summaryRows.push(["TOTAL", totalHours, "", totalPaymentCents / 100]);

  const workbook = XLSX.utils.book_new();
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet["!cols"] = [
    { wch: 28 },
    { wch: 32 },
    { wch: 58 },
    { wch: 16 },
    { wch: 22 },
    { wch: 15 },
    { wch: 25 },
    { wch: 21 },
  ];
  detailSheet["!autofilter"] = { ref: `A1:H${entries.length + 1}` };
  detailSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
  applyNumberFormat(detailSheet, entries.length, ["E", "G", "H"], '"R$" #,##0.00');
  applyNumberFormat(detailSheet, entries.length, ["D"], "0.00");
  applyNumberFormat(detailSheet, entries.length, ["F"], '0.00"%"');
  setCellNumberFormat(detailSheet, `D${entries.length + 2}`, "0.00");
  setCellNumberFormat(detailSheet, `H${entries.length + 2}`, '"R$" #,##0.00');

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 32 }, { wch: 21 }];
  summarySheet["!autofilter"] = { ref: `A1:D${summaries.length + 1}` };
  summarySheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
  for (let row = 2; row <= summaries.length + 1; row += 1) {
    setCellNumberFormat(summarySheet, `B${row}`, "0.00");
    setCellNumberFormat(summarySheet, `C${row}`, '"R$" #,##0.00');
    setCellNumberFormat(summarySheet, `D${row}`, '"R$" #,##0.00');
  }
  setCellNumberFormat(summarySheet, `B${summaries.length + 2}`, "0.00");
  setCellNumberFormat(summarySheet, `D${summaries.length + 2}`, '"R$" #,##0.00');

  XLSX.utils.book_append_sheet(workbook, detailSheet, "Lançamentos");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo por funcionário");
  workbook.Props = {
    Title: "Conferência de horas extras",
    Subject: "Lançamentos e resumo de pagamentos de horas extras",
    Author: "RN",
  };
  const now = new Date();
  const pad = (value, digits = 2) => String(value).padStart(digits, "0");
  const fileName = `horas-extras-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}.xlsx`;

  exportButton.disabled = true;
  try {
    const xlsxData = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    if (
      location.protocol === "http:" &&
      (location.hostname === "127.0.0.1" || location.hostname === "localhost")
    ) {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-Filename": fileName,
        },
        body: new Blob([xlsxData], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "O servidor recusou a planilha.");
      setExportStatus(`Planilha salva em ${result.file}.`, "success");
    } else {
      XLSX.writeFile(workbook, fileName);
      setExportStatus(
        "Planilha baixada pelo navegador. Para salvar automaticamente em destino/, inicie o servidor local e abra http://127.0.0.1:8765.",
        "success",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setExportStatus(`Não foi possível salvar a planilha na pasta destino: ${message}`, "error");
  } finally {
    exportButton.disabled = entriesBody.querySelectorAll("tr:not(.validation-row)").length === 0;
  }
}

function applyNumberFormat(sheet, entryCount, columns, format) {
  for (const column of columns) {
    for (let row = 2; row <= entryCount + 1; row += 1) {
      setCellNumberFormat(sheet, `${column}${row}`, format);
    }
  }
}

function setCellNumberFormat(sheet, address, format) {
  if (sheet[address]) sheet[address].z = format;
}
