import "dotenv/config";
import express from "express";
import { rateLimit } from "express-rate-limit";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  console.error("Falta OPENAI_API_KEY. Configúrala en el archivo .env antes de iniciar el servidor.");
  process.exit(1);
}

const client = new OpenAI({ apiKey });
const app = express();
const port = Number(process.env.PORT) || 3000;
const directory = path.dirname(fileURLToPath(import.meta.url));
const maxQuestionLength = 2000;
const maxHistoryMessages = 10;

if (process.env.RENDER) {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "30kb" }));

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/", (_request, response) => {
  response.sendFile(path.join(directory, "index.html"));
});

app.get("/style.css", (_request, response) => {
  response.sendFile(path.join(directory, "style.css"));
});

app.get("/app.js", (_request, response) => {
  response.sendFile(path.join(directory, "app.js"));
});

app.post(
  "/preguntar",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Alcanzaste el límite de 30 preguntas. Inténtalo de nuevo en 10 minutos." },
  }),
  async (request, response) => {
    const { pregunta, historial = [] } = request.body ?? {};

    if (typeof pregunta !== "string" || !pregunta.trim() || pregunta.length > maxQuestionLength) {
      response.status(400).json({
        error: `Escribe una pregunta de hasta ${maxQuestionLength} caracteres.`,
      });
      return;
    }

    if (
      !Array.isArray(historial) ||
      historial.length > maxHistoryMessages ||
      historial.some(
        (message) =>
          !message ||
          !["user", "assistant"].includes(message.role) ||
          typeof message.content !== "string" ||
          !message.content.trim() ||
          message.content.length > maxQuestionLength,
      )
    ) {
      response.status(400).json({ error: "El historial de la conversación no es válido." });
      return;
    }

    try {
      const result = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Eres un tutor experto en estadística. Responde en español, de forma breve, ordenada y centrada en lo que necesita aprender el usuario. No describas pensamientos internos, razonamiento oculto, acciones del chat, búsquedas ni frases como «estoy pensando» o «voy a resolverlo». Para ejercicios numéricos usa solo este formato: «Procedimiento», pasos numerados con los datos y operaciones necesarias, y «Resultado» con la respuesta final. Explica cada operación con una frase corta; no agregues introducciones, conclusiones repetidas ni información que no ayude a entender el cálculo. Escribe las operaciones en texto plano y evita Markdown, asteriscos, encabezados con # y LaTeX; por ejemplo: «Media = (2 + 4 + 6) ÷ 3 = 4». Si la pregunta es conceptual, contesta directamente en pocas frases. Si faltan datos, pregunta únicamente por los datos necesarios.",
          },
          ...historial.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          { role: "user", content: pregunta.trim() },
        ],
      });

      const answer = result.choices[0]?.message?.content;
      if (!answer?.trim()) {
        response.status(502).json({ error: "OpenAI no devolvió una respuesta. Inténtalo de nuevo." });
        return;
      }

      response.json({ respuesta: answer });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`Error al consultar OpenAI: ${message}`);
      response.status(502).json({
        error: "No se pudo conectar con OpenAI. Revisa tu API key y vuelve a intentarlo.",
      });
    }
  },
);

app.listen(port, () => {
  console.log(`Servidor listo en http://localhost:${port}`);
});
