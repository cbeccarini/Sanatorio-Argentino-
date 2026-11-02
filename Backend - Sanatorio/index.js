const express = require('express');
const mysql = require('mysql2/promise'); 
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE MYSQL CON PROMESAS NATIVAS
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'sanatorio_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// AUTO-MIGRACIÓN DE ESQUEMA EN MYSQL (COLUMNA CONFIDENCIAL)
const asegurarColumnas = async () => {
    try {
        const [cols] = await db.query("SHOW COLUMNS FROM archivos_secciones LIKE 'confidencial'");
        if (cols.length === 0) {
            await db.query("ALTER TABLE archivos_secciones ADD COLUMN confidencial TINYINT(1) NOT NULL DEFAULT 0");
            console.log("✅ [MySQL] Columna 'confidencial' agregada a archivos_secciones.");
        }
    } catch (err) {
        console.error("Aviso al verificar columnas en archivos_secciones:", err.message);
    }
};
asegurarColumnas();

// FUNCIÓN AUXILIAR PARA REGISTRAR EN EL HISTORIAL DE CAMBIOS
const registrarHistorial = async ({ seccion, accion, archivoNombre, usuarioEmail, usuarioRol, detalles }) => {
    try {
        const query = `
            INSERT INTO historial_cambios (seccion, accion, archivo_nombre, usuario_email, usuario_rol, detalles)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.query(query, [
            (seccion || 'general').toLowerCase(),
            accion,
            archivoNombre || 'Sin nombre',
            usuarioEmail || 'desconocido',
            usuarioRol || 'sin-rol',
            detalles || null
        ]);
        console.log(`📝 [Historial] ${accion} registrado: "${archivoNombre}" por ${usuarioEmail} en ${seccion}`);
    } catch (err) {
        console.error('❌ Error al registrar en historial_cambios:', err.message);
    }
};

// CONFIGURACIÓN DE ALMACENAMIENTO CON MULTER
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const normalizarTexto = (texto = '') =>
    String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const buscarEnDisco = (rutaBase, textoBusqueda) => {
    const resultados = [];
    const busqueda = normalizarTexto(textoBusqueda).trim();

    if (!busqueda) {
        return resultados;
    }

    const recorrer = (directorioActual) => {
        if (!fs.existsSync(directorioActual)) {
            return;
        }

        const entradas = fs.readdirSync(directorioActual, { withFileTypes: true });

        for (const entrada of entradas) {
            const rutaCompleta = path.join(directorioActual, entrada.name);
            const relativa = path.relative(__dirname, rutaCompleta).replace(/\\/g, '/');
            const nombreNormalizado = normalizarTexto(entrada.name);
            const rutaNormalizada = normalizarTexto(relativa);

            if (entrada.isDirectory()) {
                const coincideConCarpeta = nombreNormalizado.includes(busqueda) || rutaNormalizada.includes(busqueda);

                if (coincideConCarpeta) {
                    resultados.push({
                        type: 'folder',
                        name: entrada.name,
                        path: relativa,
                        parent: path.relative(__dirname, directorioActual).replace(/\\/g, '/') || '/' 
                    });
                }

                recorrer(rutaCompleta);
                continue;
            }

            const coincideConArchivo = nombreNormalizado.includes(busqueda) || rutaNormalizada.includes(busqueda);

            if (coincideConArchivo) {
                resultados.push({
                    type: 'file',
                    name: entrada.name,
                    path: relativa,
                    parent: path.relative(__dirname, directorioActual).replace(/\\/g, '/') || '/' 
                });
            }
        }
    };

    recorrer(rutaBase);

    const vistos = new Set();
    return resultados.filter((item) => {
        const clave = `${item.type}:${item.path}`;
        if (vistos.has(clave)) {
            return false;
        }
        vistos.add(clave);
        return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
};

// SERVIR ARCHIVOS ESTÁTICOS
app.use('/ver-archivo', express.static(path.join(__dirname, 'uploads')));
app.use('/archivos', express.static(path.join(__dirname, 'uploads')));

app.get('/api/buscar', (req, res) => {
    const textoBusqueda = req.query.q || req.query.texto || '';

    const rutasBase = [
        path.join(__dirname, 'uploads'),
        path.join(__dirname, 'subidas')
    ].filter(ruta => fs.existsSync(ruta));

    if (rutasBase.length === 0) {
        return res.json([]);
    }

    const resultados = rutasBase.flatMap(ruta => buscarEnDisco(ruta, textoBusqueda));
    const claveUnica = new Set();

    const filtrados = resultados.filter((item) => {
        const clave = `${item.type}:${item.path}`;
        if (claveUnica.has(clave)) {
            return false;
        }
        claveUnica.add(clave);
        return true;
    });

    return res.json(filtrados.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })));
});

// 1. OBTENER ARCHIVOS DE UNA SECCIÓN
app.get('/api/archivos/:seccion', async (req, res) => {
    const seccion = req.params.seccion.toLowerCase();
    const userRole = (req.headers['user-role'] || '').toLowerCase();
    const rolesConfidenciales = ['jefe', 'controlador', 'presidente', 'coordinacion'];
    const puedeVerConfidenciales = rolesConfidenciales.includes(userRole);

    let query = 'SELECT * FROM archivos_secciones WHERE LOWER(seccion_destino) = ?';
    const params = [seccion];

    if (!puedeVerConfidenciales) {
        query += ' AND (confidencial = 0 OR confidencial IS NULL)';
    }

    query += ' ORDER BY id DESC';

    try {
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error al obtener archivos:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. SUBIR ARCHIVOS (ASIGNA REVISADO = 0, SOPORTA REEMPLAZO, CONFIDENCIALIDAD Y REGISTRA EN HISTORIAL)
app.post('/api/:seccion/subir', upload.array('files'), async (req, res) => {
    const seccionDestino = req.params.seccion.toLowerCase();
    const userRole = (req.headers['user-role'] || '').toLowerCase();
    const userSeccion = (req.headers['user-seccion'] || '').toLowerCase();
    const userEmail = req.headers['user-email'] || req.body.usuario_email || 'desconocido';
    const rawCarpetaId = req.query.carpeta_id || req.body.carpeta_id;
    const carpetaId = (rawCarpetaId && rawCarpetaId !== 'null' && rawCarpetaId !== 'undefined')
        ? parseInt(rawCarpetaId, 10)
        : null;
    const reemplazar = (req.body.reemplazar === 'true' || req.query.reemplazar === 'true');
    const rolesSuperusuarios = ['coordinacion', 'controlador', 'presidente'];
    const rolesConfidenciales = ['jefe', 'controlador', 'presidente', 'coordinacion'];

    const esSuperusuario = rolesSuperusuarios.includes(userRole);
    const esDeEstaSeccion = (userSeccion === seccionDestino);

    if (!esSuperusuario && !esDeEstaSeccion) {
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }
        return res.status(403).send('No tienes permisos para subir archivos en esta sección.');
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No se seleccionó ningún archivo.');
    }

    // Identificar si la subida fue marcada como confidencial por un rol autorizado (Jefes o Controladores)
    const esConfidencialRaw = (req.body.confidencial === 'true' || req.query.confidencial === 'true' || req.body.confidencial === true);
    const esConfidencial = (rolesConfidenciales.includes(userRole) && esConfidencialRaw) ? 1 : 0;

    const archivosInsertados = [];

    try {
        for (const file of req.files) {
            const nombreArchivo = Buffer.from(file.originalname, 'latin1').toString('utf8');
            const urlArchivo = `http://localhost:3000/ver-archivo/${file.filename}`;

            // Buscar si ya existe un archivo con el mismo nombre en la misma ubicación (carpeta o raíz)
            let queryExiste = 'SELECT * FROM archivos_secciones WHERE LOWER(nombre) = LOWER(?) AND LOWER(seccion_destino) = ?';
            const paramsExiste = [nombreArchivo, seccionDestino];
            if (carpetaId) {
                queryExiste += ' AND carpeta_id = ?';
                paramsExiste.push(carpetaId);
            } else {
                queryExiste += ' AND carpeta_id IS NULL';
            }

            const [existentes] = await db.query(queryExiste, paramsExiste);

            let accion = 'SUBIDA';
            let detalles = carpetaId ? `Subido a carpeta (ID: ${carpetaId})` : 'Subido a la raíz';
            if (esConfidencial === 1) {
                detalles += ' [CONFIDENCIAL]';
            }

            if (existentes.length > 0) {
                if (!reemplazar) {
                    // Si no se confirmó el reemplazo, eliminar el archivo recién subido y notificar conflicto
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    return res.status(409).json({
                        error: `Ya existe un archivo llamado "${nombreArchivo}" en esta sección. ¿Deseas reemplazarlo?`,
                        existe: true,
                        nombre: nombreArchivo
                    });
                }

                // Si reemplazar es verdadero: borrar las versiones anteriores físicas y de BD
                for (const viejo of existentes) {
                    try {
                        await db.query('DELETE FROM comentarios_archivos WHERE archivo_id = ?', [viejo.id]);
                    } catch (_) {}

                    if (viejo.url) {
                        const viejoFisico = path.basename(viejo.url);
                        const rutaViejo = path.join(__dirname, 'uploads', viejoFisico);
                        if (fs.existsSync(rutaViejo)) {
                            try { fs.unlinkSync(rutaViejo); } catch (_) {}
                        }
                    }

                    await db.query('DELETE FROM archivos_secciones WHERE id = ?', [viejo.id]);
                }

                accion = 'REEMPLAZO';
                detalles = carpetaId ? `Reemplazó archivo anterior en carpeta (ID: ${carpetaId})` : 'Reemplazó archivo anterior en la raíz';
                if (esConfidencial === 1) {
                    detalles += ' [CONFIDENCIAL]';
                }
            }

            // Insertar el nuevo archivo con soporte de confidencialidad
            const query = 'INSERT INTO archivos_secciones (nombre, seccion_destino, url, carpeta_id, revisado, confidencial) VALUES (?, ?, ?, ?, 0, ?)';
            const [result] = await db.query(query, [nombreArchivo, seccionDestino, urlArchivo, carpetaId, esConfidencial]);

            // Registrar la acción en el historial de cambios
            await registrarHistorial({
                seccion: seccionDestino,
                accion: accion,
                archivoNombre: nombreArchivo,
                usuarioEmail: userEmail,
                usuarioRol: userRole,
                detalles: detalles
            });

            archivosInsertados.push({
                id: result.insertId,
                nombre: nombreArchivo,
                url: urlArchivo,
                seccion_destino: seccionDestino,
                carpeta_id: carpetaId,
                revisado: 0,
                confidencial: esConfidencial
            });
        }

        return res.json(archivosInsertados);
    } catch (err) {
        console.error('Error al insertar archivos:', err);
        return res.status(500).json({ error: `Hubo un error al registrar algunos archivos: ${err.message || err}` });
    }
});

