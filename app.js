const form = document.getElementById("question-form");
const questionInput = document.getElementById("pregunta");
const sendButton = document.getElementById("send-button");
const messagesContainer = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const chatScroll = document.getElementById("chat-scroll");
const newChatButton = document.getElementById("new-chat");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeLabel = document.getElementById("theme-label");

function applyTheme(theme, savePreference = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", `Cambiar a modo ${isDark ? "claro" : "oscuro"}`);
  themeIcon.textContent = isDark ? "☀" : "☾";
  themeLabel.textContent = `Modo ${isDark ? "claro" : "oscuro"}`;

  if (savePreference) {
    try {
      localStorage.setItem("estadistica-theme", isDark ? "dark" : "light");
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de tema.", error);
    }
  }
}

try {
  applyTheme(localStorage.getItem("estadistica-theme") === "dark" ? "dark" : "light");
} catch (error) {
  console.warn("No se pudo leer la preferencia de tema.", error);
  applyTheme("light");
}

themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});

const conversation = [];
let isBusy = false;

function readLatexGroup(source, start) {
  if (source[start] !== "{") return null;
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) {
      return { value: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function cleanLatex(source) {
  let text = source;

  text = text.replace(/\\frac\s*/g, "FRAC ");
  let fractionIndex = text.indexOf("FRAC ");
  while (fractionIndex !== -1) {
    const numerator = readLatexGroup(text, fractionIndex + 5);
    const denominator = numerator && readLatexGroup(text, numerator.end);
    if (!numerator || !denominator) {
      text = text.slice(0, fractionIndex) + text.slice(fractionIndex + 5);
    } else {
      const fraction = `(${cleanLatex(numerator.value)}) ÷ (${cleanLatex(denominator.value)})`;
      text = text.slice(0, fractionIndex) + fraction + text.slice(denominator.end);
    }
    fractionIndex = text.indexOf("FRAC ");
  }

  text = text.replace(/\\text\s*/g, "TEXT ");
  let textIndex = text.indexOf("TEXT ");
  while (textIndex !== -1) {
    const group = readLatexGroup(text, textIndex + 5);
    if (group) {
      text = text.slice(0, textIndex) + group.value + text.slice(group.end);
    } else {
      text = text.slice(0, textIndex) + text.slice(textIndex + 5);
    }
    textIndex = text.indexOf("TEXT ");
  }

  return text
    .replace(/\\(?:\[|\]|\(|\))/g, "")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\(?:approx|simeq)/g, "≈")
    .replace(/\\(?:times|cdot)/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\%/g, "%")
    .replace(/\\,/g, " ")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\$\$?/g, "")
    .trim();
}

