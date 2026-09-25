import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';

import type { ReactNode } from 'react';

type ToastTone = 'success' | 'error';
type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      clearTimeout(timer.current);
      setToast({ id: ++nextId.current, message, tone });
      timer.current = setTimeout(() => setToast(null), 3_000);
    },
    [],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View pointerEvents="box-none" style={styles.layer}>
        {toast && (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole={toast.tone === 'error' ? 'alert' : undefined}
            key={toast.id}
            pointerEvents="none"
            style={[
              styles.toast,
              toast.tone === 'error' ? styles.error : styles.success,
            ]}
          >
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  toast: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  success: { backgroundColor: '#17354c' },
  error: { backgroundColor: '#8a2e25' },
  text: { color: '#fff', fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
