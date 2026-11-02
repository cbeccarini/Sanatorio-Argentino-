<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useUser } from '@clerk/vue'
import SubirArchivo from '@/components/SubirArchivo.vue'
import axios from 'axios'
import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import iconoNotificacion from '@/assets/notificacion.png'
import iconoNotificacionActiva from '@/assets/notificacion_activa.png'

const props = defineProps({
  seccion: { type: String, required: true, default: 'farmacia' },
  titulo: { type: String, required: true, default: 'ÁREA DE FARMACIA' }
})

// --- USUARIO DE CLERK ---
const { user } = useUser()

const emailUsuario = computed(() => {
  return user.value?.primaryEmailAddress?.emailAddress || ''
})

const rolActual = computed(() => user.value?.publicMetadata?.role || 'sin-rol')
const seccionUsuario = computed(() => user.value?.publicMetadata?.seccion || 'sin-seccion')
const esJefe = computed(() => rolActual.value.toLowerCase() === 'jefe')
const esControlador = computed(() => rolActual.value.toLowerCase() === 'controlador')
const esJefeOControlador = computed(() => ['jefe', 'controlador', 'presidente', 'coordinacion'].includes(rolActual.value.toLowerCase()))

const esNuevaCarpetaProtegida = ref(false)
const esNuevaCarpetaConfidencial = ref(false)

// --- CONFIGURACIÓN DE APIS ---
const API_URL_ARCHIVOS = 'http://localhost:3000/api'
const API_URL_CARPETAS = 'http://localhost:5000/api'

// --- ESTADOS: ARCHIVOS Y BÚSQUEDA ---
const listaArchivos = ref([])
const textoBusqueda = ref('')
const hayNotificacion = ref(false)
const cantidadPendientes = ref(0)
const archivosNotificacion = ref([])
const mostrarPopoverNotificaciones = ref(false)

// --- ESTADOS: CARPETAS Y NAVEGACIÓN JERÁRQUICA (SUBCARPETAS) ---
const misCarpetas = ref([])
const carpetasCompartidas = ref([])
const nombreNuevaCarpeta = ref('')
const modalCompartirVisible = ref(false)
const carpetaSeleccionada = ref(null)
const emailDestinoCompartir = ref('')

// Pila de carpetas navegadas (ruta jerárquica: [] = raíz, [c1] = nivel 1, [c1, c2] = subcarpeta, etc.)
const rutaCarpetas = ref([])

// Carpeta activa actual (null = raíz)
const carpetaActual = computed(() => {
  if (rutaCarpetas.value.length === 0) return null
  return rutaCarpetas.value[rutaCarpetas.value.length - 1]
})

// --- NAVEGACIÓN ENTRE CARPETAS Y SUBCARPETAS ---
const entrarACarpeta = (carpeta) => {
  if (carpetaActual.value && Number(carpetaActual.value.id) === Number(carpeta.id)) return
  rutaCarpetas.value.push(carpeta)
}

const irANivel = (indice) => {
  if (indice < 0) {
    volverARaiz()
  } else {
    rutaCarpetas.value = rutaCarpetas.value.slice(0, indice + 1)
  }
}

const volverUnNivel = () => {
  if (rutaCarpetas.value.length > 0) {
    rutaCarpetas.value.pop()
  }
}

const volverARaiz = () => {
  rutaCarpetas.value = []
}

// --- PERMISOS DE ARCHIVOS ---
const puedeSubirArchivo = computed(() => {
  const rol = rolActual.value.toLowerCase()
  const secUser = seccionUsuario.value.toLowerCase()
  const secVista = props.seccion.toLowerCase()

  const rolesSuperusuarios = ['coordinacion', 'controlador', 'presidente']
  if (rolesSuperusuarios.includes(rol)) {
    return true
  }

  return secUser === secVista
})

const esAutorizadoParaComentar = computed(() => {
  const rol = rolActual.value.toLowerCase()
  const secUser = seccionUsuario.value.toLowerCase()
  const seccionVista = props.seccion.toLowerCase()

  if (['presidente', 'controlador'].includes(rol)) {
    return true
  }

  if (rol === 'jefe' && secUser === seccionVista) {
    return true
  }

  return false
})

// --- FILTRADO DINÁMICO (BÚSQUEDA + DIRECTORIO / SUBCARPETAS) ---
const carpetasVisibles = computed(() => {
  let lista = misCarpetas.value
  // Las carpetas confidenciales solo son visibles para Jefes y Controladores
  if (!esJefeOControlador.value) {
    lista = lista.filter(c => !c.confidencial)
  }
  if (carpetaActual.value === null) {
    // En la raíz: solo carpetas que no tienen padre_id
    return lista.filter(c => !c.padre_id)
  }
  // Dentro de una carpeta: subcarpetas cuyo padre_id coincide con la carpeta actual
  return lista.filter(c => Number(c.padre_id) === Number(carpetaActual.value.id))
})

const carpetasFiltradas = computed(() => {
  let resultado = carpetasVisibles.value
  if (textoBusqueda.value.trim()) {
    resultado = resultado.filter(carpeta =>
      carpeta.nombre.toLowerCase().includes(textoBusqueda.value.toLowerCase().trim())
    )
  }
  return resultado
})

const carpetasCompartidasFiltradas = computed(() => {
  let lista = carpetasCompartidas.value
  if (!esJefeOControlador.value) {
    lista = lista.filter(c => !c.confidencial)
  }
  let resultado = []
  if (carpetaActual.value === null) {
    resultado = lista.filter(c => !c.padre_id)
  } else {
    resultado = lista.filter(c => Number(c.padre_id) === Number(carpetaActual.value.id))
  }

  if (textoBusqueda.value.trim()) {
    resultado = resultado.filter(carpeta =>
      carpeta.nombre.toLowerCase().includes(textoBusqueda.value.toLowerCase().trim())
    )
  }
  return resultado
})

const archivosFiltrados = computed(() => {
  let base = listaArchivos.value
  // Los archivos confidenciales solo son visibles para Jefes y Controladores
  if (!esJefeOControlador.value) {
    base = base.filter(arc => !arc.confidencial)
  }
  let filtrados = base.filter(arc => {
    if (carpetaActual.value) {
      return Number(arc.carpeta_id) === Number(carpetaActual.value.id)
    }
    return arc.carpeta_id === null || arc.carpeta_id === undefined || arc.carpeta_id === 0 || arc.carpeta_id === 'null'
  })

  if (textoBusqueda.value.trim()) {
    filtrados = filtrados.filter(arc =>
      arc.nombre.toLowerCase().includes(textoBusqueda.value.toLowerCase().trim())
    )
  }

  return filtrados
})

// --- PERMISOS Y LÓGICA DE CARPETAS ---
const puedeCrearCarpeta = computed(() => {
  const rol = rolActual.value.toLowerCase()
  const secUser = seccionUsuario.value.toLowerCase()
  const secVista = props.seccion.toLowerCase()

  if (['controlador', 'presidente', 'coordinacion'].includes(rol)) {
    return true
  }

  return secUser === secVista
})

// Los empleados no pueden borrar supercarpetas; solo el controlador puede borrarlas
const puedeEliminarCarpeta = (carpeta) => {
  if (carpeta.protegida && rolActual.value.toLowerCase() !== 'controlador') {
    return false
  }
  return puedeCrearCarpeta.value
}

// Los empleados no pueden cambiar el nombre a las supercarpetas; solo el controlador puede renombrarlas
const puedeRenombrarCarpeta = (carpeta) => {
  if (carpeta.protegida && rolActual.value.toLowerCase() !== 'controlador') {
    return false
  }
  return puedeCrearCarpeta.value
}

const obtenerCarpetas = async () => {
  if (!emailUsuario.value) return
  try {
    const res = await axios.get(`${API_URL_CARPETAS}/carpetas/${props.seccion.toLowerCase()}`, {
      headers: { 
        'User-Email': emailUsuario.value.toLowerCase(),
        'User-Role': rolActual.value.toLowerCase()
      }
    })
    misCarpetas.value = res.data.mis_carpetas || []
    carpetasCompartidas.value = res.data.compartidas_conmigo || []
  } catch (error) {
    console.error('Error al obtener carpetas:', error)
  }
}

