import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { requestReviewIfEligible } from './model/review';

export function useStoreReviewPrompt() {
  useFocusEffect(
    useCallback(() => {
      let focused = true;
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void requestReviewIfEligible(() => focused).catch(() => {});
        }, 1500);
      };
      schedule();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') schedule();
        else clearTimeout(timer);
      });
      return () => {
        focused = false;
        clearTimeout(timer);
        listener.remove();
      };
    }, []),
  );
}
