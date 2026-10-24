import { readStoredTheme, storeTheme, type ThemeId } from '@abstract/three-engine';
import { createGomokuScene } from './gomoku-scene';

const board = document.querySelector<HTMLDivElement>('#board')!;
let theme: ThemeId = readStoredTheme();
document.documentElement.dataset.theme = theme;

const scene = createGomokuScene(board, { theme });

document.querySelector('#theme-toggle')!.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  storeTheme(theme);
  document.documentElement.dataset.theme = theme;
  scene.setTheme(theme);
});
