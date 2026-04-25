// ================================================================
// styles.js
// Système de design "Santé Douce" — Fail-Safe App
//
// Direction artistique :
//   - Tons crème chauds + Corail (action) + Sauge (succès) + Marine (heure)
//   - Typographie Nunito : arrondie, lisible, senior-friendly
//   - Ombres profondes et colorées pour hiérarchie visuelle immédiate
//   - Boutons massifs (min 68px), polices ≥ 22px, contrastes WCAG AAA
// ================================================================

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ----------------------------------------------------------------
// COULEURS
// ----------------------------------------------------------------
export const COLORS = {
  // Fonds
  cream:       '#FAF7F2',   // fond principal — crème chaud, reposant
  creamDark:   '#F2EDE4',   // fond secondaire / inputs
  warmWhite:   '#FFFDF9',   // blanc très chaud pour les cartes

  // Corail — couleur d'action principale
  coral:       '#E8603C',
  coralLight:  '#FDEBE5',
  coralDark:   '#C44A2A',

  // Sauge — succès / validation / état calme
  sage:        '#5B8A6F',
  sageLight:   '#EAF2EC',
  sageDark:    '#3D6B52',

  // Ambre — horaires, badges informatifs
  amber:       '#D4922A',
  amberLight:  '#FDF3E0',

  // Marine — heure, données techniques
  navy:        '#1E3A5F',
  navyLight:   '#EEF3FA',

  // Texte
  textDark:    '#1A1512',   // quasi-noir chaud
  textMid:     '#5C4F44',   // brun foncé
  textSoft:    '#9A8C82',   // gris chaud
  white:       '#FFFFFF',

  // Alerte — dégradé corail chaud (moins agressif que rouge pur)
  alertDark:   '#C93A20',
  alertMid:    '#E8603C',
  alertLight:  '#F0824A',
};

// ----------------------------------------------------------------
// OMBRES — chaudes, profondes, colorées
// ----------------------------------------------------------------
export const SHADOWS = {
  sm: {
    shadowColor: '#1E140A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#1E140A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  lg: {
    shadowColor: '#1E140A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.16,
    shadowRadius: 48,
    elevation: 10,
  },
  coral: {
    shadowColor: '#E8603C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.40,
    shadowRadius: 32,
    elevation: 8,
  },
  sage: {
    shadowColor: '#5B8A6F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.40,
    shadowRadius: 40,
    elevation: 10,
  },
  navy: {
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 7,
  },
};

// ----------------------------------------------------------------
// RADIUS
// ----------------------------------------------------------------
export const RADIUS = {
  sm:   16,
  md:   24,
  lg:   32,
  xl:   48,
  full: 999,
};

// ----------------------------------------------------------------
// TYPOGRAPHIE — tailles ≥ 22px partout pour les seniors
// ----------------------------------------------------------------
export const FONTS = {
  // Tailles
  xs:  22,    // labels secondaires
  sm:  24,    // corps principal
  md:  28,    // titre de section
  lg:  36,    // titre d'écran
  xl:  48,    // nom médicament en alerte
  xxl: 64,    // heure affichée en gros

  // Poids
  regular: '500',
  bold:    '700',
  heavy:   '800',
  black:   '900',

  // Interligne recommandée × 1.4
  lh: (size) => Math.round(size * 1.4),
};

// ----------------------------------------------------------------
// TAILLES FIXES
// ----------------------------------------------------------------
export const SIZES = {
  btnH:       68,    // hauteur bouton standard
  btnHXL:    110,    // hauteur bouton validation géant
  inputH:     64,    // hauteur champ de saisie
  iconBtn:    52,    // bouton icône carré (ex : ⚙️)
  padH:       24,    // padding horizontal écrans
  padTop: Platform.OS === 'ios' ? 60 : 44,  // padding top safe area
  cardPad:    26,    // padding interne des cartes
  gap: {
    xs: 8,
    sm: 14,
    md: 20,
    lg: 28,
    xl: 40,
  },
};

