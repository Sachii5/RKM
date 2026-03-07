<template>
  <div class="visit-tracking">
    <header class="mb-8">
      <h1 class="page-title">Today's Visits</h1>
      <p class="page-subtitle">Track and mark your completed visits for today</p>
    </header>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading your schedule...
    </div>

    <div v-else-if="visits.length === 0" class="card text-center py-12 text-gray-500 glass">
      <p class="mb-4">No visits assigned for today.</p>
      <router-link to="/create-zone" class="btn btn-primary">Go to Zone Assignment</router-link>
    </div>

    <div v-else class="card glass">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-bold text-lg">Assigned Route: <span class="text-primary">{{ visits.length }} Members</span></h3>
        <div class="text-sm">
          Completed: <span class="badge badge-success">{{ completedCount }}</span> / {{ visits.length }}
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Member Code</th>
              <th>Name</th>
              <th>Address</th>
              <th>Phone</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in visits" :key="v.member_code" :class="{ 'bg-green-50': v.visited === 1 }">
              <td>
                <span v-if="v.visited === 1" class="badge badge-success">VISITED</span>
                <span v-else class="badge badge-warning text-white">PENDING</span>
              </td>
              <td class="font-mono text-sm">{{ v.member_code }}</td>
              <td class="font-bold">{{ v.cus_namamember || 'Unknown' }}</td>
              <td class="text-sm text-gray-600 max-w-xs truncate" :title="v.cus_alamatmember4">
                {{ v.cus_alamatmember4 }} - {{ v.cus_alamatmember5 }}
              </td>
              <td>{{ v.cus_hpmember || '-' }}</td>
              <td>
                <button 
                  v-if="v.visited === 0" 
                  @click="markVisited(v.member_code)" 
                  class="btn btn-primary"
                  style="padding: 8px 16px; font-size: 0.75rem"
                >
                  Mark Visited
                </button>
                <div v-else class="text-xs text-gray-500">
                  {{ formatTime(v.visited_at) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import dayjs from 'dayjs'

const auth = useAuthStore()
const visits = ref([])
const loading = ref(true)

const completedCount = computed(() => visits.value.filter(v => v.visited === 1).length)

const fetchVisits = async () => {
  loading.value = true
  try {
    const res = await axios.get(`http://172.26.11.6:3000/api/visit/today?salesman=${auth.salesmanCode}`)
    visits.value = res.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const markVisited = async (memberCode) => {
  try {
    await axios.post('http://172.26.11.6:3000/api/visit/mark', {
      salesman_code: auth.salesmanCode,
      member_code: memberCode
    })
    // Refresh list locally
    const target = visits.value.find(v => v.member_code === memberCode)
    if (target) {
      target.visited = 1
      target.visited_at = new Date().toISOString()
    }
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to mark visited')
  }
}

const formatTime = (isoString) => {
  if (!isoString) return ''
  return dayjs(isoString).format('HH:mm')
}

onMounted(() => {
  fetchVisits()
})
</script>

<style scoped>
.font-mono { font-family: monospace; }
.text-sm { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
.text-gray-500 { color: var(--pk-text-muted); }
.text-gray-600 { color: #4B5563; }
.bg-green-50 { background-color: #F0FDF4; }
.max-w-xs { max-width: 320px; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
.py-12 { padding-top: 48px; padding-bottom: 48px; }
.font-bold { font-weight: 700; }
</style>
