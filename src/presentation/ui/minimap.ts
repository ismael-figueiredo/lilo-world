import { h } from '@presentation/ui/dom';
import { MAP_EXTENT } from '@presentation/world/map-projection';

const SIZE = 150;
/** World units shown from the center to the edge of the minimap. */
const RADIUS = 42;

/** Small north-up map in the corner. Tapping it opens the big map. */
export class Minimap {
  readonly element: HTMLCanvasElement;
  private picture: HTMLCanvasElement | undefined;
  private frame = 0;

  constructor(onTap: () => void) {
    this.element = h('canvas', {
      className: 'minimap',
      attrs: {
        width: String(SIZE * 2),
        height: String(SIZE * 2),
        'aria-label': 'Abrir mapa',
        role: 'button',
      },
    });
    this.element.addEventListener('click', (event) => {
      event.stopPropagation();
      onTap();
    });
  }

  setPicture(canvas: HTMLCanvasElement): void {
    this.picture = canvas;
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('is-hidden', !visible);
  }

  draw(
    player: { x: number; z: number; facing: number },
    goal?: { x: number; z: number; icon: string },
  ): void {
    this.frame += 1;
    if (this.frame % 3 !== 0 || this.picture === undefined) return;
    const context = this.element.getContext('2d');
    if (context === null) return;

    const pixels = this.element.width;
    const scale = this.picture.width / (2 * MAP_EXTENT);
    const sourceSize = RADIUS * 2 * scale;
    context.clearRect(0, 0, pixels, pixels);
    context.save();
    context.beginPath();
    context.arc(pixels / 2, pixels / 2, pixels / 2, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#3cc1e0';
    context.fillRect(0, 0, pixels, pixels);
    context.drawImage(
      this.picture,
      (player.x - RADIUS + MAP_EXTENT) * scale,
      (player.z - RADIUS + MAP_EXTENT) * scale,
      sourceSize,
      sourceSize,
      0,
      0,
      pixels,
      pixels,
    );

    if (goal !== undefined) {
      const gx = pixels / 2 + ((goal.x - player.x) / RADIUS) * (pixels / 2);
      const gy = pixels / 2 + ((goal.z - player.z) / RADIUS) * (pixels / 2);
      const inside = Math.hypot(gx - pixels / 2, gy - pixels / 2) < pixels / 2 - 24;
      const angle = Math.atan2(gy - pixels / 2, gx - pixels / 2);
      const x = inside ? gx : pixels / 2 + Math.cos(angle) * (pixels / 2 - 26);
      const y = inside ? gy : pixels / 2 + Math.sin(angle) * (pixels / 2 - 26);
      context.font = '40px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(goal.icon, x, y);
    }
    context.restore();

    // The player: a white arrow in the middle, pointing where they face.
    context.save();
    context.translate(pixels / 2, pixels / 2);
    context.rotate(Math.PI - player.facing);
    context.beginPath();
    context.moveTo(0, -20);
    context.lineTo(14, 14);
    context.lineTo(0, 6);
    context.lineTo(-14, 14);
    context.closePath();
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#2d3142';
    context.lineWidth = 5;
    context.stroke();
    context.fill();
    context.restore();
  }
}