// 3. PUBLICAR COMENTARIO CON SECCIÓN Y COORDENADAS
app.post('/api/archivos/comentar', async (req, res) => {
    const { archivo_id, usuario_email, comentario, coord_x, coord_y, coord_w, coord_h, seccion } = req.body;
    
    const userRole = (req.headers['user-role'] || '').toUpperCase();
    const userSeccion = (req.headers['user-seccion'] || '').toLowerCase();
    const seccionVista = (req.headers['seccion-vista'] || seccion || '').toLowerCase();

    const esPresidenteOControlador = ['PRESIDENTE', 'CONTROLADOR'].includes(userRole);
    const esJefeDeEstaSeccion = (userRole === 'JEFE' && userSeccion === seccionVista);

    if (!esPresidenteOControlador && !esJefeDeEstaSeccion) {
        return res.status(403).send('No tienes permisos para comentar en este archivo.');
    }

    if (!archivo_id || !comentario || !usuario_email) {
        return res.status(400).send('Faltan datos requeridos.');
    }

    const query = `
        INSERT INTO comentarios_archivos 
        (archivo_id, usuario_email, rol, seccion, comentario, coord_x, coord_y, coord_w, coord_h) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const [result] = await db.query(query, [
            archivo_id, usuario_email, userRole, seccionVista, comentario, 
            coord_x, coord_y, coord_w, coord_h
        ]);

        res.json({
            id: result.insertId,
            archivo_id,
            usuario_email,
            rol: userRole,
            seccion: seccionVista,
            comentario,
            coord_x,
            coord_y,
            coord_w,
            coord_h,
            fecha: new Date()
        });
    } catch (err) {
        console.error('Error MySQL al insertar comentario:', err);
        return res.status(500).send('Error al guardar la nota en la base de datos.');
    }
});

// 4. NOTIFICACIONES: Obtener pendientes por sección (Corregido sin fecha_creacion)
app.get('/api/notificaciones/:seccion', async (req, res) => {
  const { seccion } = req.params;
  try {
    const [archivos] = await db.query(
      'SELECT id, nombre, url FROM archivos_secciones WHERE LOWER(seccion_destino) = ? AND (revisado = 0 OR revisado IS NULL) ORDER BY id DESC LIMIT 10',
      [seccion.toLowerCase()]
    );

    res.json({
      activas: archivos.length > 0,
      quantity: archivos.length,
      archivos: archivos
    });
  } catch (error) {
    console.error('Error en notificaciones:', error);
    res.status(500).send('Error al consultar notificaciones');
  }
});

// 5. NOTIFICACIONES: Marcar notificaciones como leídas
app.post('/api/notificaciones/marcar-leidas', async (req, res) => {
  const { seccion } = req.body;
  try {
    await db.query(
      'UPDATE archivos_secciones SET revisado = 1 WHERE LOWER(seccion_destino) = ?',
      [seccion.toLowerCase()]
    );
    res.send('Notificaciones marcadas como leídas');
  } catch (error) {
    console.error('Error marcar leídas:', error);
    res.status(500).send('Error al actualizar notificaciones');
  }
});

// 6. OBTENER COMENTARIOS FILTRADOS POR SECCIÓN
app.get('/api/archivos/:id/comentarios', async (req, res) => {
    const archivoId = req.params.id;
    const seccionVista = (req.query.seccion || '').toLowerCase();

    let query = 'SELECT * FROM comentarios_archivos WHERE archivo_id = ?';
    let params = [archivoId];

    if (seccionVista) {
        query += ' AND LOWER(seccion) = ?';
        params.push(seccionVista);
    }

    query += ' ORDER BY fecha ASC';

    try {
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error('Error al obtener comentarios:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. ELIMINAR COMENTARIO
app.delete('/api/comentarios/eliminar/:id', async (req, res) => {
    const comentarioId = req.params.id;
    const userEmail = req.headers['user-email']; 
    const userRole = (req.headers['user-role'] || '').toLowerCase();

    if (!userEmail) {
        return res.status(401).send('Usuario no autenticado.');
    }

    try {
        const rolesPermitidos = ['jefe', 'coordinacion', 'controlador', 'presidente'];

        if (!rolesPermitidos.includes(userRole)) {
            return res.status(403).json({ error: 'No tienes permisos para eliminar comentarios.' });
        }

        const query = 'DELETE FROM comentarios_archivos WHERE id = ?';
        await db.query(query, [comentarioId]);
        
        res.json({ message: 'Comentario eliminado exitosamente.' });

    } catch (err) {
        console.error('Error al eliminar comentario:', err);
        res.status(500).send('Error al eliminar comentario.');
    }
});

// 8. ELIMINAR ARCHIVO (BORRA FÍSICO, BD Y REGISTRA EN HISTORIAL)
app.delete('/api/archivos/eliminar/:id', async (req, res) => {
    const archivoId = req.params.id;
    const userEmail = req.headers['user-email'] || 'desconocido'; 
    const userRole = (req.headers['user-role'] || '').toLowerCase();

    if (!userEmail) {
        return res.status(401).send('Usuario no autenticado.');
    }

    try {
        const rolesPermitidos = ['jefe', 'coordinacion', 'controlador', 'presidente'];

        if (!rolesPermitidos.includes(userRole)) {
            return res.status(403).send('No tienes permisos de Jefe o Administrador para eliminar archivos.');
        }

        // 1. Obtener datos del archivo antes de eliminarlo
        const [archivos] = await db.query('SELECT * FROM archivos_secciones WHERE id = ?', [archivoId]);
        if (archivos.length === 0) {
            return res.status(404).json({ error: 'Archivo no encontrado.' });
        }
        const archivo = archivos[0];

        // 2. Eliminar comentarios asociados
        try {
            await db.query('DELETE FROM comentarios_archivos WHERE archivo_id = ?', [archivoId]);
        } catch (comentarioErr) {
            console.log('No se eliminaron comentarios asociados:', comentarioErr.message);
        }

        // 3. Eliminar archivo físico de la carpeta uploads
        if (archivo.url) {
            const fileName = path.basename(archivo.url);
            const filePath = path.join(__dirname, 'uploads', fileName);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (fsErr) {
                    console.error('Error al borrar de disco:', fsErr.message);
                }
            }
        }

        // 4. Eliminar registro de la base de datos
        const query = 'DELETE FROM archivos_secciones WHERE id = ?';
        await db.query(query, [archivoId]);

        // 5. Registrar en el historial de cambios
        await registrarHistorial({
            seccion: archivo.seccion_destino,
            accion: 'ELIMINACION',
            archivoNombre: archivo.nombre,
            usuarioEmail: userEmail,
            usuarioRol: userRole,
            detalles: 'Archivo eliminado individualmente'
        });
        
        res.json({ message: 'Archivo eliminado correctamente.' });

    } catch (err) {
        console.error('Error al eliminar archivo:', err);
        res.status(500).send(`Error del servidor: ${err.message || err}`);
    }
});

// 9. ELIMINAR TODOS LOS ARCHIVOS DE UNA CARPETA (Llamado al eliminar una carpeta)
app.delete('/api/carpetas/:id/archivos', async (req, res) => {
    const carpetaId = req.params.id;
    const userEmail = req.headers['user-email'] || 'desconocido';
    const userRole = (req.headers['user-role'] || '').toLowerCase();

    try {
        // 1. Obtener todos los archivos contenidos en la carpeta
        const [archivos] = await db.query('SELECT * FROM archivos_secciones WHERE carpeta_id = ?', [carpetaId]);

        for (const arc of archivos) {
            // Borrar comentarios asociados
            try {
                await db.query('DELETE FROM comentarios_archivos WHERE archivo_id = ?', [arc.id]);
            } catch (cErr) {
                console.error('Error borrando comentarios de archivo:', cErr.message);
            }

            // Borrar archivo físico del disco
            if (arc.url) {
                const nombreFisico = path.basename(arc.url);
                const rutaDisco = path.join(__dirname, 'uploads', nombreFisico);
                if (fs.existsSync(rutaDisco)) {
                    try {
                        fs.unlinkSync(rutaDisco);
                    } catch (fErr) {
                        console.error('Error borrando archivo físico de carpeta:', fErr.message);
                    }
                }
            }

            // Registrar en historial de cambios
            await registrarHistorial({
                seccion: arc.seccion_destino,
                accion: 'ELIMINACION',
                archivoNombre: arc.nombre,
                usuarioEmail: userEmail,
                usuarioRol: userRole,
                detalles: `Eliminado automáticamente al borrar la carpeta (ID: ${carpetaId})`
            });
        }

        // 2. Eliminar registros de la base de datos
        await db.query('DELETE FROM archivos_secciones WHERE carpeta_id = ?', [carpetaId]);

        // Si existe en la tabla carpetas de MySQL, eliminarla también
        try {
            await db.query('DELETE FROM carpetas WHERE id = ?', [carpetaId]);
        } catch (_) {}

        res.json({ message: 'Archivos y contenidos de la carpeta eliminados con éxito.', eliminados: archivos.length });
    } catch (err) {
        console.error('Error al eliminar archivos de la carpeta:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. OBTENER HISTORIAL DE CAMBIOS DE UNA SECCIÓN
app.get('/api/historial/:seccion', async (req, res) => {
    const seccion = req.params.seccion.toLowerCase();
    const query = 'SELECT * FROM historial_cambios WHERE LOWER(seccion) = ? ORDER BY id DESC LIMIT 200';
    try {
        const [results] = await db.query(query, [seccion]);
        res.json(results);
    } catch (err) {
        console.error('Error al obtener historial:', err);
        res.status(500).json({ error: err.message });
    }
});

// 11. MOVER ARCHIVOS (DRAG AND DROP O SACAR A RAÍZ)
app.put('/api/archivos/mover', async (req, res) => {
    const { archivo_id, carpeta_id } = req.body;
    
    if (archivo_id === undefined || archivo_id === null) {
        return res.status(400).json({ error: 'Falta parámetro obligatorio (archivo_id)' });
    }

    const targetCarpetaId = (carpeta_id !== undefined && carpeta_id !== null && carpeta_id !== 'null' && carpeta_id !== 'undefined') 
        ? parseInt(carpeta_id, 10) 
        : null;
    
    try {
        const query = 'UPDATE archivos_secciones SET carpeta_id = ? WHERE id = ?';
        await db.query(query, [targetCarpetaId, archivo_id]); 

        // Registrar en historial si es posible
        try {
            const [archivos] = await db.query('SELECT * FROM archivos_secciones WHERE id = ?', [archivo_id]);
            if (archivos.length > 0) {
                const arc = archivos[0];
                const userEmail = req.headers['user-email'] || req.body.usuario_email || 'desconocido';
                const userRole = (req.headers['user-role'] || '').toLowerCase();
                const detalles = targetCarpetaId 
                    ? `Movido a carpeta (ID: ${targetCarpetaId})` 
                    : 'Sacado de la carpeta y devuelto a la página principal (raíz)';

                await registrarHistorial({
                    seccion: arc.seccion_destino,
                    accion: 'MOVIMIENTO',
                    archivoNombre: arc.nombre,
                    usuarioEmail: userEmail,
                    usuarioRol: userRole,
                    detalles: detalles
                });
            }
        } catch (hErr) {
            console.error('Aviso al registrar historial de movimiento:', hErr.message);
        }
        
        return res.status(200).json({ mensaje: 'Archivo movido con éxito en MySQL', carpeta_id: targetCarpetaId });
    } catch (err) {
        console.error('❌ Error en Node al mover archivo:', err);
        return res.status(500).json({ error: 'Error interno en MySQL al mover el archivo' });
    }
});

// PUERTO DE ESCUCHA
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend corriendo en http://localhost:${PORT}`);
    console.log(`✅ Base de Datos MySQL conectada mediante Pool de Promesas.`);
});