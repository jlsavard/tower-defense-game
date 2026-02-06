import { GRID } from '../shared/types/constants.js';
import { NetworkClient } from './network/NetworkClient.js';
import { GameClient } from './game/GameClient.js';
import { InputHandler } from './game/InputHandler.js';
import { Renderer } from './rendering/Renderer.js';
import { HUD } from './ui/HUD.js';

const HUD_HEIGHT = 48;

function getServerUrl(): string {
  const host = window.location.hostname || 'localhost';
  const port = window.location.port || '8080';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${host}:${port}`;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  canvas.width = GRID.WIDTH * GRID.CELL_SIZE;
  canvas.height = GRID.HEIGHT * GRID.CELL_SIZE;
  canvas.style.marginTop = `${HUD_HEIGHT}px`;

  const network = new NetworkClient(getServerUrl());
  const gameClient = new GameClient(network);
  const renderer = new Renderer(ctx, gameClient);
  const _input = new InputHandler(canvas, gameClient);
  const hud = new HUD(gameClient);

  await network.connect();
  gameClient.joinGame();

  let lastTime = performance.now();

  function loop(): void {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    gameClient.update(dt);
    renderer.render(dt);
    hud.update();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);
