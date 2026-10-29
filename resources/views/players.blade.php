@extends('layouts.app')
@section('content')
<section class="page-hero admin-only">
    <p class="eyebrow">CONTROL DEL EQUIPO</p>
    <h1>Jugadores <em>Dragons.</em></h1>
    <p>Administra las cuentas que pueden entrar a la página. La plantilla de asistencia se agrega por separado desde Administración.</p>
</section>
<section class="admin-hub admin-only">
    <div class="admin-records">
        <p class="eyebrow">CUENTAS CON ACCESO</p>
        <h2>Lista de jugadores</h2>
        <p>Estas son las cuentas que pueden iniciar sesión en la página. Crear una cuenta no agrega a esa persona a la lista de asistencia.</p>
        <div id="player-list"></div>
    </div><button id="create-user-player" class="floating-player-button" title="Crear nuevo usuario-jugador">＋<span>Crear nuevo usuario-jugador</span></button>
</section>
<div id="user-player-card-modal" class="player-card-backdrop">
    <form id="player-form" class="player-card user-player-card"><button type="button" class="user-player-card-close player-card-close" aria-label="Cerrar">×</button>
        <div class="player-card-icon">♟</div>
        <p class="eyebrow">CUENTA DE JUGADOR</p>
        <h2>Nuevo usuario</h2>
        <p>Este jugador podrá iniciar sesión, ver comunicados, asistencia y la información interna del club.</p><label>Nombre completo<input name="name" required placeholder="Ej. Carlos López"></label><label>Correo electrónico<input name="email" required type="email" placeholder="jugador@correo.com"></label><label>Teléfono<input name="phone" required placeholder="+504 9782-8116"></label><label>Contraseña temporal<input name="tempPassword" required type="password" minlength="8" placeholder="Mínimo 8 caracteres"></label>
        <div class="player-card-actions"><button type="button" class="button cancel-user-player-card">Cancelar</button><button class="button primary">Crear jugador →</button></div>
    </form>
</div>
@endsection
