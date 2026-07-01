
(function() {
  const STORAGE_KEY = '***';
  const ACCESS_KEY = '***';
  const TIER_HIERARCHY = ['all','lawyer','lawschool']; // ascending
  const TIER_INCLUDES = {
    'full': ['all','lawyer','lawschool'],
    'agent': ['all'],
    'lawyer': ['all','lawyer'],
    'lawschool': ['all','lawyer','lawschool']
  };

  function getProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { completedModules: [], quizScores: {} }; }
    catch(e) { return { completedModules: [], quizScores: {} }; }
  }
  function saveProgress(p) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch(e){} }
  function getAccess() {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY)) || null; }
    catch(e) { return null; }
  }
  function saveAccess(a) { try { localStorage.setItem(ACCESS_KEY, JSON.stringify(a)); } catch(e){} }

  window.SLAA = {
    getProgress, saveProgress, getAccess, saveAccess, applyAccessUI,
    hasTier: function(tier) {
      const a = getAccess();
      if (!a || !a.tier) return false;
      const allowed = TIER_INCLUDES[a.tier] || [];
      return allowed.includes(tier);
    },
    grant: function(tier) {
      const map = { agent: 'agent', lawyer: 'lawyer', lawschool: 'lawschool' };
      const t = map[tier] || tier;
      saveAccess({ tier: t, grantedAt: Date.now() });
    },
    sign_out: function() {
      try { localStorage.removeItem(ACCESS_KEY); } catch(e){}
      location.reload();
    }
  };

  function applyAccessUI() {
    const access = getAccess();
    // Badges in topbar
    document.querySelectorAll('.access-badge-slot').forEach(el => {
      if (access) {
        const labels = { full: 'Full Access', agent: 'Full Access', lawyer: 'Full Access', lawschool: 'Full Access' };
        el.innerHTML = `<span class="access-badge">✓ ${labels[access.tier] || 'Enrolled'}</span>`;
      } else {
        el.innerHTML = '';
      }
    });
    // Module cards: lock if not previewable and no access
    document.querySelectorAll('.module-card[data-preview="false"]').forEach(card => {
      if (!access) {
        card.classList.add('locked');
        const lockEl = card.querySelector('.lock-icon');
        if (lockEl) lockEl.style.display = 'inline-flex';
        const previewEl = card.querySelector('.preview-badge');
        if (previewEl) previewEl.style.display = 'none';
      } else {
        card.classList.remove('locked');
      }
    });
    // Library cards
    document.querySelectorAll('.library-card[data-tier]').forEach(card => {
      const tier = card.dataset.tier;
      if (!window.SLAA.hasTier(tier)) {
        card.classList.add('locked');
      } else {
        card.classList.remove('locked');
      }
    });
    // Module content lock overlay
    const lockOverlay = document.querySelector('.lock-overlay');
    if (access) {
      // User has access: hide preview blocks/lock overlay, show full gated content
      document.querySelectorAll('.preview-only').forEach(el => el.style.display = 'none');
      const lockedSnippet = document.querySelector('.locked-snippet');
      if (lockedSnippet) lockedSnippet.style.filter = 'none';
      document.querySelectorAll('[data-gated-content]').forEach(el => el.style.display = '');
    } else {
      // Ensure gated content stays hidden for non-enrolled
      document.querySelectorAll('[data-gated-content]').forEach(el => el.style.display = 'none');
    }
  }

  function normalizeMediaPlayback() {
    document.querySelectorAll('video, audio').forEach(media => {
      media.defaultPlaybackRate = 1;
      if (Math.abs(media.playbackRate - 1) > 0.01) media.playbackRate = 1;
      if ('preservesPitch' in media) media.preservesPitch = true;
      media.addEventListener('ratechange', () => {
        if (Math.abs(media.playbackRate - 1) > 0.01) media.playbackRate = 1;
      });
    });
  }

  function initQuizzes() {
    document.querySelectorAll('.quiz-container').forEach(quiz => {
      const submit = quiz.querySelector('.quiz-submit-btn');
      const moduleId = quiz.dataset.module;
      const scoreBox = quiz.querySelector('.quiz-score');
      if (submit) {
        submit.addEventListener('click', () => {
          let correct = 0, total = 0;
          quiz.querySelectorAll('.quiz-question-card[data-correct]').forEach(card => {
            const cv = card.dataset.correct;
            if (!cv) return;
            total++;
            const sel = card.querySelector('input[type="radio"]:checked');
            card.querySelectorAll('.quiz-options label').forEach(l => l.classList.remove('correct','incorrect','shown-correct'));
            if (sel) {
              if (sel.value === cv) { correct++; sel.closest('label').classList.add('correct'); }
              else {
                sel.closest('label').classList.add('incorrect');
                const cl = card.querySelector(`input[value="${cv}"]`);
                if (cl) cl.closest('label').classList.add('shown-correct');
              }
            } else {
              const cl = card.querySelector(`input[value="${cv}"]`);
              if (cl) cl.closest('label').classList.add('shown-correct');
            }
            const exp = card.querySelector('.quiz-explanation');
            if (exp) exp.classList.add('shown');
          });
          const pct = total ? Math.round(100*correct/total) : 0;
          if (scoreBox) {
            scoreBox.classList.add('shown');
            scoreBox.querySelector('.score-pct').textContent = pct + '%';
            scoreBox.querySelector('.score-detail').textContent = `${correct} of ${total} correct`;
          }
          if (moduleId) {
            const p = getProgress();
            p.quizScores[moduleId] = Math.max(p.quizScores[moduleId] || 0, pct);
            saveProgress(p);
          }
        });
      }
      quiz.querySelectorAll('.short-answer .model-answer-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const ans = btn.parentElement.querySelector('.model-answer');
          if (ans) {
            ans.classList.toggle('shown');
            btn.textContent = ans.classList.contains('shown') ? 'Hide model answer' : 'Show model answer';
          }
        });
      });
    });
  }

  function initCompleteToggle() {
    const btn = document.querySelector('.complete-toggle');
    if (!btn) return;
    const moduleId = btn.dataset.module;
    const p = getProgress();
    if (p.completedModules.includes(moduleId)) { btn.classList.add('completed'); btn.textContent = '✓ Module complete'; }
    btn.addEventListener('click', () => {
      const p = getProgress();
      if (p.completedModules.includes(moduleId)) {
        p.completedModules = p.completedModules.filter(m => m !== moduleId);
        btn.classList.remove('completed'); btn.textContent = 'Mark module complete';
      } else {
        p.completedModules.push(moduleId);
        btn.classList.add('completed'); btn.textContent = '✓ Module complete';
      }
      saveProgress(p);
      updateOverallProgress();
      updateSidebarChecks();
    });
  }

  function updateOverallProgress() {
    const total = 15;
    const p = getProgress();
    const completed = p.completedModules.length;
    const pct = Math.round(100*completed/total);
    document.querySelectorAll('.overall-progress-bar-fill').forEach(el => el.style.width = pct + '%');
    document.querySelectorAll('.overall-progress-label').forEach(el => el.textContent = `${completed}/${total} modules complete (${pct}%)`);
  }

  function updateSidebarChecks() {
    const p = getProgress();
    document.querySelectorAll('.sidebar-modules li a').forEach(a => {
      const id = a.dataset.module;
      if (p.completedModules.includes(id)) a.classList.add('completed');
      else a.classList.remove('completed');
    });
  }

  // Enrolled page: parse tier from query string and grant
  function initEnrolled() {
    if (!document.body.classList.contains('enrolled-body')) return;
    const params = new URLSearchParams(location.search);
    const tier = params.get('tier');
    if (tier) {
      window.SLAA.grant(tier);
      const labels = { full: 'Full Access', agent: 'Full Access', lawyer: 'Full Access', lawschool: 'Full Access' };
      const lbl = labels[tier] || 'Course access';
      const valEl = document.getElementById('tier-info-value');
      if (valEl) valEl.textContent = lbl;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initQuizzes();
    initCompleteToggle();
    updateOverallProgress();
    updateSidebarChecks();
    applyAccessUI();
    normalizeMediaPlayback();
    initEnrolled();
  });
})();


