(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});

  class UIManager {
    constructor(root) {
      this.root = root;
      this.pauseHandler = null;
      this.toastTimer = 0;

      this.root.innerHTML = `
        <div class="ui-screen"></div>
        <div class="ui-hud">
          <div class="hud-top">
            <div class="hud-title">
              <strong></strong>
              <span></span>
            </div>
            <div class="hud-right">
              <div class="dew-branch" aria-hidden="true"></div>
              <button class="pause-leaf" type="button" aria-label="Пауза">
                <span class="bars"></span>
              </button>
            </div>
          </div>
          <div class="light-bloom">
            <div class="light-icon" aria-hidden="true"></div>
            <div class="light-label">Свет росы</div>
          </div>
        </div>
        <div class="ui-toast"></div>
      `;

      this.screen = this.root.querySelector(".ui-screen");
      this.hud = this.root.querySelector(".ui-hud");
      this.titleStrong = this.root.querySelector(".hud-title strong");
      this.titleSpan = this.root.querySelector(".hud-title span");
      this.branch = this.root.querySelector(".dew-branch");
      this.pauseButton = this.root.querySelector(".pause-leaf");
      this.lightIcon = this.root.querySelector(".light-icon");
      this.lightLabel = this.root.querySelector(".light-label");
      this.toast = this.root.querySelector(".ui-toast");

      this.pauseButton.addEventListener("click", () => {
        if (this.pauseHandler) {
          this.pauseHandler();
        }
      });

      for (let index = 0; index < 7; index += 1) {
        const drop = document.createElement("span");
        drop.className = "dew-drop";
        this.branch.appendChild(drop);
      }
    }

    update(dt) {
      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) {
          this.toast.classList.remove("visible");
        }
      }
    }

    setPauseHandler(handler) {
      this.pauseHandler = handler;
    }

    showToast(message, duration = 1.8) {
      this.toast.textContent = message;
      this.toast.classList.add("visible");
      this.toastTimer = duration;
    }

    showScreen(content) {
      this.screen.style.display = "grid";
      this.screen.innerHTML = "";
      this.screen.appendChild(content);
    }

    hideScreen() {
      this.screen.style.display = "none";
      this.screen.innerHTML = "";
    }

    showHud() {
      document.body.classList.add("hud-active");
    }

    hideHud() {
      document.body.classList.remove("hud-active");
    }

    updateHud(state) {
      this.titleStrong.textContent = state.title;
      this.titleSpan.textContent = state.subtitle;
      const filled = Math.round(state.progress * this.branch.children.length);
      for (let index = 0; index < this.branch.children.length; index += 1) {
        this.branch.children[index].classList.toggle("on", index < filled);
      }

      const scale = 0.72 + state.light * 0.48;
      this.lightIcon.style.transform = `scale(${scale})`;
      this.lightLabel.textContent = `Свет росы · ${Math.round(state.light * 100)}% · Лунные капли ${state.moonDrops}/${state.totalMoonDrops}`;
      this.pauseButton.style.opacity = state.pauseVisible ? "1" : "0";
    }

    createCard(extraClass = "") {
      const card = document.createElement("div");
      card.className = `ui-card ${extraClass}`.trim();
      return card;
    }

    addActions(card, actions) {
      const row = document.createElement("div");
      row.className = "ui-actions";
      for (const action of actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `ui-button ${action.secondary ? "secondary" : ""}`.trim();
        button.textContent = action.label;
        button.addEventListener("click", action.onClick);
        row.appendChild(button);
      }
      card.appendChild(row);
    }

    showMenu(progress, handlers) {
      const card = this.createCard();
      card.innerHTML = `
        <p class="eyebrow">Тихая аркада на Canvas 2D</p>
        <h1 class="title">Сад Лунной Росы</h1>
        <p class="subtitle">
          Маленький дух росы скользит по уснувшему саду, будит бутоны и держит свет живым, пока сухая тень не вернула всё в пепел.
        </p>
      `;

      const facts = document.createElement("div");
      facts.className = "facts";
      facts.innerHTML = `
        <div class="fact"><span class="fact-label">Сцены</span><span class="fact-value">5</span></div>
        <div class="fact"><span class="fact-label">Уже ожило</span><span class="fact-value">${Object.keys(progress.completed).length}</span></div>
        <div class="fact"><span class="fact-label">Открыто</span><span class="fact-value">${progress.unlocked}</span></div>
      `;
      card.appendChild(facts);

      const note = document.createElement("p");
      note.className = "inline-note";
      note.textContent = "Управление мышью или пальцем; дальше сцены стараются объяснить всё картинкой: серость сохнет, вода держит жизнь, а центр каждого уровня читается как цель.";
      card.appendChild(note);

      this.addActions(card, [
        {
          label: progress.unlocked > 1 || Object.keys(progress.completed).length ? "Продолжить сад" : "Войти в сад",
          onClick: handlers.onStart,
        },
        {
          label: "Сцены сада",
          onClick: handlers.onMap,
          secondary: true,
        },
      ]);

      this.showScreen(card);
      this.hideHud();
    }

    showMap(levels, progress, handlers) {
      const card = this.createCard("map-card");
      card.innerHTML = `
        <p class="eyebrow">Карта сада</p>
        <h2 class="title">Пробуждённые тропы</h2>
        <p class="subtitle">Каждая сцена оживляет ещё один кусок общего сада. Узлы сверху открываются по порядку.</p>
      `;

      const board = document.createElement("div");
      board.className = "map-board";

      const path = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      path.setAttribute("class", "map-path");
      path.setAttribute("viewBox", "0 0 100 100");

      const pathLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = levels
        .map((level, index) => `${index === 0 ? "M" : "L"} ${level.map.x} ${level.map.y}`)
        .join(" ");
      pathLine.setAttribute("d", d);
      pathLine.setAttribute("fill", "none");
      pathLine.setAttribute("stroke", "rgba(84, 118, 99, 0.35)");
      pathLine.setAttribute("stroke-width", "1.2");
      pathLine.setAttribute("stroke-linecap", "round");
      pathLine.setAttribute("stroke-dasharray", "2.6 2.2");
      path.appendChild(pathLine);
      board.appendChild(path);

      for (const level of levels) {
        const unlocked = level.index <= progress.unlocked;
        const completed = Boolean(progress.completed[level.id]);
        const node = document.createElement("button");
        node.type = "button";
        node.className = `map-node ${completed ? "completed" : ""} ${!unlocked ? "locked" : ""}`.trim();
        node.style.left = `${level.map.x}%`;
        node.style.top = `${level.map.y}%`;
        node.disabled = !unlocked;
        node.innerHTML = `
          <span class="map-node-index">Сцена ${level.index}</span>
          <span class="map-node-name">${level.name}</span>
          <span class="map-node-note">${completed ? "Пробуждена" : unlocked ? "Открыта" : "Ещё спит"}</span>
        `;
        if (unlocked) {
          node.addEventListener("click", () => handlers.onSelect(level.id));
        }
        board.appendChild(node);
      }

      card.appendChild(board);
      this.addActions(card, [
        { label: "Назад", onClick: handlers.onBack, secondary: true },
      ]);
      this.showScreen(card);
      this.hideHud();
    }

    showPause(level, handlers) {
      const card = this.createCard();
      card.innerHTML = `
        <p class="eyebrow">Пауза</p>
        <h2 class="title">${level.name}</h2>
        <p class="subtitle">${level.hint}</p>
      `;
      this.addActions(card, [
        { label: "Вернуться", onClick: handlers.onResume },
        { label: "Начать сцену заново", onClick: handlers.onRestart, secondary: true },
        { label: "На карту", onClick: handlers.onMap, secondary: true },
      ]);
      this.showScreen(card);
    }

    showResult(level, result, hasNext, handlers) {
      const card = this.createCard();
      card.innerHTML = `
        <p class="eyebrow">Сцена ожила</p>
        <h2 class="title">${level.name}</h2>
        <p class="subtitle">Центральный цветок раскрылся, и свет прошёл дальше по саду.</p>
      `;

      const grid = document.createElement("div");
      grid.className = "results-row";
      grid.innerHTML = `
        <div class="result-pill"><strong>${this.formatTime(result.time)}</strong><span>Время пробуждения</span></div>
        <div class="result-pill"><strong>${result.aliveCount}/${result.totalBuds}</strong><span>Живые бутоны к финишу</span></div>
        <div class="result-pill"><strong>${result.moonDrops}/${result.totalMoonDrops}</strong><span>Лунные капли</span></div>
        <div class="result-pill"><strong>${result.awakenedUnique}</strong><span>Пробуждённых цветков</span></div>
      `;
      card.appendChild(grid);

      this.addActions(card, [
        {
          label: hasNext ? "Следующая сцена" : "Финал сада",
          onClick: handlers.onNext,
        },
        {
          label: "Переиграть",
          onClick: handlers.onReplay,
          secondary: true,
        },
        {
          label: "Карта сада",
          onClick: handlers.onMap,
          secondary: true,
        },
      ]);

      this.showScreen(card);
      this.hideHud();
    }

    showFinale(progress, handlers) {
      const card = this.createCard();
      card.innerHTML = `
        <p class="eyebrow">Источник открыт</p>
        <h2 class="title">Весь сад дышит</h2>
        <p class="subtitle">
          Последняя чаша наполнилась, и молчаливый источник провёл волну по всей карте. ${Object.keys(progress.completed).length} сцен вплелись в одну композицию.
        </p>
      `;

      const note = document.createElement("p");
      note.className = "inline-note";
      note.textContent = "Эта версия уже полностью проходима: меню, карта, пять сцен, тень, вода, чаша, паутина, экран результата и процедурный звук.";
      card.appendChild(note);

      this.addActions(card, [
        { label: "Снова пройти сад", onClick: handlers.onReplayAll },
        { label: "К карте", onClick: handlers.onMap, secondary: true },
      ]);

      this.showScreen(card);
      this.hideHud();
    }

    formatTime(seconds) {
      const total = Math.max(0, Math.round(seconds));
      const minutes = Math.floor(total / 60);
      const rest = total % 60;
      return `${minutes}:${String(rest).padStart(2, "0")}`;
    }
  }

  MoonDew.UIManager = UIManager;
})();
