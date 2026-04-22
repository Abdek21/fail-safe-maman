// ============================================================
// AddMedicationScreen.js
// Écran d'administration — Ajout/gestion des médicaments
// Accessible aux aidants/familles (Mode Admin)
// ============================================================

import React, { useState } from 'react';
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
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addMedication, uploadMedicationPhoto, scheduleMedicationNotification } from '../services/SupabaseClient';
import { scheduleMedicationNotification as scheduleNotif } from '../services/NotificationManager';
import { COLORS, TYPOGRAPHY, SIZES, GlobalStyles } from '../styles/styles';

// Jours de la semaine pour la sélection hebdomadaire
const DAYS_OF_WEEK = [
  { label: 'Dim', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Jeu', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sam', value: 6 },
];

const AddMedicationScreen = ({ navigation }) => {
  // ---- ÉTAT DU FORMULAIRE ----
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('daily'); // 'daily' ou 'weekly'
  const [selectedDays, setSelectedDays] = useState([]);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);

  // ---- ÉTAT DU FORMULAIRE (erreurs, loading) ----
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ============================================================
  // GESTION DES PHOTOS
  // ============================================================

  /**
   * Demande les permissions puis ouvre la caméra
   */
  const handleTakePhoto = async () => {
    // Demande de permission caméra
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission refusée',
        'Vous devez autoriser l\'accès à la caméra pour photographier vos médicaments.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Ouverture de la caméra
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],      // Format carré pour la boîte de médicaments
      quality: 0.8,        // Qualité 80% (bon compromis taille/qualité)
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  /**
   * Ouvre la galerie photo
   */
  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ============================================================
  // GESTION DES JOURS (fréquence hebdomadaire)
  // ============================================================
  const toggleDay = (dayValue) => {
    setSelectedDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  // ============================================================
  // VALIDATION DU FORMULAIRE
  // ============================================================
  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Le nom du médicament est obligatoire.';
    }

    if (!dosage.trim()) {
      newErrors.dosage = 'Le dosage est obligatoire.';
    }

    if (frequency === 'weekly' && selectedDays.length === 0) {
      newErrors.days = 'Sélectionnez au moins un jour de la semaine.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================================
  // SOUMISSION DU FORMULAIRE
  // ============================================================
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // 1. Upload de la photo si présente
      let photoUrl = null;
      if (photoUri) {
        const fileName = `${name.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
        photoUrl = await uploadMedicationPhoto(photoUri, fileName);
        console.log('[AddMedication] Photo uploadée :', photoUrl);
      }

      // 2. Formatage de l'heure (HH:MM:00)
      const timeStr = `${String(reminderTime.getHours()).padStart(2, '0')}:${String(reminderTime.getMinutes()).padStart(2, '0')}:00`;

      // 3. Création du médicament dans Supabase
      const newMed = await addMedication({
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        specific_days: frequency === 'weekly' ? selectedDays : null,
        reminder_time: timeStr,
        photo_url: photoUrl,
      });

      console.log('[AddMedication] Médicament créé :', newMed.id);

      // 4. Programmation de la notification locale
      await scheduleNotif(newMed);

      // 5. Succès — retour au dashboard
      Alert.alert(
        '✅ Médicament ajouté',
        `"${name}" a été configuré avec un rappel à ${timeStr.slice(0, 5)}.`,
        [{ text: 'Parfait !', onPress: () => navigation.goBack() }]
      );

    } catch (err) {
      console.error('[AddMedication] Erreur :', err.message);
      Alert.alert(
        'Erreur',
        'Impossible d\'enregistrer le médicament. Vérifiez votre connexion internet.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // RENDU
  // ============================================================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter un médicament</Text>
      </View>

      {/* ---- NOM ---- */}
      <View style={GlobalStyles.inputContainer}>
        <Text style={GlobalStyles.inputLabel}>💊 Nom du médicament *</Text>
        <TextInput
          style={[GlobalStyles.input, errors.name && styles.inputError]}
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: null })); }}
          placeholder="Ex : Doliprane, Metformine..."
          placeholderTextColor={COLORS.border}
          returnKeyType="next"
        />
        {errors.name && <Text style={styles.errorMsg}>{errors.name}</Text>}
      </View>

      {/* ---- DOSAGE ---- */}
      <View style={GlobalStyles.inputContainer}>
        <Text style={GlobalStyles.inputLabel}>📏 Dosage *</Text>
        <TextInput
          style={[GlobalStyles.input, errors.dosage && styles.inputError]}
          value={dosage}
          onChangeText={(t) => { setDosage(t); setErrors((e) => ({ ...e, dosage: null })); }}
          placeholder="Ex : 500mg, 2 comprimés, 1 sachet..."
          placeholderTextColor={COLORS.border}
          returnKeyType="next"
        />
        {errors.dosage && <Text style={styles.errorMsg}>{errors.dosage}</Text>}
      </View>

      {/* ---- FRÉQUENCE ---- */}
      <View style={GlobalStyles.inputContainer}>
        <Text style={GlobalStyles.inputLabel}>🔁 Fréquence *</Text>
        <View style={styles.frequencyRow}>
          <TouchableOpacity
            style={[styles.freqButton, frequency === 'daily' && styles.freqButtonActive]}
            onPress={() => setFrequency('daily')}
          >
            <Text style={[styles.freqButtonText, frequency === 'daily' && styles.freqButtonTextActive]}>
              Quotidien
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.freqButton, frequency === 'weekly' && styles.freqButtonActive]}
            onPress={() => setFrequency('weekly')}
          >
            <Text style={[styles.freqButtonText, frequency === 'weekly' && styles.freqButtonTextActive]}>
              Hebdomadaire
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- JOURS (si hebdomadaire) ---- */}
      {frequency === 'weekly' && (
        <View style={GlobalStyles.inputContainer}>
          <Text style={GlobalStyles.inputLabel}>📅 Jours de la semaine *</Text>
          <View style={styles.daysRow}>
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[styles.dayButton, selectedDays.includes(day.value) && styles.dayButtonActive]}
                onPress={() => toggleDay(day.value)}
              >
                <Text style={[styles.dayButtonText, selectedDays.includes(day.value) && styles.dayButtonTextActive]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.days && <Text style={styles.errorMsg}>{errors.days}</Text>}
        </View>
      )}

      {/* ---- HEURE DU RAPPEL ---- */}
      <View style={GlobalStyles.inputContainer}>
        <Text style={GlobalStyles.inputLabel}>⏰ Heure du rappel *</Text>
        <TouchableOpacity
          style={styles.timePickerButton}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.timePickerText}>
            {reminderTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.timePickerIcon}>🕐</Text>
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedTime) => {
              setShowTimePicker(Platform.OS === 'ios'); // Reste ouvert sur iOS
              if (selectedTime) setReminderTime(selectedTime);
            }}
            locale="fr-FR"
          />
        )}
        {/* Bouton "Confirmer" pour iOS (le picker reste ouvert) */}
        {showTimePicker && Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.confirmTimeButton}
            onPress={() => setShowTimePicker(false)}
          >
            <Text style={styles.confirmTimeText}>Confirmer l'heure</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ---- PHOTO DE LA BOÎTE ---- */}
      <View style={GlobalStyles.inputContainer}>
        <Text style={GlobalStyles.inputLabel}>📸 Photo de la boîte (optionnel)</Text>

        {photoUri ? (
          <View>
            <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
            <TouchableOpacity style={styles.changePhotoButton} onPress={handleTakePhoto}>
              <Text style={styles.changePhotoText}>Changer la photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoActionButton} onPress={handleTakePhoto}>
              <Text style={styles.photoActionEmoji}>📷</Text>
              <Text style={styles.photoActionText}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoActionButton} onPress={handlePickFromGallery}>
              <Text style={styles.photoActionEmoji}>🖼️</Text>
              <Text style={styles.photoActionText}>Depuis la galerie</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ---- BOUTON SOUMETTRE ---- */}
      <TouchableOpacity
        style={[GlobalStyles.buttonPrimary, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.white} />
        ) : (
          <Text style={GlobalStyles.buttonPrimaryText}>✅ Enregistrer le médicament</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

// ============================================================
// STYLES LOCAUX
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.adminLight,
  },

  content: {
    padding: SIZES.padding.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  header: {
    marginBottom: SIZES.spacing.lg,
  },

  backButton: {
    marginBottom: SIZES.spacing.sm,
    padding: SIZES.spacing.xs,
  },

  backButtonText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.medium,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.black,
    color: COLORS.textDark,
  },

  inputError: {
    borderColor: COLORS.alert,
    borderWidth: 2,
  },

  errorMsg: {
    fontSize: TYPOGRAPHY.xs - 2,
    color: COLORS.alert,
    marginTop: 4,
    fontWeight: TYPOGRAPHY.medium,
  },

  // Boutons fréquence
  frequencyRow: {
    flexDirection: 'row',
    gap: SIZES.spacing.sm,
  },

  freqButton: {
    flex: 1,
    height: SIZES.buttonHeight - 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },

  freqButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },

  freqButtonText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.textMuted,
  },

  freqButtonTextActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.bold,
  },

  // Jours de la semaine
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.spacing.xs,
  },

  dayButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },

  dayButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },

  dayButtonText: {
    fontSize: TYPOGRAPHY.xs - 2,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.textMuted,
  },

  dayButtonTextActive: {
    color: COLORS.white,
  },

  // Time picker
  timePickerButton: {
    height: SIZES.inputHeight,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacing.md,
  },

  timePickerText: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.primary,
  },

  timePickerIcon: {
    fontSize: 28,
  },

  confirmTimeButton: {
    marginTop: SIZES.spacing.sm,
    padding: SIZES.spacing.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    alignItems: 'center',
  },

  confirmTimeText: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.bold,
    fontSize: TYPOGRAPHY.sm,
  },

  // Photo
  previewPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    resizeMode: 'cover',
    marginBottom: SIZES.spacing.sm,
  },

  changePhotoButton: {
    padding: SIZES.spacing.sm,
    alignItems: 'center',
  },

  changePhotoText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.xs,
    textDecorationLine: 'underline',
  },

  photoActions: {
    flexDirection: 'row',
    gap: SIZES.spacing.sm,
  },

  photoActionButton: {
    flex: 1,
    height: 120,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.spacing.xs,
  },

  photoActionEmoji: {
    fontSize: 36,
  },

  photoActionText: {
    fontSize: TYPOGRAPHY.xs - 2,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.medium,
  },

  buttonDisabled: {
    opacity: 0.6,
  },
});

export default AddMedicationScreen;