// ----- v4: User accounts + Server access + Cert generation -----
(function() {
  const USER_KEY = '***';
  const ACCESS_KEY = '***'; // matches v3
  const TIER_INCLUDES = {
    'full': ['all','lawyer','lawschool'],
    'agent': ['all'],
    'lawyer': ['all','lawyer'],
    'lawschool': ['all','lawyer','lawschool']
  };

  // Backend base. When deployed via Cloudflare Worker we'll set this; for now we ship a no-network mock that
  // still preserves all UX (verification code is sent locally; in prod this is replaced by /api endpoint).
  const API_BASE = window.SAA_API_BASE || '';

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; }
    catch(e) { return null; }
  }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem(USER_KEY); localStorage.removeItem(ACCESS_KEY); }

  // ----- Auth modal -----
  function ensureAuthModal() {
    if (document.querySelector('.auth-modal-backdrop')) return;
    const tpl = `
<div class="auth-modal-backdrop">
  <div class="auth-modal">
    <button class="auth-close" aria-label="Close">×</button>
    <h3>Sign in to your account</h3>
    <p>We'll email you a verification code. No password required. Your enrollment and progress sync across devices.</p>
    <input type="email" class="auth-input" id="auth-email" placeholder="you@example.com" autocomplete="email">
    <div class="auth-code-section" style="display:none;">
      <input type="text" class="auth-input" id="auth-code" placeholder="6-digit verification code" inputmode="numeric" maxlength="6">
    </div>
    <div class="auth-actions">
      <button class="btn btn-primary" id="auth-submit">Send code</button>
      <button class="btn btn-ghost" id="auth-cancel">Cancel</button>
    </div>
    <div class="auth-help">No account? Your purchase on the pricing page automatically creates one. Already paid? Enter the email you used at checkout.</div>
  </div>
</div>`;
    document.body.insertAdjacentHTML('beforeend', tpl);
    const backdrop = document.querySelector('.auth-modal-backdrop');
    backdrop.querySelector('.auth-close').onclick = () => backdrop.classList.remove('shown');
    backdrop.querySelector('#auth-cancel').onclick = () => backdrop.classList.remove('shown');
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.classList.remove('shown'); });

    const submitBtn = backdrop.querySelector('#auth-submit');
    let step = 'email';
    submitBtn.onclick = async () => {
      const email = backdrop.querySelector('#auth-email').value.trim().toLowerCase();
      if (!email || !email.includes('@')) { alert('Enter a valid email.'); return; }
      if (step === 'email') {
        submitBtn.textContent = 'Sending…';
        try {
          if (API_BASE) {
            const r = await fetch(API_BASE + '/auth/request', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})});
            if (!r.ok) throw new Error('Request failed');
          }
        } catch(e) {
          // Mock fallback: generate a code locally so the dev demo still works
          const code = Math.floor(100000 + Math.random()*900000).toString();
          window.__SAA_MOCK_CODE = code;
          console.log('SAA mock verification code:', code);
        }
        backdrop.querySelector('.auth-code-section').style.display = '';
        submitBtn.textContent = 'Verify and sign in';
        backdrop.querySelector('#auth-code').focus();
        step = 'code';
        backdrop.querySelector('.auth-help').innerHTML = 'Check your email for a 6-digit code. <a href="#" id="auth-resend">Resend?</a>';
        backdrop.querySelector('#auth-resend').onclick = (e) => { e.preventDefault(); step = 'email'; submitBtn.click(); };
      } else {
        const code = backdrop.querySelector('#auth-code').value.trim();
        if (code.length !== 6) { alert('6-digit code please.'); return; }
        submitBtn.textContent = 'Verifying…';
        try {
          if (API_BASE) {
            const r = await fetch(API_BASE + '/auth/verify', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, code})});
            if (!r.ok) { alert('Invalid code.'); submitBtn.textContent = 'Verify and sign in'; return; }
            const data = await r.json();
            const u = { email, name: data.name || email.split('@')[0], token: data.token, signedInAt: Date.now() };
            setUser(u);
            if (data.tier) localStorage.setItem(ACCESS_KEY, JSON.stringify({ tier: data.tier, grantedAt: Date.now() }));
          } else {
            if (code !== window.__SAA_MOCK_CODE) { alert('Invalid code.'); submitBtn.textContent = 'Verify and sign in'; return; }
            const u = { email, name: email.split('@')[0], token: 'mock-'+Math.random().toString(36).slice(2,18), signedInAt: Date.now() };
            setUser(u);
          }
        } catch(e) {
          alert('Sign-in failed. Try again.'); submitBtn.textContent = 'Verify and sign in'; return;
        }
        backdrop.classList.remove('shown');
        // Trigger UI refresh
        renderTopbarAccount();
        if (window.SLAA) window.SLAA.applyAccessUI && window.SLAA.applyAccessUI();
        // Reload to apply server-issued access
        location.reload();
      }
    };
  }

  function openAuth() {
    ensureAuthModal();
    document.querySelector('.auth-modal-backdrop').classList.add('shown');
  }

  // Expose
  window.SAA = {
    getUser, setUser, clearUser, openAuth,
    signOut: () => { clearUser(); location.reload(); },
    hasTier: function(tier) {
      try {
        const a = JSON.parse(localStorage.getItem(ACCESS_KEY) || 'null');
        if (!a || !a.tier) return false;
        return (TIER_INCLUDES[a.tier] || []).includes(tier);
      } catch(e) { return false; }
    },
    getTier: function() {
      try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || 'null'); } catch(e) { return null; }
    }
  };

  // Topbar account UI
  function renderTopbarAccount() {
    const slot = document.querySelector('.account-slot');
    if (!slot) return;
    const u = getUser();
    if (u) {
      const initials = (u.name || u.email).split(/[ @.]/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'U';
      slot.innerHTML = `
<a href="account/" class="account-btn" title="${u.email}">
  <span class="profile-avatar" style="width:32px;height:32px;font-size:0.85rem;display:inline-flex;vertical-align:middle;margin:0;">${initials}</span>
</a>`;
    } else {
      slot.innerHTML = `<button class="btn btn-ghost" id="signin-btn">Sign in</button>`;
      document.getElementById('signin-btn').onclick = openAuth;
    }
  }

  // Server-side access refresh: if user is signed in, sync access from server
  async function syncAccess() {
    const u = getUser();
    if (!u || !API_BASE) return;
    try {
      const r = await fetch(API_BASE + '/access?email=' + encodeURIComponent(u.email), { headers: { 'Authorization': 'Bearer ' + u.token } });
      if (r.ok) {
        const j = await r.json();
        if (j.tier) localStorage.setItem(ACCESS_KEY, JSON.stringify({ tier: j.tier, grantedAt: Date.now() }));
        renderTopbarAccount();
        if (window.SLAA && window.SLAA.applyAccessUI) window.SLAA.applyAccessUI();
      }
    } catch(e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTopbarAccount();
    syncAccess().then(() => {
      renderTopbarAccount();
      if (window.SLAA && window.SLAA.applyAccessUI) window.SLAA.applyAccessUI();
    });
    // Wire any [data-auth-trigger] elements
    document.querySelectorAll('[data-auth-trigger]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); openAuth(); });
    });
  });
})();

