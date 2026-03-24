import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { User, UserStats } from '../../models/types';
import { take, finalize } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  userId: string | null = null;
  user: User | null = null;
  loading = true;
  loadingStats = true;
  isOwnProfile = false;
  userStats: UserStats | null = null;

  // Upload states
  uploading = false;
  uploadSuccess = false;
  uploadError = '';
  showUploadOverlay = false;

  // Safety timeout
  private safetyTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.route.params.pipe(take(1)).subscribe((params) => {
      this.userId = params['userId'];
      this.loadProfile();
      this.loadStats();
    });
  }

  ngOnDestroy() {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
    }
  }

  loadProfile() {
    this.loading = true;
    this.cdr.markForCheck();

    // Get current user to check if this is own profile
    this.authService.user$.pipe(take(1)).subscribe((currentUser) => {
      this.isOwnProfile = currentUser?.id === this.userId;
      this.cdr.markForCheck();
    });

    // Load user profile
    this.api
      .getUser(this.userId!)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (user) => {
          this.user = user;
        },
        error: (err) => {
          console.error('Failed to load user:', err);
        },
      });

    // Safety timeout
    this.safetyTimeout = setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  loadStats() {
    this.loadingStats = true;
    this.cdr.markForCheck();

    this.api
      .getUserStats(this.userId!)
      .pipe(
        take(1),
        finalize(() => {
          this.loadingStats = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (stats) => {
          this.userStats = stats;
        },
        error: (err) => {
          console.error('Failed to load user stats:', err);
        },
      });

    // Safety timeout
    setTimeout(() => {
      if (this.loadingStats) {
        this.loadingStats = false;
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  triggerFileInput() {
    if (!this.uploading) {
      this.fileInput.nativeElement.click();
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.showError('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.showError('File size must be less than 5MB');
      return;
    }

    this.uploadAvatar(file);
  }

  private showError(message: string) {
    this.uploadError = message;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.uploadError = '';
      this.cdr.markForCheck();
    }, 3000);
  }

  uploadAvatar(file: File) {
    this.uploading = true;
    this.uploadSuccess = false;
    this.uploadError = '';
    this.cdr.markForCheck();

    this.api
      .uploadAvatar(file)
      .pipe(
        take(1),
        finalize(() => {
          this.uploading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (this.user) {
            this.user.avatar = response.avatarUrl;
            this.uploadSuccess = true;

            setTimeout(() => {
              this.uploadSuccess = false;
              this.cdr.markForCheck();
            }, 3000);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Upload failed:', err);
          this.showError(err.error?.error || 'Failed to upload avatar');
        },
      });
  }

  sendMessage() {
    if (this.user) {
      this.router.navigate(['/rooms'], {
        queryParams: {
          createDM: true,
          userId: this.user.id,
          userName: this.user.name,
        },
      });
    }
  }

  viewRooms() {
    if (this.user) {
      this.router.navigate(['/rooms'], {
        queryParams: {
          userId: this.user.id,
          userName: this.user.name,
        },
      });
    }
  }

  goBack() {
    this.router.navigate(['/rooms']);
  }
}
