const ERAS = [
  { id: "ancient", label: "Ancient", range: [-5000, 0], color: "#8B6914", bg: "rgba(139,105,20,0.08)" },
  { id: "classical", label: "Classical", range: [0, 500], color: "#CD853F", bg: "rgba(205,133,63,0.07)" },
  { id: "medieval", label: "Medieval", range: [500, 1500], color: "#4A6741", bg: "rgba(74,103,65,0.08)" },
  { id: "renaissance", label: "Renaissance", range: [1500, 1700], color: "#8B4513", bg: "rgba(139,69,19,0.08)" },
  { id: "enlightenment", label: "Enlightenment", range: [1700, 1800], color: "#2E5090", bg: "rgba(46,80,144,0.08)" },
  { id: "industrial", label: "19th Century", range: [1800, 1900], color: "#5C4033", bg: "rgba(92,64,51,0.08)" },
  { id: "early20th", label: "Early 20th", range: [1900, 1920], color: "#704214", bg: "rgba(112,66,20,0.07)" },
  { id: "interwar", label: "Interwar", range: [1920, 1940], color: "#8B0000", bg: "rgba(139,0,0,0.06)" },
  { id: "wwii", label: "World War II", range: [1940, 1946], color: "#DC143C", bg: "rgba(220,20,60,0.08)" },
  { id: "postwar", label: "Postwar", range: [1946, 1970], color: "#2F4F4F", bg: "rgba(47,79,79,0.08)" },
  { id: "late20th", label: "Late 20th", range: [1970, 2000], color: "#483D8B", bg: "rgba(72,61,139,0.08)" },
  { id: "modern", label: "Near Future", range: [2000, 2100], color: "#0077B6", bg: "rgba(0,119,182,0.08)" },
  { id: "farfuture", label: "Far Future", range: [2100, 10000], color: "#6A0DAD", bg: "rgba(106,13,173,0.08)" },
];

const ZOOM_CONFIGS = [
  { pw: 56, ph: 84, gap: 6, stagger: 50, label: "S" },
  { pw: 80, ph: 120, gap: 8, stagger: 70, label: "M" },
  { pw: 120, ph: 180, gap: 10, stagger: 90, label: "L" },
];

const app = document.querySelector("#timeline-app");
const films = Array.isArray(window.TIMELINE_FILMS) ? window.TIMELINE_FILMS : [];
const state = {
  zoomLevel: 2,
  isDragging: false,
  dragStartX: 0,
  dragStartScroll: 0,
  moved: false,
  lastX: 0,
  lastTime: 0,
  momentumFrame: 0,
};

function getEra(year) {
  return ERAS.find((era) => year >= era.range[0] && year < era.range[1]) || ERAS[0];
}

