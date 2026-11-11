"use strict";

const clientForm = document.querySelector("#client-response-form");
const cnpjInput = document.querySelector("#client-cnpj");
const tradeNameInput = document.querySelector("#client-trade-name");
const monthInput = document.querySelector("#client-month");
const cnpjStatus = document.querySelector("#cnpj-status");
const formStatus = document.querySelector("#form-status");
const companyDetails = document.querySelector("#company-details");
const employeeList = document.querySelector("#client-employees");
const employeeStatus = document.querySelector("#employee-status");
const printEmployeeRows = document.querySelector("#print-employee-rows");
const lookupButton = document.querySelector("#lookup-cnpj");
const previewHeading = document.querySelector("#preview-heading");
const printResponse = document.querySelector("#print-response");
const spreadsheetPreview = document.querySelector("#spreadsheet-preview");
const previewActions = document.querySelector("#preview-actions");
const previewSpreadsheetEmployees = document.querySelector("#preview-spreadsheet-employees");
const downloadStatus = document.querySelector("#download-status");
const downloadPdfButton = document.querySelector("#download-response-pdf");
const downloadWorkbookButton = document.querySelector("#download-response-workbook");

let lookupController = null;
let lookupTimer = null;
let lastLookupCnpj = "";
let suggestedTradeName = "";
let activeLookupCnpj = "";
let preparedResponse = null;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function cnpjDigits(value) {
  return value.replace(/\D/g, "").slice(0, 14);
}

