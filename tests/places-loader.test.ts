import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAPS_READY_CALLBACK, loadPlaces, resetPlacesLoader } from '@/components/forms/places-loader';

interface FakeScript {
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  remove: () => void;
}

const placesLib = { AutocompleteSuggestion: {}, AutocompleteSessionToken: class {} };
let scripts: FakeScript[];
let win: Record<string, unknown>;

const flush = () => new Promise((r) => setTimeout(r, 0));
const settled = (p: Promise<unknown>) => {
  let state = 'pending';
  p.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });
  return () => state;
};
/** What the Maps API does once it is ready: define importLibrary, then call the callback. */
const mapsBecomesReady = () => {
  vi.stubGlobal('google', { maps: { importLibrary: vi.fn(async () => placesLib) } });
  (win[MAPS_READY_CALLBACK] as () => void)();
};

beforeEach(() => {
  resetPlacesLoader();
  scripts = [];
  win = {};
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', {
    createElement: () => {
      const s: FakeScript = { src: '', async: false, onload: null, onerror: null, remove: vi.fn() };
      return s;
    },
    head: { appendChild: (s: FakeScript) => { scripts.push(s); } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadPlaces', () => {
  it('asks the Maps API to call back when ready, with loading=async', () => {
    void loadPlaces('test key');
    expect(scripts).toHaveLength(1);
    const src = scripts[0]!.src;
    expect(src).toContain('key=test%20key');
    expect(src).toContain('loading=async');
    expect(src).toContain(`callback=${MAPS_READY_CALLBACK}`);
    expect(typeof win[MAPS_READY_CALLBACK]).toBe('function');
  });

  it('does not treat the script load event as ready (importLibrary is not defined yet)', async () => {
    const state = settled(loadPlaces('k'));
    scripts[0]!.onload?.();
    await flush();
    expect(state()).toBe('pending');
  });

  it('resolves with the Places library once the API calls back', async () => {
    const loading = loadPlaces('k');
    mapsBecomesReady();
    await expect(loading).resolves.toBe(placesLib);
    expect(win[MAPS_READY_CALLBACK]).toBeUndefined();
  });

  it('loads the script once however many fields mount', async () => {
    const a = loadPlaces('k');
    const b = loadPlaces('k');
    expect(a).toBe(b);
    expect(scripts).toHaveLength(1);
    mapsBecomesReady();
    await a;
  });

  it('skips the script when Maps is already on the page', async () => {
    vi.stubGlobal('google', { maps: { importLibrary: vi.fn(async () => placesLib) } });
    await expect(loadPlaces('k')).resolves.toBe(placesLib);
    expect(scripts).toHaveLength(0);
  });

  it('rejects on a script error and lets the next mount retry', async () => {
    const first = loadPlaces('k');
    scripts[0]!.onerror?.();
    await expect(first).rejects.toThrow('Google Maps failed to load');
    expect(scripts[0]!.remove).toHaveBeenCalled();
    expect(win[MAPS_READY_CALLBACK]).toBeUndefined();

    const second = loadPlaces('k');
    expect(scripts).toHaveLength(2);
    mapsBecomesReady();
    await expect(second).resolves.toBe(placesLib);
  });
});
