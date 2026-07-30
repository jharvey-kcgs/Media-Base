// lib/useAlphabetScroll.ts
//
// Extracted from BookScreen.tsx after three rounds of real bugs (a React
// Native scrollToLocation bug that silently no-ops on itemIndex:0, a worse
// related bug where a "correction" call snapped back to the very top
// instead, and a scroll-overshoot rubber-band bounce on letters near the
// end of the alphabet) - reusing this hook means any future category with
// an A-Z index gets all of those fixes for free instead of needing them
// re-discovered and re-applied one at a time in a second copy.
//
// Usage: pass your `sections` array (same shape SectionList wants) and get
// back everything needed to wire one up: a ref for the SectionList itself,
// onLayout/onContentSizeChange handlers to feed it real measurements, and
// a jumpToLetter(letter) function for the A-Z bar's onPress.

import { useRef, useCallback } from 'react';
import { SectionList } from 'react-native';

interface Section<T> {
  title: string;
  data: T[];
}

export function useAlphabetScroll<T>(sections: Section<T>[], fontScale: number) {
  const listRef = useRef<SectionList<T>>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
  }, []);

  const onLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    viewportHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  // Rough estimate only - real row height varies with text wrapping, and
  // there's no reliable way to know it in advance without measuring every
  // row, which is exactly what this bypasses for a snappier jump. Good
  // enough to land in the right neighborhood; the important fix isn't
  // precision, it's not overshooting (below).
  const estimateSectionOffset = useCallback(
    (targetIndex: number, headerHeight: number, rowHeight: number) => {
      let offset = 0;
      for (let i = 0; i < targetIndex; i++) {
        offset += headerHeight + sections[i].data.length * rowHeight;
      }
      return offset;
    },
    [sections],
  );

  const jumpToLetter = useCallback(
    (letter: string) => {
      const index = sections.findIndex((s) => s.title >= letter);
      const target = index === -1 ? sections.length - 1 : index;
      if (target < 0 || !sections[target]) return;
      const headerHeight = 26 * fontScale;
      const rowHeight = 96 * fontScale; // rough: padding + ~3 lines of text + margin
      // Clamp to the actual measured scroll range. The estimate above can
      // accumulate enough error over many summed rows - worst for a letter
      // near the end of the alphabet, or any letter with an unusually large
      // section before it - to land way past the list's real scrollable
      // height. Scrolling a ScrollView past its actual content triggers a
      // hard rubber-band bounce back, which looked like the app "freaking
      // out" before this clamp existed. It can't overshoot into that
      // bounce now, regardless of how far off the per-row guess is.
      const maxScrollY = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
      const y = Math.min(estimateSectionOffset(target, headerHeight, rowHeight), maxScrollY);
      listRef.current?.getScrollResponder()?.scrollTo({ y, animated: true });
    },
    [sections, fontScale, estimateSectionOffset],
  );

  return { listRef, onLayout, onContentSizeChange, jumpToLetter };
}
