<template>
  <div class="survey-analytics">
    <header class="mb-6">
      <h1 class="page-title">Analitik Survei Kunjungan</h1>
      <p class="page-subtitle">Wawasan data kualitatif dan kuantitatif dari hasil survei kunjungan RKM</p>
    </header>

    <div class="card glass mb-6">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-600 mb-1">Bulan</label>
          <select v-model="selectedMonth" @change="fetchAnalytics" class="form-control text-sm py-1.5 px-3 min-w-[120px] bg-white border-gray-300">
            <option v-for="(m, i) in months" :key="i" :value="i + 1">{{ m }}</option>
          </select>
        </div>
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-600 mb-1">Tahun</label>
          <select v-model="selectedYear" @change="fetchAnalytics" class="form-control text-sm py-1.5 px-3 min-w-[100px] bg-white border-gray-300">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-600 mb-1">Salesman</label>
          <select v-model="selectedSalesman" @change="fetchAnalytics" class="form-control text-sm py-1.5 px-3 min-w-[150px] bg-white border-gray-300">
            <option value="">Semua Salesman</option>
            <option v-for="s in availableSalesmen" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button @click="exportToCSV" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md text-sm py-1.5 px-4 transition-colors disabled:opacity-60 shadow-sm flex items-center gap-2" :disabled="loading || !data.rawSurveys || data.rawSurveys.length === 0">
            <i class="fa-solid fa-file-csv text-sm"></i> CSV
          </button>
          <button @click="exportToExcel" class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-sm py-1.5 px-4 transition-colors disabled:opacity-60 shadow-sm flex items-center gap-2" :disabled="loading || !data.rawSurveys || data.rawSurveys.length === 0">
            <i class="fa-solid fa-file-excel text-sm"></i> Excel
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card text-center py-12 text-gray-400">
      <p>Memuat data analitik...</p>
    </div>

    <div v-else class="space-y-6">
      
      <!-- Top Overview Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Hit Rate (Berhasil Order) -->
        <div class="card glass flex flex-col h-full">
          <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Hit Rate Order (Survei)</h3>
          <div class="flex-1 flex items-center justify-center relative min-h-[300px]">
            <div class="w-full max-w-[280px] aspect-square" v-if="hitRateData">
              <Doughnut :data="hitRateData" :options="pieOptions" />
            </div>
            <p v-else class="text-sm text-gray-400">Belum ada data</p>
          </div>
        </div>

        <!-- Preferensi Promo -->
        <div class="card glass flex flex-col h-full">
          <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Preferensi Promo</h3>
          <div class="flex-1 flex items-center justify-center relative min-h-[300px]">
            <div class="w-full max-w-[280px] aspect-square" v-if="promoData">
              <Doughnut :data="promoData" :options="pieOptions" />
            </div>
            <p v-else class="text-sm text-gray-400">Belum ada data</p>
          </div>
        </div>
      </div>

      <!-- Bar Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Kendala Belanja -->
        <div class="card glass flex flex-col h-full">
          <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Top Kendala Belanja</h3>
          <div class="flex-1 relative min-h-[300px] w-full">
            <Bar v-if="kendalaData" :data="kendalaData" :options="barOptions" />
            <p v-else class="text-sm text-gray-400 text-center mt-10">Belum ada data</p>
          </div>
        </div>

        <!-- Produk Mahal -->
        <div class="card glass flex flex-col h-full">
          <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Top Produk Mahal (Keluhan)</h3>
          <div class="flex-1 relative min-h-[300px] w-full">
            <Bar v-if="produkMahalData" :data="produkMahalData" :options="barOptions" />
            <p v-else class="text-sm text-gray-400 text-center mt-10">Belum ada data</p>
          </div>
        </div>
      </div>

      <!-- Text Insights: Saran & Kritik / Wanted List -->
      <div class="card glass">
        <h3 class="font-bold text-gray-700 mb-4 border-b pb-2">Insight Member (Saran, Kritik, Produk Belum Ada)</h3>
        
        <div v-if="!data.feedback || data.feedback.length === 0" class="text-center py-6 text-gray-400 text-sm">
          Belum ada saran/kritik dari member.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100">
                <th class="px-4 py-3 font-semibold text-gray-600">Tanggal</th>
                <th class="px-4 py-3 font-semibold text-gray-600">Member</th>
                <th class="px-4 py-3 font-semibold text-gray-600">Saran / Kritik</th>
                <th class="px-4 py-3 font-semibold text-gray-600">Produk Belum Ada</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="(fb, i) in paginatedFeedback" :key="i" class="hover:bg-blue-50/30 transition-colors">
                <td class="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{{ formatDate(fb.created_at) }}</td>
                <td class="px-4 py-3 font-medium text-gray-700">{{ fb.member_code }}</td>
                <td class="px-4 py-3 text-gray-600 max-w-xs truncate" :title="fb.saran_kritik">{{ fb.saran_kritik || '-' }}</td>
                <td class="px-4 py-3 text-red-600 max-w-xs truncate" :title="fb.produk_belum_ada">{{ fb.produk_belum_ada || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Controls -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div class="text-xs text-gray-500">
            Menampilkan {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, data.feedback.length) }} dari {{ data.feedback.length }} data
          </div>
          <div class="flex gap-2">
            <button 
              @click="currentPage--" 
              :disabled="currentPage === 1"
              class="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <i class="fa-solid fa-chevron-left mr-1"></i> Prev
            </button>
            <div class="flex items-center px-2 text-xs font-semibold text-gray-600">
              {{ currentPage }} / {{ totalPages }}
            </div>
            <button 
              @click="currentPage++" 
              :disabled="currentPage === totalPages"
              class="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
              Next <i class="fa-solid fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

