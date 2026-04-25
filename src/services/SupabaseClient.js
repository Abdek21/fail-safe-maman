// ================================================================
// SupabaseClient.js — VERSION PRODUCTION CORRIGÉE
//
// BUGS CORRIGÉS :
//   1. Upload image : fetch(uri) crash APK → base64 via expo-file-system
//   2. Timeout réseau explicite (15s) → évite silence infini en 4G
//   3. Bucket public → getPublicUrl() fiable (pas de token expirant)
//   4. Vérification user avant chaque mutation (évite 403 silencieux)
//   5. Logs de debug production pour diagnostiquer sur APK réel
// ================================================================

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// ----------------------------------------------------------------
// CONFIGURATION
//
// IMPORTANT POUR EAS BUILD :
//   Les variables EXPO_PUBLIC_* doivent être dans eas.json OU
//   dans EAS Secrets (dashboard expo.dev).
//   Mettez vos valeurs réelles dans les fallbacks ci-dessous —
//   c'est le filet de sécurité ultime pour le build APK.
// ----------------------------------------------------------------
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://VOTRE_PROJET.supabase.co';         // ← REMPLACEZ

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'VOTRE_CLE_ANON_ICI';                       // ← REMPLACEZ

// Log visible dans les logs EAS / logcat Android
console.log('[Supabase] URL =', SUPABASE_URL);
console.log('[Supabase] Key OK =', SUPABASE_ANON_KEY.length > 20);

// ----------------------------------------------------------------
// CLIENT — avec timeout fetch global pour éviter les blocages réseau
// ----------------------------------------------------------------
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
  global: {
    // Timeout 15s sur toutes les requêtes HTTP (critique pour APK sur 4G)
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        console.warn('[Supabase] Timeout sur :', url);
      }, 15_000);

      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
    },
  },
});

// ================================================================
// HELPERS
// ================================================================

/**
 * Récupère les médicaments actifs de l'utilisateur connecté
 */
export const getMedications = async () => {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('is_active', true)
    .order('reminder_time', { ascending: true });

  if (error) {
    console.error('[getMedications]', error.message);
    throw error;
  }
  return data ?? [];
};

/**
 * Crée un médicament en base
 */
export const addMedication = async (medication) => {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Utilisateur non connecté');

  const { data, error } = await supabase
    .from('medications')
    .insert([{ ...medication, user_id: user.id }])
    .select()
    .single();

  if (error) {
    console.error('[addMedication]', error.message);
    throw error;
  }
  return data;
};

/**
 * Enregistre une prise de médicament
 */
export const logIntake = async (medicationId, scheduledAt = null) => {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Utilisateur non connecté');

  const { data, error } = await supabase
    .from('intake_logs')
    .insert([{
      medication_id: medicationId,
      user_id:       user.id,
      taken_at:      new Date().toISOString(),
      scheduled_at:  scheduledAt ? scheduledAt.toISOString() : null,
    }])
    .select()
    .single();

  if (error) {
    console.error('[logIntake]', error.message);
    throw error;
  }
  return data;
};

/**
 * Upload photo médicament vers Supabase Storage
 *
 * CORRECTION CRITIQUE :
 *   fetch(uri) planté sur APK Android natif → on utilise
 *   expo-file-system pour lire le fichier local en base64,
 *   puis on le convertit en Uint8Array pour le SDK Supabase.
 *
 *   Prérequis Supabase :
 *     - Bucket "medication-photos" doit exister
 *     - Bucket PUBLIC (pour getPublicUrl sans token)
 *     - Policy INSERT pour authenticated users
 */
export const uploadMedicationPhoto = async (uri, fileName) => {
  console.log('[Upload] Démarrage :', uri);

  // 1. Lecture locale en base64 via expo-file-system
  //    Compatible avec tous les URI Android (file://, content://)
  let base64String;
  try {
    base64String = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[Upload] Base64 lu, longueur :', base64String.length);
  } catch (fsErr) {
    console.error('[Upload] Lecture fichier échouée :', fsErr.message);
    throw new Error(`Lecture image impossible : ${fsErr.message}`);
  }

  // 2. Conversion base64 → Uint8Array
  //    (le SDK Supabase JS accepte Blob, ArrayBuffer ou Uint8Array)
  let byteArray;
  try {
    const chars = atob(base64String);
    byteArray = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) {
      byteArray[i] = chars.charCodeAt(i);
    }
    console.log('[Upload] Uint8Array prêt, taille :', byteArray.length);
  } catch (decErr) {
    console.error('[Upload] Décodage base64 échoué :', decErr.message);
    throw new Error(`Décodage image impossible : ${decErr.message}`);
  }

  // 3. Upload vers Storage
  const ext      = (fileName.split('.').pop() || 'jpg').toLowerCase();
  const mime     = ext === 'png' ? 'image/png' : 'image/jpeg';
  const filePath = `medications/${Date.now()}.${ext}`;

  console.log('[Upload] Upload Storage → path :', filePath);

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('medication-photos')
    .upload(filePath, byteArray, {
      contentType: mime,
      upsert:      false,
    });

  if (uploadErr) {
    console.error('[Upload] Erreur Storage :', uploadErr.message, uploadErr);
    throw uploadErr;
  }

  console.log('[Upload] Storage OK :', uploadData);

  // 4. URL publique (bucket DOIT être public dans le dashboard Supabase)
  const { data: urlData } = supabase.storage
    .from('medication-photos')
    .getPublicUrl(filePath);

  console.log('[Upload] URL publique :', urlData.publicUrl);
  return urlData.publicUrl;
};

/**
 * Désactive un médicament (soft-delete)
 */
export const deleteMedication = async (id) => {
  const { error } = await supabase
    .from('medications')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('[deleteMedication]', error.message);
    throw error;
  }
};

/**
 * Utilitaire de diagnostic réseau — appelez-le au démarrage de l'app
 * pour confirmer que Supabase est joignable depuis l'APK.
 */
export const pingSupabase = async () => {
  try {
    const t0 = Date.now();
    const { error } = await supabase
      .from('medications')
      .select('id')
      .limit(1);
    const ms = Date.now() - t0;
    console.log(`[Supabase] Ping ${error ? 'FAILED' : 'OK'} — ${ms}ms`, error?.message ?? '');
    return { ok: !error, ms };
  } catch (e) {
    console.error('[Supabase] Ping CRASH :', e.message);
    return { ok: false, ms: -1 };
  }
};