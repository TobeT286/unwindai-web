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
    +       '<label>Name<input type="text" name="name" required autocomplete="name"></label>'
    +       '<label>Email<input type="email" name="email" required autocomplete="email"></label>'
    +       '<label>Question<textarea name="question" rows="10" required></textarea></label>'
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

    // Submit (placeholder — wire to /api/contact later)
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = form.querySelector('.contact-modal-btn');
      btn.disabled = true; btn.textContent = 'Sending…';
      status.textContent = '';
      // TODO: POST to /api/contact when endpoint exists
      setTimeout(function() {
        status.textContent = "Thanks! We'll be in touch within 24 hours.";
        btn.textContent = 'Sent ✓';
        setTimeout(function() {
          close();
          form.reset();
          btn.disabled = false; btn.textContent = 'Send';
          status.textContent = '';
        }, 1400);
      }, 700);
    });

    window.openContactModal = open;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
