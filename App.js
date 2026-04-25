// ================================================================
// App.js — VERSION PRODUCTION CORRIGÉE
//
// BUGS CORRIGÉS :
//   1. Import COLORS/FONTS depuis le nouveau styles.js (G, COLORS, FONTS)
//   2. pingSupabase() au démarrage → log visible dans logcat APK
//   3. Gestion propre des erreurs init (pas de crash silencieux)
//   4. SplashScreen.hideAsync() garanti même si init échoue
//   5. Nettoyage correct des subscriptions auth
//   6. Screen options avec animation fluide pour Android
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { NavigationContainer }  from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar }            from 'expo-status-bar';
import * as SplashScreen        from 'expo-splash-screen';

// Services
import { supabase, getMedications, pingSupabase } from './src/services/SupabaseClient';
import {
  requestNotificationPermissions,
  setupNotificationResponseListener,
  rescheduleAllNotifications,
} from './src/services/NotificationManager';

// Écrans
import LoginScreen          from './src/screens/LoginScreen';
import DashboardScreen      from './src/screens/DashboardScreen';
import AddMedicationScreen  from './src/screens/AddMedicationScreen';

// Styles — nouveau système de design Santé Douce
import { COLORS, FONTS, SIZES } from './src/styles/styles';

// Navigation
const Stack      = createStackNavigator();
const AdminStack = createStackNavigator();

// Empêche le splash de disparaître avant qu'on soit prêt
SplashScreen.preventAutoHideAsync().catch(() => {});

// ================================================================
export default function App() {
  const [session,  setSession]  = useState(null);
  const [isReady,  setIsReady]  = useState(false);
  const navigationRef = useRef(null);

  // ── INITIALISATION ─────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        console.log('[App] === INIT START ===');
        console.log('[App] Platform :', Platform.OS, Platform.Version);

        // 1. Récupère la session existante (connexion persistante)
        const { data: { session: existingSession }, error: sessionErr } =
          await supabase.auth.getSession();

        if (sessionErr) {
          console.warn('[App] getSession error :', sessionErr.message);
        } else {
          console.log('[App] Session existante :', !!existingSession);
          setSession(existingSession ?? null);
        }

        // 2. Ping Supabase — diagnostic critique pour APK
        //    Si ce log affiche "FAILED", le problème est réseau ou config
        await pingSupabase();

        // 3. Permissions notifications (no-op sur web)
        const hasNotif = await requestNotificationPermissions();
        console.log('[App] Notifications autorisées :', hasNotif);

        // 4. Reprogramme les rappels si connecté
        if (existingSession) {
          await _setupNotifications();
        }

      } catch (err) {
        // On log mais on ne plante pas — l'app doit toujours démarrer
        console.error('[App] INIT ERROR :', err.message ?? err);
      } finally {
        // Splash toujours masqué, même en cas d'erreur
        setIsReady(true);
        await SplashScreen.hideAsync().catch(() => {});
        console.log('[App] === INIT DONE ===');
      }
    };

    init();
  }, []);

  // ── LISTENER AUTHENTIFICATION ──────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[App] Auth event :', event);
        setSession(newSession ?? null);

        if (event === 'SIGNED_IN' && newSession) {
          // Petite pause pour laisser le token s'écrire dans AsyncStorage
          setTimeout(_setupNotifications, 500);
        }
      }
    );

    return () => subscription?.unsubscribe?.();
  }, []);

  // ── LISTENER NOTIFICATIONS ─────────────────────────────────
  useEffect(() => {
    // Redirige vers Dashboard quand l'utilisateur tape une notification
    const cleanup = setupNotificationResponseListener((medicationId) => {
      console.log('[App] Tap notif → medId =', medicationId);
      if (navigationRef.current && session) {
        navigationRef.current.navigate('Dashboard');
      }
    });

    return cleanup;
  }, [session]);

  // ── HELPER PRIVÉ ───────────────────────────────────────────
  const _setupNotifications = async () => {
    try {
      const meds = await getMedications();
      if (meds?.length > 0) {
        await rescheduleAllNotifications(meds);
        console.log('[App] Notifs reprogrammées :', meds.length);
      }
    } catch (err) {
      // Non bloquant
      console.warn('[App] Erreur reprogrammation notifs :', err.message);
    }
  };

  // ── ÉCRAN DE CHARGEMENT ────────────────────────────────────
  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingEmoji}>💊</Text>
        <ActivityIndicator
          size="large"
          color={COLORS.coral}
          style={{ marginTop: 16 }}
        />
        <Text style={styles.loadingTxt}>Démarrage…</Text>
      </View>
    );
  }

  // ── NAVIGATION PRINCIPALE ──────────────────────────────────
  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" />

      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Animation fluide sur Android (cardStyleInterpolator evite le lag)
          animationEnabled: Platform.OS !== 'web',
          cardStyle: { backgroundColor: COLORS.cream },
        }}
      >
        {session ? (
          // ── Utilisateur connecté ──
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{
                gestureEnabled: false, // Empêche swipe-back involontaire
              }}
            />
            <Stack.Screen
              name="Admin"
              component={AdminNavigator}
              options={{
                presentation:   'modal',
                animationEnabled: Platform.OS !== 'web',
              }}
            />
          </>
        ) : (
          // ── Utilisateur déconnecté ──
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animationTypeForReplace: 'pop' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ================================================================
// NAVIGATEUR ADMIN (modal)
// ================================================================
const AdminNavigator = () => (
  <AdminStack.Navigator screenOptions={{ headerShown: false }}>
    <AdminStack.Screen name="AddMedication" component={AddMedicationScreen} />
  </AdminStack.Navigator>
);

// ================================================================
// STYLES
// ================================================================
const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    gap: 12,
  },
  loadingEmoji: {
    fontSize: 72,
  },
  loadingTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSoft,
    marginTop: 8,
  },
});