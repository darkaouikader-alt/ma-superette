// Délégation d'événements : <button data-act="nom" data-arg="valeur">.
// Les champs utilisent data-change="nom" (événement change) ou data-input="nom" (saisie en direct).
type Handler = (arg: string, el: HTMLElement, ev: Event) => void;

const clicks: Record<string, Handler> = {};
const changes: Record<string, Handler> = {};
const inputs: Record<string, Handler> = {};

export const on = (name: string, h: Handler) => { clicks[name] = h; };
export const onChange = (name: string, h: Handler) => { changes[name] = h; };
export const onInput = (name: string, h: Handler) => { inputs[name] = h; };

export function initActions(): void {
  document.body.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    clicks[el.dataset.act!]?.(el.dataset.arg ?? '', el, e);
  });
  document.body.addEventListener('change', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-change]');
    if (el) changes[el.dataset.change!]?.(el.dataset.arg ?? '', el, e);
  });
  document.body.addEventListener('input', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-input]');
    if (el) inputs[el.dataset.input!]?.(el.dataset.arg ?? '', el, e);
  });
}
