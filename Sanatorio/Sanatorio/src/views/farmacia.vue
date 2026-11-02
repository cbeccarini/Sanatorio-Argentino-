<script setup>
import { ref, onMounted } from 'vue'
import { useUser } from '@clerk/vue' // Importante para leer el rol actual
import SubirArchivo from '@/components/SubirArchivo.vue'
import axios from 'axios'

const { user } = useUser() // Accedemos a la info del usuario logueado
const listaArchivos = ref([])

const mostrarModal = ref(false)
const urlArchivoPrevia = ref('')
const esImagenOPdf = ref(false)

onMounted(async () => {
  try {
    const response = await axios.get('http://localhost:3000/api/archivos/farmacia')
    listaArchivos.value = response.data 
  } catch (error) {
    console.log("Servidor backend desconectado.")
  }
})

const agregarArchivosAInterfaz = (nuevosArchivos) => {
  listaArchivos.value.push(...nuevosArchivos)
}

// MANEJO DE VISTA PREVIA CORREGIDO
const abrirVistaPrevia = (archivo) => {
  const nombreMinuscula = archivo.nombre.toLowerCase();

  // 1. Si es Word (.docx, .doc) o Excel (.xlsx, .xls), forzamos la descarga directa
  if (
    nombreMinuscula.endsWith('.docx') || 
    nombreMinuscula.endsWith('.doc') || 
    nombreMinuscula.endsWith('.xlsx') || 
    nombreMinuscula.endsWith('.xls')
  ) {
    window.open(archivo.url, '_blank')
    return
  }

  // 2. Si es PDF o Imagen, lo mostramos en el modal flotante
  if (
    nombreMinuscula.endsWith('.pdf') || 
    nombreMinuscula.endsWith('.png') || 
    nombreMinuscula.endsWith('.jpg') || 
    nombreMinuscula.endsWith('.jpeg') || 
    nombreMinuscula.endsWith('.gif')
  ) {
    esImagenOPdf.value = true
    urlArchivoPrevia.value = archivo.url
    mostrarModal.value = true
  } else {
    window.open(archivo.url, '_blank')
  }
}

const cerrarVistaPrevia = () => {
  mostrarModal.value = false
  urlArchivoPrevia.value = '' 
  esImagenOPdf.value = false
}

// ELIMINACIÓN LIBRE Y COMPARTIDA
const eliminarArchivo = async (archivo) => {
  if (!confirm(`¿Estás seguro de eliminar el archivo "${archivo.nombre}"?`)) return

  try {
    await axios.delete(`http://localhost:3000/api/archivos/eliminar/${archivo.id}`)
    listaArchivos.value = listaArchivos.value.filter(item => item.id !== archivo.id)
  } catch (error) {
    alert('Error al intentar borrar el archivo del servidor.')
  }
}
</script>

<template>
  <div class="seccion-container">
    <h2>Panel - Área de Farmacia</h2>
    
    <div class="modulo-subida">
      <SubirArchivo 
        endpoint="http://localhost:3000/api/farmacia/subir" 
        seccion="farmacia" 
        @archivosSubidos="agregarArchivosAInterfaz" 
      />
    </div>

    <div class="modulo-archivos">
      <h3>Documentos Compartidos</h3>
      <div v-if="listaArchivos.length === 0" class="sin-archivos">No hay archivos guardados en esta sección.</div>

      <div v-for="arc in listaArchivos" :key="arc.id" class="archivo-card">
        <span class="archivo-nombre">📄 {{ arc.nombre }}</span>
        <div class="acciones-btn">
          <button @click="abrirVistaPrevia(arc)" class="btn-revisar">Revisar</button>
          <button @click="eliminarArchivo(arc)" class="btn-eliminar">
            Eliminar
          </button>
        </div>
      </div>
    </div>

    <div v-if="mostrarModal" class="modal-overlay" @click.self="cerrarVistaPrevia">
      <div class="modal-contenedor">
        <div class="modal-header">
          <h3>Visualizador de Archivos Interno</h3>
          <button @click="cerrarVistaPrevia" class="btn-cerrar">❌ Cerrar Vista Previa</button>
        </div>
        <div class="modal-body">
          <embed 
            v-if="esImagenOPdf" 
            :src="urlArchivoPrevia" 
            width="100%" 
            height="100%" 
            type="application/pdf"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seccion-container { padding: 20px; font-family: sans-serif; }

/* NUEVOS ESTILOS PARA LA DESCRIPCIÓN DEL ROL */
.tarjeta-usuario { display: flex; align-items: center; gap: 15px; background-color: #ebf8ff; border: 1px solid #bee3f8; padding: 12px 20px; border-radius: 8px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.usuario-avatar { font-size: 24px; background: #e2e8f0; padding: 8px; border-radius: 50%; }
.usuario-info p { margin: 2px 0; color: #2b6cb0; font-size: 14px; }
.usuario-email { font-size: 15px; }
.badge-rol { background-color: #2b6cb0; color: white; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-size: 12px; font-weight: bold; }
.badge-seccion { background-color: #4a5568; color: white; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-size: 12px; font-weight: bold; }

.modulo-subida { margin-bottom: 30px; }
.modulo-archivos { margin-top: 20px; }
.sin-archivos { padding: 15px; color: #718096; background-color: #f7fafc; border-radius: 6px; text-align: center; }
.archivo-card { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.archivo-nombre { font-weight: 500; color: #2d3748; }
.acciones-btn { display: flex; gap: 8px; }
.btn-revisar { background-color: #2b6cb0; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; }
.btn-revisar:hover { background-color: #2c5282; }
.btn-eliminar { background-color: #e53e3e; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; }
.btn-eliminar:hover { background-color: #9b2c2c; }

/* MODAL INTERACTIVO */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-contenedor { background: white; width: 90%; max-width: 1200px; height: 85vh; padding: 20px; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
.btn-cerrar { background: none; border: none; font-size: 15px; cursor: pointer; font-weight: bold; color: #4a5568; }
.modal-body { flex-grow: 1; background-color: #edf2f7; border-radius: 4px; overflow: hidden; }
</style>

