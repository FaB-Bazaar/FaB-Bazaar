/**
 * Integration tests: search results must carry the DFC face fields so the UI
 * can offer flip affordances — other_face_printing_id / is_front_face
 * (declared in the DTO but historically never selected, so they came back
 * null/default) plus other_face_image_url for rendering the flip without a
 * second request.
 *
 * Uses the live IAR transform-hero data (Viserai, the Forsaken // Viserai,
 * Usurper), which is guaranteed linked by the face-aware ingest.
 */
import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('searchPrintings — DFC face fields', () => {
  it('flat results carry face linkage and the other face image', async () => {
    const res = await service.searchPrintings({ name: 'Viserai, the Forsaken', exact: true }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.is_front_face).toBe(true);
      expect(p.other_face_printing_id).toBeTruthy();
      expect(p.other_face_image_url).toBeTruthy();
      expect(p.other_face_name).toBe('Viserai, Usurper');
    }
  });

  it('back-face results link back to the front', async () => {
    const res = await service.searchPrintings({ name: 'Viserai, Usurper', exact: true }, { limit: 10 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.is_front_face).toBe(false);
      expect(p.other_face_printing_id).toBeTruthy();
      expect(p.other_face_image_url).toBeTruthy();
    }
  });

  it('single-faced cards stay null', async () => {
    const res = await service.searchPrintings({ name: 'Vox Necropolis', exact: true }, { limit: 5 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    for (const p of res.data.printings) {
      expect(p.other_face_printing_id).toBeNull();
      expect(p.other_face_image_url ?? null).toBeNull();
    }
  });
});
