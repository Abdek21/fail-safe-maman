// ============================================================
// VoiceService.js
// Gestion de la synthèse vocale (Text-To-Speech) avec expo-speech
// Logique de rappel vocal persistant : parle toutes les 15s
// jusqu'à validation manuelle de l'utilisateur
// ============================================================

import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// Intervalle entre chaque répétition vocale (en millisecondes)
const REPEAT_INTERVAL_MS = 15000; // 15 secondes

// Référence à l'intervalle actif (pour pouvoir le stopper)
let repeatIntervalId = null;

// Référence au son d'alerte système
let alertSound = null;

// ============================================================
// FONCTION PRINCIPALE : démarrage de l'alerte vocale en boucle
// ============================================================

/**
 * Démarre la boucle d'alerte vocale pour un médicament donné.
 * La voix se répète toutes les 15 secondes jusqu'à appel de stopVoiceAlert().
 *
 * @param {string} medicationName - Nom du médicament à annoncer
 * @param {string} dosage - Dosage du médicament (optionnel)
 * @param {Function} onError - Callback en cas d'erreur TTS
 */
export const startVoiceAlert = async (medicationName, dosage = null, onError = null) => {
  // Sécurité : on stoppe toute alerte précédente avant d'en démarrer une nouvelle
  await stopVoiceAlert();

  // Construction du message vocal complet
  const message = buildVoiceMessage(medicationName, dosage);

  console.log(`[VoiceService] Démarrage de l'alerte vocale : "${message}"`);

  // Configure le mode audio pour jouer même en mode silencieux (important pour les seniors)
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,       // Joue même avec l'iPhone en mode silencieux
      allowsRecordingIOS: false,
      staysActiveInBackground: true,    // Continue en arrière-plan
      shouldDuckAndroid: false,         // Ne réduit pas le volume des autres apps sur Android
    });
  } catch (audioErr) {
    console.warn('[VoiceService] Impossible de configurer le mode audio :', audioErr);
  }

  // Première annonce immédiate (sans attendre les 15s)
  await speakMessage(message, onError);

  // Puis répétition toutes les REPEAT_INTERVAL_MS millisecondes
  repeatIntervalId = setInterval(async () => {
    // On ne parle pas si une synthèse vocale est déjà en cours
    const isSpeaking = await Speech.isSpeakingAsync();
    if (!isSpeaking) {
      await speakMessage(message, onError);
    }
  }, REPEAT_INTERVAL_MS);
};

// ============================================================
// ARRÊT DE L'ALERTE — À appeler lors de la validation
// ============================================================

/**
 * Arrête immédiatement la boucle vocale et toute synthèse en cours.
 * Doit être appelée quand l'utilisateur clique sur "J'AI PRIS MON MÉDICAMENT".
 */
export const stopVoiceAlert = async () => {
  // Nettoyage de l'intervalle de répétition
  if (repeatIntervalId !== null) {
    clearInterval(repeatIntervalId);
    repeatIntervalId = null;
    console.log('[VoiceService] Boucle vocale arrêtée.');
  }

  // Arrêt de la synthèse vocale en cours
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }
  } catch (err) {
    console.warn('[VoiceService] Erreur lors de l\'arrêt de la voix :', err);
  }

  // Arrêt et déchargement du son d'alerte si actif
  if (alertSound) {
    try {
      await alertSound.stopAsync();
      await alertSound.unloadAsync();
      alertSound = null;
    } catch (err) {
      console.warn('[VoiceService] Erreur lors de l\'arrêt du son d\'alerte :', err);
    }
  }
};

// ============================================================
// VÉRIFICATION D'ÉTAT
// ============================================================

/**
 * Indique si une alerte vocale est actuellement active
 * @returns {boolean}
 */
export const isAlertActive = () => {
  return repeatIntervalId !== null;
};

// ============================================================
// FONCTIONS PRIVÉES (helpers internes)
// ============================================================

/**
 * Prononce un message en français avec les paramètres adaptés aux seniors
 * (débit lent, volume maximum, voix française)
 *
 * @param {string} message - Texte à prononcer
 * @param {Function} onError - Callback d'erreur optionnel
 */
const speakMessage = async (message, onError) => {
  try {
    await Speech.speak(message, {
      language: 'fr-FR',       // Voix française
      pitch: 1.0,              // Hauteur normale
      rate: 0.85,              // Débit légèrement ralenti pour meilleure compréhension
      volume: 1.0,             // Volume maximum
      onError: (error) => {
        console.error('[VoiceService] Erreur TTS :', error);
        if (onError) onError(error);
      },
    });
  } catch (err) {
    console.error('[VoiceService] Impossible de lancer expo-speech :', err);
    if (onError) onError(err);
  }
};

/**
 * Construit le message vocal complet
 * @param {string} name - Nom du médicament
 * @param {string|null} dosage - Dosage (optionnel)
 * @returns {string} Message complet à prononcer
 */
const buildVoiceMessage = (name, dosage) => {
  if (dosage) {
    return `Attention ! C'est l'heure de prendre votre médicament ${name}, ${dosage}. Appuyez sur le bouton vert pour confirmer.`;
  }
  return `Attention ! C'est l'heure de prendre votre médicament ${name}. Appuyez sur le bouton vert pour confirmer.`;
};

/**
 * Vérifie si les voix françaises sont disponibles sur l'appareil
 * @returns {Promise<boolean>}
 */
export const checkFrenchVoiceAvailable = async () => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some((v) => v.language && v.language.startsWith('fr'));
  } catch {
    // Sur certains appareils, cette API n'est pas disponible
    return true; // On suppose disponible par défaut
  }
};

/**
 * Prononce un message de confirmation après validation
 * @param {string} medicationName - Nom du médicament validé
 */
export const speakConfirmation = async (medicationName) => {
  await Speech.speak(
    `Bravo ! Vous avez bien pris votre ${medicationName}. Continuez comme ça !`,
    {
      language: 'fr-FR',
      pitch: 1.1,    // Légèrement plus enjoué
      rate: 0.9,
      volume: 1.0,
    }
  );
};