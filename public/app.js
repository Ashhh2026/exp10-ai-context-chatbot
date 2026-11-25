const SESSION_ID = "exp10_23bcon1659_" + Math.random().toString(36).slice(2, 7);

const sessionIdText = document.getElementById("sessionIdText");
const personaSelect = document.getElementById("personaSelect");
const personaBadge = document.getElementById("personaBadge");
const turnCounter = document.getElementById("turnCounter");
const memoryFactsList = document.getElementById("memoryFactsList");
const threadBox = document.getElementById("threadBox");
const composerForm = document.getElementById("composerForm");
const promptTextarea = document.getElementById("promptTextarea");
const sendBtn = document.getElementById("sendBtn");
const errLine = document.getElementById("errLine");

sessionIdText.textContent = SESSION_ID;

const PERSONA_LABELS = {
  tutor: "CS & Web Tutor",
  architect: "Systems Architect",
  interview: "Placement Coach",
};

function formatInline(raw) {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderWorkspace(payload) {
  const session = payload.session;
  const facts = payload.memoryFacts || [];
  if (!session) return;

  personaSelect.value = session.persona || "tutor";
  personaBadge.textContent = PERSONA_LABELS[session.persona] || session.persona;
  turnCounter.textContent = `${session.messages.length} / 16`;

  if (facts.length === 0) {
    memoryFactsList.innerHTML = `<li class="fact-empty">No facts extracted yet. Share what you're building!</li>`;
  } else {
    memoryFactsList.innerHTML = facts.map((f) => `<li>${formatInline(f)}</li>`).join("");
  }

  threadBox.innerHTML = session.messages
    .map((m) => {
      const roleLabel = m.role === "user" ? "Ashwarya (23BCON1659)" : "Context Assistant";
      const engineInfo = m.meta?.engine ? ` · ${m.meta.engine}` : "";
      return `
        <div class="msg-row ${m.role}">
          <div class="bubble">${formatInline(m.content)}</div>
          <span class="msg-meta">${roleLabel}${engineInfo} · ${formatTime(m.timestamp)}</span>
        </div>
      `;
    })
    .join("");

  threadBox.scrollTop = threadBox.scrollHeight;
}

async function loadSession() {
  const res = await fetch(`/api/chat/${SESSION_ID}?persona=${encodeURIComponent(personaSelect.value)}`);
  const data = await res.json();
  renderWorkspace(data);
}

async function dispatchMessage(text) {
  errLine.textContent = "";
  const clean = (text || "").trim();
  if (!clean) {
    errLine.textContent = "Please type a message before sending.";
    promptTextarea.focus();
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "Thinking...";

  try {
    const res = await fetch(`/api/chat/${SESSION_ID}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: clean, persona: personaSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      errLine.textContent = data.message || "Could not send message.";
      return;
    }
    promptTextarea.value = "";
    renderWorkspace(data);
  } catch {
    errLine.textContent = "Network error communicating with /api/chat.";
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send →";
  }
}

composerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  dispatchMessage(promptTextarea.value);
});

promptTextarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    dispatchMessage(promptTextarea.value);
  }
});

personaSelect.addEventListener("change", loadSession);

document.getElementById("newSessionBtn").addEventListener("click", async () => {
  const res = await fetch(`/api/chat/${SESSION_ID}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona: personaSelect.value }),
  });
  renderWorkspace(await res.json());
});

document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => {
    promptTextarea.value = btn.dataset.sample || "";
    promptTextarea.focus();
  });
});

loadSession();
