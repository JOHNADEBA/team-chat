import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Message } from '../models/types';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;

  // Use Subjects to maintain active streams
  private messageSubject = new Subject<Message>();
  private userJoinedSubject = new Subject<{ userId: string }>();
  private userLeftSubject = new Subject<{ userId: string }>();
  private errorSubject = new Subject<{ message: string }>();

  constructor(private authService: AuthService) {}

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const token = await this.authService.getToken();

    this.socket = io(environment.socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Only log in development
    if (!environment.production) {
      this.socket.on('connect', () => {
        // Development only
      });

      this.socket.on('disconnect', (reason) => {
        // Development only
      });

      this.socket.on('connect_error', (error) => {
        // Development only
      });
    }

    // Always log errors (important even in production)
    this.socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      this.errorSubject.next(data);
    });
  }

  // Setup all event listeners
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('new-message', (message: Message) => {
      this.messageSubject.next(message);
    });

    this.socket.on('user-joined', (data: { userId: string }) => {
      this.userJoinedSubject.next(data);
    });

    this.socket.on('user-left', (data: { userId: string }) => {
      this.userLeftSubject.next(data);
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId: string) {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('join-room', { roomId });
  }

  leaveRoom(roomId: string) {
    if (!this.socket?.connected) return;

    this.socket.emit('leave-room', roomId);
  }

  sendMessage(roomId: string, content: string) {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('send-message', { roomId, content });
  }

  onNewMessage(): Observable<Message> {
    return this.messageSubject.asObservable();
  }

  onUserJoined(): Observable<{ userId: string }> {
    return this.userJoinedSubject.asObservable();
  }

  onUserLeft(): Observable<{ userId: string }> {
    return this.userLeftSubject.asObservable();
  }

  onError(): Observable<{ message: string }> {
    return this.errorSubject.asObservable();
  }
}
