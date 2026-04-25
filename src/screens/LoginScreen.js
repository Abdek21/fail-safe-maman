// ================================================================
// LoginScreen.js — Design "Santé Douce"
// S'affiche UNE SEULE FOIS grâce à la session persistante Supabase
// ================================================================

import React, { useState, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { supabase } from '../services/SupabaseClient';
import { COLORS, FONTS, SIZES, RADIUS, SHADOWS, G } from '../styles/styles';

// ================================================================
export default function LoginScreen() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [mode,         setMode]         = useState('login'); // 'login' | 'register'
  const [error,        setError]        = useState(null);
  const [focusField,   setFocusField]   = useState(null);

  // Feedback press sur le bouton
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1.00, useNativeDriver: true, speed: 50 }).start();

  // ── Connexion ────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir votre email et votre mot de passe.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) throw err;
      // Navigation gérée par onAuthStateChange dans App.js
    } catch {
      setError('Email ou mot de passe incorrect. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Inscription ──────────────────────────────────────────────
  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir votre email et votre mot de passe.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) throw err;
      Alert.alert(
        '✅ Compte créé !',
        'Vérifiez votre email puis connectez-vous.',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    } catch {
      setError("Impossible de créer le compte. Cet email est peut-être déjà utilisé.");
    } finally {
      setIsLoading(false);
    }
  };

  const submit = mode === 'login' ? handleLogin : handleRegister;

  // ================================================================
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Blobs décoratifs ─────────────────────────────── */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />

        {/* ── Logo ─────────────────────────────────────────── */}
        <View style={styles.logoRow}>
          <View style={styles.logoPill}>
            <Text style={styles.logoPillEmoji}>💊</Text>
          </View>
          <View>
            <Text style={styles.logoName}>Fail-Safe</Text>
            <Text style={styles.logoTagline}>Jamais un oubli</Text>
          </View>
        </View>

        {/* ── Headline ─────────────────────────────────────── */}
        <Text style={styles.headline}>
          {'Vos médicaments,\n'}
          <Text style={styles.headlineAccent}>sous contrôle.</Text>
        </Text>
        <Text style={styles.headlineSub}>
          {mode === 'login'
            ? 'Connectez-vous pour accéder à vos rappels'
            : 'Créez votre espace en quelques secondes'}
        </Text>

        {/* ── Card formulaire ──────────────────────────────── */}
        <View style={styles.card}>

          {/* Erreur */}
          {error && (
            <View style={G.errorBox}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <Text style={G.errorTxt}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={G.inputWrap}>
            <Text style={G.inputLabel}>Adresse email</Text>
            <TextInput
              style={[G.input, focusField === 'email' && G.inputFocus]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
              placeholder="maman@famille.fr"
              placeholderTextColor={COLORS.textSoft}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onFocus={() => setFocusField('email')}
              onBlur={()  => setFocusField(null)}
              accessible
              accessibilityLabel="Adresse email"
            />
          </View>

          {/* Mot de passe */}
          <View style={G.inputWrap}>
            <Text style={G.inputLabel}>Mot de passe</Text>
            <TextInput
              style={[G.input, focusField === 'pwd' && G.inputFocus]}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textSoft}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onFocus={() => setFocusField('pwd')}
              onBlur={()  => setFocusField(null)}
              onSubmitEditing={submit}
              accessible
              accessibilityLabel="Mot de passe"
            />
          </View>

          {/* Bouton principal */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={G.btnCoral}
              onPress={submit}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={isLoading}
              activeOpacity={1}
              accessible
              accessibilityRole="button"
              accessibilityLabel={mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            >
              {isLoading
                ? <ActivityIndicator size="large" color={COLORS.white} />
                : <Text style={G.btnCoralTxt}>
                    {mode === 'login' ? '🔐  Se connecter' : '✅  Créer mon compte'}
                  </Text>
              }
            </TouchableOpacity>
          </Animated.View>

          {/* Basculer login ↔ register */}
          <TouchableOpacity
            style={styles.switchWrap}
            onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            accessible
            accessibilityRole="button"
          >
            <Text style={styles.switchTxt}>
              {mode === 'login'
                ? "Pas encore de compte ?  Créer un accès"
                : "Déjà un compte ?  Se connecter"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Badge sécurité ───────────────────────────────── */}
        <View style={styles.secureBadge}>
          <Text style={styles.secureTxt}>🔒  Données chiffrées · Supabase</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ================================================================
// STYLES
// ================================================================
const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: COLORS.warmWhite,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: SIZES.padH,
    paddingTop: SIZES.padTop,
    paddingBottom: 48,
  },

  // Blobs décoratifs (cercles flous colorés)
  blob1: {
    position: 'absolute',
    width: 340, height: 340,
    borderRadius: 170,
    backgroundColor: COLORS.coralLight,
    top: -100, right: -110,
    opacity: 0.85,
  },
  blob2: {
    position: 'absolute',
    width: 240, height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.amberLight,
    top: 200, left: -90,
    opacity: 0.65,
  },
  blob3: {
    position: 'absolute',
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.sageLight,
    bottom: 120, right: -50,
    opacity: 0.5,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 44,
  },
  logoPill: {
    width: 70, height: 70,
    borderRadius: 22,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.coral,
  },
  logoPillEmoji: { fontSize: 34 },
  logoName: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.black,
    color: COLORS.textDark,
    letterSpacing: -1.5,
    lineHeight: FONTS.lg,
  },
  logoTagline: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.bold,
    color: COLORS.textSoft,
    marginTop: 5,
  },

  // Headline
  headline: {
    fontSize: FONTS.lg,
    fontWeight: FONTS.black,
    color: COLORS.textDark,
    lineHeight: FONTS.lh(FONTS.lg),
    letterSpacing: -1.2,
    marginBottom: 12,
  },
  headlineAccent: {
    color: COLORS.coral,
    fontStyle: 'italic',
  },
  headlineSub: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.regular,
    color: COLORS.textSoft,
    lineHeight: FONTS.lh(FONTS.xs),
    marginBottom: 32,
  },

  // Card formulaire
  card: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.xl,
    padding: 28,
    marginBottom: 28,
    ...SHADOWS.md,
  },

  // Switch mode
  switchWrap: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  switchTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.coral,
    textDecorationLine: 'underline',
  },

  // Badge sécurité
  secureBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.sageLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  secureTxt: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.bold,
    color: COLORS.sageDark,
  },
});