// ==========================================
// --- GESTIÓN DE CARPETAS Y NAVEGACIÓN ---
// ==========================================
const crearCarpeta = async (reemplazarForzado = false) => {
  const nombreLimpio = nombreNuevaCarpeta.value ? nombreNuevaCarpeta.value.trim() : '';
  if (!nombreLimpio) {
    alert("Por favor, escribe un nombre para la carpeta.");
    return;
  }

  const padreId = carpetaActual.value ? carpetaActual.value.id : null;
  const tipoTexto = padreId ? 'subcarpeta' : 'carpeta';

  // Verificar si ya existe una carpeta/subcarpeta con el mismo nombre en este nivel
  const existentesNivel = misCarpetas.value.filter(c => {
    if (padreId) return Number(c.padre_id) === Number(padreId);
    return !c.padre_id;
  });

  const carpetaExistente = existentesNivel.find(c => c.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase());
  let reemplazar = reemplazarForzado;

  if (carpetaExistente?.protegida && rolActual.value.toLowerCase() !== 'controlador') {
    alert('Solo el controlador puede reemplazar esta carpeta fija.')
    return
  }

  if (carpetaExistente && !reemplazar) {
    const quiereReemplazar = confirm(
      `Ya existe una ${tipoTexto} llamada "${nombreLimpio}" en esta ubicación.\n\n¿Deseas reemplazarla?\n(Si aceptas, se eliminará la carpeta anterior con todos los archivos y subcarpetas que contenía y se creará la nueva vacía).`
    );
    if (!quiereReemplazar) {
      return;
    }
    reemplazar = true;
  }

  try {
    await axios.post(`${API_URL_CARPETAS}/carpetas`, {
      nombre: nombreLimpio,
      seccion: props.seccion.toLowerCase(),
      reemplazar: reemplazar,
      padre_id: padreId,
      protegida: esControlador.value && esNuevaCarpetaProtegida.value,
      confidencial: esJefeOControlador.value && esNuevaCarpetaConfidencial.value
    }, {
      headers: {
        'user-email': emailUsuario.value ? emailUsuario.value.toLowerCase() : '', 
        'user-role': rolActual.value ? rolActual.value.toLowerCase() : '',
        'user-seccion': seccionUsuario.value ? seccionUsuario.value.toLowerCase() : ''
      }
    });

    nombreNuevaCarpeta.value = '';
    esNuevaCarpetaProtegida.value = false;
    esNuevaCarpetaConfidencial.value = false;
    await obtenerCarpetas();
    await cargarArchivos();
    await cargarHistorial();

  } catch (error) {
    console.error("❌ Error capturado al crear carpeta:", error);
    if (error.response?.status === 409) {
      const msg = error.response.data?.error || `Ya existe una ${tipoTexto} con este nombre.`;
      if (confirm(`${msg}\n\n¿Deseas reemplazarla por una nueva vacía?`)) {
        await crearCarpeta(true);
        return;
      }
    }
    alert("Error del servidor: " + (error.response?.data?.error || error.message));
  }
};

