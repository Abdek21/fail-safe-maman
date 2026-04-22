// ============================================================
// SupabaseClient.js
// Configuration et initialisation du client Supabase
// À importer dans toute l'application pour accéder au backend
// ============================================================

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ Remplacez ces valeurs par vos propres clés Supabase
// Disponibles dans : Dashboard Supabase → Settings → API
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'VOTRE_CLE_ANON_PUBLIQUE';

// Création du client Supabase avec persistance de session via AsyncStorage
// → L'utilisateur reste connecté même après fermeture de l'application
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Utilise AsyncStorage (React Native) pour persister la session
    storage: AsyncStorage,
    // Renouvelle automatiquement le token avant expiration
    autoRefreshToken: true,
    // Maintient la session active entre les redémarrages
    persistSession: true,
    // Désactive la détection de session dans l'URL (inutile en mobile)
    detectSessionInUrl: false,
  },
  // Rejoue automatiquement les requêtes en cas de déconnexion réseau
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

// ============================================================
// HELPERS — Fonctions utilitaires pour l'accès aux données
// ============================================================

/**
 * Récupère tous les médicaments actifs de l'utilisateur connecté
 * @returns {Promise<Array>} Liste des médicaments
 */
export const getMedications = async () => {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('is_active', true)
    .order('reminder_time', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Ajoute un nouveau médicament dans la base de données
 * @param {Object} medication - Données du médicament
 * @returns {Promise<Object>} Médicament créé
 */
export const addMedication = async (medication) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('medications')
    .insert([{ ...medication, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Enregistre une prise validée par l'utilisateur
 * @param {string} medicationId - ID du médicament
 * @param {Date} scheduledAt - Heure théorique du rappel
 * @returns {Promise<Object>} Log créé
 */
export const logIntake = async (medicationId, scheduledAt = null) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('intake_logs')
    .insert([{
      medication_id: medicationId,
      user_id: user.id,
      taken_at: new Date().toISOString(),
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Uploade la photo d'un médicament dans Supabase Storage
 * @param {string} uri - URI locale de l'image (depuis expo-image-picker)
 * @param {string} fileName - Nom du fichier (ex: "doliprane.jpg")
 * @returns {Promise<string>} URL publique signée de l'image
 */
export const uploadMedicationPhoto = async (uri, fileName) => {
  // Lecture du fichier comme blob
  const response = await fetch(uri);
  const blob = await response.blob();

  const filePath = `medications/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('medication-photos')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Génération d'une URL signée valable 10 ans (pour affichage permanent)
  const { data: signedData, error: signError } = await supabase.storage
    .from('medication-photos')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

  if (signError) throw signError;
  return signedData.signedUrl;
};

/**
 * Supprime (désactive) un médicament
 * @param {string} id - ID du médicament
 */
export const deleteMedication = async (id) => {
  const { error } = await supabase
    .from('medications')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
};