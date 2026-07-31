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
// onLayout/onContentSizeChange handlers to feed it real measurements, a
// jumpToLetter(letter) function for the A-Z bar's onPress, and
// recordRowHeight - pass this as the `onLayout` prop directly on each
// row's own outer element (not a wrapper View around it - an earlier
// version used a wrapper, which turned out to cause real scroll stutter,
// see the note below) so the jump estimate uses a real measured average
// instead of a guessed constant.

import { useRef, useCallback } from 'react';
import { SectionList } from 'react-native';

interface Section<T> {
  title: string;
  data: T[];
}

const FALLBACK_ROW_HEIGHT = 96; // used only until the first few real rows have been measured
const MAX_ROW_HEIGHT_SAMPLES = 40; // plenty for a stable average - no need to keep measuring every row forever

export function useAlphabetScroll<T>(sections: Section<T>[], fontScale: number) {
  // The second generic parameter tells TypeScript our sections have a
  // `title: string` field - without it, SectionList assumes the default
  // section shape (no `title` guaranteed), and the actual <SectionList>
  // JSX tag using this ref needs to declare the exact same second
  // generic parameter or the ref type won't match what's rendered.
  const listRef = useRef<SectionList<T, { title: string }>>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const rowHeightSumRef = useRef(0);
  const rowHeightCountRef = useRef(0);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
  }, []);

  const onLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    viewportHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  // Pass this as the `onLayout` prop directly on each row's own outer
  // element. A guessed constant row height was the actual root cause of
  // one real reported bug: with 45 Comics/Manga entries, scrolling/
  // jumping specifically got glitchy near the END of the alphabet (U-Z) -
  // exactly where the guess's error has accumulated the most, since every
  // row before that point gets summed into the jump estimate. Measuring
  // real rows as they render and using the running average fixes the
  // error at its source rather than continuing to re-tune a constant that
  // can never be right for every category (title length, genre-list
  // length, and font scale all affect real row height differently).
  //
  // The FIRST version of this fix wrapped each row in an extra <View
  // onLayout={...}> - which then caused a SEPARATE real bug: continuous
  // stutter while actively scrolling, reported on the same screen right
  // after. An extra native view per row, plus an onLayout event dispatch
  // for every row as cells get recycled during scroll, adds real
  // per-frame cost at list sizes where it starts to matter. Two fixes
  // together: (1) recordRowHeight below now caps itself at
  // MAX_ROW_HEIGHT_SAMPLES instead of doing this work for the life of the
  // screen, and (2) callers now pass this directly as the `onLayout` prop
  // on the row's own existing outer element (see BookCard/ComicCard)
  // instead of adding a wrapper View - a prop on an element that already
  // exists is much cheaper than an entirely new native view per row.
  const recordRowHeight = useCallback((height: number) => {
    if (height <= 0) return; // sometimes reported during initial mount, before layout settles
    if (rowHeightCountRef.current >= MAX_ROW_HEIGHT_SAMPLES) return;
    rowHeightSumRef.current += height;
    rowHeightCountRef.current += 1;
  }, []);

  const getAverageRowHeight = useCallback(() => {
    if (rowHeightCountRef.current === 0) return FALLBACK_ROW_HEIGHT * fontScale;
    return rowHeightSumRef.current / rowHeightCountRef.current;
  }, [fontScale]);

  // Rough estimate only - even with measured heights, this assumes every
  // row in an unseen section is close to the running average, which won't
  // be exactly right for any specific section. Good enough to land in the
  // right neighborhood; the important fix isn't perfect precision, it's
  // not overshooting (below).
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
      const rowHeight = getAverageRowHeight();
      // Clamp to the actual measured scroll range. Even with a measured
      // average (rather than a guess), individual rows still vary enough
      // that error can accumulate over many summed rows - scrolling a
      // ScrollView past its actual content triggers a hard rubber-band
      // bounce back, which looked like the app "freaking out" before this
      // clamp existed. It can't overshoot into that bounce now, regardless
      // of how far off the estimate is for a given letter.
      const maxScrollY = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
      const y = Math.min(estimateSectionOffset(target, headerHeight, rowHeight), maxScrollY);
      listRef.current?.getScrollResponder()?.scrollTo({ y, animated: true });
    },
    [sections, fontScale, estimateSectionOffset, getAverageRowHeight],
  );

  return { listRef, onLayout, onContentSizeChange, jumpToLetter, recordRowHeight };
}
