import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
import { Room, Message, User } from '../../models/types';
import { take, debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs';
import { Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  roomId: string = '';
  room: Room | null = null;
  messages: Message[] = [];
  newMessage = '';
  loading = true;
  sending = false;
  currentUserId: string | null = null;
  showMobileMenu = false;

  // Modals
  showMembersModal = false;
  showAddMembersModal = false;

  // User search
  userSearchQuery = '';
  searchResults: User[] = [];
  searching = false;
  addingUser: string | null = null;

  // Scroll management
  private shouldAutoScroll = true;
  private isNearBottom = true;
  private pendingMessages = new Map<string, Message>(); // Track optimistic messages

  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthService,
    public router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private socket: SocketService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    this.setupSearch();
  }

  private setupSearch() {
    const searchSub = this.searchSubject
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

    this.subscriptions.push(searchSub);
  }

  private scrollToBottom() {
    setTimeout(() => {
      try {
        if (this.messageContainer) {
          this.messageContainer.nativeElement.scrollTop =
            this.messageContainer.nativeElement.scrollHeight;
        }
      } catch (err) {}
    }, 50);
  }

  ngOnInit() {
    const routeSub = this.route.params.pipe(take(1)).subscribe((params) => {
      this.roomId = params['roomId'];
      this.loadRoom();
      this.setupSocket();
    });
    this.subscriptions.push(routeSub);

    const userSub = this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.currentUserId = user.id;
        this.cdr.markForCheck();
      }
    });
    this.subscriptions.push(userSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.destroy$.next();
    this.destroy$.complete();

    if (this.roomId) {
      this.socket.leaveRoom(this.roomId);
    }
  }

  onScroll() {
    if (!this.messageContainer) return;
    const element = this.messageContainer.nativeElement;
    const threshold = 150;
    this.isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    this.shouldAutoScroll = this.isNearBottom;
  }

  loadRoom() {
    this.loading = true;
    this.cdr.markForCheck();

    const loadSub = this.api
      .getRoom(this.roomId)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (room) => {
          this.room = room;
          this.messages = (room.messages || []).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          this.socket.connect().then(() => {
            this.socket.joinRoom(this.roomId);
            this.scrollToBottom();
          });

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load room:', err);
        },
      });

    this.subscriptions.push(loadSub);
  }

  setupSocket() {
    // Handle new messages - OPTIMIZED
    const messageSub = this.socket.onNewMessage().subscribe((message) => {
      this.ngZone.run(() => {
        if (message.roomId !== this.roomId) return;

        // Check if this message already exists (including optimistic ones)
        const existingIndex = this.messages.findIndex(
          (m) =>
            m.id === message.id ||
            (m.id.startsWith('temp-') &&
              m.content === message.content &&
              m.userId === message.userId),
        );

        if (existingIndex === -1) {
          // New message - add it
          this.messages = [...this.messages, message];

          // Remove any matching optimistic message
          this.pendingMessages.forEach((_, tempId) => {
            if (tempId.startsWith('temp-')) {
              this.messages = this.messages.filter((m) => m.id !== tempId);
              this.pendingMessages.delete(tempId);
            }
          });

          // Single change detection
          this.cdr.markForCheck();

          if (this.isNearBottom) {
            setTimeout(() => this.scrollToBottom(), 50);
          }
        }
      });
    });
    this.subscriptions.push(messageSub);

    // Optimized user joined - DON'T reload entire room
    const joinedSub = this.socket.onUserJoined().subscribe(({ userId }) => {
      this.ngZone.run(() => {
        // Just fetch updated member list, not entire room
        this.api
          .getRoom(this.roomId)
          .pipe(take(1))
          .subscribe((room) => {
            this.room = room;
            this.cdr.markForCheck();
          });
      });
    });
    this.subscriptions.push(joinedSub);

    // Optimized user left
    const leftSub = this.socket.onUserLeft().subscribe(({ userId }) => {
      this.ngZone.run(() => {
        this.api
          .getRoom(this.roomId)
          .pipe(take(1))
          .subscribe((room) => {
            this.room = room;
            this.cdr.markForCheck();
          });
      });
    });
    this.subscriptions.push(leftSub);
  }

  async sendMessage() {
    if (!this.newMessage.trim() || this.sending) return;

    const messageContent = this.newMessage;
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      userId: this.currentUserId!,
      roomId: this.roomId,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: this.room?.members?.find((m) => m.userId === this.currentUserId)?.user || {
        id: this.currentUserId!,
        name: 'You',
        email: '',
      },
    };

    // Track optimistic message
    this.pendingMessages.set(tempId, optimisticMessage);

    // Add to UI
    this.messages = [...this.messages, optimisticMessage];
    this.newMessage = '';
    this.sending = true;

    // Single change detection
    this.cdr.markForCheck();
    this.scrollToBottom();

    try {
      if (!this.socket.isConnected()) {
        await this.socket.connect();
      }
      await this.socket.sendMessage(this.roomId, messageContent);
    } catch (error) {
      // Remove on error
      this.messages = this.messages.filter((m) => m.id !== tempId);
      this.pendingMessages.delete(tempId);
      this.newMessage = messageContent;
      this.cdr.markForCheck();
      alert('Failed to send message. Please try again.');
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
    }
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

  isUserInRoom(userId: string): boolean {
    return this.room?.members?.some((m) => m.userId === userId) || false;
  }

  addUserToRoom(userId: string) {
    if (!this.roomId || this.addingUser) return;

    this.addingUser = userId;
    this.cdr.markForCheck();

    const addSub = this.api
      .addMember(this.roomId, userId)
      .pipe(
        take(1),
        finalize(() => {
          this.addingUser = null;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          // Refresh room data
          this.api
            .getRoom(this.roomId)
            .pipe(take(1))
            .subscribe((room) => {
              this.room = room;
              this.userSearchQuery = '';
              this.searchResults = [];
              this.showAddMembersModal = false;
              this.cdr.markForCheck();
            });
        },
        error: (err) => {
          console.error('Failed to add user:', err);
        },
      });

    this.subscriptions.push(addSub);
  }

  goBack() {
    this.router.navigate(['/rooms']);
  }

  goToProfile() {
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.router.navigate(['/profile', user.id]);
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

  logout() {
    this.authService.logout();
  }
}
