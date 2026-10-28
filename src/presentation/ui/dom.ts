type Child = Node | string | null | undefined | false;

/** Tiny element builder, so UI code stays readable without a framework. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    onTap?: () => void;
  } = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className !== undefined) element.className = props.className;
  if (props.text !== undefined) element.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  if (props.onTap !== undefined) {
    const onTap = props.onTap;
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      onTap();
    });
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

export const toCssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Restarts a CSS animation class (used for gentle "pop" feedback). */
export function replayAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect(); // forces a reflow so the animation restarts
  element.classList.add(className);
}
