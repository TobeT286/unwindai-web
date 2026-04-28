// public/js/chat.js  — reusable chat widget
class ChatWidget {
  constructor(containerId, apiEndpoint, options = {}) {
    this.container = document.getElementById(containerId);
    this.apiEndpoint = apiEndpoint;
    this.placeholder = options.placeholder || 'Type here...';
    this.darkMode = options.darkMode || false;
    this.greeting = options.greeting || 'Ask me anything — what brought you to visit our homepage today?';
    this.greetDelay = options.greetDelay != null ? options.greetDelay : 1000;
    this.typeSpeed = options.typeSpeed || 12;
    this.idleMessage = options.idleMessage || null;
    this.idleDelay = options.idleDelay != null ? options.idleDelay : 15000;
    this.messages = [];
    this.busy = false;
    this.pendingFile = null;
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </label>
        <span class="chat-attach-name" id="${id}-fname"></span>
        <textarea id="${id}-input" placeholder="${this.placeholder}" rows="1" autocomplete="off"></textarea>
        <button id="${id}-send" type="button" class="chat-send-btn" disabled aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;
    const input = this._input();
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } });
    input.addEventListener('input', () => {
      this._syncBtn();
      this._autosize();
      if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; }
    });
    this._btn().addEventListener('click', () => this.send());
    document.getElementById(`${id}-file`).addEventListener('change', e => this._handleFile(e.target.files[0]));
    this._addVoiceBtn();
  }

  _autosize() {
    const el = this._input();
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  _addVoiceBtn() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-AU';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-voice-btn';
    btn.setAttribute('aria-label', 'Voice input');
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
    let recording = false;
    btn.addEventListener('click', () => {
      if (recording) { recognition.stop(); return; }
      recording = true; btn.classList.add('active');
      try { recognition.start(); } catch(e) { recording = false; btn.classList.remove('active'); }
    });
    recognition.onresult = e => { this._input().value = e.results[0][0].transcript; this._syncBtn(); this._input().focus(); };
    recognition.onend = () => { recording = false; btn.classList.remove('active'); };
    recognition.onerror = () => { recording = false; btn.classList.remove('active'); };
    const row = this.container.querySelector('.chat-input-row');
    row.insertBefore(btn, this._btn());
  }

  _messages() { return document.getElementById(`${this.container.id}-messages`); }
  _input()    { return document.getElementById(`${this.container.id}-input`); }
  _btn()      { return document.getElementById(`${this.container.id}-send`); }
  _fname()    { return document.getElementById(`${this.container.id}-fname`); }

  _syncBtn() {
    this._btn().disabled = this._input().value.trim().length === 0 && !this.pendingFile;
  }

  _handleFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('File too large — please keep under 4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      this.pendingFile = { mediaType: file.type || 'application/octet-stream', data: e.target.result.split(',')[1], name: file.name };
      this._fname().textContent = '📎 ' + file.name;
      this._syncBtn();
    };
    reader.readAsDataURL(file);
  }

  _scheduleGreet() {
    setTimeout(() => {
      if (this._started || this._greetAborted) return;
      this._typeGreet(this.greeting, this.typeSpeed, () => {
        if (!this.idleMessage) return;
        this._idleTimer = setTimeout(() => {
          if (this._started || this._greetAborted) return;
          this._typeGreet(this.idleMessage, Math.max(8, this.typeSpeed - 2));
        }, this.idleDelay);
      });
    }, this.greetDelay);
  }

  _typeGreet(fullText, delayMs, onDone) {
    const el = this._appendMessage('assistant-typing', '');
    let i = 0;
    const tick = () => {
      if (this._greetAborted) { el.remove(); return; }
      if (i < fullText.length) {
        el.textContent += fullText[i++];
        this._messages().scrollTop = this._messages().scrollHeight;
        setTimeout(tick, delayMs);
      } else {
        el.className = 'chat-message chat-message--assistant';
        el.innerHTML = this._renderMarkdown(el.textContent);
        if (onDone) onDone();
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
      if (this._idleTimer) clearTimeout(this._idleTimer);
      this._expand();
    }

    this._input().value = '';
    this._syncBtn();

    let userContent, displayText = text;
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
              thinkingEl.textContent = assistantText; // plain during stream
              this._messages().scrollTop = this._messages().scrollHeight;
            }
          } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
        }
      }

      // Apply markdown formatting after stream completes
      thinkingEl.innerHTML = this._renderMarkdown(assistantText);
      this._messages().scrollTop = this._messages().scrollHeight;
      this.messages.push({ role: 'assistant', content: assistantText });
    } catch (err) {
      thinkingEl.className = 'chat-message chat-message--assistant';
      thinkingEl.textContent = err.message;
    } finally {
      this.busy = false;
      this._syncBtn();
      this._input().focus();
    }
  }

  _expand() {
    const msgs = this._messages();
    if (msgs) msgs.style.maxHeight = 'min(620px, 75vh)';
    const hero = document.getElementById('hero-section');
    if (hero) hero.classList.add('hero--chatting');
  }

  // Simple markdown → safe HTML renderer
  _renderMarkdown(raw) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeUrl = u => /^(https?:\/\/|mailto:|tel:|\/)/i.test(u) ? u : '#';
    const inline = s => s
      // [text](url) — markdown links. Mark as external if starts with http(s).
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
        const u = safeUrl(url);
        const ext = /^https?:\/\//i.test(u) ? ' target="_blank" rel="noopener"' : '';
        return '<a class="md-link" href="' + u + '"' + ext + '>' + txt + '</a>';
      })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="md-code">$1</code>');

    const lines = raw.split('\n');
    const out = [];
    let inList = false;

    for (let line of lines) {
      line = line.trimEnd();
      const isBullet = /^[-*•] /.test(line);
      const isNumbered = /^\d+\. /.test(line);

      if (isBullet || isNumbered) {
        if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
        const content = isBullet ? line.replace(/^[-*•] /, '') : line.replace(/^\d+\. /, '');
        out.push('<li>' + inline(esc(content)) + '</li>');
        continue;
      }
      if (inList) { out.push('</ul>'); inList = false; }

      if (line.startsWith('### '))      out.push('<p class="md-h4">' + inline(esc(line.slice(4))) + '</p>');
      else if (line.startsWith('## ')) out.push('<p class="md-h3">' + inline(esc(line.slice(3))) + '</p>');
      else if (line.startsWith('# '))  out.push('<p class="md-h3">' + inline(esc(line.slice(2))) + '</p>');
      else if (line.trim() === '')     out.push('<div class="md-gap"></div>');
      else                             out.push('<p class="md-p">' + inline(esc(line)) + '</p>');
    }
    if (inList) out.push('</ul>');
    return out.join('');
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
