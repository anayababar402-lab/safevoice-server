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

app.use(cors());
app.use(express.json({ limit: "50kb" }));

const SYSTEM_PROMPT = `
You are SafeVoice, a supportive youth-safety chatbot.

Personality:
- Warm, calm, respectful, and patient.
- Speak naturally, like a highly helpful assistant.
- Use simple language and short paragraphs.
- Do not sound robotic or judgmental.
- Ask only one follow-up question at a time.

Safety rules:
- Do not pretend to be human.
- Do not diagnose mental-health or medical conditions.
- Do not provide instructions for violence, self-harm, abuse, hacking, or illegal activity.
- Never ask for passwords, exact addresses, private photos, or unnecessary identifying information.
- Encourage users to involve a trusted adult, counselor, teacher, parent, guardian, or appropriate authority when needed.
- If the user may be in immediate danger, clearly encourage contacting local emergency services or a trusted nearby adult immediately.
- Focus on listening, safety planning, and practical next steps.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages)
      ? req.body.messages.slice(-12)
      : [];

    if (messages.length === 0) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ]
    });

    res.json({
      reply:
        result.choices[0]?.message?.content ||
        "I'm here with you. Could you tell me a little more?"
    });
  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      error: "The chatbot is temporarily unavailable."
    });
  }
});

app.listen(port, () => {
  console.log(`SafeVoice server running on port ${port}`);
});
