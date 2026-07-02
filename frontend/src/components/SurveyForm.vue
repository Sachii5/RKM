<template>
  <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
    <div class="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden animate-fade-in border border-gray-100">
      
      <!-- Header -->
      <div class="px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">Evaluasi Kunjungan RKM</h2>
          <p class="text-sm text-gray-500 mt-1">Laporan untuk member: <strong class="text-blue-600">{{ memberCode }}</strong></p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full p-2 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto flex-1 bg-gray-50/50">
        <form @submit.prevent="submitSurvey" class="space-y-6">
          
          <!-- Kendala belanja -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Kendala Member belanja via aplikasi SPI? <span class="text-red-500">*</span></label>
            <div class="space-y-2">
              <label v-for="opt in ['Harga lebih mahal dari tempat lain (agen/sales/kompetitor lain)', 'Stok barang sering kosong', 'Aplikasi sulit digunakan', 'Pengantaran barang memakan waktu lama', 'Biaya pengantaran terlalu mahal']" :key="opt" 
                     class="flex items-start gap-3 cursor-pointer p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="checkbox" v-model="form.kendalaBelanja" :value="opt" class="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm leading-relaxed">{{ opt }}</span>
              </label>
              <div class="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="checkbox" v-model="flags.kendalaOther" class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm whitespace-nowrap">Lainnya:</span>
                <input type="text" v-model="form.kendalaBelanjaOther" @focus="flags.kendalaOther = true" class="form-control py-1.5 px-3 text-sm flex-1 bg-white border-gray-300">
              </div>
            </div>
          </div>

          <!-- Produk mahal -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Produk apa yang harganya relatif lebih mahal? <span class="text-red-500">*</span></label>
            <div class="space-y-2">
              <label v-for="opt in ['Rokok', 'Mie instan', 'Kopi dan minuman', 'Kebutuhan pokok (gula, beras, tepung dll)', 'Bumbu dapur (garam, gula, bumbu instan, kecap dll)', 'Snack/cemilan', 'Sabun/sampo/pasta gigi/ keperluan mandi lain']" :key="opt" 
                     class="flex items-start gap-3 cursor-pointer p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="checkbox" v-model="form.produkMahal" :value="opt" class="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm leading-relaxed">{{ opt }}</span>
              </label>
              <div class="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="checkbox" v-model="flags.produkMahalOther" class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm whitespace-nowrap">Lainnya:</span>
                <input type="text" v-model="form.produkMahalOtherText" @focus="flags.produkMahalOther = true" class="form-control py-1.5 px-3 text-sm flex-1 bg-white border-gray-300">
              </div>
            </div>
          </div>

          <!-- Produk belum tersedia -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Produk yang laku di luaran tapi SPI belum tersedia</label>
            <input type="text" v-model="form.produkBelumAda" placeholder="Ketik jawaban di sini..." class="form-control text-sm bg-white border-gray-300">
          </div>

          <!-- Sumber Info Promo -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Darimana biasanya Member memperoleh informasi promosi? <span class="text-red-500">*</span></label>
            <div class="space-y-2">
              <label v-for="opt in ['Saat membuka aplikasi SPI Indogrosir', 'Media sosial/website/wa blast', 'Advisor/Sales']" :key="opt" 
                     class="flex items-start gap-3 cursor-pointer p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="checkbox" v-model="form.sumberInfoPromo" :value="opt" class="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm leading-relaxed">{{ opt }}</span>
              </label>
              <div class="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="checkbox" v-model="flags.sumberInfoOther" class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm whitespace-nowrap">Lainnya:</span>
                <input type="text" v-model="form.sumberInfoPromoOtherText" @focus="flags.sumberInfoOther = true" class="form-control py-1.5 px-3 text-sm flex-1 bg-white border-gray-300">
              </div>
            </div>
          </div>

          <!-- Promo paling menarik -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Promosi yang paling menarik <span class="text-red-500">*</span></label>
            <div class="space-y-2">
              <label v-for="opt in ['Diskon harga langsung', 'Bonus barang (hadiah barang dagangan)', 'Program poin/reward', 'Hadiah loyalty']" :key="opt" 
                     class="flex items-start gap-3 cursor-pointer p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="radio" v-model="form.promoMenarik" :value="opt" class="mt-1 w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm leading-relaxed">{{ opt }}</span>
              </label>
              <div class="flex items-center gap-3 p-2 hover:bg-blue-50/50 rounded-lg transition-colors">
                <input type="radio" v-model="form.promoMenarik" value="Lainnya" class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 transition-colors">
                <span class="text-gray-700 text-sm whitespace-nowrap">Lainnya:</span>
                <input type="text" v-model="form.promoMenarikOtherText" @focus="form.promoMenarik = 'Lainnya'" class="form-control py-1.5 px-3 text-sm flex-1 bg-white border-gray-300">
              </div>
            </div>
          </div>

          <!-- Perlu kunjungan rutin -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Apakah perlu dikunjungi oleh sales seminggu satu kali <span class="text-red-500">*</span></label>
            <div class="flex flex-wrap gap-4">
              <label v-for="opt in ['Perlu', 'Tidak Perlu']" :key="opt" class="flex items-center gap-2 cursor-pointer p-2 hover:bg-blue-50/50 rounded-lg">
                <input type="radio" v-model="form.perluKunjunganRutin" :value="opt" class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500">
                <span class="text-gray-700 text-sm">{{ opt }}</span>
              </label>
              <div class="flex items-center gap-2 p-2 w-full sm:w-auto flex-1 hover:bg-blue-50/50 rounded-lg">
                <input type="radio" v-model="form.perluKunjunganRutin" value="Lainnya" class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500">
                <span class="text-gray-700 text-sm whitespace-nowrap">Lainnya:</span>
                <input type="text" v-model="form.perluKunjunganOtherText" maxlength="255" @focus="form.perluKunjunganRutin = 'Lainnya'" class="form-control py-1.5 px-3 text-sm flex-1 min-w-[100px] bg-white border-gray-300">
              </div>
            </div>
          </div>

          <!-- Saran Kritik -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Saran / Kritik dari Member <span class="text-red-500">*</span></label>
            <textarea v-model="form.saranKritik" rows="3" placeholder="Ketik saran dan kritik di sini..." class="form-control text-sm bg-white border-gray-300 resize-none"></textarea>
          </div>

          <!-- Berhasil Order -->
          <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <label class="form-label mb-3">Apakah MM berhasil Order <span class="text-red-500">*</span></label>
            <div class="flex flex-wrap gap-4">
              <label v-for="opt in ['Ya', 'Tidak']" :key="opt" class="flex items-center gap-2 cursor-pointer p-2 hover:bg-blue-50/50 rounded-lg">
                <input type="radio" v-model="form.berhasilOrder" :value="opt" class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500">
                <span class="text-gray-700 text-sm">{{ opt }}</span>
              </label>
              <div class="flex items-center gap-2 p-2 w-full sm:w-auto flex-1 hover:bg-blue-50/50 rounded-lg">
                <input type="radio" v-model="form.berhasilOrder" value="Lainnya" class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500">
                <span class="text-gray-700 text-sm whitespace-nowrap">Lainnya:</span>
                <input type="text" v-model="form.berhasilOrderOtherText" maxlength="255" @focus="form.berhasilOrder = 'Lainnya'" class="form-control py-1.5 px-3 text-sm flex-1 min-w-[100px] bg-white border-gray-300">
              </div>
            </div>
          </div>

          <!-- Foto Kunjungan -->
          <div class="bg-blue-50 p-5 rounded-xl border border-blue-100">
            <label class="form-label text-blue-800 mb-3">Upload Foto Kunjungan <span class="text-red-500">*</span></label>
            <div class="flex flex-col items-start gap-3">
              <label class="btn btn-primary cursor-pointer w-full sm:w-auto text-center">
                <span class="flex items-center justify-center gap-2">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  Ambil Foto
                </span>
                <input type="file" @change="handleFileUpload" accept="image/*" capture="environment" class="hidden">
              </label>
              <div v-if="fileName" class="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200 w-full flex items-center gap-2">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span class="truncate">{{ fileName }} siap diunggah</span>
              </div>
              <div v-if="loading" class="w-full bg-white rounded-lg border border-blue-100 p-3 text-sm text-blue-800">
                <div class="flex justify-between gap-3 mb-2">
                  <span>{{ submitStatus }}</span>
                  <span v-if="uploadProgress > 0">{{ uploadProgress }}%</span>
                </div>
                <div v-if="uploadProgress > 0" class="h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-600 transition-all duration-200" :style="{ width: `${uploadProgress}%` }"></div>
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>

      <!-- Action Buttons -->
      <div class="p-4 sm:p-6 border-t border-gray-100 bg-white flex flex-col sm:flex-row justify-end gap-3 z-10">
        <button @click="$emit('close')" type="button" class="btn bg-gray-100 hover:bg-gray-200 text-gray-700 w-full sm:w-auto order-2 sm:order-1 transition-colors">
          Batal
        </button>
        <button @click="submitSurvey" :disabled="loading" class="btn btn-primary w-full sm:w-auto order-1 sm:order-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ loading ? 'Mengirim Data...' : 'Kirim Laporan Selesai' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  show: Boolean,
  visitId: Number,
  memberCode: String
})

