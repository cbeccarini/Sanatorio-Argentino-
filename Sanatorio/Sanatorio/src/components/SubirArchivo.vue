<script setup>
import { ref, computed } from 'vue'
import { useUser } from '@clerk/vue' // Importamos Clerk para leer usuario y roles
import axios from 'axios'

const props = defineProps({
  endpoint: { type: String, required: true },
  seccion: { type: String, required: true },
  carpetaId: { type: [Number, String], default: null },
  carpetaNombre: { type: String, default: '' },
  archivosExistentes: { type: Array, default: () => [] }
})

const emit = defineEmits(['archivosSubidos'])

const { user } = useUser()

const subiendo = ref(false)
const archivosSeleccionados = ref([])
const mensajeResultado = ref('')
const inputArchivoRef = ref(null)

// Permisos y estado para archivos confidenciales (Solo Jefes y Controladores)
const rolUsuario = computed(() => (user.value?.publicMetadata?.role || 'sin-rol').toLowerCase())
const puedeCrearConfidencial = computed(() => ['jefe', 'controlador', 'presidente', 'coordinacion'].includes(rolUsuario.value))
const esConfidencial = ref(false)

const formatearTamano = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const esDuplicado = (nombre) => {
  if (!props.archivosExistentes || props.archivosExistentes.length === 0) return false
  const limpio = (nombre || '').trim().toLowerCase()
  return props.archivosExistentes.some(a => (a.nombre || '').trim().toLowerCase() === limpio)
}

const manejarCambioDeArchivo = (event) => {
  const nuevos = Array.from(event.target.files)
  archivosSeleccionados.value = [...archivosSeleccionados.value, ...nuevos]
  if (inputArchivoRef.value) {
    inputArchivoRef.value.value = ''
  }
  mensajeResultado.value = '' 
}

const quitarArchivo = (indice) => {
  archivosSeleccionados.value.splice(indice, 1)
  if (archivosSeleccionados.value.length === 0 && inputArchivoRef.value) {
    inputArchivoRef.value.value = ''
  }
}

const realizarSubida = async (reemplazar = false) => {
  subiendo.value = true
  mensajeResultado.value = ''

  const formData = new FormData()
  archivosSeleccionados.value.forEach((archivo) => {
    formData.append('files', archivo)
  })

  if (reemplazar) {
    formData.append('reemplazar', 'true')
  }

  if (esConfidencial.value && puedeCrearConfidencial.value) {
    formData.append('confidencial', 'true')
  }

  if (props.carpetaId !== null && props.carpetaId !== undefined && props.carpetaId !== '') {
    formData.append('carpeta_id', String(props.carpetaId))
  }

  const emailUsuario = user.value?.primaryEmailAddress?.emailAddress || 'usuario_desconocido'
  const rolHeader = user.value?.publicMetadata?.role || 'sin-rol'
  const seccionUsuario = user.value?.publicMetadata?.seccion || 'sin-seccion'

  let urlDestino = props.endpoint
  if (props.carpetaId !== null && props.carpetaId !== undefined && props.carpetaId !== '' && !urlDestino.includes('carpeta_id=')) {
    const separador = urlDestino.includes('?') ? '&' : '?'
    urlDestino = `${urlDestino}${separador}carpeta_id=${props.carpetaId}`
  }

  if (esConfidencial.value && puedeCrearConfidencial.value && !urlDestino.includes('confidencial=')) {
    const separador = urlDestino.includes('?') ? '&' : '?'
    urlDestino = `${urlDestino}${separador}confidencial=true`
  }

  try {
    await axios.post(urlDestino, formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        'user-email': emailUsuario,
        'user-role': rolHeader,
        'user-seccion': seccionUsuario
      }
    })
    
    emit('archivosSubidos')
    archivosSeleccionados.value = []
    esConfidencial.value = false
    if (inputArchivoRef.value) inputArchivoRef.value.value = ''
    mensajeResultado.value = 'Archivos subidos con éxito.'
    alert("Archivos subidos con éxito.")
    
  } catch (error) {
    console.error("Error en la subida:", error)
    if (error.response?.status === 409) {
      const msg = error.response.data?.error || 'Uno o más archivos ya existen en el servidor.'
      if (confirm(`${msg}\n\n¿Deseas reemplazar el archivo viejo por el nuevo? (Se borrará el anterior)`)) {
        await realizarSubida(true)
        return
      } else {
        mensajeResultado.value = 'Subida cancelada por el usuario (archivo existente no reemplazado).'
      }
    } else {
      const errorMsg = error.response?.data?.error || error.response?.data || error.message || 'Error en el servidor al procesar los archivos.'
      alert(`Error al subir archivo: ${errorMsg}`)
      mensajeResultado.value = `Error: ${errorMsg}`
    }
  } finally {
    subiendo.value = false
  }
}

