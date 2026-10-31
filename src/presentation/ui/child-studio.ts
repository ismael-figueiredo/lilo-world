import * as THREE from 'three';
import { rigFor } from '@presentation/actors/avatar-rigs';
import { Figure, figureClips } from '@presentation/actors/child-figure';
import type { PersonLook } from '@presentation/actors/cast';

export type Framing = 'face' | 'body';

const PICTURE_SIZE = 192;
/** The GPU context is given back soon after the last picture. */
const RELEASE_AFTER_MS = 1500;
const SWAY = 0.4;

const framedHeight = (person: PersonLook): number => rigFor(person.build).height;
/** Camera distance for a portrait, in widths of the head. */
const PORTRAIT_DISTANCE = 3.6;

/** A little photo studio: the people the child chooses, in real 3D, outside the game's scene. */
export class ChildStudio {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  private readonly pictures = new Map<string, string>();
  private renderer: THREE.WebGLRenderer | undefined;
  private releaseTimer: number | undefined;
  private live: { host: HTMLElement; mixer: THREE.AnimationMixer; model: THREE.Group } | undefined;
  private frame: number | undefined;
  private lastTime = 0;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4b0, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 5);
    this.scene.add(sun);
  }

  /** A still picture of someone, as an image address. The same picture is drawn once. */
  picture(person: PersonLook, framing: Framing): string {
    const key = `${framing}/${JSON.stringify(person)}`;
    const known = this.pictures.get(key);
    if (known !== undefined) return known;
    const renderer = this.renderTo(PICTURE_SIZE, PICTURE_SIZE);
    const model = this.place(person);
    this.frameOn(person, framing);
    renderer.render(this.scene, this.camera);
    const picture = renderer.domElement.toDataURL('image/png');
    this.remove(model);
    this.pictures.set(key, picture);
    if (this.live === undefined) this.releaseSoon();
    return picture;
  }

  /** Shows someone alive and breathing inside `host`, until `stop`. */
  show(host: HTMLElement, person: PersonLook, wave: boolean): void {
    this.stop();
    const { clientWidth: width, clientHeight: height } = host;
    const renderer = this.renderTo(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    const model = this.place(person);
    const clips = figureClips(person.build);
    const mixer = new THREE.AnimationMixer(model);
    const play = (name: string) => {
      const clip = clips.find((candidate) => candidate.name === name);
      return clip === undefined ? undefined : mixer.clipAction(clip);
    };
    const idle = play('idle');
    const greeting = wave ? play('wave') : undefined;
    if (greeting === undefined) {
      idle?.play();
    } else {
      // One motion at a time: mixed with breathing, a wave would stop halfway up.
      greeting.setLoop(THREE.LoopOnce, 1).play();
      mixer.addEventListener('finished', () => {
        greeting.stop();
        idle?.play();
      });
    }
    this.frameOn(person, 'body');
    host.replaceChildren(renderer.domElement);
    this.live = { host, mixer, model };
    this.lastTime = performance.now();
    this.frame ??= requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    if (this.live !== undefined) {
      this.live.mixer.stopAllAction();
      this.remove(this.live.model);
      this.live = undefined;
    }
    this.releaseSoon();
  }

  private readonly tick = (time: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const { live, renderer } = this;
    if (live === undefined || renderer === undefined) return;
    live.mixer.update(Math.min(0.1, (time - this.lastTime) / 1000));
    this.lastTime = time;
    live.model.rotation.y = Math.sin(time / 2400) * SWAY;
    renderer.render(this.scene, this.camera);
  };

  private renderTo(width: number, height: number): THREE.WebGLRenderer {
    window.clearTimeout(this.releaseTimer);
    this.renderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const { renderer } = this;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    return renderer;
  }

  private place(person: PersonLook): THREE.Group {
    const figure = new Figure(person.look, person.build);
    figure.wear(person.clothes);
    const { model } = figure;
    model.scale.setScalar(framedHeight(person) / figure.body.height);
    this.scene.add(model);
    return model;
  }

  private frameOn(person: PersonLook, framing: Framing): void {
    const height = framedHeight(person);
    if (framing === 'face') {
      const { eyes = 0.8, headWidth = 0.3 } = rigFor(person.build).fit ?? {};
      this.camera.position.set(0, height * eyes, height * headWidth * PORTRAIT_DISTANCE);
      this.camera.lookAt(0, height * eyes, 0);
      return;
    }
    this.camera.position.set(0, height * 0.58, height * 2.5);
    this.camera.lookAt(0, height * 0.5, 0);
  }

  private remove(model: THREE.Group): void {
    this.scene.remove(model);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) (object.geometry as THREE.BufferGeometry).dispose();
    });
  }

  private releaseSoon(): void {
    window.clearTimeout(this.releaseTimer);
    this.releaseTimer = window.setTimeout(() => {
      if (this.live !== undefined) return;
      this.renderer?.domElement.remove();
      this.renderer?.dispose();
      this.renderer?.forceContextLoss();
      this.renderer = undefined;
    }, RELEASE_AFTER_MS);
  }
}
