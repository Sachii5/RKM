<template>
  <div class="member-last-order">
    <header class="mb-6">
      <h1 class="page-title">Terakhir Belanja Member</h1>
      <p class="page-subtitle">Daftar member yang sudah lama tidak belanja, diurutkan dari paling lama.</p>
    </header>

    <div class="card glass mb-6">
      <div class="filters">
        <div v-if="isManagement" class="filter-field">
          <label class="filter-label">Salesman</label>
          <select
            v-model="salesmanFilter"
            class="form-control"
            @change="applyFilters"
          >
            <option value="">Semua Salesman</option>
            <option v-for="salesman in salesmanOptions" :key="salesman" :value="salesman">
              {{ salesman }}
            </option>
          </select>
        </div>
        <div class="filter-field">
          <label class="filter-label">Baris</label>
          <select v-model.number="limit" class="form-control" @change="applyFilters">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="applyFilters">
          <i class="fa-solid fa-magnifying-glass"></i> Tampilkan
        </button>
      </div>
    </div>

    <div v-if="errorMessage" class="error-box">
      {{ errorMessage }}
    </div>

    <div class="card glass">
      <div class="table-header">
        <div>
          <h2 class="table-title">Data Member</h2>
          <p class="table-subtitle">
            {{ pagination.total }} member ditemukan
          </p>
        </div>
        <button class="btn btn-secondary" :disabled="loading" @click="fetchData">
          <i class="fa-solid fa-rotate-right"></i> Muat Ulang
        </button>
      </div>

      <div v-if="loading" class="empty-state">
        Memuat data terakhir belanja...
      </div>

      <div v-else-if="rows.length === 0" class="empty-state">
        Tidak ada data member untuk filter ini.
      </div>

      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Salesman</th>
              <th>Kode</th>
              <th>Nama Member</th>
              <th>No. HP</th>
              <th>Alamat</th>
              <th>Kelurahan</th>
              <th>Kecamatan</th>
              <th>Terakhir Belanja</th>
              <th>Hari</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="`${row.salesman}-${row.kode_member}`">
              <td class="font-bold text-blue-700">{{ row.salesman || '-' }}</td>
              <td class="font-mono text-xs text-gray-600">{{ row.kode_member }}</td>
              <td class="font-semibold text-gray-800">{{ row.nama_member || '-' }}</td>
              <td>
                <a
                  v-if="waUrl(row.nomor_member)"
                  :href="waUrl(row.nomor_member)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="wa-link"
                >
                  <i class="fa-brands fa-whatsapp"></i> {{ row.nomor_member }}
                </a>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="address-cell">{{ row.alamat || '-' }}</td>
              <td>{{ row.kelurahan || '-' }}</td>
              <td>{{ row.kecamatan || '-' }}</td>
              <td class="whitespace-nowrap">{{ formatDate(row.terakhir_order) }}</td>
              <td>
                <span class="age-badge">{{ row.hari_tidak_belanja }} hari</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn btn-secondary" :disabled="loading || pagination.page <= 1" @click="goToPage(pagination.page - 1)">
          <i class="fa-solid fa-chevron-left"></i> Sebelumnya
        </button>
        <span class="page-info">
          Halaman {{ pagination.page }} dari {{ pagination.totalPages || 1 }}
        </span>
        <button class="btn btn-secondary" :disabled="loading || pagination.page >= pagination.totalPages" @click="goToPage(pagination.page + 1)">
          Berikutnya <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const rows = ref([])
const loading = ref(false)
const errorMessage = ref('')
const salesmanFilter = ref('')
const salesmanOptions = ['DND', 'DPT', 'FRL', 'LID']
const limit = ref(25)
const pagination = ref({
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0
})

const isManagement = computed(() => ['ADMIN', 'SUPERVISOR'].includes(auth.role))

const getErrorMessage = (err) => {
  if (err.code === 'ECONNABORTED') return 'Request terlalu lama. Coba ulangi beberapa saat lagi.'
  if (err.message === 'Network Error') return 'Koneksi ke server terputus. Periksa jaringan lalu coba lagi.'
  return err.response?.data?.error || 'Gagal memuat data terakhir belanja member'
}

const fetchData = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const params = {
      page: pagination.value.page,
      limit: limit.value
    }
    if (isManagement.value && salesmanFilter.value) {
      params.salesman = salesmanFilter.value.toUpperCase()
    }

    const res = await axios.get('/api/members/last-orders', {
      params,
      timeout: 60000,
      headers: { Authorization: `Bearer ${auth.token}` }
    })

    rows.value = res.data.data || []
    pagination.value = res.data.pagination || {
      page: 1,
      limit: limit.value,
      total: 0,
      totalPages: 0
    }
  } catch (err) {
    rows.value = []
    errorMessage.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const applyFilters = () => {
  pagination.value.page = 1
  fetchData()
}

const goToPage = (page) => {
  if (page < 1 || page > pagination.value.totalPages) return
  pagination.value.page = page
  fetchData()
}

const formatDate = (date) => {
  if (!date) return '-'
  return dayjs(date).format('DD/MM/YYYY')
}

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

const waUrl = (phone) => {
  const normalized = normalizePhone(phone)
  return normalized ? `https://wa.me/${normalized}` : ''
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.filter-field {
  display: flex;
  flex-direction: column;
  min-width: 140px;
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #4b5563;
  margin-bottom: 0.25rem;
}

.error-box {
  margin-bottom: 1rem;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.table-title {
  font-size: 1rem;
  font-weight: 800;
  color: #1f2937;
}

.table-subtitle {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 0.2rem;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #eef2f7;
  border-radius: 0.5rem;
}

.data-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.data-table th {
  background: #f8fafc;
  color: #475569;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0;
  text-align: left;
  padding: 0.85rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.data-table td {
  padding: 0.85rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}

.data-table tr:hover {
  background: #f8fbff;
}

.address-cell {
  max-width: 260px;
  color: #4b5563;
}

.wa-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #15803d;
  font-weight: 700;
  white-space: nowrap;
}

.age-badge {
  display: inline-block;
  min-width: 4.5rem;
  text-align: center;
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.page-info {
  font-size: 0.85rem;
  color: #4b5563;
}

@media (max-width: 768px) {
  .table-header,
  .pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .filters,
  .filter-field,
  .filters .btn {
    width: 100%;
  }
}
</style>
