import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { map, take } from 'rxjs/operators';
import { authGuard } from './guards/auth.guard';

// Add this new guard
export const redirectIfAuthenticated = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.user$.pipe(
    take(1),
    map((user) => {
      if (user) {
        return router.createUrlTree(['/rooms']);
      }
      return true;
    }),
  );
};

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
    canActivate: [redirectIfAuthenticated], // ADD THIS!
  },
  {
    path: 'rooms',
    loadComponent: () => import('./pages/rooms/rooms.component').then((m) => m.RoomsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'chat/:roomId',
    loadComponent: () => import('./pages/chat/chat.component').then((m) => m.ChatComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
