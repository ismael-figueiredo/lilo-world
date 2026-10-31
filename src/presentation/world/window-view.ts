import * as THREE from 'three';
import type { Phase, Weather } from '@domain/day/weather';

const WIDTH = 256;
const HEIGHT = 140;

const skies: Readonly<Record<Phase, readonly [string, string]>> = {
  morning: ['#7cc0f7', '#fbe6cf'],
  noon: ['#5aaef5', '#d6f1ff'],
  afternoon: ['#6ab2f2', '#e2f0f5'],
  dusk: ['#6a60b5', '#ffb58a'],
  night: ['#101a3f', '#2a3560'],
};

const circle = (context: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
};

function cloud(context: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  context.fillStyle = color;
  for (const [dx, dy, radius] of [
    [0, 0, 18],
    [20, -8, 22],
    [44, 0, 18],
    [22, 8, 20],
  ] as const) {
    circle(context, x + dx, y + dy, radius);
  }
}

/** A hill and a tree, with what the weather does to them. */
function ground(context: CanvasRenderingContext2D, night: boolean, weather: Weather): void {
  context.fillStyle = night ? '#1f3a33' : '#7ccf72';
  context.fillRect(0, HEIGHT - 34, WIDTH, 34);
  // The wind bends the tree.
  const lean = weather === 'wind' ? 24 : 0;
  context.strokeStyle = night ? '#2a2420' : '#8a5a3b';
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(196, HEIGHT - 30);
  context.lineTo(196 + lean, HEIGHT - 72);
  context.stroke();
  context.fillStyle = night ? '#25463c' : '#4f9a56';
  circle(context, 196 + lean * 1.3, HEIGHT - 84, 26);
}

function details(context: CanvasRenderingContext2D, weather: Weather): void {
  switch (weather) {
    case 'sunny':
      return;
    case 'cloudy':
      cloud(context, 30, 34, '#dfe5ea');
      cloud(context, 130, 46, '#c9d2da');
      return;
    case 'wind':
      context.strokeStyle = 'rgba(255,255,255,0.8)';
      context.lineWidth = 3;
      for (const y of [30, 52, 74]) {
        context.beginPath();
        context.moveTo(20, y);
        context.quadraticCurveTo(70, y - 14, 120, y);
        context.stroke();
      }
      return;
    case 'cold':
      cloud(context, 50, 34, '#e6ebf0');
      context.fillStyle = '#ffffff';
      for (let i = 0; i < 26; i += 1) circle(context, (i * 67) % WIDTH, (i * 41) % HEIGHT, 2.5);
      return;
    case 'rain':
      cloud(context, 20, 26, '#8c98a8');
      cloud(context, 130, 30, '#7c8898');
      return;
  }
}

/** Rain on a pane of its own, which slides down over the view. */
export function paintRain(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.strokeStyle = 'rgba(190,220,250,0.9)';
    context.lineWidth = 2;
    for (let i = 0; i < 44; i += 1) {
      const x = (i * 53) % WIDTH;
      const y = (i * 37) % HEIGHT;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - 3, y + 12);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** What the child sees through the window at one moment. */
export function paintWindow(phase: Phase, weather: Weather): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const night = phase === 'night';
    const [top, bottom] = skies[phase];
    const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, weather === 'rain' && !night ? '#8795a8' : top);
    sky.addColorStop(1, bottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    if (weather === 'sunny' || night) {
      context.fillStyle = night ? '#f2f4ff' : '#ffe27a';
      circle(context, 60, 42, 22);
    }
    ground(context, night, weather);
    details(context, weather);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
