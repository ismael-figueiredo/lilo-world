import * as THREE from 'three';
import { lowPoly } from '@presentation/world/materials';

export interface SignStyle {
  readonly background: string;
  readonly color: string;
  readonly width?: number;
  readonly height?: number;
}

const FONT = '"Nunito", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const PIXELS_PER_UNIT = 384;
const THICKNESS = 0.16;
/** Emoji at the start of the first line, drawn big inside a white badge. */
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;

function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function drawFace(lines: readonly string[], style: SignStyle, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * PIXELS_PER_UNIT);
  canvas.height = Math.round(height * PIXELS_PER_UNIT);
  const context = canvas.getContext('2d');
  if (context === null) return canvas;
  const { width: w, height: h } = canvas;

  const gradient = context.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, style.background);
  gradient.addColorStop(1, shade(style.background, -0.18));
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);

  // Soft light band at the top: reads as a glossy, painted board.
  context.fillStyle = 'rgba(255,255,255,0.16)';
  context.fillRect(0, 0, w, h * 0.42);

  const inset = h * 0.07;
  context.lineWidth = h * 0.045;
  context.strokeStyle = 'rgba(255,255,255,0.9)';
  context.beginPath();
  context.roundRect(inset, inset, w - inset * 2, h - inset * 2, h * 0.16);
  context.stroke();

  const [first = '', ...rest] = lines;
  const emoji = LEADING_EMOJI.exec(first);
  const texts = [emoji === null ? first : first.slice(emoji[0].length), ...rest];
  let left = inset * 2;
  if (emoji !== null) {
    const badge = h * 0.34;
    const cx = left + badge;
    context.fillStyle = 'rgba(255,255,255,0.95)';
    context.beginPath();
    context.arc(cx, h / 2, badge, 0, Math.PI * 2);
    context.fill();
    context.font = `${Math.round(badge * 1.2)}px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji[1] ?? '', cx, h / 2 + badge * 0.08);
    left = cx + badge + inset;
  }

  const lineHeight = (h - inset * 2) / (texts.length + 0.3);
  const textWidth = w - left - inset * 2;
  context.fillStyle = style.color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `900 ${Math.round(lineHeight * 0.62)}px ${FONT}`;
  context.shadowColor = 'rgba(0,0,0,0.28)';
  context.shadowOffsetY = lineHeight * 0.05;
  context.shadowBlur = lineHeight * 0.06;
  texts.forEach((text, index) => {
    const y = inset + lineHeight * (index + 0.65);
    context.fillText(text, left + textWidth / 2, y, textWidth);
  });
  return canvas;
}

/** Lightens (amount > 0) or darkens a CSS hex color. */
function shade(hex: string, amount: number): string {
  const color = new THREE.Color(hex);
  color.offsetHSL(0, 0, amount);
  return `#${color.getHexString()}`;
}

/**
 * A readable 3D sign: a thick board with round corners, a white trim and the
 * text (and leading emoji) painted on the front. No image files are needed.
 * The front faces local +z; the origin is the center of the board.
 */
export function createSign(lines: readonly string[], style: SignStyle): THREE.Group {
  const width = style.width ?? 4;
  const height = style.height ?? 1.2;
  const group = new THREE.Group();

  const board = new THREE.ExtrudeGeometry(roundedRect(width, height, height * 0.22), {
    depth: THICKNESS,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 6,
  });
  board.translate(0, 0, -THICKNESS);
  const body = new THREE.Mesh(
    board,
    lowPoly(new THREE.Color(shade(style.background, -0.25)).getHex()),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const texture = new THREE.CanvasTexture(drawFace(lines, style, width, height));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const face = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRect(width - 0.04, height - 0.04, height * 0.2), 8),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.35,
    }),
  );
  // ShapeGeometry UVs follow the shape's coordinates; map them to 0..1.
  const uv = face.geometry.attributes.uv as THREE.BufferAttribute;
  const position = face.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, position.getX(i) / width + 0.5, position.getY(i) / height + 0.5);
  }
  face.position.z = 0.045;
  group.add(face);
  return group;
}

/** A sign on two posts, standing on the ground (for the bus stop, paths, the plaza). */
export function createPostSign(
  lines: readonly string[],
  style: SignStyle,
  postHeight = 2.4,
): THREE.Group {
  const height = style.height ?? 1.2;
  const width = style.width ?? 4;
  const group = new THREE.Group();
  const sign = createSign(lines, style);
  sign.position.y = postHeight + height / 2;
  group.add(sign);
  const post = new THREE.CylinderGeometry(0.07, 0.08, postHeight + height * 0.8, 10);
  for (const x of [-width * 0.32, width * 0.32]) {
    const mesh = new THREE.Mesh(post, lowPoly(0x3d4a5c));
    mesh.position.set(x, (postHeight + height * 0.8) / 2, -THICKNESS - 0.08);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}
