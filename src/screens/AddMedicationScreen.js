// ================================================================
// AddMedicationScreen.js — Design "Santé Douce"
// Écran admin : ajout d'un médicament
// Photo · Nom · Dosage · Fréquence · Jours · Heure · Enregistrer
// ================================================================

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import * as ImagePicker   from 'expo-image-picker';
import DateTimePicker     from '@react-native-community/datetimepicker';
import { addMedication, uploadMedicationPhoto } from '../services/SupabaseClient';
import { scheduleMedicationNotification }        from '../services/NotificationManager';
import { COLORS, FONTS, SIZES, RADIUS, SHADOWS, G } from '../styles/styles';

const DAYS = [
  { label: 'Dim', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Jeu', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sam', value: 6 },
];

// ================================================================
export default function AddMedicationScreen({ navigation }) {

  // ── État formulaire ────────────────────────────────────────
  const [name,         setName]         = useState('');
  const [dosage,       setDosage]       = useState('');
  const [frequency,    setFrequency]    = useState('daily');
  const [selectedDays, setSelectedDays] = useState([]);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showPicker,   setShowPicker]   = useState(false);
  const [photoUri,     setPhotoUri]     = useState(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [errors,       setErrors]       = useState({});
  const [focusField,   setFocusField]   = useState(null);

  // Animation bouton submit
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1.00, useNativeDriver: true, speed: 50 }).start();

  // ──────────────────────────────────────────────────────────
  // PHOTO
  // ──────────────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les Réglages.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0)
      setPhotoUri(result.assets[0].uri);
  };

  const handlePickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à vos photos dans les Réglages.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0)
      setPhotoUri(result.assets[0].uri);
  };

  // ──────────────────────────────────────────────────────────
  // JOURS
  // ──────────────────────────────────────────────────────────
  const toggleDay = (val) =>
    setSelectedDays((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val]
    );

  // ──────────────────────────────────────────────────────────
  // VALIDATION FORMULAIRE
  // ──────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!name.trim())   e.name   = 'Le nom du médicament est obligatoire.';
    if (!dosage.trim()) e.dosage = 'Le dosage est obligatoire.';
    if (frequency === 'weekly' && selectedDays.length === 0)
      e.days = 'Sélectionnez au moins un jour de la semaine.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ──────────────────────────────────────────────────────────
  // SOUMISSION
  // ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      // 1. Upload photo si présente
      let photoUrl = null;
      if (photoUri) {
        const fileName = `${name.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
        photoUrl = await uploadMedicationPhoto(photoUri, fileName);
      }

      // 2. Heure formatée HH:MM:00
      const hh = String(reminderTime.getHours()).padStart(2, '0');
      const mm = String(reminderTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}:00`;

      // 3. Création dans Supabase
      const newMed = await addMedication({
        name:          name.trim(),
        dosage:        dosage.trim(),
        frequency,
        specific_days: frequency === 'weekly' ? selectedDays : null,
        reminder_time: timeStr,
        photo_url:     photoUrl,
      });

      // 4. Notification locale
      await scheduleMedicationNotification(newMed);

      Alert.alert(
        '✅ Médicament ajouté !',
        `"${name}" — rappel configuré à ${hh}:${mm}.`,
        [{ text: 'Parfait !', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error('[AddMedication]', err.message);
      Alert.alert('Erreur', "Impossible d'enregistrer. Vérifiez votre connexion internet.");
    } finally {
      setIsLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────
  const hh = String(reminderTime.getHours()).padStart(2, '0');
  const mm = String(reminderTime.getMinutes()).padStart(2, '0');

  // ================================================================
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── HEADER ──────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={G.btnIcon}
            onPress={() => navigation.goBack()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Text style={{ fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.pageTitle}>Nouveau médicament</Text>
            <Text style={styles.pageSub}>Configurez le rappel</Text>
          </View>
        </View>

        {/* ── PHOTO ───────────────────────────────────────── */}
        {photoUri ? (
          // Aperçu photo avec bouton changer
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={handleTakePhoto}
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.changePhotoBtnTxt}>📷  Changer la photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Boutons caméra / galerie
          <View style={styles.photoPickerRow}>
            <TouchableOpacity
              style={styles.photoPicker}
              onPress={handleTakePhoto}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Prendre une photo"
            >
              <Text style={styles.photoPickerEmoji}>📷</Text>
              <Text style={styles.photoPickerTxt}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoPicker}
              onPress={handlePickGallery}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Choisir depuis la galerie"
            >
              <Text style={styles.photoPickerEmoji}>🖼️</Text>
              <Text style={styles.photoPickerTxt}>Depuis la galerie</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── NOM ─────────────────────────────────────────── */}
        <View style={G.inputWrap}>
          <Text style={G.inputLabel}>💊  Nom du médicament *</Text>
          <TextInput
            style={[
              G.input,
              focusField === 'name'  && G.inputFocus,
              errors.name            && G.inputError,
            ]}
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: null })); }}
            placeholder="Ex : Doliprane, Metformine…"
            placeholderTextColor={COLORS.textSoft}
            returnKeyType="next"
            onFocus={() => setFocusField('name')}
            onBlur={()  => setFocusField(null)}
            accessible
            accessibilityLabel="Nom du médicament"
          />
          {errors.name && <Text style={styles.errTxt}>⚠  {errors.name}</Text>}
        </View>

        {/* ── DOSAGE ──────────────────────────────────────── */}
        <View style={G.inputWrap}>
          <Text style={G.inputLabel}>📏  Dosage *</Text>
          <TextInput
            style={[
              G.input,
              focusField === 'dosage' && G.inputFocus,
              errors.dosage           && G.inputError,
            ]}
            value={dosage}
            onChangeText={(t) => { setDosage(t); setErrors((e) => ({ ...e, dosage: null })); }}
            placeholder="Ex : 500 mg · 1 comprimé"
            placeholderTextColor={COLORS.textSoft}
            returnKeyType="next"
            onFocus={() => setFocusField('dosage')}
            onBlur={()  => setFocusField(null)}
            accessible
            accessibilityLabel="Dosage"
          />
          {errors.dosage && <Text style={styles.errTxt}>⚠  {errors.dosage}</Text>}
        </View>

        {/* ── FRÉQUENCE ───────────────────────────────────── */}
        <View style={G.inputWrap}>
          <Text style={G.inputLabel}>🔁  Fréquence *</Text>
          <View style={styles.freqRow}>
            {[
              { key: 'daily',   label: 'Quotidien'     },
              { key: 'weekly',  label: 'Hebdomadaire'  },
            ].map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.freqPill, frequency === key && styles.freqPillActive]}
                onPress={() => {
                  setFrequency(key);
                  setErrors((e) => ({ ...e, days: null }));
                }}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ selected: frequency === key }}
              >
                <Text style={[styles.freqPillTxt, frequency === key && styles.freqPillTxtActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── JOURS (hebdomadaire uniquement) ─────────────── */}
        {frequency === 'weekly' && (
          <View style={G.inputWrap}>
            <Text style={G.inputLabel}>📅  Jours de la semaine *</Text>
            <View style={styles.daysRow}>
              {DAYS.map((day) => {
                const active = selectedDays.includes(day.value);
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.dayCircle, active && styles.dayCircleActive]}
                    onPress={() => {
                      toggleDay(day.value);
                      setErrors((e) => ({ ...e, days: null }));
                    }}
                    accessible
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={day.label}
                  >
                    <Text style={[styles.dayCircleTxt, active && styles.dayCircleTxtActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.days && <Text style={styles.errTxt}>⚠  {errors.days}</Text>}
          </View>
        )}

        {/* ── HEURE ───────────────────────────────────────── */}
        <View style={G.inputWrap}>
          <Text style={G.inputLabel}>⏰  Heure du rappel *</Text>

          {/* Affichage heure — tap pour ouvrir le picker */}
          <TouchableOpacity
            style={styles.timeDisplay}
            onPress={() => setShowPicker(true)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Heure sélectionnée : ${hh} heures ${mm}`}
          >
            <Text style={styles.timeTxt}>{hh}  :  {mm}</Text>
            <Text style={styles.timeHint}>✏️  Modifier</Text>
          </TouchableOpacity>

          {/* Picker natif */}
          {showPicker && (
            <DateTimePicker
              value={reminderTime}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selected) => {
                // Android ferme automatiquement ; iOS reste ouvert
                if (Platform.OS !== 'ios') setShowPicker(false);
                if (selected) setReminderTime(selected);
              }}
              locale="fr-FR"
            />
          )}

          {/* Bouton "Confirmer" pour iOS */}
          {showPicker && Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.confirmTimeBtn}
              onPress={() => setShowPicker(false)}
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.confirmTimeTxt}>✓  Confirmer l'heure</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── BOUTON ENREGISTRER ──────────────────────────── */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[G.btnCoral, isLoading && styles.btnDisabled]}
            onPress={handleSubmit}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isLoading}
            activeOpacity={1}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le médicament"
          >
            {isLoading
              ? <ActivityIndicator size="large" color={COLORS.white} />
              : <Text style={G.btnCoralTxt}>💾  Enregistrer le médicament</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ================================================================
// STYLES
// ================================================================
const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  scroll: {
    paddingHorizontal: SIZES.padH,
    paddingTop: SIZES.padTop,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  pageTitle: {
    fontSize: FONTS.md,
    fontWeight: FONTS.black,
    color: COLORS.textDark,
    letterSpacing: -0.8,
    lineHeight: FONTS.lh(FONTS.md),
  },
  pageSub: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.regular,
    color: COLORS.textSoft,
    marginTop: 3,
  },

  // Photo pickers
  photoPickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26,
  },
  photoPicker: {
    flex: 1,
    height: 132,
    backgroundColor: COLORS.warmWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...SHADOWS.sm,
  },
  photoPickerEmoji: { fontSize: 36 },
  photoPickerTxt: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.heavy,
    color: COLORS.coral,
    textAlign: 'center',
  },

  // Aperçu photo
  photoPreviewWrap: {
    marginBottom: 26,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  changePhotoBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: COLORS.coralLight,
  },
  changePhotoBtnTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.heavy,
    color: COLORS.coral,
  },

  // Erreur champ
  errTxt: {
    fontSize: FONTS.xs - 2,
    fontWeight: FONTS.bold,
    color: COLORS.coralDark,
    marginTop: 7,
    paddingLeft: 4,
  },

  // Fréquence
  freqRow: {
    flexDirection: 'row',
    gap: 12,
  },
  freqPill: {
    flex: 1,
    height: 60,
    borderRadius: RADIUS.md,
    borderWidth: 2.5,
    borderColor: COLORS.creamDark,
    backgroundColor: COLORS.warmWhite,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  freqPillActive: {
    borderColor: COLORS.coral,
    backgroundColor: COLORS.coralLight,
    ...SHADOWS.coral,
  },
  freqPillTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.heavy,
    color: COLORS.textSoft,
  },
  freqPillTxtActive: {
    color: COLORS.coral,
  },

  // Jours semaine
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    borderColor: COLORS.creamDark,
    backgroundColor: COLORS.warmWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleActive: {
    borderColor: COLORS.coral,
    backgroundColor: COLORS.coral,
    ...SHADOWS.coral,
  },
  dayCircleTxt: {
    fontSize: 12,
    fontWeight: FONTS.black,
    color: COLORS.textSoft,
  },
  dayCircleTxtActive: {
    color: COLORS.white,
  },

  // Heure
  timeDisplay: {
    height: 88,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    ...SHADOWS.navy,
  },
  timeTxt: {
    fontSize: FONTS.xxl,
    fontWeight: FONTS.black,
    color: COLORS.white,
    letterSpacing: -3,
  },
  timeHint: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.48)',
    fontWeight: FONTS.bold,
  },

  confirmTimeBtn: {
    marginTop: 12,
    height: 54,
    backgroundColor: COLORS.navyLight,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTimeTxt: {
    fontSize: FONTS.xs,
    fontWeight: FONTS.heavy,
    color: COLORS.navy,
  },

  // Bouton désactivé
  btnDisabled: {
    opacity: 0.55,
  },
});