const eliminarCarpeta = async (carpeta) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar la carpeta "${carpeta.nombre}"?\n\nEsta acción eliminará permanentemente la carpeta, todas sus subcarpetas y TODOS los archivos contenidos en ellas.`)) {
    return
  }

  try {
    await axios.delete(`${API_URL_CARPETAS}/carpetas/${carpeta.id}`, {
      headers: {
        'User-Email': emailUsuario.value ? emailUsuario.value.toLowerCase() : '',
        'User-Role': rolActual.value ? rolActual.value.toLowerCase() : ''
      }
    })

    // Si estamos dentro de la carpeta eliminada o una descendiente, retroceder en la ruta
    const idxEnRuta = rutaCarpetas.value.findIndex(c => Number(c.id) === Number(carpeta.id))
    if (idxEnRuta !== -1) {
      if (idxEnRuta === 0) {
        volverARaiz()
      } else {
        irANivel(idxEnRuta - 1)
      }
    }

    await obtenerCarpetas()
    await cargarArchivos() 
    await cargarHistorial()
  } catch (error) {
    alert(error.response?.data?.error || 'Error al intentar eliminar la carpeta')
  }
}

const descargarCarpeta = (carpetaId, nombreCarpeta) => {
  window.open(`${API_URL_CARPETAS}/carpetas/${carpetaId}/descargar`, '_blank')
}

const renombrarCarpeta = async (carpeta) => {
  const nuevoNombre = prompt('Ingresa el nuevo nombre para la carpeta:', carpeta.nombre)
  if (!nuevoNombre || !nuevoNombre.trim()) return

  try {
    await axios.put(`${API_URL_CARPETAS}/carpetas/${carpeta.id}/renombrar`, 
      { nombre: nuevoNombre.trim() },
      { headers: {
        'User-Email': emailUsuario.value.toLowerCase(),
        'User-Role': rolActual.value.toLowerCase(),
        'User-Seccion': seccionUsuario.value.toLowerCase()
      } }
    )
    await obtenerCarpetas()
    if (carpetaActual.value && Number(carpetaActual.value.id) === Number(carpeta.id)) {
      carpetaActual.value.nombre = nuevoNombre.trim()
    }
  } catch (error) {
    alert(error.response?.data?.error || 'Error al cambiar el nombre de la carpeta')
  }
}

const abrirModalCompartir = (carpeta) => {
  carpetaSeleccionada.value = carpeta
  emailDestinoCompartir.value = ''
  modalCompartirVisible.value = true
}

const enviarCompartir = async () => {
  if (!emailDestinoCompartir.value.trim()) {
    alert('Ingresa un correo electrónico válido.')
    return
  }

  try {
    await axios.post(`${API_URL_CARPETAS}/carpetas/${carpetaSeleccionada.value.id}/compartir`, 
      { email_destino: emailDestinoCompartir.value.trim().toLowerCase() },
      { headers: {
        'User-Email': emailUsuario.value.toLowerCase(),
        'User-Role': rolActual.value.toLowerCase(),
        'User-Seccion': seccionUsuario.value.toLowerCase()
      } }
    )
    alert(`Carpeta compartida con éxito a ${emailDestinoCompartir.value}`)
    modalCompartirVisible.value = false
  } catch (error) {
    alert(error.response?.data?.error || 'Error al compartir la carpeta')
  }
}

// ===================================================
// --- LÓGICA DE MOVIMIENTO DE ARCHIVOS (SACAR / DRAG) ---
// ===================================================
const idArchivoArrastrado = ref(null)

const iniciarArrastre = (event, archivoId) => {
  idArchivoArrastrado.value = archivoId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', archivoId)
}

const soltarEnCarpeta = async (event, carpetaDestino) => {
  if (!idArchivoArrastrado.value) return
  
  const archivoId = idArchivoArrastrado.value
  idArchivoArrastrado.value = null 

  if (carpetaActual.value && Number(carpetaActual.value.id) === Number(carpetaDestino.id)) {
    return
  }

  try {
    await axios.put(`${API_URL_CARPETAS}/carpetas/mover-archivo`, {
      archivo_id: Number(archivoId),
      carpeta_id: Number(carpetaDestino.id)
    }, {
      headers: {
        'User-Email': emailUsuario.value ? emailUsuario.value.toLowerCase() : '',
        'User-Role': rolActual.value ? rolActual.value.toLowerCase() : '',
        'User-Seccion': seccionUsuario.value ? seccionUsuario.value.toLowerCase() : ''
      }
    })

    listaArchivos.value = listaArchivos.value.filter(a => a.id !== Number(archivoId))
    await cargarArchivos()
    await cargarHistorial()
    
  } catch (error) {
    console.error("❌ Error al mover el archivo:", error)
    const mensajeError = error.response?.data?.error || 'No se pudo procesar el movimiento del archivo.';
    alert("Error del sistema: " + mensajeError)
  }
}

// Sacar un archivo de la carpeta y devolverlo a la raíz (página principal del área)
const sacarArchivoARaiz = async (archivo) => {
  if (!confirm(`¿Deseas sacar "${archivo.nombre}" de la carpeta actual y regresarlo a la página principal del área?`)) {
    return
  }

  try {
    await axios.put(`${API_URL_CARPETAS}/carpetas/mover-archivo`, {
      archivo_id: Number(archivo.id),
      carpeta_id: null
    }, {
      headers: {
        'User-Email': emailUsuario.value ? emailUsuario.value.toLowerCase() : '',
        'User-Role': rolActual.value ? rolActual.value.toLowerCase() : ''
      }
    })

    await cargarArchivos()
    await cargarHistorial()
    alert(`El archivo "${archivo.nombre}" fue trasladado a la página principal con éxito.`)
  } catch (error) {
    console.error("❌ Error al sacar archivo de la carpeta:", error)
    alert("Error al mover el archivo a la página principal: " + (error.response?.data?.error || error.message))
  }
}

const soltarEnRaiz = async (event) => {
  if (!idArchivoArrastrado.value) return
  const archivoId = idArchivoArrastrado.value
  idArchivoArrastrado.value = null

  try {
    await axios.put(`${API_URL_CARPETAS}/carpetas/mover-archivo`, {
      archivo_id: Number(archivoId),
      carpeta_id: null
    }, {
      headers: {
        'User-Email': emailUsuario.value ? emailUsuario.value.toLowerCase() : '',
        'User-Role': rolActual.value ? rolActual.value.toLowerCase() : ''
      }
    })

    await cargarArchivos()
    await cargarHistorial()
  } catch (error) {
    console.error("❌ Error al mover archivo a la raíz:", error)
    alert("Error al mover el archivo a la raíz: " + (error.response?.data?.error || error.message))
  }
}

// ===================================================
// --- LÓGICA DE NOTIFICACIONES ---
// ===================================================
const consultarNotificaciones = async () => {
  if (!esJefe.value || !props.seccion) return

  try {
    const res = await axios.get(`${API_URL_ARCHIVOS}/notificaciones/${props.seccion.toLowerCase()}`)
    hayNotificacion.value = res.data.activas
    cantidadPendientes.value = res.data.quantity || 0
    archivosNotificacion.value = res.data.archivos || []
  } catch (err) {
    console.error("Error al consultar notificaciones:", err)
  }
}

const togglePopoverNotificaciones = () => {
  mostrarPopoverNotificaciones.value = !mostrarPopoverNotificaciones.value
}

const abrirDesdeNotificacion = (archivo) => {
  mostrarPopoverNotificaciones.value = false
  abrirVistaPrevia(archivo)
}

const marcarTodasLeidas = async () => {
  try {
    await axios.post(`${API_URL_ARCHIVOS}/notificaciones/marcar-leidas`, {
      seccion: props.seccion.toLowerCase()
    })
    hayNotificacion.value = false
    cantidadPendientes.value = 0
    archivosNotificacion.value = []
    mostrarPopoverNotificaciones.value = false
  } catch (err) {
    console.error("Error al limpiar notificaciones:", err)
  }
}

// --- ESTADOS DE MODAL Y VISTA PREVIA ---
const mostrarModal = ref(false)
const mostrarNotas = ref(false) 
const idArchivoActual = ref(null)
const urlArchivoPrevia = ref('')
const nombreArchivoPrevia = ref('')
const esImagen = ref(false)
const esHtml = ref(false)
const contenidoHtmlPrevia = ref('')

// --- COMENTARIOS Y SUBRAYADO ---
const listaComentarios = ref([])
const nuevoComentario = ref('')
const contenedorDocumento = ref(null)

const dibujando = ref(false)
const inicioX = ref(0)
const inicioY = ref(0)
const recuadroTemporal = ref(null)

// --- CARGAR ARCHIVOS ---
const cargarArchivos = async () => {
  try {
    const response = await axios.get(`${API_URL_ARCHIVOS}/archivos/${props.seccion.toLowerCase()}`, {
      headers: {
        'User-Role': rolActual.value ? rolActual.value.toLowerCase() : '',
        'User-Email': emailUsuario.value ? emailUsuario.value.toLowerCase() : '',
        'User-Seccion': seccionUsuario.value ? seccionUsuario.value.toLowerCase() : ''
      }
    })
    listaArchivos.value = response.data 
  } catch (error) {
    console.error("Error al conectar con el servidor backend de archivos.")
  }
}

const agregarArchivosAInterfaz = () => { 
  cargarArchivos()
  consultarNotificaciones()
  cargarHistorial()
}

// --- COMENTARIOS Y VISUALIZADOR ---
const cargarComentarios = async (archivoId) => {
  try {
    const response = await axios.get(`${API_URL_ARCHIVOS}/archivos/${archivoId}/comentarios`, {
      params: { seccion: props.seccion.toLowerCase() }
    })
    listaComentarios.value = response.data
  } catch (error) {
    console.error("Error al cargar comentarios", error)
  }
}

const iniciarSubrayado = (event) => {
  if (!esAutorizadoParaComentar.value) return
  
  dibujando.value = true
  const rect = contenedorDocumento.value.getBoundingClientRect()
  
  inicioX.value = ((event.clientX - rect.left) / rect.width) * 100
  inicioY.value = ((event.clientY - rect.top) / rect.height) * 100

  recuadroTemporal.value = { x: inicioX.value, y: inicioY.value, w: 0, h: 0 }
}

const moverSubrayado = (event) => {
  if (!dibujando.value || !recuadroTemporal.value) return

  const rect = contenedorDocumento.value.getBoundingClientRect()
  const actualX = ((event.clientX - rect.left) / rect.width) * 100
  const actualY = ((event.clientY - rect.top) / rect.height) * 100

  recuadroTemporal.value.x = Math.min(inicioX.value, actualX)
  recuadroTemporal.value.y = Math.min(inicioY.value, actualY)
  recuadroTemporal.value.w = Math.abs(actualX - inicioX.value)
  recuadroTemporal.value.h = Math.abs(actualY - inicioY.value)
}

const finalizarSubrayado = () => {
  if (!dibujando.value) return
  dibujando.value = false
  
  if (recuadroTemporal.value && (recuadroTemporal.value.w < 1 || recuadroTemporal.value.h < 1)) {
    recuadroTemporal.value = null
    return
  }
  mostrarNotas.value = true 
}

const abrirVistaPrevia = async (archivo) => {
  idArchivoActual.value = archivo.id
  await cargarComentarios(archivo.id)

  nombreArchivoPrevia.value = archivo.nombre
  urlArchivoPrevia.value = archivo.url

  const nombreMinuscula = archivo.nombre.trim().toLowerCase()

  if (['.png', '.jpg', '.jpeg', '.gif'].some(ext => nombreMinuscula.endsWith(ext))) {
    esHtml.value = false
    esImagen.value = true
    mostrarModal.value = true
    return
  }

  if (nombreMinuscula.endsWith('.docx') || nombreMinuscula.endsWith('.xlsx') || nombreMinuscula.endsWith('.xls')) {
    try {
      const response = await fetch(archivo.url)
      if (response.ok) {
        const buffer = await response.arrayBuffer()
        
        if (nombreMinuscula.endsWith('.docx')) {
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          contenidoHtmlPrevia.value = result.value
        } else {
          const wb = XLSX.read(buffer, { type: 'array' })
          contenidoHtmlPrevia.value = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]])
        }

        esHtml.value = true
        esImagen.value = false
        mostrarModal.value = true
        return
      }
    } catch (err) {
      console.log('Cargando en visor estándar...')
    }
  }

  esHtml.value = false
  esImagen.value = false
  mostrarModal.value = true
}

const cerrarVistaPrevia = () => {
  mostrarModal.value = false
  mostrarNotas.value = false
  contenidoHtmlPrevia.value = ''
  urlArchivoPrevia.value = '' 
  nombreArchivoPrevia.value = ''
  esImagen.value = false
  esHtml.value = false
  listaComentarios.value = []
  idArchivoActual.value = null
  recuadroTemporal.value = null
}

const agregarComentario = async () => {
  if (!nuevoComentario.value.trim()) return

  try {
    const response = await axios.post(`${API_URL_ARCHIVOS}/archivos/comentar`, {
      archivo_id: idArchivoActual.value,
      usuario_email: emailUsuario.value.toLowerCase(),
      seccion: props.seccion.toLowerCase(),
      comentario: nuevoComentario.value,
      coord_x: recuadroTemporal.value ? Math.round(recuadroTemporal.value.x * 100) / 100 : null,
      coord_y: recuadroTemporal.value ? Math.round(recuadroTemporal.value.y * 100) / 100 : null,
      coord_w: recuadroTemporal.value ? Math.round(recuadroTemporal.value.w * 100) / 100 : null,
      coord_h: recuadroTemporal.value ? Math.round(recuadroTemporal.value.h * 100) / 100 : null
    }, {
      headers: {
        'user-role': rolActual.value.toLowerCase(),
        'user-seccion': seccionUsuario.value.toLowerCase(),
        'seccion-vista': props.seccion.toLowerCase(),
        'user-email': emailUsuario.value.toLowerCase()
      }
    })

    listaComentarios.value.push(response.data)
    nuevoComentario.value = ''
    recuadroTemporal.value = null
    mostrarNotas.value = true 

  } catch (error) {
    const errorMsg = error.response?.data?.error || error.response?.data || 'Hubo un error al publicar el comentario.'
    alert(errorMsg)
  }
}

const eliminarComentario = async (comentarioId) => {
  try {
    await axios.delete(`${API_URL_ARCHIVOS}/comentarios/eliminar/${comentarioId}`, {
      headers: {
        'user-role': rolActual.value.toLowerCase(),
        'user-seccion': seccionUsuario.value.toLowerCase(),
        'user-email': emailUsuario.value.toLowerCase()
      }
    })
    listaComentarios.value = listaComentarios.value.filter(c => c.id !== comentarioId)
  } catch (error) {
    alert(error.response?.data?.error || error.response?.data || 'No se pudo eliminar la nota.')
  }
}

const eliminarArchivo = async (archivo) => {
  if (!confirm(`¿Estás seguro de eliminar "${archivo.nombre}"?`)) return
  try {
    await axios.delete(`${API_URL_ARCHIVOS}/archivos/eliminar/${archivo.id}`, {
      headers: {
        'user-role': rolActual.value ? rolActual.value.toLowerCase() : '',
        'user-seccion': seccionUsuario.value ? seccionUsuario.value.toLowerCase() : '',
        'user-email': emailUsuario.value ? emailUsuario.value.toLowerCase() : ''
      }
    })
    listaArchivos.value = listaArchivos.value.filter(item => item.id !== archivo.id)
    await cargarHistorial()
  } catch (error) {
    alert(error.response?.data?.error || error.response?.data || 'Error al intentar borrar el archivo.')
  }
}

// ==========================================
// --- HISTORIAL DE CAMBIOS Y AUDITORÍA ---
// ==========================================
const listaHistorial = ref([])
const cargandoHistorial = ref(false)
const mostrarModalHistorial = ref(false)
const filtroAccionHistorial = ref('TODOS')
const busquedaHistorial = ref('')

const cargarHistorial = async () => {
  if (!props.seccion) return
  cargandoHistorial.value = true
  try {
    const res = await axios.get(`${API_URL_ARCHIVOS}/historial/${props.seccion.toLowerCase()}`)
    listaHistorial.value = res.data || []
  } catch (err) {
    console.error('Error al cargar historial de cambios:', err)
  } finally {
    cargandoHistorial.value = false
  }
}

const abrirHistorial = async () => {
  mostrarModalHistorial.value = true
  await cargarHistorial()
}

const cerrarHistorial = () => {
  mostrarModalHistorial.value = false
  busquedaHistorial.value = ''
  filtroAccionHistorial.value = 'TODOS'
}

const historialFiltrado = computed(() => {
  let items = listaHistorial.value

  if (filtroAccionHistorial.value !== 'TODOS') {
    items = items.filter(h => (h.accion || '').toUpperCase() === filtroAccionHistorial.value)
  }

  if (busquedaHistorial.value.trim()) {
    const q = busquedaHistorial.value.trim().toLowerCase()
    items = items.filter(h => 
      (h.archivo_nombre || '').toLowerCase().includes(q) ||
      (h.usuario_email || '').toLowerCase().includes(q) ||
      (h.usuario_rol || '').toLowerCase().includes(q) ||
      (h.detalles || '').toLowerCase().includes(q)
    )
  }

  return items
})

const totalSubidas = computed(() => listaHistorial.value.filter(h => h.accion === 'SUBIDA').length)
const totalEliminaciones = computed(() => listaHistorial.value.filter(h => h.accion === 'ELIMINACION').length)
const totalReemplazos = computed(() => listaHistorial.value.filter(h => h.accion === 'REEMPLAZO').length)

const formatearFechaHora = (fechaRaw) => {
  if (!fechaRaw) return '-'
  try {
    const d = new Date(fechaRaw)
    return d.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (e) {
    return String(fechaRaw)
  }
}

// --- CICLO DE VIDA Y OBSERVADORES ---
onMounted(() => {
  cargarArchivos()
  cargarHistorial()
  if (emailUsuario.value) {
    obtenerCarpetas()
  }
  consultarNotificaciones()
  setInterval(consultarNotificaciones, 15000)
})

watch([emailUsuario, esJefe], ([nuevoEmail, esJefeVal]) => {
  if (nuevoEmail) {
    obtenerCarpetas()
  }
  if (esJefeVal) {
    consultarNotificaciones()
  }
})

watch(() => props.seccion, () => { 
  volverARaiz() 
  cargarArchivos()
  obtenerCarpetas()
  consultarNotificaciones()
  cargarHistorial()
})
</script>

<template>
  <div class="seccion-container">
    <!-- HEADER Y NOTIFICACIONES -->
<div class="contenedor-header-usuario" style="position: relative;">
  <div style="display: flex; align-items: center; gap: 20px;">
    
    <div v-if="esJefe" class="campana-wrapper" style="position: relative; cursor: pointer;" @click="togglePopoverNotificaciones" title="Notificaciones de sección">
      <img 
        :src="hayNotificacion ? iconoNotificacionActiva : iconoNotificacion" 
        alt="Campana de Notificación" 
        class="icono-campana" 
        :class="{ 'efecto-pulso': hayNotificacion }"
      />
      <span v-if="hayNotificacion" class="badge-notificacion">
        {{ cantidadPendientes }}
      </span>

      <!-- MINI PANEL DESPLEGABLE (POPOVER) -->
      <div v-if="mostrarPopoverNotificaciones" class="popover-notificaciones" @click.stop>
        <div class="popover-header">
          🔔 Archivos Recientes No Revisados
          <button @click="mostrarPopoverNotificaciones = false" class="btn-cerrar-popover">✕</button>
        </div>

        <div class="popover-body">
          <div v-if="archivosNotificacion.length === 0" class="sin-notificaciones-texto">
            🎉 ¡No hay archivos pendientes de revisar!
          </div>

          <div 
            v-for="arc in archivosNotificacion" 
            :key="'notif-' + arc.id" 
            class="item-notificacion"
            @click="abrirDesdeNotificacion(arc)"
          >
            <span class="icono-file">📄</span>
            <div class="info-archivo-notif">
              <strong class="nombre-notif">{{ arc.nombre }}</strong>
              <small class="subtexto-notif">Haz clic para revisar</small>
            </div>
          </div>
        </div>

        <div v-if="archivosNotificacion.length > 0" class="popover-footer">
          <button @click="marcarTodasLeidas" class="btn-marcar-leido">
            ✓ Marcar todos como leídos
          </button>
        </div>
      </div>
      <!-- FIN MINI PANEL -->

    </div>

  </div>
</div>
    <div class="panel-header-directorio" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
      <div>
        <h2>Panel - {{ props.titulo }}</h2>
        
        <!-- BREADCRUMBS / RUTA JERÁRQUICA DE CARPETAS -->
        <div class="ruta-navegacion" style="display: flex; align-items: center; gap: 8px; margin-top: 5px; font-size: 15px; color: #718096; flex-wrap: wrap;">
          <span 
            @click="volverARaiz" 
            @dragover.prevent
            @drop="soltarEnRaiz($event)"
            class="migaja-link"
            :class="{ 'migaja-activa': carpetaActual === null }"
            title="Página principal del área / Arrastra un archivo aquí para moverlo a la raíz"
          >
            📁 Raíz ({{ props.seccion }})
          </span>
          <template v-for="(c, idx) in rutaCarpetas" :key="c.id">
            <span class="migaja-sep"> ➡️ </span>
            <span 
              @click="irANivel(idx)" 
              @dragover.prevent
              @drop="soltarEnCarpeta($event, c)"
              class="migaja-link"
              :class="{ 'migaja-activa': idx === rutaCarpetas.length - 1 }"
              :title="`Nivel: ${c.nombre} (Arrastra un archivo aquí)`"
            >
              📂 <strong>{{ c.nombre }}</strong>
            </span>
          </template>
        </div>
      </div>

      <button @click="abrirHistorial" class="btn-abrir-historial">
        📜 Historial de Cambios ({{ props.titulo }})
      </button>
    </div>
    
    <!-- LOADER DE ARCHIVOS (SUBIDA DIRECTA A LA CARPETA ACTUAL) -->
    <div v-if="puedeSubirArchivo" class="modulo-subida">
      <SubirArchivo 
        :key="carpetaActual ? ('carpeta-' + carpetaActual.id) : 'raiz'"
        :endpoint="carpetaActual 
          ? `${API_URL_ARCHIVOS}/${props.seccion}/subir?carpeta_id=${carpetaActual.id}` 
          : `${API_URL_ARCHIVOS}/${props.seccion}/subir`" 
        :carpeta-id="carpetaActual ? carpetaActual.id : null"
        :carpeta-nombre="carpetaActual ? carpetaActual.nombre : ''"
        :seccion="props.seccion" 
        :archivos-existentes="archivosFiltrados"
        @archivosSubidos="agregarArchivosAInterfaz" 
      />
    </div>
    <div v-else class="aviso-lectura">
      ⚠️ Tienes acceso de <strong>Solo Lectura</strong> en esta sección. No puedes cargar archivos aquí.
    </div>

    <div class="contenedor-busqueda-unificada">
      <input
        v-model="textoBusqueda"
        type="text"
        class="input-busqueda-clinica"
        placeholder="🔍 Escribe para buscar carpetas o archivos por nombre..."/>
    </div>

    <!-- GESTOR DE CARPETAS Y SUBCARPETAS -->
    <div class="modulo-carpetas" style="margin-top: 20px; margin-bottom: 25px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <h3>
          📁 Gestor de Carpetas {{ carpetaActual ? `(Dentro de "${carpetaActual.nombre}")` : `(Área: ${props.seccion})` }}
        </h3>
        <div v-if="carpetaActual !== null" style="display: flex; gap: 8px;">
          <button @click="volverUnNivel" class="btn-revisar" style="background-color:#4a5568;" title="Subir un nivel">
            ⬅ Subir un nivel
          </button>
          <button @click="volverARaiz" class="btn-revisar" style="background-color:#2d3748;" title="Volver a la página principal">
            🏠 Volver a Raíz
          </button>
        </div>
      </div>
      
      <!-- CAJA CREAR CARPETA O SUBCARPETA -->
      <div style="margin-top: 10px;">
        <div v-if="puedeCrearCarpeta" class="contenedor-creacion-carpeta">
          <div class="caja-crear-carpeta">
            <input 
              v-model="nombreNuevaCarpeta" 
              type="text" 
              :placeholder="carpetaActual ? `Nombre de la subcarpeta dentro de '${carpetaActual.nombre}'...` : 'Nombre de la nueva carpeta...'"
              class="input-busqueda-clinica"
              @keyup.enter="crearCarpeta"
            />
            <button @click="crearCarpeta" class="btn-crear-carpeta">
              <span class="btn-icono-crear">+</span>
              <span>{{ carpetaActual ? 'Crear Subcarpeta' : 'Crear Carpeta' }}</span>
            </button>
          </div>

          <!-- Opciones adicionales al crear carpetas (Supercarpeta y Archivos Confidenciales) -->
          <div class="opciones-carpeta-bar" v-if="esControlador || esJefeOControlador">
            <!-- Casilla Supercarpeta: Solo visible para el Controlador -->
            <label v-if="esControlador" class="checkbox-opcion-carpeta label-supercarpeta" title="Marcar para crear una Supercarpeta que los empleados no podrán eliminar ni renombrar">
              <input type="checkbox" v-model="esNuevaCarpetaProtegida" />
              <span class="texto-casilla">🛡️ <strong>Supercarpeta</strong> (Protegida contra borrado y cambio de nombre por empleados)</span>
            </label>

            <!-- Casilla Archivos Confidenciales: Visible para Jefes y Controladores -->
            <label v-if="esJefeOControlador" class="checkbox-opcion-carpeta label-confidencial" title="Marcar para que esta carpeta solo sea visible para usuarios con rango de Jefe o Controlador, independientemente de su área">
              <input type="checkbox" v-model="esNuevaCarpetaConfidencial" />
              <span class="texto-casilla">🔒 <strong>Archivos confidenciales</strong> (Carpeta confidencial para Jefes y Controladores)</span>
            </label>
          </div>
        </div>
        <div v-else class="aviso-lectura" style="margin-bottom: 15px;">
          ℹ️ No tienes permisos para crear carpetas en el área de <strong>{{ props.seccion }}</strong>.
        </div>
      </div>

      <!-- LISTA DE CARPETAS O SUBCARPETAS -->
      <div>
        <h4>{{ carpetaActual ? `📂 Subcarpetas dentro de "${carpetaActual.nombre}"` : `Carpetas de ${props.seccion}` }}</h4>
        <div class="lista-carpetas">
          <div v-if="carpetasFiltradas.length === 0 && textoBusqueda" class="sin-archivos">
            🔍 No se encontraron carpetas que coincidan con "{{ textoBusqueda }}".
          </div>
          <div v-else-if="carpetasFiltradas.length === 0" class="sin-archivos">
            {{ carpetaActual ? 'No hay subcarpetas adentro de esta carpeta.' : 'No hay carpetas en esta sección.' }}
          </div>
          
          <div 
            v-for="carpeta in carpetasFiltradas" 
            :key="carpeta.id" 
            class="archivo-card"
            @dragover.prevent
            @drop="soltarEnCarpeta($event, carpeta)"
          >
            <span class="archivo-nombre" @click="entrarACarpeta(carpeta)" style="cursor: pointer; font-weight: 600; color: #2b6cb0;">
              📁 {{ carpeta.nombre }}
              <span v-if="carpeta.protegida" class="badge-supercarpeta" title="Supercarpeta: no puede ser eliminada ni renombrada por empleados">🛡️ Supercarpeta</span>
              <span v-if="carpeta.confidencial" class="badge-confidencial" title="Carpeta Confidencial: visible solo para Jefes y Controladores">🔒 Confidencial</span>
              <span style="font-size: 11px; font-weight: normal; color: #718096; margin-left: 6px;">(Clic para abrir / Arrastra un archivo aquí)</span>
            </span>
            <div class="acciones-btn">
              <button @click="entrarACarpeta(carpeta)" class="btn-revisar" style="background-color: #3182ce;">📂 Abrir</button>
              <button @click="descargarCarpeta(carpeta.id, carpeta.nombre)" class="btn-revisar">📥 Descargar</button>
              <button v-if="puedeRenombrarCarpeta(carpeta)" @click="renombrarCarpeta(carpeta)" class="btn-revisar">✏️ Renombrar</button>
              <button v-if="puedeCrearCarpeta" @click="abrirModalCompartir(carpeta)" class="btn-revisar">🔗 Compartir</button>
              <button v-if="puedeEliminarCarpeta(carpeta)" @click="eliminarCarpeta(carpeta)" class="btn-eliminar">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- CARPETAS COMPARTIDAS EN EL NIVEL ACTUAL -->
      <div v-if="carpetasCompartidasFiltradas.length > 0" style="margin-top: 25px;">
        <h4>Compartidas Conmigo</h4>
        <div class="lista-carpetas">
          <div 
            v-for="carpeta in carpetasCompartidasFiltradas" 
            :key="'comp-' + carpeta.id" 
            class="archivo-card"
            @dragover.prevent
            @drop="soltarEnCarpeta($event, carpeta)"
          >
            <span class="archivo-nombre" @click="entrarACarpeta(carpeta)" style="cursor: pointer; font-weight: 600; color: #2b6cb0;">
              📂 {{ carpeta.nombre }}
              <span v-if="carpeta.protegida" class="badge-supercarpeta" title="Supercarpeta protegida">🛡️ Supercarpeta</span>
              <span v-if="carpeta.confidencial" class="badge-confidencial" title="Carpeta Confidencial">🔒 Confidencial</span>
              <small style="color:#718096; margin-left: 6px;">(de: {{ carpeta.propietario }}) - Arrastra aquí</small>
            </span>
            <div class="acciones-btn">
              <button @click="entrarACarpeta(carpeta)" class="btn-revisar" style="background-color: #3182ce;">📂 Abrir</button>
              <button @click="descargarCarpeta(carpeta.id, carpeta.nombre)" class="btn-revisar">📥 Descargar</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MÓDULO DE ARCHIVOS -->
    <div class="modulo-archivos">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
        <h3 style="margin: 0;">
          📄 Archivos en {{ carpetaActual === null ? 'la Página Principal (Raíz)' : `"${carpetaActual.nombre}"` }}
        </h3>
        
        <!-- Zona interactiva para devolver archivos arrastrados a la raíz -->
        <div 
          v-if="carpetaActual !== null" 
          @dragover.prevent 
          @drop="soltarEnRaiz($event)" 
          class="zona-drop-raiz"
          title="Arrastra un archivo aquí para moverlo a la página principal"
        >
          🏠 <span>Soltar aquí para devolver a la Raíz</span>
        </div>
      </div>

      <div v-if="archivosFiltrados.length === 0 && textoBusqueda" class="sin-archivos">
        🔍 No se encontraron archivos en este directorio que coincidan con "{{ textoBusqueda }}".
      </div>
      <div v-else-if="archivosFiltrados.length === 0" class="sin-archivos">
        No hay archivos guardados en esta ubicación.
      </div>

      <!-- Contenedor dedicado de lista de archivos para evitar conflicto con display: flex -->
      <div v-else class="lista-archivos">
        <div 
          v-for="arc in archivosFiltrados" 
          :key="arc.id" 
          class="archivo-card"
          draggable="true"
          @dragstart="iniciarArrastre($event, arc.id)"
          style="cursor: grab;"
        >
          <span class="archivo-nombre">
            📄 {{ arc.nombre }}
            <span v-if="arc.confidencial" class="badge-confidencial" title="Archivo Confidencial: solo visible para Jefes y Controladores">🔒 Confidencial</span>
          </span>
          <div class="acciones-btn">
            <button @click="abrirVistaPrevia(arc)" class="btn-revisar">Revisar</button>
            
            <!-- BOTÓN PARA SACAR ARCHIVOS DE LAS CARPETAS Y MANDARLOS A LA PÁGINA PRINCIPAL -->
            <button 
              v-if="carpetaActual !== null && puedeSubirArchivo" 
              @click="sacarArchivoARaiz(arc)" 
              class="btn-sacar-raiz"
              title="Sacar archivo de esta carpeta y devolverlo a la página principal del área"
            >
              📤 Sacar a Raíz
            </button>

            <button 
              v-if="puedeSubirArchivo"
              @click="eliminarArchivo(arc)" 
              class="btn-eliminar"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modalCompartirVisible" class="modal-overlay" @click.self="modalCompartirVisible = false">
      <div class="modal-contenedor modal-compartir-pequeno">
        <div class="modal-header">
          <h3>Compartir carpeta</h3>
          <button @click="modalCompartirVisible = false" class="btn-cerrar">❌</button>
        </div>
        <p style="margin-top:0; font-size:14px; color:#4a5568;">
          Ingresa el correo electrónico del usuario con quien deseas compartir la carpeta <strong>"{{ carpetaSeleccionada?.nombre }}"</strong>:
        </p>
        <input 
          v-model="emailDestinoCompartir" 
          type="email" 
          placeholder="ejemplo@correo.com" 
          class="input-busqueda-clinica"
          style="margin-bottom: 20px;"
          @keyup.enter="enviarCompartir"
        />
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button @click="enviarCompartir" class="btn-revisar">Compartir</button>
          <button @click="modalCompartirVisible = false" class="btn-cerrar">Cancelar</button>
        </div>
      </div>
    </div>

    <div v-if="mostrarModal" class="modal-overlay" @click.self="cerrarVistaPrevia">
      <div class="modal-contenedor">
        
        <div class="modal-header">
          <div class="header-titulos">
            <h3>Visualizador de Archivos Interno</h3>
            <span class="archivo-actual">Visualizando: {{ nombreArchivoPrevia }}</span>
          </div>
          <div class="header-botones">
            <button @click="mostrarNotas = !mostrarNotas" class="btn-toggle-comentarios">
              {{ mostrarNotas ? '👁️ Ocultar Notas' : '💬 Ver Notas (' + listaComentarios.length + ')' }}
            </button>
            <a
              v-if="urlArchivoPrevia"
              :href="urlArchivoPrevia"
              :download="nombreArchivoPrevia"
              target="_blank"
              class="btn-descargar-modal">
              📥 Descargar Original
            </a>
            <button @click="cerrarVistaPrevia" class="btn-cerrar">❌ Cerrar</button>
          </div>
        </div>
        
        <div class="modal-distribucion-completa">
          <div class="modal-body-completo">
            <div 
              class="capa-interactiva-documento" 
              ref="contenedorDocumento" 
              @mousedown="iniciarSubrayado"
              @mousemove="moverSubrayado"
              @mouseup="finalizarSubrayado"
            >
              <div v-if="esHtml" class="hoja-documento-contenedor">
                <div class="visor-html-liviano" v-html="contenidoHtmlPrevia"></div>
              </div>

              <div v-else-if="esImagen" class="contenedor-imagen-previa">
                <img :src="urlArchivoPrevia" alt="Vista previa" class="img-renderizada" draggable="false" />
              </div>

              <iframe v-else :src="urlArchivoPrevia" width="100%" height="100%" style="border: none; pointer-events: none;"></iframe>

              <div 
                v-for="com in listaComentarios.filter(c => c.coord_w > 0)" 
                :key="'subrayado-' + com.id"
                class="subrayado-marcador"
                :style="{ top: com.coord_y + '%', left: com.coord_x + '%', width: com.coord_w + '%', height: com.coord_h + '%' }"
                :title="'Nota de: ' + com.usuario_email"
              >
                📍
              </div>

              <div 
                v-if="recuadroTemporal" 
                class="subrayado-marcador temporal" 
                :style="{ top: recuadroTemporal.y + '%', left: recuadroTemporal.x + '%', width: recuadroTemporal.w + '%', height: recuadroTemporal.h + '%' }"
              ></div>
            </div>
          </div>

          <div class="panel-comentarios-desplegable" :class="{ 'panel-abierto': mostrarNotas }">
            <div class="panel-comentarios-header">
              <h4>💬 Notas de Auditoría</h4>
              <button @click="mostrarNotas = false" class="btn-cerrar-panel">➡️</button>
            </div>
            
            <div class="lista-comentarios-feed">
              <div v-if="listaComentarios.length === 0" class="sin-comentarios">
                No hay anotaciones en este documento.
              </div>
              
              <div v-for="com in listaComentarios" :key="com.id" class="comentario-item">
                <div class="comentario-meta">
                  <span class="comentario-autor">{{ com.usuario_email?.split('@')?.[0] }}</span>
                  <span class="badge-rol-comentario" :class="com.rol?.toLowerCase()">{{ com.rol || 'AUDITOR' }}</span>
                </div>
                <p class="comentario-texto">
                  <span v-if="com.coord_x !== null" style="color:#e53e3e; font-weight:bold;">[Subrayado 📍]</span> 
                  {{ com.comentario }}
                </p>
                
                <div class="comentario-acciones" v-if="esAutorizadoParaComentar">
                  <button @click="eliminarComentario(com.id)" class="btn-hecho-comentario">
                    Resolución / Hecho ✓
                  </button>
                </div>
              </div>
            </div>

            <div class="caja-escribir-comentario" v-if="esAutorizadoParaComentar">
              <p v-if="recuadroTemporal" style="margin:0; font-size:11px; color:#2b6cb0; font-weight:bold;">
                🎯 Área seleccionada correctamente. Escribe la nota abajo:
              </p>
              <p v-else style="margin:0; font-size:11px; color:#718096;">
                👉 Arrastra el mouse sobre el documento para subrayar el área a comentar.
              </p>
              <textarea 
                v-model="nuevoComentario" 
                placeholder="Escribe una observación oficial..."
                rows="3"
                class="input-busqueda-clinica"
                :disabled="!recuadroTemporal"
              ></textarea>
              <button @click="agregarComentario" :disabled="!recuadroTemporal" class="btn-enviar-comentario">Publicar Nota</button>
            </div>
            <div v-else class="aviso-no-comenta">
              🔒 Acceso restringido. Solo el Presidente, Controlador o el Jefe de este departamento pueden añadir notas.
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- MODAL DE HISTORIAL DE CAMBIOS -->
    <div v-if="mostrarModalHistorial" class="modal-overlay" @click.self="cerrarHistorial">
      <div class="modal-contenedor modal-historial-contenedor">
        <div class="modal-header">
          <div class="header-titulos">
            <h3>📋 Historial de Cambios - {{ props.titulo }}</h3>
            <span class="archivo-actual">Registro de auditoría de subida, eliminación y reemplazo de archivos</span>
          </div>
          <button @click="cerrarHistorial" class="btn-cerrar">❌ Cerrar</button>
        </div>

        <div class="historial-toolbar">
          <div class="historial-filtros-btn">
            <button 
              :class="['btn-filtro-hist', { 'activo': filtroAccionHistorial === 'TODOS' }]" 
              @click="filtroAccionHistorial = 'TODOS'"
            >
              Todos ({{ listaHistorial.length }})
            </button>
            <button 
              :class="['btn-filtro-hist', 'btn-f-subida', { 'activo': filtroAccionHistorial === 'SUBIDA' }]" 
              @click="filtroAccionHistorial = 'SUBIDA'"
            >
              🟢 Subidos ({{ totalSubidas }})
            </button>
            <button 
              :class="['btn-filtro-hist', 'btn-f-eliminacion', { 'activo': filtroAccionHistorial === 'ELIMINACION' }]" 
              @click="filtroAccionHistorial = 'ELIMINACION'"
            >
              🔴 Eliminados ({{ totalEliminaciones }})
            </button>
            <button 
              :class="['btn-filtro-hist', 'btn-f-reemplazo', { 'activo': filtroAccionHistorial === 'REEMPLAZO' }]" 
              @click="filtroAccionHistorial = 'REEMPLAZO'"
            >
              🟠 Reemplazados ({{ totalReemplazos }})
            </button>
          </div>

          <div class="historial-busqueda-caja">
            <input 
              v-model="busquedaHistorial" 
              type="text" 
              placeholder="🔍 Filtrar por archivo, usuario o rol..." 
              class="input-busqueda-clinica"
              style="max-width: 320px; margin: 0;"
            />
            <button @click="cargarHistorial" class="btn-revisar" :disabled="cargandoHistorial" title="Recargar historial">
              {{ cargandoHistorial ? 'Cargando...' : '🔄 Actualizar' }}
            </button>
          </div>
        </div>

        <div class="modal-body-scrollable">
          <div v-if="cargandoHistorial" class="sin-archivos">
            ⏳ Cargando historial de cambios...
          </div>
          <div v-else-if="historialFiltrado.length === 0" class="sin-archivos">
            <span v-if="busquedaHistorial || filtroAccionHistorial !== 'TODOS'">
              🔍 No se encontraron registros con los filtros seleccionados.
            </span>
            <span v-else>
              ℹ️ Aún no hay registros de cambios en el área de {{ props.titulo }}.
            </span>
          </div>

          <table v-else class="tabla-historial">
            <thead>
              <tr>
                <th>Acción</th>
                <th>Archivo</th>
                <th>Usuario Responsable</th>
                <th>Fecha y Hora</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in historialFiltrado" :key="'hist-' + item.id">
                <td>
                  <span v-if="item.accion === 'SUBIDA'" class="badge-accion badge-accion-subida">
                    🟢 SUBIDO
                  </span>
                  <span v-else-if="item.accion === 'ELIMINACION'" class="badge-accion badge-accion-eliminar">
                    🔴 ELIMINADO
                  </span>
                  <span v-else-if="item.accion === 'REEMPLAZO'" class="badge-accion badge-accion-reemplazo">
                    🟠 REEMPLAZADO
                  </span>
                  <span v-else class="badge-accion">
                    {{ item.accion }}
                  </span>
                </td>
                <td class="col-archivo">
                  <strong>📄 {{ item.archivo_nombre }}</strong>
                </td>
                <td class="col-usuario">
                  <div class="usuario-hist-info">
                    <span class="user-email-txt">{{ item.usuario_email }}</span>
                    <span v-if="item.usuario_rol" class="badge-rol-mini">{{ item.usuario_rol }}</span>
                  </div>
                </td>
                <td class="col-fecha">
                  {{ formatearFechaHora(item.fecha) }}
                </td>
                <td class="col-detalles">
                  <span class="detalles-txt">{{ item.detalles || '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-footer-historial">
          <span style="font-size: 13px; color: #718096;">
            Mostrando {{ historialFiltrado.length }} de {{ listaHistorial.length }} eventos registrados
          </span>
          <button @click="cerrarHistorial" class="btn-revisar" style="background-color: #4a5568;">
            Cerrar
          </button>
        </div>
      </div>
    </div>

  </div>
</template>



<style scoped>
.contenedor-header-usuario {
  display: flex;
  align-items: center;
  gap: 18px;
}

.campana-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.campana-wrapper:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.icono-campana {
  width: 28px;
  height: 28px;
  object-fit: contain;
  transition: transform 0.2s ease;
}

.campana-wrapper:hover .icono-campana {
  transform: scale(1.1);
}

.badge-notificacion {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: #e53e3e;
  color: #ffffff;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  border: 2px solid #ffffff;
  line-height: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* ESTILOS MINI PANEL DE NOTIFICACIONES */
.campana-wrapper {
  position: relative;
  display: inline-block;
}

.popover-notificaciones {
  position: absolute;
  top: 40px;
  left: 0;
  width: 320px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  font-family: inherit;
}

.popover-header {
  background-color: #2b6cb0;
  color: white;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-cerrar-popover {
  background: transparent;
  border: none;
  color: white;
  font-size: 14px;
  cursor: pointer;
}

.popover-body {
  max-height: 280px;
  overflow-y: auto;
}

.sin-notificaciones-texto {
  padding: 15px;
  text-align: center;
  font-size: 13px;
  color: #718096;
}

.item-notificacion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
  cursor: pointer;
  transition: background-color 0.2s;
}

.item-notificacion:hover {
  background-color: #f7fafc;
}

.icono-file {
  font-size: 18px;
}

.info-archivo-notif {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nombre-notif {
  font-size: 13px;
  color: #2d3748;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subtexto-notif {
  font-size: 11px;
  color: #3182ce;
}

.popover-footer {
  padding: 8px;
  background-color: #f7fafc;
  border-top: 1px solid #edf2f7;
  text-align: center;
}

.btn-marcar-leido {
  width: 100%;
  background-color: #3182ce;
  color: white;
  border: none;
  padding: 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-marcar-leido:hover {
  background-color: #2b6cb0;
}

@keyframes pulso-campana {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.efecto-pulso {
  animation: pulso-campana 1.5s infinite ease-in-out;
}

.tarjeta-usuario-header {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #f7fafc;
  border: 1px solid #e2e8f0;
  padding: 6px 12px;
  border-radius: 20px;
}

.modal-body-completo {
  width: 100%;
  height: 100%;
  background-color: #525659;
  overflow: hidden;
  position: relative;
}

.capa-interactiva-documento {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  cursor: crosshair;
}

.hoja-documento-contenedor {
  width: 100%;
  min-height: 100%;
  padding: 30px 15px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #525659;
}

.visor-html-liviano {
  background: #ffffff;
  width: 100%;
  max-width: 1100px;
  min-height: 1000px;
  padding: 50px 60px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  color: #2d3748;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.7;
  font-size: 15px;
  box-sizing: border-box;
  position: relative;
}

.visor-html-liviano p { margin-bottom: 1.2em; text-align: justify; }
.visor-html-liviano h1, .visor-html-liviano h2, .visor-html-liviano h3 {
  color: #1a365d; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;
}
.visor-html-liviano ul, .visor-html-liviano ol { padding-left: 25px; margin-bottom: 1.2em; }
.visor-html-liviano table {
  width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;
}
.visor-html-liviano th {
  background-color: #2b6cb0; color: #ffffff; font-weight: 600; text-align: left; padding: 10px 12px; border: 1px solid #2b6cb0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;
}
.visor-html-liviano td { padding: 9px 12px; border: 1px solid #e2e8f0; color: #4a5568; }
.visor-html-liviano tr:nth-child(even) { background-color: #f7fafc; }
.visor-html-liviano tr:hover { background-color: #edf2f7; }
.visor-html-liviano img { max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }

.subrayado-marcador {
  position: absolute; border: 2px solid #e53e3e; background-color: rgba(229, 62, 62, 0.25); border-radius: 4px; pointer-events: none; z-index: 10;
}
.subrayado-marcador.temporal { border: 2px dashed #2b6cb0; background-color: rgba(43, 108, 176, 0.2); }

.contenedor-busqueda-unificada { max-width: 600px; margin: 20px auto 10px auto; width: 100%; }
.input-busqueda-clinica { width: 100%; padding: 11px 16px; font-size: 14px; border: 1px solid #cbd5e0; border-radius: 6px; background-color: #ffffff; color: #2d3748; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); transition: all 0.2s ease-in-out; }
.input-busqueda-clinica:focus { outline: none; border-color: #2b6cb0; box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.15); }

.seccion-container { padding: 20px; font-family: sans-serif; }
.tarjeta-usuario { display: flex; align-items: center; gap: 15px; background-color: #ebf8ff; border: 1px solid #bee3f8; padding: 12px 20px; border-radius: 8px; margin-bottom: 25px; }
.usuario-avatar { font-size: 24px; background: #e2e8f0; padding: 8px; border-radius: 50%; }
.usuario-info p { margin: 2px 0; color: #2b6cb0; font-size: 14px; }
.badge-rol { background-color: #2b6cb0; color: white; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-size: 11px; font-weight: bold; }
.badge-seccion { background-color: #4a5568; color: white; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-size: 11px; font-weight: bold; }

.modulo-carpetas { margin-bottom: 25px; background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
.caja-crear-carpeta { display: flex; gap: 10px; margin-bottom: 15px; }
.modulo-subida { margin-bottom: 30px; }
.aviso-lectura { background-color: #fef3c7; border: 1px solid #f59e0b; color: #b45309; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
.sin-archivos { padding: 15px; color: #718096; background-color: #ffffff; border-radius: 6px; text-align: center; border: 1px dashed #cbd5e0; }
.archivo-card { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; background: white; }
.archivo-nombre { font-weight: 500; color: #2d3748; }
.acciones-btn { display: flex; gap: 8px; }
.btn-revisar { background-color: #2b6cb0; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; }
.btn-eliminar { background-color: #e53e3e; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 500; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-contenedor { background: white; width: 96%; max-width: 1500px; height: 92vh; padding: 20px; border-radius: 8px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
.modal-compartir-pequeno { max-width: 450px !important; height: auto !important; overflow: visible !important; }
.modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; }
.header-titulos h3 { margin: 0; font-size: 18px; color: #2d3748; }
.archivo-actual { font-size: 13px; color: #718096; display: block; margin-top: 2px; }
.header-botones { display: flex; align-items: center; gap: 12px; }

.modal-distribucion-completa { flex-grow: 1; position: relative; display: flex; overflow: hidden; border-radius: 4px; }
.contenedor-imagen-previa { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; padding: 10px; pointer-events: none; }
.img-renderizada { max-width: 100%; max-height: 100%; object-fit: contain; }

.panel-comentarios-desplegable {
  position: absolute; top: 0; right: -380px; width: 360px; height: 100%; background: white; box-shadow: -4px 0 15px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; padding: 20px; box-sizing: border-box; transition: right 0.3s ease-in-out; z-index: 1000;
}
.panel-comentarios-desplegable.panel-abierto { right: 0; }
.panel-comentarios-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #edf2f7; padding-bottom: 8px; }
.btn-cerrar-panel { background: none; border: none; font-size: 16px; cursor: pointer; }

/* ==========================================
   ADAPTACIÓN AL MODO OSCURO AUTOMÁTICO
   ========================================== */

.contenedor-almacenamiento {
  padding: 20px;
  background-color: var(--bg-principal); /* Cambia automáticamente */
}

.panel-header h2 {
  color: var(--texto-principal); /* Cambia automáticamente */
}

.panel-header .descripcion {
  color: var(--texto-secundario); /* Cambia automáticamente */
}

/* Contenedor o tarjetas donde se listan las carpetas/archivos */
.tarjeta-carpeta {
  background-color: var(--bg-tarjetas); /* Se volverá gris oscuro en dark mode */
  border: 1px solid var(--bordes);       /* El borde se adaptará */
  border-radius: 8px;
  padding: 15px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.tarjeta-carpeta h4 {
  margin: 10px 0 0 0;
  color: var(--texto-principal); /* Nombre de la carpeta legible siempre */
}

/* Si tienes inputs o formularios para crear carpetas nuevas en esta vista: */
input[type="text"] {
  background-color: var(--input-bg);
  color: var(--texto-principal);
  border: 1px solid var(--bordes);
  padding: 8px;
  border-radius: 4px;
  }

.btn-toggle-comentarios { background-color: #4a5568; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; }
.lista-comentarios-feed { flex-grow: 1; overflow-y: auto; margin-bottom: 15px; }
.sin-comentarios { text-align: center; color: #a0aec0; padding: 20px; font-size: 13px; font-style: italic; }
.comentario-item { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
.comentario-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.comentario-autor { font-size: 11px; font-weight: bold; color: #4a5568; }
.badge-rol-comentario { background:#2b6cb0; color:white; font-size:9px; padding:2px 4px; border-radius:3px; text-transform:uppercase;}
.badge-rol-comentario.controlador { background-color: #dd6b20; }
.badge-rol-comentario.presidente { background-color: #9b2c2c; }
.badge-rol-comentario.jefe { background-color: #319795; }
.comentario-texto { margin: 0; font-size: 13px; color: #2d3748; word-break: break-word; }

.comentario-acciones { display: flex; justify-content: flex-end; margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px; }
.btn-hecho-comentario { background: none; border: none; color: #38a169; font-size: 11px; font-weight: bold; cursor: pointer; }

.caja-escribir-comentario { display: flex; flex-direction: column; gap: 8px; }
.caja-escribir-comentario textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; resize: none; box-sizing: border-box; font-size: 13px; }
.caja-escribir-comentario textarea:disabled { background-color: #edf2f7; cursor: not-allowed; }
.btn-enviar-comentario { background-color: #2b6cb0; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-enviar-comentario:disabled { background-color: #cbd5e0; cursor: not-allowed; }
.aviso-no-comenta { font-size: 12px; color: #718096; background: #edf2f7; padding: 10px; border-radius: 6px; text-align: center; }

.btn-descargar-modal { background-color: #38a169; color: white; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: bold; }
.btn-cerrar { background: #edf2f7; border: 1px solid #cbd5e0; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #4a5568; font-weight: bold; }

/* ESTILOS PARA HISTORIAL DE CAMBIOS */
.btn-abrir-historial {
  background: linear-gradient(135deg, #2b6cb0, #2c5282);
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}
.btn-abrir-historial:hover {
  background: linear-gradient(135deg, #2c5282, #1a365d);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
}

.modal-historial-contenedor {
  width: 95%;
  max-width: 1100px;
  height: 85vh;
  display: flex;
  flex-direction: column;
}

.historial-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}

.historial-filtros-btn {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-filtro-hist {
  background-color: #edf2f7;
  color: #4a5568;
  border: 1px solid #cbd5e0;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-filtro-hist:hover {
  background-color: #e2e8f0;
}
.btn-filtro-hist.activo {
  background-color: #2b6cb0;
  color: white;
  border-color: #2b6cb0;
}
.btn-f-subida.activo {
  background-color: #2f855a;
  border-color: #2f855a;
}
.btn-f-eliminacion.activo {
  background-color: #c53030;
  border-color: #c53030;
}
.btn-f-reemplazo.activo {
  background-color: #dd6b20;
  border-color: #dd6b20;
}

.historial-busqueda-caja {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-body-scrollable {
  flex: 1;
  overflow-y: auto;
  margin-top: 15px;
}

.tabla-historial {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.tabla-historial th {
  background-color: #f7fafc;
  color: #4a5568;
  font-weight: 700;
  padding: 10px 12px;
  border-bottom: 2px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 2;
}

.tabla-historial td {
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
  vertical-align: middle;
}

.tabla-historial tr:hover {
  background-color: #f8fafc;
}

.badge-accion {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 0.5px;
}
.badge-accion-subida {
  background-color: #c6f6d5;
  color: #22543d;
  border: 1px solid #9ae6b4;
}
.badge-accion-eliminar {
  background-color: #fed7d7;
  color: #742a2a;
  border: 1px solid #feb2b2;
}
.badge-accion-reemplazo {
  background-color: #feebc8;
  color: #7b341e;
  border: 1px solid #fbd38d;
}

.col-archivo {
  color: #2d3748;
  max-width: 280px;
  word-break: break-all;
}

.usuario-hist-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.user-email-txt {
  font-size: 13px;
  color: #2b6cb0;
  font-weight: 500;
}
.badge-rol-mini {
  background-color: #e2e8f0;
  color: #4a5568;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-transform: uppercase;
  font-weight: bold;
}

.col-fecha {
  color: #4a5568;
  font-family: monospace;
  font-size: 12px;
  white-space: nowrap;
}

.col-detalles {
  color: #718096;
  font-size: 12px;
}

.modal-footer-historial {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
  margin-top: 10px;
}

/* ESTILOS PARA BREADCRUMBS, SACAR A RAÍZ Y ZONA DROP */
.migaja-link {
  cursor: pointer;
  color: #3182ce;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  user-select: none;
}
.migaja-link:hover {
  background-color: #ebf8ff;
  color: #2b6cb0;
}
.migaja-link.migaja-activa {
  color: #2b6cb0;
  background-color: #edf2f7;
  font-weight: 700;
}
.migaja-sep {
  color: #a0aec0;
  font-size: 13px;
}

.btn-sacar-raiz {
  background-color: #dd6b20;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s, transform 0.1s;
}
.btn-sacar-raiz:hover {
  background-color: #c05621;
  transform: translateY(-1px);
}

.zona-drop-raiz {
  border: 2px dashed #3182ce;
  background-color: #ebf8ff;
  color: #2b6cb0;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.zona-drop-raiz:hover {
  background-color: #bee3f8;
  border-color: #2b6cb0;
}

.btn-crear-carpeta {
  background-color: #ffffff;
  color: #2b6cb0;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  padding: 8px 18px;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease-in-out;
}

.btn-crear-carpeta:hover {
  background-color: #ebf8ff;
  color: #2c5282;
  border-color: #3182ce;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.btn-icono-crear {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  color: inherit;
  display: inline-block;
  margin: 0;
}

/* ==========================================================================
   ESTILOS: CAJA DE CREACIÓN CON SUPERCETA Y CONFIDENCIALIDAD
   ========================================================================== */
.contenedor-creacion-carpeta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.opciones-carpeta-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 14px;
  background-color: #edf2f7;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.checkbox-opcion-carpeta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #2d3748;
  cursor: pointer;
  user-select: none;
}

.checkbox-opcion-carpeta input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #2b6cb0;
}

.label-supercarpeta {
  color: #c05621;
}

.label-supercarpeta input[type="checkbox"] {
  accent-color: #dd6b20;
}

.label-confidencial {
  color: #6b46c1;
}

.label-confidencial input[type="checkbox"] {
  accent-color: #6b46c1;
}

/* ==========================================================================
   BADGES DE SUPERCETA Y CONFIDENCIAL
   ========================================================================== */
.badge-supercarpeta {
  background-color: #feebc8;
  color: #c05621;
  border: 1px solid #fbd38d;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  vertical-align: middle;
}

.badge-confidencial {
  background-color: #faf5ff;
  color: #6b46c1;
  border: 1px solid #d6bcfa;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  vertical-align: middle;
}
</style>