// AWLN — main.js
// Wires up the inline subscribe form to Ghost's members API. Ghost Portal
// handles the nav buttons automatically via data-portal attributes.

(function () {
  'use strict';

  document.querySelectorAll('form[data-members-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailInput = form.querySelector('input[type="email"]');
      var email = emailInput && emailInput.value.trim();
      if (!email) return;

      var button = form.querySelector('button');
      var originalText = button.textContent;
      button.textContent = 'Signing you up…';
      button.disabled = true;

      fetch('/members/api/send-magic-link/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, emailType: 'subscribe' })
      })
        .then(function (res) {
          if (res.ok) {
            form.innerHTML = '<p style="color:var(--paper);font-family:var(--font-sans);font-size:0.95rem;">Check your email to confirm your subscription.</p>';
          } else {
            button.textContent = originalText;
            button.disabled = false;
            alert('Sorry — something went wrong. Please try again.');
          }
        })
        .catch(function () {
          button.textContent = originalText;
          button.disabled = false;
        });
    });
  });

  // Smooth scroll for in-page anchors (skip Ghost Portal anchors like #/portal/...)
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      if (id.length <= 1 || id.startsWith('#/')) return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Archive page: hide year label when the previous item has the same year.
  // Uses a class hook because CSS can't compare attribute values across siblings.
  var archiveItems = document.querySelectorAll('.qh-archive-item');
  if (archiveItems.length) {
    var lastYear = null;
    archiveItems.forEach(function (item) {
      var year = item.getAttribute('data-year');
      if (year === lastYear) {
        item.classList.add('qh-year-hidden');
      }
      lastYear = year;
    });
  }

  // Title emphasis: convert *word* in titles to <em>word</em> for accent
  // styling. Ghost stores titles as plain text and escapes HTML, so this is
  // how we get inline emphasis in titles. Word boundaries are kept intact so
  // "*foo*" works but "2*3*4" doesn't accidentally trigger.
  var titleSelectors = [
    '.qh-article-title',
    '.qh-featured-title',
    '.qh-card-title',
    '.qh-archive-title'
  ];
  document.querySelectorAll(titleSelectors.join(',')).forEach(function (el) {
    // Walk text nodes only — leaves any pre-existing markup alone
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) { nodes.push(node); }
    nodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      if (text.indexOf('*') === -1) return;
      // Match *content* where content has no asterisks. Greedy enough to
      // handle multi-word emphasis like *blur and accidents*.
      if (!/\*[^*]+\*/.test(text)) return;
      var frag = document.createDocumentFragment();
      var lastIndex = 0;
      var pattern = /\*([^*]+)\*/g;
      var match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        var em = document.createElement('em');
        em.textContent = match[1];
        frag.appendChild(em);
        lastIndex = pattern.lastIndex;
      }
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    });
  });

  // Title accent via <meta name="awln-accent" content="…"> in the post's
  // codeinjection_head. Lets us keep titles plain in the database (and
  // therefore in RSS, social shares, browser tabs, search results) while
  // still rendering one phrase in the accent color on the rendered site.
  //
  // Two paths:
  //   - Post page: read the meta tag from the live document <head>, apply
  //     to the article title.
  //   - Card listings (homepage, archive, tag, author pages): each card
  //     carries data-codeinjection-head with the post's full code-injection
  //     head string. We regex out the awln-accent meta and apply to the
  //     card's title.
  //
  // Runs alongside the asterisk logic above. Both can coexist; legacy
  // posts with *word* in the title keep working until you migrate them.
  function applyAccentToTitle (titleEl, accent) {
    if (!titleEl || !accent) return;
    if (titleEl.querySelector('em')) return;  // asterisk path already handled it
    var text = titleEl.textContent;
    var idx = text.indexOf(accent);
    if (idx < 0) return;
    var before = text.slice(0, idx);
    var after = text.slice(idx + accent.length);
    titleEl.textContent = '';
    if (before) titleEl.appendChild(document.createTextNode(before));
    var em = document.createElement('em');
    em.textContent = accent;
    titleEl.appendChild(em);
    if (after) titleEl.appendChild(document.createTextNode(after));
  }

  function extractAccentFromHead (headStr) {
    if (!headStr) return null;
    var tagMatch = headStr.match(/<meta\b[^>]*\bname=["']awln-accent["'][^>]*>/i);
    if (!tagMatch) return null;
    var contentMatch = tagMatch[0].match(/\bcontent=["']([^"']+)["']/i);
    return contentMatch ? contentMatch[1] : null;
  }

  // Post page (head has the live <meta>).
  var postAccentMeta = document.querySelector('meta[name="awln-accent"]');
  if (postAccentMeta) {
    applyAccentToTitle(
      document.querySelector('.qh-article-title'),
      postAccentMeta.getAttribute('content') || ''
    );
  }

  // Card listings (each card carries data-codeinjection-head).
  document.querySelectorAll('[data-codeinjection-head]').forEach(function (card) {
    var accent = extractAccentFromHead(card.getAttribute('data-codeinjection-head'));
    if (!accent) return;
    var title = card.querySelector(
      '.qh-card-title, .qh-featured-title, .qh-archive-title'
    );
    applyAccentToTitle(title, accent);
  });

  // Admin edit link: shown only when admin mode is on in this browser.
  // Toggle: visit any page with ?awln_admin=1 to enable, ?awln_admin=0 to
  // disable. Stored in localStorage and persists across sessions on this
  // device. The actual link target is computed from the post/page article's
  // data-post-id and data-post-type attributes.
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.has('awln_admin')) {
      if (params.get('awln_admin') === '1') {
        localStorage.setItem('awln_admin', '1');
      } else {
        localStorage.removeItem('awln_admin');
      }
    }
    if (localStorage.getItem('awln_admin') === '1') {
      var editLink = document.querySelector('[data-edit-link]');
      if (editLink) {
        var article = document.querySelector('[data-post-id]');
        if (article) {
          var id = article.getAttribute('data-post-id');
          var type = article.getAttribute('data-post-type') || 'post';
          editLink.href = '/ghost/#/editor/' + type + '/' + id;
        }
        // On non-post pages the link still points at /ghost/ (the dashboard).
        editLink.removeAttribute('hidden');
      }
    }
  } catch (e) {
    // localStorage can throw in private mode; silently skip in that case.
  }

  // Mobile hamburger menu. Builds a dropdown from the primary nav links
  // plus a Subscribe button, and toggles visibility when the hamburger
  // button is clicked.
  var toggle = document.querySelector('.qh-nav-toggle');
  var headerNavUl = document.querySelector('.qh-nav .qh-nav-inner > .qh-nav-links');
  if (toggle && headerNavUl) {
    var menu = document.createElement('div');
    menu.className = 'qh-mobile-menu';
    var ul = document.createElement('ul');
    // Clone each nav item into the mobile menu
    headerNavUl.querySelectorAll('a').forEach(function (link) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = link.textContent;
      li.appendChild(a);
      ul.appendChild(li);
    });
    menu.appendChild(ul);

    // Prepend a search entry — taps the same Ghost native search modal
    // as the desktop magnifying glass. Uses a button rather than a link
    // since data-ghost-search doesn't need a real href.
    var searchLi = document.createElement('li');
    var searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'qh-mobile-search';
    searchBtn.setAttribute('data-ghost-search', '');
    searchBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.35-4.35"></path></svg><span>Search</span>';
    searchLi.appendChild(searchBtn);
    ul.insertBefore(searchLi, ul.firstChild);

    // Theme toggle entry — mirrors the desktop .qh-theme-toggle button.
    // Tapping triggers a click on the (hidden) desktop button so all the
    // persistence + theme-color meta logic stays in one place. The label
    // describes what tapping will switch TO ("Dark mode" / "Light mode"),
    // matching the icon convention used elsewhere.
    var themeLi = document.createElement('li');
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'qh-mobile-theme';
    themeBtn.innerHTML = '' +
      '<svg class="qh-theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4"></circle>' +
        '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>' +
      '</svg>' +
      '<svg class="qh-theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>' +
      '</svg>' +
      '<span class="qh-mobile-theme-label"></span>';
    themeLi.appendChild(themeBtn);
    ul.insertBefore(themeLi, searchLi.nextSibling);

    function isCurrentlyDark () {
      var saved = document.documentElement.getAttribute('data-theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    function syncThemeLabel () {
      var label = themeBtn.querySelector('.qh-mobile-theme-label');
      label.textContent = isCurrentlyDark() ? 'Light mode' : 'Dark mode';
    }
    syncThemeLabel();
    themeBtn.addEventListener('click', function () {
      var desktopToggle = document.querySelector('.qh-theme-toggle');
      if (desktopToggle) desktopToggle.click();
      syncThemeLabel();
    });


    // Append Subscribe / Account as a pill inside the menu so mobile users
    // can still reach portal actions.
    var navSub = document.querySelector('.qh-nav-subscribe');
    if (navSub) {
      var subLi = document.createElement('li');
      var subA = document.createElement('a');
      subA.href = navSub.getAttribute('href');
      subA.textContent = navSub.textContent;
      subA.className = 'qh-mobile-subscribe';
      if (navSub.hasAttribute('data-portal')) {
        subA.setAttribute('data-portal', navSub.getAttribute('data-portal'));
      }
      subLi.appendChild(subA);
      ul.appendChild(subLi);
    }

    // Inject into nav
    document.querySelector('.qh-nav').appendChild(menu);

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu on link click or on search-button click (search opens
    // its own modal over the page, menu should get out of the way).
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a, .qh-mobile-search')) {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Theme toggle (light/dark). Clicking cycles: auto (OS default) -> opposite
  // of current -> other -> back to opposite... essentially it just flips the
  // current visible theme. The choice is persisted in localStorage so it
  // sticks across page loads, and the inline script in default.hbs applies
  // it before paint to avoid flash-of-wrong-theme.
  var themeToggle = document.querySelector('.qh-theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var root = document.documentElement;
      var current = root.getAttribute('data-theme');
      // Figure out what's actually showing right now
      var osLikesDark = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = current === 'dark' || (!current && osLikesDark);
      // Flip it
      var next = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('awln_theme', next); } catch (e) {}

      // Also flip the theme-color meta so Safari chrome updates live. The
      // media-scoped meta tags won't change, but adding a bare one that
      // matches the current theme takes precedence.
      var tintLight = '#d9d1c0';
      var tintDark = '#3d342c';
      var meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = next === 'dark' ? tintDark : tintLight;
    });
  }

  // Lightbox for gallery grid images only. Clicks on any .kg-gallery-image
  // open a full-viewport overlay with a large version. Arrow keys cycle
  // through the rest of the gallery. Esc closes. Standalone images and
  // hero images are not affected.
  var galleryImages = Array.prototype.slice.call(
    document.querySelectorAll('.qh-prose .kg-gallery-image img')
  );
  if (galleryImages.length) {
    // Build the overlay once, reuse across clicks
    var overlay = document.createElement('div');
    overlay.className = 'qh-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = [
      '<button class="qh-lightbox-close" aria-label="Close">&times;</button>',
      '<button class="qh-lightbox-prev" aria-label="Previous">&#10094;</button>',
      '<button class="qh-lightbox-next" aria-label="Next">&#10095;</button>',
      '<figure class="qh-lightbox-figure">',
      '  <img class="qh-lightbox-img" alt="">',
      '  <figcaption class="qh-lightbox-caption"></figcaption>',
      '</figure>'
    ].join('');
    document.body.appendChild(overlay);

    var overlayImg = overlay.querySelector('.qh-lightbox-img');
    var overlayCap = overlay.querySelector('.qh-lightbox-caption');
    var prevBtn = overlay.querySelector('.qh-lightbox-prev');
    var nextBtn = overlay.querySelector('.qh-lightbox-next');
    var closeBtn = overlay.querySelector('.qh-lightbox-close');
    var currentIndex = -1;

    // Pick the biggest source available — try srcset first, then src
    function bestSrc (img) {
      if (img.srcset) {
        var entries = img.srcset.split(',').map(function (s) {
          var parts = s.trim().split(/\s+/);
          var width = parts[1] ? parseInt(parts[1], 10) : 0;
          return { url: parts[0], width: width };
        });
        entries.sort(function (a, b) { return b.width - a.width; });
        if (entries[0] && entries[0].url) return entries[0].url;
      }
      return img.src;
    }

    function show (i) {
      if (i < 0 || i >= galleryImages.length) return;
      currentIndex = i;
      var img = galleryImages[i];
      overlayImg.src = bestSrc(img);
      overlayImg.alt = img.alt || '';
      var capText = img.alt || '';
      if (capText) {
        overlayCap.textContent = capText;
        overlayCap.style.display = '';
      } else {
        overlayCap.style.display = 'none';
      }
      // Hide prev/next when at edges — galleries can be any size
      prevBtn.style.visibility = i === 0 ? 'hidden' : '';
      nextBtn.style.visibility = i === galleryImages.length - 1 ? 'hidden' : '';
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    function close () {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      overlayImg.src = '';
      currentIndex = -1;
    }

    function next () { show(currentIndex + 1); }
    function prev () { show(currentIndex - 1); }

    // Wire up clicks on gallery images
    galleryImages.forEach(function (img, idx) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function (e) {
        e.preventDefault();
        show(idx);
      });
    });

    // Overlay controls
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    // Click outside the image to close
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    // Keyboard: Esc closes, arrow keys navigate
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    });
  }

  // Social web replies. Reads a JSON script tag (#awln-replies) injected via
  // the post's Code Injection Foot field, containing a list of Mastodon/Bluesky
  // post URLs. Fetches each via the platform's public API, renders unified
  // cards styled to match the blog. No external libraries.
  //
  // IMPORTANT: Ghost renders {{ghost_foot}} AFTER this script loads, so the
  // #awln-replies script tag isn't in the DOM yet when main.js executes.
  // We defer via DOMContentLoaded (or run immediately if already past that).
  function initReplies () {
    var container = document.querySelector('[data-qh-replies]');
    if (!container) return;

    // Relocate the .rss-only reply prompt (if any) from the end of the post
    // body into the replies container so visually it sits below tags + HR
    // (qh-replies' top border) but above the social-replies heading.
    // RSS feeds, which don't run JS, still see the prompt at the end of the
    // post HTML — that's where it's authored in the lexical body.
    var rssOnly = document.querySelector('.qh-prose .rss-only');
    var hasRssOnly = false;
    if (rssOnly) {
      container.insertBefore(rssOnly, container.firstChild);
      hasRssOnly = true;
    }

    var headingEl = container.querySelector('.qh-replies-heading');
    var listEl = container.querySelector('.qh-replies-list');

    // When there's nothing to fetch (or the fetches all fail), keep the
    // container around if there's an rss-only prompt to show; just hide
    // the heading + list. Otherwise remove the container entirely.
    function showOnlyPromptOrRemove () {
      if (!hasRssOnly) { container.remove(); return; }
      if (headingEl) headingEl.hidden = true;
      if (listEl) listEl.hidden = true;
      container.hidden = false;
    }

    var dataEl = document.getElementById('awln-replies');
    if (!dataEl) { showOnlyPromptOrRemove(); return; }

    var urls = [];
    try {
      var parsed = JSON.parse(dataEl.textContent);
      urls = Array.isArray(parsed) ? parsed : (parsed.replies || []);
    } catch (e) { showOnlyPromptOrRemove(); return; }
    if (!urls.length) { showOnlyPromptOrRemove(); return; }

    var list = listEl;

    // Strip all HTML except for <a>, <br>, <p> — Mastodon sends sanitized
    // HTML but we want a minimal rendering. Uses DOM parsing rather than
    // regex so we can't accidentally create XSS via malformed tags.
    function sanitize (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var allowed = { A: true, BR: true, P: true, SPAN: true };
      function walk (node) {
        var kids = Array.prototype.slice.call(node.childNodes);
        kids.forEach(function (kid) {
          if (kid.nodeType === 1) {
            if (!allowed[kid.tagName]) {
              // Replace element with its text contents
              var text = document.createTextNode(kid.textContent);
              kid.parentNode.replaceChild(text, kid);
            } else {
              // Strip all attributes except href on <a>
              var attrs = Array.prototype.slice.call(kid.attributes);
              attrs.forEach(function (a) {
                if (kid.tagName === 'A' && a.name === 'href') {
                  // Only allow safe schemes
                  if (/^(https?:|mailto:)/i.test(a.value)) {
                    kid.setAttribute('target', '_blank');
                    kid.setAttribute('rel', 'noopener nofollow');
                  } else {
                    kid.removeAttribute('href');
                  }
                } else {
                  kid.removeAttribute(a.name);
                }
              });
              walk(kid);
            }
          }
        });
      }
      walk(doc.body);
      return doc.body.innerHTML;
    }

    function fmtDate (iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric'
        });
      } catch (e) { return ''; }
    }

    function escapeHtml (s) {
      return (s || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    // Render a unified card given normalized data (Variant A: threaded comments style)
    function renderCard (reply) {
      var avatar = reply.avatar
        ? '<img src="' + escapeHtml(reply.avatar) + '" alt="" loading="lazy">'
        : '';
      return [
        '<div class="qh-reply">',
        '  <a class="qh-reply-avatar" href="' + escapeHtml(reply.authorUrl) + '" target="_blank" rel="noopener">',
        avatar,
        '  </a>',
        '  <div class="qh-reply-main">',
        '    <div class="qh-reply-head">',
        '      <a class="qh-reply-name" href="' + escapeHtml(reply.authorUrl) + '" target="_blank" rel="noopener">',
        escapeHtml(reply.name),
        '      </a>',
        '      <span class="qh-reply-handle">' + escapeHtml(reply.handle) + '</span>',
        '      <span class="qh-reply-date" data-platform="' + reply.platform + '">',
        '        <a href="' + escapeHtml(reply.url) + '" target="_blank" rel="noopener">',
        fmtDate(reply.createdAt) || 'View',
        '        </a>',
        '      </span>',
        '    </div>',
        '    <div class="qh-reply-body">' + reply.content + '</div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    // --- Mastodon fetching -------------------------------------------------
    // URL format: https://instance.tld/@user/statusId
    //         or: https://instance.tld/users/name/statuses/statusId
    function fetchMastodon (url) {
      var u = new URL(url);
      var id = null;
      var m = u.pathname.match(/\/(?:@[^/]+|users\/[^/]+\/statuses)\/(\d+)/);
      if (m) id = m[1];
      if (!id) return Promise.reject(new Error('No status id'));
      var apiUrl = u.origin + '/api/v1/statuses/' + id;
      return fetch(apiUrl).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (s) {
        return {
          platform: 'mastodon',
          name: s.account.display_name || s.account.username,
          handle: '@' + s.account.acct + (s.account.acct.indexOf('@') === -1 ? '@' + u.host : ''),
          authorUrl: s.account.url,
          avatar: s.account.avatar,
          content: sanitize(s.content),
          createdAt: s.created_at,
          url: s.url || url
        };
      });
    }

    // --- Bluesky fetching --------------------------------------------------
    // URL format: https://bsky.app/profile/handle.or.did/post/rkey
    // AT-URI form: at://did:plc:xxx/app.bsky.feed.post/rkey
    function fetchBluesky (url) {
      var u = new URL(url);
      var m = u.pathname.match(/\/profile\/([^/]+)\/post\/([^/]+)/);
      if (!m) return Promise.reject(new Error('Invalid bsky URL'));
      var handleOrDid = m[1];
      var rkey = m[2];

      // Resolve handle to did if it's not already a did
      var didPromise;
      if (handleOrDid.indexOf('did:') === 0) {
        didPromise = Promise.resolve(handleOrDid);
      } else {
        didPromise = fetch(
          'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=' +
          encodeURIComponent(handleOrDid)
        ).then(function (r) { return r.json(); })
         .then(function (j) { return j.did; });
      }

      return didPromise.then(function (did) {
        var atUri = 'at://' + did + '/app.bsky.feed.post/' + rkey;
        var apiUrl = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=' +
          encodeURIComponent(atUri) + '&depth=0';
        return fetch(apiUrl);
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        var post = j.thread && j.thread.post;
        if (!post) throw new Error('No post in response');
        var text = post.record && post.record.text || '';
        // Bluesky text is plain — wrap in a p, convert newlines to <br>
        var html = '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
        return {
          platform: 'bluesky',
          name: post.author.displayName || post.author.handle,
          handle: '@' + post.author.handle,
          authorUrl: 'https://bsky.app/profile/' + post.author.handle,
          avatar: post.author.avatar,
          content: html,
          createdAt: post.record.createdAt,
          url: url
        };
      });
    }

    function fetchOne (url) {
      try {
        var u = new URL(url);
        if (u.host === 'bsky.app' || u.host.endsWith('.bsky.app')) {
          return fetchBluesky(url);
        }
        // Default: assume Mastodon (any instance)
        return fetchMastodon(url);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    // Kick off all fetches in parallel. Failed ones are silently skipped.
    var pending = urls.map(function (url) {
      return fetchOne(url).catch(function (err) {
        console.warn('[awln-replies] Failed to load', url, err);
        return null;
      });
    });

    Promise.all(pending).then(function (results) {
      var valid = results.filter(Boolean);
      if (!valid.length) {
        showOnlyPromptOrRemove();
        return;
      }
      // Sort oldest-first to read like a comment thread
      valid.sort(function (a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      list.innerHTML = valid.map(renderCard).join('');
      container.hidden = false;
    });
  }

  // Run replies init after Ghost has injected the footer JSON. If DOM is
  // already parsed (e.g. script loaded after), run immediately; otherwise
  // wait for DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReplies);
  } else {
    initReplies();
  }
  // Tag index page (/tag/) — client-side sort.
  // Three modes: alpha (default), popular (most posts), reverse (fewest).
  // Tags are emitted in HBS as inline <span class="qh-tag-item"> wrappers
  // (with comma separators via CSS ::after) so we can re-sort the DOM in
  // place without re-rendering. The :last-of-type selector keeps the
  // trailing comma off whichever tag ends up last after sorting.
  var tagList = document.querySelector('.qh-tag-list');
  var sortBtns = document.querySelectorAll('.qh-tags-sort button');
  if (tagList && sortBtns.length) {
    sortBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.dataset.sort;
        sortBtns.forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');

        var items = Array.prototype.slice.call(
          tagList.querySelectorAll('.qh-tag-item'));
        items.sort(function (a, b) {
          if (mode === 'alpha') {
            return a.dataset.name.localeCompare(b.dataset.name,
              undefined, { sensitivity: 'base' });
          }
          if (mode === 'popular') {
            return parseInt(b.dataset.count, 10) - parseInt(a.dataset.count, 10);
          }
          if (mode === 'reverse') {
            return parseInt(a.dataset.count, 10) - parseInt(b.dataset.count, 10);
          }
          return 0;
        });
        items.forEach(function (item) { tagList.appendChild(item); });
      });
    });
  }

})();
