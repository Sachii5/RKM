import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'
import MapZoning from '../pages/MapZoning.vue'
import SalesmanRoute from '../pages/SalesmanRoute.vue'
import ResetPage from '../pages/Reset.vue'
import ChangePassword from '../pages/ChangePassword.vue'
import ZoneList from '../pages/ZoneList.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', component: Dashboard, name: 'dashboard' },
  { 
    path: '/change-password', 
    component: ChangePassword,
    meta: { requiresAuth: true, allowedRoles: ['SALESMAN'] }
  },
  { 
    path: '/zoning', 
    component: MapZoning, 
    meta: { requiresAuth: true, allowedRoles: ['ADMIN', 'SUPERVISOR'] } 
  },
  { 
    path: '/route', 
    component: SalesmanRoute, 
    meta: { requiresAuth: true, allowedRoles: ['SALESMAN'] } 
  },
  { 
    path: '/reset', 
    component: ResetPage, 
    meta: { requiresAuth: true, allowedRoles: ['ADMIN'] } 
  },
  { 
    path: '/zones', 
    component: ZoneList,
    meta: { requiresAuth: true, allowedRoles: ['ADMIN', 'SUPERVISOR', 'SALESMAN'] } 
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  
  // Exclude auth requirement for login (dashboard)
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next('/')
  }

  // Handle first_login constraint for Salesman
  if (auth.isAuthenticated && to.path !== '/change-password' && auth.isFirstLogin && auth.role === 'SALESMAN') {
    return next('/change-password')
  }

  // Handle Role Guards
  if (to.meta.allowedRoles) {
    if (!to.meta.allowedRoles.includes(auth.role)) {
      return next('/') // Unauthorized, dump to home
    }
  }

  next()
})

export default router