function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BC`;
  if (year < 100) return `${year} AD`;
  return String(year);
}

function posterUrl(film) {
  if (!film.posterPath) return null;
  const extension = film.posterPath.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg";
  return `./assets/posters/${film.tmdbId}${extension}`;
}

function buildEraGroups() {
  return ERAS.map((era) => {
    const eraFilms = films
      .filter((film) => film.setYear >= era.range[0] && film.setYear < era.range[1])
      .sort((a, b) => a.setYear - b.setYear || a.title.localeCompare(b.title));
    const items = [];
    let index = 0;
    while (index < eraFilms.length) {
      if (index + 1 < eraFilms.length && eraFilms[index].setYear === eraFilms[index + 1].setYear) {
        items.push({ films: [eraFilms[index], eraFilms[index + 1]], stacked: true });
        index += 2;
        while (index < eraFilms.length && eraFilms[index].setYear === eraFilms[index - 1].setYear) {
          items.push({ films: [eraFilms[index]], stacked: false });
          index += 1;
        }
      } else {
        items.push({ films: [eraFilms[index]], stacked: false });
        index += 1;
      }
    }
    return { ...era, items, filmCount: eraFilms.length };
  }).filter((era) => era.filmCount > 0);
}

function render() {
  const eraGroups = buildEraGroups();
  app.innerHTML = `
    <div class="zoom-controls" aria-label="Zoom controls">
      ${ZOOM_CONFIGS.map((zoom, index) => `
        <button type="button" data-zoom="${index}" aria-pressed="${index === state.zoomLevel}">${zoom.label}</button>
      `).join("")}
    </div>
    <div class="timeline-scroll" id="timeline-scroll">
      ${eraGroups.map(renderEra).join("")}
    </div>
    <div class="minimap" id="minimap">
      ${eraGroups.map(renderMinimapEra).join("")}
      <div class="viewport-indicator" id="viewport-indicator"></div>
    </div>
  `;
  attachEvents();
  updateViewportIndicator();
}

function renderEra(era, eraIndex) {
  const zoom = ZOOM_CONFIGS[state.zoomLevel];
  const presentYear = new Date().getFullYear();
  const presentEra = getEra(presentYear).id;
  const items = era.items.map((item, itemIndex) => {
    const stagger = Math.round(Math.sin(itemIndex * 1.8 + eraIndex * 2) * zoom.stagger);
    const posters = item.films.map((film, filmIndex) => renderPoster(film, era, zoom, item.stacked ? filmIndex === 1 : true)).join("");
    return `
      <div class="timeline-cluster" style="gap: var(--t-space-2); transform: translateY(${stagger}px)">
        ${posters}
      </div>
    `;
  }).join("");

  return `
    <section
      id="era-${era.id}"
      class="era-section"
      data-era-id="${era.id}"
      style="background: ${era.bg}; border-right: 1px solid ${era.color}33"
    >
      <div class="era-label">
        <strong style="color: ${era.color}">${era.label}</strong>
        <span>${era.range[0] < 0 ? `${Math.abs(era.range[0])} BC` : era.range[0]} – ${era.range[1] < 10000 ? era.range[1] : "∞"}</span>
      </div>
      <div class="era-films" style="gap: ${zoom.gap}px">
        ${items}
        ${era.id === presentEra ? `<div class="today-line"><span>Today · ${presentYear}</span></div>` : ""}
      </div>
    </section>
  `;
}

function renderPoster(film, era, zoom, showYear) {
  const poster = posterUrl(film);
  const image = poster
    ? `<img src="${poster}" alt="${escapeHtml(film.title)}" loading="lazy" draggable="false">`
    : `<div class="poster-fallback">${escapeHtml(film.title)}</div>`;
  return `
    <button
      type="button"
      class="film-poster"
      data-tmdb-id="${film.tmdbId}"
      style="width: ${zoom.pw}px; height: ${zoom.ph}px"
      aria-label="${escapeHtml(film.title)}"
    >${image}</button>
    ${showYear ? `<span class="film-year" style="color: ${era.color}">${formatYear(film.setYear)}</span>` : ""}
  `;
}

function renderMinimapEra(era) {
  return `
    <div class="minimap-era" data-era-id="${era.id}" style="flex: ${era.filmCount}">
      <div class="minimap-bar" style="background: ${era.color}"></div>
      <div class="minimap-tip" style="color: ${era.color}">
        ${era.label} (${era.range[0]}–${era.range[1] >= 10000 ? "∞" : era.range[1]}) · ${era.filmCount} films
      </div>
    </div>
  `;
}

function attachEvents() {
  const scroll = document.querySelector("#timeline-scroll");
  const minimap = document.querySelector("#minimap");
  document.querySelectorAll("[data-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      state.zoomLevel = Number(button.dataset.zoom);
      render();
    });
  });
  document.querySelectorAll(".film-poster").forEach((button) => {
    const film = films.find((item) => String(item.tmdbId) === button.dataset.tmdbId);
    if (!film) return;
    button.addEventListener("mouseenter", () => showTooltip(film, button));
    button.addEventListener("mouseleave", hideTooltip);
    button.addEventListener("focus", () => showTooltip(film, button));
    button.addEventListener("blur", hideTooltip);
    button.addEventListener("click", () => {
      if (!state.moved) window.location.href = `https://cinemateca.co/movie/${film.tmdbId}`;
    });
  });
  scroll.addEventListener("scroll", updateViewportIndicator, { passive: true });
  window.addEventListener("resize", updateViewportIndicator);
  scroll.addEventListener("mousedown", onMouseDown);
  scroll.addEventListener("mousemove", onMouseMove);
  scroll.addEventListener("mouseup", onMouseUp);
  scroll.addEventListener("mouseleave", () => {
    onMouseUp();
    removeYearCursor();
  });
  minimap.addEventListener("click", (event) => {
    const rect = minimap.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const targetScroll = fraction * scroll.scrollWidth - scroll.clientWidth / 2;
    scroll.scrollLeft = Math.max(0, Math.min(targetScroll, scroll.scrollWidth - scroll.clientWidth));
  });
}

function onMouseDown(event) {
  const scroll = document.querySelector("#timeline-scroll");
  if (state.momentumFrame) cancelAnimationFrame(state.momentumFrame);
  state.isDragging = true;
  state.moved = false;
  state.dragStartX = event.pageX - scroll.offsetLeft;
  state.dragStartScroll = scroll.scrollLeft;
  state.lastX = event.pageX;
  state.lastTime = performance.now();
  scroll.classList.add("dragging");
}

