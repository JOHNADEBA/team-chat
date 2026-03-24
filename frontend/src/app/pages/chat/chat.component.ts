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
import { environment } from '../../../environments/environment';
// import { environment } from '../../environments/environment';

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
  private pendingOptimisticIds = new Set<string>(); // Track optimistic message IDs

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
          if (!environment.production) {
            console.error('Search error:', err);
          }
          this.searching = false;
          this.cdr.markForCheck();
        },
      });

    this.subscriptions.push(searchSub);
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messageContainer?.nativeElement) {
        const container = this.messageContainer.nativeElement;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 30);
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
        next: async (room) => {
          this.room = room;
          this.messages = (room.messages || []).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          try {
            // Ensure connection is established
            await this.socket.connect();
            
            // Small delay to ensure connection is stable
            await new Promise((resolve) => setTimeout(resolve, 100));

            this.socket.joinRoom(this.roomId);

            this.scrollToBottom();
          } catch (error) {
            console.error('Failed to connect socket:', error);
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load room:', err);
        },
      });

    this.subscriptions.push(loadSub);
  }

  setupSocket() {
    const messageSub = this.socket.onNewMessage().subscribe((receivedMessage: Message) => {
      this.ngZone.run(() => {
        if (receivedMessage.roomId !== this.roomId) return;

        const isRealMessage = !receivedMessage.id?.startsWith('temp-');
        const existingIndex = this.messages.findIndex((m) => m.id === receivedMessage.id);
        const optimisticIndex = this.messages.findIndex(
          (m) =>
            m.id?.startsWith('temp-') &&
            m.content === receivedMessage.content &&
            m.userId === receivedMessage.userId,
        );

        if (existingIndex !== -1) {
          return;
        }

        if (optimisticIndex !== -1 && isRealMessage) {
          this.messages[optimisticIndex] = receivedMessage;
          this.messages = [...this.messages];
          this.pendingOptimisticIds.delete(this.messages[optimisticIndex].id);
        } else {
          this.messages = [...this.messages, receivedMessage];
        }

        this.cdr.detectChanges();

        if (this.isNearBottom) {
          setTimeout(() => this.scrollToBottom(), 30);
        }
      });
    });
    this.subscriptions.push(messageSub);

    const joinedSub = this.socket.onUserJoined().subscribe(({ userId }) => {
      this.ngZone.run(() => {
        this.api
          .getRoom(this.roomId)
          .pipe(take(1))
          .subscribe((room) => {
            this.room = room;
            this.cdr.detectChanges();
          });
      });
    });
    this.subscriptions.push(joinedSub);

    const leftSub = this.socket.onUserLeft().subscribe(({ userId }) => {
      this.ngZone.run(() => {
        this.api
          .getRoom(this.roomId)
          .pipe(take(1))
          .subscribe((room) => {
            this.room = room;
            this.cdr.detectChanges();
          });
      });
    });
    this.subscriptions.push(leftSub);
  }

  async sendMessage() {
    if (!this.newMessage.trim() || this.sending) return;

    const content = this.newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const optimisticMessage: Message = {
      id: tempId,
      content,
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

    this.messages = [...this.messages, optimisticMessage];
    this.pendingOptimisticIds.add(tempId);
    this.newMessage = '';
    this.sending = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    try {
      if (!this.socket.isConnected()) {
        await this.socket.connect();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.socket.sendMessage(this.roomId, content);
    } catch (error) {
      this.messages = this.messages.filter((m) => m.id !== tempId);
      this.pendingOptimisticIds.delete(tempId);
      this.newMessage = content;
      this.cdr.detectChanges();
      alert('Failed to send message. Please try again.');
    } finally {
      this.sending = false;
      this.cdr.detectChanges();
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
          if (!environment.production) {
            console.error('Failed to add user:', err);
          }
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
