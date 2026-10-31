import * as THREE from 'three';

const WIDTH = 256;
const HEIGHT = 140;

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
