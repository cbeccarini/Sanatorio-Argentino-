from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
import io
import zipfile
import os
import sys
import urllib.request
import urllib.error
import json

# Asegurar codificación utf-8 para la consola de Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

app = Flask(__name__)
CORS(app)

# --- CONFIGURACIÓN DE LA BASE DE DATOS (SQLite para carpetas) ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///gestor_carpetas.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- CONFIGURACIÓN DE ENVÍO DE CORREO (Gmail SMTP) ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'fabriciobeccarini@gmail.com'
app.config['MAIL_PASSWORD'] = 'dadyijfpzvawfonf' # 16 letras
app.config['MAIL_DEFAULT_SENDER'] = 'fabriciobeccarini@gmail.com'

db = SQLAlchemy(app)
mail = Mail(app)

SECCIONES = (
    'farmacia',
    'rrhh',
    'quirofano',
    'hoteleria',
    'sistemas',
    'coordinacion',
    'enfermeria',
    'cocina',
    'administracion',
    'servicios',
)
CARPETAS_FIJAS = ('Enfermería', 'Manuales', 'Procedimientos', 'Instructivos', 'Registros')
PROPIETARIO_CARPETAS_FIJAS = 'sistema@sanatorio.local'


# --- MODELOS ---
class Carpeta(db.Model):
    __tablename__ = 'carpetas'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    propietario_email = db.Column(db.String(150), nullable=False)
    seccion = db.Column(db.String(50), nullable=False) 
    padre_id = db.Column(db.Integer, db.ForeignKey('carpetas.id'), nullable=True)
    protegida = db.Column(db.Boolean, nullable=False, default=False)
    confidencial = db.Column(db.Boolean, nullable=False, default=False)

class CarpetaCompartida(db.Model):
    __tablename__ = 'carpetas_compartidas'
    id = db.Column(db.Integer, primary_key=True)
    carpeta_id = db.Column(db.Integer, db.ForeignKey('carpetas.id'), nullable=False)
    usuario_email = db.Column(db.String(150), nullable=False)

# Inicialización de la base de datos y migraciones
with app.app_context():
    db.create_all()
    from sqlalchemy import text
    with db.engine.begin() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(carpetas)")).fetchall()]
        if 'padre_id' not in cols:
            conn.execute(text("ALTER TABLE carpetas ADD COLUMN padre_id INTEGER DEFAULT NULL REFERENCES carpetas(id)"))
            print("[MIGRACION] Columna 'padre_id' agregada exitosamente a la tabla carpetas.")
        if 'protegida' not in cols:
            conn.execute(text("ALTER TABLE carpetas ADD COLUMN protegida BOOLEAN NOT NULL DEFAULT 0"))
            print("[MIGRACION] Columna 'protegida' agregada exitosamente a la tabla carpetas.")
        if 'confidencial' not in cols:
            conn.execute(text("ALTER TABLE carpetas ADD COLUMN confidencial BOOLEAN NOT NULL DEFAULT 0"))
            print("[MIGRACION] Columna 'confidencial' agregada exitosamente a la tabla carpetas.")


# --- MANEJO GLOBAL DE ERRORES ---
@app.errorhandler(Exception)
def manejar_error_global(error):
    print(f"[ERROR CRITICO] Backend: {str(error)}")
    return jsonify({'error': f'Error interno del servidor: {str(error)}'}), 500


# --- RUTAS ---