function appendTable(lines, container) {
  const rows = lines.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const hasHeader = rows.length > 1 && rows[1].every((cell) => /^:?-{3,}:?$/.test(cell));
  const columnCount = Math.max(...rows.map((row) => row.length));
  const headers = hasHeader
    ? rows[0]
    : rows[0].map((_, index) => `Columna ${index + 1}`);
  const dataRows = rows.slice(hasHeader ? 2 : 1).map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ""),
  );
  const wrapper = document.createElement("div");
  wrapper.className = "answer-table-wrap";
  const toolbar = document.createElement("div");
  toolbar.className = "spreadsheet-toolbar";
  const label = document.createElement("span");
  label.textContent = "Hoja de datos";
  const downloadButton = document.createElement("button");
  downloadButton.className = "spreadsheet-download";
  downloadButton.type = "button";
  downloadButton.textContent = "Descargar CSV";
  downloadButton.addEventListener("click", () => {
    const csvRows = [headers, ...dataRows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","));
    const file = new Blob(["\uFEFF", csvRows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tabla-estadistica.csv";
    link.click();
    URL.revokeObjectURL(url);
  });
  toolbar.append(label, downloadButton);

  const table = document.createElement("table");
  table.className = "answer-table";
  table.setAttribute("aria-label", "Tabla de datos");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  const headerRow = document.createElement("tr");

  const corner = document.createElement("th");
  corner.className = "spreadsheet-index";
  corner.setAttribute("aria-label", "Número de fila");
  headerRow.append(corner);
  headers.forEach((header, index) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    const columnLetter = document.createElement("span");
    columnLetter.className = "spreadsheet-column-letter";
    columnLetter.textContent = String.fromCharCode(65 + (index % 26));
    const heading = document.createElement("span");
    heading.textContent = header;
    cell.append(columnLetter, heading);
    headerRow.append(cell);
  });
  head.append(headerRow);

  dataRows.forEach((row, rowIndex) => {
    const tableRow = document.createElement("tr");
    const rowNumber = document.createElement("th");
    rowNumber.className = "spreadsheet-index";
    rowNumber.scope = "row";
    rowNumber.textContent = String(rowIndex + 1);
    tableRow.append(rowNumber);
    row.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      tableRow.append(cell);
    });
    body.append(tableRow);
  });

  table.append(head, body);
  const tableScroll = document.createElement("div");
  tableScroll.className = "spreadsheet-scroll";
  tableScroll.append(table);
  wrapper.append(toolbar, tableScroll);
  container.append(wrapper);
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function appendChart(chartData, container) {
  const types = ["bar", "line", "pie"];
  if (
    !chartData ||
    !types.includes(chartData.type) ||
    !Array.isArray(chartData.labels) ||
    chartData.labels.length < 2 ||
    chartData.labels.length > 10 ||
    !Array.isArray(chartData.datasets) ||
    chartData.datasets.length < 1 ||
    chartData.datasets.length > 4 ||
    (chartData.type === "pie" && chartData.datasets.length !== 1)
  ) {
    throw new Error("La gráfica no tiene un formato válido.");
  }

  const labels = chartData.labels.map((label) => String(label).slice(0, 24));
  const datasets = chartData.datasets.map((dataset) => {
    if (
      !dataset ||
      typeof dataset.label !== "string" ||
      !Array.isArray(dataset.values) ||
      dataset.values.length !== labels.length ||
      dataset.values.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error("Los datos de la gráfica no son válidos.");
    }
    if (chartData.type === "pie" && dataset.values.some((value) => value < 0)) {
      throw new Error("Una gráfica circular necesita valores no negativos.");
    }
    return { label: dataset.label.slice(0, 40), values: dataset.values };
  });

  const section = document.createElement("section");
  section.className = "answer-chart";
  const title = document.createElement("h4");
  title.textContent = typeof chartData.title === "string" ? chartData.title.slice(0, 80) : "Gráfica";
  section.append(title);

  const svg = createSvgElement("svg", {
    viewBox: "0 0 600 310",
    role: "img",
    "aria-label": `${title.textContent}: ${labels.join(", ")}`,
    preserveAspectRatio: "xMidYMid meet",
  });
  const colors = ["#7057d9", "#38a88a", "#e4a449", "#5284d4"];
  const plot = { left: 52, right: 580, top: 24, bottom: 238 };

  if (chartData.type === "pie") {
    const values = datasets[0].values;
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total <= 0) throw new Error("La gráfica circular necesita al menos un valor mayor que cero.");
    let startAngle = -Math.PI / 2;
    const center = { x: 300, y: 128 };
    const radius = 100;
    values.forEach((value, index) => {
      const endAngle = startAngle + (value / total) * Math.PI * 2;
      const start = {
        x: center.x + radius * Math.cos(startAngle),
        y: center.y + radius * Math.sin(startAngle),
      };
      const end = {
        x: center.x + radius * Math.cos(endAngle),
        y: center.y + radius * Math.sin(endAngle),
      };
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const path = createSvgElement("path", {
        d: `M ${center.x} ${center.y} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`,
        fill: colors[index % colors.length],
        stroke: "#fff",
        "stroke-width": 2,
      });
      const sliceTitle = createSvgElement("title");
      sliceTitle.textContent = `${labels[index]}: ${value} (${((value / total) * 100).toFixed(1)}%)`;
      path.append(sliceTitle);
      svg.append(path);
      startAngle = endAngle;
    });
  } else {
    const allValues = datasets.flatMap((dataset) => dataset.values);
    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(0, ...allValues);
    const range = maxValue - minValue || 1;
    const step = range / 4;
    const y = (value) => plot.bottom - ((value - minValue) / range) * (plot.bottom - plot.top);
    const zeroY = y(0);

    for (let index = 0; index <= 4; index += 1) {
      const value = minValue + step * index;
      const gridY = y(value);
      svg.append(createSvgElement("line", {
        x1: plot.left,
        x2: plot.right,
        y1: gridY,
        y2: gridY,
        stroke: "#eceaf3",
      }));
      const tick = createSvgElement("text", {
        x: plot.left - 8,
        y: gridY + 4,
        "text-anchor": "end",
        class: "chart-axis-label",
      });
      tick.textContent = Number(value.toPrecision(3)).toString();
      svg.append(tick);
    }

    svg.append(createSvgElement("line", {
      x1: plot.left,
      x2: plot.right,
      y1: zeroY,
      y2: zeroY,
      stroke: "#cbc8d8",
    }));

    const groupWidth = (plot.right - plot.left) / labels.length;
    labels.forEach((label, labelIndex) => {
      const centerX = plot.left + groupWidth * (labelIndex + 0.5);
      const text = createSvgElement("text", {
        x: centerX,
        y: plot.bottom + 22,
        "text-anchor": "middle",
        class: "chart-axis-label",
      });
      text.textContent = label;
      svg.append(text);

      datasets.forEach((dataset, datasetIndex) => {
        const value = dataset.values[labelIndex];
        if (chartData.type === "bar") {
          const width = Math.min(42, (groupWidth * 0.68) / datasets.length);
          const barX = centerX - (width * datasets.length) / 2 + datasetIndex * width;
          svg.append(createSvgElement("rect", {
            x: barX,
            y: Math.min(y(value), zeroY),
            width: width - 3,
            height: Math.max(1, Math.abs(zeroY - y(value))),
            rx: 4,
            fill: colors[datasetIndex % colors.length],
          }));
        } else {
          const pointX = centerX + (datasetIndex - (datasets.length - 1) / 2) * 5;
          const previousValue = labelIndex > 0 ? dataset.values[labelIndex - 1] : null;
          if (previousValue !== null) {
            const previousX = plot.left + groupWidth * (labelIndex - 0.5)
              + (datasetIndex - (datasets.length - 1) / 2) * 5;
            svg.append(createSvgElement("line", {
              x1: previousX,
              y1: y(previousValue),
              x2: pointX,
              y2: y(value),
              stroke: colors[datasetIndex % colors.length],
              "stroke-width": 3,
              "stroke-linecap": "round",
            }));
          }
          svg.append(createSvgElement("circle", {
            cx: pointX,
            cy: y(value),
            r: 4,
            fill: colors[datasetIndex % colors.length],
          }));
        }
      });
    });
  }

  section.append(svg);
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  if (chartData.type === "pie") {
    labels.forEach((label, index) => {
      const item = document.createElement("span");
      item.className = "chart-legend-item";
      const swatch = document.createElement("i");
      swatch.style.backgroundColor = colors[index % colors.length];
      const value = datasets[0].values[index];
      item.append(swatch, document.createTextNode(`${label}: ${value}`));
      legend.append(item);
    });
  } else {
    datasets.forEach((dataset, index) => {
      const item = document.createElement("span");
      item.className = "chart-legend-item";
      const swatch = document.createElement("i");
      swatch.style.backgroundColor = colors[index % colors.length];
      item.append(swatch, document.createTextNode(dataset.label));
      legend.append(item);
    });
  }
  section.append(legend);
  container.append(section);
}

