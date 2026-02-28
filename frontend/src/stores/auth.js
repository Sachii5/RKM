import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    user: (state) => {
      if (!state.token) return null;
      try {
        return jwtDecode(state.token);
      } catch (err) {
        return null;
      }
    },
    role: (state) => {
      const u = state.user; // getter reference
      return u ? u.role : null;
    },
    isFirstLogin: (state) => {
      const u = state.user;
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
    }
  }
})
