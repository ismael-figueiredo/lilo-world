import * as THREE from 'three';

const WIDTH = 256;
const HEIGHT = 140;
const FROST_BLOTS = 60;

/** Drops on a pane of glass, which slide down over what is behind it. */
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
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Frost grown in from the edges of the glass, on a cold morning. */
export function paintFrost(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (context !== null) {
    for (let i = 0; i < FROST_BLOTS; i += 1) {
      const along = (i * 61) % (WIDTH * 2 + HEIGHT * 2);
      const onTop = along < WIDTH;
      const onBottom = !onTop && along < WIDTH * 2;
      const x = onTop || onBottom ? along % WIDTH : along % 2 === 0 ? 0 : WIDTH;
      const y = onTop ? 0 : onBottom ? HEIGHT : along % HEIGHT;
      const radius = 18 + ((i * 7) % 24);
      const blot = context.createRadialGradient(x, y, 0, x, y, radius);
      blot.addColorStop(0, 'rgba(240,248,255,0.5)');
      blot.addColorStop(1, 'rgba(240,248,255,0)');
      context.fillStyle = blot;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }
  return new THREE.CanvasTexture(canvas);
}
