import { registerSW } from 'virtual:pwa-register';

const state = $state({ needRefresh: false });

let update: ((reload?: boolean) => Promise<void>) | null = null;

if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  update = registerSW({
    onNeedRefresh() {
      state.needRefresh = true;
    },
  });
}

export const pwa = {
  get needRefresh() {
    return state.needRefresh;
  },
  reload(): void {
    void update?.(true);
  },
};