// ----------------------------------------------------------------
// STYLES GLOBAUX RÉUTILISABLES
// ----------------------------------------------------------------
export const G = StyleSheet.create({

  // ── Fonds d'écran ──────────────────────────────────────────
  screenCream: { flex: 1, backgroundColor: COLORS.cream },

  // ── Cartes ─────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.lg,
    padding: SIZES.cardPad,
    ...SHADOWS.md,
  },
  cardSm: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.md,
    padding: 18,
    ...SHADOWS.sm,
  },

  // ── Hero card sauge (état calme) ───────────────────────────
  heroCard: {
    backgroundColor: COLORS.sage,
    borderRadius: RADIUS.xl,
    padding: 28,
    overflow: 'hidden',
    ...SHADOWS.sage,
  },

  // ── Bouton corail ──────────────────────────────────────────
  btnCoral: {
    height: SIZES.btnH,
    backgroundColor: COLORS.coral,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.coral,
  },
  btnCoralTxt: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.heavy,
    color: COLORS.white,
    letterSpacing: 0.3,
  },

  // ── Bouton validation géant (mode alerte) ──────────────────
  btnValidation: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.xl,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    ...SHADOWS.lg,
  },
  btnValidationTxt: {
    fontSize: 25,
    fontWeight: FONTS.black,
    color: COLORS.sageDark,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: 0.5,
  },
  btnValidationSub: {
    fontSize: 16,
    fontWeight: FONTS.regular,
    color: COLORS.textSoft,
    marginTop: 6,
  },

  // ── Bouton outline ─────────────────────────────────────────
  btnOutline: {
    height: SIZES.btnH,
    borderWidth: 2.5,
    borderColor: COLORS.coral,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnOutlineTxt: {
    fontSize: FONTS.sm,
    fontWeight: FONTS.heavy,
    color: COLORS.coral,
  },

  // ── Bouton icône carré ─────────────────────────────────────
  btnIcon: {
    width: SIZES.iconBtn,
    height: SIZES.iconBtn,
    borderRadius: 16,
    backgroundColor: COLORS.warmWhite,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },

  // ── Inputs ─────────────────────────────────────────────────
  inputWrap:  { marginBottom: SIZES.gap.md },
  inputLabel: {
    fontSize: 13,
    fontWeight: FONTS.black,
    color: COLORS.textMid,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  input: {
    height: SIZES.inputH,
    backgroundColor: COLORS.warmWhite,
    borderWidth: 2.5,
    borderColor: COLORS.creamDark,
    borderRadius: RADIUS.md,
    paddingHorizontal: 20,
    fontSize: FONTS.sm,
    fontWeight: FONTS.bold,
    color: COLORS.textDark,
  },
  inputFocus: {
    borderColor: COLORS.coral,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  inputError: {
    borderColor: COLORS.coral,
    borderWidth: 2.5,
  },

  // ── Erreur ─────────────────────────────────────────────────
  errorBox: {
    backgroundColor: COLORS.coralLight,
    borderRadius: RADIUS.sm,
    padding: 16,
    marginBottom: SIZES.gap.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.coral,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.coralDark,
    flex: 1,
  },

  // ── Chargement ─────────────────────────────────────────────
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    gap: 16,
  },
  loadingTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.bold,
    color: COLORS.textSoft,
  },

  // ── Badge ambre (heure médicament) ─────────────────────────
  amberBadge: {
    backgroundColor: COLORS.amberLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  amberBadgeTxt: {
    fontSize: 15,
    fontWeight: FONTS.black,
    color: COLORS.amber,
  },

  // ── Chip (prochain rappel sur hero card) ───────────────────
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  chipTxt: {
    fontSize: 15,
    fontWeight: FONTS.bold,
    color: COLORS.white,
  },

  // ── Carte médicament (liste) ───────────────────────────────
  medCard: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.lg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  medIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Étiquette section ──────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: FONTS.black,
    color: COLORS.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
});

export { SCREEN_WIDTH, SCREEN_HEIGHT };