<script setup>
// Importamos el componente (el arroba '@' es un atajo para la carpeta 'src')
import SubirArchivo from '@/components/SubirArchivo.vue'
</script>

<template>
  <div class="quirofano-page">
    <h2>Panel de Quirofano</h2>
    <SubirArchivo endpoint="http://localhost:3000/api/quirofano/subir" />
  </div>
</template>