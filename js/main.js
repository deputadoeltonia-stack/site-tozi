/* Professor Tozi — interações. Zero dependência, zero build. */
(function () {
  "use strict";

  /* =========================================================
     LIGAR O DESTINO DO LEAD AQUI.
     Vazio = modo DEMO: salva no localStorage e mostra sucesso.
     Cole a URL do Google Apps Script / Supabase p/ gravar de verdade.
     ========================================================= */
  const LEAD_ENDPOINT = "";

  /* WhatsApp oficial da campanha — fonte única do número no JS.
     O mesmo número aparece no HTML (hero, form, rodapé, barra mobile). */
  const WA_NUMERO = "5512920054180";          // 55 + DDD 12 + 92005-4180
  const WA_EXIBE = "(12) 92005-4180";
  const waHref = (msg) =>
    "https://wa.me/" + WA_NUMERO + (msg ? "?text=" + encodeURIComponent(msg) : "");

  /* ============ validação no boundary ============ */
  const NOME_RE = /^[\p{L}][\p{L}\s.'’-]{1,79}$/u; // começa com letra; letras/espaço/.'-
  const soDigitos = (v) => (v || "").replace(/\D/g, "");
  const validaNome = (v) => { v = (v || "").trim(); return v.length >= 2 && v.length <= 80 && NOME_RE.test(v); };
  const validaTelefone = (v) => { const d = soDigitos(v); return d.length >= 10 && d.length <= 11; };

  function mascaraTelefone(v) {
    const d = soDigitos(v).slice(0, 11);
    if (d.length <= 2) return d ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  /* ============ self-check: abra ?selftest ============ */
  function selftest() {
    const r = [];
    const t = (name, cond) => { r.push(cond); (cond ? console.log : console.error)((cond ? "✓ " : "✗ ") + name); };
    t("nome valido", validaNome("Maria da Silva"));
    t("nome com acento", validaNome("João Conceição"));
    t("nome curto rejeita", !validaNome("A"));
    t("nome com numero rejeita", !validaNome("Fulano123"));
    t("nome vazio rejeita", !validaNome("   "));
    t("tel 11 digitos ok", validaTelefone("(11) 98765-4321"));
    t("tel 10 digitos ok", validaTelefone("(11) 3456-7890"));
    t("tel curto rejeita", !validaTelefone("(11) 8765-432"));
    t("mascara 11", mascaraTelefone("11987654321") === "(11) 98765-4321");
    t("mascara 10", mascaraTelefone("1134567890") === "(11) 3456-7890");
    t("mascara ignora letras", mascaraTelefone("11x98765y4321") === "(11) 98765-4321");
    t("wa numero e55+DDD+9digitos", /^55\d{2}9\d{8}$/.test(WA_NUMERO));
    t("wa exibicao bate com o numero", soDigitos(WA_EXIBE) === WA_NUMERO.slice(2));
    t("wa href sem texto", waHref() === "https://wa.me/" + WA_NUMERO);
    t("wa href escapa texto", waHref("oi tudo bem?").indexOf("?text=oi%20tudo%20bem%3F") > 0);
    t("wa href no HTML bate com o JS",
      Array.prototype.every.call(document.querySelectorAll('a[href*="wa.me"]'),
        (a) => a.getAttribute("href").indexOf("wa.me/" + WA_NUMERO) > 0));
    const fails = r.filter((x) => !x).length;
    console.log("[selftest] " + (r.length - fails) + "/" + r.length + " passaram" + (fails ? " — FALHOU" : ""));
    return fails;
  }

  /* ============ scroll suave (JS, ~520ms ease-out) ============ */
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function scrollToY(targetY, dur) {
    if (prefersReduced) { window.scrollTo(0, targetY); return; }
    const startY = window.pageYOffset;
    const dist = targetY - startY;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, startY + dist * easeOut(p));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  function headerOffset() {
    const h = document.getElementById("header");
    return h ? h.offsetHeight : 0;
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-scroll]");
    if (!a) return;
    const id = a.getAttribute("href");
    if (!id || id.charAt(0) !== "#") return;
    const el = id === "#topo" ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    const top = id === "#topo"
      ? 0
      : Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - headerOffset() - 12);
    scrollToY(top, 520);
    history.replaceState(null, "", id === "#topo" ? location.pathname : id);
  });

  /* ============ reveal no scroll ============ */
  function initReveal() {
    if (prefersReduced || !("IntersectionObserver" in window)) return;
    // .stack fica de fora: tem motion próprio (sticky+scale), e transform
    // de reveal num ancestral quebraria o position:sticky dos cards
    const targets = document.querySelectorAll(
      ".section-head, .section-body, .quotes, .gallery, .form-grid"
    );
    targets.forEach((t) => t.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    targets.forEach((t) => io.observe(t));
    // failsafe: se o IO não disparar (aba oculta/headless), revela tudo — nunca shippar em branco
    setTimeout(() => targets.forEach((t) => t.classList.add("in")), 2500);
  }

  /* ============ formulário de lead ============ */
  function setErr(input, msgEl, msg) {
    if (msg) {
      msgEl.textContent = msg;                 // textContent, nunca innerHTML
      msgEl.hidden = false;
      if (input) input.setAttribute("aria-invalid", "true");
    } else {
      msgEl.textContent = "";
      msgEl.hidden = true;
      if (input) input.removeAttribute("aria-invalid");
    }
  }

  function mostraStatus(status, tipo, msg, acaoWa) {
    status.textContent = msg;                   // textContent
    status.className = "form-status " + tipo;
    if (acaoWa) {                               // link de WhatsApp montado no DOM, sem innerHTML
      status.appendChild(document.createElement("br"));
      const a = document.createElement("a");
      a.className = "wa-go";
      a.href = waHref(acaoWa.texto);
      a.target = "_blank";
      a.rel = "noopener";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "wa-icon");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-wa");
      svg.appendChild(use);
      a.appendChild(svg);
      a.appendChild(document.createTextNode(acaoWa.rotulo));
      status.appendChild(a);
    }
    status.hidden = false;
  }

  function acaoSucesso(nome) {
    return {
      rotulo: "Falar agora no WhatsApp " + WA_EXIBE,
      texto: "Olá! Sou " + nome + ". Acabei de me cadastrar no site do Professor Tozi e quero participar da campanha.",
    };
  }

  function enviarLead(lead, form, status) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const primeiro = lead.nome.split(" ")[0];

    if (!LEAD_ENDPOINT) {                        // modo demo
      try {
        const arr = JSON.parse(localStorage.getItem("tozi_leads") || "[]");
        arr.push(lead);
        localStorage.setItem("tozi_leads", JSON.stringify(arr));
      } catch (_) { /* localStorage indisponível: segue mostrando sucesso */ }
      form.reset();
      btn.disabled = false;
      mostraStatus(status, "ok",
        "Recebido! Obrigado, " + primeiro + ". A equipe do Professor Tozi vai falar com você. (modo demo — lead salvo localmente)",
        acaoSucesso(lead.nome));
      return;
    }

    fetch(LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    })
      .then((res) => {
        if (!res.ok) throw new Error("http " + res.status);
        form.reset();
        mostraStatus(status, "ok", "Recebido! Obrigado, " + primeiro + ". A equipe vai falar com você.",
          acaoSucesso(lead.nome));
      })
      .catch(() => mostraStatus(status, "bad", "Não deu para enviar agora. Tente de novo ou chame a equipe direto.",
        { rotulo: "WhatsApp " + WA_EXIBE, texto: "Olá! Tentei me cadastrar no site do Professor Tozi e o envio falhou." }))
      .finally(() => { btn.disabled = false; });
  }

  function initForm() {
    const form = document.getElementById("lead-form");
    if (!form) return;
    const nome = form.nome, tel = form.telefone, lgpd = form.lgpd;
    const nomeErr = document.getElementById("nome-err");
    const telErr = document.getElementById("tel-err");
    const lgpdErr = document.getElementById("lgpd-err");
    const status = document.getElementById("form-status");

    tel.addEventListener("input", () => { tel.value = mascaraTelefone(tel.value); setErr(tel, telErr, ""); });
    nome.addEventListener("input", () => setErr(nome, nomeErr, ""));
    lgpd.addEventListener("change", () => setErr(null, lgpdErr, ""));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (form.website && form.website.value) return; // honeypot: bot → aborta calado

      let bad = false;
      if (!validaNome(nome.value)) { setErr(nome, nomeErr, "Digite seu nome completo."); bad = true; } else setErr(nome, nomeErr, "");
      if (!validaTelefone(tel.value)) { setErr(tel, telErr, "Telefone com DDD, 10 ou 11 dígitos."); bad = true; } else setErr(tel, telErr, "");
      if (!lgpd.checked) { setErr(null, lgpdErr, "Marque a autorização para continuar."); bad = true; } else setErr(null, lgpdErr, "");
      if (bad) { status.hidden = true; return; }

      enviarLead({ nome: nome.value.trim(), telefone: soDigitos(tel.value), em: new Date().toISOString() }, form, status);
    });
  }

  /* ============ boot ============ */
  function boot() {
    document.body.classList.add("is-loaded");
    initReveal();
    initForm();
    if (location.search.indexOf("selftest") !== -1) selftest();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