function onMouseMove(event) {
  const scroll = document.querySelector("#timeline-scroll");
  if (!state.isDragging) {
    updateYearCursor(event);
    return;
  }
  event.preventDefault();
  const x = event.pageX - scroll.offsetLeft;
  const walk = x - state.dragStartX;
  if (Math.abs(walk) > 5) state.moved = true;
  scroll.scrollLeft = state.dragStartScroll - walk;
  const now = performance.now();
  if (now - state.lastTime > 50) {
    state.lastX = event.pageX;
    state.lastTime = now;
  }
}

function onMouseUp(event) {
  const scroll = document.querySelector("#timeline-scroll");
  if (!state.isDragging) return;
  state.isDragging = false;
  scroll.classList.remove("dragging");
  if (!state.moved || !event) return;
  const dt = performance.now() - state.lastTime;
  if (dt <= 0 || dt >= 200) return;
  let velocity = -((event.pageX - state.lastX) / dt) * 18;
  const decelerate = () => {
    velocity *= 0.95;
    if (Math.abs(velocity) < 0.5) {
      state.momentumFrame = 0;
      return;
    }
    scroll.scrollLeft += velocity;
    state.momentumFrame = requestAnimationFrame(decelerate);
  };
  state.momentumFrame = requestAnimationFrame(decelerate);
}

function updateYearCursor(event) {
  const scroll = document.querySelector("#timeline-scroll");
  for (const section of scroll.querySelectorAll("[data-era-id]")) {
    const rect = section.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right) continue;
    const era = ERAS.find((item) => item.id === section.dataset.eraId);
    if (!era) break;
    const fraction = (event.clientX - rect.left) / rect.width;
    const year = Math.round(era.range[0] + fraction * (Math.min(era.range[1], 2200) - era.range[0]));
    showYearCursor(year, event.clientX, era.color);
    return;
  }
  removeYearCursor();
}

function showYearCursor(year, x, color) {
  if (document.querySelector(".tooltip")) return;
  let cursor = document.querySelector(".year-cursor");
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.className = "year-cursor";
    cursor.innerHTML = "<span></span>";
    document.body.append(cursor);
  }
  cursor.style.left = `${x}px`;
  cursor.querySelector("span").textContent = formatYear(year);
  cursor.querySelector("span").style.color = color;
}

function removeYearCursor() {
  document.querySelector(".year-cursor")?.remove();
}

function showTooltip(film, button) {
  removeYearCursor();
  hideTooltip();
  const rect = button.getBoundingClientRect();
  const above = rect.top > window.innerHeight / 2;
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.innerHTML = `
    <div class="tooltip-title">${escapeHtml(film.title)}</div>
    <div class="tooltip-meta">
      Released ${film.releaseYear} · Set in
      <span style="color: ${getEra(film.setYear).color}; font-weight: 600">${formatYear(film.setYear)}</span>
    </div>
    ${film.directors.length > 0 ? `<div class="tooltip-directors">${escapeHtml(film.directors.join(", "))}</div>` : ""}
    <div class="tooltip-tags">
      ${film.genres.slice(0, 3).map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}
      <span class="rating">★ ${Number(film.rating || 0).toFixed(1)}</span>
    </div>
  `;
  document.body.append(tooltip);
  const left = Math.min(Math.max(rect.left + rect.width / 2 - 130, 12), window.innerWidth - 280);
  tooltip.style.left = `${left}px`;
  if (above) {
    tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  } else {
    tooltip.style.top = `${rect.bottom + 8}px`;
  }
}

function hideTooltip() {
  document.querySelector(".tooltip")?.remove();
}

function updateViewportIndicator() {
  const scroll = document.querySelector("#timeline-scroll");
  const indicator = document.querySelector("#viewport-indicator");
  if (!scroll || !indicator) return;
  const max = scroll.scrollWidth - scroll.clientWidth;
  const scrollFraction = max > 0 ? scroll.scrollLeft / max : 0;
  const viewportFraction = scroll.scrollWidth > 0 ? scroll.clientWidth / scroll.scrollWidth : 1;
  indicator.style.left = `${scrollFraction * (1 - viewportFraction) * 100}%`;
  indicator.style.width = `${Math.max(viewportFraction * 100, 3)}%`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

document.addEventListener("keydown", (event) => {
  const scroll = document.querySelector("#timeline-scroll");
  if (!scroll) return;
  if (event.key === "ArrowRight") scroll.scrollLeft += 300;
  if (event.key === "ArrowLeft") scroll.scrollLeft -= 300;
});

render();
