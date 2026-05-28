import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'team/:teamId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./team/team-home.component').then((m) => m.TeamHomeComponent),
  },
  { path: '**', redirectTo: '' },
];
