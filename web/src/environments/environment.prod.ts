export const environment = {
  production: true,
  // Even in the "production" build configuration we currently target the
  // dev project — there is no separate prod project yet. Override when ready.
  useEmulators: false,
  firebase: {
    projectId: 'vacaciones-dev-b3158',
    appId: '1:1000746698778:web:0f498b2ad533327a9b69a3',
    storageBucket: 'vacaciones-dev-b3158.firebasestorage.app',
    apiKey: 'AIzaSyDdJsNemH83qjri-EOUURBPD4sQA2qkayg',
    authDomain: 'vacaciones-dev-b3158.firebaseapp.com',
    messagingSenderId: '1000746698778',
  },
  authDomainRestriction: null as string | null,
  functionsRegion: 'us-central1',
};
