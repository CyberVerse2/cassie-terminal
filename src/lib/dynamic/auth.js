import { dynamicClient } from './client.js';

export function authHeaders() {
  const token = dynamicClient?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function userInitials(user) {
  const email = user?.email ?? '';
  const local = email.split('@')[0] ?? '';
  const letters = local.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  return letters || 'IN';
}