const emit = defineEmits(['close', 'submit'])
const auth = useAuthStore()

const loading = ref(false)
const submitStatus = ref('')
const uploadProgress = ref(0)
const fileName = ref('')
const photoFile = ref(null)
const errors = ref({})
const MAX_PHOTO_AGE_MS = 2 * 60 * 1000
const MAX_SOURCE_PHOTO_SIZE_BYTES = 40 * 1024 * 1024
const MAX_UPLOAD_PHOTO_SIZE_BYTES = 15 * 1024 * 1024
const PHOTO_MAX_DIMENSION = 1280
const PHOTO_JPEG_QUALITY = 0.68
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const GEOLOCATION_TIMEOUT_MS = 15000
const SURVEY_PHOTO_UPLOAD_TIMEOUT_MS = 90000
const SURVEY_SAVE_TIMEOUT_MS = 30000

const flags = reactive({
  kendalaOther: false,
  produkMahalOther: false,
  sumberInfoOther: false
})

const form = reactive({
  kendalaBelanja: [],
  kendalaBelanjaOther: '',
  produkMahal: [],
  produkMahalOtherText: '',
  produkBelumAda: '',
  sumberInfoPromo: [],
  sumberInfoPromoOtherText: '',
  promoMenarik: '',
  promoMenarikOtherText: '',
  perluKunjunganRutin: '',
  perluKunjunganOtherText: '',
  saranKritik: '',
  berhasilOrder: '',
  berhasilOrderOtherText: ''
})

