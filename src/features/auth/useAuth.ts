import { useNetworkState } from 'expo-network';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabase } from '@/lib/supabase';

import { AuthController } from './authController';

export function useAuth() {
  const [controller] = useState(
    () => new AuthController(getSupabase()?.auth ?? null),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const network = useNetworkState();
  const offline =
    network.isConnected === false || network.isInternetReachable === false;
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );

  useEffect(() => {
    const stop = controller.start();
    void controller.restore();
    const subscription = AppState.addEventListener('change', (next) => {
      setForeground(next === 'active');
      if (next === 'active') void controller.restore();
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [controller]);

  useEffect(() => {
    controller.setRefreshEnabled(foreground && !offline);
  }, [controller, foreground, offline]);

  return {
    ...state,
    offline,
    persistent: Platform.OS !== 'web',
    signIn: (email: string, password: string) =>
      offline ? Promise.resolve() : controller.signIn(email, password),
    signOut: () => controller.signOut(),
    retry: () => controller.restore(),
  };
}

export type AuthViewState = ReturnType<typeof useAuth>;
