/**
 * Ouverture automatique du micro (bureau, exercice) : sans autorisation acquise, le navigateur afficherait
 * sa demande sans prévenir ; sans geste antérieur sur la page, le contexte audio resterait suspendu.
 * Dans ces deux cas, c'est le bouton « Ouvrir le micro » qui mène.
 */
export type MicPermission = 'granted' | 'prompt' | 'denied';

export function canAutoOpenMic(permission: MicPermission, hasUserGesture: boolean): boolean {
  return permission === 'granted' && hasUserGesture;
}

/** `prompt` quand le navigateur ne sait pas répondre : on retombe sur le bouton. */
export async function micPermission(): Promise<MicPermission> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'prompt';
  }
}
