import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Room, Message, CreateRoomDto, User, UserStats } from '../models/types';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUserStats(userId: string): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.apiUrl}/users/${userId}/stats`);
  }

  getUser(userId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${userId}`);
  }

  getRooms(): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.apiUrl}/rooms`);
  }

  createRoom(data: CreateRoomDto): Observable<Room> {
    return this.http.post<Room>(`${this.apiUrl}/rooms`, data);
  }

  getRoom(roomId: string): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}/rooms/${roomId}`);
  }

  addMember(roomId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/rooms/${roomId}/members`, { userId });
  }

  removeMember(roomId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/rooms/${roomId}/members/${userId}`);
  }

  deleteRoom(roomId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/rooms/${roomId}`);
  }

  searchUsers(query: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users/search?q=${encodeURIComponent(query)}`);
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.http.post<{ avatarUrl: string }>(`${this.apiUrl}/users/avatar`, formData);
  }
}
