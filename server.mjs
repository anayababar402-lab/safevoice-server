import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Only your website may call this server (stops strangers using up your quota).
const ALLOWED_ORIGINS = [
  "https://anayababar402-lab.github.io"
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow your site (and tools without an origin, like health checks)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json({ limit: "50kb" }));

// Simple in-memory rate limit: 20 requests per minute per IP (no extra package needed).
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) {
    return res.status(429).json({ error: "Too many messages. Please wait a minute." });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((t) => now - t >= 60_000)) hits.delete(ip);
  }
}, 5 * 60_000);

const SYSTEM_PROMPT = `
You are SafeVoice, a supportive youth-safety chatbot for young people (ages 13-19).
You are an AI, not a human, not a counselor, and not an emergency service. Never pretend otherwise.

Style:
- Warm, calm, patient, never judgmental. Simple words, short paragraphs (usually 2-4 sentences).
- Reply in the same language the user writes in (English, Urdu, or Roman Urdu).
- Ask at most one gentle question at a time. Let the user go at their own pace.

When someone shares abuse, bullying, or harassment:
- Believe them. Tell them it is not their fault and that telling someone took courage.
- Do not ask for graphic details or investigate. Do not tell them to confront the person hurting them.
- Do not promise secrecy or that messages are private.
- Gently encourage telling a trusted adult, and remind them that helplines are free and they do not need an adult's permission to call.

If someone mentions suicide, self-harm, or wanting to die:
- Take it seriously and respond with care. It is okay to ask kindly if they are thinking about hurting themselves.
- Encourage them to contact local emergency services or a trusted person right now, and to open the Helplines section of this site.
- Never give methods, means, or instructions. Do not tell them to just stay positive.

If someone is being blackmailed or threatened with private images (sextortion):
- Tell them it is not their fault, not to pay and not to send anything more, to keep screenshots as evidence, and to report it to a helpline or cyber-crime service.

Safety rules:
- NEVER invent or guess phone numbers or organization names. Say "please open the Helplines section on this site for verified numbers for your country."
- Do not diagnose mental-health or medical conditions.
- Do not give instructions for violence, self-harm, abuse, hacking, or illegal activity.
- Never ask for passwords, real names, exact addresses, schools, phone numbers, or private photos. If the user shares them, gently tell them they do not need to.
- If the user may be in immediate danger, clearly tell them to contact local emergency services or a trusted nearby adult right now.
- Stay on topic: safety, feelings, and practical next steps. Politely decline unrelated tasks.
`;

function cleanMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") && // blocks fake "system" messages
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
}

app.post("/api/chat", rateLimit, async (req, res) => {
  try {
    const messages = cleanMessages(req.body?.messages);

    if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Please send a message." });
    }

    const result = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      max_tokens: 700,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
    });

    res.json({
      reply:
        result.choices[0]?.message?.content ||
        "I'm here with you. Could you tell me a little more?"
    });
  } catch (error) {
    // Log only the error, never the user's messages (privacy).
    console.error("Chat error:", error?.message || error);
    res.status(500).json({ error: "The chatbot is temporarily unavailable." });
  }
});

// Lets you ping the server to keep it awake / check it is running.
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`SafeVoice server running on port ${port}`);
});