// ----- Certificate generator -----
window.SAA_renderCertificate = function(name, tier, dateStr, credId) {
  const tierLabel = ({full:'Full Access',agent:'Full Access',lawyer:'Full Access',lawschool:'Full Access'})[tier] || 'Full Access';
  return `
<div class="cert-preview" id="cert-svg">
  <div class="cert-seal">SPORTS<br>AGENT<br>ACADEMY</div>
  <div class="cert-academy">Sports Agent Academy</div>
  <div class="cert-academy-line"></div>
  <div class="cert-this-certifies">This certifies that</div>
  <div class="cert-name">${name}</div>
  <div class="cert-name-rule"></div>
  <div class="cert-completion">has successfully completed the certification course</div>
  <div class="cert-course-title">Sports Agent Academy Certification Program</div>
  <div class="cert-tier">${tierLabel}</div>
  <div class="cert-footer">
    <div>
      <div style="opacity:0.6;">Issued</div>
      <div>${dateStr}</div>
    </div>
    <div class="right">
      <div style="opacity:0.6;">Credential ID</div>
      <div>${credId}</div>
    </div>
  </div>
  <div class="cert-id">Verify at sportsagentacademy.io/verify/${credId}</div>
</div>`;
};

window.SAA_downloadCertificate = function() {
  const node = document.getElementById('cert-svg');
  if (!node) return;
  // Build a print-style window for PDF
  const html = `<!doctype html><html><head><title>Sports Agent Academy Certificate</title>
  <style>
    body { font-family: 'Fraunces', Georgia, serif; padding: 40px; }
    ${document.querySelector('link[href$="style.css"]') ? '' : ''}
    .cert-preview { border: 6px double #d4af37; padding: 60px; max-width: 900px; margin: auto; text-align: center; position: relative; }
    .cert-academy { letter-spacing: 0.4em; text-transform: uppercase; color: #a88a2a; font-weight: 600; }
    .cert-academy-line { width: 100px; height: 2px; background: #d4af37; margin: 16px auto; }
    .cert-name { font-size: 2.4rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
    .cert-name-rule { width: 60%; height: 1px; background: #d4af37; margin: 0.5rem auto 1.5rem; }
    .cert-course-title { font-size: 1.5rem; font-style: italic; }
    .cert-footer { display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px solid #ddd; margin-top: 40px; font-family: monospace; font-size: 0.8rem; color: #666; }
    .cert-this-certifies { font-style: italic; color: #555; }
    .cert-tier { color: #a88a2a; font-weight: 600; }
  </style></head><body>${node.outerHTML}<script>window.onload=()=>window.print();</`+`script></body></html>`;
  const w = window.open('about:blank', '_blank');
  w.document.write(html); w.document.close();
};
