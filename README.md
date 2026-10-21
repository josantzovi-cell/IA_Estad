# Asistente de Estadística

Asistente web de estadística con Node.js, Express y OpenAI.

## Ejecutar localmente

1. Instala Node.js.
2. Copia `.env.example` a `.env` y agrega tu clave en `OPENAI_API_KEY`.
3. Ejecuta `npm install`.
4. Ejecuta `npm start` y abre `http://localhost:3000`.

No subas `.env` ni compartas tu clave. `.gitignore` ya excluye ese archivo.

## Publicar en Render

1. Sube el proyecto a un repositorio de GitHub. Puedes mantenerlo privado.
   No incluyas `.env` ni copies la clave de OpenAI en el repositorio.
2. En Render, crea un **Blueprint** y conecta ese repositorio. Render detectará
   `render.yaml` y preparará el servicio web.
3. Cuando Render lo solicite, agrega `OPENAI_API_KEY` como variable de entorno
   secreta. No la escribas en el código ni en `render.yaml`.
4. Inicia el despliegue. Render mostrará una dirección pública terminada en
   `.onrender.com`; abre esa dirección para probar el sitio.

El endpoint de preguntas limita cada dirección IP a 30 solicitudes por cada
10 minutos y restringe la longitud de las respuestas para ayudar a controlar el
uso de la API. El plan gratuito de Render puede suspender servicios inactivos;
la primera visita después de una pausa podría tardar en cargar. El uso de OpenAI
puede generar cargos según tu cuenta y consumo.
