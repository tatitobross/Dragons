<!doctype html>
<html lang="es">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#06172f">
    <title>{{ $title ?? 'Dragons VC | Club de Volleyball' }}</title>
    <link rel="icon" type="image/png" href="{{ asset('images/dragons-logo.png') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">@vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body>
    <header class="site-header"><a class="brand" href="{{ route('home') }}"><img src="{{ asset('images/dragons-logo.png') }}" alt="Logo Dragons VC"><span>DRAGONS<small>VOLLEYBALL CLUB</small></span></a>
        <nav><a href="{{ route('home') }}#competencias">Competencias</a><a href="{{ route('home') }}#eventos">Agenda</a><a href="{{ route('home') }}#galeria">Galería</a><a href="{{ route('home') }}#club">El club</a><a href="{{ route('home') }}#contacto">Contacto</a><a class="member-nav" href="{{ route('member') }}#ahorros">Ahorros</a><a class="member-nav" href="{{ route('member') }}#comunicados">Comunicados</a><a class="member-nav" href="{{ route('attendance') }}">Asistencia</a><a class="admin-nav" href="{{ route('admin') }}">Administración</a><a class="admin-nav" href="{{ route('players') }}">Jugadores</a></nav><button class="access-btn" data-modal="login">Acceso al club <span>→</span></button>
        <div class="profile-menu"><button class="profile-trigger" aria-expanded="false"><span class="profile-avatar">D</span><span data-profile-menu-name>Mi perfil</span><i>⌄</i></button>
            <div class="profile-dropdown"><a href="{{ route('profile') }}">Mi perfil</a><button data-logout>Salir</button></div>
        </div>
    </header>
    <main>@yield('content')</main>
    <footer><span>© 2026 DRAGONS VOLLEYBALL CLUB</span><span>HONDURAS · JUGAMOS CON PROPÓSITO</span><a href="{{ route('home') }}">VOLVER AL INICIO ↑</a></footer>
    <div class="modal-backdrop" id="modal">
        <div class="modal"><button class="modal-close" aria-label="Cerrar">×</button>
            <div id="modal-content"></div>
        </div>
    </div>
    <div id="admin-edit-modal" class="player-card-backdrop">
        <form id="admin-edit-form" class="player-card admin-edit-card"><button type="button" class="admin-edit-close player-card-close" aria-label="Cerrar">×</button>
            <div class="player-card-icon">✎</div>
            <p class="eyebrow" data-editor-kind>EDICIÓN</p>
            <h2 data-editor-title>Editar registro</h2>
            <p data-editor-copy>Actualiza la información y guarda los cambios.</p>
            <div id="admin-edit-fields"></div>
            <div class="player-card-actions"><button type="button" class="button cancel-admin-edit">Cancelar</button><button class="button primary">Guardar cambios →</button></div>
        </form>
    </div>
    <template id="login-template">
        <p class="eyebrow">ZONA PRIVADA</p>
        <h2>Acceso al <em>club</em></h2>
        <p class="modal-intro">Jugadores y entrenador: usa tus credenciales para entrar a tu espacio.</p>
        <form id="login-form"><label>Correo electrónico<input required name="username" type="email" placeholder="correo@ejemplo.com"></label><label>Contraseña<input required type="password" name="password" placeholder="••••••••"></label><button class="button primary">Iniciar sesión →</button></form>
        <p class="form-note">¿Eres visitante? <button class="inline-button" data-switch="guest">Regístrate como invitado</button></p>
    </template><template id="guest-template">
        <p class="eyebrow">COMUNIDAD DRAGONS</p>
        <h2>Cuenta de <em>invitado</em></h2>
        <form id="guest-form"><label>Nombre<input required name="name"></label><label>Correo electrónico<input required name="email" type="email"></label><label>Contraseña<input required name="password" type="password" minlength="8"></label><button class="button primary">Crear cuenta →</button></form>
    </template><template id="question-template">
        <p class="eyebrow">EVENTOS DRAGONS</p>
        <h2>Haz una <em>pregunta</em></h2>
        <form id="question-form"><label>Tu nombre<input required name="name"></label><label>Tu consulta<textarea required name="question"></textarea></label><button class="button primary">Enviar consulta →</button></form>
    </template><template id="dashboard-template">
        <h2>Hola, <em data-user-name></em></h2>
        <p class="modal-intro">Bienvenido de nuevo a tu espacio en Dragons VC.</p>
    </template>
</body>

</html>