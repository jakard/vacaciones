export const environment = {
  production: true,
  useEmulators: false,
  firebase: {
    projectId: 'REPLACE_ME_PROD_PROJECT',
    appId: '',
    storageBucket: '',
    apiKey: '',
    authDomain: '',
    messagingSenderId: '',
  },
  authDomainRestriction: 'REPLACE_ME_DOMAIN.com' as string | null,
  functionsRegion: 'us-central1',
};
