'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Field } from '@/components/ui/primitives';
import styles from './AddressAutocomplete.module.css';

/**
 * Loss address input with optional Google Places suggestions.
 *
 * Google is an enhancement, never a dependency. With no key, or if the script or
 * any Places call fails, this is the plain <Field> and the caller's onBlur
 * (Census geocoding) does the work exactly as before.
 *
 * Uses the Places Autocomplete Data API (New) and renders its own list so the
 * suggestions match the form; the PlaceAutocompleteElement web component cannot
 * be styled that way.
 */

export interface SelectedAddress {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (selected: SelectedAddress) => void;
  onBlur?: () => void;
  helper?: string;
  placeholder?: string;
  apiKey: string | undefined;
}

type PlacesLib = google.maps.PlacesLibrary;
type Suggestion = google.maps.places.AutocompleteSuggestion;

let mapsPromise: Promise<PlacesLib> | null = null;

/** Loads the Maps JS API once per page, however many components mount. */
function loadPlaces(apiKey: string): Promise<PlacesLib> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    if (typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function') return resolve();
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&v=weekly&libraries=places&loading=async';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  })
    .then(() => google.maps.importLibrary('places') as Promise<PlacesLib>)
    .catch((err) => {
      mapsPromise = null;
      throw err;
    });
  return mapsPromise;
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

export function AddressAutocomplete({
  id, label, value, onChange, onSelect, onBlur, helper, placeholder, apiKey,
}: Props) {
  const listId = useId();
  const [places, setPlaces] = useState<PlacesLib | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The Field owns its label/helper layout, so the panel is positioned from the
  // input's measured bottom rather than a hard-coded offset.
  const [panelTop, setPanelTop] = useState(0);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Text the operator typed; suggestions are only fetched for edits, not for
  // the value we write back after a selection.
  const typed = useRef(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadPlaces(apiKey).then(
      (lib) => { if (!cancelled) setPlaces(lib); },
      () => { /* silent: plain input keeps working */ },
    );
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const input = value.trim();
    if (!places || !typed.current || input.length < MIN_CHARS) {
      requestSeq.current++;
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const seq = ++requestSeq.current;
    timer.current = setTimeout(async () => {
      try {
        token.current ??= new places.AutocompleteSessionToken();
        const { suggestions: found } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: token.current,
            includedRegionCodes: ['us'],
            includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
          });
        if (seq !== requestSeq.current) return;
        const withPredictions = found.filter((s) => s.placePrediction);
        const inputEl = document.getElementById(id);
        if (inputEl) setPanelTop(inputEl.offsetTop + inputEl.offsetHeight + 4);
        setSuggestions(withPredictions);
        setActive(-1);
        setOpen(withPredictions.length > 0);
      } catch {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, places, id]);

  const close = useCallback(() => {
    requestSeq.current++;
    setOpen(false);
    setActive(-1);
  }, []);

  const choose = useCallback(async (suggestion: Suggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    close();
    const text = prediction.text.toString();
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
      // The session ends with this details call; the next typing session gets a new token.
      token.current = null;
      const location = place.location;
      if (!location) throw new Error('No location');
      typed.current = false;
      onSelect({
        address: place.formattedAddress ?? text,
        lat: location.lat(),
        lng: location.lng(),
      });
    } catch {
      // Keep the chosen text; blur falls back to Census geocoding.
      token.current = null;
      typed.current = false;
      onChange(text);
    }
  }, [close, onChange, onSelect]);

  if (!apiKey) {
    return (
      <Field id={id} label={label} value={value} placeholder={placeholder} helper={helper}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
    );
  }

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className={styles.wrap}>
      <Field
        id={id} label={label} value={value} placeholder={placeholder} helper={helper}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onBlur={() => { close(); onBlur?.(); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            const s = suggestions[active];
            if (s) void choose(s);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      />
      {open && (
        <div className={styles.panel} style={{ top: panelTop }}>
          <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className={styles.list}>
            {suggestions.map((s, i) => (
              <li
                key={s.placePrediction?.placeId ?? i}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={`${styles.option} ${i === active ? styles.active : ''}`}
                // mousedown + preventDefault keeps focus in the input, so the
                // blur geocode does not fire before the selection lands.
                onMouseDown={(e) => { e.preventDefault(); void choose(s); }}
                onMouseEnter={() => setActive(i)}
              >
                {s.placePrediction?.text.toString()}
              </li>
            ))}
          </ul>
          <p className={styles.attribution}>Powered by Google</p>
        </div>
      )}
    </div>
  );
}
