<script setup>
// Importamos el componente (el arroba '@' es un atajo para la carpeta 'src')
import SubirArchivo from '@/components/SubirArchivo.vue'
</script>

<template>
  <div class="hosteleria-page">
    <h2>Panel de Hoteleria</h2>
    <SubirArchivo endpoint="http://localhost:3000/api/hosteleria/subir" />
  </div>
</template>