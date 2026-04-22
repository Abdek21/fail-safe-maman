// ============================================================
// NotificationManager.js
// Gestion des notifications locales récurrentes avec expo-notifications
// Priorité maximale pour assurer la réception même en arrière-plan
// ============================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ============================================================
// CONFIGURATION GLOBALE DES NOTIFICATIONS
// ============================================================

// Comportement des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,    // Affiche la bannière même si l'app est ouverte
    shouldPlaySound: true,    // Joue le son d'alerte
    shouldSetBadge: true,     // Met à jour le badge de l'icône
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// ============================================================
// DEMANDE DE PERMISSIONS
// ============================================================

/**
 * Demande les permissions de notifications à l'utilisateur.
 * À appeler au premier démarrage de l'application.
 *
 * @returns {Promise<boolean>} true si les permissions sont accordées
 */
export const requestNotificationPermissions = async () => {
  // Les notifications locales nécessitent un vrai appareil (pas le simulateur)
  if (!Device.isDevice) {
    console.warn('[NotificationManager] Les notifications ne fonctionnent pas sur simulateur.');
    return false;
  }

  // Vérification des permissions existantes
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Demande de permission si pas encore accordée
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true, // Permissions critiques (contournent le mode Ne pas déranger)
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[NotificationManager] Permission de notification refusée.');
    return false;
  }

  // Configuration spécifique Android : canal de notification haute priorité
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-alerts', {
      name: 'Rappels Médicaments',
      importance: Notifications.AndroidImportance.MAX,  // Priorité maximale
      vibrationPattern: [0, 500, 200, 500, 200, 500],   // Vibration triplement répétée
      lightColor: '#FF0000',                             // Voyant rouge
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,  // Contourne le mode "Ne pas déranger"
    });
  }

  console.log('[NotificationManager] Permissions accordées ✓');
  return true;
};

// ============================================================
// PROGRAMMATION DES NOTIFICATIONS
// ============================================================

/**
 * Programme une notification récurrente pour un médicament.
 * Gère deux modes : quotidien et hebdomadaire (jours spécifiques).
 *
 * @param {Object} medication - Objet médicament depuis Supabase
 * @returns {Promise<string[]>} IDs des notifications programmées
 */
export const scheduleMedicationNotification = async (medication) => {
  const { id, name, dosage, frequency, specific_days, reminder_time } = medication;

  // Parsing de l'heure (format "HH:MM:SS" depuis PostgreSQL)
  const [hours, minutes] = reminder_time.split(':').map(Number);

  const scheduledIds = [];

  if (frequency === 'daily') {
    // Notification quotidienne
    const notifId = await scheduleRepeatingNotification({
      medicationId: id,
      medicationName: name,
      dosage,
      hours,
      minutes,
      weekday: null, // null = tous les jours
    });
    scheduledIds.push(notifId);

  } else if (frequency === 'weekly' && specific_days && specific_days.length > 0) {
    // Notification pour chaque jour spécifié
    // specific_days : tableau d'entiers [0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam]
    for (const day of specific_days) {
      const notifId = await scheduleRepeatingNotification({
        medicationId: id,
        medicationName: name,
        dosage,
        hours,
        minutes,
        weekday: day + 1, // expo-notifications : 1=Dim, 2=Lun ... 7=Sam
      });
      scheduledIds.push(notifId);
    }
  }

  // Sauvegarde des IDs dans AsyncStorage pour pouvoir les annuler plus tard
  await saveNotificationIds(id, scheduledIds);

  console.log(`[NotificationManager] ${scheduledIds.length} notification(s) programmée(s) pour "${name}"`);
  return scheduledIds;
};

/**
 * Annule toutes les notifications d'un médicament spécifique
 * @param {string} medicationId - ID du médicament
 */
export const cancelMedicationNotifications = async (medicationId) => {
  const ids = await getNotificationIds(medicationId);

  for (const notifId of ids) {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  }

  await removeNotificationIds(medicationId);
  console.log(`[NotificationManager] Notifications annulées pour medication ID : ${medicationId}`);
};

