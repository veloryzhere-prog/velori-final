import { informationPages, informationFooterLinks } from "./catalog.ts";
export const DOCUMENT_RELEASE = "velori-editorial-2026-10-25-r3";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
export function resolveDocumentLink(value, contact = {}) {
  if (value === "@motion") return "#motion-settings";
  if (value.startsWith("@")) {
    const email = contact.contactEmail?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "/contact";
    const subjects = {
      careers: "An introduction for VELORI / VELORYZ",
      developers: "VELORI integration proposal",
      privacy: "VELORI privacy question",
      ai: "VELORYZ AI feedback",
      feedback: "VELORI product feedback",
      support: "VELORI support",
    };
    return (
      "mailto:" +
      email +
      "?subject=" +
      encodeURIComponent(subjects[value.slice(1)] || "Hello VELORI")
    );
  }
  return /^\/(?!\/)/.test(value) || /^https:\/\//.test(value) ? value : "/contact";
}
function link(a, contact, cls = "vd-button") {
  if (a.to === "@motion")
    return (
      '<button class="' +
      cls +
      ' vd-open-motion" type="button">' +
      escape(a.label) +
      ' <span aria-hidden="true">↗</span></button>'
    );
  const href = resolveDocumentLink(a.to, contact),
    external = href.startsWith("https://");
  return (
    '<a class="' +
    cls +
    '" href="' +
    escape(href) +
    '"' +
    (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
    ">" +
    escape(a.label) +
    ' <span aria-hidden="true">↗</span></a>'
  );
}
export function buildDocumentationDocument(kind, contact = {}) {
  const page = informationPages[kind];
  if (!page) throw Error("Unknown VELORI documentation page: " + kind);
  const sections = page.sections
    .map(
      (s, i) =>
        '<section class="vd-section" id="chapter-' +
        i +
        '"><span class="vd-number">' +
        String(i + 1).padStart(2, "0") +
        "</span><div><h2>" +
        escape(s.title) +
        "</h2><p>" +
        escape(s.text) +
        "</p>" +
        (s.items
          ? "<ul>" + s.items.map((t) => "<li>" + escape(t) + "</li>").join("") + "</ul>"
          : "") +
        "</div></section>",
    )
    .join("");
  const article =
    kind === "blog"
      ? '<div class="vd-journal-grid">' +
        page.sections
          .slice(0, 3)
          .map(
            (s, i) =>
              '<a class="vd-journal-card vd-card-' +
              i +
              '" href="#chapter-' +
              i +
              '"><div class="vd-card-art"><span>0' +
              (i + 1) +
              "</span><i></i><b>" +
              ["↗", "◎", "✦"][i] +
              "</b></div><small>" +
              ["PRODUCT", "PEOPLE", "DESIGN"][i] +
              " / OCTOBER 2026</small><h2>" +
              escape(s.title) +
              '</h2><span class="vd-read-link">Read the story ↗</span></a>',
          )
          .join("") +
        "</div>"
      : "";
  const questions = (page.questions || [])
    .map(
      (q) =>
        '<details class="vd-faq-item"><summary>' +
        escape(q.question) +
        '<span aria-hidden="true">+</span></summary><p>' +
        escape(q.answer) +
        "</p></details>",
    )
    .join("");
  const search = questions
    ? '<section class="vd-faq" id="answers"><div class="vd-section-caption">FIND AN ANSWER</div><h2>One question at a time.</h2><label class="vd-search"><span class="vd-sr">Search help topics</span><input type="search" placeholder="Search account, chat, motion…" aria-label="Search help topics" maxlength="120"></label><p class="vd-filter-status" role="status" aria-live="polite">' +
      page.questions.length +
      " helpful answers</p>" +
      questions +
      "</section>"
    : "";
  const place =
    kind === "locations"
      ? '<form class="vd-place-form" action="/search" method="get"><label for="place-query">Find a name, place or topic</label><div><input id="place-query" name="q" placeholder="Try a city or hashtag" maxlength="100" required><button type="submit">Search VELORI ↗</button></div><small>Searches member content. Sign-in may be required.</small></form>'
      : "";
  const directory =
    kind === "directory"
      ? '<nav class="vd-directory-grid" aria-label="VELORI directory">' +
        informationFooterLinks
          .map(
            ([label, to], i) =>
              '<a href="' +
              to +
              '"><small>' +
              String(i + 1).padStart(2, "0") +
              "</small><strong>" +
              escape(label) +
              "</strong><span>↗</span></a>",
          )
          .join("") +
        "</nav>"
      : "";
  const email =
    contact.contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.contactEmail)
      ? contact.contactEmail
      : "";
  const contactPanel =
    kind === "contact"
      ? '<section class="vd-contact-panel"><div><span class="vd-section-caption">THE OFFICIAL CHANNEL</span><h2>We’re listening.</h2>' +
        (email
          ? '<a class="vd-contact-email" href="mailto:' +
            escape(email) +
            '">' +
            escape(email) +
            " ↗</a>"
          : "<p>The team has not published an email address yet.</p>") +
        (contact.contactPhone
          ? '<p><a href="tel:' +
            escape(contact.contactPhone.replace(/[^\d+]/g, "")) +
            '">' +
            escape(contact.contactPhone) +
            "</a></p>"
          : "") +
        "<p>For VELORI product help, VELORYZ collaboration and privacy questions. Please keep passwords and sign-in codes private.</p></div>" +
        (email
          ? '<form class="vd-contact-form"><label>Your name<input name="name" required maxlength="100" autocomplete="name"></label><label>Your email<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>Topic<select name="topic"><option>Product support</option><option>Collaboration</option><option>Careers introduction</option><option>Privacy question</option><option>Product feedback</option></select></label><label>Your message<textarea name="message" required minlength="10" maxlength="2500" rows="5"></textarea></label><button type="submit">Prepare email draft ↗</button><p class="vd-email-status" role="status">You review and send the email in your own email application.</p><a class="vd-email-draft" hidden target="_blank" rel="noopener noreferrer">Open your email draft ↗</a></form>'
          : "") +
        "</section>"
      : "";
  const ai =
    kind === "veloryz-ai"
      ? '<div class="vd-construction"><span class="vd-construction-dot"></span><div><strong>Under construction</strong><p>Documentation preview only. No assistant, prompt collection or account access is active.</p></div><span class="vd-construction-mark" aria-hidden="true">✳</span></div>'
      : "";
  const motion =
    kind === "lite"
      ? '<aside class="vd-motion-callout" id="motion-settings"><span aria-hidden="true">✦</span><div><h2>Your pace. Your preference.</h2><p>Open the global motion control and choose what feels right.</p></div><button class="vd-open-motion" type="button">Motion settings ↗</button></aside>'
      : "";
  const forgeNav = kind.startsWith("forge-")
    ? '<nav class="vd-forge-nav" aria-label="Forge documentation">' +
      [
        ["Open Forge", "/forge"],
        ["User guide", "/forge-docs"],
        ["Pricing", "/forge-pricing"],
        ["Payments", "/forge-payments"],
        ["API", "/forge-api"],
        ["Security", "/forge-security"],
      ]
        .map(
          ([label, to]) =>
            '<a href="' +
            to +
            '"' +
            (to === "/" + kind ? ' aria-current="page"' : "") +
            ">" +
            label +
            "</a>",
        )
        .join("") +
      "</nav>"
    : "";
  const html =
    '<div class="vdocs vd-' +
    kind +
    '" id="document-top"><nav class="vd-topline" aria-label="Documentation"><a class="vd-wordmark" href="/about">velori<span>✳</span></a><span>BY VELORYZ</span><a href="/directory">The directory ↗</a></nav>' +
    forgeNav +
    '<header class="vd-hero"><div><span class="vd-eyebrow"><i></i>' +
    escape(page.category) +
    "</span><h1>" +
    escape(page.title) +
    '</h1><p class="vd-intro">' +
    escape(page.intro) +
    '</p><div class="vd-actions">' +
    page.actions
      .slice(0, 2)
      .map((a) => link(a, contact))
      .join("") +
    "</div>" +
    (page.status ? '<p class="vd-status"><i></i>' + escape(page.status) + "</p>" : "") +
    '</div><div class="vd-art" aria-hidden="true"><i class="vd-orbit"></i><i class="vd-orbit vd-orbit-two"></i><div class="vd-paper vd-paper-back"></div><div class="vd-paper vd-paper-front"><span class="vd-paper-top">VELORI / VELORYZ</span><b>' +
    (kind === "veloryz-ai"
      ? "Ideas.<br>In the<br>making."
      : kind === "jobs"
        ? "Build<br>something<br>human."
        : kind === "blog"
          ? "Notes<br>from<br>our world."
          : "Your world.<br>Your<br>people.") +
    '</b><span class="vd-paper-lines"><i></i><i></i></span></div><span class="vd-art-seal">v</span><span class="vd-art-star">✳</span></div></header><div class="vd-edition"><span>' +
    escape(page.accent) +
    "</span><span>VELORI DOCUMENTATION / 24 OCT 2026</span></div>" +
    ai +
    article +
    directory +
    contactPanel +
    place +
    '<div class="vd-reading" id="chapters"><aside class="vd-toc"><span>IN THIS GUIDE</span>' +
    page.sections
      .map(
        (s, i) =>
          '<a href="#chapter-' +
          i +
          '"><small>' +
          String(i + 1).padStart(2, "0") +
          "</small>" +
          escape(s.title) +
          "</a>",
      )
      .join("") +
    "</aside><div>" +
    sections +
    motion +
    search +
    '</div></div><section class="vd-next"><div><span class="vd-section-caption">A LITTLE MORE CONNECTED</span><h2>Find your next little step.</h2></div><div>' +
    page.actions.map((a) => link(a, contact, "vd-button vd-button-light")).join("") +
    '</div></section><footer class="vd-end"><span>VELORI — A VELORYZ product.</span><a href="#document-top">Back to the top ↑</a></footer></div>';
  return {
    title: page.label,
    slug: kind,
    route: "/" + kind,
    content: page.sections.map((s) => s.title + "\n" + s.text).join("\n\n"),
    custom_html: html,
    custom_css: DOCUMENT_CSS + (kind.startsWith("forge-") ? FORGE_NAV_CSS : ""),
    custom_js: DOCUMENT_JS,
    content_mode: "custom_html",
    content_blocks:
      kind === "directory"
        ? informationFooterLinks.map(([title, url], i) => ({
            id: "footer-" + i,
            type: "button",
            title,
            url,
            visible: true,
          }))
        : [],
    seo_title: page.label + " · VELORI",
    seo_description: page.intro,
    og_title: page.label + " · VELORI",
    og_description: page.intro,
    hero_image: "",
    footer_enabled: kind !== "directory",
    animation_enabled: true,
  };
}
export const DOCUMENT_JS = `(()=>{const root=document.querySelector('.vdocs');if(!root)return;const input=root.querySelector('.vd-search input');if(input){const items=[...root.querySelectorAll('.vd-faq-item')];input.addEventListener('input',()=>{const query=input.value.trim().toLowerCase();let count=0;items.forEach(item=>{item.hidden=!item.textContent.toLowerCase().includes(query);if(!item.hidden)count++});root.querySelector('.vd-filter-status').textContent=count?count+' matching answers':'No matching answers. Try another topic or contact the team.'})}root.querySelectorAll('.vd-open-motion').forEach(button=>button.addEventListener('click',()=>parent.postMessage({type:'velori:open-motion'},'*')));const form=root.querySelector('.vd-contact-form');if(form)form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=new FormData(form);const email=root.querySelector('.vd-contact-email').getAttribute('href').slice(7);const body='Name: '+data.get('name')+'\\nReply email: '+data.get('email')+'\\n\\n'+data.get('message');const link=form.querySelector('.vd-email-draft');link.href='mailto:'+email+'?subject='+encodeURIComponent('VELORI / '+data.get('topic'))+'&body='+encodeURIComponent(body);link.hidden=false;form.querySelector('.vd-email-status').textContent='Your draft is ready. Open it, review it and send it from your email application.';link.focus()})})();`;
export const DOCUMENT_CSS = `
:root{--vd-ink:#191919;--vd-muted:#696660;--vd-line:#e5e1d9;--vd-paper:#fffdf6;--vd-gold:#d4b35b;--vd-pink:#e7a7bf;color-scheme:light}html{scroll-behavior:smooth}body{margin:0!important;padding:0!important;background:#fffefb;color:var(--vd-ink);font:15px/1.7 Arial,Helvetica,sans-serif}*{box-sizing:border-box}a{color:inherit;text-decoration:none}button,input,textarea,select{font:inherit}button,a,input,textarea,select,summary{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid #b58b28;outline-offset:5px}.vdocs{max-width:1320px;margin:auto;padding:0 48px 25px;overflow-wrap:anywhere}.vd-topline{display:flex;align-items:center;gap:18px;padding:23px 0;border-bottom:1px solid var(--vd-line)}.vd-wordmark{font-size:31px;font-weight:800;letter-spacing:-2px;line-height:1}.vd-wordmark>span{display:inline-block;color:var(--vd-gold);font-size:24px;vertical-align:middle;margin-left:4px}.vd-topline>span{font-size:8px;letter-spacing:2px;color:var(--vd-muted)}.vd-topline>a:last-child{margin-left:auto;font-size:10px;min-height:36px;display:flex;align-items:center}.vd-hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.65fr);gap:45px;align-items:center;padding:75px 0 65px;min-height:550px}.vd-eyebrow{display:flex;align-items:center;gap:10px;font-size:9px;line-height:1.6;font-weight:bold;letter-spacing:2px;color:var(--vd-muted)}.vd-eyebrow>i{width:7px;height:7px;border-radius:50%;background:var(--vd-gold);flex:none}.vd-hero h1{font-size:clamp(40px,5.8vw,76px);line-height:1.015;letter-spacing:-3.5px;font-weight:650;margin:24px 0;max-width:820px;text-wrap:balance}.vd-intro{max-width:650px;color:var(--vd-muted);font-size:15px;line-height:1.9;margin:0}.vd-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.vd-button{display:inline-flex;align-items:center;justify-content:space-between;gap:25px;min-height:44px;padding:11px 20px;border:1px solid #1d1d1d;border-radius:28px;background:#1d1d1d;color:white;font-size:11px;font-weight:600}.vd-actions>.vd-button+ .vd-button{background:transparent;color:var(--vd-ink);border-color:var(--vd-line)}.vd-button>span{font-size:17px;line-height:1}.vd-status{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--vd-muted);margin:22px 0 0}.vd-status>i{width:5px;height:5px;border-radius:50%;background:#caa347}.vd-art{position:relative;min-width:0;aspect-ratio:.95;display:grid;place-items:center;perspective:1000px;isolation:isolate}.vd-art::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,#f4e8bc6b,transparent 66%);z-index:-1}.vd-orbit{position:absolute;width:98%;height:70%;border:1px solid #d8caa3;border-radius:50%;rotate:-28deg}.vd-orbit-two{width:72%;height:98%;rotate:26deg;border-color:#e4c7d2}.vd-paper{position:absolute;width:69%;height:77%;border:1px solid #ded8c7;border-radius:3px;background:#fffdf6;box-shadow:0 25px 35px -30px #4b4134}.vd-paper-back{rotate:7deg;translate:12px 9px;background:#f6ead0}.vd-paper-front{display:flex;flex-direction:column;justify-content:space-between;padding:25px;transform:rotateY(-8deg) rotateZ(-7deg)}.vd-paper-top{font-size:6px;letter-spacing:2px;border-bottom:1px solid #e8decc;padding-bottom:15px}.vd-paper-front>b{font:500 clamp(24px,3.1vw,42px)/1.1 Georgia,serif;letter-spacing:-1px}.vd-paper-lines{display:flex;flex-direction:column;gap:7px}.vd-paper-lines>i{height:2px;width:85%;background:#e8dfc7}.vd-paper-lines>i:last-child{width:60%}.vd-art-seal{position:absolute;bottom:13%;right:8%;display:grid;place-items:center;width:68px;height:68px;border-radius:50%;font:italic 48px Georgia,serif;color:#fffdf6;background:#df9bb6;box-shadow:inset 0 0 0 4px #edbed0,inset 0 0 0 5px #c7849d,0 7px 12px #8f66732b;rotate:12deg}.vd-art-star{position:absolute;right:4%;top:12%;color:var(--vd-gold);font-size:39px}.vd-edition{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;border-block:1px solid var(--vd-line);padding:15px 0;font-size:9px;color:var(--vd-muted);letter-spacing:1px}.vd-edition>span:last-child{font-size:7px}.vd-reading{display:grid;grid-template-columns:185px minmax(0,1fr);gap:65px;padding-top:50px;align-items:start}.vd-toc{position:sticky;top:22px;display:flex;flex-direction:column;gap:7px}.vd-toc>span,.vd-section-caption{font-size:8px;letter-spacing:2px;color:var(--vd-muted);font-weight:600}.vd-toc>span{margin-bottom:15px}.vd-toc a{display:flex;gap:11px;padding:6px 0;color:var(--vd-muted);font-size:10px;line-height:1.6}.vd-toc small{flex:0 0 18px;color:#a08440;font-size:9px}.vd-toc a:hover{color:var(--vd-ink)}.vd-section{display:grid;grid-template-columns:35px minmax(0,1fr);gap:16px;border-bottom:1px solid var(--vd-line);margin:0 0 32px;padding:0 0 33px;scroll-margin-top:25px}.vd-number{font:italic 19px Georgia,serif;color:#a78a43;padding-top:2px}.vdocs h2{font-size:24px;line-height:1.25;letter-spacing:-.65px;font-weight:600;margin:0 0 17px}.vd-section p,.vd-section li{font-size:14px;color:var(--vd-muted);line-height:1.9;margin:0}.vd-section ul{padding:0 0 0 18px;margin:18px 0 0}.vd-section li{padding:5px 0}.vd-section li::marker{color:#b39750}.vd-next{display:flex;align-items:center;justify-content:space-between;gap:25px;margin-top:30px;padding:33px;border:1px solid var(--vd-line);border-radius:14px;background:#f9f6ed}.vd-next h2{margin:14px 0 0;font-size:26px}.vd-next>div:last-child{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}.vd-button-light{color:var(--vd-ink);background:#fff;border-color:#ded7c5}.vd-end{display:flex;justify-content:space-between;gap:20px;padding:30px 0 0;font-size:9px;color:var(--vd-muted)}.vd-end a{min-height:30px}.vd-journal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:25px;margin-top:40px}.vd-journal-card{min-width:0;border-bottom:1px solid var(--vd-line);padding-bottom:25px}.vd-card-art{aspect-ratio:1.7;position:relative;background:#f3eddc;overflow:hidden;border-radius:8px;margin-bottom:23px;display:grid;place-items:center}.vd-card-art>span{position:absolute;left:16px;top:12px;font-size:9px;color:#97835a}.vd-card-art>i{position:absolute;border:1px solid #b9a878;width:52%;aspect-ratio:1;border-radius:50%;rotate:-20deg;transform:rotateX(40deg)}.vd-card-art>b{font:500 66px Georgia,serif;color:#aa914e}.vd-card-1 .vd-card-art{background:#f3eaee}.vd-card-1 .vd-card-art>b{color:#bd889f}.vd-card-2 .vd-card-art{background:#eeeae0}.vd-journal-card>small{font-size:7px;letter-spacing:1.6px;color:var(--vd-muted)}.vd-journal-card h2{font-size:20px;letter-spacing:-.6px;margin:14px 0}.vd-read-link{font-size:10px;color:var(--vd-muted)}.vd-faq{padding-top:15px}.vd-faq>h2{font-size:34px;margin:17px 0 22px}.vd-search input{display:block;width:100%;border:1px solid var(--vd-line);border-radius:28px;padding:13px 19px;background:#fff;font-size:13px;color:var(--vd-ink)}.vd-filter-status{font-size:10px;color:var(--vd-muted);margin:12px 0 25px}.vd-faq-item{border-bottom:1px solid var(--vd-line)}.vd-faq-item summary{display:flex;gap:20px;align-items:center;justify-content:space-between;cursor:pointer;padding:20px 0;font-size:13px;font-weight:600;list-style:none}.vd-faq-item summary::-webkit-details-marker{display:none}.vd-faq-item summary>span{font-size:23px;font-weight:400;color:#ad9149;flex:none}.vd-faq-item[open] summary>span{rotate:45deg}.vd-faq-item p{margin:0;padding:0 30px 23px 0;font-size:13px;color:var(--vd-muted);line-height:1.85}.vd-sr{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}.vdocs [hidden]{display:none!important}.vd-construction{display:flex;gap:18px;align-items:center;padding:26px;margin-top:35px;background:#faf6e8;border:1px solid #e5d6a7;border-radius:12px}.vd-construction-dot{width:9px;height:9px;border-radius:50%;background:#b89a44;flex:none}.vd-construction p{font-size:12px;color:var(--vd-muted);margin:6px 0 0}.vd-construction-mark{margin-left:auto;font-size:30px;color:#c5aa61}.vd-contact-panel{display:grid;grid-template-columns:1fr 1fr;gap:55px;padding:45px 0;border-bottom:1px solid var(--vd-line)}.vd-contact-panel h2{font-size:37px;margin:20px 0}.vd-contact-email{display:inline-block;font-size:clamp(14px,2vw,22px);border-bottom:1px solid #bbaa77;padding-bottom:6px;margin-bottom:13px}.vd-contact-panel p{font-size:13px;color:var(--vd-muted);line-height:1.85}.vd-contact-form{display:flex;flex-direction:column;gap:17px}.vd-contact-form label{font-size:11px;font-weight:600}.vd-contact-form input,.vd-contact-form textarea,.vd-contact-form select{display:block;margin-top:7px;border:1px solid var(--vd-line);border-radius:8px;width:100%;padding:11px;background:#fff;color:var(--vd-ink);font-size:13px}.vd-contact-form button,.vd-place-form button{min-height:44px;border:0;border-radius:25px;padding:12px 18px;background:#1d1d1d;color:#fff;font-size:12px}.vd-contact-form .vd-email-status{font-size:10px;margin:0}.vd-email-draft{font-size:12px;border-bottom:1px solid #c9b782;align-self:flex-start;padding-bottom:5px}.vd-place-form{padding:26px;margin-top:35px;background:#f7f4eb;border-radius:12px}.vd-place-form label{display:block;font-size:14px;font-weight:600;margin-bottom:15px}.vd-place-form>div{display:flex;gap:12px}.vd-place-form input{min-width:0;flex:1;padding:10px 16px;border:1px solid var(--vd-line);border-radius:25px;font-size:13px}.vd-place-form small{display:block;font-size:10px;color:var(--vd-muted);margin-top:11px}.vd-directory-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:35px}.vd-directory-grid a{display:flex;align-items:center;gap:14px;min-height:90px;padding:20px;border:1px solid var(--vd-line);border-radius:9px}.vd-directory-grid small{font-size:9px;color:#ad9149}.vd-directory-grid strong{font-size:13px}.vd-directory-grid span{margin-left:auto}.vd-motion-callout{display:flex;align-items:center;gap:20px;padding:25px;background:#f9f4e1;border-radius:12px;margin:30px 0}.vd-motion-callout>span{font-size:35px;color:#b99b4b}.vd-motion-callout h2{font-size:20px;margin-bottom:8px}.vd-motion-callout p{font-size:12px;color:var(--vd-muted);margin:0}.vd-motion-callout button{background:white;border:1px solid var(--vd-line);padding:12px 17px;border-radius:25px;font-size:11px;min-height:44px;margin-left:auto;white-space:nowrap}
html[data-ui-motion="full"] .vd-paper-front{animation:vd-paper-float 8s ease-in-out infinite}html[data-ui-motion="full"] .vd-orbit{animation:vd-orbit-turn 35s linear infinite}html[data-ui-motion="full"] .vd-orbit-two{animation-duration:45s;animation-direction:reverse}html[data-ui-motion="full"] .vd-art-star,html[data-ui-motion="full"] .vd-wordmark>span{animation:vd-star-turn 16s linear infinite}html[data-ui-motion="full"] .vd-construction-dot{animation:vd-signal 3s ease-in-out infinite}html[data-ui-motion="full"] .vd-hero>div:first-child{animation:vd-arrive .7s ease both}html[data-ui-motion="full"] .vd-card-art>b{animation:vd-card-float 7s ease-in-out infinite}html[data-ui-motion="full"] .vd-card-1 .vd-card-art>b{animation-delay:-2s}html[data-ui-motion="full"] .vd-button,html[data-ui-motion="full"] .vd-journal-card{transition:translate .22s ease,box-shadow .22s ease}html[data-ui-motion="full"] .vd-button:hover{translate:0 -2px;box-shadow:0 6px 13px #67583315}html[data-ui-motion="full"] .vd-journal-card:hover{translate:0 -4px}html[data-ui-motion="full"] .vd-faq-item[open]>p{animation:vd-arrive .25s ease both}html[data-ui-motion="gentle"] .vd-hero{animation:vd-fade .2s ease both}html:not([data-ui-motion="full"]) .vd-art *,html:not([data-ui-motion="full"]) .vd-card-art *{animation:none!important}html[data-ui-motion="off"]{scroll-behavior:auto}html[data-ui-activity="hidden"] *,html[data-ui-activity="hidden"] *::before,html[data-ui-activity="hidden"] *::after{animation-play-state:paused!important}.vd-art[data-visible="false"] *, .vd-card-art[data-visible="false"] *{animation-play-state:paused!important}@keyframes vd-paper-float{50%{transform:translateY(-10px) rotateY(8deg) rotateZ(-4deg)}}@keyframes vd-orbit-turn{to{rotate:332deg}}@keyframes vd-star-turn{to{rotate:360deg}}@keyframes vd-signal{50%{box-shadow:0 0 0 7px #b89a4414}}@keyframes vd-card-float{50%{translate:0 -7px;rotate:5deg}}@keyframes vd-arrive{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}@keyframes vd-fade{from{opacity:.4}to{opacity:1}}
@media(max-width:900px){.vdocs{padding-inline:27px}.vd-hero{gap:22px;padding:50px 0;min-height:480px;grid-template-columns:minmax(0,1.15fr) minmax(200px,.65fr)}.vd-hero h1{font-size:53px;letter-spacing:-2.5px}.vd-paper-front{padding:18px}.vd-reading{grid-template-columns:150px minmax(0,1fr);gap:30px}.vd-toc a{font-size:9px}.vd-contact-panel{gap:30px}.vd-art-seal{width:50px;height:50px;font-size:38px}.vd-next{padding:25px}.vd-next>div:last-child{justify-content:flex-start}.vd-journal-grid{gap:15px}.vd-journal-card h2{font-size:17px}.vd-directory-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.vdocs{padding:0 20px 20px}.vd-topline{padding:19px 0;gap:12px}.vd-wordmark{font-size:27px}.vd-topline>span{font-size:6px;letter-spacing:1.4px}.vd-topline>a:last-child{font-size:9px}.vd-hero{display:flex;flex-direction:column;align-items:stretch;gap:28px;padding:38px 0 28px;min-height:0}.vd-hero h1{font-size:43px;letter-spacing:-2px;margin:22px 0}.vd-eyebrow{font-size:8px;letter-spacing:1.6px}.vd-intro{font-size:13px;line-height:1.9}.vd-actions{margin-top:22px}.vd-button{font-size:10px;padding:11px 15px;gap:15px}.vd-art{width:240px;max-width:100%;align-self:center}.vd-paper-front>b{font-size:28px}.vd-paper-top{font-size:5px;letter-spacing:1.3px}.vd-paper-front{padding:18px}.vd-art-star{font-size:30px}.vd-edition{gap:8px;padding:13px 0;font-size:8px}.vd-edition>span:last-child{font-size:6px}.vd-reading{display:block;padding-top:30px}.vd-toc{position:static;padding-bottom:22px;margin-bottom:30px;border-bottom:1px solid var(--vd-line)}.vd-toc>span{margin-bottom:8px}.vd-toc a{font-size:10px;padding:4px 0}.vd-section{grid-template-columns:25px minmax(0,1fr);gap:10px;padding-bottom:25px;margin-bottom:25px}.vdocs h2{font-size:21px}.vd-section p,.vd-section li{font-size:12px;line-height:1.9}.vd-next{display:block;padding:23px 20px;margin-top:25px}.vd-next h2{font-size:25px;margin-bottom:22px}.vd-next>div:last-child{gap:10px}.vd-end{font-size:8px;gap:12px}.vd-journal-grid{display:block;margin-top:28px}.vd-journal-card{display:block;margin-bottom:30px}.vd-card-art{aspect-ratio:2}.vd-journal-card h2{font-size:23px}.vd-construction{padding:20px;align-items:flex-start;gap:12px}.vd-construction strong{font-size:14px}.vd-construction p{font-size:11px}.vd-construction-dot{margin-top:8px;width:7px;height:7px}.vd-construction-mark{display:none}.vd-contact-panel{display:block;padding-top:30px}.vd-contact-panel h2{font-size:33px}.vd-contact-form{margin-top:30px}.vd-contact-email{font-size:17px}.vd-directory-grid{grid-template-columns:1fr;gap:10px}.vd-directory-grid a{min-height:65px;padding:15px}.vd-place-form{padding:20px}.vd-place-form>div{flex-direction:column}.vd-place-form input{min-height:44px}.vd-motion-callout{flex-wrap:wrap;padding:20px;gap:15px}.vd-motion-callout>span{font-size:27px}.vd-motion-callout button{margin-left:0}.vd-faq>h2{font-size:29px}.vd-faq-item summary{font-size:12px;padding:17px 0}.vd-faq-item p{font-size:12px;padding-right:0}}
`;

const FORGE_NAV_CSS = `.vd-forge-nav{display:flex;flex-wrap:wrap;gap:6px;padding:14px 0;border-bottom:1px solid var(--vd-line)}.vd-forge-nav a{display:inline-flex;align-items:center;min-height:44px;padding:8px 14px;border-radius:24px;font-size:12px;border:1px solid transparent}.vd-forge-nav a:hover{border-color:var(--vd-line)}.vd-forge-nav a[aria-current]{background:var(--vd-ink);color:var(--vd-paper)}`;
