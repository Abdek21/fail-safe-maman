// ================================================================
// DashboardScreen.js — Design "Santé Douce"
//
// MODE CALME  : fond crème, hero card sauge, liste médicaments
// MODE ALERTE : dégradé corail chaud, anneau animé, bouton géant
// VALIDATION  : arrêt voix + vibration + log Supabase + confirmation
// ================================================================

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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect }  from '@react-navigation/native';

import { getMedications, logIntake, supabase }   from '../services/SupabaseClient';
import { startVoiceAlert, stopVoiceAlert, speakConfirmation } from '../services/VoiceService';
import { setupNotificationReceivedListener }      from '../services/NotificationManager';
import { COLORS, FONTS, SIZES, RADIUS, SHADOWS, G } from '../styles/styles';

// Pattern de vibration répété
const VIBRATION_PATTERN = [0, 700, 400, 700, 400, 700];

// ================================================================
export default function DashboardScreen({ navigation }) {

  // ── État ───────────────────────────────────────────────────
  const [medications,      setMedications]      = useState([]);
  const [activeMedication, setActiveMedication] = useState(null);
  const [isAlertMode,      setIsAlertMode]      = useState(false);
  const [nextReminder,     setNextReminder]      = useState(null);
  const [isLoading,        setIsLoading]         = useState(true);
  const [currentTime,      setCurrentTime]       = useState(new Date());
  const [isValidating,     setIsValidating]      = useState(false); // évite double-tap

  // ── Animations ─────────────────────────────────────────────
  const pulseAnim  = useRef(new Animated.Value(1)).current; // bouton validation
  const ringAnim   = useRef(new Animated.Value(1)).current; // anneau photo
  const btnScale   = useRef(new Animated.Value(1)).current; // feedback press

  // ── Refs intervalles ───────────────────────────────────────
  const checkIntervalRef     = useRef(null);
  const vibrationIntervalRef = useRef(null);
  const pulseLoop            = useRef(null);
  const ringLoop             = useRef(null);

  // ──────────────────────────────────────────────────────────
  // CHARGEMENT MÉDICAMENTS
  // ──────────────────────────────────────────────────────────
  const loadMedications = useCallback(async () => {
    try {
      const data = await getMedications();
      setMedications(data ?? []);
      computeNextReminder(data ?? []);
    } catch (err) {
      console.error('[Dashboard] Chargement :', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Recharge à chaque fois que l'écran redevient actif
  useFocusEffect(useCallback(() => { loadMedications(); }, [loadMedications]));

  // ──────────────────────────────────────────────────────────
  // HORLOGE TEMPS RÉEL
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ──────────────────────────────────────────────────────────
  // VÉRIFICATION DES RAPPELS — toutes les 30 secondes
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (medications.length > 0) checkForDueReminders(medications);

    checkIntervalRef.current = setInterval(() => {
      if (medications.length > 0) checkForDueReminders(medications);
    }, 30_000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [medications]);

  // ──────────────────────────────────────────────────────────
  // LISTENER NOTIFICATIONS (tap depuis la barre de notif)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = setupNotificationReceivedListener((notification) => {
      const medId = notification.request.content.data?.medicationId;
      if (medId) triggerAlert(medId);
    });
    return cleanup;
  }, [medications]);

  // ──────────────────────────────────────────────────────────
  // ANIMATIONS MODE ALERTE
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAlertMode) {
      // Pulsation "breathe" lente du bouton validation
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 950, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.00, duration: 950, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();

      // Anneau pulsant autour de la photo
      ringLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.10, duration: 1300, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 1.00, duration: 1300, useNativeDriver: true }),
        ])
      );
      ringLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      ringLoop.current?.stop();
      pulseAnim.setValue(1);
      ringAnim.setValue(1);
    }
  }, [isAlertMode]);

  // ──────────────────────────────────────────────────────────
  // DÉCLENCHEMENT ALERTE
  // ──────────────────────────────────────────────────────────
  const checkForDueReminders = (meds) => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const d = now.getDay(); // 0=Dim … 6=Sam

    for (const med of meds) {
      const [rh, rm] = med.reminder_time.split(':').map(Number);
      if (h !== rh || m !== rm) continue;

      const dayOk =
        med.frequency === 'daily' ||
        (med.frequency === 'weekly' && med.specific_days?.includes(d));

      if (dayOk) {
        triggerAlert(med.id);
        return; // un seul rappel à la fois
      }
    }
  };

  const triggerAlert = (medicationId) => {
    // Si une alerte est déjà active, on ne l'écrase pas
    if (isAlertMode) return;

    const med = medications.find((m) => m.id === medicationId);
    if (!med) return;

    console.log(`[Dashboard] 🔔 Alerte → ${med.name}`);

    setActiveMedication(med);
    setIsAlertMode(true);

    // Voix en boucle toutes les 15s
    startVoiceAlert(med.name, med.dosage);

    // Vibrations répétées
    if (Platform.OS !== 'web') {
      Vibration.vibrate(VIBRATION_PATTERN, true);
      vibrationIntervalRef.current = setInterval(
        () => Vibration.vibrate(VIBRATION_PATTERN, true),
        15_000
      );
    }
  };

  // ──────────────────────────────────────────────────────────
  // VALIDATION — bouton "J'AI PRIS MON MÉDICAMENT"
  // ──────────────────────────────────────────────────────────
  const handleTaken = async () => {
    if (!activeMedication || isValidating) return;
    setIsValidating(true);

    // Micro-animation de press
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.93, duration: 100, useNativeDriver: true }),
      Animated.spring(btnScale,  { toValue: 1.00, useNativeDriver: true, speed: 20 }),
    ]).start();

    try {
      // 1. Arrêt voix
      await stopVoiceAlert();

      // 2. Arrêt vibrations
      if (Platform.OS !== 'web') {
        Vibration.cancel();
        if (vibrationIntervalRef.current) {
          clearInterval(vibrationIntervalRef.current);
          vibrationIntervalRef.current = null;
        }
      }

      // 3. Log de sécurité dans Supabase
      await logIntake(activeMedication.id);
      console.log(`[Dashboard] ✅ Prise enregistrée → ${activeMedication.name}`);

      // 4. Message vocal de confirmation
      speakConfirmation(activeMedication.name);

      // 5. Retour mode calme
      setIsAlertMode(false);
      setActiveMedication(null);

      // 6. Recalcul prochain rappel
      computeNextReminder(medications);

    } catch (err) {
      Alert.alert('Erreur', "Impossible d'enregistrer la prise. Vérifiez votre connexion.");
      console.error('[Dashboard] Validation :', err.message);
    } finally {
      setIsValidating(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // PROCHAIN RAPPEL
  // ──────────────────────────────────────────────────────────
  const computeNextReminder = (meds) => {
    if (!meds?.length) return setNextReminder(null);
    const now = new Date();
    let nearest = null, nearestDiff = Infinity;

    for (const med of meds) {
      const [h, m] = med.reminder_time.split(':').map(Number);
      const t = new Date();
      t.setHours(h, m, 0, 0);
      if (t <= now) t.setDate(t.getDate() + 1);
      const diff = t - now;
      if (diff < nearestDiff) { nearestDiff = diff; nearest = { med, time: t }; }
    }
    setNextReminder(nearest);
  };

  // ──────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────
  const fmt = (d) =>
    d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const fmtNext = (r) => {
    if (!r) return 'Aucun rappel configuré';
    const isToday = r.time.toDateString() === new Date().toDateString();
    return `${r.med.name}  ·  ${fmt(r.time)}${isToday ? '' : '  (demain)'}`;
  };

  const handleLogout = () =>
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => {
          await stopVoiceAlert();
          await supabase.auth.signOut();
        }
      },
    ]);

  // ──────────────────────────────────────────────────────────
  // RENDU — Chargement
  // ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={G.loadingWrap}>
        <Text style={{ fontSize: 60 }}>💊</Text>
        <ActivityIndicator size="large" color={COLORS.coral} style={{ marginTop: 8 }} />
        <Text style={G.loadingTxt}>Chargement…</Text>
      </View>
    );
  }

  // ================================================================
  // MODE ALERTE
  // ================================================================
  if (isAlertMode && activeMedication) {
    return (
      <LinearGradient
        colors={[COLORS.alertDark, COLORS.alertMid, COLORS.alertLight]}
        style={styles.alertRoot}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      >
        {/* Cercles décoratifs */}
        <View style={styles.alertCircle1} />
        <View style={styles.alertCircle2} />
        <View style={styles.alertCircle3} />

        <ScrollView
          contentContainerStyle={styles.alertScroll}
          showsVerticalScrollIndicator={false}
        >

          {/* Header : badge pulse + heure */}
          <View style={styles.alertHeader}>
            <View style={styles.pulseBadge}>
              <Animated.View style={[styles.pulseDot, {
                opacity: pulseAnim.interpolate({ inputRange: [1, 1.05], outputRange: [1, 0.4] }),
              }]} />
              <Text style={styles.pulseTxt}>Rappel actif</Text>
            </View>
            <Text style={styles.alertClock}>{fmt(currentTime)}</Text>
          </View>

          {/* ── Photo médicament avec anneau pulsant ── */}
          <Animated.View style={[styles.ringWrap, { transform: [{ scale: ringAnim }] }]}>
            <View style={styles.ringOuter}>
              {activeMedication.photo_url ? (
                <Image
                  source={{ uri: activeMedication.photo_url }}
                  style={styles.alertPhoto}
                  accessible
                  accessibilityLabel={`Photo du médicament ${activeMedication.name}`}
                />
              ) : (
                <View style={styles.alertPhotoPlaceholder}>
                  <Text style={{ fontSize: 72 }}>💊</Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Textes ── */}
          <Text style={styles.alertLabel}>C'est l'heure de prendre</Text>
          <Text style={styles.alertMedName}>{activeMedication.name}</Text>
          {activeMedication.dosage ? (
            <Text style={styles.alertMedDosage}>{activeMedication.dosage}</Text>
          ) : null}

          {/* ── Bouton validation GÉANT ── */}
          <Animated.View style={[styles.btnValidationOuter, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={G.btnValidation}
                onPress={handleTaken}
                disabled={isValidating}
                activeOpacity={0.92}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Confirmer la prise du médicament"
              >
                {isValidating ? (
                  <ActivityIndicator size="large" color={COLORS.sage} />
                ) : (
                  <>
                    <Text style={{ fontSize: 56, marginBottom: 10 }}>✅</Text>
                    <Text style={G.btnValidationTxt}>
                      {"J'AI PRIS MON\nMÉDICAMENT"}
                    </Text>
                    <Text style={G.btnValidationSub}>Appuyez pour confirmer</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

        </ScrollView>
      </LinearGradient>
    );
  }

  // ================================================================
  // MODE CALME
  // ================================================================
  return (
    <View style={styles.calmRoot}>
      {/* Arc décoratif en haut */}
      <View style={styles.calmArc} />

      <ScrollView
        contentContainerStyle={styles.calmScroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Barre statut : heure + bouton admin ── */}
        <View style={styles.statusRow}>
          <Text style={styles.clockBig}>{fmt(currentTime)}</Text>
          <TouchableOpacity
            style={G.btnIcon}
            onPress={() => navigation.navigate('Admin')}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Accéder à la configuration"
          >
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Salutation ── */}
        <View style={styles.greetWrap}>
          <Text style={styles.greetSmall}>Bonjour 👋</Text>
          <Text style={styles.greetBig}>
            {'Bonne\n'}
            <Text style={styles.greetAccent}>journée</Text>
          </Text>
        </View>

        {/* ── Hero card sauge — état calme ── */}
        <View style={[G.heroCard, styles.heroCardExtra]}>
          <View style={styles.heroBubble} />

          <Text style={{ fontSize: 54, marginBottom: 14 }}>😊</Text>
          <Text style={styles.heroLabel}>État actuel</Text>
          <Text style={styles.heroMsg}>{'Tout va bien,\nvous êtes en règle'}</Text>
          <Text style={styles.heroSub}>Aucun médicament en attente</Text>

          {/* Chip prochain rappel */}
          <View style={G.chip}>
            <Text style={G.chipTxt}>
              {nextReminder ? `⏰  ${fmtNext(nextReminder)}` : '➕  Ajoutez un médicament'}
            </Text>
          </View>
        </View>

        {/* ── Liste médicaments ── */}
        {medications.length > 0 && (
          <>
            <Text style={G.sectionLabel}>Vos médicaments du jour</Text>
            {medications.map((med) => (
              <View key={med.id} style={G.medCard}>
                <View style={G.medIconBox}>
                  <Text style={{ fontSize: 26 }}>💊</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.medDosage}>{med.dosage}</Text>
                </View>
                <View style={G.amberBadge}>
                  <Text style={G.amberBadgeTxt}>{med.reminder_time.slice(0, 5)}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Bouton ajouter médicament ── */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('Admin')}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Ajouter un médicament"
        >
          <Text style={styles.addBtnTxt}>＋  Ajouter un médicament</Text>
        </TouchableOpacity>

        {/* ── Déconnexion ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutTxt}>Déconnexion</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ================================================================
// STYLES
// ================================================================
const styles = StyleSheet.create({

  // ── MODE ALERTE ────────────────────────────────────────────
  alertRoot: { flex: 1 },

  alertCircle1: {
    position: 'absolute',
    width: 440, height: 440, borderRadius: 220,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -170, right: -170,
  },
  alertCircle2: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 60, left: -110,
  },
  alertCircle3: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: 200, left: 30,
  },

  alertScroll: {
    flexGrow: 1,
    paddingHorizontal: SIZES.padH,
    paddingTop: SIZES.padTop,
    paddingBottom: 52,
    alignItems: 'center',
  },

  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
  },

  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: RADIUS.full,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  pulseDot: {
    width: 11, height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.white,
  },
  pulseTxt: {
    fontSize: 15,
    fontWeight: FONTS.heavy,
    color: 'rgba(255,255,255,0.92)',
  },
  alertClock: {
    fontSize: FONTS.md,
    fontWeight: FONTS.black,
    color: 'rgba(255,255,255,0.92)',
  },

  // Anneau + photo
  ringWrap: { marginBottom: 32 },
  ringOuter: {
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  alertPhoto: {
    width: 162, height: 162,
    borderRadius: 81,
  },
  alertPhotoPlaceholder: {
    width: 162, height: 162,
    borderRadius: 81,
    backgroundColor: COLORS.warmWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Textes alerte
  alertLabel: {
    fontSize: 14,
    fontWeight: FONTS.black,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  alertMedName: {
    fontSize: FONTS.xl,
    fontWeight: FONTS.black,
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: -2,
    lineHeight: FONTS.xl,
    marginBottom: 10,
  },
  alertMedDosage: {
    fontSize: FONTS.md,
    fontWeight: FONTS.bold,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    marginBottom: 44,
  },

  btnValidationOuter: { width: '100%' },

  // ── MODE CALME ─────────────────────────────────────────────
  calmRoot: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  calmArc: {
    position: 'absolute',
    top: -90, left: -70, right: -70,
    height: 340,
    borderRadius: 999,
    backgroundColor: COLORS.coralLight,
    opacity: 0.60,
  },
  calmScroll: {
    flexGrow: 1,
    paddingHorizontal: SIZES.padH,
    paddingTop: SIZES.padTop,
    paddingBottom: 52,
  },

  // Statut
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },
  clockBig: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.black,
    color: COLORS.textDark,
    letterSpacing: -3,
  },

  // Salutation
  greetWrap: { marginBottom: 28 },
  greetSmall: {
    fontSize: 15,
    fontWeight: FONTS.heavy,
    color: COLORS.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  greetBig: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.black,
    color: COLORS.textDark,
    letterSpacing: -1.5,
    lineHeight: FONTS.lh(FONTS.lg),
  },
  greetAccent: {
    color: COLORS.coral,
    fontStyle: 'italic',
  },

  // Hero card
  heroCardExtra: { marginBottom: 32 },
  heroBubble: {
    position: 'absolute',
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.09)',
    top: -65, right: -65,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: FONTS.black,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroMsg: {
    fontSize: FONTS.md,
    fontWeight: FONTS.black,
    color: COLORS.white,
    lineHeight: FONTS.lh(FONTS.md),
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.regular,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 22,
  },

  // Médicaments
  medName: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.heavy,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  medDosage: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.regular,
    color: COLORS.textSoft,
  },

  // Bouton ajouter
  addBtn: {
    height: 66,
    borderRadius: RADIUS.lg,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(92,79,68,0.20)',
    backgroundColor: COLORS.creamDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  addBtnTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.heavy,
    color: COLORS.textSoft,
  },

  // Déconnexion
  logoutBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutTxt: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.regular,
    color: COLORS.textSoft,
    textDecorationLine: 'underline',
  },
});