/**
 * Annule TOUTES les notifications programmées
 * (utile lors de la déconnexion)
 */
export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[NotificationManager] Toutes les notifications annulées.');
};

/**
 * Reprogramme toutes les notifications depuis la liste de médicaments
 * (utile après une modification ou au redémarrage de l'app)
 *
 * @param {Array} medications - Liste des médicaments actifs
 */
export const rescheduleAllNotifications = async (medications) => {
  await cancelAllNotifications();

  for (const medication of medications) {
    await scheduleMedicationNotification(medication);
  }

  console.log(`[NotificationManager] ${medications.length} médicament(s) reprogrammé(s).`);
};

// ============================================================
// LISTENER — Réponse à l'interaction avec la notification
// ============================================================

/**
 * Configure le listener de réponse aux notifications.
 * À appeler dans App.js au démarrage.
 *
 * @param {Function} onMedicationAlert - Callback reçevant l'ID du médicament
 * @returns {Function} Fonction de nettoyage (à appeler dans useEffect cleanup)
 */
export const setupNotificationResponseListener = (onMedicationAlert) => {
  // L'utilisateur a tapé sur la notification
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const medicationId = response.notification.request.content.data?.medicationId;
    if (medicationId && onMedicationAlert) {
      console.log(`[NotificationManager] Notification tapée pour medication ID : ${medicationId}`);
      onMedicationAlert(medicationId);
    }
  });

  // Retourne la fonction de nettoyage
  return () => subscription.remove();
};

/**
 * Configure le listener de réception (notification reçue alors que l'app est ouverte)
 * @param {Function} onReceived - Callback avec la notification
 * @returns {Function} Fonction de nettoyage
 */
export const setupNotificationReceivedListener = (onReceived) => {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    const medicationId = notification.request.content.data?.medicationId;
    console.log(`[NotificationManager] Notification reçue pour medication ID : ${medicationId}`);
    if (onReceived) onReceived(notification);
  });

  return () => subscription.remove();
};

// ============================================================
// HELPERS PRIVÉS
// ============================================================

/**
 * Programme une notification récurrente (quotidienne ou hebdomadaire)
 * @private
 */
const scheduleRepeatingNotification = async ({
  medicationId,
  medicationName,
  dosage,
  hours,
  minutes,
  weekday, // null pour quotidien, 1-7 pour hebdomadaire
}) => {
  const trigger = weekday
    ? { weekday, hour: hours, minute: minutes, repeats: true } // Hebdomadaire
    : { hour: hours, minute: minutes, repeats: true };          // Quotidien

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💊 Rappel Médicament',
      body: dosage
        ? `C'est l'heure de prendre ${medicationName} — ${dosage}`
        : `C'est l'heure de prendre ${medicationName}`,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      // Données custom pour identifier le médicament lors du tap
      data: { medicationId, medicationName },
      // Android uniquement
      channelId: 'medication-alerts',
      // Badge
      badge: 1,
    },
    trigger,
  });

  return notificationId;
};

// ============================================================
// PERSISTANCE DES IDs DE NOTIFICATIONS (via AsyncStorage)
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_STORAGE_KEY = '@failsafe_notification_ids';

const saveNotificationIds = async (medicationId, notifIds) => {
  try {
    const existing = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    const map = existing ? JSON.parse(existing) : {};
    map[medicationId] = notifIds;
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('[NotificationManager] Erreur sauvegarde IDs :', err);
  }
};

const getNotificationIds = async (medicationId) => {
  try {
    const existing = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!existing) return [];
    const map = JSON.parse(existing);
    return map[medicationId] || [];
  } catch {
    return [];
  }
};

const removeNotificationIds = async (medicationId) => {
  try {
    const existing = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!existing) return;
    const map = JSON.parse(existing);
    delete map[medicationId];
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('[NotificationManager] Erreur suppression IDs :', err);
  }
};