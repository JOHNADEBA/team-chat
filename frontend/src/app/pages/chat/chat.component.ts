import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  AfterViewChecked,
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
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
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
  private lastMessageCount = 0;

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
    private ngZone: NgZone, // Inject NgZone
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

  ngAfterViewChecked() {
    // Auto-scroll only if user is near bottom AND we have new messages
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
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
    const threshold = 150; // pixels from bottom

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

          // Sort messages by createdAt in ascending order (oldest first)
          this.messages = (room.messages || []).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          this.lastMessageCount = this.messages.length;

          this.socket.connect().then(() => {
            this.socket.joinRoom(this.roomId);
            this.shouldAutoScroll = true;
            this.scrollToBottom();
          });

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load room:', err);
        },
      });

    this.subscriptions.push(loadSub);

    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  setupSocket() {
    // Method 1: Using NgZone to run socket events inside Angular zone
    const messageSub = this.socket.onNewMessage().subscribe((message) => {
      // Run inside NgZone to ensure change detection works with OnPush
      this.ngZone.run(() => {
        if (message.roomId === this.roomId) {
          const exists = this.messages.some((m) => m.id === message.id);
          if (!exists) {
            // Add new message to the end (bottom) of the list
            this.messages = [...this.messages, message];

            // Method 2: Force immediate change detection (backup method)
            this.cdr.markForCheck(); // Mark as dirty
            this.cdr.detectChanges(); // Force immediate check (safe here)

            // Auto-scroll if user was near bottom
            if (this.isNearBottom) {
              setTimeout(() => this.scrollToBottom(), 50);
            }
          }
        }
      });
    });
    this.subscriptions.push(messageSub);

    // Listen for user joined
    const joinedSub = this.socket.onUserJoined().subscribe(({ userId }) => {
      this.ngZone.run(() => {
        this.loadRoom();
      });
    });
    this.subscriptions.push(joinedSub);

    // Listen for user left
    const leftSub = this.socket.onUserLeft().subscribe(({ userId }) => {
      this.ngZone.run(() => {
        this.loadRoom();
      });
    });
    this.subscriptions.push(leftSub);

    // Listen for errors
    const errorSub = this.socket.onError().subscribe(({ message }) => {
      this.ngZone.run(() => {
        console.error('Socket error:', message);
      });
    });
    this.subscriptions.push(errorSub);
  }

  async sendMessage() {
    if (!this.newMessage.trim() || this.sending) return;

    const messageContent = this.newMessage;
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Create optimistic message for instant UI update
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

    // Optimistically add to UI
    this.messages = [...this.messages, optimisticMessage];
    this.newMessage = '';
    this.sending = true;

    // Force view update
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.scrollToBottom();

    try {
      // Ensure socket is connected
      if (!this.socket.isConnected()) {
        await this.socket.connect();
      }

      // Send actual message
      await this.socket.sendMessage(this.roomId, messageContent);

      // Message sent successfully, we'll get the real message via socket
      // and can remove the optimistic one if needed
    } catch (error) {
      // Remove optimistic message on error
      this.messages = this.messages.filter((m) => m.id !== tempId);

      // Restore the message text
      this.newMessage = messageContent;

      // Show error (you could add a toast notification here)
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
          this.loadRoom();
          this.userSearchQuery = '';
          this.searchResults = [];
          this.showAddMembersModal = false;
        },
        error: (err) => {
          console.error('Failed to add user:', err);
        },
      });

    this.subscriptions.push(addSub);

    setTimeout(() => {
      if (this.addingUser === userId) {
        this.addingUser = null;
        this.cdr.markForCheck();
      }
    }, 5000);
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

  private scrollToBottom() {
    setTimeout(() => {
      try {
        if (this.messageContainer) {
          const element = this.messageContainer.nativeElement;
          element.scrollTop = element.scrollHeight;
        }
      } catch (err) {
        console.error('Scroll error:', err);
      }
    }, 50);
  }
}