import { Doughnut, Bar, Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, BarElement, PointElement, LineElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, ArcElement, BarElement, PointElement, LineElement, CategoryScale, LinearScale)

const auth = useAuthStore()
const loading = ref(true)
const data = ref({
  timeline: [],
  rawSurveys: [],
  hitRate: [],
  promo: [],
  kendala: [],
  produkMahal: [],
  feedback: []
})

const availableSalesmen = ref([])
const selectedSalesman = ref('')

const currentPage = ref(1)
const itemsPerPage = 10

const now = new Date()
const selectedMonth = ref(now.getMonth() + 1)
const selectedYear = ref(now.getFullYear())

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]
const years = computed(() => {
  const currentYear = now.getFullYear()
  return [currentYear - 1, currentYear, currentYear + 1]
})

const fetchAnalytics = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/analytics/surveys', {
      params: {
        month: selectedMonth.value,
        year: selectedYear.value,
        salesman: selectedSalesman.value
      },
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    data.value = res.data
    // Update available salesmen list only if we haven't selected a specific one 
    // to prevent the dropdown from filtering itself down to 1 option
    if (!selectedSalesman.value) {
      availableSalesmen.value = res.data.availableSalesmen || []
    }
    currentPage.value = 1 // Reset pagination on new filter
  } catch (err) {
    console.error('Failed to fetch survey analytics', err)
    alert('Gagal memuat data analitik.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAnalytics()
})

const formatDate = (dateStr) => {
  return dayjs(dateStr).format('DD MMM YYYY, HH:mm')
}

const formatArray = (val) => {
  if (!val) return '-'
  if (Array.isArray(val)) return val.join(', ')
  return val
}

