const PERSONAS = {
  tutor: {
    label: "CS & Web Tutor",
    system:
      "You are an insightful Computer Science & Web Engineering mentor helping Ashwarya Agrawal (Roll No: 23BCON1659). Use earlier turns in the conversation to give connected, context-aware answers.",
  },
  architect: {
    label: "Systems Architect",
    system:
      "You are a principal full-stack systems architect specializing in Node.js, Express, MongoDB, APIs, and distributed systems. Reference prior context in the session accurately.",
  },
  interview: {
    label: "Placement Coach",
    system:
      "You are a technical interview coach helping a B.Tech CSE student sharpen explanations, trade-offs, and follow-up answers using earlier turns in the conversation.",
  },
};

const sessions = new Map();

function createWelcomeMessage(personaKey) {
  const persona = PERSONAS[personaKey] || PERSONAS.tutor;
  return {
    id: `msg_${Date.now()}_init`,
    role: "assistant",
    content: `Hey Ashwarya (23BCON1659) — **${persona.label}** mode is active.

I retain your conversation turns within this session window so follow-up questions build on what we already discussed. Share a project, stack, or question to get started.`,
    timestamp: new Date().toISOString(),
    meta: { persona: personaKey, turn: 0 },
  };
}

function getOrCreateSession(sessionId, personaKey = "tutor") {
  const safePersona = PERSONAS[personaKey] ? personaKey : "tutor";
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      persona: safePersona,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [createWelcomeMessage(safePersona)],
    });
  }
  return sessions.get(sessionId);
}

function resetSession(sessionId, personaKey = "tutor") {
  const safePersona = PERSONAS[personaKey] ? personaKey : "tutor";
  const fresh = {
    id: sessionId,
    persona: safePersona,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [createWelcomeMessage(safePersona)],
  };
  sessions.set(sessionId, fresh);
  return fresh;
}

function extractMemoryFacts(userMessages) {
  const facts = [];
  for (const msg of userMessages) {
    const text = msg.content.trim();
    const projMatch = text.match(/(?:building|working on|project(?:\s+is)?|app(?:\s+is)?)\s+([^.?!
]{3,80})/i);
    if (projMatch) facts.push(`Project focus: ${projMatch[1].trim()}`);

    const stackMatch = text.match(/(?:using|stack(?:\s+is)?|built with|with)\s+((?:node(?:\.js)?|express|react|mongodb|mongoose|jwt|bootstrap|javascript|typescript|python|c\+\+)(?:[^.?!
]{0,50}))/i);
    if (stackMatch) facts.push(`Tech stack: ${stackMatch[1].trim()}`);

    const goalMatch = text.match(/(?:goal is|preparing for|aiming for|want to learn)\s+([^.?!
]{3,70})/i);
    if (goalMatch) facts.push(`Goal: ${goalMatch[1].trim()}`);
  }
  return [...new Set(facts)].slice(0, 5);
}

function buildContextReply(session, latestUserText) {
  const userMsgs = session.messages.filter((m) => m.role === "user");
  const priorUserMsgs = userMsgs.slice(0, -1);
  const facts = extractMemoryFacts(userMsgs);
  const lower = latestUserText.toLowerCase();
  const personaInfo = PERSONAS[session.persona] || PERSONAS.tutor;

  if (/what did i say|remember|recall|earlier|what do you know|context|memory/i.test(lower)) {
    if (priorUserMsgs.length === 0) {
      return `We are just getting started in **${personaInfo.label}** mode.

Tell me what you're building or studying right now and I will keep that context across follow-up turns.`;
    }
    const recap = priorUserMsgs
      .slice(-4)
      .map((m, idx) => `${idx + 1}. "${m.content}"`)
      .join("
");
    const factLine = facts.length ? `

**Extracted Session Context:**
• ${facts.join("
• ")}` : "";
    return `Here is what I've retained from our earlier turns in this session:

${recap}${factLine}`;
  }

  const contextBridge =
    priorUserMsgs.length > 0
      ? `Connecting back to our earlier turn (*"${priorUserMsgs[priorUserMsgs.length - 1].content.slice(0, 72)}"*):`
      : `Starting fresh in **${personaInfo.label}** mode:`;

  const factNote = facts.length
    ? `

**Active Context Anchors:** ${facts.join(" · ")}`
    : "";

  return `${contextBridge}

Regarding **"${latestUserText}"**:
• **Approach:** Break the problem into clear inputs, stateful session handling, and verifiable edge cases before scaling.
• **Context Retention:** Keeping the last ${Math.min(session.messages.length, 16)} messages in session state lets you ask follow-ups like *"how does that handle errors?"* or *"summarize what we decided"* without repeating yourself.${factNote}`;
}

async function generateAssistantTurn(sessionId, message, personaKey) {
  const session = getOrCreateSession(sessionId, personaKey);
  if (personaKey && PERSONAS[personaKey]) {
    session.persona = personaKey;
  }

  session.messages.push({
    id: `msg_${Date.now()}_u`,
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
  });

  if (session.messages.length > 16) {
    session.messages = session.messages.slice(-16);
  }

  const personaObj = PERSONAS[session.persona] || PERSONAS.tutor;
  let replyContent = "";
  let engineUsed = "Context Memory Engine";

  const openAiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
  const geminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim();

  if (openAiKey) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        messages: [
          { role: "system", content: personaObj.system },
          ...session.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    const data = await resp.json();
    if (resp.ok && data.choices?.[0]?.message?.content) {
      replyContent = data.choices[0].message.content.trim();
      engineUsed = `OpenAI (${model})`;
    } else {
      replyContent = buildContextReply(session, message);
    }
  } else if (geminiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: personaObj.system }] },
        contents: session.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.65 },
      }),
    });
    const data = await resp.json();
    const gemText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("")?.trim();
    if (resp.ok && gemText) {
      replyContent = gemText;
      engineUsed = `Gemini (${model})`;
    } else {
      replyContent = buildContextReply(session, message);
    }
  } else {
    replyContent = buildContextReply(session, message);
  }

  const userCount = session.messages.filter((m) => m.role === "user").length;
  const assistantMsg = {
    id: `msg_${Date.now()}_a`,
    role: "assistant",
    content: replyContent,
    timestamp: new Date().toISOString(),
    meta: { persona: session.persona, turn: userCount, engine: engineUsed },
  };

  session.messages.push(assistantMsg);
  session.updatedAt = new Date().toISOString();

  return {
    session,
    memoryFacts: extractMemoryFacts(session.messages.filter((m) => m.role === "user")),
  };
}

module.exports = {
  PERSONAS,
  getOrCreateSession,
  resetSession,
  generateAssistantTurn,
  extractMemoryFacts,
};
