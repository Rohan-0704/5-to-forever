(() => {
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  // Intro / stage
  const intro = $("#intro");
  const stage = $("#stage");
  const validateBtn = $("#validateBtn");
  const ticketStamp = $("#ticketStamp");
  const sealHint = $("#sealHint");

  // Doors
  const doorOverlay = $("#doorOverlay");
  const doorLabel = $("#doorLabel");
  const doorSub = $("#doorSub");

  // Hallway
  const hallOverlay = $("#hallOverlay");
  const hallTitle = $("#hallTitle");
  const hallHint = $("#hallHint");

  // Docent captions
  const docent = $("#docent");
  const docentText = $("#docentText");

  // HUD
  const progressFill = $("#progressFill");
  const progressLabel = $("#progressLabel");
  const roomBadge = $("#roomBadge");

  // Rooms + buttons
  const roomEls = $$(".room");
  const nextBtns = $$("[data-next]");
  const prevBtns = $$("[data-prev]");
  const exitBtn = $("#exitBtn");

  // Help
  const helpBtn = $("#helpBtn");
  const helpModal = $("#helpModal");
  const closeHelp = $("#closeHelp");

  // Photo modal
  const photoModal = $("#photoModal");
  const closePhoto = $("#closePhoto");
  const modalImg = $("#modalImg");
  const placardKicker = $("#placardKicker");
  const placardText = $("#placardText");

  // Finale
  const guestName = $("#guestName");
  const signBtn = $("#signBtn");
  const signedMsg = $("#signedMsg");
  const fireworksBtn = $("#fireworksBtn");
  const restartBtn = $("#restartBtn");

  // Fireworks
  const canvas = $("#fireworks");
  const ctx = canvas.getContext("2d");

  let current = 0;
  let paused = false;
  let transitioning = false;

  // Timing
  const DOOR_CLOSE_MS = 1200;
  const DOOR_OPEN_MS  = 1500;
  const BETWEEN_MS    = 420;
  const HALLWAY_MS    = 2500;

  // Reveal timing (slower)
  const FIRST_REVEAL_DELAY = 1100;
  const REVEAL_GAP_MS = 1600;

  // ---------- Fireworks ----------
  let fwParticles = [];
  let fwRun = false;

  function resizeCanvas(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function burst(x, y, power=1){
    const colors = ["#ffdca8", "#ff2d55", "#ff5aa5", "#fff2d6", "#caa46d"];
    const count = Math.floor(160 * power);
    for(let i=0;i<count;i++){
      const a = Math.random() * Math.PI * 2;
      const s = (Math.random()*4.3 + 1.8) * power;
      fwParticles.push({
        x, y,
        vx: Math.cos(a) * s * (0.7 + Math.random()),
        vy: Math.sin(a) * s * (0.7 + Math.random()),
        g: 0.045 + Math.random()*0.03,
        r: 1.1 + Math.random()*2.8,
        alpha: 1,
        c: colors[(Math.random()*colors.length)|0],
        life: 95 + (Math.random()*65|0)
      });
    }
    if(!fwRun){
      fwRun = true;
      requestAnimationFrame(stepFireworks);
    }
  }

  function stepFireworks(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    fwParticles = fwParticles.filter(p => p.life-- > 0);

    for(const p of fwParticles){
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha *= 0.985;

      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }

    if(fwParticles.length){
      requestAnimationFrame(stepFireworks);
    } else {
      fwRun = false;
      ctx.clearRect(0,0,innerWidth,innerHeight);
    }
  }

  function fireworksShow(){
    const pts = [
      [innerWidth*0.22, innerHeight*0.30],
      [innerWidth*0.78, innerHeight*0.28],
      [innerWidth*0.50, innerHeight*0.22],
      [innerWidth*0.35, innerHeight*0.42],
      [innerWidth*0.65, innerHeight*0.40],
      [innerWidth*0.50, innerHeight*0.34]
    ];
    pts.forEach((p, i) => setTimeout(() => burst(p[0], p[1], 1.05), i*170));
  }

  // ---------- Show/Hide ----------
  function show(el){
    el.classList.add("show");
    el.setAttribute("aria-hidden","false");
  }
  function hide(el){
    el.classList.remove("show");
    el.setAttribute("aria-hidden","true");
  }

  // ---------- Help ----------
  helpBtn?.addEventListener("click", () => show(helpModal));
  closeHelp?.addEventListener("click", () => hide(helpModal));
  helpModal?.addEventListener("click", (e) => { if(e.target === helpModal) hide(helpModal); });

  // ---------- Photo modal ----------
  function openPhotoModal({src, exhibit, placard}){
    paused = true;
    pauseAllVideos();
    modalImg.src = src;
    placardKicker.textContent = exhibit || "Exhibit";
    placardText.textContent = placard || "";
    show(photoModal);
  }
  function closePhotoModal(){
    hide(photoModal);
    paused = false;
    autoplayCurrentRoomVideo();
  }
  closePhoto?.addEventListener("click", closePhotoModal);
  photoModal?.addEventListener("click", (e) => { if(e.target === photoModal) closePhotoModal(); });

  // ---------- Image loader (mixed formats) ----------
  const PHOTO_EXTS = ["jpg","jpeg","webp","png"];

  function setImgWithFallback(imgEl, baseName){
    let i = 0;
    const tryNext = () => {
      if(i >= PHOTO_EXTS.length) return;
      const ext = PHOTO_EXTS[i++];
      imgEl.src = `assets/photos/${baseName}.${ext}`;
    };
    imgEl.onerror = () => tryNext();
    tryNext();
  }

  function initPhotoSources(){
    $$(".frame").forEach(frame => {
      const base = frame.getAttribute("data-src-base");
      const img = frame.querySelector("img.lazyPhoto");
      if(base && img) setImgWithFallback(img, base);
    });
  }
  initPhotoSources();

  function bindFrameClicks(){
    $$(".frame").forEach(frame => {
      frame.addEventListener("click", () => {
        const img = frame.querySelector("img.lazyPhoto");
        const src = img?.src || "";
        const exhibit = frame.getAttribute("data-exhibit");
        const placard = frame.getAttribute("data-placard");
        openPhotoModal({ src, exhibit, placard });
      });
    });
  }
  bindFrameClicks();

  // ---------- Docent ----------
  let docentTimer = null;
  function typeDocent(text){
    clearTimeout(docentTimer);
    if(!text){
      docent.classList.remove("show");
      docent.setAttribute("aria-hidden","true");
      return;
    }
    docent.classList.add("show");
    docent.setAttribute("aria-hidden","false");

    const full = String(text);
    let n = 0;
    const step = () => {
      const room = roomEls[current];
      if(!room) return;
      n = Math.min(full.length, n + Math.max(2, Math.floor(full.length / 60)));
      docentText.textContent = full.slice(0, n);
      if(n < full.length){
        docentTimer = setTimeout(step, 28);
      }
    };
    step();
  }

  // ---------- Reveal ----------
  function resetRoomReveals(roomEl){
    $$(".reveal-item", roomEl).forEach(el => el.classList.remove("revealed"));
    const nextBtn = $(".nextBtn", roomEl);
    if(nextBtn) nextBtn.classList.remove("ready");
  }

  async function revealRoom(roomEl){
    const items = $$(".reveal-item", roomEl);
    const nextBtn = $(".nextBtn", roomEl);

    if(!items.length){
      if(nextBtn) nextBtn.classList.add("ready");
      return;
    }

    await wait(FIRST_REVEAL_DELAY);

    for(const item of items){
      while(paused) await wait(160);
      item.classList.add("revealed");
      await wait(REVEAL_GAP_MS);
    }

    while(paused) await wait(160);
    if(nextBtn) nextBtn.classList.add("ready");
  }

  // ---------- Video behavior ----------
  function pauseAllVideos(){
    $$(".vid").forEach(v => {
      try { v.pause(); } catch {}
      v.muted = true;
    });
    $$("[data-sound-btn]").forEach(btn => {
      btn.classList.remove("on");
      btn.textContent = "🔊 Enable Sound";
    });
  }

  function autoplayCurrentRoomVideo(){
    const room = roomEls[current];
    if(!room) return;
    const v = room.querySelector("video.vid");
    if(!v) return;
    v.muted = true;
    const p = v.play();
    if(p && typeof p.catch === "function") p.catch(()=>{});
  }

  function setupSoundButtons(){
    $$("[data-sound-btn]").forEach(btn => {
      btn.addEventListener("click", () => {
        const room = btn.closest(".room");
        const v = room ? room.querySelector("video.vid") : null;
        if(!v) return;

        v.muted = !v.muted;
        const p = v.play();
        if(p && typeof p.catch === "function") p.catch(()=>{});

        btn.classList.toggle("on", !v.muted);
        btn.textContent = v.muted ? "🔊 Enable Sound" : "🔇 Mute";
      });
    });
  }
  setupSoundButtons();

  // ---------- Rooms/HUD ----------
  function setRoom(idx){
    idx = Math.max(0, Math.min(roomEls.length-1, idx));
    current = idx;

    roomEls.forEach((r,i)=> r.classList.toggle("active", i===idx));

    const badge = roomEls[idx]?.getAttribute("data-badge") || `ROOM ${idx+1}`;
    roomBadge.textContent = badge;
    progressLabel.textContent = `Room ${idx+1} of ${roomEls.length}`;
    progressFill.style.width = (((idx+1)/roomEls.length)*100) + "%";

    prevBtns.forEach(btn => btn.disabled = (current === 0));

    const docentLine = roomEls[idx]?.getAttribute("data-docent") || "";
    typeDocent(docentLine);

    resetRoomReveals(roomEls[idx]);
    revealRoom(roomEls[idx]);

    pauseAllVideos();
    autoplayCurrentRoomVideo();
  }

  // ---------- Doors + hallway ----------
  async function doorsClose(title, sub){
    doorLabel.textContent = title || "Entering…";
    doorSub.textContent = sub || "Please wait";
    show(doorOverlay);
    doorOverlay.classList.remove("opening");
    doorOverlay.classList.add("closing");
    await wait(DOOR_CLOSE_MS);
  }

  async function doorsOpen(){
    doorOverlay.classList.remove("closing");
    doorOverlay.classList.add("opening");
    await wait(DOOR_OPEN_MS);
    doorOverlay.classList.remove("opening");
    hide(doorOverlay);
  }

  async function hallwayWalk(title){
    hallTitle.textContent = title || "Walking to the next room";
    hallHint.textContent = "Please keep walking…";
    show(hallOverlay);
    hallOverlay.classList.add("walking");
    await wait(HALLWAY_MS);
    hallOverlay.classList.remove("walking");
    hide(hallOverlay);
  }

  async function transitionTo(toIndex){
    if(transitioning || paused) return;
    if(toIndex < 0 || toIndex >= roomEls.length) return;
    transitioning = true;

    const label = roomEls[toIndex]?.getAttribute("data-label") || "Entering…";

    await doorsClose(label, "Stepping through…");
    await wait(420);
    await hallwayWalk(`Walking to: ${label}`);

    setRoom(toIndex);

    await wait(220);
    await doorsOpen();

    burst(innerWidth/2, innerHeight*0.20, 0.65);
    transitioning = false;
  }

  nextBtns.forEach(btn => btn.addEventListener("click", () => transitionTo(current + 1)));
  prevBtns.forEach(btn => btn.addEventListener("click", () => transitionTo(current - 1)));

  // ---------- Intro validate ----------
  validateBtn?.addEventListener("click", async () => {
    if(transitioning) return;
    transitioning = true;

    ticketStamp.classList.add("show");
    sealHint.textContent = "Ticket accepted. Opening the museum doors…";
    burst(innerWidth/2, innerHeight*0.34, 0.85);

    await wait(900);

    await doorsClose("Welcome inside", "Your private tour begins…");
    await wait(420);
    await hallwayWalk("Entering the museum…");

    intro.style.display = "none";
    stage.classList.add("show");
    stage.setAttribute("aria-hidden","false");
    setRoom(0);

    await wait(220);
    await doorsOpen();

    burst(innerWidth/2, innerHeight*0.18, 0.95);
    transitioning = false;
  });

  // ---------- Finale ----------
  fireworksBtn?.addEventListener("click", fireworksShow);

  signBtn?.addEventListener("click", () => {
    const name = (guestName.value || "").trim();
    if(!name){
      signedMsg.textContent = "Type your name first ✦";
      return;
    }
    signedMsg.textContent = `Signed: ${name} — Eternal Admission Granted ✦`;
    burst(innerWidth/2, innerHeight*0.26, 0.95);
  });

  restartBtn?.addEventListener("click", async () => {
    if(transitioning) return;
    transitioning = true;

    await doorsClose("Restarting tour", "Walking you back to the entrance…");
    await hallwayWalk("Returning to the lobby…");

    pauseAllVideos();

    stage.classList.remove("show");
    stage.setAttribute("aria-hidden","true");
    intro.style.display = "flex";
    ticketStamp.classList.remove("show");
    sealHint.textContent = "Tap to begin your private tour.";
    guestName.value = "";
    signedMsg.textContent = "";
    progressFill.style.width = "0%";
    current = 0;

    typeDocent("");

    await doorsOpen();
    transitioning = false;
  });

  exitBtn?.addEventListener("click", async () => {
    if(transitioning || paused) return;
    transitioning = true;

    await doorsClose("Closing the museum doors", "But you can return anytime…");
    await hallwayWalk("Walking out softly…");

    pauseAllVideos();

    stage.classList.remove("show");
    stage.setAttribute("aria-hidden","true");
    intro.style.display = "flex";
    ticketStamp.classList.add("show");
    sealHint.textContent = "Your ticket stays valid. Forever.";

    typeDocent("");

    await doorsOpen();
    burst(innerWidth/2, innerHeight*0.30, 0.75);
    transitioning = false;
  });

  // Init in lobby state
  setRoom(0);
})();
