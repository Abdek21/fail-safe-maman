// ============================================================
// DashboardScreen.js
// Écran principal "Mode Maman"
// Deux états : CALME (fond bleu doux) et ALERTE (fond rouge + voix)
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Vibration,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMedications, logIntake } from '../services/SupabaseClient';
import { startVoiceAlert, stopVoiceAlert, speakConfirmation } from '../services/VoiceService';
import { setupNotificationReceivedListener } from '../services/NotificationManager';
import { COLORS, TYPOGRAPHY, SIZES, GlobalStyles } from '../styles/styles';
import { supabase } from '../services/SupabaseClient';

// Pattern de vibration pour l'alerte (répété toutes les 3s)
const VIBRATION_PATTERN = [0, 800, 500, 800, 500, 800];

const DashboardScreen = ({ navigation }) => {
  // ---- ÉTAT ----
  const [medications, setMedications] = useState([]);
  const [activeMedication, setActiveMedication] = useState(null); // Médicament en cours d'alerte
  const [isAlertMode, setIsAlertMode] = useState(false);
  const [nextReminder, setNextReminder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Animation du bouton de validation (pulsation)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Intervalle de vérification des rappels
  const checkIntervalRef = useRef(null);
  // Intervalle de vibration
  const vibrationIntervalRef = useRef(null);

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================
  const loadMedications = useCallback(async () => {
    try {
      const data = await getMedications();
      setMedications(data);
      computeNextReminder(data);
    } catch (err) {
      console.error('[Dashboard] Erreur chargement médicaments :', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Recharge à chaque fois que l'écran est affiché
  useFocusEffect(
    useCallback(() => {
      loadMedications();
    }, [loadMedications])
  );

  // ============================================================
  // HORLOGE EN TEMPS RÉEL
  // ============================================================
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // ============================================================
  // VÉRIFICATION DES RAPPELS — toutes les 30 secondes
  // ============================================================
  useEffect(() => {
    // Vérification immédiate au montage
    if (medications.length > 0) checkForDueReminders(medications);

    // Puis toutes les 30 secondes
    checkIntervalRef.current = setInterval(() => {
      if (medications.length > 0) checkForDueReminders(medications);
    }, 30000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [medications]);

  // ============================================================
  // LISTENER NOTIFICATIONS
  // ============================================================
  useEffect(() => {
    const cleanup = setupNotificationReceivedListener((notification) => {
      const medId = notification.request.content.data?.medicationId;
      if (medId) triggerAlertForMedication(medId);
    });
    return cleanup;
  }, [medications]);

  // ============================================================
  // ANIMATION PULSATION DU BOUTON (en mode alerte)
  // ============================================================
  useEffect(() => {
    if (isAlertMode) {
      // Animation de pulsation continue
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAlertMode]);

  // ============================================================
  // LOGIQUE : Vérifier si un rappel est dû maintenant
  // ============================================================
  const checkForDueReminders = (meds) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0=Dim, 1=Lun ... 6=Sam

    for (const med of meds) {
      const [remHour, remMin] = med.reminder_time.split(':').map(Number);

      // L'heure correspond-elle (à la minute près) ?
      if (currentHour !== remHour || currentMinute !== remMin) continue;

      // Le jour correspond-il ?
      const isDayMatch = med.frequency === 'daily'
        || (med.frequency === 'weekly' && med.specific_days?.includes(currentDay));

      if (isDayMatch) {
        triggerAlertForMedication(med.id);
        return; // Un seul rappel à la fois
      }
    }
  };

  /**
   * Active le mode alerte pour un médicament spécifique
   * @param {string} medicationId
   */
  const triggerAlertForMedication = (medicationId) => {
    const med = medications.find((m) => m.id === medicationId);
    if (!med) return;

    console.log(`[Dashboard] 🔔 Alerte déclenchée pour : ${med.name}`);

    setActiveMedication(med);
    setIsAlertMode(true);

    // Démarrage de la boucle vocale
    startVoiceAlert(med.name, med.dosage);

    // Vibrations répétées
    if (Platform.OS !== 'web') {
      Vibration.vibrate(VIBRATION_PATTERN, true); // true = répéter
      vibrationIntervalRef.current = setInterval(() => {
        Vibration.vibrate(VIBRATION_PATTERN, true);
      }, 15000);
    }
  };

  // ============================================================
  // VALIDATION — L'utilisateur appuie sur le bouton vert
  // ============================================================
  const handleMedicationTaken = async () => {
    if (!activeMedication) return;

    try {
      // 1. Arrêt de l'alerte vocale
      await stopVoiceAlert();

      // 2. Arrêt des vibrations
      if (Platform.OS !== 'web') {
        Vibration.cancel();
        if (vibrationIntervalRef.current) {
          clearInterval(vibrationIntervalRef.current);
          vibrationIntervalRef.current = null;
        }
      }

      // 3. Enregistrement dans Supabase (log de sécurité)
      await logIntake(activeMedication.id);
      console.log(`[Dashboard] ✅ Prise enregistrée pour : ${activeMedication.name}`);

      // 4. Message vocal de confirmation
      speakConfirmation(activeMedication.name);

      // 5. Retour au mode calme
      setIsAlertMode(false);
      setActiveMedication(null);

      // 6. Recalcul du prochain rappel
      computeNextReminder(medications);

    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la prise. Vérifiez votre connexion.');
      console.error('[Dashboard] Erreur validation :', err.message);
    }
  };

  // ============================================================
  // CALCUL DU PROCHAIN RAPPEL
  // ============================================================
  const computeNextReminder = (meds) => {
    if (!meds || meds.length === 0) {
      setNextReminder(null);
      return;
    }

    const now = new Date();
    let nearest = null;
    let nearestTime = Infinity;

    for (const med of meds) {
      const [h, m] = med.reminder_time.split(':').map(Number);
      const next = new Date();
      next.setHours(h, m, 0, 0);

      // Si l'heure est déjà passée aujourd'hui, planifier pour demain
      if (next <= now) next.setDate(next.getDate() + 1);

      const diff = next - now;
      if (diff < nearestTime) {
        nearestTime = diff;
        nearest = { med, time: next };
      }
    }

    setNextReminder(nearest);
  };

  // ============================================================
  // UTILITAIRES D'AFFICHAGE
  // ============================================================
  const formatTime = (date) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatNextReminder = (reminder) => {
    if (!reminder) return 'Aucun rappel configuré';
    const timeStr = formatTime(reminder.time);
    const name = reminder.med.name;
    const isToday = reminder.time.toDateString() === new Date().toDateString();
    return isToday
      ? `${name} à ${timeStr} aujourd'hui`
      : `${name} à ${timeStr} demain`;
  };

  // ============================================================
  // DÉCONNEXION
  // ============================================================
  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await stopVoiceAlert();
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  // ============================================================
  // RENDU
  // ============================================================
  if (isLoading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={GlobalStyles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // === MODE ALERTE ===
  if (isAlertMode && activeMedication) {
    return (
      <View style={styles.alertScreen}>
        <ScrollView contentContainerStyle={styles.alertContent}>

          {/* Icône alerte */}
          <Text style={styles.alertEmoji}>🚨</Text>

          {/* Titre alerte */}
          <Text style={styles.alertTitle}>C'EST L'HEURE !</Text>

          {/* Photo du médicament */}
          {activeMedication.photo_url ? (
            <Image
              source={{ uri: activeMedication.photo_url }}
              style={styles.medicationPhoto}
              accessible
              accessibilityLabel={`Photo du médicament ${activeMedication.name}`}
            />
          ) : (
            <View style={styles.photoPlaceholderAlert}>
              <Text style={styles.photoPlaceholderEmoji}>💊</Text>
            </View>
          )}

          {/* Nom du médicament */}
          <Text style={styles.medicationName}>{activeMedication.name}</Text>

          {/* Dosage */}
          {activeMedication.dosage && (
            <Text style={styles.medicationDosage}>{activeMedication.dosage}</Text>
          )}

          {/* BOUTON DE VALIDATION — GÉANT */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
            <TouchableOpacity
              style={styles.validationButton}
              onPress={handleMedicationTaken}
              activeOpacity={0.85}
              accessible
              accessibilityRole="button"
              accessibilityLabel="J'ai pris mon médicament, appuyez pour confirmer"
            >
              <Text style={styles.validationButtonEmoji}>✅</Text>
              <Text style={styles.validationButtonText}>J'AI PRIS MON{'\n'}MÉDICAMENT</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </View>
    );
  }

  // === MODE CALME ===
  return (
    <View style={styles.calmScreen}>
      <ScrollView contentContainerStyle={styles.calmContent}>

        {/* Header avec heure et bouton admin */}
        <View style={styles.calmHeader}>
          <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => navigation.navigate('Admin')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Accéder à la configuration"
          >
            <Text style={styles.adminButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Message de réassurance */}
        <View style={styles.calmMessageContainer}>
          <Text style={styles.calmEmoji}>😊</Text>
          <Text style={styles.calmMessage}>Tout va bien Maman</Text>
          <Text style={styles.calmSubMessage}>Vous n'avez rien à faire pour le moment</Text>
        </View>

        {/* Prochain rappel */}
        <View style={styles.nextReminderCard}>
          <Text style={styles.nextReminderLabel}>⏰ Prochain rappel</Text>
          <Text style={styles.nextReminderText}>{formatNextReminder(nextReminder)}</Text>
        </View>

        {/* Liste des médicaments (aperçu) */}
        {medications.length > 0 && (
          <View style={styles.medicationsList}>
            <Text style={styles.sectionTitle}>Vos médicaments :</Text>
            {medications.map((med) => (
              <View key={med.id} style={styles.medicationItem}>
                <Text style={styles.medicationItemName}>💊 {med.name}</Text>
                <Text style={styles.medicationItemTime}>{med.reminder_time.slice(0, 5)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bouton déconnexion discret */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

// ============================================================
// STYLES LOCAUX
// ============================================================
const styles = StyleSheet.create({
  // --- MODE ALERTE ---
  alertScreen: {
    flex: 1,
    backgroundColor: COLORS.alert,
  },

  alertContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.padding.screen,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 40,
    alignItems: 'center',
  },

  alertEmoji: {
    fontSize: 60,
    marginBottom: SIZES.spacing.sm,
  },

  alertTitle: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textLight,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: SIZES.spacing.md,
  },

  medicationPhoto: {
    width: 220,
    height: 220,
    borderRadius: 20,
    borderWidth: 5,
    borderColor: COLORS.textLight,
    marginVertical: SIZES.spacing.md,
  },

  photoPlaceholderAlert: {
    width: 220,
    height: 220,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SIZES.spacing.md,
  },

  photoPlaceholderEmoji: {
    fontSize: 100,
  },

  medicationName: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SIZES.spacing.xs,
    letterSpacing: 1,
  },

  medicationDosage: {
    fontSize: TYPOGRAPHY.md,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: SIZES.spacing.lg,
  },

  // Bouton validation géant
  validationButton: {
    backgroundColor: COLORS.success,
    borderRadius: 24,
    paddingVertical: SIZES.spacing.lg,
    paddingHorizontal: SIZES.spacing.md,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  validationButtonEmoji: {
    fontSize: 48,
    marginBottom: SIZES.spacing.xs,
  },

  validationButtonText: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textLight,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: TYPOGRAPHY.lg * 1.3,
  },

  // --- MODE CALME ---
  calmScreen: {
    flex: 1,
    backgroundColor: COLORS.calm,
  },

  calmContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.padding.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },

  calmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.spacing.lg,
  },

  currentTime: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.primary,
  },

  adminButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  adminButtonText: {
    fontSize: 28,
  },

  calmMessageContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SIZES.padding.card,
    alignItems: 'center',
    marginBottom: SIZES.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  calmEmoji: {
    fontSize: 72,
    marginBottom: SIZES.spacing.sm,
  },

  calmMessage: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SIZES.spacing.xs,
  },

  calmSubMessage: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  nextReminderCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 18,
    padding: SIZES.padding.card,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.primary,
    marginBottom: SIZES.spacing.md,
  },

  nextReminderLabel: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.primary,
    marginBottom: SIZES.spacing.xs,
  },

  nextReminderText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.textDark,
  },

  medicationsList: {
    marginBottom: SIZES.spacing.md,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textDark,
    marginBottom: SIZES.spacing.sm,
  },

  medicationItem: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SIZES.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  medicationItemName: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.textDark,
  },

  medicationItemTime: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.primary,
  },

  logoutButton: {
    marginTop: SIZES.spacing.lg,
    padding: SIZES.spacing.md,
    alignItems: 'center',
  },

  logoutText: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },
});

export default DashboardScreen;