'use client';

/**
 * Persist the camera (pan + zoom) in localStorage so reopening Atlas
 * resumes where you left off. Saves are throttled (RAF-debounced + a
 * 500ms tail) to avoid touching localStorage every frame.
 *
 * Restoration writes into the SpatialCamera's mutable targets — those
 * are what the spring damps toward each frame.
 */
import { useEffect } from 'react';
import { graphStore, getCameraTargets } from '@atlas/graph-engine';
import type { Camera, OrthographicCamera } from 'three';

const KEY = 'atlas:camera:v1';

interface Persisted {
  x: number;
  y: number;
  zoom: number;
}

function read(): Persisted | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.zoom === 'number'
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function write(state: Persisted): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function useCameraPersistence(cameraRef: { current: Camera | null }): void {
  // Restore when the camera becomes available.
  useEffect(() => {
    let cancelled = false;
    const tryRestore = () => {
      if (cancelled) return;
      const cam = cameraRef.current as OrthographicCamera | null;
      if (!cam) {
        requestAnimationFrame(tryRestore);
        return;
      }
      const targets = getCameraTargets(cam);
      if (!targets) {
        requestAnimationFrame(tryRestore);
        return;
      }
      const saved = read();
      if (saved) {
        targets.x = saved.x;
        targets.y = saved.y;
        targets.zoom = saved.zoom;
        // Also set the camera position immediately so there's no flight
        // animation from origin → saved on first paint.
        cam.position.x = saved.x;
        cam.position.y = saved.y;
        cam.zoom = saved.zoom;
        cam.updateProjectionMatrix();
      }
    };
    tryRestore();
    return () => {
      cancelled = true;
    };
  }, [cameraRef]);

  // Save on changes — listen to the engine's camera slice. The store
  // already throttles its writes (~once per frame max), and we batch
  // by deferring the actual localStorage write with a setTimeout.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsub = graphStore.subscribe((state, prev) => {
      if (
        prev &&
        prev.camera.x === state.camera.x &&
        prev.camera.y === state.camera.y &&
        prev.camera.zoom === state.camera.zoom
      ) {
        return;
      }
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        write(state.camera);
        pending = null;
      }, 500);
    });
    return () => {
      if (pending) clearTimeout(pending);
      unsub();
    };
  }, []);
}
