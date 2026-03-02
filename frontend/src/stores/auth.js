import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
  }),
  getters: {
    isAuthenticated: (state) => {
      if (!state.token) return false
      // Security: Check if token is expired
      try {
        const decoded = jwtDecode(state.token)
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          return false
        }
        return true
      } catch {
        return false
      }
    },
    user: (state) => {
      if (!state.token) return null;
      try {
        const decoded = jwtDecode(state.token);
        // Check expiry
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          return null;
        }
        return decoded;
      } catch (err) {
        return null;
      }
    },
    role() {
      const u = this.user;
      return u ? u.role : null;
    },
    isFirstLogin() {
      const u = this.user;
      return u ? u.first_login === 1 : false;
    }
  },
  actions: {
    login(token) {
      this.token = token;
      localStorage.setItem('token', token);
    },
    logout() {
      this.token = null;
      localStorage.removeItem('token');
    },
    // Auto-check and clear expired tokens
    checkTokenExpiry() {
      if (this.token && !this.isAuthenticated) {
        this.logout();
        return false;
      }
      return true;
    }
  }
})
