const form = document.getElementById("question-form");
const questionInput = document.getElementById("pregunta");
const sendButton = document.getElementById("send-button");
const messagesContainer = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const chatScroll = document.getElementById("chat-scroll");
const newChatButton = document.getElementById("new-chat");

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

function formatAssistantResponse(text, container) {
  const lines = cleanLatex(text)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
      .trim());

  for (const line of lines) {
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
