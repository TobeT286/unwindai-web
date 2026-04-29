// public/js/contact.js — shared contact modal
// Injects a modal on page load, intercepts any link/button with
// data-contact-trigger OR href starting with mailto:thomas.taresch@unwindai.com.au.
(function() {
  var TEMPLATE = ''
    + '<div class="contact-modal" id="contact-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">'
    +   '<div class="contact-modal-backdrop" data-contact-close></div>'
    +   '<div class="contact-modal-card">'
    +     '<button class="contact-modal-close" type="button" aria-label="Close" data-contact-close>&times;</button>'
    +     '<h2 id="contact-modal-title" class="contact-modal-title">Get in touch</h2>'
    +     '<p class="contact-modal-sub">Drop us a message and we\'ll come back to you within 24 hours.</p>'
    +     '<form class="contact-modal-form" id="contact-modal-form">'
    +       '<label>Name<input type="text" name="name" required autocomplete="name" maxlength="100"></label>'
    +       '<label>Email<input type="email" name="email" required autocomplete="email" maxlength="80"></label>'
    +       '<label>Question<textarea name="question" rows="10" required maxlength="1000"></textarea></label>'
    +       '<button type="submit" class="contact-modal-btn">Send</button>'
    +       '<p class="contact-modal-status" id="contact-modal-status"></p>'
    +     '</form>'
    +   '</div>'
    + '</div>';

  function init() {
    if (document.getElementById('contact-modal')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = TEMPLATE;
    document.body.appendChild(wrap.firstChild);

    var modal = document.getElementById('contact-modal');
    var form = document.getElementById('contact-modal-form');
    var status = document.getElementById('contact-modal-status');

    function open() {
      modal.classList.add('contact-modal--open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(function() {
        var first = form.querySelector('input[name="name"]');
        if (first) first.focus();
      }, 50);
    }
    function close() {
      modal.classList.remove('contact-modal--open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    // Close handlers
    modal.querySelectorAll('[data-contact-close]').forEach(function(el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('contact-modal--open')) close();
    });

    // Intercept any contact triggers across the page
    function bindTriggers(root) {
      root.querySelectorAll('[data-contact-trigger], a[href^="mailto:thomas.taresch@unwindai.com.au"]').forEach(function(el) {
        if (el._contactBound) return;
        el._contactBound = true;
        el.addEventListener('click', function(e) {
          e.preventDefault();
          open();
        });
      });
    }
    bindTriggers(document);

    // Submit → POST /api/intake (AI router → log + email + Sheets sink)
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = form.querySelector('.contact-modal-btn');
      btn.disabled = true; btn.textContent = 'Sending…';
      status.style.color = ''; status.textContent = '';
      var fd = new FormData(form);
      var payload = {
        name: fd.get('name'),
        email: fd.get('email'),
        message: fd.get('question'),
        source: 'contact modal',
      };
      try {
        var res = await fetch('/api/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        var data = await res.json().catch(function() { return {}; });
        if (!res.ok || !data.ok) {
          throw new Error(data.error || ('Server error ' + res.status));
        }
        // Replace form with chat-style thank-you panel
        var card = modal.querySelector('.contact-modal-card');
        card.innerHTML =
          '<button class="contact-modal-close" type="button" aria-label="Close" data-contact-close>&times;</button>' +
          '<div class="contact-thanks">' +
            '<div class="contact-thanks-tick">✓</div>' +
            '<h2 class="contact-modal-title">' + escapeHtml(data.thankYou) + '</h2>' +
            (data.aiNote ? '<p class="contact-thanks-note">' + escapeHtml(data.aiNote) + '</p>' : '') +
            '<button type="button" class="contact-modal-btn" data-contact-close>Close</button>' +
          '</div>';
        card.querySelectorAll('[data-contact-close]').forEach(function(el) {
          el.addEventListener('click', close);
        });
      } catch (err) {
        status.style.color = '#dc2626';
        status.textContent = 'Something went wrong — please email info@unwindai.com.au directly.';
        btn.disabled = false; btn.textContent = 'Send';
      }
    });

    function escapeHtml(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    window.openContactModal = open;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
