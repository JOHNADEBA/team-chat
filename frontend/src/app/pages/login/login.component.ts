import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // ✅ Add OnPush
})
export class LoginComponent {
  isLoginMode = true;
  email = '';
  password = '';
  name = '';

  // Fast state management
  loading = false;
  registrationSuccess = false;

  // Error states
  showError = false;
  errorMessage = '';
  errorType = '';

  // Field errors
  nameError = false;
  emailError = false;
  passwordError = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    public cdr: ChangeDetectorRef,
  ) {}

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.resetState();
    this.cdr.markForCheck(); // ✅ Mark for check
  }

  switchToRegister() {
    this.isLoginMode = false;
    this.resetState();
    this.cdr.markForCheck();
  }

  switchToLogin() {
    this.isLoginMode = true;
    this.resetState();
    this.cdr.markForCheck();
  }

  resetState() {
    this.showError = false;
    this.errorMessage = '';
    this.errorType = '';
    this.loading = false;
    this.nameError = false;
    this.emailError = false;
    this.passwordError = false;
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.email || !this.email.includes('@')) {
      this.emailError = true;
      isValid = false;
    }

    if (!this.password || this.password.length < 6) {
      this.passwordError = true;
      isValid = false;
    }

    if (!this.isLoginMode && !this.name) {
      this.nameError = true;
      isValid = false;
    }

    return isValid;
  }

  focusPasswordInput() {
    // Focus password input
    const passwordInput = document.querySelector('input[type="password"]') as HTMLElement;
    if (passwordInput) {
      passwordInput.focus();
    }
  }

  onSubmit() {
    // Fast validation
    if (!this.validateForm()) {
      this.cdr.markForCheck();
      return;
    }

    // Set loading state immediately
    this.loading = true;
    this.showError = false;
    this.cdr.markForCheck();

    if (this.isLoginMode) {
      // LOGIN - with timeout to prevent hanging
      const loginSubscription = this.authService
        .login({
          email: this.email,
          password: this.password,
        })
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.loading = false;
            this.cdr.markForCheck(); // ✅ Mark before navigation
            this.router.navigate(['/rooms']);
          },
          error: (err) => {
            this.loading = false;

            // Fast error display
            this.showError = true;

            // Determine error type instantly
            const status = err.status;
            const errorMsg = err.error?.error || '';

            if (status === 404 || errorMsg.includes('not found')) {
              this.errorType = 'not-found';
            } else if (
              status === 401 ||
              errorMsg.includes('password') ||
              errorMsg.includes('Invalid')
            ) {
              this.errorType = 'wrong-password';
            } else {
              this.errorType = 'generic';
              this.errorMessage = errorMsg || 'Login failed';
            }

            this.cdr.markForCheck(); // ✅ Mark for check
          },
        });

      // Safety timeout - if no response in 2 seconds, show error
      setTimeout(() => {
        if (this.loading) {
          loginSubscription.unsubscribe();
          this.loading = false;
          this.showError = true;
          this.errorType = 'generic';
          this.errorMessage = 'Request timed out. Please try again.';
          this.cdr.markForCheck();
        }
      }, 2000); // Reduced from 3s to 2s
    } else {
      // REGISTER
      const registerSubscription = this.authService
        .register({
          email: this.email,
          password: this.password,
          name: this.name,
        })
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.loading = false;
            this.registrationSuccess = true;
            this.isLoginMode = true;
            this.password = ''; // Clear password

            this.cdr.markForCheck(); // ✅ Mark for check

            // Auto-hide success message after 2 seconds
            setTimeout(() => {
              this.registrationSuccess = false;
              this.cdr.markForCheck();
            }, 2000);
          },
          error: (err) => {
            this.loading = false;
            this.showError = true;

            const errorMsg = err.error?.error || '';

            if (errorMsg.includes('already exists')) {
              this.errorType = 'already-exists';
            } else {
              this.errorType = 'generic';
              this.errorMessage = errorMsg || 'Registration failed';
            }

            this.cdr.markForCheck();
          },
        });

      // Safety timeout
      setTimeout(() => {
        if (this.loading) {
          registerSubscription.unsubscribe();
          this.loading = false;
          this.showError = true;
          this.errorType = 'generic';
          this.errorMessage = 'Request timed out. Please try again.';
          this.cdr.markForCheck();
        }
      }, 2000);
    }
  }
}
