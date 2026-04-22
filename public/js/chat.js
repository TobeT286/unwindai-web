// public/js/chat.js
// Reusable chat widget. Usage: new ChatWidget('element-id', '/api/chat', options)
class ChatWidget {
  constructor(containerId, apiEndpoint, options = {}) {
    this.container = document.getElementById(containerId);
    this.apiEndpoint = apiEndpoint;
    this.placeholder = options.placeholder || 'What would you like to know?';
    this.darkMode = options.darkMode || false;
    this.messages = [];
    this.busy = false;
    this.pendingFile = null;   // { mediaType, data, name }
    this._started = false;
    this._greetAborted = false;
    this._render();
    if (options.autoGreet !== false) this._scheduleGreet();
  }

  _render() {
    if (this.darkMode) this.container.classList.add('chat-widget--dark');
    const id = this.container.id;
    this.container.innerHTML = `
      <div class="chat-messages" id="${id}-messages"></div>
      <div class="chat-input-row">
        <label class="chat-attach-btn" title="Attach image or PDF" aria-label="Attach file">
          <input type="file" accept="image/*,.pdf" id="${id}-file" style="display:none">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </label>
        <span class="chat-attach-name" id="${id}-fname"></span>
        <input type="text" id="${id}-input" placeholder="${this.placeholder}" autocomplete="off"/>
        <button id="${id}-send" type="button" class="chat-send-btn" disabled aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;

    const input = this._input();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    input.addEventListener('input', () => this._syncBtn());
    this._btn().addEventListener('click', () => this.send());

    document.getElementById(`${id}-file`).addEventListener('change', (e) => {
      this._handleFile(e.target.files[0]);
    });
  }

  _messages() { return document.getElementById(`${this.container.id}-messages`); }
  _input()    { return document.getElementById(`${this.container.id}-input`); }
  _btn()      { return document.getElementById(`${this.container.id}-send`); }
  _fname()    { return document.getElementById(`${this.container.id}-fname`); }

  _syncBtn() {
    const hasText = this._input().value.trim().length > 0;
    this._btn().disabled = !hasText && !this.pendingFile;
  }

  _handleFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('File too large — please keep under 4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result.split(',')[1];
      this.pendingFile = { mediaType: file.type || 'application/octet-stream', data, name: file.name };
      this._fname().textContent = '📎 ' + file.name;
      this._syncBtn();
    };
    reader.readAsDataURL(file);
  }

  _scheduleGreet() {
    setTimeout(() => {
      if (this._started || this._greetAborted) return;
      const msg = 'Ask me anything — data automation, data platforms, VEU energy upgrades, or helpful gadgets for personal or business finance. You can also attach a floor plan, property contract, or PDF and I\'ll review it for you.';
      this._typeGreet(msg, 26);
    }, 1200);
  }

  _typeGreet(fullText, delayMs) {
    const el = this._appendMessage('thinking', '');
    let i = 0;
    const tick = () => {
      if (this._greetAborted) { el.remove(); return; }
      if (i < fullText.length) {
        el.textContent += fullText[i++];
        this._messages().scrollTop = this._messages().scrollHeight;
        setTimeout(tick, delayMs);
      } else {
        el.className = 'chat-message chat-message--assistant';
      }
    };
    tick();
  }

  async send() {
    if (this.busy) return;
    const text = this._input().value.trim();
    if (!text && !this.pendingFile) return;

    if (!this._started) {
      this._started = true;
      this._greetAborted = true;
      this._expand();
    }

    this._input().value = '';
    this._syncBtn();

    // Build content — support file attachments
    let userContent;
    let displayText = text;
    if (this.pendingFile) {
      const isDoc = this.pendingFile.mediaType === 'application/pdf';
      const fileBlock = isDoc
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: this.pendingFile.data } }
        : { type: 'image', source: { type: 'base64', media_type: this.pendingFile.mediaType, data: this.pendingFile.data } };
      userContent = [fileBlock, { type: 'text', text: text || 'Please analyse this file.' }];
      displayText = (text ? text + ' ' : '') + '[📎 ' + this.pendingFile.name + ']';
      this.pendingFile = null;
      this._fname().textContent = '';
      document.getElementById(`${this.container.id}-file`).value = '';
    } else {
      userContent = text;
    }

    this.messages.push({ role: 'user', content: userContent });
    this._appendMessage('user', displayText);

    const thinkingEl = this._appendMessage('thinking', '…');
    this.busy = true;
    this._btn().disabled = true;

    try {
      const res = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.messages }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status} — please try again.`);

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
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.text) {
              assistantText += chunk.text;
              thinkingEl.textContent = assistantText;
              this._messages().scrollTop = this._messages().scrollHeight;
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }

      this.messages.push({ role: 'assistant', content: assistantText });
    } catch (err) {
      thinkingEl.className = 'chat-message chat-message--assistant';
      thinkingEl.textContent = err.message; // show actual error for diagnostics
    } finally {
      this.busy = false;
      this._syncBtn();
      this._input().focus();
    }
  }

  _expand() {
    const msgs = this._messages();
    if (msgs) msgs.style.maxHeight = '380px';
    const hero = document.getElementById('hero-section');
    if (hero) hero.classList.add('hero--chatting');
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