const subirArchivos = async () => {
  if (archivosSeleccionados.value.length === 0) {
    mensajeResultado.value = 'Selecciona al menos un archivo primero.'
    return
  }

  // Verificar si alguno de los archivos ya existe
  const duplicados = archivosSeleccionados.value.filter(f => esDuplicado(f.name))
  let reemplazar = false

  if (duplicados.length > 0) {
    const listaTxt = duplicados.map(d => `• ${d.name}`).join('\n')
    const quiereReemplazar = confirm(
      `Los siguientes archivos ya existen en esta sección/carpeta:\n\n${listaTxt}\n\n¿Deseas reemplazarlos?\n(Si aceptas, se eliminará el archivo viejo y se cargará el nuevo).`
    )

    if (!quiereReemplazar) {
      mensajeResultado.value = 'Subida cancelada. No se modificó ningún archivo existente.'
      return
    }
    reemplazar = true
  }

  await realizarSubida(reemplazar)
}
</script>

<template>
  <div class="upload-box">
    <div class="upload-titulo-contenedor">
      <h3>Cargar Documentos/Imágenes (Subida Múltiple)</h3>
      <div v-if="props.carpetaNombre" class="destino-carpeta-aviso">
        📁 Ubicación actual: <strong>{{ props.carpetaNombre }}</strong> (los archivos se guardarán aquí)
      </div>
      <div v-else class="destino-carpeta-aviso raiz">
        🏠 Ubicación actual: <strong>Página Principal (Raíz de {{ props.seccion }})</strong>
      </div>
    </div>
    
    <input type="file" ref="inputArchivoRef" @change="manejarCambioDeArchivo" multiple :disabled="subiendo" />
    
    <!-- Casilla de Archivos Confidenciales (Solo Jefes y Controladores) -->
    <div v-if="puedeCrearConfidencial" class="opcion-confidencial-subida">
      <label class="checkbox-confidencial-label" title="Marcar para que los archivos subidos solo puedan ser vistos por Jefes y Controladores, independientemente de su área">
        <input type="checkbox" v-model="esConfidencial" :disabled="subiendo" />
        <span class="icono-candado">🔒</span>
        <span class="texto-confidencial"><strong>Archivos confidenciales</strong> (Solo visible para Jefes y Controladores)</span>
      </label>
    </div>

    <div v-if="archivosSeleccionados.length > 0" class="lista-pre-subida">
      <div class="pre-subida-header">
        <strong>📋 Archivos listos para subir ({{ archivosSeleccionados.length }}):</strong>
        <span class="pre-subida-pista">Puedes sacar archivos no deseados con la flecha ⬅️</span>
      </div>
      <ul class="pre-subida-items">
        <li v-for="(file, index) in archivosSeleccionados" :key="index" class="item-pre-subida">
          <div class="info-archivo-pre">
            <span class="icono-archivo-pre">📄</span>
            <span class="nombre-archivo-pre" :title="file.name">{{ file.name }}</span>
            <span class="tamano-archivo-pre">({{ formatearTamano(file.size) }})</span>
            <span v-if="esConfidencial" class="badge-confidencial-mini">
              🔒 Confidencial
            </span>
            <span v-if="esDuplicado(file.name)" class="badge-duplicado">
              ⚠️ Ya existe (se reemplazará)
            </span>
          </div>

          <!-- Flechita para sacar el archivo del loader antes de confirmar -->
          <button 
            type="button" 
            @click="quitarArchivo(index)" 
            class="btn-quitar-archivo" 
            :title="`Sacar '${file.name}' del loader (no se subirá)`"
            :disabled="subiendo"
          >
            ⬅️ Sacar
          </button>
        </li>
      </ul>
    </div>

    <button @click="subirArchivos" class="btn-subir" :disabled="subiendo || archivosSeleccionados.length === 0">
      {{ subiendo ? '⏳ Subiendo archivos...' : (props.carpetaNombre ? `Subir a "${props.carpetaNombre}"` : 'Subir al Servidor') }}
    </button>
    
    <p v-if="mensajeResultado" :class="['resultado-txt', { 'exito': mensajeResultado.includes('éxito') }]">
      {{ mensajeResultado }}
    </p>
  </div>