# 1. OBTENER CARPETAS POR SECCIÓN
@app.route('/api/carpetas/<string:seccion_actual>', methods=['GET'])
def obtener_carpetas(seccion_actual):
    email = request.headers.get('User-Email') or request.headers.get('user-email')
    rol = (request.headers.get('User-Role') or request.headers.get('user-role') or '').lower()

    if not email:
        return jsonify({'error': 'Email requerido'}), 400

    roles_confidenciales = ['jefe', 'controlador', 'presidente', 'coordinacion']
    puede_ver_confidenciales = rol in roles_confidenciales

    query_seccion = Carpeta.query.filter_by(seccion=seccion_actual.lower())
    if not puede_ver_confidenciales:
        query_seccion = query_seccion.filter((Carpeta.confidencial == False) | (Carpeta.confidencial.is_(None)))
    carpetas_seccion = query_seccion.all()
    
    compartidas_ids = [c.carpeta_id for c in CarpetaCompartida.query.filter_by(usuario_email=email.lower()).all()]
    query_compartidas = Carpeta.query.filter(Carpeta.id.in_(compartidas_ids))
    if not puede_ver_confidenciales:
        query_compartidas = query_compartidas.filter((Carpeta.confidencial == False) | (Carpeta.confidencial.is_(None)))
    carpetas_compartidas = query_compartidas.all()

    return jsonify({
        'mis_carpetas': [{'id': c.id, 'nombre': c.nombre, 'propietario': c.propietario_email, 'seccion': c.seccion, 'padre_id': c.padre_id, 'protegida': bool(c.protegida), 'confidencial': bool(c.confidencial)} for c in carpetas_seccion],
        'compartidas_conmigo': [{'id': c.id, 'nombre': c.nombre, 'propietario': c.propietario_email, 'seccion': c.seccion, 'padre_id': c.padre_id, 'protegida': bool(c.protegida), 'confidencial': bool(c.confidencial)} for c in carpetas_compartidas]
    }), 200


def puede_gestionar_carpeta_fija(carpeta, rol, seccion_usuario):
    return rol == 'controlador'


def notificar_node_eliminar_archivos(carpeta_id, email, rol):
    """Notifica al backend Node.js para que elimine los archivos físicos y en MySQL asociados a esta carpeta."""
    try:
        NODE_URL = f"http://localhost:3000/api/carpetas/{carpeta_id}/archivos"
        req = urllib.request.Request(
            NODE_URL,
            headers={
                'User-Email': str(email or ''),
                'User-Role': str(rol or '')
            },
            method='DELETE'
        )
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode('utf-8')
            print(f"[OK] Archivos de carpeta {carpeta_id} eliminados en Node.js: {resp_body}")
    except Exception as e:
        print(f"[AVISO] Al comunicar con Node.js para eliminar archivos: {str(e)}")


def obtener_todos_descendientes(carpeta_id):
    """Devuelve recursivamente el ID de la carpeta y los IDs de todas sus subcarpetas descendientes."""
    descendientes = [carpeta_id]
    hijos = Carpeta.query.filter_by(padre_id=carpeta_id).all()
    for h in hijos:
        descendientes.extend(obtener_todos_descendientes(h.id))
    return descendientes


def eliminar_carpeta_recursiva(carpeta_id, email, rol):
    """Elimina en cascada todos los archivos físicos en Node.js, las asociaciones compartidas y las subcarpetas."""
    todos_ids = obtener_todos_descendientes(carpeta_id)
    for cid in todos_ids:
        notificar_node_eliminar_archivos(cid, email, rol)
    CarpetaCompartida.query.filter(CarpetaCompartida.carpeta_id.in_(todos_ids)).delete(synchronize_session=False)
    for cid in reversed(todos_ids):
        c = Carpeta.query.get(cid)
        if c:
            db.session.delete(c)
    db.session.commit()


