import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Room, User } from '../../models/types';
import { take, debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomsComponent implements OnInit {
  rooms: Room[] = [];
  loading = true;
  showMobileMenu = false;

  // Create room
  showCreateRoom = false;
  newRoomName = '';
  newRoomDescription = '';
  isCreating = false;
  createError = '';

  // Find users
  showFindUsers = false;
  userSearchQuery = '';
  searchResults: User[] = [];
  searching = false;
  selectedRoomId: string | null = null;
  addingUser: string | null = null;

  // Current user
  currentUserId: string | null = null;

  // Delete room
  showDeleteModal = false;
  roomToDelete: Room | null = null;
  deleting = false;

  private searchSubject = new Subject<string>();

  constructor(
    public authService: AuthService,
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    // Setup search with debounce
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query.trim() || query.length < 2) {
            this.searchResults = [];
            this.searching = false;
            this.cdr.markForCheck();
            return [];
          }
          return this.api.searchUsers(query);
        }),
      )
      .subscribe({
        next: (users) => {
          this.searchResults = users;
          this.searching = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Search error:', err);
          this.searching = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnInit() {
    this.loadRooms();

    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.currentUserId = user.id;
        this.cdr.markForCheck();
      }
    });
  }

  loadRooms() {
    this.loading = true;
    this.cdr.markForCheck();

    this.api
      .getRooms()
      .pipe(take(1))
      .subscribe({
        next: (rooms) => {
          this.rooms = rooms;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load rooms:', err);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });

    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  // Room CRUD
  openCreateModal() {
    this.showCreateRoom = true;
    this.newRoomName = '';
    this.newRoomDescription = '';
    this.createError = '';
    this.cdr.markForCheck();
  }

  closeCreateModal() {
    this.showCreateRoom = false;
    this.cdr.markForCheck();
  }

  createRoom() {
    if (!this.newRoomName.trim() || this.isCreating) return;

    this.isCreating = true;
    this.createError = '';
    this.cdr.markForCheck();

    const tempRoom: Room = {
      id: 'temp-' + Date.now(),
      name: this.newRoomName,
      description: this.newRoomDescription || undefined,
      createdById: this.currentUserId!,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [],
      messages: [],
    };

    this.rooms = [tempRoom, ...this.rooms];
    this.cdr.markForCheck();

    this.api
      .createRoom({
        name: this.newRoomName,
        description: this.newRoomDescription || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (room) => {
          this.rooms = this.rooms.filter((r) => r.id !== tempRoom.id);
          this.rooms = [room, ...this.rooms];
          this.showCreateRoom = false;
          this.isCreating = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.rooms = this.rooms.filter((r) => r.id !== tempRoom.id);
          this.createError = err.error?.error || 'Failed to create room';
          this.isCreating = false;
          this.cdr.markForCheck();
        },
      });

    setTimeout(() => {
      if (this.isCreating) {
        this.rooms = this.rooms.filter((r) => !r.id.startsWith('temp-'));
        this.isCreating = false;
        this.createError = 'Request timed out';
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  // Member management
  getRoomName(roomId: string): string {
    const room = this.rooms.find((r) => r.id === roomId);
    return room?.name || 'Unknown Room';
  }

  isUserInRoom(userId: string, roomId: string): boolean {
    const room = this.rooms.find((r) => r.id === roomId);
    return room?.members?.some((m) => m.userId === userId) || false;
  }

  openAddMemberModal(roomId: string) {
    this.selectedRoomId = roomId;
    this.showFindUsers = true;
    this.userSearchQuery = '';
    this.searchResults = [];
    this.cdr.markForCheck();
  }

  openFindUsersModal() {
    this.selectedRoomId = null;
    this.showFindUsers = true;
    this.userSearchQuery = '';
    this.searchResults = [];
    this.cdr.markForCheck();
  }

  closeFindUsersModal() {
    this.showFindUsers = false;
    this.selectedRoomId = null;
    this.userSearchQuery = '';
    this.searchResults = [];
    this.cdr.markForCheck();
  }

  onSearchInput() {
    if (this.userSearchQuery.length >= 2) {
      this.searching = true;
      this.cdr.markForCheck();
      this.searchSubject.next(this.userSearchQuery);
    } else {
      this.searchResults = [];
      this.cdr.markForCheck();
    }
  }

  addUserToRoom(userId: string) {
    if (!this.selectedRoomId || this.addingUser) return;

    this.addingUser = userId;
    this.cdr.markForCheck();

    this.api
      .addMember(this.selectedRoomId, userId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          // Refresh rooms to show updated members
          this.loadRooms();
          this.addingUser = null;
          this.cdr.markForCheck();

          // Show success feedback
          alert('User added successfully!');
        },
        error: (err) => {
          console.error('Failed to add user:', err);
          this.addingUser = null;
          this.cdr.markForCheck();
          alert('Failed to add user: ' + (err.error?.error || 'Unknown error'));
        },
      });

    setTimeout(() => {
      if (this.addingUser === userId) {
        this.addingUser = null;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  viewUserProfile(user: User) {
    this.router.navigate(['/profile', user.id]);
    this.closeFindUsersModal();
  }

  createDirectChat(user: User) {
    // Create a direct message room with this user
    this.isCreating = true;
    this.cdr.markForCheck();

    this.api
      .createRoom({
        name: `DM with ${user.name}`,
        description: `Direct message with ${user.name}`,
      })
      .pipe(take(1))
      .subscribe({
        next: (room) => {
          // Add the other user to the room
          this.api
            .addMember(room.id, user.id)
            .pipe(take(1))
            .subscribe({
              next: () => {
                this.isCreating = false;
                this.closeFindUsersModal();
                this.router.navigate(['/chat', room.id]);
              },
              error: (err) => {
                console.error('Failed to add user to DM:', err);
                this.isCreating = false;
                this.cdr.markForCheck();
              },
            });
        },
        error: (err) => {
          console.error('Failed to create DM room:', err);
          this.isCreating = false;
          this.cdr.markForCheck();
          alert('Failed to create direct message');
        },
      });
  }

  selectRoom(roomId: string) {
    this.router.navigate(['/chat', roomId]);
  }

  goToProfile() {
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.router.navigate(['/profile', user.id]);
      } else {
        this.router.navigate(['/rooms']);
      }
    });
  }

  toggleMobileMenu() {
    this.showMobileMenu = !this.showMobileMenu;
    this.cdr.markForCheck();
  }

  closeMobileMenu() {
    this.showMobileMenu = false;
    this.cdr.markForCheck();
  }

  confirmDeleteRoom(room: Room) {
    this.roomToDelete = room;
    this.showDeleteModal = true;
    this.cdr.markForCheck();
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.roomToDelete = null;
    this.cdr.markForCheck();
  }

  deleteRoom() {
    if (!this.roomToDelete || this.deleting) return;

    this.deleting = true;
    this.cdr.markForCheck();

    this.api
      .deleteRoom(this.roomToDelete.id)
      .pipe(
        take(1),
        finalize(() => {
          this.deleting = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          // Remove room from local array
          this.rooms = this.rooms.filter((r) => r.id !== this.roomToDelete!.id);
          this.closeDeleteModal();

          // Show success message (you can implement a toast later)
        },
        error: (err) => {
          console.error('Failed to delete room:', err);
          // Show error message
          alert('Failed to delete room: ' + (err.error?.error || 'Unknown error'));
        },
      });

    // Safety timeout
    setTimeout(() => {
      if (this.deleting) {
        this.deleting = false;
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  editProfile() {
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.router.navigate(['/profile', user.id]);
      }
    });
    this.closeFindUsersModal();
  }

  logout() {
    this.authService.logout();
  }
}
