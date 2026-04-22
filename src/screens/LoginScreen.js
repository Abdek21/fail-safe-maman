// ============================================================
// LoginScreen.js
// Écran de connexion — s'affiche UNE SEULE FOIS dans la vie de l'app
// grâce à la session persistante Supabase
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { supabase } from '../services/SupabaseClient';
import { COLORS, TYPOGRAPHY, SIZES, GlobalStyles } from '../styles/styles';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' ou 'register'
  const [error, setError] = useState(null);

  // ---- Connexion avec email/mot de passe ----
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;
      // La navigation sera gérée automatiquement par le listener onAuthStateChange dans App.js

    } catch (err) {
      setError('Email ou mot de passe incorrect. Réessayez.');
      console.error('[LoginScreen] Erreur connexion :', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Création de compte ----
  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signUpError) throw signUpError;

      Alert.alert(
        'Compte créé !',
        'Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    } catch (err) {
      setError('Impossible de créer le compte. Cet email est peut-être déjà utilisé.');
      console.error('[LoginScreen] Erreur inscription :', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo et titre */}
        <View style={styles.header}>
          <Text style={styles.emoji}>💊</Text>
          <Text style={styles.appName}>Fail-Safe</Text>
          <Text style={styles.tagline}>Vos médicaments, jamais oubliés</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </Text>

          {/* Bannière d'erreur */}
          {error && (
            <View style={GlobalStyles.errorBanner}>
              <Text style={GlobalStyles.errorText}>⚠ {error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={GlobalStyles.inputContainer}>
            <Text style={GlobalStyles.inputLabel}>Adresse email</Text>
            <TextInput
              style={GlobalStyles.input}
              value={email}
              onChangeText={(text) => { setEmail(text); setError(null); }}
              placeholder="exemple@email.com"
              placeholderTextColor={COLORS.border}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              accessible
              accessibilityLabel="Champ email"
            />
          </View>

          {/* Mot de passe */}
          <View style={GlobalStyles.inputContainer}>
            <Text style={GlobalStyles.inputLabel}>Mot de passe</Text>
            <TextInput
              style={GlobalStyles.input}
              value={password}
              onChangeText={(text) => { setPassword(text); setError(null); }}
              placeholder="Votre mot de passe"
              placeholderTextColor={COLORS.border}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={mode === 'login' ? handleLogin : handleRegister}
              accessible
              accessibilityLabel="Champ mot de passe"
            />
          </View>

          {/* Bouton principal */}
          <TouchableOpacity
            style={GlobalStyles.buttonPrimary}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.textLight} />
            ) : (
              <Text style={GlobalStyles.buttonPrimaryText}>
                {mode === 'login' ? '🔐 Se connecter' : '✅ Créer mon compte'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Basculer entre login et register */}
          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login'
                ? "Pas encore de compte ? Créer un compte"
                : "Déjà un compte ? Se connecter"
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mention sécurité */}
        <Text style={styles.securityNote}>
          🔒 Vos données sont sécurisées et chiffrées
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding.screen,
    paddingVertical: SIZES.spacing.xl,
  },

  header: {
    alignItems: 'center',
    marginBottom: SIZES.spacing.xl,
  },

  emoji: {
    fontSize: 80,
    marginBottom: SIZES.spacing.sm,
  },

  appName: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.primary,
    letterSpacing: -1,
  },

  tagline: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textMuted,
    marginTop: SIZES.spacing.xs,
    textAlign: 'center',
  },

  form: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SIZES.padding.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  formTitle: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textDark,
    marginBottom: SIZES.spacing.md,
    textAlign: 'center',
  },

  switchMode: {
    marginTop: SIZES.spacing.md,
    padding: SIZES.spacing.sm,
    alignItems: 'center',
  },

  switchModeText: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.medium,
    textDecorationLine: 'underline',
  },

  securityNote: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.xs - 2,
    color: COLORS.textMuted,
    marginTop: SIZES.spacing.lg,
  },
});

export default LoginScreen;