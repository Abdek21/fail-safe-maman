// ============================================================
// App.js
// Point d'entrée principal de l'application Fail-Safe
// Gestion du flux : Auth → Dashboard → Administration
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// Services
import { supabase } from './src/services/SupabaseClient';
import {
  requestNotificationPermissions,
  setupNotificationResponseListener,
  rescheduleAllNotifications,
} from './src/services/NotificationManager';
import { getMedications } from './src/services/SupabaseClient';

// Écrans
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AddMedicationScreen from './src/screens/AddMedicationScreen';

// Styles
import { COLORS, TYPOGRAPHY } from './src/styles/styles';

// ---- Navigation ----
const Stack = createStackNavigator();

// Empêche le SplashScreen de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);        // Session Supabase
  const [isReady, setIsReady] = useState(false);       // App prête (permissions, etc.)
  const navigationRef = useRef(null);                  // Référence à la navigation

  // ============================================================
  // INITIALISATION AU DÉMARRAGE
  // ============================================================
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 1. Récupération de la session existante (connexion persistante)
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      setSession(existingSession);

      // 2. Demande des permissions notifications
      const hasNotifPermission = await requestNotificationPermissions();
      if (!hasNotifPermission) {
        console.warn('[App] Notifications non autorisées — les rappels ne fonctionneront pas.');
      }

      // 3. Si connecté, reprogrammer les notifications (en cas de redémarrage)
      if (existingSession) {
        await setupUserNotifications();
      }

    } catch (err) {
      console.error('[App] Erreur d\'initialisation :', err.message);
    } finally {
      setIsReady(true);
      // Masquage du splash screen
      await SplashScreen.hideAsync();
    }
  };

  // ============================================================
  // LISTENER D'ÉTAT D'AUTHENTIFICATION
  // Gère la connexion et déconnexion en temps réel
  // ============================================================
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`[App] Auth state change : ${event}`);
        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession) {
          // Reprogramme les notifications après connexion
          await setupUserNotifications();
        }

        if (event === 'SIGNED_OUT') {
          // Pas besoin d'annuler les notifications ici (restent utiles)
          console.log('[App] Utilisateur déconnecté.');
        }
      }
    );

    // Nettoyage du listener au démontage
    return () => subscription.unsubscribe();
  }, []);

  // ============================================================
  // LISTENER NOTIFICATIONS — Redirection vers le dashboard
  // ============================================================
  useEffect(() => {
    // Quand l'utilisateur tape sur une notification
    const cleanup = setupNotificationResponseListener((medicationId) => {
      // Navigation vers le dashboard pour afficher l'alerte
      if (navigationRef.current && session) {
        navigationRef.current.navigate('Dashboard');
        // Le DashboardScreen s'occupera d'afficher l'alerte appropriée
      }
    });

    return cleanup;
  }, [session]);

  // ============================================================
  // REPROGRAMMATION DES NOTIFICATIONS
  // ============================================================
  const setupUserNotifications = async () => {
    try {
      const medications = await getMedications();
      if (medications && medications.length > 0) {
        await rescheduleAllNotifications(medications);
        console.log(`[App] ${medications.length} notification(s) reprogrammée(s).`);
      }
    } catch (err) {
      // Non bloquant — l'app reste fonctionnelle sans notifications
      console.error('[App] Erreur reprogrammation notifications :', err.message);
    }
  };

  // ============================================================
  // ÉCRAN DE CHARGEMENT
  // ============================================================
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>💊</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Démarrage de Fail-Safe...</Text>
      </View>
    );
  }

  // ============================================================
  // NAVIGATION PRINCIPALE
  // ============================================================
  return (
    <NavigationContainer ref={navigationRef}>
      {/* StatusBar adaptée à l'état de l'app */}
      <StatusBar style="dark" />

      <Stack.Navigator
        screenOptions={{
          headerShown: false,  // Headers masqués (gestion manuelle dans chaque écran)
          cardStyle: { backgroundColor: COLORS.background },
          // Animation de transition douce
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 300 } },
            close: { animation: 'timing', config: { duration: 200 } },
          },
        }}
      >
        {session ? (
          // Utilisateur connecté → Dashboard + Administration
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ gestureEnabled: false }} // Empêche le swipe-to-go-back
            />
            <Stack.Screen
              name="Admin"
              component={AdminNavigator}
              options={{ presentation: 'modal' }}
            />
          </>
        ) : (
          // Utilisateur déconnecté → Login
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

// ============================================================
// NAVIGATEUR ADMIN (sous-navigation modale)
// ============================================================
const AdminStack = createStackNavigator();

const AdminNavigator = () => {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AddMedication" component={AddMedicationScreen} />
    </AdminStack.Navigator>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    gap: 16,
  },

  loadingEmoji: {
    fontSize: 80,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textMuted,
    marginTop: 8,
  },
});