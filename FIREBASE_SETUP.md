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

## 5. Token temporal para ahorros

El navegador nunca debe generar ni validar el código SMS. El botón del sitio crea un documento en `savingsAccessRequests`. Configura una **Cloud Function** o backend con Admin SDK que:

1. detecte la solicitud;
2. genere un código aleatorio y con vencimiento;
3. lo envíe con un proveedor de SMS autorizado;
4. al verificarlo, asigne `savingsAccessUntil` con una hora futura al documento `users/{uid}`.

Así las reglas de Firestore permiten leer `savings` solo durante esa ventana temporal. Para crear cuentas de jugadores desde el panel de Carlo también se requiere esa función de backend: el cliente web no debe crear cuentas ni asignar roles administrativos.
