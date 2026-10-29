# Conexión de Dragons VC con Firebase

## 1. Crear y registrar el proyecto

1. Entra a [Firebase Console](https://console.firebase.google.com/) y crea el proyecto `Dragons VC`.
2. Agrega una aplicación **Web**. Copia el objeto de configuración que Firebase muestra al registrarla.
3. Copia `.env.example` como `.env` y llena todas las variables `VITE_FIREBASE_*` con esos valores. El archivo `.env` no se debe publicar ni subir a Git.
4. Reinicia Vite y genera la aplicación con `npm run build`.

## 2. Activar los servicios

- **Authentication** → Sign-in method → habilita `Email/Password` y la verificación por correo.
- **Firestore Database** → crea la base en modo producción.
- **Storage** → activa el bucket para fotos de perfil, imágenes y videos.

## 3. Publicar reglas

En Firestore → Rules, reemplaza las reglas con `firestore.rules`. En Storage → Rules, pega `storage.rules`.

Las reglas protegen los roles `guest`, `player` y `admin`. El perfil de Carlo debe tener `role: "admin"`; Tatito y los demás jugadores deben tener `role: "player"` en `users/{UID}`. Los primeros perfiles se crean con rol `guest`, por lo que el cambio de roles debe hacerse desde Firebase Console o una Cloud Function protegida.

## 4. Crear los usuarios iniciales

En Authentication → Users, crea las cuentas de correo para Tatito y Carlo con sus contraseñas. Copia el UID de cada cuenta y crea el documento correspondiente en Firestore:

```json
// users/UID_DE_CARLO
{ "name": "Carlo Urrutia", "email": "correo-de-carlo", "role": "admin" }

// users/UID_DE_TATITO
{ "name": "Tatito", "email": "correo-de-tatito", "role": "player", "phone": "+504..." }
```

Firebase Authentication usa correo y contraseña. Por eso, una vez conectado Firebase, el inicio de sesión se realiza con el correo de cada persona, no con el alias `Tatito` o `CarloUrrutia`.

## 5. Acceso a los ahorros

El administrador puede consultar el saldo y registrar movimientos. Las cuentas con rol `player` pueden consultar el saldo cuando tienen el correo verificado en Firebase Authentication. El botón del sitio envía el enlace de verificación por correo; al volver y presionarlo nuevamente se renueva el token y se consulta el saldo. No hay un código SMS ni un acceso temporal implementado en esta versión.

La creación y edición de cuentas desde el panel se realiza mediante las funciones protegidas `createPlayer`, `updatePlayer` y `deletePlayer`. Deben estar publicadas para gestionar cuentas desde la aplicación. La plantilla de asistencia se administra por separado y no cambia al crear o editar una cuenta.

En **Acceso al club → ¿Olvidaste tu contraseña?**, el enlace abre la página pública `/recuperar-contrasena`, donde cualquier usuario puede solicitar el enlace de recuperación al correo de su cuenta. La apertura usa una ruta real y no depende de intercambiar formularios dentro de una ventana emergente. Firebase Authentication envía el mensaje y gestiona el cambio de contraseña; el perfil, el UID y el rol se conservan. No se necesita iniciar sesión para solicitarlo. El formulario ofrece la misma confirmación para un correo registrado o desconocido y limita los reenvíos al mismo correo a uno por minuto en la página. No se requieren reglas nuevas ni funciones adicionales para esta recuperación.

## Ahorros por movimientos y privacidad de asistencia

El formulario de ahorros registra aportes (`income`) y gastos (`expense`) sobre el saldo actual en `savings/current`. Cada operación se guarda en `savingsMovements/{operationId}` con importe, motivo, saldo anterior y saldo resultante. El historial es exclusivo del administrador. Un reintento con el mismo identificador no duplica el movimiento y no se permiten gastos mayores al saldo. El saldo anterior se conserva; el cambio no ajusta automáticamente ningún monto existente.

La colección `attendance` queda reservada al administrador porque contiene las cantidades pendientes. Los atletas consultan `attendancePublic`, una copia sincronizada que contiene únicamente fecha, asistencia y estado del pago. La primera sesión del administrador con esta versión publica los resúmenes de listas anteriores sin borrar sus datos originales. Las ediciones posteriores actualizan las dos colecciones en una misma transacción.

Todos los usuarios consultan la misma plantilla manual `rosterPlayers`. El entrenador la administra en **Administración → Plantilla de asistencia → Agregar atleta a asistencia**. Una cuenta de acceso en `users` no se agrega automáticamente a la plantilla; crear, editar o eliminar una cuenta no modifica los atletas ni su historial. Los atletas de la plantilla no necesitan tener una cuenta en la página.

Al inicio del nombre de cada lista, el administrador dispone de un **lápiz para editar nombre y fecha** y una **× para eliminarla**. El nombre también puede indicarse al crear una lista; las antiguas usan «Entreno» hasta que se editen. La edición conserva el identificador, las asistencias y los pagos; actualiza también el nombre y fecha visibles para atletas sin publicar cantidades de deuda. Eliminar requiere confirmación y borra ambas copias de la lista en una operación atómica. No borra cuentas, atletas de la plantilla ni otras listas. Estas operaciones usan Firestore y no requieren Cloud Functions ni Blaze.

Las altas manuales llevan `source: "manual"` y `createdBy`. Las entradas creadas automáticamente por la versión anterior (`id == userId` sin origen manual, o `source: "account"`) quedan fuera de las listas sin borrar documentos ni registros históricos. Las fichas manuales anteriores conservan sus identificadores y su historial. Retirar un atleta lo marca `archived: true`; no elimina su cuenta ni sus asistencias guardadas.

### Publicación de esta versión

1. Ejecuta `npm test` y `npm run build`.
2. Publica `firestore.rules` y las funciones actualizadas: `firebase deploy --only "firestore:rules,functions"` (las funciones requieren Blaze).
3. Publica los archivos de la aplicación y sus recursos compilados.
4. Inicia sesión como administrador para preparar los resúmenes existentes y agrega a los atletas desde **Administración → Plantilla de asistencia**. Comprueba después con una cuenta de atleta que ve la lista manual completa y los estados, pero no los montos.

Coordina la actualización de reglas y aplicación: una versión anterior del navegador deja de poder consultar la colección privada `attendance` cuando se publican estas reglas, y debe recargarse para usar `attendancePublic`. Estos cambios de código no despliegan reglas ni funciones automáticamente.

## Control de Actividades

La ruta `/control-de-actividades` muestra las actividades más recientes primero. El administrador crea cada actividad con nombre y fecha opcional y agrega manualmente a las personas que recibieron una entrega. Cada entrega tiene nombre, detalle opcional (por ejemplo, números de rifa) y estado `pending` o `paid`. El estado puede corregirse en ambos sentidos. El lápiz edita nombres y detalles; la × pide confirmación para eliminar actividades o entregas.

Los documentos `activities/{activityId}` contienen la lista de entregas en `participants`. No se agregan automáticamente cuentas ni atletas de asistencia; eliminar una actividad no cambia usuarios, asistencias ni ahorros. El límite es de 200 personas por actividad para mantener el documento dentro de un tamaño manejable. Los cambios de pagos usan transacciones para conservar actualizaciones simultáneas de otros participantes. Los usuarios autenticados pueden consultar; solo el administrador puede escribir mediante las reglas de Firestore. No requiere Blaze, Cloud Functions ni Storage. Publica `firestore.rules` junto con esta versión.

## Alojamiento en SmarterASP.NET

Consulta `SMARTERASP_DEPLOY.md` para preparar el alojamiento PHP/IIS y el dominio. Las sesiones y la caché de Laravel usan archivos; los datos del club siguen en Firebase. El script `scripts/package-smarterasp.ps1` prepara un ZIP sin el .env privado, sesiones, logs ni bases locales.

Mientras Blaze no esté activo, quedan pendientes la publicación de Cloud Functions y la disponibilidad del bucket de Storage. Las reglas locales ya contemplan fotos de competencias de hasta 10 MB, pero deben publicarse cuando se configure Storage.
