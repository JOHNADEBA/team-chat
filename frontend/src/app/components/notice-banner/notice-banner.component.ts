import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notice-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notice-banner" *ngIf="showNotice" (click)="dismiss()">
      <div class="notice-content">
        <span class="notice-icon">ℹ️</span>
        <div class="notice-text">
          <strong>Demo Mode Notice:</strong> 
          This app runs on Render's free plan. WebSocket connections reset every 5 minutes, 
          so message delivery may occasionally delay by a few seconds. This is normal and not a bug.
        </div>
        <button class="dismiss-btn" (click)="dismiss(); $event.stopPropagation()">✕</button>
      </div>
    </div>
  `,
  styles: [`
    .notice-banner {
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 400px;
      z-index: 9999;
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .notice-content {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .notice-icon {
      font-size: 20px;
      line-height: 1;
    }

    .notice-text {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
      color: #92400e;
    }

    .notice-text strong {
      color: #b45309;
    }

    .dismiss-btn {
      background: none;
      border: none;
      color: #92400e;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .dismiss-btn:hover {
      opacity: 1;
    }
  `]
})
export class NoticeBannerComponent implements OnInit {
  showNotice = true;

  ngOnInit() {
    // Check if user has dismissed before
    const dismissed = localStorage.getItem('demo-notice-dismissed');
    if (dismissed === 'true') {
      this.showNotice = false;
    }
  }

  dismiss() {
    this.showNotice = false;
    localStorage.setItem('demo-notice-dismissed', 'true');
  }
}