function formatCnpj(digits) {
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(value) {
  const digits = cnpjDigits(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calculateDigit = (base, weights) => {
    const remainder = base
      .split("")
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(
    digits.slice(0, 12) + first,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return digits.endsWith(`${first}${second}`);
}

function setCnpjStatus(message, kind = "") {
  cnpjStatus.textContent = message;
  cnpjStatus.dataset.kind = kind;
}

function setCompanyField(name, value) {
  companyDetails.querySelector(`[data-company-field="${name}"]`).textContent = value || "Não informado";
}

function companyAddress(data) {
  const street = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ");
  const locality = [data.bairro, data.municipio, data.uf].filter(Boolean).join(" - ");
  return [
    [street, data.numero].filter(Boolean).join(", "),
    data.complemento,
    locality,
    data.cep ? `CEP ${data.cep}` : "",
  ].filter(Boolean).join(", ");
}

function companyContact(data) {
  return [data.ddd_telefone_1, data.ddd_telefone_2, data.email]
    .filter(Boolean)
    .join(" · ");
}

async function lookupCnpj() {
  const digits = cnpjDigits(cnpjInput.value);
  if (!isValidCnpj(digits)) {
    setCnpjStatus("Informe um CNPJ válido com 14 dígitos.", "error");
    return;
  }
  if (digits === lastLookupCnpj && !companyDetails.hidden) return;
  if (digits === activeLookupCnpj) return;

  if (lookupController) lookupController.abort();
  lookupController = new AbortController();
  const currentController = lookupController;
  activeLookupCnpj = digits;
  const timeoutId = window.setTimeout(() => currentController.abort(), 12000);
  lookupButton.disabled = true;
  setCnpjStatus("Consultando os dados cadastrais…");

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      { signal: currentController.signal },
    );
    if (!response.ok) {
      if (response.status === 404) throw new Error("CNPJ não encontrado na base consultada.");
      if (response.status === 429) throw new Error("Muitas consultas em sequência. Aguarde um instante e tente novamente.");
      throw new Error(`A consulta cadastral falhou (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (cnpjDigits(cnpjInput.value) !== digits) return;
    const legalName = String(data.razao_social || "").trim();
    const tradeName = String(data.nome_fantasia || "").trim();
    if (!legalName && !tradeName) throw new Error("A consulta não retornou nome para esta empresa.");

    const suggestedName = tradeName || legalName;
    if (!tradeNameInput.value.trim() || tradeNameInput.value === suggestedTradeName) {
      tradeNameInput.value = suggestedName;
    }
    suggestedTradeName = suggestedName;
    setCompanyField("legalName", legalName);
    setCompanyField("status", data.descricao_situacao_cadastral || data.situacao_cadastral);
    setCompanyField("address", companyAddress(data));
    setCompanyField("activity", data.cnae_fiscal_descricao);
    setCompanyField("contact", companyContact(data));
    companyDetails.hidden = false;
    lastLookupCnpj = digits;
    setCnpjStatus("Dados cadastrais carregados. Confira o nome fantasia antes de continuar.", "success");
  } catch (error) {
    if (cnpjDigits(cnpjInput.value) !== digits) return;
    if (error.name === "AbortError") {
      setCnpjStatus("A consulta excedeu o tempo limite. Verifique a conexão e tente novamente.", "error");
    } else {
      setCnpjStatus(error instanceof Error ? error.message : String(error), "error");
    }
  } finally {
    window.clearTimeout(timeoutId);
    if (lookupController === currentController) {
      lookupController = null;
      activeLookupCnpj = "";
      lookupButton.disabled = false;
    }
  }
}

function addEmployeeRow() {
  const row = document.createElement("div");
  row.className = "client-employee-row";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nome do funcionário";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "employee-name-input";
  nameInput.autocomplete = "name";
  nameInput.placeholder = "Nome completo";
  nameInput.required = true;
  nameLabel.append(nameInput);

  const hoursLabel = document.createElement("label");
  hoursLabel.textContent = "Horas extras trabalhadas";
  const hoursInput = document.createElement("input");
  hoursInput.type = "number";
  hoursInput.className = "employee-hours-input";
  hoursInput.min = "0.01";
  hoursInput.step = "0.01";
  hoursInput.inputMode = "decimal";
  hoursInput.placeholder = "0,00";
  hoursInput.required = true;
  hoursLabel.append(hoursInput);

  const rateLabel = document.createElement("label");
  rateLabel.textContent = "Valor da hora extra (R$)";
  const rateInput = document.createElement("input");
  rateInput.type = "number";
  rateInput.className = "employee-rate-input";
  rateInput.min = "0.01";
  rateInput.step = "0.01";
  rateInput.inputMode = "decimal";
  rateInput.placeholder = "0,00";
  rateInput.required = true;
  rateLabel.append(rateInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "response-remove";
  removeButton.setAttribute("aria-label", "Remover funcionário");
  removeButton.title = "Remover funcionário";
  removeButton.textContent = "×";
  row.append(nameLabel, hoursLabel, rateLabel, removeButton);
  employeeList.append(row);
}

function formatDecimal(value) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function hideExportPreview() {
  preparedResponse = null;
  previewHeading.hidden = true;
  printResponse.classList.remove("is-visible");
  spreadsheetPreview.hidden = true;
  previewActions.hidden = true;
  downloadStatus.textContent = "";
}

function renderSpreadsheetPreview(data) {
  document.querySelector("#preview-cnpj").textContent = data.formattedCnpj;
  document.querySelector("#preview-trade-name").textContent = data.tradeName;
  document.querySelector("#preview-month").textContent = data.monthLabel;
  previewSpreadsheetEmployees.replaceChildren();

  let totalHours = 0;
  let totalCents = 0;
  for (const employee of data.employees) {
    const totalEmployeeCents = Math.round(employee.hours * Math.round(employee.rate * 100));
    totalHours += employee.hours;
    totalCents += totalEmployeeCents;
    const row = document.createElement("tr");
    for (const value of [
      employee.name,
      formatDecimal(employee.hours),
      currencyFormatter.format(employee.rate),
      currencyFormatter.format(totalEmployeeCents / 100),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    previewSpreadsheetEmployees.append(row);
  }

  const totalRow = document.createElement("tr");
  totalRow.className = "spreadsheet-total-row";
  for (const value of [
    "TOTAL",
    formatDecimal(totalHours),
    "",
    currencyFormatter.format(totalCents / 100),
  ]) {
    const cell = document.createElement("td");
    cell.textContent = value;
    totalRow.append(cell);
  }
  document.querySelector("#preview-spreadsheet-total").replaceChildren(totalRow);
}

function buildPrintableResponse() {
  formStatus.textContent = "";
  employeeStatus.textContent = "";
  const employeeRows = Array.from(employeeList.querySelectorAll(".client-employee-row"));
  const employees = employeeRows.map((row) => ({
    name: row.querySelector(".employee-name-input").value.trim(),
    hours: row.querySelector(".employee-hours-input").valueAsNumber,
    rate: row.querySelector(".employee-rate-input").valueAsNumber,
  }));
  const invalidEmployee = employees.findIndex(
    (employee) =>
      !employee.name ||
      !Number.isFinite(employee.hours) ||
      employee.hours <= 0 ||
      !Number.isFinite(employee.rate) ||
      employee.rate <= 0,
  );

  if (!isValidCnpj(cnpjInput.value)) {
    setCnpjStatus("Informe um CNPJ válido com 14 dígitos.", "error");
    cnpjInput.focus();
    return false;
  }
  if (!tradeNameInput.value.trim()) {
    formStatus.textContent = "Informe o nome fantasia da empresa.";
    tradeNameInput.focus();
    return false;
  }
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(monthInput.value)) {
    formStatus.textContent = "Selecione o mês de referência.";
    monthInput.focus();
    return false;
  }
  if (invalidEmployee >= 0) {
    employeeStatus.textContent = `Confira nome, horas e valor da hora extra do funcionário ${invalidEmployee + 1}.`;
    employeeStatus.dataset.kind = "error";
    employeeRows[invalidEmployee].querySelector(
      !employees[invalidEmployee].name ? ".employee-name-input" :
        !Number.isFinite(employees[invalidEmployee].hours) || employees[invalidEmployee].hours <= 0
          ? ".employee-hours-input"
          : ".employee-rate-input",
    ).focus();
    return false;
  }
  employeeStatus.textContent = "";
  formStatus.textContent = "";

  const formattedCnpj = formatCnpj(cnpjDigits(cnpjInput.value));
  const tradeName = tradeNameInput.value.trim();
  const monthLabel = formatMonth(monthInput.value);
  document.querySelector('[data-print-field="cnpj"]').textContent = formattedCnpj;
  document.querySelector('[data-print-field="tradeName"]').textContent = tradeName;
  document.querySelector('[data-print-field="month"]').textContent = monthLabel;
  printEmployeeRows.replaceChildren();
  for (const employee of employees) {
    const line = document.createElement("p");
    line.className = "print-employee-row";
    line.textContent = `${employee.name}; ${formatDecimal(employee.hours)}; ${formatDecimal(employee.rate)}`;
    printEmployeeRows.append(line);
  }
  preparedResponse = {
    cnpj: cnpjDigits(cnpjInput.value),
    formattedCnpj,
    tradeName,
    month: monthInput.value,
    monthLabel,
    employees,
  };
  renderSpreadsheetPreview(preparedResponse);
  previewHeading.hidden = false;
  printResponse.classList.add("is-visible");
  spreadsheetPreview.hidden = false;
  previewActions.hidden = false;
  downloadStatus.textContent = "";
  return true;
}

cnpjInput.addEventListener("input", () => {
  const digits = cnpjDigits(cnpjInput.value);
  cnpjInput.value = formatCnpj(digits);
  if (digits !== lastLookupCnpj) {
    lastLookupCnpj = "";
    companyDetails.hidden = true;
    setCnpjStatus("");
    if (tradeNameInput.value === suggestedTradeName) {
      tradeNameInput.value = "";
      suggestedTradeName = "";
    }
  }
  window.clearTimeout(lookupTimer);
  if (digits.length === 14) lookupTimer = window.setTimeout(lookupCnpj, 650);
});
cnpjInput.addEventListener("blur", () => {
  if (cnpjDigits(cnpjInput.value).length === 14) lookupCnpj();
});
lookupButton.addEventListener("click", lookupCnpj);
document.querySelector("#add-client-employee").addEventListener("click", addEmployeeRow);
employeeList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".response-remove");
  if (!removeButton) return;
  removeButton.closest(".client-employee-row").remove();
  if (!employeeList.children.length) addEmployeeRow();
  employeeStatus.textContent = "";
  hideExportPreview();
});
clientForm.addEventListener("input", hideExportPreview);
clientForm.addEventListener("submit", (event) => {
  event.preventDefault();
  buildPrintableResponse();
});
downloadPdfButton.addEventListener("click", () => {
  if (!preparedResponse) return;
  window.print();
});
downloadWorkbookButton.addEventListener("click", () => {
  if (!preparedResponse) return;
  if (typeof XLSX === "undefined") {
    downloadStatus.textContent = "Não foi possível carregar a biblioteca de Excel. Verifique a conexão e tente novamente.";
    downloadStatus.dataset.kind = "error";
    return;
  }

  const rows = [
    ["Informações da empresa"],
    ["CNPJ", preparedResponse.formattedCnpj],
    ["Nome fantasia", preparedResponse.tradeName],
    ["Mês de referência", preparedResponse.monthLabel],
    [],
    ["Funcionário", "Horas extras trabalhadas", "Valor da hora extra (R$)", "Total (R$)"],
  ];
  for (const employee of preparedResponse.employees) {
    const rateCents = Math.round(employee.rate * 100);
    rows.push([
      employee.name,
      employee.hours,
      rateCents / 100,
      Math.round(employee.hours * rateCents) / 100,
    ]);
  }
  const totalHours = preparedResponse.employees.reduce((sum, employee) => sum + employee.hours, 0);
  const totalCents = preparedResponse.employees.reduce(
    (sum, employee) => sum + Math.round(employee.hours * Math.round(employee.rate * 100)),
    0,
  );
  rows.push(["TOTAL", totalHours, "", totalCents / 100]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 32 }, { wch: 27 }, { wch: 28 }, { wch: 18 }];
  for (let row = 7; row <= preparedResponse.employees.length + 6; row += 1) {
    const hoursCell = sheet[`B${row}`];
    if (hoursCell) hoursCell.z = "0.00";
    for (const column of ["C", "D"]) {
      const moneyCell = sheet[`${column}${row}`];
      if (moneyCell) moneyCell.z = '"R$" #,##0.00';
    }
  }
  const totalRow = preparedResponse.employees.length + 7;
  if (sheet[`B${totalRow}`]) sheet[`B${totalRow}`].z = "0.00";
  if (sheet[`D${totalRow}`]) sheet[`D${totalRow}`].z = '"R$" #,##0.00';

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Horas extras");
  workbook.Props = {
    Title: "Horas extras",
    Subject: "Dados informados pelo cliente",
    Author: "Rn",
  };
  const fileName = `horas-extras-${preparedResponse.cnpj}-${preparedResponse.month}.xlsx`;
  try {
    XLSX.writeFile(workbook, fileName);
    downloadStatus.textContent = "Planilha Excel baixada.";
    downloadStatus.dataset.kind = "success";
  } catch (error) {
    downloadStatus.textContent = `Não foi possível baixar a planilha: ${error instanceof Error ? error.message : String(error)}`;
    downloadStatus.dataset.kind = "error";
  }
});

addEmployeeRow();
