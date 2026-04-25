// ================================================================
// NotificationManager.js — VERSION PRODUCTION CORRIGÉE
//
// BUGS CORRIGÉS :
//   1. Crash web : expo-notifications non supporté sur web →
//      toutes les fonctions sont no-op sur Platform.OS === 'web'
//   2. AsyncStorage import en haut du fichier (pas au milieu)
//   3. Guard Device.isDevice robuste (pas de crash simulateur)
//   4. Gestion erreur propre sur scheduleNotificationAsync
// ================================================================

import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { Platform }       from 'react-native';

const IS_WEB = Platform.OS === 'web';
const STORAGE_KEY = '@failsafe_notif_ids';

// ----------------------------------------------------------------
// Configuration globale — ignorée sur web
// ----------------------------------------------------------------
if (!IS_WEB) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

// ================================================================
// PERMISSIONS
// ================================================================

/**
 * Demande les permissions de notifications.
 * Retourne false sur web (non supporté) sans planter.
 */
export const requestNotificationPermissions = async () => {
  // Web : expo-notifications non supporté → on sort proprement
  if (IS_WEB) {
    console.log('[Notif] Web détecté — notifications ignorées');
    return false;
  }

  // Simulateur : pas de token push possible mais notifs locales OK
  if (!Device.isDevice) {
    console.warn('[Notif] Simulateur — les notifs locales peuvent ne pas fonctionner');
    // On continue quand même pour les notifs locales
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert:         true,
        allowBadge:         true,
        allowSound:         true,
        allowCriticalAlerts: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notif] Permission refusée');
    return false;
  }

  // Canal Android haute priorité
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-alerts', {
      name:             'Rappels Médicaments',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor:       '#E8603C',
      sound:            'default',
      enableVibrate:    true,
      showBadge:        true,
      bypassDnd:        true,
    });
  }

  console.log('[Notif] Permissions OK');
  return true;
};

// ================================================================
// PROGRAMMATION DES NOTIFICATIONS
// ================================================================

/**
 * Programme les notifications récurrentes d'un médicament.
 * No-op sur web.
 */
export const scheduleMedicationNotification = async (medication) => {
  if (IS_WEB) return [];

  const { id, name, dosage, frequency, specific_days, reminder_time } = medication;
  const [hours, minutes] = reminder_time.split(':').map(Number);
  const scheduledIds = [];

  try {
    if (frequency === 'daily') {
      const nid = await _scheduleOne({ id, name, dosage, hours, minutes, weekday: null });
      scheduledIds.push(nid);

    } else if (frequency === 'weekly' && specific_days?.length > 0) {
      for (const day of specific_days) {
        const nid = await _scheduleOne({
          id, name, dosage, hours, minutes,
          weekday: day + 1, // expo : 1=Dim…7=Sam
        });
        scheduledIds.push(nid);
      }
    }

    await _saveIds(id, scheduledIds);
    console.log(`[Notif] ${scheduledIds.length} notif(s) programmée(s) pour "${name}"`);
  } catch (err) {
    console.error('[Notif] Erreur programmation :', err.message);
  }

  return scheduledIds;
};

/**
 * Annule les notifications d'un médicament spécifique.
 */
export const cancelMedicationNotifications = async (medicationId) => {
  if (IS_WEB) return;
  const ids = await _getIds(medicationId);
  for (const nid of ids) {
    await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
  }
  await _removeIds(medicationId);
  console.log('[Notif] Notifications annulées pour', medicationId);
};

/**
 * Annule TOUTES les notifications (ex : déconnexion).
 */
export const cancelAllNotifications = async () => {
  if (IS_WEB) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Notif] Toutes les notifications annulées');
};

/**
 * Reprogramme toutes les notifications depuis la liste de médicaments.
 * Appelé au démarrage de l'app après reconnexion.
 */
export const rescheduleAllNotifications = async (medications) => {
  if (IS_WEB) return;
  await cancelAllNotifications();
  for (const med of medications) {
    await scheduleMedicationNotification(med);
  }
  console.log(`[Notif] ${medications.length} médicament(s) reprogrammé(s)`);
};

// ================================================================
// LISTENERS
// ================================================================

/**
 * Listener : tap sur la notification depuis la barre système.
 * Retourne la fonction de cleanup pour useEffect.
 * No-op sur web.
 */
export const setupNotificationResponseListener = (onAlert) => {
  if (IS_WEB) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const medId = response.notification.request.content.data?.medicationId;
    console.log('[Notif] Tap sur notif, medId =', medId);
    if (medId && onAlert) onAlert(medId);
  });

  return () => sub.remove();
};

/**
 * Listener : notification reçue pendant que l'app est ouverte.
 * Retourne la fonction de cleanup pour useEffect.
 * No-op sur web.
 */
export const setupNotificationReceivedListener = (onReceived) => {
  if (IS_WEB) return () => {};

  const sub = Notifications.addNotificationReceivedListener((notification) => {
    const medId = notification.request.content.data?.medicationId;
    console.log('[Notif] Reçue, medId =', medId);
    if (onReceived) onReceived(notification);
  });

  return () => sub.remove();
};

// ================================================================
// PRIVÉ
// ================================================================

const _scheduleOne = async ({ id, name, dosage, hours, minutes, weekday }) => {
  const trigger = weekday
    ? { weekday, hour: hours, minute: minutes, repeats: true }
    : { hour: hours, minute: minutes, repeats: true };

  return Notifications.scheduleNotificationAsync({
    content: {
      title:     '💊 Rappel Médicament',
      body:      dosage
        ? `C'est l'heure de prendre ${name} — ${dosage}`
        : `C'est l'heure de prendre ${name}`,
      sound:     'default',
      data:      { medicationId: id, medicationName: name },
      channelId: 'medication-alerts',
      badge:     1,
      priority:  Notifications.AndroidNotificationPriority.MAX,
    },
    trigger,
  });
};

const _saveIds = async (medicationId, ids) => {
  try {
    const raw  = await AsyncStorage.getItem(STORAGE_KEY);
    const map  = raw ? JSON.parse(raw) : {};
    map[medicationId] = ids;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('[Notif] _saveIds :', e.message);
  }
};

const _getIds = async (medicationId) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw)[medicationId] ?? [];
  } catch {
    return [];
  }
};

const _removeIds = async (medicationId) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[medicationId];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('[Notif] _removeIds :', e.message);
  }
};