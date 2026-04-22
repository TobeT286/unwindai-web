// public/js/chat.js
// Reusable chat widget. Usage: new ChatWidget('element-id', '/api/chat')
class ChatWidget {
  constructor(containerId, apiEndpoint, options = {}) {
    this.container = document.getElementById(containerId);
    this.apiEndpoint = apiEndpoint;
    this.placeholder = options.placeholder || 'What would you like to know?';
    this.darkMode = options.darkMode || false;
    this.messages = [];
    this.busy = false;
    this._render();
  }

  _render() {
    if (this.darkMode) this.container.classList.add('chat-widget--dark');
    this.container.innerHTML = `
      <div class="chat-messages" id="${this.container.id}-messages"></div>
      <div class="chat-input-row">
        <input
          type="text"
          id="${this.container.id}-input"
          placeholder="${this.placeholder}"
          autocomplete="off"
        />
        <button id="${this.container.id}-send" type="button">Send ↑</button>
      </div>
    `;
    this._input().addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    this._btn().addEventListener('click', () => this.send());
  }

  _messages() { return document.getElementById(`${this.container.id}-messages`); }
  _input()    { return document.getElementById(`${this.container.id}-input`); }
  _btn()      { return document.getElementById(`${this.container.id}-send`); }

  async send() {
    if (this.busy) return;
    const text = this._input().value.trim();
    if (!text) return;

    this._input().value = '';
    this.messages.push({ role: 'user', content: text });
    this._appendMessage('user', text);

    const thinkingEl = this._appendMessage('thinking', '…');
    this.busy = true;
    this._btn().disabled = true;

    try {
      const res = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.messages }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      thinkingEl.className = 'chat-message chat-message--assistant';
      thinkingEl.textContent = '';

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            assistantText += text;
            thinkingEl.textContent = assistantText;
            this._messages().scrollTop = this._messages().scrollHeight;
          } catch { /* ignore malformed chunks */ }
        }
      }

      this.messages.push({ role: 'assistant', content: assistantText });
    } catch (err) {
      thinkingEl.className = 'chat-message chat-message--assistant';
      thinkingEl.textContent = 'Sorry, something went wrong. Please try again.';
    } finally {
      this.busy = false;
      this._btn().disabled = false;
      this._input().focus();
    }
  }

  _appendMessage(type, text) {
    const el = document.createElement('div');
    el.className = `chat-message chat-message--${type}`;
    el.textContent = text;
    const box = this._messages();
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }
}
