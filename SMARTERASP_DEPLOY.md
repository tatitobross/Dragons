# Publicar Dragons VC en SmarterASP.NET

El dominio .com se conecta al alojamiento; no cambia el lenguaje del proyecto. Dragons VC es Laravel 12/PHP y usa Firebase para usuarios, asistencias, ahorros y publicaciones. No necesita SQLite ni MySQL para sus funciones actuales: sesiones y cache usan archivos privados y las colas se ejecutan en la solicitud.

## Preparar y subir

1. Confirma en SmarterASP.NET PHP **8.2 o superior**, extensiones requeridas por Composer, IIS URL Rewrite y HTTPS. No selecciones el sitio como aplicación ASP.NET: debe ejecutar PHP. El proveedor publica su [guía de Laravel en IIS](https://www.smarterasp.net/support/kb/a2199/how-to-build-and-deploy-laravel-to-iis.aspx).
2. En tu computadora ejecuta `npm ci`, `npm test` y `npm run build`, con las variables VITE_FIREBASE del proyecto correcto. Firebase queda incluido en el JavaScript compilado: cambiar solo el .env del servidor no recompila estos valores.
3. Ejecuta `pwsh -File scripts/package-smarterasp.ps1`. El ZIP generado en dist incluye el proyecto y vendor local; no contiene tu .env, bases SQLite, sesiones, logs ni archivos privados. Si preparas dependencias en otra carpeta, usa `composer install --no-dev --optimize-autoloader`. No subas node_modules.
4. Extrae el ZIP y sube la carpeta dragonsvc. En el panel configura la **carpeta pública del sitio a dragonsvc/public**. Si el plan no permite elegirla, solicita esa configuración al soporte antes de publicar. No expongas la raíz completa del proyecto ni muevas index.php sin adaptar sus rutas.
5. Copia .env.production.example como .env **dentro de dragonsvc**, fuera de public. Cambia APP_URL al dominio HTTPS real y completa APP_KEY con una clave nueva. Puedes generarla en tu PC mediante `php artisan key:generate --show` y pegarla solo en el .env privado del servidor; conserva esa clave para futuras actualizaciones.
6. Mantén APP_ENV=production, APP_DEBUG=false, SESSION_DRIVER=file, CACHE_STORE=file y QUEUE_CONNECTION=sync. Da permiso de escritura a la identidad de IIS únicamente en storage y bootstrap/cache. No se requieren migraciones para las funciones actuales.
7. public/web.config redirige a index.php las rutas que no sean archivos ni carpetas. Si / funciona pero /asistencia o /recuperar-contrasena devuelve 404 de IIS, comprueba URL Rewrite y la carpeta pública configurada.

No subas public/hot, caches generadas localmente ni tu archivo SQLite anterior. La aplicación no elimina esos datos del equipo: simplemente deja de depender de ellos.

## Firebase: pendiente mientras no esté activo Blaze

Authentication y Firestore siguen usando el proyecto dragonsvc-48099. Las cuentas de acceso y la plantilla manual de asistencia son independientes. El despliegue no reinicia ni suma de nuevo el saldo de ahorros.

Para crear/editar/borrar cuentas desde la página deben publicarse createPlayer, updatePlayer y deletePlayer. Las fotos de perfil, galería y competencias necesitan un bucket activo. Cloud Functions y Cloud Storage requieren Blaze; contratar el hosting no activa esa facturación automáticamente.

Cuando decidas activar Blaze, configura el bucket correcto y publica desde tu PC:

```powershell
npm --prefix functions ci
firebase deploy --only "firestore:rules,storage,functions" --project dragonsvc-48099
```

Las reglas de competencias permiten imágenes de hasta 10 MB, solo para el administrador. Verifica también los dominios autorizados de Authentication para el dominio elegido. El correo de recuperación lo envía Firebase, no el servidor SMTP de SmarterASP.NET.

## Comprobar antes de anunciar la página

- Entrar como administrador y atleta; probar recuperación con un correo real.
- Crear lista de asistencia y agregar atletas manualmente desde Administración.
- Confirmar que el atleta ve los estados y no las cantidades de deuda.
- Registrar un aporte y un gasto controlados solo cuando decidas qué datos reales usar.
- Con Blaze activo: crear una cuenta de prueba y subir fotos en los tres apartados.
- Verificar likes persistentes (uno por persona), comentarios y navegación directa a cada URL.
- Confirmar que /.env y /composer.json no sean accesibles por HTTP.

La configuración fue comprobada localmente. La validación de IIS, HTTPS y entrega de correos debe completarse en el servicio contratado; aún no hay un dominio ni una cuenta de hosting configurados por este proyecto.