const exportToCSV = () => {
  if (!data.value.rawSurveys || data.value.rawSurveys.length === 0) return

  // Create CSV Header
  let csvContent = "Visit ID,Tanggal,Salesman,Kode Member,Berhasil Order,Promo Menarik,Kendala Belanja,Produk Mahal,Saran/Kritik,Produk Belum Ada\n"
  
  // Add Rows
  data.value.rawSurveys.forEach(item => {
    const visitId = item.visit_id || '-'
    const tanggal = dayjs(item.created_at).format('YYYY-MM-DD HH:mm')
    const salesman = item.advisor_name || '-'
    const member = item.member_code || '-'
    const order = item.berhasil_order || '-'
    const promo = `"${(item.promo_menarik || '').replace(/"/g, '""')}"`
    const kendala = `"${formatArray(item.kendala_belanja).replace(/"/g, '""')}"`
    const mahal = `"${formatArray(item.produk_mahal).replace(/"/g, '""')}"`
    const saran = `"${(item.saran_kritik || '').replace(/"/g, '""')}"`
    const produk = `"${(item.produk_belum_ada || '').replace(/"/g, '""')}"`
    
    csvContent += `${visitId},${tanggal},${salesman},${member},${order},${promo},${kendala},${mahal},${saran},${produk}\n`
  })

  // Create Blob and Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `Analitik_Survei_${selectedMonth.value}_${selectedYear.value}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const exportToExcel = () => {
  if (!data.value.rawSurveys || data.value.rawSurveys.length === 0) return

  // Format data for Excel
  const excelData = data.value.rawSurveys.map(item => ({
    'Visit ID': item.visit_id || '-',
    'Tanggal': dayjs(item.created_at).format('YYYY-MM-DD HH:mm'),
    'Salesman': item.advisor_name || '-',
    'Kode Member': item.member_code || '-',
    'Berhasil Order': item.berhasil_order || '-',
    'Promo Menarik': item.promo_menarik || '-',
    'Kendala Belanja': formatArray(item.kendala_belanja),
    'Produk Mahal': formatArray(item.produk_mahal),
    'Saran/Kritik': item.saran_kritik || '-',
    'Produk Belum Ada': item.produk_belum_ada || '-'
  }))

  // Create Worksheet and Workbook
  const worksheet = XLSX.utils.json_to_sheet(excelData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data Survei")

  // Set column widths
  const wscols = [
    { wch: 10 }, // Visit ID
    { wch: 18 }, // Tanggal
    { wch: 12 }, // Salesman
    { wch: 15 }, // Kode Member
    { wch: 15 }, // Berhasil Order
    { wch: 25 }, // Promo
    { wch: 35 }, // Kendala
    { wch: 35 }, // Mahal
    { wch: 50 }, // Saran/Kritik
    { wch: 30 }  // Produk Belum Ada
  ]
  worksheet['!cols'] = wscols

  // Generate Excel file
  XLSX.writeFile(workbook, `Analitik_Survei_${selectedMonth.value}_${selectedYear.value}.xlsx`)
}

// Color Palette
const bgColors = [
  'rgba(59, 130, 246, 0.7)', // blue-500
  'rgba(16, 185, 129, 0.7)', // emerald-500
  'rgba(245, 158, 11, 0.7)', // amber-500
  'rgba(239, 68, 68, 0.7)',  // red-500
  'rgba(139, 92, 246, 0.7)', // violet-500
  'rgba(14, 165, 233, 0.7)', // sky-500
]

const borderColors = bgColors.map(c => c.replace('0.7', '1'))

// Chart Data Builders
const timelineData = computed(() => {
  if (!data.value.timeline || data.value.timeline.length === 0) return null
  return {
    labels: data.value.timeline.map(item => dayjs(item.date).format('D MMM')),
    datasets: [{
      label: 'Jumlah Survei',
      data: data.value.timeline.map(item => item.count),
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      tension: 0.3,
      fill: true
    }]
  }
})

// Pagination Computed
const totalPages = computed(() => {
  if (!data.value.feedback) return 0
  return Math.ceil(data.value.feedback.length / itemsPerPage)
})

const paginatedFeedback = computed(() => {
  if (!data.value.feedback) return []
  const start = (currentPage.value - 1) * itemsPerPage
  return data.value.feedback.slice(start, start + itemsPerPage)
})

const hitRateData = computed(() => {
  if (!data.value.hitRate || data.value.hitRate.length === 0) return null
  return {
    labels: data.value.hitRate.map(item => item.label),
    datasets: [{
      data: data.value.hitRate.map(item => item.count),
      backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)'],
      borderColor: ['rgba(16, 185, 129, 1)', 'rgba(239, 68, 68, 1)', 'rgba(59, 130, 246, 1)'],
      borderWidth: 1
    }]
  }
})

const promoData = computed(() => {
  if (!data.value.promo || data.value.promo.length === 0) return null
  return {
    labels: data.value.promo.map(item => item.label),
    datasets: [{
      data: data.value.promo.map(item => item.count),
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: 1
    }]
  }
})

const kendalaData = computed(() => {
  if (!data.value.kendala || data.value.kendala.length === 0) return null
  return {
    labels: data.value.kendala.map(item => {
      // Truncate long labels
      const lbl = item.label
      return lbl.length > 20 ? lbl.substring(0, 20) + '...' : lbl
    }),
    datasets: [{
      label: 'Jumlah Keluhan',
      data: data.value.kendala.map(item => item.count),
      backgroundColor: 'rgba(245, 158, 11, 0.7)',
      borderColor: 'rgba(245, 158, 11, 1)',
      borderWidth: 1,
      borderRadius: 4
    }]
  }
})

const produkMahalData = computed(() => {
  if (!data.value.produkMahal || data.value.produkMahal.length === 0) return null
  return {
    labels: data.value.produkMahal.map(item => {
      const lbl = item.label
      return lbl.length > 20 ? lbl.substring(0, 20) + '...' : lbl
    }),
    datasets: [{
      label: 'Jumlah Disebut',
      data: data.value.produkMahal.map(item => item.count),
      backgroundColor: 'rgba(239, 68, 68, 0.7)',
      borderColor: 'rgba(239, 68, 68, 1)',
      borderWidth: 1,
      borderRadius: 4
    }]
  }
})

// Chart Options
const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' }
  }
}

const barOptions = {
  indexAxis: 'y', // Horizontal bar chart
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { precision: 0 } // Integer only
    }
  }
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 } // Integer only
    }
  }
}
</script>
