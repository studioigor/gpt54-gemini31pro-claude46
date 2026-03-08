(() => {
  const MoonDew = (window.MoonDew = window.MoonDew || {});

  window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game-canvas");
    const uiRoot = document.getElementById("ui-root");
    const game = new MoonDew.GameEngine({ canvas, uiRoot });
    window.MoonDewGame = game;
    game.start();
  });
})();
