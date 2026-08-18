/* Professor Tozi — interações. Zero dependência, zero build. */
(function () {
  "use strict";

  /* =========================================================
     LIGAR O DESTINO DO LEAD AQUI.
     Vazio = modo DEMO: salva no localStorage e mostra sucesso.
     Cole a URL do Google Apps Script / Supabase p/ gravar de verdade.
     ========================================================= */
  const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbyBdY45weHbgTSWLBt0ymfRSHPmz4vHVGdEiu13T3o3yGejT36JiGPauMrxmv-vRz-j/exec";

  /* Mesma planilha do site do Dr. Elton; o campo `origem` é o que manda o lead
     para a aba "Pagina Tozi" em vez da aba padrão. Mudar aqui sem mudar o
     ABA_POR_ORIGEM do Apps Script faz o lead cair na aba errada, não sumir. */
  const LEAD_ORIGEM = "site-tozi";

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

  // Um clique cancela a rolagem do clique anterior. Sem o token, dois toques
  // seguidos (o menu fecha e o link rola — acontece no mobile) deixavam DOIS
  // laços de rAF vivos, cada um chamando scrollTo com um alvo diferente no
  // mesmo frame: a página tremia e parava no meio do caminho.
  let rolagem = 0;
  function scrollToY(targetY, dur) {
    if (prefersReduced) { window.scrollTo(0, targetY); return; }
    const meu = ++rolagem;
    const startY = window.pageYOffset;
    const dist = targetY - startY;
    const t0 = performance.now();
    (function step(now) {
      if (meu !== rolagem) return;
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
    // location.search junto: sem ele, um clique na marca ("#topo") reescrevia
    // a URL só com o pathname e derrubava os ?utm_ do link que trouxe a
    // pessoa — a campanha perdia a origem do tráfego no meio da visita.
    history.replaceState(null, "", id === "#topo" ? location.pathname + location.search : id);
  });

  /* ============ SpotlightCard (porte vanilla do React Bits) ============
     Luz radial segue o cursor. Um mousemove delegado na .stack em vez de
     um por card. Sem gate de reduced-motion: é resposta a gesto do usuário
     e só mexe em opacidade/cor, igual à régua de leitura. */
  function initSpotlight() {
    const stack = document.getElementById("propostas-stack");
    if (!stack) return;
    stack.addEventListener("mousemove", (e) => {
      const card = e.target.closest(".p-card-inner");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", (e.clientX - r.left) + "px");
      card.style.setProperty("--mouse-y", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  /* ============ reveal no scroll ============ */
  function initReveal() {
    if (prefersReduced || !("IntersectionObserver" in window)) return;
    // .stack fica de fora: tem motion próprio (sticky+scale), e transform
    // de reveal num ancestral quebraria o position:sticky dos cards
    const targets = document.querySelectorAll(
      ".section-head, .section-body, .quotes, .gallery, .form-grid"
    );
    targets.forEach((t) => t.classList.add("reveal"));
    let respondeu = false;
    const io = new IntersectionObserver((entries) => {
      respondeu = true;
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    targets.forEach((t) => io.observe(t));
    // Failsafe para o IO que nunca dispara (aba oculta, headless): nunca
    // shippar em branco. SÓ nesse caso — revelar tudo incondicionalmente
    // matava o efeito na página inteira, porque o IO responde já no primeiro
    // frame e os 2,5s venciam com o visitante ainda lendo a capa: dali em
    // diante toda seção abaixo da dobra já nascia revelada.
    setTimeout(() => {
      if (!respondeu) targets.forEach((t) => t.classList.add("in"));
    }, 2500);
  }

  /* ============ pôster dos vídeos, só quando chega perto ============
     `preload="none"` segura o vídeo, não o pôster: o navegador busca a
     imagem do pôster na hora, e eram 79 KB (27 + 52) gastos na abertura por
     duas imagens sete seções abaixo. rootMargin de 400px promove o pôster
     antes de a pessoa chegar, então ela nunca vê o quadro vazio.
     Sem IntersectionObserver o pôster entra de uma vez — o navegador velho
     volta ao comportamento de antes, que funcionava. */
  function initPosters() {
    const videos = document.querySelectorAll("video[data-poster]");
    if (!videos.length) return;
    const por = (v) => {
      v.poster = v.dataset.poster;
      v.removeAttribute("data-poster");
    };
    if (!("IntersectionObserver" in window)) { videos.forEach(por); return; }
    let respondeu = false;
    const io = new IntersectionObserver((entries) => {
      respondeu = true;
      entries.forEach((en) => {
        if (en.isIntersecting) { por(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: "400px 0px" });
    videos.forEach((v) => io.observe(v));
    // O IO existe mas pode ficar mudo (aba em segundo plano, viewport de
    // altura zero). Sem rede de segurança o vídeo abriria em quadro preto.
    // Amarrada à PRIMEIRA rolagem, não a um timer: quem não desce a página
    // continua sem pagar os 79 KB, que é o motivo de tudo isto existir.
    window.addEventListener("scroll", function aoRolar() {
      window.removeEventListener("scroll", aoRolar);
      if (!respondeu) videos.forEach(por);
    }, { passive: true, once: true });
  }

  /* ============ header camaleão ============
     Seções escuras levam [data-header-dark]; quando uma delas passa sob a
     linha do header, ele veste a pele navy (.on-dark). Scroll + rAF em vez
     de IntersectionObserver: 3 getBoundingClientRect por frame é barato e
     o resultado é determinístico (IO com rootMargin varia por viewport). */
  function initHeaderTheme() {
    const header = document.getElementById("header");
    if (!header) return;
    const darks = Array.prototype.slice.call(document.querySelectorAll("[data-header-dark]"));
    if (!darks.length) return;
    /* a capa é sticky: o rect dela cruza a linha do header a rolagem INTEIRA.
       Sem isso o header ficaria preso na pele clara pra sempre. A capa só
       conta como escura enquanto a folha não a cobriu. */
    const capa = document.querySelector(".hero");
    const folha = document.querySelector(".folha");
    let ticking = false;
    function apply() {
      ticking = false;
      /* sonda 1px ABAIXO do header: no scroll 0 o hero começa exatamente no
         bottom do header sticky — sondar dentro da faixa do header nunca
         encosta no hero e o topo ficava com a pele clara errada */
      const linha = header.getBoundingClientRect().bottom + 1;
      const capaCoberta = !!(folha && folha.getBoundingClientRect().top <= linha);
      const sobreEscuro = darks.some(function (el) {
        if (el === capa && capaCoberta) return false;
        const r = el.getBoundingClientRect();
        return r.top <= linha && r.bottom >= linha;
      });
      header.classList.toggle("on-dark", sobreEscuro);
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener("resize", apply);
    apply();
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
      a.appendChild(document.createTextNode(acaoWa.rotulo + " "));
      a.appendChild(svg);                       // como estava: logo no fim (padrão só mudou no rodapé)
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
      // text/plain de proposito: application/json dispara preflight OPTIONS,
      // e o Apps Script nao responde OPTIONS — o envio morria antes de chegar.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(lead),
    })
      .then((res) => {
        if (!res.ok) throw new Error("http " + res.status);
        return res.text().then((t) => {
          try {
            const j = JSON.parse(t);
            if (j && j.ok === false) throw new Error(j.msg || "recusado");
          } catch (e) {
            if (e instanceof SyntaxError) return;   // corpo opaco: 200 ja basta
            throw e;
          }
        });
      })
      .then(() => {
        form.reset();
        mostraStatus(status, "ok", "Recebido! Obrigado, " + primeiro + ". A equipe vai falar com você.",
          acaoSucesso(lead.nome));
      })
      .catch(() => mostraStatus(status, "bad", "Não deu para enviar agora. Tente de novo ou chame a equipe direto.",
        { rotulo: "WhatsApp " + WA_EXIBE, texto: "Olá! Tentei me cadastrar no site do Professor Tozi e o envio falhou." }))
      .finally(() => { btn.disabled = false; });
  }

  /* Abre a conexão com o Google no primeiro toque no formulário, não no
     envio. Sem isto, o POST do lead começa com DNS + TCP + TLS num host novo
     — ~300 ms de espera olhando o botão travado, no exato momento em que a
     pessoa decidiu se cadastrar. Ancorado no foco (e não no <head>) para que
     quem só lê a página não pague conexão nenhuma. */
  function preconectaDestino(form) {
    if (!LEAD_ENDPOINT) return;
    let feito = false;
    const abrir = () => {
      if (feito) return;
      feito = true;
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = new URL(LEAD_ENDPOINT).origin;
      l.crossOrigin = "";
      document.head.appendChild(l);
    };
    form.addEventListener("focusin", abrir, { once: true });
    form.addEventListener("pointerdown", abrir, { once: true });
  }

  function initForm() {
    const form = document.getElementById("lead-form");
    if (!form) return;
    preconectaDestino(form);
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

      enviarLead({ nome: nome.value.trim(), telefone: soDigitos(tel.value),
                   consentimento_lgpd: true, origem: LEAD_ORIGEM,
                   em: new Date().toISOString() }, form, status);
    });
  }

  /* ============ colinha no preview local ============
     A colinha resolve a campanha pelo HOSTNAME (colinha/colinha-core.js):
     proftozi.com.br e tozisite.vercel.app tem alias para a config do Tozi,
     mas localhost nao tem e cai no PADRAO, que e a colinha do Dr. Elton.
     Aqui o link ganha ?campanha=tozi apenas em host local. Em producao a
     funcao sai na primeira linha, e mesmo se o parametro vazasse para a URL
     o proprio core o ignora fora do localhost — de proposito, para ninguem
     abrir um site com outro candidato travado no topo.
     O Set espelha LOCAIS do core: fora dele o parametro seria ignorado, e
     acrescentar host aqui (ex.: o IP da LAN) viraria no-op silencioso. */
  const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]", ""]);
  function initColinhaLocal() {
    if (!HOSTS_LOCAIS.has(location.hostname)) return;
    document.querySelectorAll('a[href^="colinha/"]').forEach(function (a) {
      const u = new URL(a.getAttribute("href"), location.href);
      u.searchParams.set("campanha", "tozi");
      a.setAttribute("href", u.pathname + u.search);
    });
  }

  /* ============ menu de seções (mobile) ============
     Abaixo de 860px a .nav do header some e o site fica sem navegação. Este
     painel cobre o vão. Os links são CLONADOS da .nav: uma seção nova entra
     no HTML uma vez só e aparece nos dois lugares. */
  function initMenu() {
    const btn = document.getElementById("nav-toggle");
    const painel = document.getElementById("nav-panel");
    const lista = document.getElementById("nav-panel-lista");
    if (!btn || !painel || !lista) return;

    const secoes = Array.prototype.slice.call(
      document.querySelectorAll(".nav a[href^='#']"),
    );
    if (!secoes.length) return;
    secoes.forEach((origem, i) => {
      const a = document.createElement("a");
      a.href = origem.getAttribute("href");
      a.textContent = origem.textContent.trim();
      a.setAttribute("data-scroll", "");
      a.style.setProperty("--i", i);   // escalonamento da entrada
      lista.appendChild(a);
    });

    const header = document.getElementById("header");
    let eraDark = false;
    let aberto = false;

    // Marca a seção em que o eleitor está. Calculado na ABERTURA, não em
    // scroll: o painel só existe aberto, então observar o tempo todo seria
    // trabalho jogado fora.
    function marcarAtual() {
      const linha = window.pageYOffset + (header ? header.offsetHeight : 0) + 24;
      let atual = null;
      lista.querySelectorAll("a").forEach((a) => {
        a.removeAttribute("aria-current");
        const alvo = document.querySelector(a.getAttribute("href"));
        if (alvo && alvo.getBoundingClientRect().top + window.pageYOffset <= linha) atual = a;
      });
      if (atual) atual.setAttribute("aria-current", "true");
    }

    // Foco preso no painel enquanto aberto: Tab não pode vazar para a página
    // atrás da cortina. O botão entra na lista porque ele é o "fechar".
    function focaveis() {
      return [btn].concat(
        Array.prototype.slice.call(painel.querySelectorAll("a[href], button")),
      );
    }

    function abrir() {
      aberto = true;
      marcarAtual();
      painel.removeAttribute("inert");
      document.body.classList.add("menu-aberto");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Fechar menu");
      // O camaleão do header trabalha por CONTRASTE: seção escura embaixo =
      // pele clara. Com o painel navy cobrindo tudo, a pele correta é a
      // clara — forçar, não remover, senão a marca fica navy sobre navy.
      if (header) {
        eraDark = header.classList.contains("on-dark");
        header.classList.add("on-dark");
      }
      document.body.style.overflow = "hidden";
    }

    function fechar(devolveFoco) {
      if (!aberto) return;
      aberto = false;
      painel.setAttribute("inert", "");
      document.body.classList.remove("menu-aberto");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Abrir menu");
      if (header && !eraDark) header.classList.remove("on-dark");
      document.body.style.overflow = "";
      if (devolveFoco) btn.focus();
    }

    btn.addEventListener("click", () => (aberto ? fechar(false) : abrir()));

    // Clique num link: fecha ANTES de o handler delegado de [data-scroll]
    // rodar no document, para o scroll acontecer com a página destravada.
    painel.addEventListener("click", (e) => {
      if (e.target.closest("a[href^='#']")) fechar(false);
    });

    document.addEventListener("keydown", (e) => {
      if (!aberto) return;
      if (e.key === "Escape") { fechar(true); return; }
      if (e.key !== "Tab") return;
      const itens = focaveis();
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });

    // Girou para paisagem / abriu no tablet: acima de 860px a .nav volta e o
    // painel não tem mais razão de existir.
    const largo = window.matchMedia("(min-width: 860px)");
    const aoMudar = (e) => { if (e.matches) fechar(false); };
    if (largo.addEventListener) largo.addEventListener("change", aoMudar);
    else largo.addListener(aoMudar);
  }

  /* ============ boot ============ */
  function boot() {
    document.body.classList.add("is-loaded");
    initHeaderTheme();
    initReveal();
    initPosters();
    initSpotlight();
    initColinhaLocal();
    initForm();
    initMenu();
    if (location.search.indexOf("selftest") !== -1) selftest();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
