import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="not-found-container">
      <div class="not-found-content">
        <h1 class="error-code">404</h1>
        <h2 class="error-title">Page Not Found</h2>
        <p class="error-message">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <div class="action-buttons">
          <button routerLink="/rooms" class="btn-primary">
            <i class="icon">🏠</i> Go to Rooms
          </button>
          <button routerLink="/" class="btn-secondary">
            <i class="icon">🔙</i> Back to Login
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .not-found-content {
      text-align: center;
      background: white;
      padding: 48px;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
      animation: fadeInUp 0.5s ease-out;
    }

    .error-code {
      font-size: 120px;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }

    .error-title {
      font-size: 28px;
      color: #333;
      margin: 20px 0 10px;
      font-weight: 600;
    }

    .error-message {
      color: #666;
      font-size: 16px;
      margin-bottom: 30px;
      line-height: 1.5;
    }

    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    button {
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #666;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
      transform: translateY(-2px);
    }

    .icon {
      font-size: 18px;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .not-found-content {
        padding: 32px;
      }

      .error-code {
        font-size: 80px;
      }

      .error-title {
        font-size: 24px;
      }

      .action-buttons {
        flex-direction: column;
      }

      button {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class NotFoundComponent {}