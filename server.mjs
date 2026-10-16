import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const model = "gemini-3.5-flash-lite";

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".glb": "model/gltf-binary"
};

const sendJson = (response, status, body) => {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
};

const readBody = async (request) => {
    let body = "";
    for await (const chunk of request) {
        body += chunk;
        if (body.length > 120_000) throw new Error("La petición es demasiado grande.");
    }
    return JSON.parse(body || "{}");
};

const askGemini = async ({ question, catalogContext, pageContext }) => {
    if (!apiKey) {
        const error = new Error("Falta GEMINI_API_KEY.");
        error.statusCode = 503;
        throw error;
    }

    const prompt = [
        "Eres el asistente breve de 3dDtr3s, una tienda peruana de impresiones 3D.",
        "Responde en español con máximo 25 palabras, usando una sola frase o dos frases muy cortas.",
        "Ve directo al punto: no repitas la pregunta, no saludes y no agregues explicaciones innecesarias.",
        "Usa únicamente la información del catálogo proporcionado.",
        "No inventes productos, precios, horarios, envíos ni disponibilidad.",
        "Si la pregunta requiere una cotización exacta, indica que deben escribir por WhatsApp.",
        "Usa también la información general de la página para responder sobre servicios, contacto y cómo comprar.",
        "Si un dato no aparece en estos contextos, dilo claramente y no lo inventes.",
        "Información general de la página:\n" + (pageContext || "No se proporcionó información general."),
        "Catálogo disponible:\n" + (catalogContext || "No se proporcionó el catálogo."),
        "Pregunta del visitante: " + question
    ].join("\n\n");

    const apiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: "Sé claro, amable y extremadamente breve. No menciones que eres una IA." }]
                },
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.35,
                    maxOutputTokens: 60
                }
            })
        }
    );

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
        const error = new Error(data?.error?.message || "Gemini no pudo responder.");
        error.statusCode = apiResponse.status;
        throw error;
    }

    const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!text) throw new Error("Gemini devolvió una respuesta vacía.");
    return text;
};

const server = createServer(async (request, response) => {
    try {
        const requestUrl = new URL(request.url, "http://" + (request.headers.host || "localhost"));

        if (request.method === "OPTIONS") {
            response.writeHead(204, {
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            });
            return response.end();
        }

        if (request.method === "GET" && requestUrl.pathname === "/api/health") {
            return sendJson(response, 200, { ok: true, geminiConfigured: Boolean(apiKey) });
        }

        if (request.method === "POST" && requestUrl.pathname === "/api/gemini") {
            const body = await readBody(request);
            const question = String(body.question || "").trim();
            if (!question) return sendJson(response, 400, { error: "Escribe una pregunta." });
            const text = await askGemini({
                question: question.slice(0, 500),
                catalogContext: String(body.catalogContext || "").slice(0, 35_000),
                pageContext: String(body.pageContext || "").slice(0, 25_000)
            });
            return sendJson(response, 200, { text });
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
            return sendJson(response, 405, { error: "Método no permitido." });
        }

        const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
        const filePath = path.resolve(root, "." + relativePath);
        if (!filePath.startsWith(root + path.sep)) {
            return sendJson(response, 403, { error: "Ruta no permitida." });
        }

        const content = await readFile(filePath);
        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            "Content-Type": mimeTypes[extension] || "application/octet-stream",
            "Cache-Control": "no-cache"
        });
        if (request.method === "HEAD") return response.end();
        response.end(content);
    } catch (error) {
        const statusCode = error.statusCode || (error.code === "ENOENT" ? 404 : 500);
        if (request.url.startsWith("/api/")) {
            return sendJson(response, statusCode, { error: error.message || "Error del servidor." });
        }
        response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(statusCode === 404 ? "Archivo no encontrado." : "Error interno del servidor.");
    }
});

server.listen(port, () => {
    console.log("3dDtr3s disponible en http://localhost:" + port);
    console.log("Gemini configurado: " + Boolean(apiKey));
});
