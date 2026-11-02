<script setup>
// Importamos el componente (el arroba '@' es un atajo para la carpeta 'src')
import SubirArchivo from '@/components/SubirArchivo.vue'
</script>

<template>
  <div class="farmacia-page">
    <h2>Panel de Servidores</h2>
    <SubirArchivo endpoint="http://localhost:3000/api/servidores/subir" />
  </div>
</template>