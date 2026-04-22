// ============================================================
// styles.js
// Feuille de styles globale optimisée pour l'accessibilité senior
// Contrastes élevés, polices larges, boutons massifs
// ============================================================

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// PALETTE DE COULEURS — Contrastes AA/AAA WCAG
// ============================================================
export const COLORS = {
  // États principaux
  calm:           '#F0F7FF',   // Fond bleu très doux (état tranquille)
  alert:          '#CC0000',   // Rouge vif (état alerte)
  alertLight:     '#FFE5E5',   // Rouge très pâle (fond secondaire alerte)

  // Actions
  success:        '#1A7F37',   // Vert foncé (bouton de validation)
  successLight:   '#D4EDDA',   // Vert très pâle
  successPress:   '#155128',   // Vert encore plus foncé (état pressé)

  // Texte
  textDark:       '#1A1A1A',   // Quasi-noir (lisibilité maximale)
  textLight:      '#FFFFFF',   // Blanc pur
  textMuted:      '#555555',   // Gris foncé (texte secondaire)

  // UI Générale
  primary:        '#1565C0',   // Bleu roi (boutons, liens)
  primaryLight:   '#E3F2FD',   // Bleu très pâle (fonds)
  border:         '#BBBBBB',   // Gris clair
  white:          '#FFFFFF',
  background:     '#F5F5F5',

  // Admin
  admin:          '#37474F',   // Gris ardoise foncé
  adminLight:     '#ECEFF1',
};

// ============================================================
// TYPOGRAPHIE — Tailles adaptées à la presbytie
// ============================================================
export const TYPOGRAPHY = {
  // Taille minimale pour les seniors : 22px
  xs:     22,   // Texte secondaire
  sm:     24,   // Corps de texte normal
  md:     28,   // Titre secondaire
  lg:     36,   // Titre principal
  xl:     48,   // Titre XXL (nom du médicament en alerte)
  xxl:    64,   // Très grand (heure, état)

  // Poids
  regular: '400',
  medium:  '500',
  bold:    '700',
  black:   '900',

  // Hauteur de ligne recommandée (1.4× la taille)
  lineHeightFactor: 1.4,
};

// ============================================================
// DIMENSIONS — Boutons massifs (min 80px de haut)
// ============================================================
export const SIZES = {
  buttonHeight:    90,    // Hauteur minimale des boutons
  buttonRadius:    18,    // Arrondi des boutons
  inputHeight:     70,    // Hauteur des champs de saisie
  iconSize:        40,    // Taille des icônes
  spacing: {
    xs:  8,
    sm:  16,
    md:  24,
    lg:  32,
    xl:  48,
  },
  padding: {
    screen: 20,           // Padding horizontal des écrans
    card:   24,
  },
};

// ============================================================
// STYLES PARTAGÉS
// ============================================================
export const GlobalStyles = StyleSheet.create({

  // --- ÉCRANS ---
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screenCalm: {
    flex: 1,
    backgroundColor: COLORS.calm,
  },

  screenAlert: {
    flex: 1,
    backgroundColor: COLORS.alert,
  },

  screenContent: {
    flex: 1,
    paddingHorizontal: SIZES.padding.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SIZES.spacing.lg,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- CARTE ---
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SIZES.padding.card,
    marginVertical: SIZES.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // --- TITRES ---
  titleXXL: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.xxl * TYPOGRAPHY.lineHeightFactor,
  },

  titleXL: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.xl * TYPOGRAPHY.lineHeightFactor,
  },

  titleLg: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lg * TYPOGRAPHY.lineHeightFactor,
  },

  titleMd: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textDark,
    lineHeight: TYPOGRAPHY.md * TYPOGRAPHY.lineHeightFactor,
  },

  // --- TEXTES COURANTS ---
  bodyLg: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.regular,
    color: COLORS.textDark,
    lineHeight: TYPOGRAPHY.sm * TYPOGRAPHY.lineHeightFactor,
  },

  bodySm: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textMuted,
    lineHeight: TYPOGRAPHY.xs * TYPOGRAPHY.lineHeightFactor,
  },

  // --- BOUTONS ---
  // Bouton de validation (VERT GÉANT)
  buttonSuccess: {
    backgroundColor: COLORS.success,
    borderRadius: SIZES.buttonRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: SIZES.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },

  buttonSuccessText: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textLight,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Bouton primaire
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: SIZES.spacing.sm,
  },

  buttonPrimaryText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textLight,
  },

  // Bouton secondaire (outline)
  buttonOutline: {
    borderColor: COLORS.primary,
    borderWidth: 3,
    borderRadius: SIZES.buttonRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: SIZES.spacing.sm,
    backgroundColor: 'transparent',
  },

  buttonOutlineText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.primary,
  },

  // --- INPUTS ---
  inputContainer: {
    marginBottom: SIZES.spacing.md,
  },

  inputLabel: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textDark,
    marginBottom: SIZES.spacing.xs,
  },

  input: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    height: SIZES.inputHeight,
    paddingHorizontal: SIZES.spacing.md,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textDark,
  },

  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 3,
  },

  // --- PHOTO ---
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SIZES.spacing.md,
  },

  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  photoPlaceholder: {
    alignItems: 'center',
    gap: SIZES.spacing.sm,
  },

  // --- HEADER ADMIN ---
  headerAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.spacing.md,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textDark,
  },

  // --- BADGE D'ÉTAT ---
  badge: {
    paddingHorizontal: SIZES.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },

  badgeText: {
    fontSize: TYPOGRAPHY.xs - 4,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textLight,
  },

  // --- SÉPARATEUR ---
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.spacing.md,
  },

  // --- INDICATEUR DE CHARGEMENT ---
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.spacing.md,
  },

  loadingText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textMuted,
  },

  // --- ERREUR ---
  errorBanner: {
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.md,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.alert,
  },

  errorText: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.alert,
    fontWeight: TYPOGRAPHY.medium,
  },
});

// Dimensions de l'écran exportées pour usage dans les composants
export { SCREEN_WIDTH, SCREEN_HEIGHT };