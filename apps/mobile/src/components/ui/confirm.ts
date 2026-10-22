import { Alert, Platform } from 'react-native';
import { tr } from '@/i18n';

/** Yes/no confirmation. Alert.alert does nothing on web, so the preview falls back to window.confirm. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: tr('لأ، خليني', 'Cancel'), style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
