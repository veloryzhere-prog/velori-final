import type { Page } from "./model";
const css = `body{font-family:system-ui,sans-serif;background:#fffdf6;color:#29251e;margin:0;line-height:1.6}main{max-width:760px;margin:auto;padding:clamp(24px,7vw,70px)}h1{font-size:clamp(38px,8vw,72px);letter-spacing:-.065em;line-height:1.05}p{color:#827762}button{font:inherit;cursor:pointer;background:#29251e;color:white;border:0;border-radius:30px;padding:12px 22px}a{color:inherit}button:focus-visible,a:focus-visible{outline:3px solid #c4a349;outline-offset:4px}.orb{width:140px;height:140px;background:#eee0ac;border-radius:40%;display:grid;place-items:center;box-shadow:inset 12px 12px 20px #fff9,inset -10px -10px 20px #bba55b44;font:italic 100px Georgia,serif;animation:float 7s ease-in-out infinite}@keyframes float{50%{transform:translateY(-10px) rotate(10deg)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}`;
export const starters: { title: string; description: string; pages: Page[] }[] = [
  {
    title: "A little possibility",
    description: "A working interactive welcome",
    pages: [
      {
        path: "index",
        html: '<main>\n<p>VELORI · A CANVAS FOR YOUR IDEAS</p>\n<div class="orb">v</div>\n<h1>A little idea.<br>A whole new world.</h1>\n<p>Make something that moves people.</p>\n<button id="inspire">Find a little inspiration ↗</button>\n<p id="thought" role="status">Your next great idea starts here.</p>\n</main>',
        css,
        js: 'const ideas=["Build the thing you wish existed.","A small idea can make someone’s whole day.","Try a new color. Follow a curious thought."];let i=0;document.querySelector("#inspire").onclick=()=>{document.querySelector("#thought").textContent=ideas[i++%ideas.length]};',
      },
    ],
  },
  {
    title: "A focus room",
    description: "An accessible 25-minute timer",
    pages: [
      {
        path: "index",
        html: '<main><p>A LITTLE SPACE TO FOCUS</p><h1>One thing<br>at a time.</h1><div id="clock" style="font-size:70px">25:00</div><button id="toggle">Start focusing</button> <button id="reset">Reset</button><p id="status" role="status">Ready when you are.</p></main>',
        css,
        js: 'let remaining=1500,running=false,end=0;const clock=document.querySelector("#clock"),button=document.querySelector("#toggle");function paint(){clock.textContent=Math.floor(remaining/60).toString().padStart(2,"0")+":"+(remaining%60).toString().padStart(2,"0");button.textContent=running?"Pause":"Start focusing"}button.onclick=()=>{running=!running;end=Date.now()+remaining*1000;paint()};document.querySelector("#reset").onclick=()=>{running=false;remaining=1500;paint()};setInterval(()=>{if(!running)return;remaining=Math.max(0,Math.ceil((end-Date.now())/1000));if(!remaining){running=false;document.querySelector("#status").textContent="Beautiful work. Time for a break."}paint()},250);',
      },
    ],
  },
  {
    title: "Two little pages",
    description: "A complete connected mini website",
    pages: [
      {
        path: "index",
        html: '<main><div class="orb">v</div><h1>Ideas, made real.</h1><p>This little website has two pages.</p><a href="#about">Meet the studio ↗</a></main>',
        css,
        js: "",
      },
      {
        path: "about",
        html: '<main><a href="#index">← Home</a><h1>Made with<br>a curious mind.</h1><p>You are on the about page. All pages travel together in the downloaded app.</p></main>',
        css,
        js: "",
      },
    ],
  },
];