const handleFileUpload = (e) => {
  const file = e.target.files[0]
  if (file) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      alert('Format foto harus JPG, PNG, WEBP, HEIC, atau HEIF.')
      e.target.value = ''
      fileName.value = ''
      photoFile.value = null
      return
    }

    if (file.size > MAX_SOURCE_PHOTO_SIZE_BYTES) {
      alert('Ukuran foto terlalu besar. Silakan atur kualitas kamera lebih rendah atau ambil ulang foto.')
      e.target.value = ''
      fileName.value = ''
      photoFile.value = null
      return
    }

    const ageMs = Date.now() - file.lastModified
    if (ageMs > MAX_PHOTO_AGE_MS) {
      alert('Foto harus diambil langsung dari kamera. Silakan ambil foto baru.')
      e.target.value = ''
      fileName.value = ''
      photoFile.value = null
      return
    }

    fileName.value = file.name
    photoFile.value = file
  } else {
    fileName.value = ''
    photoFile.value = null
  }
}

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const image = new Image()
  const objectUrl = URL.createObjectURL(file)

  image.onload = () => {
    URL.revokeObjectURL(objectUrl)
    resolve(image)
  }
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new Error('Gagal membaca foto'))
  }
  image.src = objectUrl
})

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('Gagal mengompres foto'))
  }, type, quality)
})

const compressPhoto = async (file) => {
  try {
    const image = await loadImageFromFile(file)
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(image.width, image.height))
    const width = Math.round(image.width * scale)
    const height = Math.round(image.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(canvas, 'image/jpeg', PHOTO_JPEG_QUALITY)
    if (blob.size >= file.size) return file

    const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], compressedName, {
      type: 'image/jpeg',
      lastModified: file.lastModified
    })
  } catch (err) {
    console.warn('Photo compression skipped:', err.message)
    return file
  }
}

const getCurrentLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Browser tidak mendukung GPS. Gunakan perangkat/browser yang mendukung lokasi.'))
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString()
      })
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        reject(new Error('Izin lokasi ditolak. Aktifkan izin lokasi untuk mengirim laporan.'))
      } else if (error.code === error.TIMEOUT) {
        reject(new Error('GPS terlalu lama merespons. Pastikan lokasi aktif lalu coba lagi.'))
      } else {
        reject(new Error('Gagal mengambil lokasi GPS. Pastikan lokasi aktif lalu coba lagi.'))
      }
    },
    {
      enableHighAccuracy: true,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: 0
    }
  )
})

const compileArrays = () => {
  const kendala = [...form.kendalaBelanja]
  if (flags.kendalaOther && form.kendalaBelanjaOther) kendala.push(form.kendalaBelanjaOther)

  const mahal = [...form.produkMahal]
  if (flags.produkMahalOther && form.produkMahalOtherText) mahal.push(form.produkMahalOtherText)

  const sumber = [...form.sumberInfoPromo]
  if (flags.sumberInfoOther && form.sumberInfoPromoOtherText) sumber.push(form.sumberInfoPromoOtherText)

  const promo = form.promoMenarik === 'Lainnya' ? form.promoMenarikOtherText : form.promoMenarik
  const kunjungan = form.perluKunjunganRutin === 'Lainnya' ? form.perluKunjunganOtherText : form.perluKunjunganRutin
  const berhasil = form.berhasilOrder === 'Lainnya' ? form.berhasilOrderOtherText : form.berhasilOrder

  return { kendala, mahal, sumber, promo, kunjungan, berhasil }
}

