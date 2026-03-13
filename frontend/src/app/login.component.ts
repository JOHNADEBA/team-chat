import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
    >
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {{ isLoginMode ? 'Sign in to your account' : 'Create new account' }}
          </h2>
        </div>

        <form class="mt-8 space-y-6" (ngSubmit)="onSubmit()" #authForm="ngForm">
          <div class="rounded-md shadow-sm -space-y-px">
            <!-- Name field (only for registration) -->
            <div *ngIf="!isLoginMode">
              <input
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Full name"
              />
            </div>

            <div>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                email
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                [class.rounded-t-md]="isLoginMode"
                placeholder="Email address"
              />
            </div>

            <div>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                minlength="6"
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div *ngIf="error" class="text-red-600 text-sm text-center">
            {{ error }}
          </div>

          <div>
            <button
              type="submit"
              [disabled]="authForm.invalid || loading"
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <span *ngIf="loading" class="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg
                  class="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </span>
              {{ isLoginMode ? 'Sign In' : 'Sign Up' }}
            </button>
          </div>

          <div class="text-center">
            <button
              type="button"
              (click)="toggleMode()"
              class="text-sm text-blue-600 hover:text-blue-500"
            >
              {{ isLoginMode ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  isLoginMode = true;
  email = '';
  password = '';
  name = '';
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.error = '';
  }

  async onSubmit() {
    this.loading = true;
    this.error = '';

    try {
      if (this.isLoginMode) {
        this.authService
          .login({
            email: this.email,
            password: this.password,
          })
          .subscribe({
            next: () => {
              this.router.navigate(['/rooms']);
            },
            error: (err) => {
              this.error = err.error?.error || 'Login failed';
              this.loading = false;
            },
          });
      } else {
        if (!this.name) {
          this.error = 'Name is required';
          this.loading = false;
          return;
        }

        this.authService
          .register({
            email: this.email,
            password: this.password,
            name: this.name,
          })
          .subscribe({
            next: () => {
              this.router.navigate(['/rooms']);
            },
            error: (err) => {
              this.error = err.error?.error || 'Registration failed';
              this.loading = false;
            },
          });
      }
    } catch (error) {
      this.error = 'An error occurred';
      this.loading = false;
    }
  }
}
