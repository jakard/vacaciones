export const environment = {
  production: false,
  useEmulators: true,
  firebase: {
    projectId: 'vacaciones-dev-b3158',
    appId: '1:1000746698778:web:0f498b2ad533327a9b69a3',
    storageBucket: 'vacaciones-dev-b3158.firebasestorage.app',
    apiKey: 'AIzaSyDdJsNemH83qjri-EOUURBPD4sQA2qkayg',
    authDomain: 'vacaciones-dev-b3158.firebaseapp.com',
    messagingSenderId: '1000746698778',
  },
  // Restrict Google sign-in to a single Workspace domain.
  // Set to null to allow any Google account (useful during local dev).
  authDomainRestriction: null as string | null,
  functionsRegion: 'us-central1',
};