const getSurveyErrorMessage = (err) => {
  if (err.code === 'ECONNABORTED') {
    return 'Koneksi terlalu lambat saat mengirim laporan. Pastikan sinyal stabil lalu coba lagi.'
  }
  if (err.message === 'Network Error') {
    return 'Koneksi ke server terputus. Pastikan internet aktif lalu coba lagi.'
  }
  if (err.response?.status === 413) {
    return 'Foto terlalu besar untuk dikirim. Silakan ambil ulang foto dengan kualitas kamera lebih rendah.'
  }
  if (err.response?.data?.error) {
    return err.response.data.error
  }
  return err.message || 'Gagal mengirim survei'
}

const submitSurvey = async () => {
  // Validasi Input Wajib
  if (!form.perluKunjunganRutin) {
    alert("Mohon isi pertanyaan: Apakah perlu dikunjungi oleh sales seminggu satu kali?")
    return
  }
  if (form.perluKunjunganRutin === 'Lainnya' && !form.perluKunjunganOtherText.trim()) {
    alert("Mohon isi deskripsi untuk pilihan 'Lainnya' pada pertanyaan kunjungan rutin.")
    return
  }
  if (!form.saranKritik.trim()) {
    alert("Mohon isi Saran / Kritik dari Member.")
    return
  }
  if (!form.berhasilOrder) {
    alert("Mohon isi pertanyaan: Apakah MM berhasil Order?")
    return
  }
  if (form.berhasilOrder === 'Lainnya' && !form.berhasilOrderOtherText.trim()) {
    alert("Mohon isi deskripsi untuk pilihan 'Lainnya' pada pertanyaan MM berhasil Order.")
    return
  }
  if (!photoFile.value) {
    alert("Mohon Upload Foto Kunjungan terlebih dahulu.")
    return
  }

  loading.value = true
  uploadProgress.value = 0
  submitStatus.value = 'Mengambil lokasi GPS...'

  try {
    const location = await getCurrentLocation()
    let uploadedPhotoUrl = ''
    if (photoFile.value) {
      submitStatus.value = 'Mengompres foto...'
      const uploadFile = await compressPhoto(photoFile.value)
      if (uploadFile.size > MAX_UPLOAD_PHOTO_SIZE_BYTES) {
        alert('Foto masih terlalu besar setelah dikompres. Silakan atur kualitas kamera lebih rendah atau ambil ulang foto.')
        return
      }
      const formData = new FormData()
      formData.append('photo', uploadFile)

      submitStatus.value = 'Mengunggah foto...'
      const uploadRes = await axios.post('/api/upload/survey-photo', formData, {
        headers: { 
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: SURVEY_PHOTO_UPLOAD_TIMEOUT_MS,
        onUploadProgress: (event) => {
          if (!event.total) return
          uploadProgress.value = Math.min(99, Math.round((event.loaded * 100) / event.total))
        }
      })
      uploadProgress.value = 100
      uploadedPhotoUrl = uploadRes.data.url
    }

    const compiled = compileArrays()
    submitStatus.value = 'Menyimpan laporan...'

    const payload = {
      member_code: props.memberCode,
      kendala_belanja: compiled.kendala,
      produk_mahal: compiled.mahal,
      produk_belum_ada: form.produkBelumAda,
      sumber_info_promo: compiled.sumber,
      promo_menarik: compiled.promo,
      perlu_kunjungan_rutin: compiled.kunjungan,
      saran_kritik: form.saranKritik,
      berhasil_order: compiled.berhasil,
      foto_kunjungan_url: uploadedPhotoUrl,
      visit_lat: location.lat,
      visit_lng: location.lng,
      visit_accuracy_m: location.accuracy,
      visit_captured_at: location.capturedAt
    }

    await axios.post(`/api/visit/${props.visitId}/survey`, payload, {
      headers: { Authorization: `Bearer ${auth.token}` },
      timeout: SURVEY_SAVE_TIMEOUT_MS
    })
    
    // Reset form after submit
    Object.assign(form, {
      kendalaBelanja: [], kendalaBelanjaOther: '',
      produkMahal: [], produkMahalOtherText: '', produkBelumAda: '',
      sumberInfoPromo: [], sumberInfoPromoOtherText: '', promoMenarik: '',
      promoMenarikOtherText: '', perluKunjunganRutin: '', perluKunjunganOtherText: '',
      saranKritik: '', berhasilOrder: '', berhasilOrderOtherText: ''
    })
    fileName.value = ''
    photoFile.value = null
    Object.keys(flags).forEach(k => flags[k] = false)
    
    emit('submit')
  } catch (err) {
    alert(getSurveyErrorMessage(err))
  } finally {
    loading.value = false
    submitStatus.value = ''
    uploadProgress.value = 0
  }
}
</script>
