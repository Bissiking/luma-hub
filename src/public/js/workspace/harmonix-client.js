import { request } from '../api.js';
import { workspace } from './store.js';

export const harmonix = { status:'loading', connection:null, data:null, error:null, loading:false };
let pending, generation = 0;
const emit = () => document.dispatchEvent(new CustomEvent('hub:harmonix'));
const hasWidget = () => workspace.data?.widgets.some(widget => widget.type === 'harmonix');
export async function loadHarmonix({ force = false } = {}) {
  if (pending) return pending;
  const epoch = generation;
  pending = (async () => {
    harmonix.loading = true;
    emit();
    try {
      const connection = await request('/api/connectors/harmonix');
      if (epoch !== generation) return;
      harmonix.connection = connection;
      if (!connection.configured) harmonix.data = null;
      else if (hasWidget() || force) {
        const data = await request('/api/connectors/harmonix/music');
        if (epoch !== generation) return;
        harmonix.data = data;
      }
      harmonix.status = 'ready'; harmonix.error = null;
    } catch (error) {
      if (epoch !== generation) return;
      harmonix.status = 'error'; harmonix.error = error;
      // Ne pas laisser une ancienne reprise visible après révocation ou refus.
      harmonix.data = null;
    } finally {
      if (epoch === generation) harmonix.loading = false;
      pending = null; emit();
    }
  })();
  return pending;
}
export async function disconnectHarmonix() {
  const result = await request('/api/connectors/harmonix',{method:'DELETE'});
  generation++; harmonix.connection = result; harmonix.status = 'ready'; harmonix.error = null; harmonix.data = null; harmonix.loading = false;
  emit();
}
export function initHarmonix(render) {
  document.addEventListener('error',event=>{
    if (event.target instanceof HTMLImageElement && event.target.matches('.harmonix-artwork img')) event.target.remove();
  },true);
  document.addEventListener('hub:harmonix', render);
  document.addEventListener('hub:workspace', () => {
    if (hasWidget() && !harmonix.data && harmonix.status === 'ready' && harmonix.connection?.configured) queueMicrotask(() => loadHarmonix());
  });
  document.addEventListener('hub:expired', () => {
    generation++; harmonix.data = null; harmonix.connection = null; harmonix.status = 'loading'; emit();
  });
  loadHarmonix();
  setInterval(() => { if (!document.hidden && hasWidget()) loadHarmonix(); },300000);
}
