# Dragons VC

Sitio del club en Laravel 12/PHP y JavaScript con Firebase Authentication, Firestore, Storage y Cloud Functions. Las cuentas de acceso son independientes de la plantilla manual de asistencia.

## Desarrollo local

Requisitos: PHP 8.2 o superior con sus extensiones, Composer y Node.js compatible con Vite. Desde la carpeta del proyecto:

```powershell
composer install
Copy-Item .env.example .env
php artisan key:generate
npm ci
```

Completa las variables `VITE_FIREBASE_*` del .env con la configuración web de tu proyecto Firebase. No incluyas credenciales de servidor ni claves privadas en el navegador. Ejecuta `php artisan serve` y `npm run dev` en terminales separadas.

Los datos del club se guardan en Firebase. Laravel usa `SESSION_DRIVER=file`, `CACHE_STORE=file` y `QUEUE_CONNECTION=sync`; las funciones actuales no necesitan migraciones ni una base SQL local.

## Comprobaciones

```powershell
npm test
php artisan test
npm run build
```

## Publicación

Lee [la guía de SmarterASP.NET](SMARTERASP_DEPLOY.md) para configurar PHP/IIS, HTTPS y el dominio .com. Después de compilar, `pwsh -File scripts/package-smarterasp.ps1` crea el paquete en `dist/`. No contiene el .env privado, sesiones, logs ni bases locales. La raíz pública del alojamiento debe ser la carpeta `public`.

Consulta [FIREBASE_SETUP.md](FIREBASE_SETUP.md) para roles, privacidad de asistencia y reglas. Gestionar cuentas desde la página requiere publicar las Cloud Functions, y subir fotos requiere Storage; ambos quedan pendientes mientras no se active Blaze. El correo de recuperación lo envía Firebase Authentication.

No publiques el .env real ni credenciales de Firebase Admin. El paquete y las pruebas locales no sustituyen la comprobación final en el hosting contratado.