function appendFormattedText(source, container) {
  const lines = cleanLatex(source)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
      .trim());

  for (let index = 0; index < lines.length;) {
    if (/^\|.*\|$/.test(lines[index])) {
      const tableLines = [];
      while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      appendTable(tableLines, container);
      continue;
    }

    const line = lines[index];
    index += 1;
    if (!line) continue;
    const isHeading = /^(procedimiento|resultado|conclusi[oó]n|paso\s+\d+\b)/i.test(line);
    const isNumberedStep = /^\d+[.)]\s/.test(line);
    const paragraph = document.createElement(isHeading ? "h3" : "p");
    paragraph.className = isHeading
      ? /^resultado\b/i.test(line) ? "answer-heading answer-result" : "answer-heading"
      : isNumberedStep ? "answer-step" : "answer-line";
    paragraph.textContent = line.replace(/^\d+[.)]\s*/, isNumberedStep ? (line.match(/^\d+[.)]/)?.[0] + " ") : "");
    container.append(paragraph);
  }
}

function formatAssistantResponse(text, container) {
  const chartBlock = /\[\[CHART\]\]([\s\S]*?)\[\[\/CHART\]\]/g;
  let cursor = 0;
  let match;

  while ((match = chartBlock.exec(text)) !== null) {
    appendFormattedText(text.slice(cursor, match.index), container);
    try {
      appendChart(JSON.parse(match[1]), container);
    } catch (error) {
      const fallback = document.createElement("p");
      fallback.className = "answer-line";
      fallback.textContent = error instanceof Error ? error.message : "No se pudo mostrar la gráfica.";
      container.append(fallback);
    }
    cursor = chartBlock.lastIndex;
  }
  appendFormattedText(text.slice(cursor), container);
}