# 2. CREAR CARPETA O SUBCARPETA (Validando Área, Rol, Padre y Reemplazo)
@app.route('/api/carpetas', methods=['POST'])
def crear_carpeta():
    email = request.headers.get('user-email') or request.headers.get('User-Email')
    rol = (request.headers.get('user-role') or request.headers.get('User-Role') or '').lower()
    seccion_usuario = (request.headers.get('user-seccion') or request.headers.get('User-Seccion') or '').lower()
    
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    seccion_destino = data.get('seccion', seccion_usuario).lower()
    reemplazar = bool(data.get('reemplazar', False))
    padre_id_raw = data.get('padre_id')
    
    padre_id = None
    if padre_id_raw is not None and str(padre_id_raw).lower() not in ('null', 'none', ''):
        try:
            padre_id = int(padre_id_raw)
        except (ValueError, TypeError):
            padre_id = None

    if not email or not nombre:
        return jsonify({'error': 'Faltan parámetros obligatorios (nombre o email)'}), 400

    roles_superusuarios = ['coordinacion', 'presidente', 'controlador']
    roles_confidenciales = ['jefe', 'controlador', 'presidente', 'coordinacion']
    
    if rol not in roles_superusuarios and seccion_usuario != seccion_destino:
        return jsonify({
            'error': f'No tienes permisos para crear carpetas en el área de {seccion_destino}. Tu sección asignada es {seccion_usuario}.'
        }), 403

    # Supercarpeta protegida: SOLO si el controlador lo marca explícitamente en la casilla
    es_protegida = bool(data.get('protegida', False)) if rol == 'controlador' else False

    # Archivos/Carpetas confidenciales: SOLO si Jefe o Controlador (o admin) lo marca
    es_confidencial = bool(data.get('confidencial', False)) if rol in roles_confidenciales else False

    # Si se especificó carpeta padre, validar existencia y tomar su sección
    if padre_id is not None:
        carpeta_padre = Carpeta.query.get(padre_id)
        if not carpeta_padre:
            return jsonify({'error': 'La carpeta contenedora no existe'}), 404
        seccion_destino = carpeta_padre.seccion.lower()

    # Comprobar si ya existe una carpeta con el mismo nombre en la misma sección y mismo nivel
    query_existente = Carpeta.query.filter(
        db.func.lower(Carpeta.nombre) == nombre.lower(),
        Carpeta.seccion == seccion_destino
    )
    if padre_id is not None:
        query_existente = query_existente.filter(Carpeta.padre_id == padre_id)
    else:
        query_existente = query_existente.filter(Carpeta.padre_id.is_(None))

    carpeta_existente = query_existente.first()

    if carpeta_existente:
        if not reemplazar:
            tipo_carpeta = 'subcarpeta' if padre_id else 'carpeta'
            return jsonify({
                'error': f'Ya existe una {tipo_carpeta} llamada "{nombre}" en esta ubicación. ¿Deseas reemplazarla?',
                'existe': True,
                'carpeta_id': carpeta_existente.id,
                'nombre': carpeta_existente.nombre
            }), 409

        if carpeta_existente.protegida and rol != 'controlador':
            return jsonify({'error': 'Solo el controlador puede reemplazar una supercarpeta protegida.'}), 403

        # Si reemplazar es True: eliminar recursivamente la carpeta previa, sus subcarpetas y contenidos
        eliminar_carpeta_recursiva(carpeta_existente.id, email, rol)

    try:
        nueva_carpeta = Carpeta(
            nombre=nombre, 
            propietario_email=email.lower(), 
            seccion=seccion_destino,
            padre_id=padre_id,
            protegida=es_protegida,
            confidencial=es_confidencial
        )
        db.session.add(nueva_carpeta)
        db.session.commit()

        return jsonify({
            'mensaje': 'Carpeta creada con éxito', 
            'id': nueva_carpeta.id, 
            'nombre': nueva_carpeta.nombre,
            'padre_id': nueva_carpeta.padre_id,
            'protegida': nueva_carpeta.protegida,
            'confidencial': nueva_carpeta.confidencial
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Al insertar carpeta en SQLite: {str(e)}")
        return jsonify({'error': f'Error en la base de datos: {str(e)}'}), 500
    

# 3. RENOMBRAR CARPETA
@app.route('/api/carpetas/<int:carpeta_id>/renombrar', methods=['PUT'])
def renombrar_carpeta(carpeta_id):
    email = request.headers.get('User-Email') or request.headers.get('user-email')
    rol = (request.headers.get('User-Role') or request.headers.get('user-role') or '').lower()
    seccion_usuario = (request.headers.get('User-Seccion') or request.headers.get('user-seccion') or '').lower()
    data = request.get_json() or {}
    nuevo_nombre = data.get('nombre')

    carpeta = Carpeta.query.get(carpeta_id)
    if not carpeta:
        return jsonify({'error': 'Carpeta no encontrada'}), 404

    # Si es supercarpeta protegida, ningún empleado puede renombrarla: SOLO el controlador
    if carpeta.protegida and rol != 'controlador':
        return jsonify({'error': 'Solo el controlador tiene permisos para cambiar el nombre de una supercarpeta protegida.'}), 403

    es_propietario = email and carpeta.propietario_email == email.lower()
    es_admin = rol in ['coordinacion', 'presidente', 'controlador']
    if not es_propietario and not es_admin:
        return jsonify({'error': 'No tienes permisos para cambiar el nombre'}), 403

    if not nuevo_nombre or not nuevo_nombre.strip():
        return jsonify({'error': 'El nombre de la carpeta es obligatorio'}), 400

    carpeta.nombre = nuevo_nombre.strip()
    db.session.commit()
    return jsonify({'mensaje': 'Nombre actualizado correctamente'}), 200


# 4. ELIMINAR CARPETA Y SUS CONTENIDOS/RELACIONES (EN CASCADA)
@app.route('/api/carpetas/<int:carpeta_id>', methods=['DELETE'])
def eliminar_carpeta(carpeta_id):
    email = request.headers.get('User-Email') or request.headers.get('user-email')
    rol = (request.headers.get('User-Role') or request.headers.get('user-role') or '').lower()
    
    carpeta = Carpeta.query.get(carpeta_id)
    if not carpeta:
        return jsonify({'error': 'Carpeta no encontrada'}), 404

    # Si es supercarpeta protegida, SOLO el controlador puede eliminarla
    if carpeta.protegida and rol != 'controlador':
        return jsonify({'error': 'Solo el controlador puede eliminar una supercarpeta protegida.'}), 403

    es_propietario = carpeta.propietario_email == email.lower() if email else False
    es_admin = rol in ['coordinacion', 'presidente', 'controlador']
    if not es_propietario and not es_admin:
        return jsonify({'error': 'No tienes permisos para eliminar esta carpeta'}), 403

    try:
        nombre_carpeta = carpeta.nombre
        eliminar_carpeta_recursiva(carpeta_id, email, rol)
        return jsonify({'mensaje': f'Carpeta "{nombre_carpeta}" y todos sus contenidos eliminados correctamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error al eliminar la carpeta: {str(e)}'}), 500


# 5. COMPARTIR CARPETA Y ENVIAR NOTIFICACIÓN POR CORREO
@app.route('/api/carpetas/<int:carpeta_id>/compartir', methods=['POST'])
def compartir_carpeta(carpeta_id):
    email_propietario = request.headers.get('User-Email') or request.headers.get('user-email')
    rol = (request.headers.get('User-Role') or request.headers.get('user-role') or '').lower()
    seccion_usuario = (request.headers.get('User-Seccion') or request.headers.get('user-seccion') or '').lower()
    data = request.get_json() or {}
    email_destino = (data.get('email_destino') or '').strip().lower()

    carpeta = Carpeta.query.get(carpeta_id)
    if not carpeta:
        return jsonify({'error': 'Carpeta inexistente'}), 404
    es_propietario = email_propietario and carpeta.propietario_email == email_propietario.lower()
    puede_compartir_fija = (
        carpeta.protegida
        and email_propietario
        and puede_gestionar_carpeta_fija(carpeta, rol, seccion_usuario)
    )
    if not es_propietario and not puede_compartir_fija:
        return jsonify({'error': 'No authorized o carpeta inexistente'}), 403
    if not email_destino:
        return jsonify({'error': 'El correo de destino es obligatorio'}), 400

    existente = CarpetaCompartida.query.filter_by(carpeta_id=carpeta_id, usuario_email=email_destino).first()
    if not existente:
        nueva_relacion = CarpetaCompartida(carpeta_id=carpeta_id, usuario_email=email_destino)
        db.session.add(nueva_relacion)
        db.session.commit()

    try:
        msg = Message(
            subject=f"📁 Carpeta compartida contigo: {carpeta.nombre}",
            recipients=[email_destino]
        )
        msg.body = f"Hola!\n\nEl usuario {email_propietario} ha compartido la carpeta '{carpeta.nombre}' contigo en el sistema."
        
        mail.send(msg)
        print(f"[OK] Correo enviado exitosamente a {email_destino}!")
        return jsonify({'mensaje': f'Carpeta compartida y correo enviado a {email_destino}'}), 200

    except Exception as e:
        print(f"[ERROR] Correo: {e}")
        return jsonify({'error': f'Carpeta guardada, pero hubo un error al enviar el correo: {str(e)}'}), 500


# 6. DESCARGAR CARPETA COMPRIMIDA
@app.route('/api/carpetas/<int:carpeta_id>/descargar', methods=['GET'])
def descargar_carpeta(carpeta_id):
    carpeta = Carpeta.query.get(carpeta_id)
    if not carpeta:
        return jsonify({'error': 'Carpeta no encontrada'}), 404

    stream_zip = io.BytesIO()
    with zipfile.ZipFile(stream_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{carpeta.nombre}/info.txt", f"Contenido comprimido de la carpeta: {carpeta.nombre}")

    stream_zip.seek(0)
    return send_file(
        stream_zip,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f"{carpeta.nombre}.zip"
    )


# 7. ENRUTADOR INTERMEDIO Y PERSISTENCIA DE MOVER ARCHIVO (ENTRE CARPETAS O DE VUELTA A RAÍZ)
@app.route('/api/carpetas/mover-archivo', methods=['PUT'])
def mover_archivo_a_carpeta():
    email = request.headers.get('User-Email') or request.headers.get('user-email')
    rol = (request.headers.get('User-Role') or request.headers.get('user-role') or '').lower()
    
    data = request.get_json() or {}
    archivo_id = data.get('archivo_id')
    carpeta_id_raw = data.get('carpeta_id')

    if not email:
        return jsonify({'error': 'Identificación de usuario requerida (Email)'}), 400

    if archivo_id is None:
        return jsonify({'error': 'Falta parámetro obligatorio (archivo_id)'}), 400

    target_carpeta_id = None
    if carpeta_id_raw is not None and str(carpeta_id_raw).lower() not in ('null', 'none', ''):
        try:
            target_carpeta_id = int(carpeta_id_raw)
        except (ValueError, TypeError):
            return jsonify({'error': 'ID de carpeta inválido'}), 400

        # 1. Validar la existencia de la carpeta destino en SQLite
        carpeta = Carpeta.query.get(target_carpeta_id)
        if not carpeta:
            return jsonify({'error': 'La carpeta de destino no existe'}), 404

        # 2. Control de accesos cruzados
        es_propietario = carpeta.propietario_email == email.lower()
        es_compartida = CarpetaCompartida.query.filter_by(carpeta_id=target_carpeta_id, usuario_email=email.lower()).first() is not None
        es_admin = rol in ['coordinacion', 'presidente', 'controlador']
        seccion_usuario = (request.headers.get('User-Seccion') or request.headers.get('user-seccion') or '').lower()
        es_usuario_de_seccion = seccion_usuario == carpeta.seccion.lower()
        puede_usar_carpeta_fija = carpeta.protegida and es_usuario_de_seccion

        if not es_propietario and not es_compartida and not es_admin and not puede_usar_carpeta_fija:
            return jsonify({'error': 'No tienes privilegios para ingresar archivos en esta carpeta.'}), 403

    # 3. CONEXIÓN DIRECTA CON EL BACKEND NODE.JS
    try:
        NODE_URL = "http://localhost:3000/api/archivos/mover" 
        
        payload_node = json.dumps({
            'archivo_id': int(archivo_id),
            'carpeta_id': target_carpeta_id
        }).encode('utf-8')
        
        req = urllib.request.Request(
            NODE_URL, 
            data=payload_node, 
            headers={
                'Content-Type': 'application/json',
                'User-Email': str(email),
                'User-Role': str(rol)
            },
            method='PUT'
        )
        
        # urllib maneja los estados HTTP erróneos lanzando HTTPError, lo capturamos abajo
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()

        return jsonify({
            'mensaje': 'Archivo movido y persistido con éxito mediante Node.js',
            'archivo_id': archivo_id,
            'carpeta_id': target_carpeta_id
        }), 200

    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        print(f"[ERROR] Node.js devolvio error ({e.code}): {error_msg}")
        return jsonify({'error': f'Node.js rechazó la acción: {error_msg}'}), e.code
    except Exception as e:
        print(f"[ERROR] En la comunicacion con Node.js: {str(e)}")
        return jsonify({'error': f'Error al sincronizar el almacenamiento con Node.js: {str(e)}'}), 500

    
if __name__ == '__main__':
    app.run(port=5000, debug=True)