</template>

<style scoped>
.upload-box { padding: 20px; border: 2px dashed #cbd5e0; border-radius: 8px; text-align: center; background-color: #f7fafc; max-width: 650px; margin: 0 auto; }
.upload-titulo-contenedor h3 { margin: 0 0 6px 0; color: #2d3748; }
.destino-carpeta-aviso { font-size: 13px; color: #2b6cb0; background-color: #ebf8ff; border: 1px solid #bee3f8; padding: 4px 10px; border-radius: 5px; margin-bottom: 12px; display: inline-block; }
.destino-carpeta-aviso.raiz { color: #4a5568; background-color: #edf2f7; border-color: #e2e8f0; }

.opcion-confidencial-subida {
  margin: 12px 0 6px 0;
  display: flex;
  justify-content: center;
}

.checkbox-confidencial-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #faf5ff;
  border: 1px solid #d6bcfa;
  color: #6b46c1;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.checkbox-confidencial-label:hover {
  background: #f3e8ff;
  border-color: #b794f4;
}

.checkbox-confidencial-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #6b46c1;
}

.badge-confidencial-mini {
  background-color: #faf5ff;
  color: #6b46c1;
  border: 1px solid #d6bcfa;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 5px;
  flex-shrink: 0;
}

.lista-pre-subida { text-align: left; background: #ffffff; padding: 12px; border-radius: 6px; margin-top: 14px; border: 1px solid #e2e8f0; font-size: 13px; max-height: 180px; overflow-y: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.pre-subida-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #edf2f7; flex-wrap: wrap; gap: 6px; }
.pre-subida-pista { color: #718096; font-size: 11px; }
.pre-subida-items { margin: 0; padding: 0; list-style-type: none; display: flex; flex-direction: column; gap: 6px; }

.item-pre-subida { display: flex; justify-content: space-between; align-items: center; background: #f7fafc; padding: 6px 10px; border-radius: 5px; border: 1px solid #edf2f7; gap: 10px; transition: background 0.2s; }
.item-pre-subida:hover { background: #edf2f7; }
.info-archivo-pre { display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.icono-archivo-pre { font-size: 14px; }
.nombre-archivo-pre { font-weight: 500; color: #2d3748; overflow: hidden; text-overflow: ellipsis; }
.tamano-archivo-pre { font-size: 11px; color: #a0aec0; margin-left: 2px; }

.btn-quitar-archivo { background-color: #fed7d7; color: #c53030; border: 1px solid #feb2b2; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
.btn-quitar-archivo:hover:not(:disabled) { background-color: #feb2b2; color: #9b2c2c; transform: scale(1.02); }
.btn-quitar-archivo:disabled { opacity: 0.6; cursor: not-allowed; }

.badge-duplicado { background: #feebc8; color: #c05621; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: bold; flex-shrink: 0; }

.btn-subir { background-color: #2b6cb0; color: white; border: none; padding: 9px 18px; border-radius: 6px; cursor: pointer; margin-top: 14px; font-weight: 600; display: block; margin-left: auto; margin-right: auto; transition: background 0.2s; font-size: 14px; }
.btn-subir:hover:not(:disabled) { background-color: #2c5282; }
.btn-subir:disabled { background-color: #a0aec0; cursor: not-allowed; }

.resultado-txt { margin-top: 10px; font-size: 14px; color: #e53e3e; font-weight: 500; }
.resultado-txt.exito { color: #38a169; }
</style>