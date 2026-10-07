import { describe, expect, it } from 'vitest';
import {
  staticMapUrl,
  streetViewMetadataUrl,
  streetViewUrl,
} from '@/lib/maps/google-static';

describe('staticMapUrl', () => {
  const url = new URL(
    staticMapUrl('KEY123', {
      loss: { lat: 32.9546, lng: -97.015 },
      comps: [
        { lat: 32.96, lng: -97.02, position: 1 },
        { lat: 32.97, lng: -97.03, position: 2 },
        { lat: 32.98, lng: -97.04, position: 3 },
      ],
    }),
  );
  const markers = url.searchParams.getAll('markers');

  it('is a hybrid map with the key', () => {
    expect(url.pathname).toBe('/maps/api/staticmap');
    expect(url.searchParams.get('maptype')).toBe('hybrid');
    expect(url.searchParams.get('key')).toBe('KEY123');
    expect(url.searchParams.has('center')).toBe(false);
    expect(url.searchParams.has('zoom')).toBe(false);
  });

  it('has exactly four markers, loss first as a red L', () => {
    expect(markers).toHaveLength(4);
    expect(markers[0]).toBe('color:red|label:L|32.9546,-97.015');
  });

  it('labels comps by position in order', () => {
    expect(markers.slice(1)).toEqual([
      'color:0x1D4ED8|label:1|32.96,-97.02',
      'color:0x1D4ED8|label:2|32.97,-97.03',
      'color:0x1D4ED8|label:3|32.98,-97.04',
    ]);
  });
});

describe('streetViewUrl', () => {
  const loc = { address: '123 Main St, Coppell, TX 75019', lat: 1, lng: 2 };

  it('uses the address, outdoor source and the key', () => {
    const url = new URL(streetViewUrl('KEY123', loc));
    expect(url.pathname).toBe('/maps/api/streetview');
    expect(url.searchParams.get('location')).toBe(loc.address);
    expect(url.searchParams.get('source')).toBe('outdoor');
    expect(url.searchParams.get('key')).toBe('KEY123');
    expect(streetViewUrl('KEY123', loc)).not.toContain(' ');
  });

  it('falls back to coordinates when the address is empty', () => {
    const url = new URL(streetViewUrl('K', { address: ' ', lat: 32.9, lng: -97.1 }));
    expect(url.searchParams.get('location')).toBe('32.9,-97.1');
  });

  it('metadata url mirrors the params', () => {
    const url = new URL(streetViewMetadataUrl('KEY123', loc));
    expect(url.pathname).toBe('/maps/api/streetview/metadata');
    expect(url.searchParams.get('location')).toBe(loc.address);
  });
});
