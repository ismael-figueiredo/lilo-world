import * as THREE from 'three';

export interface SignStyle {
  readonly background: string;
  readonly color: string;
  readonly width?: number;
  readonly height?: number;
}

const FONT = '"Nunito", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

/** A readable sign (text and emoji) drawn on a canvas, so no image files are needed. */
export function createSign(lines: readonly string[], style: SignStyle): THREE.Mesh {
  const width = style.width ?? 4;
  const height = style.height ?? 1.2;
  const pixels = 256;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * pixels);
  canvas.height = Math.round(height * pixels);
  const context = canvas.getContext('2d');

  if (context !== null) {
    const radius = canvas.height * 0.22;
    context.fillStyle = style.background;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, radius);
    context.fill();
    context.lineWidth = canvas.height * 0.06;
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.beginPath();
    context.roundRect(
      context.lineWidth,
      context.lineWidth,
      canvas.width - context.lineWidth * 2,
      canvas.height - context.lineWidth * 2,
      radius * 0.8,
    );
    context.stroke();

    const lineHeight = canvas.height / (lines.length + 0.4);
    context.fillStyle = style.color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `900 ${Math.round(lineHeight * 0.72)}px ${FONT}`;
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, lineHeight * (index + 0.7), canvas.width * 0.92);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
  );
}