function addMessage(role, text, options = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}${options.typing ? " typing" : ""}`;

  if (role === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "∑";
    message.append(avatar);
  }

  const content = document.createElement("div");
  content.className = options.typing ? "message-content typing-indicator" : "message-content";
  if (options.format) {
    content.classList.add("formatted-response");
    formatAssistantResponse(text, content);
  } else if (options.typing) {
    content.setAttribute("role", "status");
    content.setAttribute("aria-label", "Generando respuesta");
    for (let index = 0; index < 3; index += 1) {
      content.append(document.createElement("span"));
    }
  } else {
    content.textContent = text;
  }
  message.append(content);
  messagesContainer.append(message);
  welcome.hidden = true;
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return message;
}

function setBusy(busy) {
  isBusy = busy;
  sendButton.disabled = busy;
  newChatButton.disabled = busy;
  questionInput.disabled = busy;
  sendButton.querySelector("span:first-child").textContent = busy ? "Enviando..." : "Enviar";
}

async function askQuestion(question) {
  if (isBusy || !question.trim()) return;

  const cleanQuestion = question.trim();
  addMessage("user", cleanQuestion);
  questionInput.value = "";
  questionInput.style.height = "auto";
  setBusy(true);
  const typingMessage = addMessage("assistant", "", { typing: true });

  try {
    const response = await fetch("/preguntar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pregunta: cleanQuestion,
        historial: conversation.slice(-10),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "No se pudo obtener una respuesta. Inténtalo de nuevo.");
    }
    if (typeof data.respuesta !== "string" || !data.respuesta.trim()) {
      throw new Error("La respuesta llegó vacía. Inténtalo de nuevo.");
    }

    typingMessage.remove();
    addMessage("assistant", data.respuesta, { format: true });
    conversation.push(
      { role: "user", content: cleanQuestion },
      { role: "assistant", content: data.respuesta },
    );
  } catch (error) {
    typingMessage.remove();
    addMessage(
      "assistant",
      error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado. Inténtalo de nuevo.",
    );
  } finally {
    setBusy(false);
    questionInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void askQuestion(questionInput.value);
});

questionInput.addEventListener("input", () => {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 150)}px`;
});

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    if (isBusy) return;
    const prompt = button.getAttribute("data-prompt");
    if (prompt) void askQuestion(prompt);
  });
});

newChatButton.addEventListener("click", () => {
  if (isBusy) return;
  conversation.length = 0;
  messagesContainer.replaceChildren();
  welcome.hidden = false;
  questionInput.value = "";
  questionInput.focus();
});
